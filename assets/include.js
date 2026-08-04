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
    buildSubnavSelect();
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
  function buildSubnavSelect() {
    var nav = document.querySelector('.pdb-subnav');
    if (!nav) return;
    if (nav.parentNode.querySelector('.pdb-subnav-sel')) return;   /* 두 번 만들지 않습니다 */

    var links = [].slice.call(nav.querySelectorAll('a[href]'));
    if (links.length < 3) return;   /* 두어 개면 알약이 낫습니다 */

    var wrap = document.createElement('div');
    wrap.className = 'pdb-subnav-sel';

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', '갈래 고르기');

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
      op0.textContent = '갈래 고르기';
      op0.selected = true;
      sel.insertBefore(op0, sel.firstChild);
    }

    sel.addEventListener('change', function () {
      if (sel.value) location.href = sel.value;
    });

    wrap.appendChild(sel);
    nav.parentNode.insertBefore(wrap, nav.nextSibling);
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
