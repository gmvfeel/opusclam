/* ============================================================
   OPUSCLAM 광고 자리 돌리개 — assets/ad-rotate.js
   2026-08-14 · 2026-08-21 <b>미끄러지는 방식으로 바꿈</b>

   ★ 왜 만드나 (파트너 요청)
     한 자리에 광고가 <b>둘 이상</b>이 되었습니다. 자리는 하나이므로
     번갈아 보여 주어야 두 광고주가 모두 노출됩니다.

   ★★ 2026-08-21 · <b>겹쳐 바뀌기 → 미끄러지기</b> (파트너 요청)
     예전에는 옅어졌다 진해지는 방식이었습니다. 이제 옆으로 밀려
     지나가고 다음 것이 따라 들어옵니다.
     · 나가는 장 : 제자리 → 왼쪽 밖
     · 들어오는 장 : 오른쪽 밖 → 제자리
     · 나머지는 <b>움직임 없이</b> 오른쪽 밖에 세워 둡니다
       (세 장 이상일 때 여러 장이 한꺼번에 날아다니면 어지럽습니다)

   ★ 어떻게 쓰나 — 마크업만 감싸면 끝입니다 (예전과 같습니다)
       <div class="ad-rot" data-every="7000">
         <a class="ad-slot board-ad has-img" href="…">…</a>
         <a class="ad-slot board-ad has-img" href="…">…</a>
       </div>
     · data-every : 몇 밀리초마다 바꿀지 (없으면 7000)
     · data-slide : 'x' 가로(기본) · 'y' 세로 · 'fade' 예전처럼 겹쳐 바뀌기
     · 광고가 하나뿐이면 <b>아무 일도 하지 않습니다</b>.

   ★ 자리·크기는 이 파일이 정하지 않습니다
     .board-ad · .lower-ad · .bigban-ad 같은 <b>자리 규칙</b>이 그대로
     크기를 정합니다. 여기서는 <b>겹쳐 놓고 바꾸는 일</b>만 합니다.

   ★ 첫 장이 자리를 차지하고 나머지는 그 위에 겹칩니다
     첫 장만 흐름 안에 두면 상자 높이가 첫 장에 맞춰 고정됩니다.
     ★★ 미는 방식이어도 첫 장을 흐름에서 빼지 <b>않습니다</b> —
       transform 은 자리를 차지한 채 그림만 옮기므로, 첫 장이 왼쪽으로
       밀려나가도 상자 높이가 그대로입니다. 높이가 출렁이면 아래
       내용이 함께 튑니다.

   ★★ 얼마나 밀어낼지는 <b>재서</b> 정합니다
     transform 의 % 는 <b>제 요소</b> 기준입니다. 광고가 상자보다 좁으면
     100% 를 밀어도 한 귀퉁이가 남습니다. 그래서 상자 폭을 재어
     픽셀로 밀어냅니다. 창 크기가 바뀌면 다시 잽니다.

   ★ 멈추는 때
     · 마우스를 올렸을 때 — 누르려는데 바뀌면 다른 곳으로 갑니다
     · 다른 탭에 가 있을 때 — 보이지 않는 곳에서 돌 이유가 없습니다
     · 움직임을 줄이는 설정(prefers-reduced-motion) — 첫 장만 둡니다
   ============================================================ */
