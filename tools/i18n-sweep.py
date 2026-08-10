#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 남은 한국어 줍기               tools/i18n-sweep.py
════════════════════════════════════════════════════════════════

★ 무엇에 쓰나
  화면을 <b>실제로 열어</b> 영어(또는 일본어)로 바뀌지 않고 남은
  한국어를 찾아냅니다.

★ 왜 소스를 뒤지지 않고 화면을 여는가
  JS 안의 글자를 정적으로 뽑아 보면 절반이 <b>토막</b>입니다.
      '<div>총 ' + n + '건'
  이런 것은 화면에 「총 12건」 으로 찍히므로, 소스에서 뽑은 토막을
  사전에 넣어 봐야 <b>맞지 않습니다.</b>
  화면을 열어 남은 글자를 주우면 실제로 필요한 열쇠만 정확히 나옵니다.
  출처가 화면 파일인지 JS인지 가릴 필요도 없어집니다.

★ 못 잡는 것도 있습니다 — 그것은 아래 ② 로 따로 찾습니다
  · alert() · confirm() — 화면(DOM)에 들어가지 않습니다
  · 로그인해야 보이는 화면, 자료가 있어야 그려지는 목록
  · 숫자가 섞여 조합되는 문장 — 사전으로는 못 바꿉니다.
    이런 것은 OCI18N.t() 를 불러 코드에서 바꿔야 합니다.

★ 쓰는 법
    python3 tools/i18n-sweep.py            영어 화면을 훑습니다
    python3 tools/i18n-sweep.py --lang ja  일본어 화면
  결과
    tools/i18n-sweep.json   주운 문구와 놓인 자리
════════════════════════════════════════════════════════════════
"""
import os, re, sys, json, glob, collections, http.server, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

LANG = 'en'
if '--lang' in sys.argv:
    LANG = sys.argv[sys.argv.index('--lang') + 1]
PORT = 8899
KO = re.compile(r'[가-힣]')

# ── 데이터가 놓이는 자리 — 여기 남은 한국어는 번역 대상이 아닙니다 ──
#   tools/i18n-extract.py 의 규칙과 뜻이 같아야 합니다.
SKIP_SEL = ('#tbTrack', '.hslide', '.ava', '.oc-lang', 'script', 'style',
            'noscript', 'textarea', '.pv-worklist', '.pv-li-main', '.pv-person',
            # ★ 상세 화면의 본문·요약은 데이터베이스에서 채우는 자리입니다.
            #   화면 파일에 바흐 소개문이 박혀 있어 그대로 주워집니다
            #   (2026-08-10 · 첫 훑기에서 백 건 넘게 섞여 나왔습니다).
            '.pv-prose', '.pv-lead', 'tbody', '#oc-legal-note')


def make_handler(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=root, **kw)
        def translate_path(self, path):
            q = path.split('?')[0]
            parts = q.lstrip('/').split('/', 1)
            if parts[0] in ('en', 'ja'):
                rest = parts[1] if len(parts) > 1 else ''
                cand = os.path.join(root, rest)
                if not rest or os.path.isdir(cand):
                    q = '/' + (rest.rstrip('/') + '/index.html' if rest else 'index.html')
                else:
                    q = '/' + rest
            return super().translate_path(q)
        def log_message(self, *a): pass
    return H


def pages():
    pats = ['*.html', 'db/*.html', 'account/*.html', 'community/*.html', 'spot/*.html',
            'recruit/*.html', 'shop/*.html', 'lesson/*.html', 'legal/*.html']
    out = []
    for p in pats:
        out += sorted(glob.glob(p))
    return ['/' + f for f in out if not f.startswith('brand')]


def sweep():
    from playwright.sync_api import sync_playwright

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), make_handler(ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    GRAB = """(skip)=>{
      const out=[];
      const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while(n=w.nextNode()){
        const t=(n.nodeValue||'').replace(/\\s+/g,' ').trim();
        if(!t || !/[가-힣]/.test(t)) continue;
        const p=n.parentElement; if(!p) continue;
        if(skip.some(s=>p.closest(s))) continue;
        let e=p,a=[];
        while(e&&a.length<3){a.unshift(e.tagName.toLowerCase()+(e.className?'.'+String(e.className).split(' ')[0]:''));e=e.parentElement}
        out.push([t, a.join('<')]);
      }
      // 속성도 봅니다
      ['placeholder','title','alt','aria-label'].forEach(at=>{
        document.querySelectorAll('['+at+']').forEach(el=>{
          if(skip.some(s=>el.closest(s))) return;
          const v=(el.getAttribute(at)||'').replace(/\\s+/g,' ').trim();
          if(v && /[가-힣]/.test(v)) out.push([v, el.tagName.toLowerCase()+'['+at+']']);
        });
      });
      return out;
    }"""

    found = collections.OrderedDict()
    with sync_playwright() as p:
        br = p.chromium.launch()
        paths = pages()
        for i, path in enumerate(paths, 1):
            pg = br.new_page(viewport={'width': 1400, 'height': 1000})
            try:
                pg.goto(f'http://127.0.0.1:{PORT}/{LANG}{path}',
                        wait_until='networkidle', timeout=25000)
                pg.wait_for_timeout(700)
                for t, where in pg.evaluate(GRAB, list(SKIP_SEL)):
                    r = found.setdefault(t, {'n': 0, 'where': collections.Counter(), 'pages': set()})
                    r['n'] += 1
                    r['where'][where] += 1
                    r['pages'].add(path)
            except Exception as e:
                print(f'  건너뜀 {path}: {str(e)[:60]}')
            pg.close()
            if i % 20 == 0:
                print(f'  … {i}/{len(paths)} 화면')
        br.close()

    print(f'\n  화면 {len(pages())}개에서 남은 한국어 {len(found)}개')
    out = collections.OrderedDict()
    for t, r in sorted(found.items(), key=lambda kv: (-kv[1]['n'], kv[0])):
        out[t] = {'쓰인수': r['n'],
                  '자리': [w for w, _ in r['where'].most_common(2)],
                  '화면': sorted(r['pages'])[:3]}
    json.dump(out, open('tools/i18n-sweep.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('  → tools/i18n-sweep.json')

    for t, r in list(out.items())[:40]:
        print(f'  {r["쓰인수"]:3}× {t[:56]!r}  {r["자리"][0]}')


def alerts():
    """② 화면에 안 나타나는 것 — alert · confirm · prompt"""
    print('\n── alert · confirm 안의 한국어 (사전으로는 못 바꿉니다) ──')
    pat = re.compile(r'\b(alert|confirm|prompt)\s*\(\s*([\'"`])((?:\\.|(?!\2)[^\\])*)\2', re.S)
    hits = []
    for f in sorted(glob.glob('assets/*.js')):
        if re.search(r'(admin|suspect)', os.path.basename(f)):
            continue
        src = open(f, encoding='utf-8').read()
        for m in pat.finditer(src):
            if KO.search(m.group(3)):
                hits.append((os.path.basename(f), m.group(1), m.group(3)[:64]))
    for f, kind, s in hits:
        print(f'  {f:22} {kind:8} {s!r}')
    print(f'  모두 {len(hits)}곳 — OCI18N.t() 로 감싸야 바뀝니다')


if __name__ == '__main__':
    sweep()
    alerts()
