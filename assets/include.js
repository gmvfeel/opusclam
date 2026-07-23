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

  // 헤더만 담당(동기 주입). 푸터는 app.js가 그린다.
  // 페이지는 oc-header / oc-header-auth 중 하나의 자리만 가진다.
  inject('oc-header', '/partials/header.html');            // db·home 등 메인 헤더
  inject('oc-header-auth', '/partials/header-auth.html');  // 회원 페이지 단순 헤더
  markActiveMenu();

})();
