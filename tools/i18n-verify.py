#!/usr/bin/env python3
"""i18n 1단계 검증 — Vercel rewrite 를 흉내낸 서버에 띄워 브라우저로 확인"""
import http.server, socketserver, threading, functools, os, sys, json, re

LANGS = ('en', 'ja')

def make_handler(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=root, **kw)
        def translate_path(self, path):
            # Vercel rewrite 흉내: /en/... → /...  (실제 파일이 없을 때만)
            q = path.split('?')[0]
            parts = q.lstrip('/').split('/', 1)
            if parts[0] in LANGS:
                rest = parts[1] if len(parts) > 1 else ''
                cand = os.path.join(root, rest)
                if not rest or os.path.isdir(cand):
                    q = '/' + (rest.rstrip('/') + '/index.html' if rest else 'index.html')
                else:
                    q = '/' + rest
            return super().translate_path(q)
        def log_message(self, *a): pass
    return H

def serve(root, port):
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', port), make_handler(root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

NEW = '/home/claude/oc/repo'
OLD = '/home/claude/oc/repo-orig'
serve(NEW, 8801)
serve(OLD, 8802)

from playwright.sync_api import sync_playwright

PAGES = ['/db/person.html', '/community/news.html', '/spot/concert.html',
         '/home.html', '/index.html', '/legal/terms.html', '/account/join.html']

fail = []
def chk(ok, msg):
    print(('  OK   ' if ok else '  틀림 ') + msg)
    if not ok: fail.append(msg)

