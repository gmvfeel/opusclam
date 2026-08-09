#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · CSS 전후 대조 도구            tools/css-snapshot.py
════════════════════════════════════════════════════════════════

★ 무엇에 쓰나
  화면에서 CSS 를 공용 파일로 옮길 때, <b>모습이 그대로인지</b> 확인합니다.
  파일을 눈으로 견주는 것으로는 모자랍니다. 규칙을 옮기면 <b>차례</b>가
  바뀌고, 차례가 바뀌면 같은 셀렉터끼리 이기고 지는 관계가 달라져
  화면이 조용히 틀어집니다.

★ 실제로 두 번 사고를 막았습니다 (2026-08-10)
  ① 같은 셀렉터가 한 화면에 두 번 넘게 나오는 것을 옮겼다가
     표 머리 밑줄이 「없음」에서 「2px 실선」으로 바뀜 — 42개 화면 전부 어긋남
  ② 일부 화면만 가진 규칙을 공용으로 빼서 모두에게 이었다가
     그 규칙이 없던 목록 화면의 표 머리가 바뀜
  둘 다 이 도구가 잡았습니다.

★ 쓰는 법
    python3 tools/css-snapshot.py before db      ← 고치기 <b>전</b>에 찍기
    (여기서 CSS 를 옮기는 작업을 합니다)
    python3 tools/css-snapshot.py after  db      ← 고친 <b>뒤</b>에 찍기
    python3 tools/css-snapshot.py compare        ← 견주기

  마지막 인자는 저장소 안 폴더 이름입니다 (db · admin · community …).
  결과는 /tmp/snap-*.json 에 쌓입니다.

★ 필요한 것
    pip install playwright --break-system-packages
    python3 -m playwright install chromium

★ 알아 둘 점
  · file:// 로 열면 브라우저가 CSS 규칙 읽기를 막습니다(다른 출처로 봄).
    그래서 안에서 작은 서버를 띄워 http:// 로 엽니다.
  · 자료를 서버에서 받아 그리는 화면은 표가 비어 있으므로
    <b>가짜 줄</b>을 심어 실제로 그려 본 뒤 칸 너비를 잽니다.
  · header 의 배경색·문서 높이는 <b>불러오는 때</b>에 따라 흔들립니다.
    같은 파일을 두 번 재보고 확인했으므로 견주기에서 뺍니다.
