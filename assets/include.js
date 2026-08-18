/* OPUSCLAM 공통 헤더 로더
   - 각 페이지의 <div id="oc-header"></div>(메인) 또는 <div id="oc-header-auth"></div>(회원)
     자리에 partials/header.html · partials/header-auth.html 를 채워 넣는다.
   - 헤더는 "동기"로 즉시 넣는다: 뒤의 헤더 동작 스크립트(햄버거·테마·스티키)보다 먼저 DOM에 들어가야 함.
   - 푸터는 이 파일이 담당하지 않는다(app.js 가 #oc-footer 자리에 그린다).
   - 사용법: 헤더 자리표 바로 아래에 <script src="/assets/include.js"></script> 한 줄. */

/* ── 다국어 엔진 싣기 (2026-08-10 신설) ────────────────────────────
   ★ 왜 여기서 싣나
     화면 111개에 <script src="/assets/i18n.js"> 를 한 줄씩 넣으면
     배포할 파일이 111개가 되고, 화면을 늘릴 때마다 또 넣어야 하며,
     한 곳이라도 빠뜨리면 그 화면만 한국어로 남습니다.
     include.js 는 <b>모든 화면이 이미 부르고 있고</b>, <body> 바로
     다음에서 <b>동기</b>로 실립니다 — 본문이 그려지기 전입니다.
     여기 한 줄이면 111개가 한꺼번에 됩니다.

   ★ document.write 를 쓰는 까닭
     문서를 읽는 도중이라 <b>그 자리에 끼워 넣어 곧바로</b> 실행됩니다.
     createElement 로 붙이면 비동기라, 한국어가 한 번 그려진 뒤에
     바뀌어 반짝입니다.

   ★ 한국어 화면에서는 i18n.js 가 사전을 받지도 않고 곧 끝납니다.
     (언어 고르개만 답니다) — 부담이 거의 없습니다.

   ★ 판(버전) 을 꼭 올리세요 — 사전이나 엔진을 고치면 이 숫자를
     바꿔야 브라우저가 새것을 받습니다. */
(function () {
  /* ★ 판(버전) 쿼리를 떼었습니다 (2026-08-10 · 파트너 지적)
     vercel.json 이 /assets/*.js 에 이미
         Cache-Control: max-age=0, must-revalidate
     를 걸어 두어, 브라우저가 <b>매번 서버에 물어봅니다.</b>
     그래서 ?v= 가 없어도 새 파일을 받습니다.

     예전에는 「혹시 모르니」 판 번호를 붙였는데, 그러려면 판을 올릴
     때마다 index.html 과 legal/ 네 개까지 <b>다섯 파일을 함께</b>
     배포해야 했습니다. 내용은 한 글자도 안 바뀌는데 말입니다.
     ▶ 이제 i18n.js 를 고치면 <b>그 파일만</b> 올리시면 됩니다.

     ※ 사전(en.json·ja.json)을 받을 때 쓰는 판 번호는 i18n.js <b>안에</b>
       있으므로 그대로 둡니다 — 그것은 한 파일만 고치면 됩니다. */
  if (document.getElementById('oc-i18n-js')) return;
  var src = '/assets/i18n.js';
  try {
    if (document.readyState === 'loading') {
      document.write('<script id="oc-i18n-js" src="' + src + '"><\/script>');
    } else {
      var s = document.createElement('script');
      s.id = 'oc-i18n-js'; s.src = src;
      (document.head || document.documentElement).appendChild(s);
    }
  } catch (e) {}
})();

