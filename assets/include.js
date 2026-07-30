/* OPUSCLAM 공통 헤더 로더
   - 각 페이지의 <div id="oc-header"></div>(메인) 또는 <div id="oc-header-auth"></div>(회원)
     자리에 partials/header.html · partials/header-auth.html 를 채워 넣는다.
   - 헤더는 "동기"로 즉시 넣는다: 뒤의 헤더 동작 스크립트(햄버거·테마·스티키)보다 먼저 DOM에 들어가야 함.
   - 푸터는 이 파일이 담당하지 않는다(app.js 가 #oc-footer 자리에 그린다).
   - 사용법: 헤더 자리표 바로 아래에 <script src="/assets/include.js"></script> 한 줄. */
(function () {
  function inject(id, url) {
    var slot = document.getElementById(id);
    if (!slot) return;
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url, false); // false = 동기
      x.send();
      slot.insertAdjacentHTML('afterend', x.responseText);
      slot.remove();
    } catch (e) {
      if (window.console) console.warn('[include] 실패:', id, e);
    }
  }

  function markActiveMenu() {
    try {
      var p = location.pathname;
      var links = document.querySelectorAll('.site-header a[href], .fullmenu a[href]');
      links.forEach(function (a) {
        var h = a.getAttribute('href');
        if (h && h.length > 1 && h.charAt(0) === '/' && p.indexOf(h) > -1) {
          a.classList.add('active');
        }
      });
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
    /* 주소에서 화면 이름을 뽑는다 — 목록·상세·글쓰기를 같은 메뉴로 본다 */
    function nameOf(path) {
      var f = String(path || '').split('?')[0].split('/').pop() || 'index.html';
      f = f.replace(/-view\.html$|-write\.html$|\.html$/, '');
      if (!f) f = 'index';
      /* 입시요강과 입시커뮤니티는 「입시」 하나로 묶는다 */
      if (f === 'admission-community') f = 'admission';
      /* 정보SPOT — 상세·글쓰기 화면(spot-view·spot-write)은 「전체」로 둔다 */
      if (f === 'spot-view' || f === 'spot-write') f = 'index';
      return f;
    }
    var cur = nameOf(location.pathname);
    nav.querySelectorAll('a[href]').forEach(function (a) {
      a.classList.toggle('active', nameOf(a.getAttribute('href')) === cur);
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
  }

  // 헤더만 담당(동기 주입). 푸터는 app.js가 그린다.
  // 페이지는 oc-header / oc-header-auth 중 하나의 자리만 가진다.
  inject('oc-header', '/partials/header.html');            // db·home 등 메인 헤더
  inject('oc-header-auth', '/partials/header-auth.html');  // 회원 페이지 단순 헤더
  markActiveMenu();

  /* 하위 메뉴는 문서 중간에 있으므로 문서가 다 읽힌 뒤에 넣는다.
     이미 다 읽혔으면 곧바로 넣는다. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSubnav);
  } else {
    injectSubnav();
  }

})();
