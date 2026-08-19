/* ============================================================
   봇을 갈라 서버 렌더링으로 보냅니다
   middleware.js                                  2026-08-19
   ------------------------------------------------------------
   ★ 왜 vercel.json 의 rewrite 로는 안 되었나

     어제 넣은 규칙은 이렇게 생겼습니다 —
       source: "/db/person-view.html" · has: 봇 UA → "/api/seo?kind=person"

     이것이 <두 가지 이유로> 한 번도 안 걸렸습니다.

     ① cleanUrls 가 먼저 튕깁니다
        Vercel 문서 그대로 —
        "Visiting /about.html will redirect to /about."
        즉 봇이 /db/person-view.html?id=1 을 부르면 <308 로>
        /db/person-view?id=1 로 먼저 보내집니다. 그 뒤에 rewrite 를
        따지므로 source 인 ".../person-view.html" 과 더는 맞지 않습니다.

     ② 파일이 rewrite 보다 먼저입니다
        Vercel 문서 그대로 —
        "The source property should NOT be a file because precedence
         is given to the filesystem prior to rewrites being applied."
        db/person-view.html 은 <실제로 있는 파일>이라 언제나 파일이 이깁니다.

     ★ 어제 「/ 에 index.html 이 있으면 rewrite 가 안 듭니다」로 겪은
       것과 <같은 함정>입니다. 인트로는 파일을 옮겨 피했지만 상세 화면
       둘은 파일이 그대로 남아 있었습니다.

   ★ 미들웨어는 왜 되나
     미들웨어는 <redirect·파일·rewrite 그 무엇보다 먼저> 돌아갑니다.
     그래서 308 이 일어나기 전에, 파일이 집히기 전에 가로챌 수 있습니다.

   ★ 사람은 하나도 달라지지 않습니다
     봇이 아니면 next() 로 그냥 흘려보냅니다. 지금까지와 똑같이
     cleanUrls 가 정리하고 원래 화면이 열립니다.

   ★ config.matcher 로 <상세 화면 네 주소에만> 겁니다.
     미들웨어는 안 걸면 모든 요청마다 돌아 돈이 듭니다.
   ============================================================ */

import { next, rewrite } from '@vercel/functions';

/* ── 어느 주소에서만 돌 것인가 ────────────────────────────
   ★ .html 붙은 것과 안 붙은 것을 <둘 다> 적습니다.
     사이트맵·내부 링크는 .html 을 쓰고, cleanUrls 를 거친 뒤에는
     .html 이 없어집니다. 어느 쪽으로 들어와도 잡히게 합니다.

   ★ 대문(/) 도 같은 병이었습니다
     `/` 에는 index.html <파일>이 있어 rewrite 가 안 들었습니다. 그래서
     봇이 대문에 오면 「갈라 보내는 얇은 문」을 보았고, 그 파일에는
     <noindex 가 박혀 있습니다.> 즉 <대문이 색인되지 않고 있었습니다.>
     여기서도 미들웨어가 먼저 가로채 home.html 을 내어 줍니다. */
export const config = {
  matcher: [
    '/en',
    '/ja',
    '/en/:path*',
    '/ja/:path*',
    '/',
    '/index',
    '/index.html',
    /* ★★ 2026-08-19 · DATABASE 아래를 <b>한 줄로</b> 묶습니다.
         목록 여덟 · 상세 여덟 · `.html` 붙은 것과 안 붙은 것까지 하면
         서른두 줄이 됩니다. 한 줄로 두면 갈래를 넓힐 때 여기를
         고칠 일이 없습니다 — 아래 KINDS 에 한 낱말만 더하면 됩니다.
       ★ /db/ 아래 다른 화면(timeline·terms·write…)도 여기 들어오지만
         아래에서 <b>곧바로 next()</b> 로 흘려보냅니다. */
    '/db/:file',
  ],
};

