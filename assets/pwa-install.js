/* ============================================================
   OPUSCLAM 앱 설치 안내 — assets/pwa-install.js
   ------------------------------------------------------------
   화면 아래에 「홈 화면에 설치하면 앱처럼 바로 열 수 있어요」 띠를
   띄우고, 서비스워커도 함께 등록합니다.

   ★ 왜 만들었나 (2026-08-12 · 파트너 요청)
     이 안내가 <b>18개 화면에만</b> 있었습니다 — 메인·첫화면과 DB 16곳.
     커뮤니티 · 정보SPOT · 레슨:ON · 리쿠르트 · 회원 화면 32곳에는
     <b>없었습니다.</b> 사이트를 둘러보다 그 32곳에 들어가면 설치할 길이
     사라집니다.

     같은 코드가 <b>18곳에 복붙</b>돼 있었습니다. 남은 32곳에 또 복붙하면
     50벌이 됩니다. 그러면 문구 한 줄 고칠 때 50곳을 손봐야 하고,
     반드시 몇 곳을 빠뜨립니다 — 오늘 리스트 탭에서 겪은 그대로입니다.
     ▶ 한 곳으로 모읍니다.

   ★ 짜임(CSS)도 <b>스스로 갖고 있습니다</b>
     지금은 style.css 에 있는데, <b>style.css 를 부르지 않는 화면</b>이
     있습니다(home.html 이 그렇습니다 — 자기 안에 CSS 를 갖고 있습니다).
     부품이 스스로 넣으면 어느 화면에 놓이든 같게 보입니다.

   ★ 서비스워커 등록도 함께 합니다
     PWA 설치는 <b>서비스워커가 있어야</b> 브라우저가 권합니다
     (beforeinstallprompt 가 오지 않습니다). 그 등록도 18곳에만
     있었으니 함께 옮깁니다.

   쓰는 법 — 화면 맨 아래에 한 줄
     <script src="/assets/pwa-install.js" defer></script>

   ★ 이미 화면에 띠가 있으면(옛 방식) <b>그것을 그대로 씁니다.</b>
     새로 만들지 않습니다 — 두 개가 겹쳐 보이면 안 됩니다.
   ★ 닫으면 <b>그날은 다시 띄우지 않습니다.</b> 볼 때마다 나오면 방해가 됩니다.
   ============================================================ */

