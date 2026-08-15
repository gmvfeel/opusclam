/* ============================================================
   OPUSCLAM 앱 설치 안내 — assets/pwa-install.js
   ------------------------------------------------------------
   화면 아래에 「홈 화면에 설치하면 앱처럼 바로 열 수 있어요」 띠를
   띄우고, 서비스워커도 함께 등록합니다.

   ★★ 2026-08-15 · 아이폰·아이패드를 살렸습니다 (파트너 확인) ★★
   ────────────────────────────────────────────────────────────
   ★ 무엇이 문제였나
     예전 판은 브라우저가 보내는 <b>beforeinstallprompt</b> 알림이
     올 때만 띠를 띄웠습니다. 그런데 이 알림은 <b>애플이 지원한 적이
     없습니다.</b> 아이폰·아이패드에서는 영원히 오지 않습니다.
     → 아이폰 손님은 <b>띠를 한 번도 못 봤습니다.</b>
     → 설치가 안 되는 것이 아니라, 설치할 수 있다는 것을 <b>알 길이
       없었습니다.</b>

   ★ 어떻게 고쳤나 — 환경마다 다른 말을 합니다
     ┌────────────────┬──────────────────────────────────────┐
     │ 안드로이드·PC  │ 예전대로 「설치」 단추 (한 번 누르면 끝) │
     │ 크롬·엣지·삼성 │                                        │
     ├────────────────┼──────────────────────────────────────┤
     │ 아이폰 사파리   │ 「아래 공유 단추 → 홈 화면에 추가」 안내 │
     │ 아이패드 사파리 │ 「위 공유 단추 → 홈 화면에 추가」 안내   │
     │                │ (아이패드는 공유 단추가 위에 있습니다)   │
     ├────────────────┼──────────────────────────────────────┤
     │ 아이폰 크롬 등  │ 「사파리로 열면 추가할 수 있어요」       │
     │                │ ★ iOS 의 다른 브라우저는 속이 사파리라  │
     │                │   홈 화면 추가가 제대로 되지 않습니다   │
     ├────────────────┼──────────────────────────────────────┤
     │ PC 사파리·파폭  │ 아무것도 띄우지 않습니다               │
     │                │ ★ 설치할 길이 없는데 안내만 하면 방해   │
     └────────────────┴──────────────────────────────────────┘

   ★ 아이폰은 <b>스스로</b> 띄웁니다 (알림이 없으니까)
     들어오자마자 띄우면 첫 화면을 가립니다 → <b>5초</b> 뒤에 띄웁니다.

   ★ 닫으면 얼마나 안 뜨나
     안드로이드·PC  1일   (브라우저가 권한 것이라 예전과 같이)
     아이폰·아이패드 7일   (우리가 스스로 띄우는 것이라 더 길게)

   ★ 글은 모두 <b>사전을 거칩니다</b> — 영어·일본어 화면에서도 뜹니다.
     예전 판은 한국어 문장이 코드에 박혀 있어, 영어로 보아도
     한국어 띠가 나왔습니다.

   ------------------------------------------------------------
   ★ 왜 한 파일로 모았나 (2026-08-12 · 파트너 요청)
     이 안내가 18개 화면에만 있었고, 같은 코드가 18곳에 복붙돼
     있었습니다. 문구 한 줄 고치려면 18곳을 손봐야 했습니다.
     ▶ 한 곳으로 모읍니다.

   ★ 짜임(CSS)도 <b>스스로 갖고 있습니다</b>
     style.css 를 부르지 않는 화면이 있습니다(home.html 이 그렇습니다).
     부품이 스스로 넣으면 어느 화면에 놓이든 같게 보입니다.
     ★ 2026-08-15 · style.css 의 옛 규칙은 지웠습니다. 두 곳에 있으면
       한쪽만 고쳤을 때 화면마다 다르게 보입니다.

   ★ 서비스워커 등록도 함께 합니다
     안드로이드·PC 는 서비스워커가 있어야 브라우저가 설치를 권합니다.
     하나만 있으면 설치가 안 되는데, 둘이 떨어져 있으면 그것을
     알아채기 어렵습니다.

   쓰는 법 — 화면 맨 아래에 한 줄
     <script src="/assets/pwa-install.js?v=20260815" defer></script>
   ============================================================ */

