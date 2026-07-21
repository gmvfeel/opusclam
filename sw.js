/* OPUSCLAM service worker — 네트워크 우선, 실패 시 캐시 폴백
   ※ 배포할 때마다 아래 CACHE 값만 바꾸면(예: 날짜) 전 사용자 캐시가 자동 갱신됩니다.
      예) 'opusclam-20260721' → 다음 배포 시 'opusclam-20260722' 처럼 숫자만 변경 */
var CACHE = 'opusclam-20260721';

self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch(err){ return; }

  /* 외부 도메인(Supabase API·위키백과·jsDelivr·YouTube 등)은
     서비스워커가 관여하지 않고 그대로 통과 → 오래된 데이터 캐시 방지 */
  if(url.origin !== self.location.origin) return;

  /* 우리 사이트 파일: 네트워크 우선, 성공 시 캐시에 저장, 실패(오프라인) 시 캐시 폴백 */
  e.respondWith(
    fetch(e.request).then(function(res){
      if(res && res.status === 200 && res.type === 'basic'){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); }).catch(function(){});
      }
      return res;
    }).catch(function(){
      return caches.match(e.request);
    })
  );
});
