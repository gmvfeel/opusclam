/* ============================================================
   OPUSCLAM 모바일 아래 고정 메뉴 — assets/tabbar.js
   2026-08-13

   ★ 왜 만드나 (파트너 제안)
     휴대폰을 한 손으로 쥐면 엄지가 닿는 곳은 <b>화면 아래쪽</b>입니다.
     그런데 지금 모든 이동 수단이 <b>위쪽</b>에 있습니다 — 로고·검색·≡.
     특히 전체메뉴(≡)가 오른쪽 위 모서리라 가장 닿기 어렵습니다.
     이미 「홈 화면에 설치하면 앱처럼」 안내를 띄우고 있으므로, 설치한
     뒤에도 앱처럼 보이려면 아래 띠가 있어야 합니다.

   ★ 다섯 개만 넣습니다
     여섯 대메뉴를 다 넣으면 한 칸이 65px 이 되어 글자가 8px 로 줄어듭니다.
     그러면 오늘 고친 「작은 글자」가 다시 무너집니다.

       홈 · DATABASE · 검색 · 커뮤니티 · 마이페이지

     · 검색을 <b>가운데</b>에 둡니다 — 엄지가 가장 편한 자리이고,
       인물·작품·용어 3만 건이 넘는 사이트에서 검색은 부가 기능이
       아니라 주된 길입니다.
     · 정보SPOT·레슨:ON·리쿠르트·SHOPPING 은 <b>헤더의 ≡</b> 안에 있습니다.

   ★ 2026-08-14 · 파트너 지시로 고친 것
     ① 다섯째 칸이 「전체(≡)」였습니다 → <b>마이페이지</b>로 바꿉니다.
        로그인해 있으면 /account/mypage.html, 아니면 /account/login.html
        로 갑니다. 글자도 「마이페이지 / 로그인」으로 함께 바뀝니다.
     ② 위쪽 ≡ 를 <b>다시 보이게</b> 합니다 — 전체메뉴는 원래 자리
        (헤더 오른쪽)에서 원래 방식으로 엽니다. 아래띠는 이제
        전체메뉴를 열지 않습니다.

   ★ 로그인 여부를 어떻게 압니까
     supabase-js 가 세션을 브라우저에 담아 둡니다(sb-…-auth-token).
     그 값이 있으면 로그인으로 봅니다 — <b>물어보지 않으니 값이 0</b>이고
     칸을 그리는 즉시 정해집니다. 화면이 supabase 를 이미 실었으면
     (window.__ocSb) 그것으로 한 번 더 맞춥니다. 담긴 값이 만료였다면
     마이페이지가 「로그인이 필요합니다」를 보여 주므로 길이 막히지
     않습니다.

   ★ 자리를 다투는 것들을 함께 옮깁니다
     맨위로 단추(.to-top)와 PWA 안내 띠(.pwa-install)가 같은 자리에
     있습니다. 띠 높이만큼 올립니다. 본문 아래도 그만큼 비웁니다 —
     그러지 않으면 푸터가 띠에 가립니다.

   ★ 화면 파일을 고치지 않습니다 — include.js 가 이 파일을 싣고,
     이 파일이 스스로 띠와 규칙을 넣습니다. 화면 126개를 손대지 않습니다.
   ============================================================ */
