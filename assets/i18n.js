/* ===== OPUSCLAM 다국어 엔진 (i18n) =====================================
   2026-08-10 신설 · 1단계 기반

   ── 무엇을 하는가 ────────────────────────────────────────────────
   주소가 /en/… 또는 /ja/… 이면 화면의 한국어를 그 언어로 바꿉니다.
   한국어(/…)일 때는 <b>사전을 받지도 않고 곧바로 끝냅니다.</b>
   → 한국 이용자에게는 부담이 0 입니다.

   ── 왜 이런 구조인가 ─────────────────────────────────────────────
   ① 화면 파일을 고치지 않습니다
      146개 화면에 data-i18n="…" 을 6,300군데 붙이는 것은 현실적이지
      않습니다. 그래서 <b>한국어 원문 자체를 열쇠(key)로</b> 씁니다.
      사전이 { "인물 DB": "People" } 이면 화면에 손대지 않아도 바뀝니다.

   ② 화면이 그려지기 <b>전에</b> 바꿉니다
      이 파일은 include.js 가 부릅니다. include.js 는 모든 화면에서
      <body> 바로 다음에 <b>동기</b>로 실려 있습니다(111개 전수 확인).
      그래서 본문이 아직 하나도 그려지지 않은 때에 사전이 준비됩니다.
      → 한국어가 잠깐 보였다 바뀌는 깜빡임이 없습니다.

   ③ 나중에 그려지는 것도 따라갑니다
      헤더·하위메뉴·푸터·DB 목록은 나중에 붙습니다.
      MutationObserver 로 계속 지켜보다가 붙는 즉시 바꿉니다.

   ── 쓰는 법 (다른 파일에서) ──────────────────────────────────────
      OCI18N.lang            'ko' | 'en' | 'ja'
      OCI18N.t('저장')        번역된 글자 (없으면 원문 그대로)
      OCI18N.url('/db/x.html')  현재 언어 주소로 (/en/db/x.html)
      OCI18N.apply(el)       그 자리 안을 다시 훑어 바꾸기

   ── 손대기 전에 알아둘 것 ────────────────────────────────────────
   · 텍스트 조각 <b>전체</b>가 사전 열쇠와 같을 때만 바꿉니다.
     한 조각 안의 일부만 바꾸면 「음악학교 DB」 의 '음악' 만 바뀌는
     식으로 글이 망가집니다.
   · 앞뒤 여백은 그대로 둡니다 — 없애면 낱말이 붙어버립니다.
   · 내가 넣은 값은 기억해 두고 다시 건드리지 않습니다.
     (번역문이 우연히 다른 열쇠와 같으면 끝없이 도는 것을 막습니다)
   ===================================================================== */