════════════════════════════════════════════════════════════════
"""
import sys, json, pathlib, shutil, functools, http.server, socketserver, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORK = pathlib.Path('/tmp/oc-cssnap-site')

FAKE_ROWS = """
(() => {
  const t = document.querySelector('.pdb-table tbody') || document.querySelector('table tbody');
  if (!t) return;
  const ths = document.querySelectorAll('.pdb-table thead th, table thead th');
  const cols = ths.length || 6;
  let html = '';
  for (let i = 0; i < 6; i++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const cls = ths[c] ? ths[c].className : '';
      html += '<td class="' + cls + '">보기글 ' + (i+1) + '-' + (c+1) + '</td>';
    }
    html += '</tr>';
  }
  t.innerHTML = html;
})();
"""

DUMP = """() => {
  var out = [];
  function walk(rs, cond) {
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (r.cssRules && r.cssRules.length !== undefined && r.selectorText === undefined) {
        var c = r.conditionText ? ((cond ? cond + ' && ' : '') + '@' + r.conditionText) : cond;
        walk(r.cssRules, c);
      } else if (r.selectorText) {
        var st = r.style, d = [];
        for (var j = 0; j < st.length; j++) d.push(st[j] + ':' + st.getPropertyValue(st[j]).trim());
        d.sort();
        out.push([(cond || '') + '|' + r.selectorText.trim(), d.join(';')]);
      }
    }
  }
  for (var k = 0; k < document.styleSheets.length; k++) {
    var sh = document.styleSheets[k], rs = null;
    try { rs = sh.cssRules; } catch (e) { continue; }
    if (rs) walk(rs, '');
  }
  return out;
}"""

MEASURE = """() => {
  const P = ['fontSize','fontWeight','color','backgroundColor','padding','margin',
             'textAlign','display','width','maxWidth','borderBottom','lineHeight'];
  const pick = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const c = getComputedStyle(e), o = {};
    for (const p of P) o[p] = c[p];
    const b = e.getBoundingClientRect();
    o._w = Math.round(b.width); o._h = Math.round(b.height);
    return o;
  };
  const out = {};
  const sels = ['body','.wrap','.pdb-table','.pdb-table th','.pdb-table td',
                '.pdb-table th.c-no','.pdb-table th.c-name','.pdb-table th.c-field',
                '.pdb-table th.c-school','.pdb-table th.c-era','.pdb-table th.c-link',
                '.pdb-pager','.pdb-divider','.sec-head','.pv-tool','header','footer',
                '.ad-slot','.card','.panel','table','form','input','button'];
  for (const s of sels) out[s] = pick(s);
  const ths = [...document.querySelectorAll('.pdb-table thead th, table thead th')];
  out._ths = ths.map(t => [t.className, Math.round(t.getBoundingClientRect().width)]);
  out._docW = document.documentElement.scrollWidth;
  return out;
}"""


def serve():
    if WORK.exists(): shutil.rmtree(WORK)
    shutil.copytree(ROOT, WORK, ignore=shutil.ignore_patterns(
        '.git', 'node_modules', 'scripts', '.github', 'tools'))
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(WORK))
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def snap(tag, folder):
    from playwright.sync_api import sync_playwright
    files = sorted((ROOT / folder).glob('*.html'))
    if not files:
        print(f'✗ {folder} 폴더에 화면이 없습니다'); sys.exit(1)
    srv, port = serve()
    res = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for f in files:
            for w in (1280, 760):
                pg = br.new_page(viewport={'width': w, 'height': 900})
                try:
                    pg.goto(f'http://127.0.0.1:{port}/{folder}/{f.name}',
                            wait_until='domcontentloaded')
                    pg.wait_for_timeout(350)
                    pg.evaluate(FAKE_ROWS)
                    pg.wait_for_timeout(120)
                    rules, meas = pg.evaluate(DUMP), pg.evaluate(MEASURE)
                except Exception as e:
                    rules, meas = [['ERROR', str(e)]], {}
                res[f'{f.name}@{w}'] = {'rules': rules, 'meas': meas}
                pg.close()
        br.close()
    srv.shutdown()
    out = pathlib.Path(f'/tmp/snap-{tag}.json')
    json.dump(res, open(out, 'w'), ensure_ascii=False)
    print(f'✓ {tag} · 화면 {len(files)}개 × 2폭 · 규칙 '
          f'{sum(len(v["rules"]) for v in res.values()):,}개 → {out}')


def compare():
    a = json.load(open('/tmp/snap-before.json'))
    b = json.load(open('/tmp/snap-after.json'))
    SKIP_SEL  = {'header', 'footer', 'body'}
    SKIP_PROP = {'_h', 'backgroundColor', 'borderBottom'}

    def steady(d):
        if not isinstance(d, dict): return d
        return {k: v for k, v in d.items() if k not in SKIP_PROP}

    bad = 0
    print('═══ 수정 전후 견주기 ═══')
    for k in sorted(a):
        if k not in b:
            print(f'  ✗ {k} · 뒤쪽에 없음'); bad += 1; continue
        fa = {s: d for s, d in a[k]['rules']}
        fb = {s: d for s, d in b[k]['rules']}
        miss = [s for s in fa if s not in fb]
        chg  = [s for s in fa if s in fb and fa[s] != fb[s]]
        add  = [s for s in fb if s not in fa]
        ma, mb = a[k]['meas'], b[k]['meas']
        mdiff = [s for s in ma if s not in SKIP_SEL and steady(ma[s]) != steady(mb.get(s))]
        if miss or chg or mdiff:
            bad += 1
            print(f'  ✗ {k}')
            for s in miss[:4]: print(f'      빠짐 : {s[:70]}')
            for s in chg[:4]:  print(f'      바뀜 : {s[:70]}')
            for s in mdiff[:6]: print(f'      잰값 : {s}')
        elif add:
            print(f'  · {k} · 규칙 {len(add)}개 늘어남 (해로울 것 없음)')
    print('─' * 52)
    print(f'  화면 {len(a)}개 중 어긋난 것 {bad}개')
    return bad


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(0)
    cmd = sys.argv[1]
    if cmd == 'compare':
        sys.exit(1 if compare() else 0)
    if len(sys.argv) < 3:
        print('폴더 이름을 함께 적어 주십시오 — 보기: css-snapshot.py before db'); sys.exit(1)
    snap(cmd, sys.argv[2])
