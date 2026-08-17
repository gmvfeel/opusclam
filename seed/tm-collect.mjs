/* ============================================================
   OPUSCLAM 정보SPOT — 해외 공연정보 (Ticketmaster Discovery API)
   seed/tm-collect.mjs

   ── 왜 만들었나 ─────────────────────────────────────────────
   공연정보는 KOPIS 로 <국내>만 채워지고 있었습니다. 해외 공연은
   공공데이터가 없어 길이 막혀 있었는데, Ticketmaster 의 Discovery API
   가 무료로 열려 있습니다 (하루 5,000회 · 초당 5회).

   ── 무엇을 담나 ─────────────────────────────────────────────
   나라별로 <클래식 계열>만 받습니다. 응답에 붙어 오는 갈래(genre ·
   subGenre)를 다시 검사해 두 겹으로 거릅니다 — 검색 낱말만 믿으면
   록·팝 공연이 섞입니다(학술DB 에서 topic_raw 를 믿었다가 겪은 일과
   같은 성질입니다).

   ── 지어내지 않습니다 ───────────────────────────────────────
   가격·좌석·프로그램은 적지 않습니다. 해마다 바뀌고 API 가 주는 값도
   나라마다 다릅니다. 본문에는 <받은 것만> 적고 예매는 원래 사이트로
   보냅니다.

   ── 같은 것을 두 번 담지 않습니다 ───────────────────────────
   Ticketmaster 가 준 공연 번호를 spot.tm_id 에 넣고 그것을 열쇠로
   병합합니다(on_conflict=tm_id). 그래서 여러 번 돌려도 늘어나지
   않고 <바뀐 것만 갱신>됩니다.
     ※ 먼저 sql/spot-tm-id-지금돌리세요.sql 을 돌려 칸과 unique
       인덱스를 만들어 두셔야 합니다.

   ── 지울 수 있게 표시를 남깁니다 ────────────────────────────
     keywords 에 'TM' 이 들어갑니다.
       delete from spot where section='공연정보' and region='해외'
         and keywords like '%TM%';

   ── 쓰는 법 ────────────────────────────────────────────────
     node seed/tm-collect.mjs                       세어만 봅니다(기본)
     node seed/tm-collect.mjs --save                실제로 담습니다
     node seed/tm-collect.mjs --months=6            앞으로 몇 달까지
     node seed/tm-collect.mjs --countries=US,GB,DE  나라 고르기
     node seed/tm-collect.mjs --limit=200           나라마다 최대 몇 건
     node seed/tm-collect.mjs --list=keep           담을 것 제목을 모두 찍습니다
     node seed/tm-collect.mjs --list=drop           버린 것 제목을 모두 찍습니다
     node seed/tm-collect.mjs --merge=no            회차를 묶지 않고 날짜마다 한 줄
     node seed/tm-collect.mjs --strict              갈래에 클래식 신호를 반드시 요구
     node seed/tm-collect.mjs --loose               갈래 잣대를 느슨하게
     node seed/tm-collect.mjs --debug               한 줄씩 자세히
     node seed/tm-collect.mjs --base=http://…       (시험용) 다른 주소로

   ── 필요한 환경변수 ────────────────────────────────────────
     TM_API_KEY                 Ticketmaster 개발자 포털의 Consumer Key
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY  (또는 SUPABASE_SERVICE_KEY)
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TM_KEY = process.env.TM_API_KEY;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);

const SAVE   = !!args.save;
const DEBUG  = !!args.debug;
const LOOSE  = !!args.loose;
const MONTHS = Number(args.months || 6);
const LIMIT  = Number(args.limit || 800);        /* 나라마다 최대 */
const MERGE = args.merge === 'no' ? false : true;   /* 같은 공연의 회차를 묶습니다 */
/* ★ --list=keep  담을 것의 제목을 모두 찍습니다
   ★ --list=drop  버린 것의 제목을 모두 찍습니다
     ─────────────────────────────────────────────────────────────
     잣대를 고치는 일은 <b>눈으로 봐야</b> 합니다. 「버린 것에 클래식이
     279건」처럼 숫자만 보면 그것이 잘 버린 것인지 알 수 없습니다.
     학술DB 를 정리할 때 「삭제 전 목록을 눈으로 확인」한 것이
     번번이 큰 사고를 막았습니다 — 같은 방식입니다. */
const LIST = String(args.list || '');
const STRICT = !!args.strict;      /* 갈래에 클래식 신호를 반드시 요구합니다 */
const BASE   = String(args.base || 'https://app.ticketmaster.com');

/* 담을 나라 — 클래식 공연이 많고 Ticketmaster 가 다루는 곳부터.
   ※ 나라를 늘릴 때는 호출 수를 함께 보십시오. 한 나라에 최대
     (LIMIT/200 + 1) 번 부릅니다. 열 나라면 서른 번쯤이니 하루 한도
     5,000 회에는 넉넉합니다. */
/* ★ 2026-08-14 · 첫 실행 결과를 보고 나라를 손봤습니다
     ─────────────────────────────────────────────────────────────
     자료가 실제로 있는 곳만 남깁니다 (첫 실행에서 센 것) —
       미국 400↑ · 프랑스 400↑ · 독일 311 · 영국 220 · 캐나다 72
       네덜란드 41 · 스페인 37
     뺀 곳 — 오스트리아 <b>1건</b> · 이탈리아 20 · 호주 15.
       특히 오스트리아는 빈 필·빈 국립오페라가 <b>자체 판매</b>라
       이 API 에 없습니다. 호출만 늘고 얻는 것이 없습니다.
   ★ 자체 판매하는 명문 악단(베를린 필 등)은 이 길로는 영영 오지
     않습니다 — 나중에 공식 캘린더 피드로 따로 붙일 자리입니다. */
