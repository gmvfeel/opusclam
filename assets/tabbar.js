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

       홈 · DATABASE · 검색 · 커뮤니티 · 전체(≡)

     · 검색을 <b>가운데</b>에 둡니다 — 엄지가 가장 편한 자리이고,
       인물·작품·용어 3만 건이 넘는 사이트에서 검색은 부가 기능이
       아니라 주된 길입니다.
     · 정보SPOT·레슨:ON·리쿠르트·SHOPPING 은 <b>전체(≡)</b> 안에 있습니다.
     · 마이페이지는 넣지 않습니다 — 로그인하지 않은 사람에게는
       죽은 칸이 됩니다. 전체메뉴 안에 이미 있습니다.

   ★ 자리를 다투는 것들을 함께 옮깁니다
     맨위로 단추(.to-top)와 PWA 안내 띠(.pwa-install)가 같은 자리에
     있습니다. 띠 높이만큼 올립니다. 본문 아래도 그만큼 비웁니다 —
     그러지 않으면 푸터가 띠에 가립니다.

   ★ 위쪽 ≡ 는 모바일에서 감춥니다 — 같은 것이 둘이면 헷갈립니다.

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
    more: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };

  var ITEMS = [
    { k: 'home', t: '홈',        href: '/home.html',            match: ['/home.html', '/index.html', '/'] },
    { k: 'db',   t: 'DATABASE',  href: '/db/index.html',        match: ['/db/'] },
    { k: 'find', t: '검색',      href: '/search.html',          match: ['/search.html'] },
    { k: 'talk', t: '커뮤니티',  href: '/community/index.html', match: ['/community/'] },
    { k: 'more', t: '전체',      href: '#',                     match: [] }
  ];

  var CSS = ''
    /* 띠 */
    + '.oc-tab{position:fixed;left:0;right:0;bottom:0;z-index:1500;display:none;'
    +   'height:' + H + 'px;box-sizing:border-box;'
    +   'padding-bottom:env(safe-area-inset-bottom,0);'
    +   'background:var(--paper,#fff);border-top:1px solid var(--line,#e4e4ec);'
    +   'box-shadow:0 -6px 18px -12px rgba(20,18,40,.28)}'
    + '.oc-tab-in{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));height:' + H + 'px}'
    /* 한 칸 */
    + '.oc-tab a,.oc-tab button{display:flex;flex-direction:column;align-items:center;'
    +   'justify-content:center;gap:6px;border:0;background:none;padding:7px 2px 6px;cursor:pointer;'
    +   'font-family:inherit;font-size:10.5px;font-weight:600;letter-spacing:-.02em;'
    +   'color:var(--text-3,#8a8c9e);text-decoration:none;-webkit-tap-highlight-color:transparent}'
    + '.oc-tab svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;'
    +   'stroke-linecap:round;stroke-linejoin:round}'
    + '.oc-tab .on{color:var(--violet-2,#7c63b0)}'
    + '.oc-tab .on svg{stroke-width:2}'
    /* 지금 보고 있는 자리 — 위에 짧은 막대 */
    + '.oc-tab .on::before{content:"";position:absolute;top:0;width:28px;height:2px;'
    +   'border-radius:0 0 3px 3px;background:var(--violet-2,#7c63b0)}'
    + '.oc-tab a,.oc-tab button{position:relative}'
    /* 어두운 화면 */
    + 'html[data-theme="dark"] .oc-tab{background:#111;border-top-color:#2b2b2b}'
    + 'html[data-theme="dark"] .oc-tab a,html[data-theme="dark"] .oc-tab button{color:#9a9a9a}'
    + 'html[data-theme="dark"] .oc-tab .on{color:#b9a3e8}'
    /* 좁은 화면에서만 보입니다 */
    + '@media (max-width:' + MAX + 'px){'
    +   '.oc-tab{display:block}'
    /* ★ 본문 아래를 띠만큼 비웁니다 — 그러지 않으면 푸터가 가립니다 */
    +   'body{padding-bottom:calc(' + H + 'px + env(safe-area-inset-bottom,0px))}'
    /* ★ 자리를 다투는 것들을 띠 위로 올립니다 */
    +   '.to-top{bottom:calc(' + (H + 12) + 'px + env(safe-area-inset-bottom,0px)) !important}'
    +   '.pwa-install{bottom:calc(' + (H + 10) + 'px + env(safe-area-inset-bottom,0px)) !important}'
    /* ★ 위쪽 ≡ 는 감춥니다 — 같은 것이 둘이면 헷갈립니다.
         전체메뉴 안의 닫기(×)는 그대로 둡니다. */
    +   '.mast-tools .fullmenu-btn,.mast-tools .burger{display:none !important}'
    /* ★ 회원 화면(.gnb)의 ≡ 도 함께 감춥니다 — 그쪽은 짜임이 달라
         위 선택자에 걸리지 않았습니다. 눌러 주는 것은 코드로 하므로
         감춰도 전체메뉴는 열립니다. */
    +   '.gnb .burger{display:none !important}'
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
      var ico = '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[it.k] + '</svg>';
      if (it.k === 'more') {
        html += '<button type="button" class="oc-tab-more' + on + '" aria-label="전체 메뉴 열기">'
              + ico + '<span>' + it.t + '</span></button>';
      } else {
        html += '<a class="' + on.trim() + '" href="' + it.href + '"'
              + (on ? ' aria-current="page"' : '') + '>'
              + ico + '<span>' + it.t + '</span></a>';
      }
    });
    html += '</div>';
    nav.innerHTML = html;
    d.body.appendChild(nav);

    /* 전체(≡) — 이미 있는 전체메뉴를 엽니다.
       ★ 헤더의 단추를 눌러 줍니다. 그러면 여는 방식이 <b>한 곳</b>에만
         있게 되어(assets/header.js), 나중에 그쪽을 고쳐도 함께 따릅니다.
       ★ 헤더가 늦게 들어오는 화면이 있어, 누를 때 다시 찾습니다. */
    nav.querySelector('.oc-tab-more').addEventListener('click', function () {
      /* ① 본 화면 — 헤더의 전체메뉴 단추 */
      var btn = d.getElementById('fullMenuBtn');
      if (btn) { btn.click(); return; }
      /* ② 회원 화면(.gnb) — 그쪽은 .burger 가 전체메뉴를 엽니다.
           ★ assets/auth.js 가 그 단추를 눌렀을 때 <b>전체메뉴를 만들고
             style.css 를 끼워 넣습니다.</b> 그래서 우리가 직접 열면
             모양이 없는 메뉴가 나옵니다 — 반드시 그 단추를 눌러야 합니다.
           ★ 이것이 없어서 로그인·회원가입 화면에서 「전체」가 아무 일도
             하지 않았습니다 (파트너 지적). */
      var bg = d.querySelector('.gnb .burger') || d.querySelector('.burger');
      if (bg) { bg.click(); return; }
      /* ③ 그래도 없으면 이미 들어와 있는 전체메뉴를 엽니다 */
      var fm = d.getElementById('fullMenu');
      if (fm) { fm.classList.add('open'); d.body.style.overflow = 'hidden'; }
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build);
  else build();

  w.OCTabBar = { build: build, height: H };
})(window, document);