(function () {
  if (window.__ocPwa) return;          /* 두 번 실려도 한 번만 */
  window.__ocPwa = true;

  var HIDE_KEY = 'oc-pwa-hide';        /* 닫은 날짜를 적어 둡니다 */

  /* ── 오늘 닫았나 ─────────────────────────────────────────
     ★ 한국 시간 기준 날짜로 봅니다. UTC 로 자르면 새벽에 닫은 것이
       어제로 밀려 곧바로 다시 나옵니다. */
  function todayKST() {
    var n = new Date();
    var k = new Date(n.getTime() + 9 * 3600 * 1000);
    return k.getUTCFullYear() + '-' + (k.getUTCMonth() + 1) + '-' + k.getUTCDate();
  }
  function hiddenToday() {
    try { return localStorage.getItem(HIDE_KEY) === todayKST(); }
    catch (e) { return false; }        /* 저장이 막혀 있어도 화면은 돕니다 */
  }
  function hideToday() {
    try { localStorage.setItem(HIDE_KEY, todayKST()); } catch (e) {}
  }

  /* ── 짜임 ────────────────────────────────────────────────
     ★ style.css 의 값을 <b>그대로</b> 옮겼습니다. 값이 어긋나면
       화면마다 다르게 보이므로 손대지 않았습니다.
     ★ 색은 var(--violet-2) 같은 이름을 쓰지 않고 <b>실제 색</b>으로
       적습니다 — 그 이름이 없는 화면도 있습니다. */
  function styleOnce() {
    if (document.getElementById('oc-pwa-css')) return;
    var css =
      '.pwa-install{position:fixed;left:50%;bottom:22px;' +
      'transform:translateX(-50%) translateY(14px);z-index:200;display:none;' +
      'align-items:center;gap:14px;max-width:calc(100vw - 32px);' +
      'padding:11px 12px 11px 13px;background:rgba(22,24,38,.86);' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
      'border:1px solid rgba(255,255,255,.1);border-radius:14px;' +
      'box-shadow:0 18px 44px -14px rgba(0,0,0,.6);opacity:0;' +
      'transition:opacity .3s ease,transform .3s ease;' +
      'font-family:"Pretendard",-apple-system,system-ui,sans-serif}' +
      '.pwa-install.show{display:flex;opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.pwa-ico{flex:0 0 auto;width:38px;height:38px;border-radius:10px;' +
      'background:linear-gradient(135deg,#7C63B0,#9b84c9);display:grid;place-items:center;' +
      'font-weight:800;font-size:14px;color:#fff;letter-spacing:.02em}' +
      '.pwa-txt{font-size:13.5px;line-height:1.4;color:#d7d5e4;white-space:nowrap}' +
      '.pwa-btn{flex:0 0 auto;background:#E8C55A;color:#3a2c05;font-weight:700;' +
      'font-size:13px;border:0;border-radius:9px;padding:9px 18px;cursor:pointer;' +
      'font-family:inherit;transition:filter .2s ease}' +
      '.pwa-btn:hover{filter:brightness(1.08)}' +
      '.pwa-close{flex:0 0 auto;background:none;border:0;color:#9a9bb0;cursor:pointer;' +
      'display:grid;place-items:center;padding:5px;border-radius:6px;' +
      'transition:color .2s ease,background .2s ease}' +
      '.pwa-close:hover{color:#fff;background:rgba(255,255,255,.08)}' +
      '@media(max-width:600px){' +
      '.pwa-install{left:14px;right:14px;bottom:14px;transform:translateY(14px);' +
      'max-width:none;gap:11px}' +
      '.pwa-install.show{transform:translateY(0)}' +
      '.pwa-txt{white-space:normal;font-size:12.5px}}';
    var s = document.createElement('style');
    s.id = 'oc-pwa-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── 띠 만들기 ───────────────────────────────────────────
     ★ 이미 있으면 그것을 씁니다. 옛 방식으로 화면에 적혀 있는 곳이
       있어서, 새로 만들면 <b>두 개가 겹쳐</b> 보입니다. */
  function ensureBanner() {
    var b = document.getElementById('pwaInstall');
    if (b) return b;
    styleOnce();
    b = document.createElement('div');
    b.className = 'pwa-install';
    b.id = 'pwaInstall';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', '앱 설치 안내');
    b.innerHTML =
      '<span class="pwa-ico">OC</span>' +
      '<span class="pwa-txt">홈 화면에 설치하면 앱처럼 바로 열 수 있어요.</span>' +
      '<button class="pwa-btn" id="pwaInstallBtn">설치</button>' +
      '<button class="pwa-close" id="pwaInstallClose" aria-label="닫기">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>';
    document.body.appendChild(b);
    return b;
  }

  function start() {
    /* 이미 앱으로 열었으면 안내할 것이 없습니다 */
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                  || window.navigator.standalone === true;
    if (standalone) return;

    var banner = ensureBanner();
    styleOnce();                       /* 옛 띠를 쓰는 화면에도 짜임을 넣습니다 */
    var installBtn = document.getElementById('pwaInstallBtn');
    var closeBtn = document.getElementById('pwaInstallClose');
    if (!banner || !installBtn || !closeBtn) return;

    var deferred = null;

    /* ★ 브라우저가 「설치할 수 있다」고 알려 줄 때만 띄웁니다.
         이 알림이 오지 않는 브라우저(사파리 등)에서는 띠가 나오지
         않습니다 — 눌러도 아무 일이 없는 단추를 보이는 것보다 낫습니다. */
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      if (!hiddenToday()) banner.classList.add('show');
    });

    installBtn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        banner.classList.remove('show');
      });
    });

    closeBtn.addEventListener('click', function () {
      banner.classList.remove('show');
      hideToday();                     /* 그날은 다시 띄우지 않습니다 */
    });

    window.addEventListener('appinstalled', function () {
      banner.classList.remove('show');
      hideToday();
    });
  }

  /* ── 서비스워커 ──────────────────────────────────────────
     ★ 이것이 없으면 브라우저가 설치를 권하지 않습니다
       (beforeinstallprompt 가 아예 오지 않습니다).
     ★ 그래서 안내 띠와 <b>같은 부품</b>에 둡니다 — 하나만 있으면
       설치가 안 되는데, 둘이 떨어져 있으면 그것을 알아채기 어렵습니다. */
  function sw() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  if (document.readyState === 'complete') sw();
  else window.addEventListener('load', sw);
})();
