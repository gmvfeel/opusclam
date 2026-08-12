/* ============================================================
   OPUSCLAM 영상 크게 보기 — assets/video-lightbox.js
   ------------------------------------------------------------
   표지를 누르면 <b>화면을 가득 덮는 큰 창</b>으로 영상을 재생합니다.

   ★ 어디서 왔나
     레슨:ON 마스터클래스에 있던 것을 <b>공용 부품으로 뽑았습니다</b>
     (assets/lesson-list.js · 2026-08-12).
     짜임(CSS)과 움직임을 <b>그대로</b> 옮겼습니다 — 마스터클래스와
     같은 모습이어야 파트너가 요청하신 「그처럼」이 되기 때문입니다.

   ★ 왜 뽑았나 (파트너 요청)
     음원·동영상 뷰페이지의 재생 단추는 <b>그 자리에서</b> 작게
     재생됐습니다. 마스터클래스처럼 크게 보이길 원하셨습니다.
     board.js 에 같은 코드를 새로 쓰면 <b>두 벌</b>이 됩니다 —
     오늘 리스트 탭에서 그 때문에 한쪽만 고쳐진 일을 겪었습니다.

   ★ 왜 CSS 를 파일이 아니라 여기서 넣나
     레슨:ON 에서 그렇게 하고 있었고, 그 까닭이 적혀 있었습니다 —
     「공용 CSS 파일에 손대면 다른 화면이 조용히 망가질 수 있다」.
     이 부품을 부르는 화면에만 짜임이 들어갑니다.

   쓰는 법
     <script src="/assets/video-lightbox.js"></script>

     ① 표지 단추에 표시를 붙여 두면 저절로 걸립니다
        <button data-lb="1" data-p="youtube" data-i="영상아이디"
                data-t="제목" data-c="채널" data-u="원본주소"> … </button>
        ocVideoLB.bind(root)   ← 나중에 그린 것에도 걸 때

     ② 직접 열 때
        ocVideoLB.open({ p:'youtube', i:'영상아이디', t:'제목' })

   ★ 닫을 때 틀(iframe)을 지웁니다 — 남겨 두면 소리가 계속 납니다.
   ★ ESC · 바탕 누르기 · 닫기 단추 셋 다로 닫힙니다.
   ============================================================ */