(function () {
  'use strict';

  /* 사전 파일 판(버전) — 사전을 고치면 이 숫자를 올립니다.
     ★ 안 올리면 브라우저가 옛 사전을 계속 씁니다. */
  var V = '20260810';

  /* ★★ 번역이 덜 찬 동안 검색엔진에 잡히지 않게 막습니다 ★★
     ─────────────────────────────────────────────────────────────
     지금 /en/ · /ja/ 화면은 <b>겉껍데기만 번역되고 속은 한국어</b>입니다.
     이대로 검색엔진이 「영어 판」 으로 거두어 가면, 나중에 제대로
     번역해도 <b>「한국어가 섞인 영어 쪽」 이라는 평가가 남습니다.</b>
     그래서 다 채울 때까지 「거두어 가지 마세요」 표를 붙여 둡니다.

     ▶ 언제 끄나 — 사전이 충분히 차서 화면이 온전히 그 말로 보일 때
       아래 한 줄만 false 로 바꾸면 됩니다. 그 순간 noindex 가 빠지고
       hreflang 이 붙어 검색엔진이 언어별로 거두어 갑니다.
       (한국어 화면에는 처음부터 아무 영향이 없습니다)

     ★ robots.txt 에 Disallow 를 <b>넣지 않습니다.</b>
       막아 버리면 봇이 화면을 읽지 못해 <b>noindex 를 보지도 못합니다.</b>
       그러면 링크만 보고 주소를 거두어 갈 수 있어 오히려 위험합니다.
       읽게 하되 「거두지 마세요」 라고 말하는 편이 확실합니다. */
  var HIDE_FROM_SEARCH = true;

  /* 다룰 언어. 늘릴 때는 여기와 assets/i18n/○○.json 만 만들면 됩니다. */
  var LANGS = ['en', 'ja'];
  var NAMES = { ko: '한국어', en: 'English', ja: '日本語' };
  var SHORT = { ko: 'KO', en: 'EN', ja: 'JA' };

  /* ── 붙박이 값 ─────────────────────────────────────────────────
     ★ <b>반드시 여기(맨 위)에 두어야 합니다.</b>
       var 는 이름만 미리 올라가고 <b>값은 그 줄에 닿아야</b> 담깁니다.
       예전에 이 값들을 파일 아래쪽에 두었더니, 위에서 부르는
       scan()·startWatch() 가 돌 때 모두 undefined 여서
       <b>번역이 통째로 조용히 실패</b>했습니다 (2026-08-10 검증에서 잡음).
       바깥을 try 로 감싸 두어 오류도 드러나지 않았습니다. */

/* ── 주소에 언어 붙이기 ────────────────────────────────────────
     · 우리 사이트 안의 화면 주소에만 붙입니다
     · 그림·CSS·JS 같은 파일에는 붙이지 않습니다 (붙여도 되지만 헛걸음) */
  var SKIP_PATH = /^\/(assets|partials|seed|scripts|sql|tools|icon-|manifest|sw\.js|robots\.txt|sitemap\.xml)/i;
  var FILE_EXT = /\.(png|jpe?g|gif|svg|webp|css|js|json|xml|txt|ico|pdf|mjs|webmanifest)$/i;

/* 안을 들여다보지 않을 꼬리표 */
  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, SVG: 1, CANVAS: 1 };

/* 바꿔 줄 속성 */
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'aria-placeholder', 'data-empty', 'data-label'];

