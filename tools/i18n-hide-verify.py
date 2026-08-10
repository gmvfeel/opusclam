#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 감춘 메뉴 확인            tools/i18n-hide-verify.py
════════════════════════════════════════════════════════════════

★ 무엇을 보는가
  영어·일본어 화면에서 <b>한국 안에서만 뜻이 있는 메뉴</b>가
  제대로 감춰졌는지, 그리고 <b>한국어 화면은 그대로인지</b> 봅니다.

★ 왜 「한국어는 그대로인가」 를 함께 보는가
  감추는 일은 자칫 한국어 화면까지 건드리기 쉽습니다.
  영어에서 사라진 것만 보고 좋아하면, 한국 이용자가 쓰던 메뉴가
  없어진 것을 <b>아무도 모른 채</b> 지나갑니다.

★ 눈에 보이는지로 봅니다 (offsetParent · display)
  코드에 있는지가 아니라 <b>실제로 보이는지</b> 를 재야 합니다.
  숨김은 CSS 로 하는 것이라 코드에는 그대로 남아 있습니다.

★ 쓰는 법
    python3 tools/i18n-hide-verify.py
════════════════════════════════════════════════════════════════
"""
import os, sys, http.server, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
PORT = 8866

# 감춰야 할 주소 (영어·일본어에서)
HIDE = [
    '/recruit/',
    '/community/admission',
    '/spot/funding',
    '/spot/sites',
    '/shop/apply',
    '/lesson/live',
    '/lesson/one',
    '/lesson/group',
    '/lesson/instructor',
    '/lesson/curate',
]

# 남아 있어야 할 주소 — 함께 사라지면 안 되는 것들
KEEP = [
    '/db/person.html',
    '/community/news.html',
    '/community/prenatal.html',      # 태교음악
    '/community/school-month.html',  # 이달의 음악학교
    '/spot/concert.html',
    '/spot/concours.html',
    '/lesson/master.html',           # 마스터클래스 — 남깁니다
    '/lesson/open.html',             # 공개레슨 — 남깁니다
]

# 감춰야 할 홈 자리 (제목의 영문)
HIDE_SEC = ['Recruit', 'Entrance Exam', 'Funding']
KEEP_SEC = ['News', 'Concours', 'Festival', 'Hot Topic', 'Music School',
            'Gallery', 'Contemporary', 'Media', 'Organizations', 'Database']

PAGES = ['/home.html', '/db/person.html', '/community/news.html']


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


VISIBLE = """(prefixes)=>{
  const out = {};
  const strip = (h)=>{ const m=/^\\/(en|ja)(\\/.*)$/.exec(h); return m?m[2]:h; };
  for (const p of prefixes) out[p] = 0;
  document.querySelectorAll('a[href]').forEach(a=>{
    const h = strip(a.getAttribute('href')||'');
    if (h.charAt(0)!=='/') return;
    // 눈에 보이는가 — 조상까지 따라 올라가며 확인
    let e=a, shown=true;
    while (e && e !== document.body) {
      const cs = getComputedStyle(e);
      if (cs.display==='none' || cs.visibility==='hidden') { shown=false; break; }
      e = e.parentElement;
    }
    if (!shown) return;
    for (const p of prefixes) if (h.indexOf(p)===0) out[p]++;
  });
  return out;
}"""

SECS = """()=>{
  const out=[];
  document.querySelectorAll('.en-s').forEach(e=>{
    let n=e, shown=true;
    while(n && n!==document.body){
      const cs=getComputedStyle(n);
      if(cs.display==='none'||cs.visibility==='hidden'){shown=false;break}
      n=n.parentElement;
    }
    if(shown) out.push((e.textContent||'').trim());
  });
  return out;
}"""


def main():
    from playwright.sync_api import sync_playwright
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), make_handler(ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    fail = []
    def chk(ok, msg):
        print(('  OK   ' if ok else '  틀림 ') + msg)
        if not ok: fail.append(msg)

    with sync_playwright() as p:
        br = p.chromium.launch()
        for lang in ('ko', 'en', 'ja'):
            print(f'\n[{lang}]')
            for page in PAGES:
                pg = br.new_page(viewport={'width': 1400, 'height': 1000})
                url = f'http://127.0.0.1:{PORT}/' + (lang + '/' if lang != 'ko' else '') + page.lstrip('/')
                pg.goto(url, wait_until='networkidle', timeout=25000)
                pg.wait_for_timeout(900)

                # ★ 홈의 자리는 <b>전체메뉴를 열기 전에</b> 잽니다.
                #   메뉴를 열면 화면을 덮어, 아래 자리들이 가려진 것처럼 보입니다.
                #   (처음 만든 판이 이 순서를 어겨 한국어 화면까지 「사라졌다」 고
                #    잘못 알렸습니다 — 2026-08-10)
                secs = pg.evaluate(SECS) if page == '/home.html' else []

                # 그다음 전체메뉴를 열어 그 안의 링크까지 봅니다
                try:
                    pg.evaluate("()=>{const b=document.querySelector('.fullmenu-btn,#navToggle,.burger');if(b)b.click()}")
                    pg.wait_for_timeout(400)
                except Exception:
                    pass

                vis = pg.evaluate(VISIBLE, HIDE)
                keep = pg.evaluate(VISIBLE, KEEP)
                pg.close()

                if lang == 'ko':
                    # ★ 한국어는 <b>그대로</b>여야 합니다 — 감추기가 새어 나가면 안 됩니다.
                    #   다만 화면마다 원래 없는 링크도 있으므로,
                    #   「전체메뉴에서 몇 개나 보이는가」 로 봅니다.
                    if page == '/home.html':
                        alive = [k for k, v in vis.items() if v > 0]
                        chk(len(alive) >= 6,
                            f'{page} 한국어 메뉴 그대로 (보이는 것 {len(alive)}/{len(HIDE)}종)')
                        for s in HIDE_SEC:
                            chk(s in secs, f'{page} 한국어에 「{s}」 자리 있음')
                else:
                    left = {k: v for k, v in vis.items() if v > 0}
                    chk(not left, f'{page} 감출 메뉴가 안 보임' + (f' → 남은 것 {left}' if left else ''))
                    alive = [k for k, v in keep.items() if v > 0]
                    if page == '/home.html':
                        chk(len(alive) >= 4, f'{page} 남길 메뉴는 살아 있음 ({len(alive)}개)')
                        for s in HIDE_SEC:
                            chk(s not in secs, f'{page} 「{s}」 자리 감춰짐')
                        for s in KEEP_SEC[:5]:
                            chk(s in secs, f'{page} 「{s}」 자리는 그대로')
        br.close()

    print()
    if fail:
        print(f'틀림 {len(fail)}건')
        for f in fail: print('  ·', f)
        sys.exit(1)
    print('틀린 것 없음 — 통과')


if __name__ == '__main__':
    main()
