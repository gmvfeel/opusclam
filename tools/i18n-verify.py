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


# ── [0] 소스 검사 — 「값(var)이 조기 return 아래에 있는가」 ──────────
#   2026-08-10 에 이 실수를 <b>두 번</b> 했습니다.
#   ① 상수를 파일 아래쪽에 두어 번역이 통째로 실패
#   ② var HOSTS 를 조기 return 아래에 두어 한국어 화면에서 고르개가 사라짐
#   둘 다 바깥의 try 가 오류를 삼켜 조용했습니다. 눈으로는 못 잡습니다.
print('[0] 소스 검사 — 값 선언 자리')
_src = open(f'{NEW}/assets/i18n.js', encoding='utf-8').read()
_lines = _src.split('\n')

# 주석·글자 안은 빼고 본다
def _strip(line):
    out, i, q = [], 0, None
    while i < len(line):
        c = line[i]
        if q:
            if c == '\\': i += 2; continue
            if c == q: q = None
            i += 1; continue
        if c in '"\'':
            q = c; i += 1; continue
        if line[i:i+2] == '/*': return ''.join(out)
        if line[i:i+2] == '//': break
        out.append(c); i += 1
    return ''.join(out)

_clean = [_strip(l) for l in _lines]
_in_comment = False
for i, l in enumerate(_lines):
    if '/*' in l and '*/' not in l: _in_comment = True; _clean[i] = ''
    elif _in_comment:
        _clean[i] = ''
        if '*/' in l: _in_comment = False

# 맨 바깥(들여쓰기 2칸)의 조기 return 자리
_ret = [i for i, l in enumerate(_clean) if re.match(r'^ {4}return;\s*$', l)]
_first_ret = min(_ret) if _ret else len(_clean)

_bad = []
for i, l in enumerate(_clean):
    if i <= _first_ret: continue
    m = re.match(r'^ {2}var\s+([A-Za-z_$][\w$]*)\s*=', l)
    if m: _bad.append(f'{i+1}행 var {m.group(1)}')
chk(not _bad,
    '값(var)이 모두 조기 return 위에 있음' + (f' → 아래에 있는 것: {_bad}' if _bad else ''))