const COUNTRIES = String(args.countries || 'US,FR,DE,GB,CA,NL,ES')
  .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

/* 나라 이름 — 화면에 한국어로 보여 주기 위해서입니다.
   목록에 없는 나라는 API 가 준 영문 이름을 그대로 씁니다. */
const COUNTRY_KO = {
  US: '미국', GB: '영국', DE: '독일', AT: '오스트리아', FR: '프랑스',
  NL: '네덜란드', IT: '이탈리아', ES: '스페인', CA: '캐나다', AU: '호주',
  NZ: '뉴질랜드', IE: '아일랜드', BE: '벨기에', DK: '덴마크', SE: '스웨덴',
  NO: '노르웨이', FI: '핀란드', PL: '폴란드', MX: '멕시코', CH: '스위스',
  AE: '아랍에미리트', JP: '일본', SG: '싱가포르',
};

/* 통과시킬 갈래 — Ticketmaster 의 genre · subGenre 이름입니다.
   ★ 검색 낱말(classificationName)만으로는 넓게 걸립니다. 응답에 붙어
     오는 이름을 다시 봐서 두 겹으로 거릅니다. */
const OK_GENRE = [
  'classical', 'opera', 'symphonic', 'chamber', 'choral', 'recital',
  'baroque', 'orchestral', 'oratorio', 'lieder', 'sacred',
];

/* ★ 2026-08-14 · <b>버릴 갈래</b>를 따로 둡니다 (첫 실행 로그를 보고 더함)
     ─────────────────────────────────────────────────────────────
     첫 실행에서 1,120건을 담겠다고 했는데 표본 다섯 가운데 셋이 클래식이
     아니었습니다 — 영화음악·크로스오버 바이올린·「Brahms X Radiohead」.
     걸린 갈래를 세어 보니 Pop 50 · Jazz 42 · Theatre 164 가 섞여 있었습니다.
   ★ 왜 이런 일이 생기나
     한 공연에 갈래가 <b>여럿</b> 붙습니다. 그중 하나만 Classical 이면
     통과하도록 두었더니, Pop 이면서 Classical 인 것들이 다 들어왔습니다.
   ▶ 버릴 갈래가 하나라도 붙어 있으면 <b>통과시키지 않습니다</b>
     (버리는 쪽이 통과보다 힘이 셉니다). */
const BAD_GENRE = [
  'pop', 'rock', 'jazz', 'country', 'hip-hop', 'hip hop', 'rap', 'r&b',
  'blues', 'folk', 'electronic', 'dance', 'latin', 'metal', 'punk',
  'reggae', 'soul', 'world', 'comedy', 'children', 'musical', 'variety',
  'film', 'soundtrack', 'video game', 'k-pop', 'j-pop', 'new age',
  /* ★ 2026-08-14 · 두 번째 실행에서 드러난 것
       프랑스에서 「Chanson Francaise」가 94건 걸렸습니다 — 샹송은
       대중음악입니다. 프랑스가 474건으로 가장 많았던 까닭이 이것으로
       보입니다. 카바레·풍자극도 함께 막습니다. */
  'chanson', 'cabaret', 'humour', 'humor', 'stand-up', 'tango',
  'flamenco', 'celtic', 'gospel', 'christmas', 'holiday',
];
/* ★ 갈래가 아니라 <b>자리 표시</b>에 가까운 이름들 (2026-08-14)
     Miscellaneous · Community/Civic · Undefined · Other · Event Style 은
     「무엇인지 적지 않았다」는 뜻입니다. 이것 때문에 버리면 안 됩니다 —
     오르가니스트 Anna Lapwood 공연이 이 갈래로 걸려 버려졌습니다.
   ▶ 이 이름들은 <b>클래식 신호로도, 버릴 신호로도</b> 세지 않습니다. */
const NEUTRAL_GENRE = [
  'undefined', 'other', 'miscellaneous', 'community/civic', 'community',
  'event style', 'concert', 'arts & theatre', 'music', 'spectacular',
];

/* ★ 공연장으로 걸러내기 (2026-08-14)
     「Wisconsin State Fair」에서 열린 크로스오버 바이올린 공연이
     갈래로는 걸리지 않고 통과했습니다. 박람회장·카지노 무대는
     클래식 공연장이 아니므로 자리로 막습니다. */
const VENUE_BLOCK = [
  'state fair', 'county fair', 'fairgrounds', 'casino', 'racetrack',
  'speedway', 'brewery', 'winery', 'tavern', 'bar &',
  /* 재즈 클럽 — 「Emily Bear · Blue Note London」이 이 자리였습니다 */
  'blue note', 'jazz club', 'comedy club', 'nightclub',
];

/* 갈래가 클래식이라도 이런 낱말이 제목에 있으면 버립니다 —
   「영화음악 콘서트」·「게임음악」처럼 결이 다른 것들입니다.
   ★ 2026-08-14 · 첫 실행에서 새어 나온 것을 더했습니다
        film music / music of / soundtrack / in concert(영화 상영 연주)
        candlelight(대중가요 편곡이 많은 시리즈)
   ★ 밴드 이름을 하나씩 막지는 않습니다 — 끝이 없습니다.
     「Brahms X Radiohead」 같은 협업물은 어드민에서 숨기는 편이 낫습니다. */
