/* ============================================================
   OPUSCLAM 리스트 탭 자리잡기 — assets/pv-sidetab.js
   ------------------------------------------------------------
   상세 화면 왼쪽에 붙어 있는 세로 단추([‹ 리스트] · [+ 글쓰기])가
   <b>다른 것 위에 떠 있지 않게</b> 합니다.

   ★ 왜 만들었나 (2026-08-12 · 파트너 지적)
     같은 일을 하는 코드가 <b>두 곳에 따로</b> 살아 있었습니다.

       커뮤니티·정보SPOT   assets/board.js 안 — 푸터 + 이너스페이스 둘 다 봄
       DATABASE 상세 9곳   화면마다 복붙 — <b>푸터만 보고 이너스페이스는 안 봄</b>

     그래서 이너스페이스를 열면 DATABASE 상세에서만 단추가 패널 위에
     겹쳐 보였습니다. 커뮤니티는 2026-08-05 에 고쳤는데 DATABASE 쪽은
     그때 함께 고쳐지지 않았습니다 — <b>코드가 두 벌이라 한쪽만 고쳐진</b>
     전형적인 경우입니다.

     ▶ 한 곳으로 모읍니다. 앞으로 어느 쪽을 고쳐도 함께 좋아집니다.

   ★ 무엇을 피하나
     ⓐ 푸터·하단 배너   가까워지면 그 위로 올라가고, 올릴 자리도 없으면 감춥니다
     ⓑ 이너스페이스     패널이 화면을 덮고 있으면 감춥니다

   ★ 감출 때 display 를 건드리지 않습니다
     display:none 이면 크기가 0 이 되어 자리 셈이 어긋납니다.
     opacity·visibility 로만 감춥니다. (board.js 에서 얻은 교훈)

   ★ 언제 다시 재나
     스크롤 · 창 크기 변화 · <b>이너스페이스 열고 닫기</b>.
     이너스페이스는 열릴 때 resize 를 한 번 알려 주므로 그것을 듣습니다.

   쓰는 법 — 화면 맨 아래에 한 줄
     <script src="/assets/pv-sidetab.js"></script>

   ★ 단추를 감싸는 것이 있으면(.pv-sidetabs) 그것을, 없으면 단추
     자체(.pv-listtab)를 움직입니다. 두 짜임을 모두 받아들입니다 —
     커뮤니티는 감싸개가 있고 DATABASE 는 없습니다.
   ============================================================ */

(function () {
  if (window.__ocPvSidetab) return;   /* 두 번 실려도 한 번만 */
  window.__ocPvSidetab = true;

  function start() {
    var tabs = document.querySelector('.pv-sidetabs')
            || document.querySelector('.pv-listtab');
    if (!tabs) return;

    /* 감싸개가 있으면 그것이 자리를 잡고, 없으면 단추가 스스로 잡습니다 */
    var wrapped = tabs.classList.contains('pv-sidetabs');

    /* 원래 자리 — css 에 적힌 top 을 그대로 씁니다.
       화면마다 다릅니다(커뮤니티 500px · DATABASE 560px).
       읽어서 쓰므로 css 를 고치면 이쪽도 따라갑니다. */
    var BASE = parseFloat(getComputedStyle(tabs).top);
    if (!isFinite(BASE)) BASE = 500;
    var MIN = 96;                     /* 이보다 위로는 올리지 않습니다 (헤더 자리) */

    function show(on) {
      tabs.style.opacity = on ? '1' : '0';
      tabs.style.visibility = on ? 'visible' : 'hidden';
    }

    function upd() {
      /* ⓑ 이너스페이스 패널이 화면을 덮고 있으면 비켜 있습니다 */
      var ins = document.getElementById('ocInnerSpace');
      if (ins) {
        var ib = ins.getBoundingClientRect().bottom;
        if (ib > 140) { show(false); return; }
      }

      /* ⓐ 푸터·하단 배너가 가까우면 그 위로 올라갑니다 */
      tabs.style.top = BASE + 'px';
      var h = tabs.offsetHeight || 0;
      var stop = document.querySelector('.bigban')
              || document.querySelector('.triple')
              || document.querySelector('footer')
              || document.querySelector('#oc-footer');

      if (!stop) {
        var near = (window.innerHeight + window.scrollY)
                 >= (document.documentElement.scrollHeight - 360);
        show(!near);
        return;
      }

      var st = stop.getBoundingClientRect().top;
      var room = st - 20 - h;         /* 푸터 위에 놓을 수 있는 윗변 */
      if (room >= BASE) { show(true); return; }          /* 원래 자리로 충분 */
      if (room >= MIN)  { tabs.style.top = room + 'px'; show(true); return; }
      show(false);                                       /* 올릴 자리도 없음 */
    }

    window.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    upd();

    /* ★ 이너스페이스는 늦게 실려 옵니다(로그인한 사람에게만).
         패널이 생기거나 사라지는 것을 지켜보다가 다시 잽니다.
         resize 알림만 믿으면 알림이 오기 전 한 순간 겹쳐 보입니다. */
    if (window.MutationObserver) {
      var t = null;
      new MutationObserver(function () {
        if (t) return;
        t = setTimeout(function () { t = null; upd(); }, 60);
      }).observe(document.documentElement, {
        attributes: true, attributeFilter: ['class'],
        childList: true, subtree: false
      });
    }

    void wrapped;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