/* ── DATABASE 갈래 ────────────────────────────────────────
   화면 이름이 곧 갈래 이름입니다 —
       /db/venue.html       → 목록  venue-list
       /db/venue-view.html  → 상세  venue
   ★ 새 갈래를 열 때는 <b>이 줄에 한 낱말</b>만 더하면 됩니다
     (api/seo.js 의 LISTS 에도 같은 이름으로 한 칸). */
const KINDS = ['person', 'work', 'venue', 'org', 'school',
               'academic', 'modern', 'foundation'];

/* ── 봇 이름표 ────────────────────────────────────────────
   ★ 소문자로 바꿔 놓고 견주므로 대소문자를 걱정하지 않습니다.
     (어제 vercel.json 에서 [Gg]ooglebot 처럼 적던 것이 이것 때문입니다)
   ★ robots.txt 에서 막아 둔 수집 봇은 여기 넣지 않습니다.
     들어와도 그냥 원래 화면(빈 껍데기)을 봅니다. */
const BOTS = [
  'googlebot', 'google-inspectiontool', 'storebot-google',
  'bingbot', 'yeti', 'daumoa', 'naverbot', 'slurp',
  'duckduckbot', 'baiduspider', 'yandex', 'applebot',
  'facebookexternalhit', 'twitterbot', 'slackbot', 'linkedinbot',
  'kakaotalk-scrap', 'telegrambot', 'discordbot', 'whatsapp',
  'embedly', 'pinterest',
];

function isBot(ua) {
  for (let i = 0; i < BOTS.length; i++) {
    if (ua.indexOf(BOTS[i]) !== -1) return true;
  }
  return false;
}

/* ── 다국어 주소 ──────────────────────────────────────────
   ★★ 2026-08-19 · <b>되살린 것입니다.</b>

     `/en/db/person.html` 같은 주소는 <b>en/ 폴더가 있어서가 아니라</b>
     vercel.json 의 `/en/:path*` → `/:path*` 규칙이 한국어 파일을
     그대로 내어 주고, assets/i18n.js 가 주소 앞의 `/en/` 을 보고
     글자만 바꾸는 얼개였습니다.

     그 여섯 줄이 <b>8/18 vercel.json 을 다시 쓸 때 딸려 나갔습니다</b>
     (23762ab 에는 있고 93b2df3 부터 없음). 그래서 다국어를 고르면
     모든 화면이 404 였습니다.

   ★ 왜 vercel.json 으로 되돌리지 않았나 — <b>그때는 cleanUrls 가
     꺼져 있었습니다.</b> 지금은 켜져 있어 `.html` 이 붙은 목적지는
     없는 이름입니다(대문이 `/home.html` 로 404 났던 그 까닭).
     옛 규칙을 그대로 되돌리면 또 404 가 납니다.
     미들웨어는 cleanUrls 보다 먼저 돌므로 이 문제를 지납니다.

   ★ 글자 자리만 봅니다 — 정규식을 쓰지 않습니다. */
const LANGS = ['/en', '/ja'];

function stripLang(p) {
  for (let i = 0; i < LANGS.length; i++) {
    const pre = LANGS[i];
    if (p === pre || p === pre + '/') return '/';
    if (p.indexOf(pre + '/') === 0) return p.slice(pre.length);
  }
  return null;
}

/* cleanUrls 가 켜져 있으므로 `.html` 을 뗀 이름이 진짜 주소입니다 */
function dropHtml(p) {
  return (p.length > 5 && p.slice(-5) === '.html') ? p.slice(0, -5) : p;
}