if _bad:
    # ★ 여기서 <b>멈춥니다.</b> 이 실수를 2026-08-10 하루에 세 번 했습니다.
    #   뒤의 브라우저 검사를 계속 돌리면 결과가 길어져 이 줄을 놓칩니다.
    #   실제로 세 번째는 결과 끝만 보다가 놓쳤습니다.
    print()
    print('=' * 52)
    print('★ 여기서 멈춥니다 — 아래 값들을 파일 맨 위 붙박이 구역으로 옮기세요.')
    for b in _bad: print('   ', b)
    print('  한국어 화면은 조기 return 으로 되돌아가므로 그 아래 var 는')
    print('  영영 담기지 않습니다. 바깥의 try 가 오류를 삼켜 조용합니다.')
    print('=' * 52)
    sys.exit(1)

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
        chk(a.evaluate("()=>[...document.querySelectorAll('.oc-lang')].some(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0})"), f'{path} 언어 고르개 보임')
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
    chk(pg.evaluate("()=>[...document.querySelectorAll('.oc-lang:not([style*=none]) li a')].filter(a=>a.rel==='nofollow').length")==2,
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

    # ── ④ 언어 고르개 — 세 말 모두에서, 눈에 보이는지·실제로 옮겨가는지 ──
    print('\n[4] 언어 고르개')

    # 글자가 바탕에 묻히지 않는가 (2026-08-10 · 흰 상자에 흰 글씨였음)
    CONTRAST = """(sel)=>{
      const el=document.querySelector(sel); if(!el) return null;
      const cs=getComputedStyle(el);
      const rgb=t=>{const m=t.match(/[\\d.]+/g)||[];return m.slice(0,3).map(Number).concat(m.length>3?+m[3]:1)};
      const lum=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
        return .2126*a[0]+.7152*a[1]+.0722*a[2]};
      let bgEl=el, bg=[255,255,255,1];
      while(bgEl){const b=rgb(getComputedStyle(bgEl).backgroundColor); if(b[3]>0){bg=b;break} bgEl=bgEl.parentElement}
      const fg=rgb(cs.color);
      const L1=lum(fg), L2=lum(bg);
      const ratio=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
      return {ratio:Math.round(ratio*10)/10, alpha:fg[3], text:el.textContent.trim()};
    }"""

    for lang, base in [('ko',''), ('en','/en'), ('ja','/ja')]:
        pg, errs = load(f'http://127.0.0.1:8801{base}/db/person.html')
        pg.locator('.oc-lang > button').locator('visible=true').first.click(); pg.wait_for_timeout(250)

        n = pg.evaluate("()=>document.querySelectorAll('.oc-lang:not([style*=none]) li a').length")
        chk(n == 3, f'[{lang}] 고르개 세 줄 → {n}줄')

        # 세 줄 모두 읽을 수 있는가
        for i, nm in enumerate(['한국어', 'English', '日本語']):
            r = pg.evaluate(CONTRAST, f'.oc-lang:not([style*=none]) li:nth-child({i+1}) a')
            ok = r and r['ratio'] >= 4.5 and r['alpha'] >= .9 and r['text'] == nm
            chk(ok, f'[{lang}] 「{nm}」 눈에 보임 → {r}')

        # 링크 주소가 옳은가 (i18n 이 /en 을 덧붙이지 않았는가)
        hrefs = pg.evaluate("()=>[...document.querySelectorAll('.oc-lang:not([style*=none]) li a')].map(a=>a.getAttribute('href'))")
        want = ['/db/person.html', '/en/db/person.html', '/ja/db/person.html']
        chk(hrefs == want, f'[{lang}] 고르개 주소 → {hrefs}')

        # ★ 실제로 눌러서 그 말로 옮겨가는가 — 여기서 「한국어로 안 돌아옴」 을 잡습니다
        pg.locator('.oc-lang li:nth-child(1) a').locator('visible=true').first.click()
        pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(500)
        chk(pg.url.endswith('/db/person.html') and '/en/' not in pg.url and '/ja/' not in pg.url,
            f'[{lang}] 「한국어」 눌러 한국어로 돌아옴 → {pg.url}')
        chk(pg.evaluate("()=>document.documentElement.lang") == 'ko',
            f'[{lang}] 돌아온 화면이 실제로 한국어')
        pg.close()

    # ── ⑤ 없는 사전으로 넘어가도 안 죽는가 ───────────────────
    print('\n[5] 버팀 검사')
    pg, errs = load('http://127.0.0.1:8801/en/spot/concert.html')
    chk(pg.evaluate("()=>document.body.innerText.length")>200, '영문 화면 본문 살아 있음')
    chk(not errs, '콘솔 오류 없음' + (f' → {errs[:3]}' if errs else ''))
    pg.close()


    # ── ⑥ 폭·화면·테마별 — 고르개가 하나만, 눈에 띄게, 제자리에 ──
    print('\n[6] 폭·화면·테마별 고르개')

    BTN = """()=>{
      const all=[...document.querySelectorAll('.oc-lang')];
      const vis=all.filter(e=>{const b=e.getBoundingClientRect();
        return b.width>0&&b.height>0&&getComputedStyle(e).display!=='none'});
      if(vis.length!==1) return {visible:vis.length};
      const box=vis[0], btn=box.querySelector('button');
      const rgb=t=>{const m=(t||'').match(/[\\d.]+/g)||[];return m.slice(0,3).map(Number).concat(m.length>3?+m[3]:1)};
      const lum=c=>{const a=c.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
        return .2126*a[0]+.7152*a[1]+.0722*a[2]};
      let e=btn, bg=[255,255,255,1];
      while(e&&e!==document.documentElement){const b=rgb(getComputedStyle(e).backgroundColor);
        if(b[3]>0.2){bg=b;break} e=e.parentElement}
      if(e===document.documentElement||!e){const b=rgb(getComputedStyle(document.body).backgroundColor);
        if(b[3]>0.2) bg=b}
      const fg=rgb(getComputedStyle(btn).color);
      const L1=lum(fg),L2=lum(bg);
      const r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
      const bb=btn.getBoundingClientRect();
      // 화면 밖으로 밀려나지 않았는가
      const inside = bb.left>=0 && bb.right<=innerWidth+1 && bb.top>=0;
      return {visible:1, ratio:Math.round(r*10)/10, where:box.parentElement.className,
              inside, right:Math.round(innerWidth-bb.right)};
    }"""

    for path in ['/en/db/person.html', '/en/home.html', '/en/index.html', '/en/community/news.html']:
        for w in (1440, 1024, 860, 768, 640, 480, 390, 360):
            for dark in (False, True):
                pg = br.new_page(viewport={'width': w, 'height': 800})
                if dark: pg.add_init_script("try{localStorage.setItem('oc-theme','dark')}catch(e){}")
                pg.goto('http://127.0.0.1:8801' + path, wait_until='networkidle')
                pg.wait_for_timeout(500)
                r = pg.evaluate(BTN)
                tag = f'{path} {w}px {"어둡게" if dark else "밝게"}'
                if r.get('visible') != 1:
                    chk(False, f'{tag} — 보이는 고르개 1개 → {r.get("visible")}개')
                else:
                    chk(r['ratio'] >= 3.0, f'{tag} — 단추가 바탕과 구별됨 → 대비 {r["ratio"]} ({r["where"]})')
                    chk(r['inside'], f'{tag} — 화면 안에 있음 (오른쪽 여백 {r["right"]}px)')
                pg.close()

    br.close()

print('\n' + '='*52)
print('틀린 것 없음 — 통과' if not fail else f'틀림 {len(fail)}건:\n  - ' + '\n  - '.join(fail))
sys.exit(1 if fail else 0)