/* 내가 넣은 값 기억 — 다시 건드리지 않기 위해 */
  var mine = (typeof WeakMap === 'function') ? new WeakMap() : null;

  /* 지켜보기 살림살이 */
  var mo = null, paused = 0, queue = [], timer = null;

  /* ── ① 지금 어느 말인가 ────────────────────────────────────────
     주소만 봅니다. 저장해 둔 값으로 <b>자동으로 옮기지 않습니다</b> —
     검색엔진이 헷갈리고, 이용자도 왜 옮겨졌는지 모릅니다. */
  var seg = (location.pathname.split('/')[1] || '').toLowerCase();
  var LANG = (LANGS.indexOf(seg) >= 0) ? seg : 'ko';

  /* 언어를 뺀 알맹이 주소 — /en/db/person.html → /db/person.html */
  var BARE = (LANG === 'ko')
    ? location.pathname
    : location.pathname.slice(('/' + LANG).length) || '/';

  /* ── 주소에서 언어를 떼는 도우미 ───────────────────────────────
     ★ <b>한국어 화면에서도 반드시 내어 두어야 합니다.</b>
       이 도우미가 없으면 다른 파일들이 폴백(String)으로 돌아가는데,
       그것은 한국어에서 옳게 동작합니다. 문제는 영어·일본어입니다.

     ★ 왜 있어야 하나 (2026-08-10 검증에서 찾음)
       공용 JS 여러 곳이 「지금 어느 화면인가」 를 location.pathname 으로
       가립니다. /en/db/person.html 은 /db/person.html 과 <b>다른 글자</b>라
       — 관심분야 단추가 사라지고, 위 메뉴 표시가 꺼지고,
       즐겨찾기 갈래(itemType)가 어긋났습니다.

     ★ 쓰는 법 — 파일마다 이렇게 씁니다(i18n 이 없어도 안전).
         var here = (window.ocPath || String)(location.pathname);
       String('/db/x') 는 '/db/x' 를 그대로 돌려주므로 폴백이 완벽합니다.

     ★ 「돌아갈 주소」(?next=·pushState) 에는 <b>쓰지 마세요.</b>
       그것은 /en 이 붙은 채여야 로그인 뒤에도 영어로 돌아옵니다. */
  window.ocPath = function (p) {
    var s = String(p == null ? '' : p);
    if (s.charAt(0) !== '/') return s;
    var first = (s.split('/')[1] || '').toLowerCase();
    if (LANGS.indexOf(first) < 0) return s;
    return s.slice(first.length + 1) || '/';
  };

  /* 다른 파일이 쓸 수 있게 미리 내어 둡니다 */
  var API = {
    lang: LANG,
    langs: ['ko'].concat(LANGS),
    bare: BARE,
    dict: null,
    t: function (s) { return s; },
    url: function (p) { return p; },
    apply: function () {},
    ready: false
  };
  window.OCI18N = API;

  /* 언어 고르개는 어느 말이든 답니다 */
  mountStyle();
  onReady(mountPicker);

  /* 한국어면 여기서 끝 — 사전도 받지 않습니다 */
  if (LANG === 'ko') {
    markAlternates();
    API.ready = true;
    return;
  }

  /* ── ② 사전 받기 (동기) ───────────────────────────────────────
     동기로 받는 까닭: 이 줄이 끝나야 본문이 그려집니다. 비동기로
     받으면 한국어가 한 번 그려진 뒤에 바뀌어 깜빡입니다.
     include.js 도 같은 방식으로 헤더를 넣고 있습니다. */
  var DICT = loadDict(LANG);
  if (!DICT) {
    /* 사전이 없으면 한국어 그대로 보여 줍니다 — 화면이 멈추면 안 됩니다 */
    if (window.console) console.warn('[i18n] 사전을 받지 못했습니다:', LANG);
    markAlternates();
    API.ready = true;
    return;
  }
  API.dict = DICT;
  API.t = translate;
  API.url = localize;
  API.apply = function (root) { walk(root || document.body); };

  document.documentElement.setAttribute('lang', LANG);
  document.documentElement.setAttribute('data-oc-lang', LANG);
  markAlternates();

  /* 문서 제목 */
  try { if (document.title) document.title = translate(document.title); } catch (e) {}

  /* 첫 훑기 — 지금 있는 것(주로 <head> 와 빈 <body>)을 바꿉니다 */
  scan(document.documentElement);

  /* 앞으로 붙는 것들을 지켜봅니다 */
  startWatch();

  /* ★ 그물을 한 겹 더 둡니다.
     문서를 읽는 도중에는 파서가 글자를 <b>조각내어</b> 넣기도 합니다
     ("인물 D" → "인물 DB"). 그 사이에 견주면 어긋납니다.
     다 읽은 뒤 한 번, 그림·글꼴까지 다 온 뒤 한 번 더 훑습니다. */
  onReady(function () { scan(document.documentElement); });
  window.addEventListener('load', function () { scan(document.documentElement); });

  API.ready = true;

  /* ===================================================================
     아래는 살림살이
     =================================================================== */

  /* ── 사전 받기 ──────────────────────────────────────────────── */
  function loadDict(lang) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', '/assets/i18n/' + lang + '.json?v=' + V, false); /* false = 동기 */
      x.send();
      if (x.status && x.status !== 200 && x.status !== 0) return null;
      var raw = JSON.parse(x.responseText);
      /* 밑줄로 시작하는 열쇠는 메모용이라 뺍니다 */
      var out = {};
      for (var k in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
        if (k.charAt(0) === '_') continue;
        var v = raw[k];
        if (typeof v === 'string' && v !== '') out[norm(k)] = v;
      }
      return out;
    } catch (e) {
      return null;
    }
  }

  /* ── 여백 고르기 ────────────────────────────────────────────────
     줄바꿈·여러 칸을 한 칸으로 줄여 견줍니다. 화면에서는 어차피
     한 칸으로 보이는데, 파일에는 줄이 나뉘어 있는 곳이 많습니다. */
  function norm(s) {
    return String(s).replace(/\s+/g, ' ').trim();
  }

  /* ── 글자 하나 옮기기 ──────────────────────────────────────────
     앞뒤 여백은 <b>그대로 되돌려 놓습니다</b>. */
  function translate(s) {
    if (!s) return s;
    var raw = String(s);
    var key = norm(raw);
    if (!key) return raw;
    var hit = DICT[key];
    if (hit === undefined) return raw;
    var m = raw.match(/^(\s*)[\s\S]*?(\s*)$/);
    return (m ? m[1] : '') + hit + (m ? m[2] : '');
  }


  function localize(p) {
    if (LANG === 'ko') return p;
    var s = String(p || '');
    if (!s || s.charAt(0) !== '/') return s;              /* 상대주소·외부주소는 그대로 */
    if (s.charAt(1) === '/') return s;                    /* //cdn… 은 외부 */
    var path = s.split('#')[0].split('?')[0];
    if (SKIP_PATH.test(path)) return s;
    if (FILE_EXT.test(path)) return s;
    /* 이미 언어가 붙어 있으면 그대로 */
    var first = (path.split('/')[1] || '').toLowerCase();
    if (LANGS.indexOf(first) >= 0) return s;
    return '/' + LANG + s;
  }

  /* ── hreflang · 대체 주소 알림 ─────────────────────────────────
     검색엔진에 「같은 글의 다른 말 판」을 알려 줍니다. */
  function markAlternates() {
    try {
      var head = document.head || document.getElementsByTagName('head')[0];
      if (!head) return;

      /* ① 아직 덜 채웠으면 「거두어 가지 마세요」 를 붙입니다 */
      if (HIDE_FROM_SEARCH && LANG !== 'ko' && !document.getElementById('oc-i18n-noindex')) {
        var mt = document.createElement('meta');
        mt.id = 'oc-i18n-noindex';
        mt.setAttribute('name', 'robots');
        mt.setAttribute('content', 'noindex, nofollow');
        head.appendChild(mt);
      }

      /* ② hreflang 은 <b>다 채운 뒤에</b> 답니다.
         막아 둔 화면을 「이 말의 판」 이라고 알리면 서로 어긋납니다. */
      if (HIDE_FROM_SEARCH) return;
      if (document.querySelector('link[rel="alternate"][hreflang]')) return;
      var list = [['ko', BARE]];
      LANGS.forEach(function (l) { list.push([l, '/' + l + BARE]); });
      list.push(['x-default', BARE]);
      list.forEach(function (pair) {
        var el = document.createElement('link');
        el.setAttribute('rel', 'alternate');
        el.setAttribute('hreflang', pair[0]);
        el.setAttribute('href', location.origin + pair[1]);
        head.appendChild(el);
      });
    } catch (e) {}
  }

  /* ── 훑어서 바꾸기 ────────────────────────────────────────────── */



  function remember(node, val) { if (mine) { try { mine.set(node, val); } catch (e) {} } }
  function isMine(node, val) {
    if (!mine) return false;
    try { return mine.get(node) === val; } catch (e) { return false; }
  }

  function scan(root) {
    if (!root) return;
    pause();
    try { walk(root); } catch (e) { if (window.console) console.warn('[i18n]', e); }
    resume();
  }

  function walk(root) {
    if (!root) return;

    /* ① 이 마디 자체가 글자면 */
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;

    /* ② 속성 */
    if (root.nodeType === 1) fixAttrs(root);

    /* ③ 안쪽 글자 — TreeWalker 로 한 번에 */
    var doc = root.ownerDocument || document;
    var tw;
    try {
      tw = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          if (!p || p.nodeType !== 1) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAG[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
    } catch (e) { return; }

    var list = [];
    var n;
    while ((n = tw.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) fixText(list[i]);

    /* ④ 안쪽 속성 + 링크 */
    if (root.querySelectorAll) {
      var els = root.querySelectorAll('*');
      for (var j = 0; j < els.length; j++) fixAttrs(els[j]);
    }
  }

  function fixText(node) {
    var cur = node.nodeValue;
    if (!cur || !/\S/.test(cur)) return;
    if (isMine(node, cur)) return;                 /* 내가 넣은 그대로면 지나감 */
    var out = translate(cur);
    if (out === cur) return;
    node.nodeValue = out;
    remember(node, out);
  }

  function fixAttrs(el) {
    if (!el || el.nodeType !== 1) return;
    if (SKIP_TAG[el.nodeName]) return;

    /* 명시 열쇠가 있으면 그것을 먼저 */
    var key = el.getAttribute && el.getAttribute('data-i18n');
    if (key) {
      var v = DICT[norm(key)];
      if (v !== undefined && el.textContent !== v) el.textContent = v;
    }

    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      var cur = el.getAttribute(a);
      if (!cur || !/\S/.test(cur)) continue;
      var out = translate(cur);
      if (out !== cur) el.setAttribute(a, out);
    }

    /* 단추 글자 */
    if (el.nodeName === 'INPUT') {
      var t = (el.getAttribute('type') || '').toLowerCase();
      if (t === 'button' || t === 'submit' || t === 'reset') {
        var vv = el.getAttribute('value');
        if (vv && /\S/.test(vv)) {
          var nv = translate(vv);
          if (nv !== vv) el.setAttribute('value', nv);
        }
      }
    }

    /* 링크에 언어 붙이기 */
    if (el.nodeName === 'A') {
      var h = el.getAttribute('href');
      if (h) {
        var nh = localize(h);
        if (nh !== h) el.setAttribute('href', nh);
      }
    }
  }

  /* ── 지켜보기 ──────────────────────────────────────────────────
     ★ 바꾸는 동안에는 잠시 멈춥니다 — 내가 바꾼 것을 내가 다시 보고
       또 바꾸려 드는 되돌이를 막습니다. */

  function startWatch() {
    if (typeof MutationObserver !== 'function') return;
    mo = new MutationObserver(function (recs) {
      if (paused) return;
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'childList') {
          for (var j = 0; j < r.addedNodes.length; j++) queue.push(r.addedNodes[j]);
        } else if (r.target) {
          queue.push(r.target);
        }
      }
      /* ★ 마이크로태스크로 미룹니다 (setTimeout 이 아니라)
         setTimeout 은 화면을 한 번 그린 <b>뒤</b>에 돌 수 있어
         한국어가 반짝 보입니다. 마이크로태스크는 그리기 전에 끝납니다. */
      if (queue.length && !timer) {
        timer = 1;
        if (typeof Promise === 'function') Promise.resolve().then(flush);
        else setTimeout(flush, 0);
      }
    });
    mo.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS.concat(['href', 'value', 'data-i18n'])
    });
  }

  function flush() {
    timer = null;
    var list = queue; queue = [];
    pause();
    try {
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        if (!n || !n.parentNode && n.nodeType !== 9) { /* 이미 떨어져 나간 마디는 건너뜀 */ }
        try { walk(n); } catch (e) {}
      }
    } finally {
      resume();
    }
  }

  function pause() { paused++; }
  function resume() {
    paused--;
    if (paused < 0) paused = 0;
    /* 내가 바꾸는 동안 쌓인 알림은 버립니다 */
    if (!paused && mo) { try { mo.takeRecords(); } catch (e) {} }
  }

  /* ── 언어 고르개 ──────────────────────────────────────────────
     ★ 꾸밈을 스스로 넣습니다 — style.css 를 부르지 않는 화면
       (index.html·home.html·회원 화면)에서도 같게 보이도록. */
  function mountStyle() {
    if (document.getElementById('oc-i18n-css')) return;
    var css =
      '.oc-lang{position:relative;display:inline-flex;align-items:center;margin-left:14px;font-family:inherit}' +
      '.oc-lang>button{background:none;border:0;padding:2px 6px;cursor:pointer;font:inherit;font-size:11px;' +
      'font-weight:700;letter-spacing:.06em;color:inherit;opacity:.62;display:inline-flex;align-items:center;gap:4px;line-height:1.4}' +
      '.oc-lang>button:hover{opacity:1}' +
      '.oc-lang>button::after{content:"";width:0;height:0;border-left:3px solid transparent;' +
      'border-right:3px solid transparent;border-top:4px solid currentColor;opacity:.7}' +
      '.oc-lang ul{position:absolute;top:100%;right:0;margin:4px 0 0;padding:5px 0;list-style:none;' +
      'min-width:104px;background:#fff;border:1px solid #e6e1d7;border-radius:8px;' +
      'box-shadow:0 8px 24px rgba(20,16,40,.14);display:none;z-index:9999}' +
      '.oc-lang.open ul{display:block}' +
      '.oc-lang li a{display:block;padding:7px 14px;font-size:12.5px;color:#2a2b45;text-decoration:none;white-space:nowrap}' +
      '.oc-lang li a:hover{background:#f6f2ea;color:#7C63B0}' +
      '.oc-lang li a.on{color:#7C63B0;font-weight:700}' +
      'html[data-theme="dark"] .oc-lang ul{background:#161616;border-color:#2f2f2f}' +
      'html[data-theme="dark"] .oc-lang li a{color:#e8e8e8}' +
      'html[data-theme="dark"] .oc-lang li a:hover{background:#242424}' +
      '.oc-lang-float{position:fixed;top:12px;right:14px;z-index:9998;color:#8a8aa0}';
    var st = document.createElement('style');
    st.id = 'oc-i18n-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function mountPicker() {
    if (document.querySelector('.oc-lang')) return;

    /* 놓을 자리를 차례로 찾습니다 */
    var host = document.querySelector('.site-header .util .right')   /* 본 헤더 */
            || document.querySelector('.gnb .auth')                   /* 회원 헤더 */
            || document.querySelector('.gnb nav.nav')
            || null;

    var box = document.createElement('div');
    box.className = 'oc-lang' + (host ? '' : ' oc-lang-float');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Language');
    btn.textContent = SHORT[LANG] || 'KO';

    var ul = document.createElement('ul');
    API.langs.forEach(function (l) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = (l === 'ko' ? '' : '/' + l) + BARE + location.search + location.hash;
      a.textContent = NAMES[l] || l;
      /* 막아 둔 동안에는 봇이 따라 들어가지 않게 합니다 */
      if (HIDE_FROM_SEARCH && l !== 'ko') a.setAttribute('rel', 'nofollow');
      if (l === LANG) a.className = 'on';
      /* ★ 고른 말을 적어 둡니다 — 나중에 「그 말로 열기」 를 만들 때 씁니다.
           지금은 자동으로 옮기지 않습니다. */
      a.addEventListener('click', function () {
        try { localStorage.setItem('oc-lang', l); } catch (e) {}
      });
      li.appendChild(a);
      ul.appendChild(li);
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      box.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target)) box.classList.remove('open');
    });

    box.appendChild(btn);
    box.appendChild(ul);

    if (host) host.appendChild(box);
    else document.body.appendChild(box);
  }

  function onReady(fn) {
    /* 헤더는 include.js 가 넣으므로, 문서를 다 읽은 뒤에 붙입니다 */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { try { fn(); } catch (e) {} });
    } else {
      try { fn(); } catch (e) {}
    }
  }

})();