const TITLE_BLOCK = [
  'tribute', 'rock', 'pop ', 'k-pop', 'jazz night', 'video game',
  'movie', 'film score', 'film music', 'music of', 'soundtrack',
  'live in concert', 'in concert', 'cinema', 'disney', 'harry potter',
  'star wars', 'anime', 'gospel brunch', 'dj ', 'candlelight',
  'vs.', 'sing-along', 'singalong', 'holiday pops', 'christmas pops',
  /* ★ 2026-08-14 · 세 번째 실행에서 새어 든 것들
       ministry of sound  클럽음악을 관현악으로 편곡한 시리즈(영국)
       miyazaki / ghibli  지브리 영화음악
       homenatge/homage/tribute  헌정 공연 (대개 대중음악)
       dinner/cena/brunch  식사와 함께 하는 공연 — 공연이 곁들이입니다
     ★ 사람 이름을 하나씩 막지는 않습니다. 끝이 없습니다.
       Stephan Moccio 처럼 이름만 있는 것은 <b>어드민에서 숨기는</b> 편이
       낫습니다 — 그래서 아래 --list 로 목록을 뽑아 볼 수 있게 했습니다. */
  'ministry of sound', 'miyazaki', 'ghibli', 'homenatge', 'homenaje',
  'homage', 'dinner', ' cena', 'brunch', 'silent disco', 'yoga',
  'immersive', 'club classics', 'ibiza',
  /* ★ 2026-08-14 · 영국 99건을 눈으로 훑고 더한 것들
       영화 상영 연주회가 가장 많았습니다 — 반지의 제왕 · 나홀로집에 ·
       위쳐 · 소닉 · 드래곤 길들이기 · 카지노 로얄.
       「film with live orchestra」는 그 갈래를 통째로 가리키는 말입니다. */
  'film with live orchestra', 'lord of the rings', 'home alone',
  'witcher', 'sonic ', 'train your dragon', 'casino royale',
  'game of thrones', 'aardman', 'songbook', 'proms in',
  'rocks -', ' rocks ',
  /* ★ 2026-08-14 · <b>담을 것</b> 80건을 눈으로 훑고 더한 것들
       ─────────────────────────────────────────────────────────
       mystery ensemble  영화음악·팝 편곡을 연주하는 단체입니다.
                         존 윌리엄스 · 팀 버튼 · 비발디 편곡이 모두
                         이 이름으로 옵니다 — 단체 이름으로 막는 편이
                         낱말을 하나씩 막는 것보다 확실합니다.
       classically       「Classically Kate Bush」처럼 대중가요를
                         관현악으로 편곡한 시리즈입니다.
       sing a-long       「Big Christmas Sing A-Long」 — 관객이 함께
                         부르는 자리입니다(앞서 넣은 singalong 과
                         글자가 달라 걸리지 않았습니다).
       hans zimmer · john williams · tim burton  영화음악입니다.
       kingdom choir     가스펠 합창단입니다. */
  'mystery ensemble', 'classically ', 'sing a-long', 'sing-a-long',
  'hans zimmer', 'john williams', 'tim burton', 'kingdom choir',
  'kate bush', 'a kingdom christmas', 'christmas sing',

  /* ★ 2026-08-14 · <b>사람 이름으로 막는 것</b> — 아껴서 씁니다
       ─────────────────────────────────────────────────────────
       이름만 적힌 공연은 갈래도 Classical, 공연장도 정상 극장이라
       코드로는 가릴 길이 없습니다. 그래서 <b>목록을 뒤덮는 것</b>만
       골라 막습니다. 영국 한 나라에서 캐서린 젠킨스가 26건, 프랭크
       시나트라 헌정이 여러 건이었습니다.

       ★ 어떤 잣대로 골랐나 — <b>레퍼토리</b>를 봤습니다
         katherine jenkins  클래식 창법이지만 부르는 것은 대중가요
         collabro           뮤지컬 보컬 그룹
         frank sinatra      재즈·스탠더드
         jamie duffy · gibran alcocer  누리소통망에서 인기 있는
                            네오클래식 피아노 — 연주회 성격이 다릅니다

       ★ 반대로 <b>남긴</b> 것도 있습니다
         andre rieu         요한 슈트라우스 왈츠 — 레퍼토리가 클래식
         max richter        비발디 사계를 다시 쓴 현대 작곡가

       ★ 이 목록은 <b>길게 늘리지 않습니다.</b> 이름을 하나씩 막는 일은
         끝이 없습니다. 여기 없는 것이 눈에 걸리면 어드민에서 숨기는
         편이 맞습니다(판단이 필요한 일은 도구로). */
  'katherine jenkins', 'collabro', 'frank sinatra', 'jamie duffy',
  'gibran alcocer',
];

/* ★ <b>티켓 상품</b>은 공연이 아닙니다 (2026-08-14)
     ─────────────────────────────────────────────────────────────
     같은 공연의 좌석 등급을 <b>따로 파는 항목</b>이 함께 옵니다 —
       「Venue Premium - …」 · 「… - Premium Tickets」 · 「Live Lounge …」
     이것은 공연이 아니라 상품이므로 목록에 낼 것이 아닙니다.
     ★ 이 낱말은 제목 <b>어디에 있어도</b> 버립니다. 갈래 검사보다
       먼저 봅니다 — 「Venue Premium - Anna Lapwood」처럼 정통
       연주자여도 그 항목 자체는 상품이기 때문입니다. */
const PRODUCT_WORDS = [
  'venue premium', 'premium tickets', 'premium package', 'live lounge',
  'vip package', 'hospitality package', 'meet & greet', 'meet and greet',
  'car park', 'parking', 'gift voucher', 'season ticket',
  /* ★ 2026-08-14 · 영국 목록에서 더 나온 상품 항목
       premium ticket(단수) · hotel experience · weekly/day ticket */
  'premium ticket', 'hotel experience', 'weekly ticket', 'day ticket',
  'travel package', 'coach travel',
];