(function () {
  if (window.ocVideoLB) return;          /* 두 번 실려도 한 번만 */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 영상 주소 만들기 — 유튜브·비메오
     ★ youtube-nocookie 를 씁니다 (레슨:ON 과 같게) */
  function srcOf(provider, id, autoplay) {
    var p = String(provider || 'youtube').toLowerCase();
    if (!id) return '';
    if (p === 'none') return '';
    if (p === 'youtube' || p === 'yt') {
      return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id)
           + '?rel=0&modestbranding=1&playsinline=1' + (autoplay ? '&autoplay=1' : '');
    }
    if (p === 'vimeo') {
      return 'https://player.vimeo.com/video/' + encodeURIComponent(id)
           + (autoplay ? '?autoplay=1' : '');
    }
    return '';
  }

  /* ★ 짜임은 한 번만 넣습니다.
       레슨:ON 이 이미 넣어 두었으면(window.__ocLbCss) 다시 넣지 않습니다 —
       같은 이름의 규칙이 두 벌 들어가는 것을 막습니다. */
  function styleOnce() {
    if (window.__ocLbCss) return;
    window.__ocLbCss = true;
    var css = ''
      + '.oc-lb{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;'
      +   'justify-content:center;padding:22px;background:rgba(6,6,10,.94);'
      +   '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'
      +   'opacity:0;transition:opacity .2s ease;}'
      + '.oc-lb.on{opacity:1;}'
      + '.oc-lb-in{width:min(1400px,94vw);'
      +   'max-width:calc((100vh - 160px) * 1.7778);'
      +   'transform:scale(.96);transition:transform .22s ease;}'
      + '@supports (height:100dvh){.oc-lb-in{max-width:calc((100dvh - 160px) * 1.7778);}}'
      + '.oc-lb.on .oc-lb-in{transform:scale(1);}'
      + '.oc-lb-frame{width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;'
      +   'overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6);}'
      + '.oc-lb-frame iframe{width:100%;height:100%;border:0;display:block;}'
      + '.oc-lb-cap{margin-top:14px;color:#d6d2e2;font-size:14px;line-height:1.6;}'
      + '.oc-lb-cap b{color:#fff;font-weight:600;}'
      + '.oc-lb-cap a{color:#c4a9e6;}'
      + '.oc-lb-x{position:absolute;top:16px;right:18px;width:44px;height:44px;'
      +   'border:0;border-radius:50%;background:rgba(255,255,255,.10);color:#fff;'
      +   'font-size:20px;line-height:1;cursor:pointer;}'
      + '.oc-lb-x:hover{background:rgba(255,255,255,.20);}'
      + '@media (max-width:760px){.oc-lb{padding:12px;}'
      +   '.oc-lb-in{width:100%;max-width:none;}.oc-lb-x{top:8px;right:10px;}}';
    var s = document.createElement('style');
    s.setAttribute('data-oc', 'lightbox');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function open(d) {
    styleOnce();
    var src = srcOf(d.p, d.i, true);
    if (!src) return;

    var lb = document.createElement('div');
    lb.className = 'oc-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
        '<button type="button" class="oc-lb-x" aria-label="닫기">&#10005;</button>'
      + '<div class="oc-lb-in">'
      +   '<div class="oc-lb-frame"><iframe src="' + esc(src) + '" title="' + esc(d.t || '영상') + '"'
      +     ' allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"'
      +     ' referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'
      +   '<div class="oc-lb-cap"><b>' + esc(d.t || '') + '</b>'
      +     (d.c ? ' · ' + esc(d.c) : '')
      +     (d.u ? ' · <a href="' + esc(d.u) + '" target="_blank" rel="noopener">원본 보기 &#8599;</a>' : '')
      +   '</div>'
      + '</div>';

    /* 뒤 화면이 따라 움직이지 않게 잠급니다 — 자리는 기억해 둡니다 */
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var prevOv = document.body.style.overflow;
    document.body.appendChild(lb);
    document.body.style.overflow = 'hidden';
    setTimeout(function () { lb.classList.add('on'); }, 10);

    function close() {
      document.removeEventListener('keydown', onKey);
      lb.classList.remove('on');
      /* ★ 틀을 먼저 지워야 소리가 곧바로 멈춥니다 */
      var f = lb.querySelector('iframe'); if (f) f.setAttribute('src', '');
      setTimeout(function () {
        if (lb.parentNode) lb.parentNode.removeChild(lb);
        document.body.style.overflow = prevOv || '';
        window.scrollTo(0, y);
      }, 200);
    }
    function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) close(); }

    lb.querySelector('.oc-lb-x').addEventListener('click', close);
    lb.addEventListener('click', function (e) {
      /* 바탕을 누르면 닫습니다 — 안쪽(영상·설명)은 그대로 둡니다 */
      if (!e.target.closest('.oc-lb-in')) close();
    });
    document.addEventListener('keydown', onKey);
    setTimeout(function () { lb.querySelector('.oc-lb-x').focus(); }, 240);
  }

  /* 표지 단추에 손잡이 걸기 — 그린 뒤에 부릅니다 */
  function bind(root) {
    root = root || document;
    styleOnce();
    var list = root.querySelectorAll('[data-lb="1"]');
    Array.prototype.forEach.call(list, function (b) {
      if (b.__ocLb) return; b.__ocLb = true;
      b.addEventListener('click', function () {
        open({
          p: b.getAttribute('data-p') || 'youtube',
          i: b.getAttribute('data-i') || b.getAttribute('data-video'),
          t: b.getAttribute('data-t'), c: b.getAttribute('data-c'),
          u: b.getAttribute('data-u')
        });
      });
    });
  }

  window.ocVideoLB = { open: open, bind: bind, srcOf: srcOf };

  /* 화면에 이미 있는 표지에도 걸어 둡니다 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(document); });
  } else {
    bind(document);
  }
})();
