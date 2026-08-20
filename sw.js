/* ════════════════════════════════════════════════════════════════
   OPUSCLAM 서비스워커 — 네트워크 먼저, 안 되면 캐시
   sw.js                                            2026-08-20
   ────────────────────────────────────────────────────────────────

   ★★ 2026-08-20 · 「모바일에서 접속이 안 된다」(ERR_FAILED) 를 잡았습니다

     파트너가 휴대전화에서 https://opusclam.com/home.html 을 열었을 때
     <b>「사이트에 연결할 수 없음 · ERR_FAILED」</b> 가 났습니다.
     PC 는 잘 되었습니다. 서버는 멀쩡했습니다(확인함).

     ▶ 까닭은 <b>이 파일이었습니다.</b> 전에는 이렇게 되어 있었습니다 —

         }).catch(function(){
           return caches.match(e.request);      ← ★ 여기
         })

       fetch 가 실패하면 캐시를 찾습니다. 그런데 <b>캐시에도 없으면
       caches.match 는 undefined 를 줍니다.</b>
       respondWith(undefined) 는 브라우저에게 <b>「응답이 없다」</b>는
       뜻이라, 브라우저는 그 자리에서 ERR_FAILED 를 띄웁니다.

     ▶ 무엇이 나빴나 — 휴대전화 통신은 잠깐씩 끊깁니다. 원래대로면
       브라우저가 <b>스스로 다시 시도하거나 자기 오프라인 화면</b>을
       보여 줍니다. 그런데 서비스워커가 중간에 끼어들어 「응답 없음」을
       돌려주면, 브라우저는 <b>더 해 볼 것이 없어집니다.</b>
       한 번 끊긴 것이 <b>영구 고장처럼</b> 보이는 이유입니다.

     ▶ 어떻게 고쳤나 — <b>절대로 빈손(undefined)을 돌려주지 않습니다.</b>
         · 캐시에 있으면 그것을 줍니다
         · 화면을 여는 요청(navigate)이면 <b>안내 화면</b>을 줍니다
           (다시 시도 단추가 있습니다)
         · 그 밖(그림·스크립트)이면 504 를 줍니다 — 그 하나만
           빠지고 화면은 열립니다

   ★ 배포할 때마다 아래 CACHE 값만 바꾸면 모든 사용자 캐시가
     자동으로 갱신됩니다. (예: 'opusclam-20260820' → '...20260821')
     ※ 이번에 값을 올렸으므로, 새 파일이 닿는 순간 <b>전에 잘못
        담겼을 수 있는 것들이 모두 지워집니다.</b>

   ★ /api/ 는 <b>건드리지 않습니다</b>(2026-08-20 보탬).
     api/seo 는 봇에게 내어 주는 서버 렌더링 화면입니다. 캐시에
     담기면 엉뚱한 것이 나올 수 있습니다.
   ════════════════════════════════════════════════════════════════ */
var CACHE = 'opusclam-20260820';

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

/* ── 끊겼을 때 보여 줄 안내 화면 ──────────────────────────────
   ★ 바깥 파일을 불러오지 않습니다 — 지금은 <b>아무것도 받을 수
     없는 상황</b>이므로, 글씨·모양을 이 안에 다 넣습니다.
   ★ 「다시 시도」 단추를 반드시 둡니다. 통신이 잠깐 끊긴 것이
     대부분이라, 한 번 누르면 그대로 열립니다. */
function offlinePage() {
  var html =
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>연결이 끊겼습니다 · OPUSCLAM</title><style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;' +
    'justify-content:center;background:#fff;color:#2b2740;' +
    'font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    '-webkit-font-smoothing:antialiased}' +
    '.b{max-width:340px;padding:32px 24px;text-align:center}' +
    '.t{font-size:19px;font-weight:800;letter-spacing:-.02em;margin:0 0 10px}' +
    '.d{font-size:14px;line-height:1.85;color:#6b6880;margin:0 0 22px}' +
    'button{height:44px;padding:0 22px;border:0;border-radius:11px;' +
    'background:#2b2740;color:#fff;font-family:inherit;font-size:14px;' +
    'font-weight:700;cursor:pointer}' +
    '@media(prefers-color-scheme:dark){body{background:#0b0b0b;color:#ededed}' +
    '.d{color:#9a97a8}button{background:#ededed;color:#0b0b0b}}' +
    '</style></head><body><div class="b">' +
    '<p class="t">연결이 잠깐 끊겼어요</p>' +
    '<p class="d">인터넷이 닿지 않아 화면을 받지 못했습니다.<br>' +
    '잠시 뒤 다시 시도해 주세요.</p>' +
    '<button onclick="location.reload()">다시 시도</button>' +
    '</div></body></html>';
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* 외부 도메인(Supabase API·위키백과·jsDelivr·YouTube 등)은
     서비스워커가 관여하지 않고 그대로 통과 → 오래된 데이터 캐시 방지 */
  if (url.origin !== self.location.origin) return;

  /* 서버에서 만들어 내는 것은 담지 않습니다 */
  if (url.pathname.indexOf('/api/') === 0) return;

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
      /* ★ ignoreSearch — 주소 뒤에 ?v=... 가 붙어 들어오면
         똑같은 파일인데도 못 찾습니다. 물음표 뒤는 무시합니다. */
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;

        /* ★ 화면을 여는 요청이면 안내 화면을 줍니다.
           ★ 다른 화면(예: 담아 둔 대문)을 대신 보여 주지 않습니다 —
             주소와 내용이 어긋나면 더 헷갈립니다. */
        if (req.mode === 'navigate') return offlinePage();

        /* ★ 그림·스크립트 하나가 없는 것뿐이면 504 를 줍니다.
           ★ undefined 를 주면 <b>화면 전체가 ERR_FAILED</b> 가 됩니다.
             이것이 이번에 파트너가 겪은 그 일입니다. */
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