(function () {
  /* ★★ 2026-08-18 · <b>판 번호</b>를 붙입니다 (파트너와 겪은 일)
       ─────────────────────────────────────────────────────
     ★ 무엇이 문제였나
       메뉴에 쇼핑몰을 하나 더했는데 <b>화면에 나오지 않았습니다.</b>
       파일은 제대로 올라갔는데, 브라우저가 <b>한 번 받은 파셜을 계속
       다시 쓰고</b> 있었습니다. 파셜은 모든 화면이 부르는 파일이라,
       고쳐도 회원들은 <b>옛 메뉴를 봅니다.</b>

     ★ 어떻게 고쳤나 — 주소 뒤에 판 번호를 붙입니다.
         /partials/header.html?v=20260818
       번호가 바뀌면 브라우저가 <b>새 파일로 봅니다.</b> 번호가 같으면
       그대로 다시 써서 빠릅니다 — 캐시를 아예 끄는 것과 다릅니다.

     ★★ 2026-08-19 · <b>번호를 손으로 적지 않습니다</b> (또 겪었습니다)
       ─────────────────────────────────────────────────────
     ★ 무엇이 또 문제였나
       번호를 '20260818' 로 <b>박아 두었더니</b>, 그날 안에 메뉴를
       다시 고쳤을 때 번호가 그대로여서 브라우저가 <b>어제 받은
       파일을 계속 썼습니다.</b> 캐시를 막으려 넣은 것이 거꾸로
       낡은 것을 붙들었습니다.
       ★ 「고칠 때마다 번호를 올리자」는 약속은 <b>지켜지지 않습니다.</b>
         잊기 때문입니다. 그러면 늘 이 자리로 돌아옵니다.

     ★ 그래서 <b>이 파일 자신의 판</b>을 번호로 씁니다.
       include.js 는 파셜을 고칠 때 함께 올릴 일이 거의 없지만,
       vercel.json 이 <b>/assets/*.js 를 매번 다시 확인</b>하도록
       해 두었으므로 이 파일은 늘 새것입니다. 그래서 이 파일이
       실린 <b>시각</b>을 번호로 쓰면 저절로 바뀝니다.
       ★ 브라우저가 이 스크립트 주소에 붙여 준 ?v= 값이 있으면
         그것을 그대로 씁니다(화면들이 ?v= 를 붙여 부릅니다).
         없으면 <b>날짜+시</b>로 만듭니다 — 한 시간마다 새로 받습니다.

     ★ 지금 화면들은 <b>?v= 없이</b> 부르므로 날짜＋시가 쓰입니다.
       메뉴를 고친 뒤 <b>한 시간 안에</b> 꼭 보여야 한다면 두 길이
       있습니다 —
         ① 브라우저에서 강력 새로고침(Ctrl+Shift+R)
         ② 이 아래 FORCE 값을 아무 글자로 바꿔 함께 올리기
       ②는 모든 회원에게 곧바로 새 메뉴가 갑니다. */
  var FORCE = 'c';  /* 급할 때만 아무 글자로 바꾸십시오 (예: 'a')
                       ★ 2026-08-19 · 깨진 판을 브라우저가 담아 두고
                         있어 한 글자 올렸습니다. 이 파일은 15시간 전
                         판으로 되돌린 것입니다. */
  var PARTIAL_VER = (function () {
    /* ① 이 스크립트를 부른 주소에 ?v= 가 있으면 그것을 씁니다 */
    try {
      var me = document.currentScript
            || (function () {
                 var a = document.getElementsByTagName('script');
                 for (var i = a.length - 1; i >= 0; i--) {
                   if ((a[i].src || '').indexOf('include.js') >= 0) return a[i];
                 }
                 return null;
               })();
      var m = me && /[?&]v=([^&]+)/.exec(me.src || '');
      if (m) return m[1] + FORCE;
    } catch (e) { /* 못 읽으면 아래로 */ }
    /* ② 없으면 날짜＋시 — 한 시간마다 새로 받습니다 */
    var d = new Date();
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return '' + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate())
             + two(d.getHours()) + FORCE;
  })();

  function withVer(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + PARTIAL_VER;
  }

  function inject(id, url) {
    var slot = document.getElementById(id);
    if (!slot) return;
    try {
      var x = new XMLHttpRequest();
      x.open('GET', withVer(url), false); // false = 동기
      x.send();
      slot.insertAdjacentHTML('afterend', x.responseText);
      slot.remove();
    } catch (e) {
      if (window.console) console.warn('[include] 실패:', id, e);
    }
  }

  /* ── 주소에서 이름 뽑기 (GNB·하위 메뉴가 함께 씁니다) ────────
     한 곳에 두어야 두 메뉴가 같은 규칙으로 켜집니다. */

  /* ★ 주소를 견주기 전에 <b>언어를 뗍니다</b> (2026-08-10)
       /en/db/person.html 과 /db/person.html 은 같은 화면입니다.
       떼지 않으면 영어·일본어 화면에서 위 메뉴 표시가 꺼지고,
       관심분야 단추가 사라집니다.
     ★ 아래 셋(fileOf·baseOf·dirOf)은 <b>주소와 링크(href) 양쪽에</b>
       쓰이므로, 여기 한 곳에서 떼면 양쪽이 똑같이 맞아떨어집니다.
     ★ i18n.js 가 없어도 안전합니다 — String 이 그대로 돌려줍니다. */
  function bare(p) { return (window.ocPath || String)(p); }

  /* 파일 이름 그대로 — job-write.html → job-write */
  function fileOf(path) {
    var f = bare(String(path || '')).split('#')[0].split('?')[0].split('/').pop() || 'index.html';
    return f.replace(/\.html$/, '') || 'index';
  }

  /* 줄인 이름 — 상세·글쓰기를 그 짝의 목록으로 봅니다 */
  function baseOf(path) {
    var raw = fileOf(path);
    /* 정보SPOT 상세·글쓰기는 「전체」로 둡니다.
       ★ 줄이기 전에 봐야 합니다 — 줄인 뒤에는 spot 이 되어
         이 조건이 영영 걸리지 않습니다(예전엔 죽은 줄이었습니다). */
    if (raw === 'spot-view' || raw === 'spot-write') return 'index';
    /* ★ DATABASE 의 등록 화면(db/write.html)도 「전체」 로 둡니다.
       메뉴에 없는 이름이라 아무 알약도 켜지지 않으면, 어느 갈래에
       있는지 알 수 없어 길을 잃습니다. */
    if (raw === 'write') return 'index';
    var f = raw.replace(/-view$|-write$/, '') || 'index';
    /* 입시요강과 입시커뮤니티는 「입시」 하나로 묶습니다 */
    if (f === 'admission-community') f = 'admission';
    return f;
  }

  /* 폴더 — /recruit/job.html → /recruit/ */
  function dirOf(path) {
    var q = bare(String(path || '')).split('#')[0].split('?')[0];
    var i = q.lastIndexOf('/');
    return i >= 0 ? q.slice(0, i + 1) : '/';
  }

  /* ── 위쪽 큰 메뉴와 드롭다운·전체메뉴 표시 ────────────────
     ★ 예전에는 「주소에 링크가 들어 있으면」 켰습니다(indexOf).
       그러면 상세·글쓰기 화면(job-view·org-view)에서 위쪽 큰 메뉴에
       표시가 붙지 않았습니다. 링크 글자가 주소에 없기 때문입니다.

     그래서 둘로 나누어 봅니다.
       · 위쪽 큰 메뉴 → <b>폴더</b>가 같으면 켠다
         (/recruit/ 밑이면 어느 화면이든 「리쿠르트」 가 켜집니다)
       · 드롭다운·전체메뉴 → <b>파일 이름</b>이 같으면 켠다
         (없으면 줄인 이름으로 한 번 더 — org-view 는 음악단체DB)

     ★ 폴더 규칙을 드롭다운에 쓰면 안 됩니다 —
       DATABASE 는 일곱 개가 모두 /db/ 밑이라 일곱 개가 다 켜집니다. */
  function markActiveMenu() {
    try {
      var p = location.pathname;
      var raw = fileOf(p), base = baseOf(p), dir = dirOf(p);

      /* ① 위쪽 큰 메뉴 — 폴더로 */
      var tops = document.querySelectorAll('.site-header nav.main > .nav-item > a[href]');
      [].forEach.call(tops, function (a) {
        var h = a.getAttribute('href') || '';
        if (h.charAt(0) !== '/') return;              /* '#' 이나 외부 주소는 건너뜁니다 */
        if (dir !== '/' && dirOf(h) === dir) a.classList.add('active');
      });

      /* ② 드롭다운·전체메뉴 — 파일 이름으로 */
      var links = [].slice.call(document.querySelectorAll(
        '.site-header .dropdown a[href], .fullmenu a[href]'));
      var hit = links.filter(function (a) {
        var h = a.getAttribute('href') || '';
        return h.charAt(0) === '/' && fileOf(h) === raw;
      });
      if (!hit.length) {
        hit = links.filter(function (a) {
          var h = a.getAttribute('href') || '';
          return h.charAt(0) === '/' && fileOf(h) === base;
        });
      }
      hit.forEach(function (a) { a.classList.add('active'); });
    } catch (e) {}
  }

  /* ── OC커뮤니티 하위 메뉴 ──
     예전에는 메뉴 열한 줄이 화면마다 복사되어 있었습니다.
     그래서 게시판을 하나 열면 스무 개가 넘는 파일을 모두 고쳐야 했습니다.
     이제 partials/subnav-community.html 한 곳만 고치면 됩니다.

     쓰는 법 — 화면에서 메뉴가 놓일 자리에 이 한 줄만 두시면 됩니다.
       <div id="oc-subnav"></div>

     지금 보고 있는 화면 표시는 주소를 보고 자동으로 붙습니다.
     헤더와 달리 문서 중간에 있으므로 문서가 다 읽힌 뒤에 넣습니다. */
  function markSubnav() {
    var nav = document.querySelector('.pdb-subnav');
    if (!nav) return;

    /* 이름 뽑는 일은 위쪽 도우미(fileOf·baseOf)와 함께 씁니다 —
       같은 규칙을 두 곳에 적으면 한쪽만 고쳐집니다. */
    var rawOf = fileOf;

    /* ★ 두 번에 걸쳐 찾는다.
         ① 주소가 <b>똑같은</b> 메뉴 — 있으면 그것만 켠다
         ② 없으면 줄인 이름으로 다시 찾는다

       왜 이렇게 바꿨나
         예전에는 곧바로 줄여서 견주었다. 커뮤니티는 하위 메뉴에
         글쓰기 항목이 없으니 그것이 맞았다. 그런데 리쿠르트는
         「채용정보」 와 「채용등록」 이 둘 다 메뉴에 있어서,
         job-write 가 job 으로 줄어 <b>두 알약이 함께 켜졌다.</b>
         먼저 똑같은 것을 찾으면 각자 자기 알약만 켜지고,
         메뉴에 없는 화면(job-view)은 그 짝의 목록이 켜진다. */
    var links = [].slice.call(nav.querySelectorAll('a[href]'));
    var raw = rawOf(location.pathname);
    var hit = links.filter(function (a) { return rawOf(a.getAttribute('href')) === raw; });
    if (!hit.length) {
      var base = baseOf(location.pathname);
      hit = links.filter(function (a) { return rawOf(a.getAttribute('href')) === base; });
    }
    links.forEach(function (a) {
      a.classList.toggle('active', hit.indexOf(a) >= 0);
    });
  }

  /* 어느 하위 메뉴를 넣을지는 자리표가 정한다.

       <div id="oc-subnav"></div>                                   → 커뮤니티 (예전 그대로)
       <div id="oc-subnav" data-src="/partials/subnav-spot.html"></div> → 정보SPOT

     data-src 를 적지 않으면 커뮤니티 메뉴를 넣습니다.
     그래서 이미 만들어 둔 커뮤니티 화면들은 한 곳도 고치지 않아도 됩니다. */
  function injectSubnav() {
    var slot = document.getElementById('oc-subnav');
    var url = (slot && slot.getAttribute('data-src')) || '/partials/subnav-community.html';
    inject('oc-subnav', url);
    markSubnav();
    buildSubnavSelect();
    watchWidth();
    needFavButton();
  }

  /* ── 관심분야 단추를 놓기 위해 interests.js 를 <b>스스로</b> 싣습니다 ──
     ★ 왜 이렇게 하나
       처음에는 게시판 화면 <b>69개</b>에 <script src="…interests.js"> 를
       한 줄씩 넣었습니다. 그런데 그것은 —
         · 배포할 파일이 69개가 되어 빠뜨리기 쉽습니다
         · 게시판을 늘릴 때마다 또 넣어야 하고, 잊으면 단추가 안 나옵니다
         · 어느 화면에 들어갔는지 확인하기 어렵습니다

       그래서 이 파일이 <b>필요할 때만</b> 싣습니다. 게시판 화면은
       이미 include.js 를 싣고 있으므로 아무것도 더 하지 않아도 됩니다.

     ★ 필요 없는 화면에서는 싣지 않습니다 — 제목 줄(.pdb-titlebar)이
       없으면 단추를 놓을 자리도 없습니다. */
  function needFavButton() {
    if (!document.querySelector('.pdb-titlebar')) return;
    if (window.OCInterests) { mountFavButton(); return; }
    if (document.getElementById('oc-interests-js')) return;   /* 이미 싣는 중 */
    var sc = document.createElement('script');
    sc.id = 'oc-interests-js';
    sc.src = '/assets/interests.js';
    sc.onload = function () { mountFavButton(); };
    sc.onerror = function () { /* 못 받아도 화면은 그대로 돕니다 */ };
    document.head.appendChild(sc);
  }

  /* ── 관심분야 담기 단추를 놓습니다 ─────────────────────────
     ★ 왜 여기서 놓나
       스물일곱 게시판에 각각 코드를 넣으면, 게시판을 늘릴 때마다
       잊기 쉽습니다. 여기서 <b>주소를 보고</b> 알아서 놓으면
       assets/interests.js 에 한 줄 더하는 것만으로 끝납니다.

     ★ 어디에 놓나 — 제목 줄(.pdb-titlebar) 오른쪽입니다.
       거기가 모든 게시판에 있고, 제목 옆이라 눈에 띕니다.

     ★ interests.js 가 없으면 아무 일도 하지 않습니다 —
       그 파일을 싣지 않은 화면에서 오류가 나면 안 됩니다. */
  function mountFavButton() {
    if (!window.OCInterests) return;
    var bar = document.querySelector('.pdb-titlebar');
    if (!bar || bar.querySelector('.oc-fav-btn')) return;

    /* 지금 화면이 어느 갈래인지 주소로 찾습니다 */
    var path = bare(location.pathname);   /* ★ 언어를 떼고 견줍니다 */
    var cat = null;
    var cats = window.OCInterests.CATS || [];
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].href === path) { cat = cats[i]; break; }
    }
    if (!cat) return;   /* 목록에 없는 화면 — 담을 것이 없습니다 */

    /* 제목 오른쪽에 자리를 만듭니다 */
    var slot = document.createElement('div');
    slot.className = 'pdb-favslot';
    bar.appendChild(slot);
    window.OCInterests.button(slot, cat.big, cat.key);
  }

  /* ── 모바일용 하위 메뉴 풀다운 ─────────────────────────────
     ★ 왜 필요한가 (2026-08-04 · 파트너 요청)
       알약이 여덟 개면 좁은 화면에서 <b>네 줄로 늘어집니다.</b>
       그만큼 본문이 아래로 밀리고, 화면의 절반을 메뉴가 차지합니다.

       그래서 모바일에서는 알약을 감추고 <b>선택 상자 하나</b>로 둡니다.
       고르면 그 화면으로 갑니다. 자리를 한 줄로 줄일 수 있습니다.

     ★ 알약을 지우지 않고 <b>감춥니다.</b>
       데스크톱에서는 알약이 한눈에 보이는 편이 낫습니다. 화면 폭에
       따라 CSS 가 갈라 주므로 자료를 두 번 적을 필요가 없습니다.

     ★ 알약에서 글자와 주소를 그대로 읽어 옵니다.
       메뉴를 늘리거나 이름을 고칠 때 <b>한 곳(partials)만</b> 고치면
       풀다운도 함께 바뀝니다. */
  /* 좁은 화면인가 — CSS 의 860px 과 같게 맞춥니다.
     두 곳에 숫자를 적으면 한쪽만 고쳐지므로, 여기 하나를 기준으로 둡니다. */
  var NARROW = 860;
  function isNarrow() {
    return (window.innerWidth || document.documentElement.clientWidth || 0) <= NARROW;
  }

  /* ★ 창 크기가 바뀌면 다시 판단합니다.
     PC 에서 창을 좁히면 풀다운이 생기고, 넓히면 없어집니다.
     (개발자 도구로 모바일을 흉내낼 때도 자연스럽게 됩니다) */
  var _rz = null;
  function watchWidth() {
    if (window.__ocSubnavWatch) return;
    window.__ocSubnavWatch = true;
    window.addEventListener('resize', function () {
      if (_rz) return;
      _rz = setTimeout(function () {
        _rz = null;
        var wrap = document.querySelector('.pdb-subnav-sel');
        if (isNarrow()) {
          if (!wrap) buildSubnavSelect();
        } else if (wrap) {
          wrap.remove();
        }
      }, 180);
    });
  }

  function buildSubnavSelect() {
    var nav = document.querySelector('.pdb-subnav');
    if (!nav) return;
    if (nav.parentNode.querySelector('.pdb-subnav-sel')) return;   /* 두 번 만들지 않습니다 */

    /* ★ <b>글쓰기·등록 화면에는 놓지 않습니다.</b>
       (2026-08-04 · 파트너 지적)

       그 화면은 <b>지금 하는 일을 마치는 곳</b>입니다. 갈래를 옮길
       이유가 없고, 옮기면 쓰던 것이 사라집니다. 그런데 제목 위에
       풀다운이 놓이니 「고르라는 것인가?」 싶어 헷갈립니다.

       ★ 알약은 그대로 둡니다 — 데스크톱에서 「지금 어디에 있나」 를
         보여 주는 몫을 합니다. 풀다운만 놓지 않습니다. */
    var f = fileOf(location.pathname);
    /* ★ 2026-08-14 · <b>정보SPOT 글쓰기 일곱 화면이 새어 나왔습니다</b> (파트너 지적)
         이름 규칙이 두 가지입니다 —
           news-write · qna-write …        (write 가 <b>뒤</b>)
           spot-write-concert · -festival … (write 가 <b>가운데</b>)
         앞의 규칙만 보고 있어서 정보SPOT 일곱 화면에 풀다운이 그대로
         놓였습니다. 이제 <b>write 가 이름 어디에 있어도</b> 잡습니다. */
    if (/(^|-)write(-|$)/.test(f)) return;

    /* ★ <b>넓은 화면에서는 아예 만들지 않습니다.</b>
       (2026-08-04 · 파트너 지적)

       PC 에는 알약이 다 보이고 위에 GNB 도 있으므로 풀다운이 있을
       이유가 없습니다. CSS 로 숨기게 두었는데, 그 CSS 가 아직 안
       올라간 화면에서는 <b>그대로 보였습니다.</b>

       CSS 하나에만 기대면 그것이 안 실렸을 때 드러납니다.
       그래서 <b>만들지 않는 편</b>이 확실합니다.

     ★ 창 크기를 바꾸면 다시 판단합니다 — 아래에서 지켜봅니다. */
    if (!isNarrow()) return;

    var links = [].slice.call(nav.querySelectorAll('a[href]'));
    if (links.length < 3) return;   /* 두어 개면 알약이 낫습니다 */

    var wrap = document.createElement('div');
    wrap.className = 'pdb-subnav-sel';

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', '구분 고르기');

    links.forEach(function (a) {
      var op = document.createElement('option');
      op.value = a.getAttribute('href') || '#';
      op.textContent = (a.textContent || '').trim();
      if (a.classList.contains('active')) op.selected = true;
      sel.appendChild(op);
    });

    /* 지금 화면이 메뉴에 없으면(글쓰기·상세 등) 맨 앞에 알림을 둡니다 —
       아무것도 골라지지 않은 것처럼 보이면 헷갈립니다. */
    if (!nav.querySelector('a.active')) {
      var op0 = document.createElement('option');
      op0.value = '';
      op0.textContent = '구분 고르기';
      op0.selected = true;
      sel.insertBefore(op0, sel.firstChild);
    }

    sel.addEventListener('change', function () {
      if (!sel.value) return;
      /* ★ 2026-08-14 · <b>말이 풀리던 것</b>을 고쳤습니다 (파트너 지적)
           영문·일문 화면에서 이 고르개로 옮기면 한국어로 돌아왔습니다.
           주소가 `/db/person.html` 처럼 <b>언어 없는 경로</b>였기 때문입니다
           (링크 <a href> 는 assets/i18n.js 가 알아서 붙여 주는데,
            고르개의 option 값은 그 손이 닿지 않습니다).
         ▶ 옮기기 직전에 i18n 에게 물어 `/ja/db/person.html` 로 바꿉니다.
           한국어에서는 그대로 돌려주므로 조건을 나눌 필요가 없습니다.
           이미 언어가 붙어 있어도 두 번 붙지 않습니다. */
      var to = sel.value;
      try {
        if (window.OCI18N && typeof OCI18N.url === 'function') to = OCI18N.url(to);
      } catch (e) {}
      location.href = to;
    });

    wrap.appendChild(sel);
    nav.parentNode.insertBefore(wrap, nav.nextSibling);
  }

  /* ── 회원 헤더에 드롭다운·전체메뉴 붙이기 (2026-08-06) ────────
     ★ 무엇이 잘못됐었나 (파트너 지적)
       회원 화면(마이페이지 등 18개)은 partials/header-auth.html 을
       씁니다. 그 헤더에는
         · 위 메뉴에 마우스를 올려도 나오는 <b>하위 메뉴가 없었고</b>
         · ≡ 를 눌러도 <b>아무 일이 없었습니다</b>
       그래서 좁은 화면에서는 다른 섹션으로 나갈 길이 아예 막혔고,
       넓은 화면에서도 다른 화면과 결이 달랐습니다.

     ★ 메뉴 목록을 <b>옮겨 적지 않습니다</b>
       partials/header.html 을 한 번 더 읽어 그 안의 드롭다운과
       전체메뉴를 <b>가져와 붙입니다</b>. 목록을 두 벌로 두면 메뉴를
       늘릴 때 반드시 한쪽을 빠뜨립니다 — 오늘 레슨:ON 링크가 회원
       헤더에만 빠져 있던 것이 바로 그 일이었습니다.
       ▶ 앞으로 메뉴는 <b>header.html 한 곳만</b> 고치면 됩니다.

     ★ 짜임(CSS)은 header-auth.html 안에 있습니다 — 회원 화면은
       style.css 를 싣지 않기 때문입니다.

     ★ 본 헤더를 쓰는 화면에서는 <b>조용히 지납니다</b> —
       .gnb 가 없으면 아무것도 하지 않습니다. */
  function authMenu() {
    /* ★ <b>한 번만</b> — 창 단위로 표시를 둡니다.
       .gnb 에 표시하는 것만으로는 헤더가 다시 끼워지면 풀립니다.
       전체메뉴가 두 벌 붙으면 같은 id 가 둘이 되어 여는 손잡이가
       엉뚱한 쪽에 걸립니다. */
    if (window.__ocAuthMenu) return;
    var gnb = document.querySelector('.gnb');
    if (!gnb) return;                            /* 본 헤더 화면 */
    window.__ocAuthMenu = true;
    gnb.setAttribute('data-ga', '1');

    /* ① 본 헤더를 받아 읽습니다 (동기 — 헤더가 이미 화면에 있어야 하므로) */
    var doc = null;
    try {
      var x = new XMLHttpRequest();
      /* ★ 여기도 판 번호를 붙입니다 — 회원 화면은 본 헤더를 읽어
           메뉴를 만듭니다. 붙이지 않으면 <b>회원 화면만</b> 옛 메뉴가
           남습니다(2026-08-18). */
      x.open('GET', withVer('/partials/header.html'), false);
      x.send();
      doc = new DOMParser().parseFromString(x.responseText, 'text/html');
    } catch (e) {
      if (window.console) console.warn('[header-auth] 본 헤더를 읽지 못했습니다', e);
      return;                                    /* 못 읽어도 헤더는 그대로 돕니다 */
    }
    if (!doc) return;

    /* ② 하위 메뉴 이식 — 위 메뉴의 <a> 를 상자로 감싸고 그 안에 넣습니다
       ★ 주소로 짝을 맞춥니다 — 글자로 맞추면 「레슨 : ON」 처럼 사이가
         띈 이름에서 어긋납니다. */
    var nav = gnb.querySelector('nav.nav');
    if (nav) {
      var dd = {};
      [].forEach.call(doc.querySelectorAll('nav.main > .nav-item'), function (it) {
        var a = null;
        for (var i = 0; i < it.children.length; i++) {
          if (it.children[i].tagName === 'A') { a = it.children[i]; break; }
        }
        var d = it.querySelector('.dropdown');
        /* ★ 2026-08-13 · 본 헤더의 이름표(nav-item--shop 등)를 함께 나릅니다.
             회원 헤더도 대메뉴마다 하위 메뉴 자리를 달리 잡아야 하는데,
             무슨 메뉴인지 알 길이 없었습니다. */
        if (a && d) dd[a.getAttribute('href') || ''] = { el: d, cls: (String(it.className).match(/nav-item--[a-z]+/) || [''])[0] };
      });

      [].slice.call(nav.children).forEach(function (a) {
        if (a.tagName !== 'A') return;
        var box = document.createElement('div');
        box.className = 'ga-item';
        nav.replaceChild(box, a);
        box.appendChild(a);
        var d = dd[a.getAttribute('href') || ''];
        if (d) {
          if (d.cls) box.className += ' ga-item--' + d.cls.replace('nav-item--', '');
          box.appendChild(document.importNode(d.el, true));
        }
      });
    }

    /* ★ 전체메뉴(≡)는 <b>여기서 만들지 않습니다.</b>
       assets/auth.js 가 이미 같은 일을 하고 있습니다 —
       partials/header.html 의 #fullMenu 를 가져와 붙이고, 처음 열 때
       style.css 까지 <b>auth.css 앞에</b> 끼워 넣습니다(그 순서라야
       회원 화면 꾸밈이 흐트러지지 않습니다).
       여기서 또 만들면 같은 id 가 둘이 되어 여는 손잡이가 엉뚱한 쪽에
       걸립니다 — 실제로 그렇게 되어 있던 것을 고쳤습니다(2026-08-06).
       ▶ 이 함수가 맡는 것은 <b>하위 메뉴(드롭다운)뿐</b>입니다.
         그것만 회원 헤더에 없던 기능입니다. */

    /* ④ 지금 보고 있는 곳 표시 — 위 큰 메뉴와 같은 규칙(폴더·파일 이름) */
    markAuthMenu();
  }

  /* 회원 헤더에서 지금 보고 있는 곳 표시
     ★ markActiveMenu() 는 .site-header 안을 봅니다 — 회원 헤더는
       .gnb 라 걸리지 않습니다. 규칙(폴더·파일 이름)은 같게 둡니다. */
  function markAuthMenu() {
    try {
      var p = location.pathname;
      var raw = fileOf(p), base = baseOf(p), dir = dirOf(p);

      /* 위 큰 메뉴 — 폴더로 */
      [].forEach.call(document.querySelectorAll('.gnb nav.nav > .ga-item > a[href]'), function (a) {
        var h = a.getAttribute('href') || '';
        if (h.charAt(0) !== '/') return;
        if (dir !== '/' && dirOf(h) === dir) a.classList.add('active');
      });

      /* 하위 메뉴·전체메뉴 — 파일 이름으로 */
      var links = [].slice.call(document.querySelectorAll(
        '.gnb .dropdown a[href], .fullmenu a[href]'));
      var hit = links.filter(function (a) {
        var h = a.getAttribute('href') || '';
        return h.charAt(0) === '/' && fileOf(h) === raw;
      });
      if (!hit.length) {
        hit = links.filter(function (a) {
          var h = a.getAttribute('href') || '';
          return h.charAt(0) === '/' && fileOf(h) === base;
        });
      }
      hit.forEach(function (a) { a.classList.add('active'); });
    } catch (e) {}
  }

  // 헤더만 담당(동기 주입). 푸터는 app.js가 그린다.
  // 페이지는 oc-header / oc-header-auth 중 하나의 자리만 가진다.
  inject('oc-header', '/partials/header.html');            // db·home 등 메인 헤더
  inject('oc-header-auth', '/partials/header-auth.html');  // 회원 페이지 단순 헤더
  markActiveMenu();
  authMenu();   /* 회원 헤더의 ≡ — 본 헤더 화면에서는 조용히 지납니다 */

  /* 하위 메뉴는 문서 중간에 있으므로 문서가 다 읽힌 뒤에 넣는다.
     이미 다 읽혔으면 곧바로 넣는다. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSubnav);
  } else {
    injectSubnav();
  }

  /* ── 맨 아래 큰 광고 두 자리 (C·D) ─────────────────────────
     ★ 2026-08-15 · 화면 42곳에 복붙돼 있던 것을 partials/bigban.html
       한 곳으로 모았습니다 (파트너 요청).
       광고주가 바뀔 때마다 42곳을 함께 고쳐야 했고, 한 번은 38곳을
       빠뜨려 화면마다 다른 광고가 나온 적이 있습니다.

     ★ 하위 메뉴와 마찬가지로 <b>문서를 다 읽은 뒤</b>에 넣습니다 —
       광고 자리는 본문 아래에 있어, 문서를 읽는 중에는 아직 그 자리가
       없습니다.

     ★ 넣은 <b>다음에</b> 회전 엔진을 깨웁니다.
       ad-rotate.js 는 문서를 읽자마자 .ad-rot 을 찾는데, 그때는 광고가
       아직 붙기 전이라 하나도 못 찾습니다. 붙인 뒤에 다시 부르지 않으면
       <b>광고가 돌지 않고 첫 장에서 멈춥니다.</b> */
  function injectBigban() {
    if (!document.getElementById('oc-bigban')) return;
    inject('oc-bigban', '/partials/bigban.html');
    loadAdRotate();
  }

  /* ── 광고 회전 엔진 싣기 ─────────────────────────────────
     ★★ 2026-08-15 · <b>광고가 돌지 않고 있었습니다</b> ★★
       C·D 마크업은 42개 화면에 들어 있었는데, assets/ad-rotate.js 를
       부르는 화면은 <b>home.html 단 하나</b>였습니다.
       나머지 41곳은 엔진이 없어 <b>첫 장에서 멈춰</b> 있었습니다.
       광고주가 둘인데 늘 같은 쪽만 보이고 있었던 셈입니다.

     ★ 왜 여기서 싣나
       화면마다 <script> 를 한 줄씩 넣으면 또 42곳을 손대야 하고,
       새 화면이 생길 때마다 빠뜨리게 됩니다. tabbar.js 와 같은
       방식으로 <b>이 파일이 대신 싣습니다</b>.

     ★ 이미 실려 있어도 안전합니다
       home.html 처럼 직접 부르는 화면에서는 두 번 실리지 않도록
       표시를 남기고, ad-rotate.js 쪽도 같은 상자를 두 번 맡지 않게
       고쳐 두었습니다(data-oc-rot). */
  function loadAdRotate() {
    /* 이미 실려 돌고 있으면 새로 붙은 광고만 맡기면 됩니다 */
    if (window.OCAdRotate && window.OCAdRotate.run) { window.OCAdRotate.run(); return; }
    if (window.__ocAdJs) return;
    window.__ocAdJs = true;
    var s = document.createElement('script');
    s.src = '/assets/ad-rotate.js';
    /* 다 실리면 곧바로 한 번 돌립니다 — 스스로도 돌지만, 문서를 이미
       다 읽은 뒤라 DOMContentLoaded 를 놓칠 수 있습니다. */
    s.onload = function () {
      try { if (window.OCAdRotate && window.OCAdRotate.run) window.OCAdRotate.run(); } catch (e) {}
    };
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBigban);
  } else {
    injectBigban();
  }

})();