(function () {
  if (window.__ocPwa) return;          /* 두 번 실려도 한 번만 */
  window.__ocPwa = true;

  var HIDE_KEY = 'oc-pwa-until';       /* 언제까지 안 띄울지를 적어 둡니다 */
  var IOS_DELAY = 5000;                /* 아이폰에서 띄우기까지 기다리는 시간 */

  /* ── 사전 ────────────────────────────────────────────────
     ★ 한국어 원문을 열쇠로 씁니다 (i18n.js 와 같은 방식).
       사전에 없으면 원문이 그대로 나옵니다 — 화면이 비지 않습니다. */
  function t(ko) {
    try {
      if (window.OCI18N && typeof window.OCI18N.t === 'function') return window.OCI18N.t(ko);
    } catch (e) {}
    return ko;
  }

  /* ── 언제까지 감출까 ─────────────────────────────────────
     ★ 예전에는 「닫은 날짜」를 적어 두고 오늘과 견주었습니다.
       이제 「다시 띄울 시각」을 적습니다 — 환경마다 기간이 달라서입니다. */
  function hidden() {
    try {
      var v = Number(localStorage.getItem(HIDE_KEY) || 0);
      return v > Date.now();
    } catch (e) { return false; }      /* 저장이 막혀 있어도 화면은 돕니다 */
  }
  function hideFor(days) {
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + days * 86400000)); } catch (e) {}
  }

  /* ── 어떤 환경인가 ───────────────────────────────────────
     ★ 아이패드는 iPadOS 13 부터 <b>스스로를 맥이라고 말합니다.</b>
       그래서 「맥인데 손가락이 닿는다」로 가려냅니다. */
  var ua = navigator.userAgent || '';
  var isIPhone = /iphone|ipod/i.test(ua);
  var isIPad = /ipad/i.test(ua)
            || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var isIOS = isIPhone || isIPad;
  /* iOS 의 크롬·파폭·엣지·오페라 — 속은 사파리지만 홈 화면 추가가
     제대로 되지 않습니다. 사파리로 옮겨 가시도록 안내합니다. */
  var isIOSOther = isIOS && /crios|fxios|edgios|opios|mercury/i.test(ua);

  /* ── 짜임 ────────────────────────────────────────────────
     ★ 색은 var(--violet-2) 같은 이름을 쓰지 않고 <b>실제 색</b>으로
       적습니다 — 그 이름이 없는 화면도 있습니다. */
  function styleOnce() {
    if (document.getElementById('oc-pwa-css')) return;
    var css =
      '.pwa-install{position:fixed;left:50%;bottom:22px;' +
      'transform:translateX(-50%) translateY(14px);z-index:200;display:none;' +
      'align-items:center;gap:14px;max-width:calc(100vw - 32px);' +
      'padding:11px 12px 11px 13px;background:rgba(22,24,38,.9);' +
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

      /* ── 아이폰·아이패드 판 ─────────────────────────────
         ★ 안내문이 길어 한 줄에 담기지 않습니다. 두 줄로 세웁니다.
         ★ 닫기 단추는 오른쪽 위에 붙박이로 둡니다 — 줄바꿈에 밀리지
           않게 하려는 것입니다. */
      '.pwa-install.pwa-ios{align-items:flex-start;padding:13px 40px 13px 13px;' +
      'max-width:min(420px,calc(100vw - 28px))}' +
      '.pwa-ios .pwa-body{display:flex;flex-direction:column;gap:5px;min-width:0}' +
      '.pwa-ios .pwa-txt{white-space:normal;font-weight:600;color:#efeef6;font-size:13.5px}' +
      '.pwa-ios .pwa-how{display:flex;align-items:center;gap:6px;flex-wrap:wrap;' +
      'font-size:12.5px;line-height:1.5;color:#b9b7cb}' +
      '.pwa-ios .pwa-share{flex:0 0 auto;display:inline-grid;place-items:center;' +
      'width:22px;height:22px;border-radius:6px;background:rgba(255,255,255,.1);' +
      'color:#cfcde0}' +
      '.pwa-ios .pwa-share svg{width:14px;height:14px}' +
      '.pwa-ios .pwa-close{position:absolute;top:8px;right:8px}' +

      /* ★ 아이폰 사파리는 공유 단추가 <b>화면 아래 가운데</b>에 있습니다
           (뒤로·앞으로·공유·책갈피·탭 다섯 개 중 한가운데).
           띠 아래 가운데에 작은 뿔을 달아 그쪽을 가리킵니다. */
      '.pwa-install.pwa-down::after{content:"";position:absolute;bottom:-7px;' +
      'left:50%;margin-left:-6.5px;width:13px;height:13px;background:rgba(22,24,38,.9);' +
      'border-right:1px solid rgba(255,255,255,.1);' +
      'border-bottom:1px solid rgba(255,255,255,.1);transform:rotate(45deg)}' +

      '@media(max-width:600px){' +
      '.pwa-install{left:14px;right:14px;bottom:14px;transform:translateY(14px);' +
      'max-width:none;gap:11px}' +
      '.pwa-install.show{transform:translateY(0)}' +
      '.pwa-txt{white-space:normal;font-size:12.5px}' +
      '.pwa-install.pwa-ios{max-width:none}}';
    var s = document.createElement('style');
    s.id = 'oc-pwa-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* 사파리 공유 아이콘 — 네모에서 화살표가 위로 빠져나가는 모양 */
  var SHARE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 15V3"/><path d="m8 6.5 4-3.5 4 3.5"/>' +
    '<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  var CLOSE_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  /* ── 띠 만들기 ───────────────────────────────────────────
     ★ 옛 마크업이 화면에 박혀 있던 곳이 18군데 있었는데 2026-08-15 에
       모두 걷어냈습니다. 그래도 혹시 남아 있으면 <b>지우고 새로</b>
       만듭니다 — 옛 마크업에는 아이폰 안내 자리가 없습니다. */
  function makeBanner(mode) {
    var old = document.getElementById('pwaInstall');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    styleOnce();
    var b = document.createElement('div');
    b.id = 'pwaInstall';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', t('앱 설치 안내'));

    var head = '<span class="pwa-ico">OC</span>';
    var close = '<button class="pwa-close" id="pwaInstallClose" aria-label="' +
                t('닫기') + '">' + CLOSE_SVG + '</button>';

    if (mode === 'prompt') {
      b.className = 'pwa-install';
      b.innerHTML = head +
        '<span class="pwa-txt">' + t('홈 화면에 설치하면 앱처럼 바로 열 수 있어요.') + '</span>' +
        '<button class="pwa-btn" id="pwaInstallBtn">' + t('설치') + '</button>' +
        close;
    } else {
      /* 아이폰·아이패드 — 어디를 누르라고 알려 줍니다 */
      var how;
      if (mode === 'ios-other') {
        how = '<span>' + t('사파리로 열면 홈 화면에 추가할 수 있어요.') + '</span>';
      } else {
        how = '<span class="pwa-share">' + SHARE_SVG + '</span>' +
              '<span>' + t(isIPad
                ? '위 공유 단추를 누르고 「홈 화면에 추가」를 고르세요.'
                : '아래 공유 단추를 누르고 「홈 화면에 추가」를 고르세요.') + '</span>';
      }
      b.className = 'pwa-install pwa-ios' + (mode === 'ios-safari' && isIPhone ? ' pwa-down' : '');
      b.innerHTML = head +
        '<span class="pwa-body">' +
          '<span class="pwa-txt">' + t('홈 화면에 설치하면 앱처럼 바로 열 수 있어요.') + '</span>' +
          '<span class="pwa-how">' + how + '</span>' +
        '</span>' + close;
    }

    document.body.appendChild(b);
    /* 나중에 붙은 것이라 사전이 못 보고 지나쳤을 수 있어 한 번 더 훑습니다 */
    try { if (window.OCI18N && window.OCI18N.apply) window.OCI18N.apply(b); } catch (e) {}
    return b;
  }

  function show(b) {
    /* 다음 그림에서 켭니다 — 붙자마자 켜면 스르르 나타나지 않습니다 */
    requestAnimationFrame(function () { b.classList.add('show'); });
  }

  function bindClose(b, days) {
    var c = document.getElementById('pwaInstallClose');
    if (!c) return;
    c.addEventListener('click', function () {
      b.classList.remove('show');
      hideFor(days);
    });
  }

  function start() {
    /* 이미 앱으로 열었으면 안내할 것이 없습니다 */
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                  || window.navigator.standalone === true;
    if (standalone) return;
    if (hidden()) return;

    /* ── 1) 안드로이드·PC — 브라우저가 권할 때만 ──────────── */
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      if (hidden()) return;
      var b = makeBanner('prompt');
      var btn = document.getElementById('pwaInstallBtn');
      if (btn) {
        btn.addEventListener('click', function () {
          e.prompt();
          e.userChoice.then(function () { b.classList.remove('show'); });
        });
      }
      bindClose(b, 1);
      show(b);
    });

    /* ── 2) 아이폰·아이패드 — 스스로 띄웁니다 ──────────────
       ★ 알림이 오지 않으므로 기다릴 것이 없습니다.
       ★ 들어오자마자 띄우면 첫 화면을 가려 5초 뒤로 미룹니다. */
    if (isIOS) {
      setTimeout(function () {
        if (hidden()) return;
        if (document.getElementById('pwaInstall')) return;   /* 이미 떠 있으면 */
        var b = makeBanner(isIOSOther ? 'ios-other' : 'ios-safari');
        bindClose(b, 7);
        show(b);
      }, IOS_DELAY);
    }

    window.addEventListener('appinstalled', function () {
      var b = document.getElementById('pwaInstall');
      if (b) b.classList.remove('show');
      hideFor(3650);                   /* 설치했으면 다시 권하지 않습니다 */
    });
  }

  /* ── 서비스워커 ──────────────────────────────────────────
     ★ 안드로이드·PC 는 이것이 없으면 브라우저가 설치를 권하지 않습니다.
     ★ 아이폰도 이것이 있어야 홈 화면에 넣은 뒤 앱처럼 열립니다. */
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