(function (w, d) {
  'use strict';

  if (w.__ocAdRot) return;
  w.__ocAdRot = true;

  var CSS = ''
    /* ★ overflow:hidden — 밀려 나간 장이 상자 밖으로 비어져 나오지 않게.
         광고 자리에는 그림자가 없어 잘릴 것이 없습니다(style.css 524줄 확인). */
    + '.ad-rot{position:relative;overflow:hidden}'
    + '.ad-rot > .ad-slot{opacity:1;'
    +   'transition:transform .55s cubic-bezier(.4,0,.2,1);'
    +   'will-change:transform;backface-visibility:hidden}'
    /* 첫 장이 자리(높이)를 잡습니다 */
    + '.ad-rot > .ad-slot:first-child{position:relative}'
    + '.ad-rot > .ad-slot:not(:first-child){position:absolute;left:0;right:0;top:0;bottom:0;'
    +   'margin-left:auto;margin-right:auto}'
    /* 지금 보이는 장만 누를 수 있습니다 */
    + '.ad-rot > .ad-slot{pointer-events:none}'
    + '.ad-rot > .ad-slot.on{pointer-events:auto}'
    /* 예전처럼 겹쳐 바뀌기를 쓰고 싶을 때 : data-slide="fade" */
    + '.ad-rot[data-slide="fade"] > .ad-slot{opacity:0;transform:none!important;'
    +   'transition:opacity .5s ease}'
    + '.ad-rot[data-slide="fade"] > .ad-slot.on{opacity:1}'
    /* 움직임을 줄이는 설정 — 흐르지 않고 툭 바뀝니다 */
    + '@media (prefers-reduced-motion:reduce){'
    +   '.ad-rot > .ad-slot{transition:none}'
    + '}';

  function injectCss() {
    if (d.getElementById('oc-adrot-css')) return;
    var st = d.createElement('style');
    st.id = 'oc-adrot-css';
    st.textContent = CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  function reduced() {
    try {
      return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function setup(box, idx) {
    var ads = [];
    for (var i = 0; i < box.children.length; i++) {
      if (box.children[i].classList.contains('ad-slot')) ads.push(box.children[i]);
    }
    if (!ads.length) return;

    /* 하나뿐이면 그대로 보여 주고 끝냅니다 — 밀 것이 없습니다 */
    if (ads.length === 1) { ads[0].classList.add('on'); return; }

    var every = parseInt(box.getAttribute('data-every'), 10) || 7000;
    var mode  = (box.getAttribute('data-slide') || 'x').toLowerCase();
    var fade  = (mode === 'fade');
    var vert  = (mode === 'y');

    /* ★ 2026-08-14 · 자리마다 <b>시차를 둡니다</b> (파트너 요청)
         A 자리와 B 자리가 같은 순간에 넘어가니 화면 두 곳이 함께 깜빡였습니다. */
    var delay = parseInt(box.getAttribute('data-delay'), 10);
    if (isNaN(delay)) delay = Math.round(every / 3) * (idx || 0);

    var at = Math.floor(Math.random() * ads.length);   /* 시작 장을 흩습니다 */
    var timer = null, first = null;

    /* 상자를 재어 밀어낼 거리를 정합니다 */
    function span() {
      var n = vert ? box.clientHeight : box.clientWidth;
      return (n > 0 ? n : 320) + 24;   /* 24px 은 테두리가 살짝 보이는 것까지 막는 여유 */
    }

    /* el 을 x 만큼 옮깁니다. anim 이 거짓이면 <b>움직임 없이</b> 옮깁니다
       (기다리는 장을 제자리에 세울 때 — 날아다니면 어지럽습니다) */
    function place(el, n, anim) {
      if (fade) return;
      if (!anim) el.style.transition = 'none';
      el.style.transform = n === 0 ? 'translate3d(0,0,0)'
        : (vert ? 'translate3d(0,' + n + 'px,0)' : 'translate3d(' + n + 'px,0,0)');
      if (!anim) {
        void el.offsetWidth;        /* 여기서 한 번 그려야 다음 움직임이 살아납니다 */
        el.style.transition = '';
      }
    }

    var prev = -1;
    function show(k, anim) {
      var W = span();
      prev = at;
      at = (k + ads.length) % ads.length;
      for (var i = 0; i < ads.length; i++) {
        ads[i].classList.toggle('on', i === at);
        if (i === at)            place(ads[i], 0, anim);
        else if (i === prev && anim) place(ads[i], -W, true);   /* 왼쪽으로 밀려 나감 */
        else                     place(ads[i],  W, false);      /* 오른쪽에 세워 둠 */
      }
    }
    function next() { show(at + 1, !reduced()); }

    function start(useDelay) {
      stop();
      if (useDelay && delay > 0) {
        first = setTimeout(function () {
          first = null; next(); timer = setInterval(next, every);
        }, delay);
      } else {
        timer = setInterval(next, every);
      }
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (first) { clearTimeout(first); first = null; }
    }

    show(at, false);

    /* 움직임을 싫어하는 설정이면 돌리지 않습니다 */
    if (reduced()) return;

    /* ★ 창 크기가 바뀌면 밀어낼 거리를 다시 잽니다.
         안 하면 넓히거나 좁힌 뒤에 기다리던 장이 어중간한 자리에
         걸쳐 보입니다. */
    var rt = null;
    w.addEventListener('resize', function () {
      if (rt) clearTimeout(rt);
      rt = setTimeout(function () { rt = null; show(at, false); }, 150);
    });

    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', function () { start(false); });
    d.addEventListener('visibilitychange', function () {
      if (d.hidden) stop(); else start(false);
    });
    start(true);
  }

  /* ★ 2026-08-15 · run() 을 <b>여러 번 불러도</b> 안전하게 했습니다
       맨 아래 큰 광고(C·D)가 partials/bigban.html 로 빠지면서, 문서를
       다 읽은 뒤에 붙게 됐습니다. 한 번 맡은 상자에 표시를 남겨
       두 번째부터는 건너뜁니다. */
  function run() {
    var boxes = d.querySelectorAll('.ad-rot');
    if (!boxes.length) return;      /* 광고 회전이 없는 화면 */
    injectCss();
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].getAttribute('data-oc-rot') === '1') continue;   /* 이미 맡은 상자 */
      boxes[i].setAttribute('data-oc-rot', '1');
      setup(boxes[i], i);
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run);
  else run();

  w.OCAdRotate = { run: run };
})(window, document);