/* ══ 하위 메뉴 자리 맞추기 — 2026-08-13 ═══════════════════════════
   ★ 무엇을 하나
     대메뉴 글자 아래에 정해 둔 항목이 오도록 하위 메뉴 줄을 좌우로 옮깁니다.
       OC커뮤니티 → 지식나눔 / 정보SPOT → 지원금 / 리쿠르트 → 인재정보 /
       SHOPPING → LIFEPOP
     맞출 항목은 partials/header.html 의 data-dd-align 표시로 정합니다.
     (표시가 없는 메뉴는 손대지 않습니다 — DATABASE 는 왼쪽 정렬입니다)

   ★ 왜 CSS 숫자로는 안 되나
     · 로그인하면 오른쪽이 넓어져 대메뉴가 밀립니다
     · 언어를 바꾸면 항목 글자 길이가 달라져 줄 폭이 바뀝니다
     · 화면 폭·글꼴 로딩에 따라도 달라집니다
     값을 서른 개 넘게 두어야 하고 그래도 어긋납니다.
   ▶ <b>마우스를 올리는 그 순간에 재서</b> 옮깁니다. 한 곳이면 끝납니다.

   ★ 물러나는 경우 — 억지로 맞추면 더 나빠지는 자리입니다
     · 좁은 화면(880px 아래) — 세로로 쌓입니다
     · 항목이 <b>여러 줄로 감긴</b> 경우 — 가운데 정렬로 되돌립니다
   ★ 넘치지 않게 — 옮긴 뒤 첫 항목이 왼쪽, 끝 항목이 오른쪽으로 화면을
     벗어나면 들어오는 만큼만 옮깁니다.
   ★ 두 헤더를 함께 봅니다 — 본 헤더(.nav-item) · 회원 헤더(.ga-item)
   ══════════════════════════════════════════════════════════════ */