/* ★ 제목 모양으로 걸러내는 것 — 낱말 목록으로는 못 잡는 것들
     「CSO: Brahms X Radiohead」처럼 <b>사이에 x 를 둔 협업물</b>은
     대중음악과 함께 하는 공연이 대부분입니다. 밴드 이름을 하나씩
     막는 것은 끝이 없으므로 <b>모양</b>으로 잡습니다.
   ※ 정통 공연 제목은 「Brahms: Symphony No.1」처럼 쓰므로 이 모양에
     걸리지 않습니다. */
const TITLE_RE = [
  /\s[x×]\s/i,          /* A x B  협업 */
  /\bvs\b/i,            /* A vs B */
  /* ★ 2026-08-14 · 「rave」를 <b>글자 포함</b>으로 막았더니
       <b>Ravel</b>(라벨)·Stravinsky 가 함께 걸려 사라졌습니다.
       낱말 경계를 붙여 「rave」라는 낱말일 때만 막습니다.
     ★ 짧은 낱말은 반드시 이 자리(정규식)에 두어야 합니다 —
       글자 포함으로 막으면 엉뚱한 것이 함께 걸립니다. */
  /\brave\b/i,          /* 레이브 파티 (Ravel 은 걸리지 않습니다) */
  /\bpops?\b/i,         /* Pops 콘서트 (Popper 같은 이름은 안 걸립니다) */
];

/* ── 준비가 되었는지 ─────────────────────────────────────── */
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}
if (!TM_KEY) {
  console.error('환경변수 TM_API_KEY 가 필요합니다.');
  console.error('developer.ticketmaster.com → 가입 → My Apps 에서 Consumer Key 를 받으실 수 있습니다.');
  process.exit(1);
}

/* ── 도우미 ──────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


/* ── 담은 뒤 잇기 (2026-08-18) ────────────────────────────
   ★ 담은 <b>바로 뒤에</b> 공연장DB·단체DB 와 이어 둡니다. 이러지
     않으면 새로 들어온 공연은 아무것과도 이어지지 않은 채 쌓입니다.
   ★ 잇는 규칙은 <b>DB 쪽 함수에</b> 있습니다 —
       oc_link_spot_venue  공연장 (공연 하나에 하나)
       oc_link_spot_org    단체   (공연 하나에 여럿일 수 있음)
     수집기 둘이 같은 규칙을 쓰게 하려는 것입니다. 규칙을 고칠 때
     SQL 한 곳만 고치면 됩니다.
   ★ 여기서 <b>멈추지 않습니다</b> — 잇기가 실패해도 담은 것은
     그대로 남고, 다음 수집 때 다시 이어집니다.
   ★ 하나가 실패해도 <b>나머지는 이어 봅니다.</b> */
async function callLink(fn, label) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!r.ok) { console.log(`   ${label} 잇기를 건너뜁니다 — ${r.status}`); return; }
    const n = await r.json();
    console.log(`   ▶ ${label} 쪽에 새로 이은 공연 : ${n}건`);
  } catch (e) {
    console.log(`   ${label} 잇기를 건너뜁니다 — ${e.message}`);
  }
}