export default function middleware(request) {
  const url = new URL(request.url);

  /* ── 다국어가 먼저입니다 ─────────────────────────────────
     사람이든 봇이든 같습니다. 주소는 /en/... 그대로 남고(rewrite),
     i18n.js 가 그것을 보고 영어·일본어로 바꿉니다. */
  const bare = stripLang(url.pathname);
  if (bare !== null) {
    /* ★ `/en/` · `/ja/` 는 <b>포털 메인으로 곧바로</b> 보냅니다.
         `/` 로 보내면 대문의 「얇은 문」(index.html)이 자바스크립트로
         `/home.html` 로 넘겨 버려 <b>주소에서 /en/ 이 떨어집니다.</b>
         영어를 골랐는데 한국어로 되돌아가는 꼴이 됩니다. */
    const to = (bare === '/') ? '/home' : dropHtml(bare);
    return rewrite(new URL(to + url.search, request.url));
  }

  const ua = (request.headers.get('user-agent') || '').toLowerCase();

  /* 사람 → 손대지 않습니다 */
  if (!isBot(ua)) return next();

  /* ── 대문 ──────────────────────────────────────────────
     봇에게는 「얇은 문」이 아니라 <포털 메인>을 곧바로 줍니다.
     주소는 https://opusclam.com/ 그대로입니다(rewrite 라서).

     ★★ 2026-08-19 고침 — <b>`/home.html` 이 아니라 `/home` 입니다.</b>
       cleanUrls: true 가 켜져 있으면 home.html 은 <b>`/home` 이라는
       이름으로만 놓입니다.</b> `/home.html` 은 실제로는 없는 주소여서
       (있는 것은 그리로 보내는 308 규칙뿐입니다) 미들웨어가 그리로
       넘기면 <b>404</b> 가 났습니다. 서치 콘솔 실시간 테스트에
       「찾을 수 없음(404)」로 잡혔습니다.
       ★ cleanUrls 를 끄면 이 줄도 `.html` 로 되돌려야 합니다. */
  const p = url.pathname;
  if (p === '/' || p === '/index' || p === '/index.html') {
    return rewrite(new URL('/home', request.url));
  }

  /* ── DATABASE 목록·상세 ────────────────────────────────
     ★★ 2026-08-19 · 서치 콘솔이 인물 상세에 「참조 페이지 : 감지된
       페이지 없음」이라 했습니다 — <b>걸어 들어갈 링크가 없습니다.</b>
       메뉴도 목록도 자바스크립트라 봇 눈에는 안 보이기 때문입니다.
       봇에게만 목록을 서버에서 그려 주면 길이 생깁니다.
     ★ 쪽 번호 `p` 는 <b>사람 목록도 알아듣는 것</b>입니다
       (assets/db-list.js). 그래서 같은 주소를 그대로 씁니다.
     ★ 화면 이름에서 갈래를 얻습니다 — 정규식 없이 글자 자리만. */
  if (p.indexOf('/db/') !== 0) return next();

  let f = p.slice(4);                                  /* '/db/' 를 뗍니다 */
  if (f.length > 5 && f.slice(-5) === '.html') f = f.slice(0, -5);
  if (f.indexOf('/') !== -1) return next();            /* 더 깊은 자리는 아닙니다 */

  const isView = f.length > 5 && f.slice(-5) === '-view';
  const kind = isView ? f.slice(0, -5) : f;
  if (KINDS.indexOf(kind) === -1) return next();       /* 아직 안 연 화면 */

  const to = new URL('/api/seo', request.url);

  /* 목록 — 쪽 번호는 있으면 그대로 넘깁니다 */
  if (!isView) {
    to.searchParams.set('kind', kind + '-list');
    const pg = url.searchParams.get('p') || '';
    if (pg !== '' && /^[0-9]+$/.test(pg)) to.searchParams.set('p', pg);
    return rewrite(to);
  }

  /* 상세 — 번호가 없거나 숫자가 아니면 그냥 넘깁니다.
     목록 화면으로 보내면 같은 내용이 여러 주소로 잡힙니다. */
  const id = url.searchParams.get('id') || '';
  if (id === '' || !/^[0-9]+$/.test(id)) return next();
  to.searchParams.set('kind', kind);
  to.searchParams.set('id', id);
  return rewrite(to);
}