(function () {
  if (window.__ocDdAlign) return;
  window.__ocDdAlign = true;
  var EDGE = 8;   /* 화면 가장자리에 남길 여백 */

  function align(item) {
    var inner = item.querySelector('.dropdown-inner');
    if (!inner) return;
    var target = inner.querySelector('[data-dd-align]');
    var top = null, i;
    for (i = 0; i < item.children.length; i++) {
      if (item.children[i].tagName === 'A') { top = item.children[i]; break; }
    }
    if (!target || !top) return;

    /* 좁은 화면은 그대로 둡니다 */
    if (window.innerWidth <= 880) { inner.style.transform = ''; return; }

    /* ★ 2026-08-14 · <b>한국어가 아닐 때는 맞추지 않습니다</b> (파트너 지적 —
         영문·일문에서 정보SPOT 하위 목록이 엉뚱한 곳에 열렸습니다)
       ─────────────────────────────────────────────────────────────
       영문은 항목 글자가 길어 다섯 개가 한 줄에 들어가지 않고 <b>두 줄로
       감깁니다.</b> 두 줄이 된 목록을 특정 항목 기준으로 옮기면 목록 전체가
       한쪽으로 쏠립니다. 아래 「여러 줄이면 물러나기」가 있지만, 목록이
       열리기 전에 재면 줄 수를 알 수 없어 걸리지 않는 경우가 있었습니다.
     ▶ 다른 말에서는 <b>화면 가운데 정렬</b>로 둡니다(assets/i18n.js 가
       --dd-nudge 도 0 으로 맞춥니다). 언어마다 자리를 다시 재는 것은
       끝이 없습니다. */
    if ((document.documentElement.getAttribute('data-oc-lang') || 'ko') !== 'ko') {
      inner.style.transform = '';
      return;
    }

    var kids = [], c = inner.children;
    for (i = 0; i < c.length; i++) if (c[i].tagName === 'A') kids.push(c[i]);
    if (!kids.length) return;

    /* 재는 동안에는 옮기지 않은 상태로 둡니다 */
    inner.style.transform = 'none';

    var t = top.getBoundingClientRect();
    var g = target.getBoundingClientRect();
    /* 아직 자리를 잡지 않았으면(폭 0) 재지 않습니다 — 그대로 재면
       0 을 기준으로 옮겨 목록이 화면 밖으로 튑니다 */
    if (!g.width || !t.width) { inner.style.transform = ''; return; }
    var f = kids[0].getBoundingClientRect();
    var l = kids[kids.length - 1].getBoundingClientRect();

    /* 여러 줄로 감기면 물러납니다
       ★ offsetTop 을 견주지 않습니다 — 한 줄에 있어도 글자에 따라 높이가
         달라(한글·라틴 섞임) 2px 씩 어긋납니다. 실제로 <b>아랫줄로
         내려간</b> 것만 잡습니다. */
    for (i = 0; i < kids.length; i++) {
      if (kids[i].getBoundingClientRect().top >= f.bottom - 2) {
        inner.style.transform = '';
        return;
      }
    }

    /* 옮길 양 — 오른쪽(+) / 왼쪽(-) */
    var move = (t.left + t.width / 2) - (g.left + g.width / 2);

    /* 화면을 벗어나지 않는 범위로 자릅니다 */
    var maxRight = (window.innerWidth - EDGE) - l.right;   /* 오른쪽 여유 */
    var maxLeft = f.left - EDGE;                           /* 왼쪽 여유 */
    if (move > maxRight) move = maxRight;
    if (move < -maxLeft) move = -maxLeft;

    inner.style.transform = move ? 'translateX(' + Math.round(move) + 'px)' : 'none';
  }

  var SEL = '.site-header .nav-item, .gnb .ga-item';

  /* 마우스를 올리거나 키보드로 들어올 때 그 메뉴만 잽니다 */
  function onEnter(e) {
    var el = e.target;
    if (!el || !el.closest) return;
    var item = el.closest(SEL);
    if (item) align(item);
  }
  document.addEventListener('mouseover', onEnter, true);
  document.addEventListener('focusin', onEnter, true);

  /* 창 크기가 바뀌면 옮긴 것을 지웁니다 — 다음에 올릴 때 다시 잽니다 */
  window.addEventListener('resize', function () {
    var all = document.querySelectorAll(SEL + ' .dropdown-inner');
    for (var i = 0; i < all.length; i++) all[i].style.transform = '';
  });
})();

