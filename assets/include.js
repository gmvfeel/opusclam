/* OPUSCLAM 공통 불러오기 로더
   - 각 페이지의 <div id="oc-header"></div> / <div id="oc-footer"></div> 자리에
     partials/header.html · partials/footer.html 를 채워 넣는다.
   - 헤더는 "동기"로 즉시 넣는다: 뒤에 오는 헤더 동작 스크립트(햄버거·전체메뉴·테마·스티키)가
     헤더 마크업을 찾을 수 있도록, 그 스크립트보다 먼저 DOM에 들어가야 하기 때문.
   - 사용법: 각 페이지에서 <div id="oc-header"></div> 바로 아래에
     <script src="/assets/include.js"></script> 한 줄만 넣으면 된다. */
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

  // 헤더: 지금 즉시(동기)
  inject('oc-header', '/partials/header.html');
  markActiveMenu();

  // 푸터: 자리표가 페이지 하단에 있으므로, 문서가 다 그려진 뒤에 넣는다
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      inject('oc-footer', '/partials/footer.html');
    });
  } else {
    inject('oc-footer', '/partials/footer.html');
  }
})();
