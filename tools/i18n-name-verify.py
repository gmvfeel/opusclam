#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 목록 이름 차례 검사        tools/i18n-name-verify.py
════════════════════════════════════════════════════════════════

★ 무엇을 보는가
  DB 목록이 이름을 <b>보는 말에 맞는 차례</b>로 그리는지 봅니다.
      한국어  큰 글씨 한국어 · 작은 글씨 영어
      영어    큰 글씨 영어   · 작은 글씨 한국어

★ 어떻게 보는가 — <b>가짜 자료를 넣어</b> 그려 봅니다
  이 자리에서는 데이터베이스에 닿을 수 없어 목록이 비어 있습니다.
  그래서 화면 안의 renderRow 를 <b>직접 불러</b> 결과 HTML 을 봅니다.
  화면을 열어 눈으로 보는 것과 같은 값을 얻으면서, 자료 없이도 됩니다.

★ 왜 필요한가 (2026-08-10)
  「name_ko || name_en」 처럼 <b>한국어를 먼저</b> 고르는 코드가
  스무 곳 넘게 있었습니다. 그대로 두면 영어 화면인데 목록의
  인물·단체 이름만 한국어로 남아 <b>껍데기만 영어</b>가 됩니다.
  고친 뒤에도 화면마다 짜임이 조금씩 달라, 한 곳씩 확인해야 합니다.

★ 쓰는 법
    python3 tools/i18n-name-verify.py
════════════════════════════════════════════════════════════════
"""
import os, sys, json, http.server, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
PORT = 8877

# 화면마다 renderRow 에 넘길 가짜 한 줄
FAKE = {
    'db/person.html':     {'id': 1, 'name_ko': '홍길동', 'name_en': 'Hong Gildong'},
    'db/org.html':        {'id': 1, 'name_ko': '서울시향', 'name_en': 'Seoul Phil'},
    'db/venue.html':      {'id': 1, 'name_ko': '예술의전당', 'name_en': 'Arts Center'},
    'db/school.html':     {'id': 1, 'name_ko': '서울대', 'name_en': 'SNU'},
    'db/modern.html':     {'id': 1, 'name_ko': '진은숙', 'name_en': 'Unsuk Chin'},
    'db/foundation.html': {'id': 1, 'name_ko': '금호문화재단', 'name_en': 'Kumho Foundation'},
    'db/academic.html':   {'id': 1, 'name_ko': '화성 연구', 'name_en': 'A Study of Harmony'},
}


def make_handler(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=root, **kw)
        def translate_path(self, path):
            q = path.split('?')[0]
            p = q.lstrip('/').split('/', 1)
            if p[0] in ('en', 'ja'):
                rest = p[1] if len(p) > 1 else ''
                q = '/' + (rest if rest else 'index.html')
            return super().translate_path(q)
        def log_message(self, *a): pass
    return H


def main():
    from playwright.sync_api import sync_playwright
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), make_handler(ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    # ★ renderRow 는 IIFE 안에 있어 바깥에서 부를 수 없습니다.
    #   그래서 <b>실제로 목록을 그리게</b> 합니다 — 데이터베이스 응답을
    #   가로채 가짜 한 줄을 돌려주면 화면이 평소대로 그립니다.
    #   눈으로 보는 것과 똑같은 결과를 얻습니다.
    fail = []
    checked = 0

    with sync_playwright() as p:
        br = p.chromium.launch()
        for path, row in FAKE.items():
            for lang, want_main, want_sub in (('ko', row['name_ko'], row['name_en']),
                                              ('en', row['name_en'], row['name_ko'])):
                pg = br.new_page(viewport={'width': 1400, 'height': 900})

                def handle(route):
                    u = route.request.url
                    body = json.dumps([row])
                    route.fulfill(status=200, content_type='application/json',
                                  headers={'content-range': '0-0/1',
                                           'access-control-expose-headers': 'content-range'},
                                  body=body)
                pg.route('**/rest/v1/**', handle)

                url = f'http://127.0.0.1:{PORT}/' + (lang + '/' if lang != 'ko' else '') + path
                try:
                    pg.goto(url, wait_until='domcontentloaded', timeout=20000)
                    pg.wait_for_selector('td.c-name a', timeout=8000)
                    pg.wait_for_timeout(400)
                    r = pg.evaluate("""()=>{
                      const c=document.querySelector('td.c-name');
                      if(!c) return null;
                      const s=c.querySelector('.c-name-en');
                      const sub=s?s.textContent.trim():'';
                      const cl=c.cloneNode(true);
                      const s2=cl.querySelector('.c-name-en'); if(s2) s2.remove();
                      const bad=cl.querySelector('.oc-badge'); if(bad) bad.remove();
                      return {main: cl.textContent.replace(/\\s+/g,' ').trim(), sub: sub};
                    }""")
                except Exception as e:
                    print(f'  못 그림 [{lang}] {path} — {str(e).splitlines()[0][:56]}')
                    fail.append(f'[{lang}] {path} — 목록을 그리지 못했습니다')
                    pg.close(); continue
                pg.close()

                if not r:
                    fail.append(f'[{lang}] {path} — 이름 칸이 없습니다'); continue
                checked += 1
                ok = r['main'].startswith(want_main) and (want_sub in (r['sub'] or ''))
                print(f'  {"OK  " if ok else "틀림"} [{lang}] {path:22} 큰:{r["main"][:20]!r} 작은:{r["sub"][:20]!r}')
                if not ok:
                    fail.append(f'[{lang}] {path} — 큰 글씨는 {want_main!r} 여야 하는데 {r["main"]!r} 입니다')
        br.close()

    print()
    # ★ 하나도 못 봤으면 <b>통과가 아닙니다</b>.
    #   예전 판은 전부 건너뛰고도 「통과」 라고 했습니다 — 가장 나쁜 검사입니다.
    if checked == 0:
        print('★ 한 건도 확인하지 못했습니다 — 검사가 제 몫을 못 했습니다.')
        sys.exit(1)
    if fail:
        print(f'틀림 {len(fail)}건 (확인한 것 {checked}건)')
        for f in fail: print('  ·', f)
        sys.exit(1)
    print(f'{checked}건 확인 — 틀린 것 없음')


if __name__ == '__main__':
    main()