/* ============================================================
   공용 고르개(풀다운) 엔진 싣기 — 2026-08-13
   ────────────────────────────────────────────────────────────
   ★ 왜 여기서 싣나
     화면 126개가 이 파일을 이미 부릅니다. 화면마다 <script> 를 한 줄씩
     넣으면 쉰 곳을 고쳐야 하고, 새 화면을 만들 때 반드시 빠뜨립니다.
     여기 한 줄이면 모두 따라옵니다.

   ★ 두 번 싣지 않습니다.
   ★ defer 처럼 뒤로 미룹니다 — 목록·분류 고르개는 화면이 다 그려진
     뒤에 채워지는 것이 많고, select.js 는 스스로 지켜보다 다시 그립니다.
   ============================================================ */
(function () {
  if (window.__ocSelectJs) return;
  window.__ocSelectJs = true;
  var s = document.createElement('script');
  s.src = '/assets/select.js';
  s.defer = true;
  document.head.appendChild(s);
})();

/* 모바일 아래 고정 메뉴 싣기 — 2026-08-13
   ★ 같은 까닭입니다 — 화면 126개가 이 파일을 이미 부릅니다. */
(function () {
  if (window.__ocTabJs) return;
  window.__ocTabJs = true;
  var s = document.createElement('script');
  s.src = '/assets/tabbar.js';
  s.defer = true;
  document.head.appendChild(s);
})();

/* 광고 자리 돌리개 싣기 — 2026-08-14
   ★ 한 자리에 광고가 둘 이상이면 번갈아 보여 줍니다.
     광고 회전이 없는 화면에서는 스스로 아무 일도 하지 않습니다
     (.ad-rot 를 못 찾으면 곧바로 끝냅니다).
   ★ 앞으로 C·D 배너(모든 화면 아래)에도 광고가 여럿 들어오면
     마크업만 .ad-rot 로 감싸면 됩니다 — 화면을 고칠 일이 없습니다. */
(function () {
  if (window.__ocAdRotJs) return;
  window.__ocAdRotJs = true;
  var s = document.createElement('script');
  s.src = '/assets/ad-rotate.js';
  s.defer = true;
  document.head.appendChild(s);
})();