async function linkVenues() {
  await callLink('oc_link_spot_venue', '공연장');
  await callLink('oc_link_spot_org',   '단체');
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* Ticketmaster 호출 — 초당 5회 제한이 있어 사이를 띄웁니다.
   429(너무 많이 불렀습니다)가 오면 기다렸다 한 번 더 갑니다. */
async function tm(params, tries = 0) {
  const q = new URLSearchParams({ ...params, apikey: TM_KEY }).toString();
  const url = `${BASE}/discovery/v2/events.json?${q}`;
  const res = await fetch(url);
  if (res.status === 429 && tries < 3) {
    const wait = 3000 * (tries + 1);
    console.log(`   … 너무 빨리 불렀습니다 — ${wait / 1000}초 기다립니다`);
    await sleep(wait);
    return tm(params, tries + 1);
  }
  if (!res.ok) throw new Error(`Ticketmaster ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/* ============================================================
   깨진 물음표를 <b>되살립니다</b> (2026-08-14 · 파트너 지적)
   ------------------------------------------------------------
   ★ 무엇이 문제였나
     화면에 「The Cleveland Orchestra: Prokofiev<b>???</b>s Romeo &
     Juliet」로 나왔습니다. 처음에는 GitHub 로그 화면이 못 그리는
     것으로 봤지만, 실제 화면에도 그대로 나와 <b>받은 값 자체가</b>
     그렇다는 것이 드러났습니다. 아포스트로피(’)가 물음표 셋으로
     바뀌어 오는 것입니다 — 보내는 쪽에서 생긴 일이라 우리가 막을
     길은 없고, <b>받은 뒤에 되살리는</b> 수밖에 없습니다.

   ★ 어떻게 되살리나
     ① 「글자 + ??? + s(또는 t·re·ve·ll·d·m)」 → 아포스트로피로
        Prokofiev???s → Prokofiev’s · Don???t → Don’t
     ② 그 밖에 남은 연속 물음표는 <b>지웁니다</b>
        Mozart ??? Requiem → Mozart Requiem
     ★ 물음표가 <b>하나</b>일 때는 손대지 않습니다 —
        「What Is Music?」·「Quo Vadis?」는 제 물음표입니다.

   ★ 파이썬으로 <b>양방향 검증</b>을 먼저 했습니다
     고쳐야 하는 여덟 가지와 건드리면 안 되는 아홉 가지(Boléro ·
     Dvořák · Saint-Saëns 등)를 함께 넣어 모두 통과한 뒤 옮겼습니다.
   ============================================================ */
const RE_APOS  = /([A-Za-z\u00C0-\u024F])\?{2,3}(s|t|re|ve|ll|d|m)\b/g;
const RE_MULTI = /\s*\?{2,}\s*/g;

function fixQ(v) {
  var t = String(v == null ? '' : v);
  if (t.indexOf('??') < 0) return t;          /* 대부분은 여기서 끝냅니다 */
  t = t.replace(RE_APOS, function (m, a, b) { return a + '\u2019' + b; });
  t = t.replace(RE_MULTI, ' ');
  return t.replace(/\s{2,}/g, ' ').trim();
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ── 걸러내기 ───────────────────────────────────────────── */
function genreNames(ev) {
  const out = [];
  for (const c of ev.classifications || []) {
    for (const k of ['segment', 'genre', 'subGenre', 'type', 'subType']) {
      const n = c[k] && c[k].name;
      if (n) out.push(String(n));
    }
  }
  return out;
}

function isClassical(ev) {
  const rawName = String(ev.name || '');
  const lower = rawName.toLowerCase();

  /* ⓞ 티켓 상품이면 공연이 아닙니다 — 가장 먼저 봅니다 */
  if (PRODUCT_WORDS.some((w) => lower.includes(w))) return false;

  /* 갈래 이름 — 「무엇인지 적지 않았다」는 뜻의 이름은 셈에서 뺍니다.
     그것들이 섞여 있으면 판단이 흐려집니다(Anna Lapwood 사례). */
  const all = genreNames(ev).map((s) => s.toLowerCase());
  const names = all.filter((n) => !NEUTRAL_GENRE.some((g) => n === g || n.includes(g)));

  /* ① 버릴 갈래가 하나라도 있으면 끝 — 통과보다 힘이 셉니다 */
  if (names.some((n) => BAD_GENRE.some((g) => n.includes(g)))) return false;

  /* ② 클래식 신호가 있어야 합니다.
     ★ 다만 갈래가 <b>전부 「적지 않았다」</b>인 경우(Undefined ·
       Community/Civic 등)에는 신호를 요구하지 않습니다.
       ─────────────────────────────────────────────────────────
       오르가니스트 Anna Lapwood 공연이 그런 모양이어서 버려졌습니다.
       이 목록은 <b>검색을 Classical 로 걸어</b> 받아 온 것이므로,
       Ticketmaster 가 이미 클래식으로 분류한 것들입니다. 갈래 칸이
       비었다는 이유로 버리면 <b>이름만 적힌 정통 연주회</b>를 잃습니다.
     ★ 그 대신 제목·공연장 검사는 그대로 지나야 합니다(아래 ③④).
     ★ 이 판단이 넓다고 보시면 --strict 를 붙이십시오 — 그때는
       갈래에 클래식 신호가 <b>반드시</b> 있어야 합니다.
       (그러면 「Frank Sinatra & Friends」 같은 것도 함께 막히지만
        이름만 적힌 정통 공연도 함께 사라집니다) */
  const hit = names.some((n) => OK_GENRE.some((g) => n.includes(g)));
  const blank = names.length === 0;          /* 갈래가 전부 「적지 않았다」 */
  if (!hit && !(blank && !STRICT) && !LOOSE) return false;

  /* ③ 제목에 막을 낱말·모양이 있으면 버립니다 */
  if (TITLE_BLOCK.some((w) => lower.includes(w))) return false;
  if (TITLE_RE.some((re) => re.test(rawName))) return false;

  /* ④ 공연장이 클래식을 하는 자리인지 */
  const v = (ev._embedded && ev._embedded.venues && ev._embedded.venues[0]) || {};
  const vn = String(v.name || '').toLowerCase();
  if (vn && VENUE_BLOCK.some((w) => vn.includes(w))) return false;

  return hit || blank || LOOSE;
}

/* 가장 큰 16:9 그림 — 없으면 가장 큰 것 */
function pickImage(ev) {
  const imgs = (ev.images || []).filter((i) => i && i.url);
  if (!imgs.length) return null;
  const wide = imgs.filter((i) => i.ratio === '16_9');
  const pool = wide.length ? wide : imgs;
  pool.sort((a, b) => (b.width || 0) - (a.width || 0));
  return pool[0].url;
}

/* ── 담을 모양으로 ──────────────────────────────────────── */
function toRow(ev, cc) {
  const v = (ev._embedded && ev._embedded.venues && ev._embedded.venues[0]) || {};
  const dates = ev.dates || {};
  const start = dates.start || {};
  const df = start.localDate || null;
  const dt = (dates.end && dates.end.localDate) || null;

  const countryKo = COUNTRY_KO[cc]
    || (v.country && (v.country.name || v.country.countryCode))
    || cc;
  const cityName = (v.city && v.city.name) ? fixQ(v.city.name) : null;
  const genres = genreNames(ev).filter((g) => !/^music$/i.test(g));
  /* ★ 2026-08-14 · 주최 이름에 <b>쓸모 없는 값</b>이 옵니다 (파트너 지적)
       화면에 「PROMOTER NOT DEFINED」가 그대로 보였습니다. 뜻이 없는
       값은 <b>비워 두는 편</b>이 낫습니다 — 빈 칸은 화면에서 아예
       사라지지만, 이런 글자는 남아서 자료가 엉성해 보입니다. */
  const rawPromoter = (ev.promoter && ev.promoter.name)
    || (ev.promoters && ev.promoters[0] && ev.promoters[0].name)
    || '';
  const promoter = (function (v) {
    const t = String(v || '').trim();
    if (!t) return null;
    const low = t.toLowerCase();
    if (low.includes('not defined') || low.includes('undefined')
        || low.includes('no promoter') || low === 'n/a' || low === '-') return null;
    return fixQ(t);
  })(rawPromoter);
  const timeText = start.localTime ? String(start.localTime).slice(0, 5) : null;

  /* ★ 깨진 물음표는 <b>한 번만</b> 되살려 아래 모두에서 함께 씁니다
       (제목·본문·표에 같은 값이 들어가므로 곳마다 부르면 어긋납니다) */
  const venueName = v.name ? fixQ(v.name) : null;

  const bits = [];
  if (venueName) bits.push(venueName);
  if (cityName) bits.push(cityName);
  if (countryKo) bits.push(countryKo);
  if (df) bits.push(dt && dt !== df ? `${df} ~ ${dt}` : df);

  const body =
      '<p>' + esc(bits.join(' · ')) + '</p>'
    + '<h3>알아두면 좋은 것</h3><table>'
    + (venueName ? `<tr><th>공연장</th><td>${esc(venueName)}</td></tr>` : '')
    + (cityName ? `<tr><th>도시</th><td>${esc(cityName)}</td></tr>` : '')
    + `<tr><th>나라</th><td>${esc(countryKo)}</td></tr>`
    + (df ? `<tr><th>날짜</th><td>${df}${dt && dt !== df ? ' ~ ' + dt : ''}${timeText ? ' ' + timeText : ''}</td></tr>` : '')
    + (genres.length ? `<tr><th>갈래</th><td>${esc(genres.join(' · '))}</td></tr>` : '')
    + (promoter ? `<tr><th>주최</th><td>${esc(promoter)}</td></tr>` : '')
    + '</table>'
    + '<p>예매와 자세한 안내는 아래 원본 페이지에서 확인하실 수 있습니다. '
    + '값과 좌석은 자주 바뀌므로 이곳에 적지 않습니다.</p>';

  return {
    section: '공연정보',
    category: '클래식',
    region: '해외',
    country: countryKo,
    city: cityName,
    title: fixQ(ev.name || ''),
    body,
    date_from: df,
    /* 하루 공연이면 끝나는 날을 <b>같은 날로</b> 채웁니다 — 위 mergeRuns 의
       주석과 같은 까닭입니다(진행중·예정 탭이 date_to 로 자릅니다) */
    date_to: dt || df,
    date_text: df ? (dt && dt !== df ? `${df} ~ ${dt}` : df) : null,
    venue_name: venueName,
    thumb_url: pickImage(ev),
    link_url: ev.url || null,
    organizer: promoter,
    tm_id: ev.id,
    source: 'Ticketmaster Discovery API',
    source_url: ev.url || 'https://www.ticketmaster.com/',
    keywords: [...genres, v.name, cityName, countryKo, '공연정보', 'TM']
      .filter(Boolean).join(','),
    author_name: '오퍼스클램',
    hidden: false,
  };
}

/* ── 나라 하나 받기 ─────────────────────────────────────── */
async function fetchCountry(cc, from, to) {
  const SIZE = 200;                       /* 한 번에 받는 최대 */
  const pages = Math.min(Math.ceil(LIMIT / SIZE), 5);   /* 1,000번째까지만 볼 수 있습니다 */
  const rows = [];
  let got = 0, dropped = 0;
  /* ★ 2026-08-14 · <b>담은 것</b>과 <b>버린 것</b>의 갈래를 따로 셉니다
       전에는 둘을 섞어 세어서, 통계에 Pop·Film 이 보여도 그것이
       「버렸다」는 뜻인지 「들어왔다」는 뜻인지 알 수 없었습니다.
       담은 것의 갈래만 보면 <b>무엇이 새어 들어왔는지</b> 바로 보입니다. */
  const genreTally = new Map();      /* 담은 것 */
  const dropTally = new Map();       /* 버린 것 */
  const dropList = [];               /* --list=drop 일 때 제목을 모읍니다 */

  for (let page = 0; page < pages; page++) {
    let json;
    try {
      json = await tm({
        countryCode: cc,
        classificationName: 'Classical',
        startDateTime: `${from}T00:00:00Z`,
        endDateTime: `${to}T23:59:59Z`,
        size: String(SIZE),
        page: String(page),
        sort: 'date,asc',
        locale: '*',
      });
    } catch (e) {
      console.log(`   ✘ ${cc} ${page}쪽 — ${e.message}`);
      break;
    }

    const list = (json._embedded && json._embedded.events) || [];
    if (!list.length) break;

    for (const ev of list) {
      got++;
      const gs = genreNames(ev).filter((g) => !/^music$/i.test(g));
      const ok = isClassical(ev);
      const tally = ok ? genreTally : dropTally;
      for (const g of gs) tally.set(g, (tally.get(g) || 0) + 1);

      if (!ok) {
        dropped++;
        if (DEBUG) console.log(`     버림 · ${ev.name}`);
        if (LIST === 'drop') dropList.push(`[${cc}] ${ev.name}  ·  ${gs.join('/')}`);
        continue;
      }
      const row = toRow(ev, cc);
      /* 빈약한 것은 담지 않습니다 — 날짜나 공연장이 없으면 쓸모가 없습니다 */
      if (!row.title || !row.date_from || !row.venue_name) { dropped++; continue; }
      rows.push(row);
      if (rows.length >= LIMIT) break;
    }

    const total = (json.page && json.page.totalPages) || 1;
    if (rows.length >= LIMIT || page + 1 >= total) break;
    await sleep(250);                     /* 초당 5회를 넘지 않게 */
  }

  return { rows, got, dropped, genreTally, dropTally, dropList };
}

/* ============================================================
   같은 공연의 <회차>를 하나로 묶습니다 (2026-08-14 · 파트너 지시)
   ------------------------------------------------------------
   ★ 왜
     해외는 <b>날짜마다 한 줄</b>로 옵니다. 히사이시 공연이 8월에 여섯 번
     있으면 목록 여섯 줄을 먹습니다. 국내(KOPIS)는 「공연 하나 = 한 줄,
     기간으로 표시」이므로 같은 목록에서 두 방식이 섞여 어수선했습니다.
   ★ 무엇을 같은 공연으로 보나
     <b>제목 + 공연장</b>이 같으면 한 공연으로 봅니다. 도시가 달라도
     공연장이 다르면 따로 남습니다(순회 공연은 갈라 두는 편이 맞습니다).
   ★ 어느 회차의 번호(tm_id)를 쓰나
     <b>가장 이른 회차</b>입니다. 열쇠가 한결같아야 다음에 돌릴 때
     늘어나지 않고 갱신됩니다.
   ★ 무엇을 잃나
     「몇 월 며칠 몇 회차」입니다. 그것은 예매 링크로 들어가면 바로
     보이므로 우리가 안고 있을 정보가 아닙니다.
     대신 본문 표에 <b>회차 수</b>를 적어 둡니다.
   ============================================================ */
function mergeRuns(rows) {
  const key = (r) => `${(r.title || '').trim().toLowerCase()}||${(r.venue_name || '').trim().toLowerCase()}`;
  const box = new Map();

  for (const r of rows) {
    const k = key(r);
    const cur = box.get(k);
    if (!cur) { box.set(k, { ...r, _runs: 1 }); continue; }
    cur._runs += 1;
    /* 가장 이른 날 · 가장 늦은 날로 넓힙니다 */
    if (r.date_from && (!cur.date_from || r.date_from < cur.date_from)) {
      cur.date_from = r.date_from;
      cur.tm_id = r.tm_id;                 /* 열쇠도 가장 이른 회차의 것으로 */
      cur.link_url = r.link_url || cur.link_url;
      cur.source_url = r.source_url || cur.source_url;
    }
    const last = r.date_to || r.date_from;
    if (last && (!cur.date_to || last > cur.date_to)) cur.date_to = last;
    /* 그림이 없던 줄에 그림이 있으면 채웁니다 */
    if (!cur.thumb_url && r.thumb_url) cur.thumb_url = r.thumb_url;
  }

  /* 날짜 글자와 본문의 날짜 줄을 다시 씁니다 */
  const out = [];
  for (const r of box.values()) {
    const df = r.date_from, dt = r.date_to;
    const same = !dt || dt === df;
    r.date_text = df ? (same ? df : `${df} ~ ${dt}`) : null;
    /* ★ 2026-08-14 · 하루 공연도 date_to 를 <b>채웁니다</b> (파트너 지적)
         「진행중·예정」 탭은 <b>date_to 로</b> 자릅니다(여러 날 하는 공연이
         시작일이 지났어도 오늘 하고 있으니 그쪽이 맞습니다).
         그런데 하루 공연의 date_to 를 비워 두었더니 그 탭에서 통째로
         빠졌습니다 — 해외 공연이 「전체」에만 보인 까닭입니다.
       ★ 국내(KOPIS)는 늘 채우고 있었습니다. 결을 맞춥니다. */
    r.date_to = same ? df : dt;

    if (r._runs > 1) {
      /* 본문 표의 「날짜」 칸을 기간으로 바꾸고 회차 수를 덧붙입니다 */
      r.body = String(r.body || '').replace(
        /<tr><th>날짜<\/th><td>[^<]*<\/td><\/tr>/,
        `<tr><th>기간</th><td>${df}${same ? '' : ' ~ ' + dt}</td></tr>`
        + `<tr><th>회차</th><td>${r._runs}회</td></tr>`
      );
    }
    delete r._runs;
    out.push(r);
  }
  return out;
}

/* ── 담기 ───────────────────────────────────────────────── */
async function save(rows) {
  if (!rows.length) return 0;
  /* 200줄씩 나눠 보냅니다 — 한 번에 너무 크면 실패했을 때 어디까지
     들어갔는지 알기 어렵습니다. */
  let done = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    await sb('spot?on_conflict=tm_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(part),
    });
    done += part.length;
  }
  return done;
}

/* ── 실행 ───────────────────────────────────────────────── */
(async () => {
  const today = new Date();
  const end = new Date(today.getTime());
  end.setMonth(end.getMonth() + MONTHS);
  const from = ymd(today), to = ymd(end);

  console.log('══ 해외 공연정보 (Ticketmaster) ══');
  console.log(`   기간   : ${from} ~ ${to} (${MONTHS}달)`);
  console.log(`   나라   : ${COUNTRIES.join(' ')}`);
  console.log(`   한 나라 최대 : ${LIMIT}건`);
  console.log(`   담기   : ${SAVE ? '예 (--save)' : '아니오 — 세어만 봅니다'}`);
  console.log('');

  const all = [];
  const tally = new Map();
  const dtally = new Map();
  const drops = [];
  for (const cc of COUNTRIES) {
    const { rows, got, dropped, genreTally, dropTally, dropList } = await fetchCountry(cc, from, to);
    if (LIST === 'drop') drops.push(...dropList);
    console.log(`   ${cc} ${COUNTRY_KO[cc] || ''} — 받음 ${got} · 담을 것 ${rows.length} · 버림 ${dropped}`);
    all.push(...rows);
    for (const [g, n] of genreTally) tally.set(g, (tally.get(g) || 0) + n);
    for (const [g, n] of dropTally) dtally.set(g, (dtally.get(g) || 0) + n);
    await sleep(300);
  }

  /* ============================================================
   갈래 대표 사진을 걷어냅니다 (2026-08-14 · 파트너 지적)
   ------------------------------------------------------------
   ★ 무엇이 문제였나
     목록의 포스터가 <b>전부 같은 사진 두 장</b>이었습니다.
     Ticketmaster 문서에 이렇게 적혀 있습니다 — 「공연에 그 크기의
     사진이 없으면 <b>갈래 대표 사진</b>을 대신 준다」.
     즉 우리가 받은 것은 그 공연 포스터가 아니라 「클래식」 갈래의
     기본 그림입니다.
   ★ 어떻게 가려내나 — <b>같은 주소가 여러 공연에 쓰이면</b> 대표
     사진입니다. 실제 포스터는 공연마다 다릅니다.
     세 번 넘게 겹치는 주소를 골라 비웁니다.
   ★ 비우면 어떻게 되나 — 화면이 사진 없는 모양으로 그립니다.
     엉뚱한 사진이 붙어 있는 것보다 없는 편이 낫습니다.
   ============================================================ */
function dropStockImages(rows) {
  const count = new Map();
  for (const r of rows) {
    if (!r.thumb_url) continue;
    count.set(r.thumb_url, (count.get(r.thumb_url) || 0) + 1);
  }
  /* 세 건 이상 겹치면 대표 사진으로 봅니다. 실제 포스터가 세 공연에
     같이 쓰이는 일은 드뭅니다(있다면 순회 공연이니 그것도 대표 사진에
     가깝습니다). */
  const stock = new Set([...count.entries()].filter(([, n]) => n >= 3).map(([u]) => u));
  if (!stock.size) return 0;
  let cleared = 0;
  for (const r of rows) {
    if (r.thumb_url && stock.has(r.thumb_url)) { r.thumb_url = null; cleared++; }
  }
  console.log(`   ▶ 장르 대표 사진을 걷어냈습니다 — 주소 ${stock.size}가지 · ${cleared}건`);
  return cleared;
}

/* 같은 공연이 두 번 온 경우(나라 코드가 겹칠 때) 번호로 하나만 남깁니다 */
  const seen = new Set();
  let uniq = all.filter((r) => (seen.has(r.tm_id) ? false : (seen.add(r.tm_id), true)));

  console.log('');
  console.log(`   ▶ 받아서 걸러낸 것 ${uniq.length}건 (겹친 번호 ${all.length - uniq.length}건 뺐습니다)`);

  if (MERGE) {
    const before = uniq.length;
    uniq = mergeRuns(uniq);
    console.log(`   ▶ 같은 공연의 회차를 묶었습니다 — ${before} → ${uniq.length}건`);
  }
  dropStockImages(uniq);
  console.log(`   ▶ 담을 것 모두 ${uniq.length}건`);

  if (tally.size) {
    console.log('   ▶ <담은 것>의 장르 (많은 순 — 여기 대중음악이 보이면 새어 든 것입니다)');
    [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
      .forEach(([g, n]) => console.log(`        ${String(n).padStart(4)}  ${g}`));
  }
  if (dtally.size) {
    console.log('   ▶ <버린 것>의 장르 (많은 순 — 여기 클래식이 보이면 너무 걸러낸 것입니다)');
    [...dtally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .forEach(([g, n]) => console.log(`        ${String(n).padStart(4)}  ${g}`));
  }

  if (uniq.length) {
    /* ★ 표본을 <b>나라마다 하나씩</b> 보여 줍니다 — 앞에서 다섯 개만
       뽑으면 늘 미국만 보여 다른 나라를 확인할 수 없었습니다. */
    console.log('   ▶ 표본 (나라마다 두 줄)');
    for (const cc of COUNTRIES) {
      const ko = COUNTRY_KO[cc] || cc;
      const mine = uniq.filter((r) => r.country === ko).slice(0, 2);
      if (!mine.length) continue;
      for (const r of mine) {
        console.log(`        [${cc}] ${r.date_text}  ${r.venue_name}`);
        console.log(`             ${r.title}`);
      }
    }
  }

  if (LIST === 'keep') {
    console.log('');
    console.log(`   ▶ 담을 것 제목 모두 (${uniq.length}건) — 눈으로 훑어 보십시오`);
    uniq.forEach((r, i) => console.log(`      ${String(i + 1).padStart(4)}. [${r.country}] ${r.title}  ·  ${r.venue_name}`));
  }
  if (LIST === 'drop') {
    console.log('');
    console.log(`   ▶ 버린 것 제목 모두 (${drops.length}건) — 여기 클래식이 있으면 잣대가 너무 좁습니다`);
    drops.forEach((t, i) => console.log(`      ${String(i + 1).padStart(4)}. ${t}`));
  }

  if (!SAVE) {
    console.log('');
    console.log('   담지 않았습니다. 위 표본이 알맞아 보이면 --save 를 붙여 다시 돌리십시오.');
    console.log('   목록을 눈으로 훑고 싶으시면 --list=keep (담을 것) · --list=drop (버린 것)');
    return;
  }

  const before = await sb('spot?select=id&section=eq.' + encodeURIComponent('공연정보')
    + '&region=eq.' + encodeURIComponent('해외') + '&limit=1', {
    headers: { Prefer: 'count=exact' },
  }).catch(() => null);

  const n = await save(uniq);
  console.log('');
  console.log(`   ▶ 담았습니다 — ${n}건 (이미 있던 것은 갱신됩니다)`);

  if (n) await linkVenues();

  const after = await fetch(`${SB_URL}/rest/v1/spot?select=id&section=eq.${encodeURIComponent('공연정보')}&region=eq.${encodeURIComponent('해외')}&limit=1`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'count=exact' },
  });
  const cr = after.headers.get('content-range') || '';
  console.log(`   ▶ 지금 해외 공연정보 : ${(cr.split('/')[1] || '?')}건`);
})().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
