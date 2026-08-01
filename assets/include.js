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

  /* ── 주소에서 이름 뽑기 (GNB·하위 메뉴가 함께 씁니다) ────────
     한 곳에 두어야 두 메뉴가 같은 규칙으로 켜집니다. */

  /* 파일 이름 그대로 — job-write.html → job-write */
  function fileOf(path) {
    var f = String(path || '').split('#')[0].split('?')[0].split('/').pop() || 'index.html';
    return f.replace(/\.html$/, '') || 'index';
  }

  /* 줄인 이름 — 상세·글쓰기를 그 짝의 목록으로 봅니다 */
  function baseOf(path) {
    var raw = fileOf(path);
    /* 정보SPOT 상세·글쓰기는 「전체」로 둡니다.
       ★ 줄이기 전에 봐야 합니다 — 줄인 뒤에는 spot 이 되어
         이 조건이 영영 걸리지 않습니다(예전엔 죽은 줄이었습니다). */
    if (raw === 'spot-view' || raw === 'spot-write') return 'index';
    var f = raw.replace(/-view$|-write$/, '') || 'index';
    /* 입시요강과 입시커뮤니티는 「입시」 하나로 묶습니다 */
    if (f === 'admission-community') f = 'admission';
    return f;
  }

  /* 폴더 — /recruit/job.html → /recruit/ */
  function dirOf(path) {
    var q = String(path || '').split('#')[0].split('?')[0];
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
