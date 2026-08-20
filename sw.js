/* ════════════════════════════════════════════════════════════════
   OPUSCLAM 서비스워커
   sw.js                                            2026-08-20
   ────────────────────────────────────────────────────────────────

   ★★ 이 파일이 하는 일은 딱 하나입니다
      곁딸린 파일(그림·글꼴·스크립트·CSS)을 담아 두어 두 번째부터
      빠르게 엽니다. <b>화면(HTML)은 건드리지 않습니다.</b>

   ════════════════════════════════════════════════════════════════
   ★★ 왜 화면을 건드리지 않게 되었나 — 2026-08-20 의 사고
   ════════════════════════════════════════════════════════════════

     파트너가 휴대전화에서 https://opusclam.com/home.html 을 열었을 때
     <b>「사이트에 연결할 수 없음 · ERR_FAILED」</b> 가 났습니다.
     PC 는 잘 되었고 서버도 멀쩡했습니다. 시크릿 모드에서는 열렸습니다.
     ▶ 시크릿 모드는 서비스워커를 쓰지 않습니다. 즉 <b>범인은 이 파일</b>
       이었습니다.

     ── 무엇이 잘못이었나 ────────────────────────────────────────
     전에는 화면 요청까지 이 파일이 가로채고, 이렇게 되어 있었습니다 —

         }).catch(function(){
           return caches.match(e.request);      ← ★ 여기
         })

     fetch 가 실패하면 캐시를 찾습니다. 그런데 <b>캐시에도 없으면
     caches.match 는 undefined 를 줍니다.</b> respondWith(undefined) 는
     브라우저에게 <b>「응답이 없다」</b>는 뜻이라, 브라우저는 그 자리에서
     ERR_FAILED 를 띄웁니다.

     ── 왜 휴대전화만 ────────────────────────────────────────────
     휴대전화 통신은 잠깐씩 끊깁니다. 원래대로면 브라우저가 <b>스스로
     다시 시도하거나 자기 오프라인 화면</b>을 보여 줍니다. 그런데
     서비스워커가 중간에 끼어들어 「응답 없음」을 돌려주면 브라우저는
     <b>더 해 볼 것이 없어집니다.</b> 한 순간 끊긴 것이 <b>영구 고장처럼</b>
     굳습니다. PC 는 유선·와이파이라 그 순간이 없었습니다.

     ── 왜 「빈손을 안 주기」로 끝내지 않았나 ────────────────────
     그것만 고쳐도 이 사고는 안 납니다. 그런데 <b>화면을 가로채는 구조
     자체가 위험합니다</b> — 여기에 버그가 하나 생기면 <b>다시 온
     방문자에게만</b> 사이트가 죽고, 그 사람은 스스로 고칠 방법이
     없습니다(캐시·사이트 데이터를 지워야 하는데 그걸 아는 사람이
     거의 없습니다). 실제로 파트너가 그 일을 겪었습니다.
     ▶ 그래서 <b>화면은 아예 손대지 않습니다.</b> 서비스워커 때문에
       화면이 안 열리는 일이 <b>구조적으로 불가능해집니다.</b>

     ── 잃는 것 / 잃지 않는 것 ──────────────────────────────────
     ✗ 완전 오프라인에서 담아 둔 화면 보기 — 없어집니다. 대신 크롬이
       <b>자기 오프라인 화면</b>을 보여 줍니다(다시 시도 단추가 있는
       그것). 그게 훨씬 안전합니다.
     ✓ 홈 화면에 앱으로 설치 — <b>그대로 됩니다.</b> 확인했습니다:
       크롬은 108(모바일)·112(PC) 부터 메뉴 설치에 서비스워커를
       요구하지 않고, 자동 설치 안내는 <b>fetch 처리기가 있으면</b>
       됩니다. 이 파일에는 아래에 그것이 있습니다.
       (developer.chrome.com/blog/update-install-criteria)
     ✓ 그림·글꼴 담아 두기 — 그대로 됩니다. 체감 속도는 같습니다.

   ════════════════════════════════════════════════════════════════
   ★ 배포할 때마다 아래 CACHE 값만 바꾸면 모든 사용자 캐시가
     자동으로 갱신됩니다. (예: 'opusclam-20260820b' → '...20260821')
   ════════════════════════════════════════════════════════════════ */
var CACHE = 'opusclam-20260820b';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') return;

  /* ★★ 화면은 손대지 않습니다 — 이 사고의 핵심입니다.
     ★ 두 가지로 겹쳐 봅니다. mode 는 주소창으로 들어올 때,
       destination 은 iframe 같은 것까지 잡습니다. 하나만 보면
       브라우저에 따라 새는 곳이 생깁니다. */
  if (req.mode === 'navigate') return;
  if (req.destination === 'document') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* 외부 도메인(Supabase API·위키백과·jsDelivr·YouTube 등)은
     그대로 통과 → 오래된 데이터가 담기는 것을 막습니다 */
  if (url.origin !== self.location.origin) return;

  /* ★ 서버에서 만들어 내는 것은 담지 않습니다 (api/seo 는 봇에게
     내어 주는 서버 렌더링 화면입니다) */
  if (url.pathname.indexOf('/api/') === 0) return;

  /* ★ .html 은 곁딸린 것으로 들어와도(include.js 가 부르는 조각 등)
     담지 않습니다 — 「화면은 손대지 않는다」를 한 군데서 어기면
     그게 다음 사고가 됩니다. */
  if (/\.html?$/.test(url.pathname)) return;

  /* ★ 크롬의 「캐시에 있으면만」 요청 — 손대면 오류가 납니다 */
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); })
                          .catch(function () {});
      }
      return res;
    }).catch(function () {
      /* ★ ignoreSearch — 주소 뒤에 ?v=... 가 붙어 들어오면 똑같은
         파일인데도 못 찾습니다. 물음표 뒤는 무시합니다. */
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        /* ★★ <b>빈손(undefined)을 돌려주지 않습니다.</b>
           이것이 2026-08-20 사고의 원인이었습니다. 그림 하나가
           없는 것뿐이면 504 를 주고, 화면은 그대로 열립니다. */
        return hit || new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