(function (w, d) {
  'use strict';

  /* 띠 높이 — 2026-08-13 · 58 → 68px (파트너 지적: 세로가 좁았습니다)
     아이콘 21px + 사이 5px + 글자 10.5px ≒ 37px 이라 58px 로는
     위아래 여백이 각 10px 밖에 남지 않았습니다. */
  var H = 68;                 /* 띠 높이 (px) */
  var MAX = 880;              /* 이 폭 아래에서만 보입니다 */

  /* 아이콘 — 선으로만 그립니다(면을 채우면 작은 크기에서 뭉칩니다) */
  var I = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/>',
    db:   '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/>'
        + '<path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    find: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    talk: '<path d="M20 14.5c0 1.1-.9 2-2 2H8l-4 3.5v-14c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2z"/>',
    /* 사람 — 마이페이지 (2026-08-14) */
    me:   '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c0-3.7 3.2-5.6 7.2-5.6s7.2 1.9 7.2 5.6"/>'
  };

  var ITEMS = [
    { k: 'home', t: '홈',        href: '/home.html',            match: ['/home.html', '/index.html', '/'] },
    { k: 'db',   t: 'DATABASE',  href: '/db/index.html',        match: ['/db/'] },
    { k: 'find', t: '검색',      href: '/search.html',          match: ['/search.html'] },
    { k: 'talk', t: '커뮤니티',  href: '/community/index.html', match: ['/community/'] },
    { k: 'me',   t: '마이페이지', href: '/account/mypage.html',  match: ['/account/'] }
  ];

  var CSS = ''
    /* ★ 띠 높이를 <b>CSS 변수로도</b> 내놓습니다 (2026-08-14)
         게시판 「글쓰기」가 이 띠 위에 고정으로 붙습니다(assets/board.css).
         그쪽에서 68 을 다시 적으면 높이를 바꿀 때 반드시 어긋납니다. */
    + ':root{--oc-tab-h:' + H + 'px}'
    /* 띠 */
    + '.oc-tab{position:fixed;left:0;right:0;bottom:0;z-index:1500;display:none;'
    +   'height:' + H + 'px;box-sizing:border-box;'
    +   'padding-bottom:env(safe-area-inset-bottom,0);'
    /* ★ 2026-08-14 · 흰 띠 → <b>검정</b> (파트너 지시)
         밝은 모드·어두운 모드 <b>둘 다</b> 검정입니다. 그래서 아래쪽
         글자·아이콘 색도 흰 계열로 함께 바꿉니다 — 바탕만 바꾸면
         회색 글자가 묻힙니다. */
    +   'background:#0d0d12;border-top:1px solid rgba(255,255,255,.10);'
    +   'box-shadow:0 -8px 22px -14px rgba(0,0,0,.55)}'
    + '.oc-tab-in{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));height:' + H + 'px}'
    /* 한 칸 */
    + '.oc-tab a,.oc-tab button{display:flex;flex-direction:column;align-items:center;'
    +   'justify-content:center;gap:6px;border:0;background:none;padding:7px 2px 6px;cursor:pointer;'
    +   'font-family:inherit;font-size:10.5px;font-weight:600;letter-spacing:-.02em;'
    +   'color:rgba(255,255,255,.60);text-decoration:none;-webkit-tap-highlight-color:transparent}'
    + '.oc-tab svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;'
    +   'stroke-linecap:round;stroke-linejoin:round}'
    + '.oc-tab .on{color:#b9a3e8}'
    + '.oc-tab .on svg{stroke-width:2}'
    /* 「마이페이지」는 다섯 글자라 320px 화면(한 칸 64px)에서 끊길 수
       있습니다 — 자간을 좁히고 한 줄로 묶습니다 */
    + '.oc-tab span{white-space:nowrap;letter-spacing:-.045em}'
    /* 지금 보고 있는 자리 — 위에 짧은 막대 */
    + '.oc-tab .on::before{content:"";position:absolute;top:0;width:28px;height:2px;'
    +   'border-radius:0 0 3px 3px;background:#b9a3e8}'
    + '.oc-tab a,.oc-tab button{position:relative}'
    /* ★ 2026-08-14 · 전체메뉴·서랍이 열리면 띠를 감춥니다 (파트너 지시)
         전체메뉴는 z-index 120, 서랍은 90 인데 띠는 1500 이라 메뉴 위에
         띠가 남아 있었습니다. 띠의 z-index 를 내리면 맨위로 단추·PWA 띠
         (200)에 가리므로, 열린 동안만 감추는 쪽이 맞습니다. */
    + 'html.oc-menu-open .oc-tab{display:none !important}'
    /* 어두운 화면 — 바탕을 순수 블랙에 가깝게 한 단계만 더 낮춥니다
       (밝은 모드도 이미 검정이므로 색을 다시 적지 않습니다) */
    + 'html[data-theme="dark"] .oc-tab{background:#0a0a0a;border-top-color:rgba(255,255,255,.08)}'
    /* 좁은 화면에서만 보입니다 */
    + '@media (max-width:' + MAX + 'px){'
    +   '.oc-tab{display:block}'
    /* ★ 본문 아래를 띠만큼 비웁니다 — 그러지 않으면 푸터가 가립니다 */
    +   'body{padding-bottom:calc(' + H + 'px + env(safe-area-inset-bottom,0px))}'
    /* ★ 자리를 다투는 것들을 띠 위로 올립니다 */
    +   '.to-top{bottom:calc(' + (H + 12) + 'px + env(safe-area-inset-bottom,0px)) !important}'
    +   '.pwa-install{bottom:calc(' + (H + 10) + 'px + env(safe-area-inset-bottom,0px)) !important}'
    /* ★ 2026-08-14 · 위쪽 ≡ 를 감추던 규칙을 <b>지웠습니다</b>.
         전체메뉴는 헤더 오른쪽(원래 자리)에서 원래 방식으로 엽니다.
         여기서 감추면 style.css 의 `.burger{display:flex}` 를
         !important 로 눌러 버려 되살릴 길이 없어집니다. */
    + '}';

  function injectCSS() {
    if (d.getElementById('oc-tab-css')) return;
    var st = d.createElement('style');
    st.id = 'oc-tab-css';
    st.textContent = CSS;
    d.head.appendChild(st);
  }

  /* 지금 보고 있는 자리 고르기 — 주소가 그 조각으로 시작하면 켭니다.
     ★ 먼저 맞는 것 하나만 켭니다. 「/db/」 와 「/」 가 함께 켜지는 것을
       막으려고 홈은 <b>정확히 같을 때만</b> 봅니다. */
  function pick() {
    var p = location.pathname;
    for (var i = 1; i < ITEMS.length; i++) {
      var m = ITEMS[i].match;
      for (var j = 0; j < m.length; j++) {
        if (p.indexOf(m[j]) === 0) return ITEMS[i].k;
      }
    }
    if (p === '/' || p === '/home.html' || p === '/index.html') return 'home';
    return '';
  }

  function ico(k) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[k] + '</svg>';
  }

  function build() {
    if (d.querySelector('.oc-tab')) return;
    injectCSS();

    var cur = pick();
    var nav = d.createElement('nav');
    nav.className = 'oc-tab';
    nav.setAttribute('aria-label', '아래 메뉴');

    var html = '<div class="oc-tab-in">';
    ITEMS.forEach(function (it) {
      var on = (it.k === cur) ? ' on' : '';
      var cls = (it.k === 'me' ? 'oc-tab-me' + on : on.trim());
      html += '<a class="' + cls + '" href="' + it.href + '"'
            + (on ? ' aria-current="page"' : '') + '>'
            + ico(it.k) + '<span>' + it.t + '</span></a>';
    });
    html += '</div>';
    nav.innerHTML = html;
    d.body.appendChild(nav);

    /* 마이페이지 칸 — 로그인해 있으면 마이페이지, 아니면 로그인 화면 */
    syncMe();
    verifyMe();
    watchMenu();
  }

  /* ── 메뉴가 열렸는지 지켜봅니다 ─────────────────────────
     여는 곳이 셋입니다 — header.js(.fullmenu.open · nav.main.open) 와
     auth.js(회원 화면의 .fullmenu.open). 어느 쪽이든 class 가 바뀌므로
     class 변화만 봅니다. 화면이 무거워지지 않게 <b>class 속성 하나</b>만
     지켜봅니다. */
  function watchMenu() {
    var SEL = '.fullmenu.open, nav.main.open';
    var last = null;
    function upd() {
      var open = !!d.querySelector(SEL);
      /* ★ <b>바뀔 때만</b> 씁니다. classList.add 는 이미 그 값이 있어도
           class 를 다시 써서 변화로 기록됩니다 — 그대로 두면 관찰자가
           자기 변경을 또 잡아 <b>끝없이 돌게 됩니다</b>. */
      if (open === last) return;
      last = open;
      d.documentElement.classList[open ? 'add' : 'remove']('oc-menu-open');
    }
    upd();
    try {
      /* ★ 지켜보는 곳을 <b>body</b> 로 둡니다 — 우리가 바꾸는 것은
           <html> 의 class 이므로 관찰 대상 밖입니다(이중 안전). */
      new MutationObserver(upd).observe(d.body, {
        subtree: true, attributes: true, attributeFilter: ['class']
      });
    } catch (e) {}
    /* 회원 화면은 전체메뉴를 <b>누른 뒤에 만듭니다</b> — 그때는 위
       관찰자가 이미 돌고 있으므로 새로 들어온 상자도 잡힙니다. */
  }

  /* 담긴 세션 값으로 즉시 판정 — 네트워크를 쓰지 않습니다 */
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
          var v = localStorage.getItem(k);
          if (v && v.length > 20 && v.indexOf('access_token') >= 0) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function setMe(logged) {
    var a = d.querySelector('.oc-tab-me');
    if (!a) return;
    a.setAttribute('href', logged ? '/account/mypage.html' : '/account/login.html');
    var sp = a.querySelector('span');
    if (sp) sp.textContent = logged ? '마이페이지' : '로그인';
    a.setAttribute('aria-label', logged ? '마이페이지' : '로그인');
  }

  function syncMe() { setMe(hasStoredSession()); }

  /* 화면이 supabase 를 이미 실었으면 그것으로 한 번 더 맞춥니다.
     app.js 가 헤더를 고칠 때 window.__ocSb 를 만들므로 조금 뒤에
     생깁니다 — 다섯 번까지 1초 간격으로 찾아봅니다. */
  function verifyMe() {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var sb = w.__ocSb;
      if (sb && sb.auth && sb.auth.getSession) {
        clearInterval(t);
        try {
          sb.auth.getSession().then(function (r) {
            setMe(!!(r && r.data && r.data.session));
          }, function () {});
        } catch (e) {}
        return;
      }
      if (n >= 5) clearInterval(t);
    }, 1000);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build);
  else build();

  w.OCTabBar = { build: build, height: H };
})(window, document);