with sync_playwright() as p:
    br = p.chromium.launch()

    def load(url):
        pg = br.new_page()
        errs = []
        def keep(t):
            t = str(t)
            skip = ('CORS policy', 'ERR_FAILED', 'status of 403', 'net::ERR_',
                    'Failed to load resource', 'fonts.googleapis', 'jsdelivr',
                    'supabase', 'Failed to fetch')
            return not any(k in t for k in skip)
        pg.on('console', lambda m: errs.append(m.text) if (m.type == 'error' and keep(m.text)) else None)
        pg.on('pageerror', lambda e: errs.append(str(e)) if keep(e) else None)
        pg.goto(url, wait_until='networkidle', timeout=30000)
        pg.wait_for_timeout(700)
        return pg, errs

    # 화면에 보이는 글자만 (script·style 안의 코드 문자열은 번역 대상이 아님)
    VIS = ("()=>{const c=document.body.cloneNode(true);"
           "c.querySelectorAll('script,style,noscript,textarea').forEach(e=>e.remove());"
           "return c.textContent}")

    en = json.load(open(f'{NEW}/assets/i18n/en.json', encoding='utf-8'))
    en = {k: v for k, v in en.items() if not k.startswith('_')}

    # ── ① 한국어 화면이 예전과 같은가 (회귀 방지) ─────────────
    print('\n[1] 한국어 화면 회귀 검사')
    for path in PAGES:
        a, ea = load('http://127.0.0.1:8801' + path)
        b, eb = load('http://127.0.0.1:8802' + path)
        ta = a.evaluate("()=>{const c=document.body.cloneNode(true);"
                        "c.querySelectorAll('.oc-lang,script,style,noscript,#tbTrack,.tb-track,[id*=tbTrack]').forEach(e=>e.remove());"
                        "return c.textContent.replace(/\\s+/g,' ').trim()}")
        tb = b.evaluate("()=>{const c=document.body.cloneNode(true);"
                        "c.querySelectorAll('.oc-lang,script,style,noscript,#tbTrack,.tb-track,[id*=tbTrack]').forEach(e=>e.remove());"
                        "return c.textContent.replace(/\\s+/g,' ').trim()}")
        chk(ta == tb, f'{path} 글자 그대로')
        if ta != tb:
            for i in range(min(len(ta), len(tb))):
                if ta[i] != tb[i]:
                    print('        새:', repr(ta[max(0,i-60):i+60]))
                    print('        옛:', repr(tb[max(0,i-60):i+60]))
                    break
        chk(a.evaluate("()=>!!document.querySelector('.oc-lang')"), f'{path} 언어 고르개 있음')
        chk(a.evaluate("()=>document.documentElement.lang")=='ko', f'{path} lang=ko 유지')
        # ★ 회원·글쓰기 화면은 <b>원래부터</b> noindex 입니다 — 견주기에서 뺍니다
        if not path.startswith('/account/'):
            chk(a.evaluate("()=>!document.querySelector('meta[name=robots][content*=noindex]')"),
                f'{path} 한국어엔 noindex 없음')
        chk(not ea, f'{path} 콘솔 오류 없음' + (f' → {ea[:2]}' if ea else ''))
        a.close(); b.close()

    # ── ② 영어 화면 ────────────────────────────────────────
    print('\n[2] 영어(/en) 화면')
    pg, errs = load('http://127.0.0.1:8801/en/db/person.html')
    chk(pg.evaluate("()=>document.documentElement.lang")=='en', 'lang=en')
    chk(pg.evaluate("()=>window.OCI18N && OCI18N.lang")=='en', 'OCI18N.lang=en')
    chk(pg.evaluate("()=>Object.keys(OCI18N.dict||{}).length")==len(en), f'사전 {len(en)}개 실림')
    chk(not errs, '콘솔 오류 없음' + (f' → {errs[:3]}' if errs else ''))

    body = pg.evaluate(VIS)
    # 헤더 문구가 영어로 바뀌었나
    hdr = ['인물 DB','음악단체 DB','핫토픽','공연정보','마스터클래스','채용정보','로그인','회원가입']
    for k in hdr:
        chk(k not in body and en[k] in body, f'「{k}」 → 「{en[k]}」')

    # 링크 접두어
    hrefs = pg.evaluate("()=>[...document.querySelectorAll('a[href^=\"/\"]')].filter(a=>!a.closest('.oc-lang')).map(a=>a.getAttribute('href'))")
    bad = [h for h in hrefs if not h.startswith('/en/')
           and not re.match(r'^/(assets|partials|icon-|manifest|sw\.js|robots|sitemap)', h)
           and not re.search(r'\.(png|jpe?g|svg|css|js|json|xml|webmanifest)$', h)]
    chk(not bad, '화면 링크에 /en 붙음' + (f' → 안 붙은 것 {bad[:5]}' if bad else ''))
    chk(any(h.startswith('/en/') for h in hrefs), '/en 링크가 실제로 생김')

    # 색인 차단 (번역이 덜 찬 동안)
    chk(pg.evaluate("()=>!!document.querySelector('meta[name=robots][content*=noindex]')"), 'noindex 붙음')
    chk(pg.evaluate("()=>document.querySelectorAll('link[rel=alternate][hreflang]').length")==0,
        'hreflang 은 아직 안 붙음(막아 둔 동안)')
    chk(pg.evaluate("()=>[...document.querySelectorAll('.oc-lang li a')].filter(a=>a.rel==='nofollow').length")==2,
        '언어 고르개 en/ja 에 nofollow')
    # 경로 판단이 언어 경로에서도 되는가
    chk(pg.evaluate("()=>typeof window.ocPath==='function' && ocPath('/en/db/x.html')==='/db/x.html'"),
        'ocPath 도우미 동작')
    chk(pg.evaluate("()=>!!document.querySelector('.oc-fav-btn, .pdb-favslot')"), '관심분야 단추 살아 있음')
    chk(pg.evaluate("()=>!!document.querySelector('.pdb-subnav a.active')"), '하위 메뉴 표시 켜짐')

    # 무한루프·되돌이 검사 — 잠시 두고 글자가 안정적인가
    t1 = pg.evaluate(VIS)
    pg.wait_for_timeout(1200)
    t2 = pg.evaluate(VIS)
    chk(t1 == t2, '글자가 흔들리지 않음(되돌이 없음)')
    pg.close()

    # ── ③ 일본어 화면 ──────────────────────────────────────
    print('\n[3] 일본어(/ja) 화면')
    pg, errs = load('http://127.0.0.1:8801/ja/community/news.html')
    chk(pg.evaluate("()=>document.documentElement.lang")=='ja', 'lang=ja')
    b = pg.evaluate(VIS)
    for k, v in [('핫토픽','ホットトピック'), ('공연정보','公演情報'), ('로그인','ログイン')]:
        chk(k not in b and v in b, f'「{k}」 → 「{v}」')
    chk(not errs, '콘솔 오류 없음' + (f' → {errs[:3]}' if errs else ''))
    pg.close()

    # ── ④ 언어 고르개 동작 ─────────────────────────────────
    print('\n[4] 언어 고르개')
    pg, _ = load('http://127.0.0.1:8801/db/person.html')
    pg.click('.oc-lang > button')
    pg.wait_for_timeout(200)
    chk(pg.evaluate("()=>document.querySelector('.oc-lang').classList.contains('open')"), '눌러서 열림')
    links = pg.evaluate("()=>[...document.querySelectorAll('.oc-lang li a')].map(a=>a.getAttribute('href'))")
    chk(links == ['/db/person.html', '/en/db/person.html', '/ja/db/person.html'],
        f'고르개 주소 세 줄 → {links}')
    pg.close()

    # ── ⑤ 없는 사전으로 넘어가도 안 죽는가 ───────────────────
    print('\n[5] 버팀 검사')
    pg, errs = load('http://127.0.0.1:8801/en/spot/concert.html')
    chk(pg.evaluate("()=>document.body.innerText.length")>200, '영문 화면 본문 살아 있음')
    chk(not errs, '콘솔 오류 없음' + (f' → {errs[:3]}' if errs else ''))
    pg.close()

    br.close()

print('\n' + '='*52)
print('틀린 것 없음 — 통과' if not fail else f'틀림 {len(fail)}건:\n  - ' + '\n  - '.join(fail))
sys.exit(1 if fail else 0)
