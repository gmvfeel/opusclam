/* ============================================================
   OPUSCLAM 광고 자리 돌리개 — assets/ad-rotate.js
   2026-08-14

   ★ 왜 만드나 (파트너 요청)
     한 자리에 광고가 <b>둘 이상</b>이 되었습니다. 자리는 하나이므로
     번갈아 보여 주어야 두 광고주가 모두 노출됩니다.

   ★ 어떻게 쓰나 — 마크업만 감싸면 끝입니다
       <div class="ad-rot" data-every="7000">
         <a class="ad-slot board-ad has-img" href="…">…</a>
         <a class="ad-slot board-ad has-img" href="…">…</a>
       </div>
     · data-every : 몇 밀리초마다 바꿀지 (없으면 7000)
     · 광고가 하나뿐이면 <b>아무 일도 하지 않습니다</b> — 자리표 하나만
       두었을 때와 똑같이 보입니다.

   ★ 자리·크기는 이 파일이 정하지 않습니다
     .board-ad · .lower-ad · .bigban-ad 같은 <b>자리 규칙</b>이 그대로
     크기를 정합니다. 여기서는 <b>겹쳐 놓고 바꾸는 일</b>만 합니다.
     (두 곳에 크기를 적으면 반드시 어긋납니다)

   ★ 첫 장이 자리를 차지하고 나머지는 그 위에 겹칩니다
     첫 장만 흐름 안에 두면(position:relative) 상자 높이가 <b>첫 장에
     맞춰 고정</b>됩니다. 광고 비율이 같으므로 어느 장이 보여도 같은
     높이입니다.

   ★ 어느 것을 먼저 보여 주나 — <b>화면을 열 때마 다릅니다</b>
     늘 첫 장부터 보여 주면 뒤 광고는 7초를 기다려야 보입니다.
     들어온 순간 무작위로 골라 시작하면 노출이 고르게 나뉩니다.

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
    + '.ad-rot{position:relative}'
    + '.ad-rot > .ad-slot{opacity:0;transition:opacity .5s ease}'
    /* 첫 장이 자리(높이)를 잡습니다 */
    + '.ad-rot > .ad-slot:first-child{position:relative}'
    + '.ad-rot > .ad-slot:not(:first-child){position:absolute;left:0;right:0;top:0;bottom:0;'
    +   'margin-left:auto;margin-right:auto;pointer-events:none}'
    + '.ad-rot > .ad-slot.on{opacity:1;pointer-events:auto}'
    /* 움직임을 줄이는 설정 — 첫 장만 */
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

  function setup(box, idx) {
    var ads = [];
    for (var i = 0; i < box.children.length; i++) {
      if (box.children[i].classList.contains('ad-slot')) ads.push(box.children[i]);
    }
    if (!ads.length) return;

    /* 하나뿐이면 그대로 보여 주고 끝냅니다 */
    if (ads.length === 1) { ads[0].classList.add('on'); return; }

    var every = parseInt(box.getAttribute('data-every'), 10) || 7000;

    /* ★ 2026-08-14 · 자리마다 <b>시차를 둡니다</b> (파트너 요청)
         A 자리와 B 자리가 같은 순간에 넘어가니 화면 두 곳이 함께 깜빡였습니다.
         첫 넘김을 자리 순서만큼 늦추면 서로 엇갈려 조용해집니다.
       ★ data-delay 로 직접 정할 수 있고, 없으면 <b>간격을 자리 수로 나눠</b>
         스스로 흩습니다 — 자리가 셋이 되어도 고르게 엇갈립니다. */
    var delay = parseInt(box.getAttribute('data-delay'), 10);
    if (isNaN(delay)) delay = Math.round(every / 3) * (idx || 0);

    var at = Math.floor(Math.random() * ads.length);   /* 시작 장을 흩습니다 */
    var timer = null, first = null;

    function show(k) {
      at = (k + ads.length) % ads.length;
      for (var i = 0; i < ads.length; i++) ads[i].classList.toggle('on', i === at);
    }
    function next() { show(at + 1); }
    /* 처음에는 시차만큼 기다린 뒤 넘기기 시작합니다.
       (마우스가 지나간 뒤 다시 켤 때는 기다리지 않습니다 — 이미 흩어져 있습니다) */
    function start(useDelay) {
      stop();
      if (useDelay && delay > 0) {
        first = setTimeout(function () { first = null; next(); timer = setInterval(next, every); }, delay);
      } else {
        timer = setInterval(next, every);
      }
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (first) { clearTimeout(first); first = null; }
    }

    show(at);

    /* 움직임을 싫어하는 설정이면 돌리지 않습니다 */
    try {
      if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}

    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', function () { start(false); });
    d.addEventListener('visibilitychange', function () {
      if (d.hidden) stop(); else start(false);
    });
    start(true);
  }

  function run() {
    var boxes = d.querySelectorAll('.ad-rot');
    if (!boxes.length) return;      /* 광고 회전이 없는 화면 — 아무 일도 하지 않습니다 */
    injectCss();
    for (var i = 0; i < boxes.length; i++) setup(boxes[i], i);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', run);
  else run();

  w.OCAdRotate = { run: run };
})(window, document);
