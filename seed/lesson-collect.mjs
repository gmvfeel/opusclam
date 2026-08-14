/* ============================================================
   OPUSCLAM 레슨:ON — 마스터클래스 · 공개레슨 모으기
   seed/lesson-collect.mjs

   ── 왜 만들었나 ─────────────────────────────────────────────
   지금까지는 파트너가 유튜브를 하나씩 보고 손으로 넣으셨습니다.
   정보SPOT 음원·동영상은 이미 자동으로 모아 어드민에서 검수하는
   방식(seed/youtube-collect.mjs + admin/media.html)인데, 레슨:ON 만
   손으로 하고 있었습니다. 같은 결로 맞춥니다.

   ── 어떻게 도나 ─────────────────────────────────────────────
     ① 믿을 만한 채널을 훑어 마스터클래스 영상을 찾습니다
     ② 점수를 매겨 못 미치는 것은 버립니다
     ③ 통과한 것을 lessons 표에 <b>status='draft'</b> 로 담습니다
        draft 는 아무에게도 보이지 않습니다 — 검수 대기 자리입니다
     ④ 파트너가 admin/lesson-review.html 에서 보고 통과·버림
     ⑤ 통과한 것만 status='open' 이 되어 목록에 나옵니다

   ── 왜 점수인가 ─────────────────────────────────────────────
   「masterclass」라는 낱말만 보면 반응 영상·요약·팬 편집이 잔뜩
   들어옵니다. 채널 신뢰 · 제목 · 길이 · 설명을 함께 봐서 합계가
   기준에 못 미치면 담지 않습니다. 해외 공연정보에서 배운 것과 같습니다 —
   <b>낱말 하나로 거르면 반드시 새어 나옵니다.</b>

   점수 배점 (합계 55점 이상만 담습니다)
     채널 신뢰       trust 3 → 45 · 2 → 32 · 1 → 18
     제목에 마스터클래스 낱말        20
     분야를 알아냈음                 12
     길이 적정 (8~180분)            12
     설명 충실 (200자 이상)          6
     작품·작곡가 이름이 보임         8

   ── 마스터클래스와 공개레슨을 갈라 담습니다 ─────────────────
     tab='master'  마스터클래스 — 「masterclass」가 제목에 있는 것
     tab='open'    공개레슨   — 「open lesson」·「public lesson」·
                   「lecture」·「tutorial」 쪽. 둘 다 kind='vod' 입니다.
   ★ 어느 쪽인지 헷갈리면 <b>마스터클래스로</b> 둡니다 — 검수에서
     옮기기 쉽습니다(어드민에 탭 바꾸는 단추가 있습니다).

   ── 쓰는 법 ────────────────────────────────────────────────
     node seed/lesson-collect.mjs                   세어만 봅니다(기본)
     node seed/lesson-collect.mjs --save            실제로 담습니다
     node seed/lesson-collect.mjs --per=15          채널마다 최신 몇 개까지
     node seed/lesson-collect.mjs --min=55          점수 기준
     node seed/lesson-collect.mjs --channels=8      채널 몇 곳만 (나눠 돌 때)
     node seed/lesson-collect.mjs --list=keep       담을 것 제목을 모두
     node seed/lesson-collect.mjs --list=drop       버린 것 제목을 모두
     node seed/lesson-collect.mjs --search          검색으로도 찾습니다(보조)

   ── 필요한 환경변수 ────────────────────────────────────────
     YOUTUBE_KEY
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY  (또는 SUPABASE_SERVICE_KEY)

   ── 드는 비용 ──────────────────────────────────────────────
   유튜브 무료 한도는 하루 10,000 입니다.
     채널 하나 훑기 = playlistItems 1 + videos 1 ≒ 2~3
     채널 스물이면 약 60. 검색을 켜면 검색 하나에 100 이 듭니다.
   한도를 넘으면 과금이 아니라 그날 멈추고 다음날 초기화됩니다.
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const YT_KEY = process.env.YOUTUBE_KEY;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const SAVE     = !!args.save;
const SEARCH   = !!args.search;
/* ★ 2026-08-14 · 15 → <b>50</b> (한 번에 받을 수 있는 최대치)
     학교 채널은 하루에도 여러 개 올려서 최신 15개에는 마스터클래스가
     들어오지 않았습니다. 50개까지 받아도 <b>호출은 그대로 1회</b>입니다. */
const PER      = Number(args.per || 50);
const MIN      = Number(args.min || 55);
const CH_LIMIT = Number(args.channels || 0);
const LIST     = String(args.list || '');

if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}
if (!YT_KEY) {
  console.error('환경변수 YOUTUBE_KEY 가 필요합니다.');
  console.error('Google Cloud → OPUSCLAM 프로젝트 → YouTube Data API v3 키를 쓰십시오');
  console.error('(정보SPOT 음원·동영상 수집기가 쓰는 것과 같은 키입니다).');
  process.exit(1);
}

/* ============================================================
   믿을 만한 채널
   ------------------------------------------------------------
   ★ 파트너가 손으로 넣으신 것들이 씨앗입니다 — 왕립음악대학(RCM),
     Sarah Willis 같은 곳이 그것입니다. 거기에 세계 주요 음악학교와
     축제를 더했습니다.
   ★ trust 는 「그 채널이 올리는 것을 얼마나 믿을 수 있나」입니다.
     3 = 학교·축제 공식 채널 (거의 다 쓸 만합니다)
     2 = 연주자·단체 공식 채널
     1 = 좋은 것이 섞여 있는 채널 (점수를 더 받아야 통과합니다)
   ★ 채널 번호(UC…)는 유튜브 채널 주소에 있습니다. 모르면 handle 만
     적어 두십시오 — 이 스크립트가 번호를 찾아 로그에 찍습니다.
   ★ 새 채널을 더할 때는 이 목록에 한 줄만 넣으면 됩니다.
   ============================================================ */
/* ============================================================
   ① 재생목록 (PLAYLISTS) — <b>가장 정확한 길</b>
   ------------------------------------------------------------
   ★ 왜 재생목록인가 (2026-08-14 · 세 번째 실행에서 배운 것)
     채널 최신 15개를 훑었더니 열두 채널에서 <b>열 개</b>만 나왔습니다.
     버린 목록을 눈으로 보니 잣대가 틀린 것이 아니었습니다 —
     학교 채널의 최근 영상이 졸업식·오페라 공연·Shorts·연주 실황이라
     <b>마스터클래스가 그 안에 없었습니다.</b>
   ▶ 학교들은 마스터클래스를 <b>재생목록으로 묶어</b> 둡니다. 그 목록만
     읽으면 거를 것이 거의 없고, 호출도 채널 훑기와 같습니다(1~3회).
   ★ 재생목록 번호(PL…) 찾는 법
     유튜브에서 그 채널 → 재생목록 → 마스터클래스 목록을 열면
     주소창에 list=PL… 로 나옵니다. 그것을 아래에 한 줄 넣으십시오.
   ★ 점수는 그대로 매깁니다 — 재생목록에도 예고편이 섞일 수 있습니다.
     다만 <b>제목 문턱은 낮춥니다</b>(아래 fromPlaylist 참고) —
     목록 자체가 「마스터클래스」라고 말하고 있으므로 제목에 그 낱말이
     없어도 됩니다.
   ============================================================ */
const PLAYLISTS = [
  /* ★ 이름에 <b>악기를 적어 두십시오</b> — 제목·설명에 악기가 없는
       영상(「Chopin: Ballade No.4」)의 분야를 이 이름으로 알아냅니다. */
  { id: 'PLZfH5K5Yr2DdRZyP58S9kg2gbM0DmOUld', trust: 3,
    name: 'RCM piano masterclass — Stephen Hough', tab: 'master' },
  /* 줄리아드 — 세계적인 연주자가 학생을 지도하는 실황을 모아 둔 목록입니다.
     여러 악기가 섞여 있으므로 이름에 악기를 적지 않습니다(제목·설명으로 갈립니다). */
  { id: 'PLd2lYJmTbj9qbfCMcKCYJG7jVXngVJz3l', trust: 3,
    name: 'Juilliard Master Classes', tab: 'master' },
  { id: 'PLd2lYJmTbj9qQuwFHeTKH94LsHHKJgGEg', trust: 3,
    name: 'Juilliard piano master class — Murray Perahia', tab: 'master' },
  { id: 'PLd2lYJmTbj9q5VGZNXyVUkz0_HXqnNdu7', trust: 3,
    name: 'Juilliard piano master class — Robert Levin', tab: 'master' },
  /* ★ 여기에 한 줄씩 더하시면 됩니다. 보기 —
       { id: 'PL…', trust: 3, name: '줄리아드 마스터클래스', tab: 'master' },
       { id: 'PL…', trust: 3, name: '카네기홀 SongStudio',   tab: 'master' },
     ★ tab 은 'master'(마스터클래스) 또는 'open'(공개레슨)입니다.
       목록이 강의·워크숍이면 'open' 으로 두십시오. */
];

/* ============================================================
   ② 채널 훑기 (CHANNELS) — 보조
   ------------------------------------------------------------
   재생목록이 없는 곳, 또는 재생목록에 안 담은 새 영상을 잡습니다.
   ★ handle(@이름)보다 번호(UC…)가 튼튼합니다 — 유튜브가 handle 을
     바꾸는 일이 있습니다(첫 실행에서 여섯 곳을 못 찾았습니다).
   ============================================================ */
const CHANNELS = [
  { id: 'UCjUQsk6a-IvdSeUboCifDxQ', trust: 3, name: 'Royal College of Music' },
  { id: 'UC1q29EwuKfkZaD0G0mNw0aQ', trust: 3, name: 'Manhattan School of Music' },
  { handle: '@juilliardschool',     trust: 3, name: 'The Juilliard School' },
  { handle: '@CurtisInstitute',     trust: 3, name: 'Curtis Institute of Music' },
  { handle: '@royalacademyofmusic', trust: 3, name: 'Royal Academy of Music' },
  { handle: '@guildhallschool',     trust: 3, name: 'Guildhall School' },
  { handle: '@carnegiehall',        trust: 3, name: 'Carnegie Hall' },
  { handle: '@wigmorehall',         trust: 3, name: 'Wigmore Hall' },
  { handle: '@verbierfestival',     trust: 3, name: 'Verbier Festival' },
  { handle: '@SarahWillisHorn',     trust: 2, name: 'Sarah Willis' },
  { handle: '@tonebase',            trust: 2, name: 'tonebase' },
];

/* 검색으로도 찾을 때 쓰는 낱말 (--search) */
const QUERIES = [
  'piano masterclass full',
  'violin masterclass full',
  'cello masterclass',
  'horn masterclass',
  'trumpet masterclass',
  'voice masterclass opera',
  'conducting masterclass',
];

/* ── 제목으로 갈라내기 ───────────────────────────────────── */
const RE_MASTER = /\b(master\s?class|masterclass|마스터\s?클래스)\b/i;
/* ★ 2026-08-14 · 공개레슨이 0개였습니다 — 낱말이 좁았습니다.
     학교 채널은 「open lesson」이라 적지 않고 「lecture」·「workshop」·
     「how to」·「tips」·「coaching session」처럼 씁니다. */
const RE_OPEN   = /\b(open\s?lesson|public\s?lesson|open\s?rehearsal|lecture|lecture[-\s]?demonstration|workshop|tutorial|how\s?to\s|technique|warm[-\s]?up|exercises?|fundamentals?|practice\s?(tips|guide)|tips\s?(for|and)|coaching\s?session|공개\s?레슨|공개\s?강의|강의)\b/i;

/* 버릴 것 — 반응·요약·팬 편집·광고
   ★ 짧은 낱말은 <b>낱말 경계</b>를 붙입니다. 「rave」가 「Ravel」을
     잡아먹은 일이 있었습니다(해외 공연 수집기, 같은 날). */
const RE_BLOCK = [
  /\breaction\b/i, /\breacts?\b/i, /\brecap\b/i, /\bhighlights?\b/i,
  /\btrailer\b/i, /\bteaser\b/i, /\bpromo\b/i, /\bshorts?\b/i,
  /\bepisode\s?\d+\s?of\b/i, /\bpart\s?\d+\s?\/\s?\d+/i,
  /\bfan\s?(edit|made)\b/i, /\bAI\b/, /\bcompilation\b/i,
  /\bbest\s?of\b/i, /\bfull\s?album\b/i, /\bplaylist\b/i,
  /\blive\s?stream\s?(test|check)\b/i,
  /* ★ 2026-08-14 · 첫 실행에서 <b>연주회 영상</b>이 섞였습니다
       「Junior Academy Symphony Orchestra <b>Performs</b> …」
       「Septura <b>SIDE-BY-SIDE</b> | Suite from Rinaldo」
     이것들은 훌륭한 연주지만 <b>가르치는 영상이 아닙니다.</b>
     레슨:ON 은 배우는 자리이므로 연주 실황은 정보SPOT 음원·동영상
     쪽이 맞습니다. */
  /\bperforms?\b/i, /\bside[-\s]?by[-\s]?side\b/i,
  /\bin\s?recital\b/i, /\bconcert\b/i, /\bgala\b/i,
  /\bprize\s?winners?\b/i, /\bfinal\s?round\b/i, /\bsemi[-\s]?final/i,
  /\bopening\s?night\b/i, /\bencore\b/i,
];

/* ── 분야 알아내기 ───────────────────────────────────────
   lessons.field 는 여덟 가지입니다 (assets/lesson-list.js 의 FIELDS
   와 <b>똑같아야</b> 합니다 — 다르면 목록 거르개에서 빠집니다).
     PIANO · STRINGS · BRASS · WINDS · PERCUSSIONS · VOCAL ·
     작곡/이론 · 기타                                         */
const FIELD_WORDS = [
  /* ★ 순서가 <b>우선순위</b>입니다. 성악을 맨 앞에 두는 까닭 —
       성악 마스터클래스에는 반드시 반주자가 나오므로 「piano」·
       「pianist」가 함께 적힙니다. 피아노를 앞에 두면 성악 수업이
       전부 PIANO 로 들어갑니다(첫 실행에서 여덟 개가 그랬습니다).
     ★ 노래·가곡 이름(lied · song · aria · SongStudio)도 성악 신호입니다. */
  /* ★ 2026-08-14 · 줄임말과 <b>「성악가 & 반주자」 짝</b>을 더했습니다
       「Maritina Tampakopoulos, <b>sop.</b> & Chris Reynolds, pianist」가
       PIANO 로 갔습니다 — sop. 이 줄임말이라 못 잡고 pianist 가 걸린
       것입니다. 성악 마스터클래스는 대개 이 모양(가수 + 반주자)입니다.
     ★ 「… & … pianist」 짝은 반주자가 있다는 뜻이므로 <b>성악</b>입니다
       (아래 RE_VOCAL_PAIR). */
  ['VOCAL',       /\b(voice|vocal|singing|singer|soprano|sop\.|tenor|ten\.|baritone|bar\.|bass-baritone|mezzo|mezzo-soprano|contralto|countertenor|lieder|lied|song\s?studio|art\s?song|aria|recitative|opera\s?(singing|coach|scenes)|diction|성악|소프라노|테너|가곡)\b/i],
  ['STRINGS',     /\b(violin|violinist|viola|cello|violoncello|double\s?bass|contrabass|harp|guitar|lute|바이올린|비올라|첼로|하프|기타)\b/i],
  ['BRASS',       /\b(horn|trumpet|trombone|tuba|euphonium|cornet|brass|호른|트럼펫|트롬본|튜바|금관)\b/i],
  ['WINDS',       /\b(flute|flutist|oboe|clarinet|bassoon|saxophone|recorder|woodwind|플루트|오보에|클라리넷|바순|목관)\b/i],
  ['PERCUSSIONS', /\b(percussion|timpani|marimba|vibraphone|drum|타악|팀파니|마림바)\b/i],
  ['작곡/이론',   /\b(composition|composing|orchestration|counterpoint|harmony|analysis|conducting|conductor|작곡|지휘|화성)\b/i],
  ['PIANO',       /\b(piano|pianist|klavier|fortepiano|harpsichord|organ|피아노|오르간)\b/i],
];

/* 작품·작곡가 이름이 보이면 점수를 더합니다 */
const RE_WORKISH = /\b(op\.?\s?\d|bwv|kv?\.?\s?\d{2,}|d\.?\s?\d{3}|hob|rv\s?\d|concerto|sonata|symphon|quartet|prelude|fugue|etude|nocturne|partita|suite|lied|aria)\b/i
  || null;
const RE_COMPOSER = /\b(bach|mozart|beethoven|brahms|chopin|liszt|schubert|schumann|debussy|ravel|rachmanin|prokofiev|shostakovich|tchaikovsky|handel|haydn|mahler|strauss|sibelius|dvorak|elgar|faure|poulenc|britten|bartok|verdi|puccini|wagner|scarlatti|vivaldi|saint-saens|franck|gurney)\b/i;

/* ── 도우미 ──────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

const YT_BASE = String(args.ytbase || 'https://www.googleapis.com/youtube/v3');

async function yt(path, params) {
  const q = new URLSearchParams({ ...params, key: YT_KEY }).toString();
  const res = await fetch(`${YT_BASE}/${path}?${q}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`YouTube ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

/* ISO 8601 기간(PT1H23M45S) → 초 */
function isoSec(v) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(v || ''));
  if (!m) return 0;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

/* ★ 2026-08-14 · 분야 판정이 <b>제목보다 설명을 먼저</b> 보고 있었습니다
     ─────────────────────────────────────────────────────────────
     카네기홀 성악 마스터클래스(SongStudio) 여덟 개가 모두 PIANO 로
     들어갔습니다. 설명에 「piano accompaniment」·「pianist」가 나와서
     그 낱말이 먼저 걸린 것입니다.
   ▶ <b>제목으로 먼저</b> 정합니다. 제목은 그 영상이 무엇인지 가장
     또렷하게 말해 줍니다. 제목에서 못 찾을 때만 설명을 봅니다.
   ★ 그리고 성악을 <b>맨 앞</b>에 둡니다 — 성악 마스터클래스에는 반드시
     반주자가 나오므로 피아노 낱말이 함께 나옵니다. 순서가 곧 우선순위입니다.
     (아래 FIELD_WORDS 의 순서를 바꿨습니다) */
/* 「… , sop. & … , pianist」 처럼 <b>가수와 반주자가 짝</b>으로 적힌 제목은
   성악 마스터클래스입니다. 반주자 낱말(pianist)이 먼저 걸리는 것을 막습니다. */
/* ★ 줄임말은 <b>낱말 경계 뒤에 두면 안 됩니다</b> — 「sop.」의 마침표는
     경계가 아니어서 \b 를 붙이면 걸리지 않습니다(검증에서 드러났습니다).
     그래서 마침표까지 규칙에 넣고 \b 는 앞쪽에만 둡니다. */
const RE_VOCAL_PAIR = /\b(soprano|sop\.|tenor|ten\.|baritone|bar\.|mezzo|contralto|countertenor|bass)[^|]*&[^|]*\bpianist\b/i;

function fieldOf(title, desc) {
  if (RE_VOCAL_PAIR.test(title)) return 'VOCAL';
  for (const [name, re] of FIELD_WORDS) if (re.test(title)) return name;
  for (const [name, re] of FIELD_WORDS) if (re.test(desc || '')) return name;
  return null;
}

/* ── 점수 ───────────────────────────────────────────────── */
function score(v, ch) {
  const title = String(v.title || '');
  const desc  = String(v.desc || '');
  const all   = title + ' ' + desc;
  const why   = [];
  let s = 0;

  const t = ch && ch.trust;
  if (t === 3) { s += 45; why.push('채널45'); }
  else if (t === 2) { s += 32; why.push('채널32'); }
  else if (t === 1) { s += 18; why.push('채널18'); }

  /* ★ 2026-08-14 · 제목에 <b>가르침을 뜻하는 낱말이 없으면 버립니다</b>
       ─────────────────────────────────────────────────────────
       첫 실행에서 연주회 영상이 섞였습니다. 채널이 훌륭하면(45점)
       나머지 점수만으로 55점을 넘어 「masterclass」라는 말이 없어도
       통과했기 때문입니다.
     ▶ 이제 이 낱말은 <b>있어야 하는 것</b>입니다. 점수가 아니라 문턱입니다.
       Ticketmaster 에서 배운 것과 같습니다 — 채널·갈래를 믿되
       <b>가장 또렷한 신호는 반드시 요구</b>해야 합니다. */
  const isMaster = RE_MASTER.test(title);
  const isOpen   = RE_OPEN.test(title);
  if (!isMaster && !isOpen) {
    /* ★ 재생목록에서 온 것은 <b>목록이 이미 말해 줍니다</b> — 제목에
       그 낱말이 없어도 통과시킵니다(「Brahms: Intermezzo …」처럼
       곡 이름만 적힌 것이 많습니다). */
    if (!v._fromList) {
      return { s: 0, why: ['제목에 마스터클래스·공개레슨 낱말이 없음'], field: null, tab: 'master' };
    }
    s += 20; why.push('목록20');
  } else {
    s += 20; why.push('제목20');
  }

  /* ★ 재생목록에서 온 것은 <b>목록 이름</b>도 힌트가 됩니다.
       「Stephen Hough <b>piano</b> Masterclasses」 목록의 「Chopin:
       Ballade No.4」는 제목·설명에 악기가 없어 기타로 갔습니다.
       목록 이름을 마지막 힌트로 봅니다(제목 → 설명 → 목록 이름). */
  const field = fieldOf(title, desc)
    || (v._listName ? fieldOf(v._listName, '') : null);
  if (field) { s += 12; why.push('분야12'); }

  const sec = v.sec || 0;
  if (sec >= 480 && sec <= 10800) { s += 12; why.push('길이12'); }

  if (desc.length >= 200) { s += 6; why.push('설명6'); }

  if (RE_COMPOSER.test(all) || /\b(op\.?\s?\d|bwv|concerto|sonata|symphon|quartet)\b/i.test(all)) {
    s += 8; why.push('작품8');
  }

  /* 탭 — 재생목록이 정해 준 것이 우선입니다 */
  const tab = v._tab ? v._tab : (isOpen && !isMaster ? 'open' : 'master');
  return { s, why, field, tab };
}

function blocked(title) {
  return RE_BLOCK.some((re) => re.test(title));
}

/* ★★ 2026-08-14 · <b>비공개·삭제된 영상</b>을 걸러냅니다 (파트너 지적) ★★
   ─────────────────────────────────────────────────────────────
   ★ 무엇이 문제였나
     재생목록에는 <b>지워지거나 비공개로 바뀐 영상도 자리만 남습니다.</b>
     목록(playlistItems)에는 번호가 있는데 상세(videos)에는 없습니다.
     그래서 제목이 빈 껍데기가 목록에 들어왔습니다 —
     화면에 「-」 로 나오고 그림도 없습니다.

   ★ 두 가지로 가려냅니다
     ① 상세를 못 받은 것 (videos 응답에 그 번호가 없음) — 지워진 것
     ② status.privacyStatus 가 public 이 아닌 것 — 비공개·미등재
   ★ 제목이 빈 것도 함께 막습니다 — 위 둘을 지나도 쓸 수 없습니다. */
function isGone(v) {
  if (!v || v._missing) return true;                 /* 상세를 못 받음 */
  if (v.privacy && v.privacy !== 'public') return true;
  if (!String(v.title || '').trim()) return true;
  return false;
}

/* ★ 2026-08-14 · Shorts 는 아예 받지 않습니다
     tonebase Guitar 채널 최신 15개 가운데 <b>열네 개</b>가 Shorts 였습니다.
     짧은 토막은 레슨이 아니고, 목록만 어지럽힙니다.
   ★ 두 가지로 봅니다 — 제목의 #shorts 표시, 그리고 <b>3분 미만</b>. */
function isShort(v) {
  if (/#shorts?\b/i.test(String(v.title || ''))) return true;
  /* ★ 2026-08-14 · 3분 → <b>6분</b> 으로 올렸습니다
       「Hough: Pedalling Techniques In Liszt's …」가 <b>4분</b>이었습니다.
       마스터클래스는 학생이 연주하고 스승이 짚어 주는 자리라 그렇게
       짧을 수 없습니다 — 4분짜리는 발췌·토막입니다.
     ★ 「공개레슨」은 짧을 수 있지만(요령 하나만 다루는 강의) 그런 것은
       레슨:ON 보다 유틸리티 쪽 성격이라 여기서는 함께 막습니다. */
  if (v.sec && v.sec < 360) return true;
  return false;
}

/* ── 채널 번호 찾기 ─────────────────────────────────────── */
async function resolveChannel(ch) {
  /* ★ 번호를 직접 적었어도 <b>uploads 목록</b>은 받아야 합니다.
       예전에는 id 가 있으면 곧바로 돌려주어 uploads 가 비었고,
       그러면 「채널을 찾지 못했습니다」로 잘못 찍혔습니다. */
  if (ch.id && ch.uploads) return ch.id;
  try {
    const j = ch.id
      ? await yt('channels', { part: 'contentDetails,snippet', id: ch.id })
      : await yt('channels', { part: 'contentDetails,snippet', forHandle: ch.handle });
    const it = (j.items || [])[0];
    if (it) {
      ch.id = it.id;
      ch.uploads = it.contentDetails && it.contentDetails.relatedPlaylists
        && it.contentDetails.relatedPlaylists.uploads;
      ch.realName = it.snippet && it.snippet.title;
      return ch.id;
    }
  } catch (e) { /* 아래에서 알립니다 */ }
  return null;
}

/* ── 재생목록에서 읽기 ─────────────────────────────────────
   ★ 채널 훑기와 거의 같습니다. 다른 점은 <b>제목 문턱을 두지 않는</b>
     것입니다 — 목록 자체가 「마스터클래스」라고 말하고 있습니다.
   ★ 한 쪽에 50개까지 옵니다. 더 있으면 다음 쪽으로 이어 받습니다
     (nextPageToken). 쪽마다 videos 를 한 번 더 부르므로 쪽당 2 씩 듭니다. */
async function fromPlaylist(pl) {
  const out = [];
  let token = '';
  for (let page = 0; page < 4; page++) {          /* 최대 200개까지 */
    let j;
    try {
      const params = { part: 'contentDetails', playlistId: pl.id, maxResults: '50' };
      if (token) params.pageToken = token;
      j = await yt('playlistItems', params);
    } catch (e) {
      console.log(`   ✘ ${pl.name} — ${e.message.slice(0, 80)}`);
      break;
    }
    const ids = (j.items || []).map((x) => x.contentDetails && x.contentDetails.videoId).filter(Boolean);
    if (!ids.length) break;

    let detail = {};
    try {
      /* ★ 2026-08-14 · status 를 함께 받습니다 — <b>비공개·삭제된 영상</b>을
           가려내려는 것입니다(아래 isGone 참고). */
      const d = await yt('videos', { part: 'contentDetails,snippet,status', id: ids.join(',') });
      for (const v of (d.items || [])) detail[v.id] = v;
    } catch (e) { /* 길이 점수만 못 받습니다 */ }

    for (const vid of ids) {
      const d = detail[vid];
      const sn = (d && d.snippet) || {};
      out.push({
        video_id: vid,
        title: sn.title || '',
        desc: sn.description || '',
        sec: isoSec(d && d.contentDetails && d.contentDetails.duration),
        thumb: (sn.thumbnails && (sn.thumbnails.maxres || sn.thumbnails.high || sn.thumbnails.medium) || {}).url || null,
        channel: sn.channelTitle || pl.name,
        channel_id: sn.channelId || '',
        published: sn.publishedAt || null,
        privacy: (d && d.status && d.status.privacyStatus) || null,
        _missing: !d,                    /* ★ 상세를 못 받음 = 지워진 영상 */
        _ch: { trust: pl.trust, name: pl.name },
        _fromList: true,                 /* ★ 제목 문턱을 건너뜁니다 */
        _listName: pl.name || '',        /* 분야 힌트로 씁니다 */
        _tab: pl.tab || 'master',
      });
    }
    token = j.nextPageToken || '';
    if (!token) break;
    await sleep(200);
  }
  return out;
}

/* ── 채널 훑기 ──────────────────────────────────────────── */
async function fromChannel(ch) {
  const id = await resolveChannel(ch);
  if (!id || !ch.uploads) {
    console.log(`   ✘ ${ch.handle || ch.id} (${ch.name}) — 채널을 찾지 못했습니다`);
    return [];
  }
  let items = [];
  try {
    const j = await yt('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: ch.uploads,
      maxResults: String(Math.min(PER, 50)),
    });
    items = j.items || [];
  } catch (e) {
    console.log(`   ✘ ${ch.handle || ch.id} (${ch.name}) — ${e.message.slice(0, 80)}`);
    return [];
  }
  if (!items.length) return [];

  /* 길이·설명을 받으려면 videos 를 한 번 더 불러야 합니다 (한 번에 50개) */
  const ids = items.map((x) => x.contentDetails && x.contentDetails.videoId).filter(Boolean);
  let detail = {};
  try {
    const d = await yt('videos', { part: 'contentDetails,snippet,statistics', id: ids.join(',') });
    for (const v of (d.items || [])) detail[v.id] = v;
  } catch (e) { /* 없으면 길이 점수만 못 받습니다 */ }

  return ids.map((vid) => {
    const d = detail[vid];
    const sn = (d && d.snippet) || {};
    return {
      video_id: vid,
      title: sn.title || '',
      desc: sn.description || '',
      privacy: (d && d.status && d.status.privacyStatus) || null,
      _missing: !d,
      sec: isoSec(d && d.contentDetails && d.contentDetails.duration),
      thumb: (sn.thumbnails && (sn.thumbnails.maxres || sn.thumbnails.high || sn.thumbnails.medium) || {}).url || null,
      channel: sn.channelTitle || ch.realName || ch.name,
      channel_id: sn.channelId || id,
      published: sn.publishedAt || null,
      _ch: ch,
    };
  });
}

/* ── 검색 (보조) ────────────────────────────────────────── */
async function fromSearch(q) {
  let ids = [];
  try {
    const j = await yt('search', {
      part: 'snippet', q, type: 'video', maxResults: '15',
      order: 'relevance', videoDuration: 'long', relevanceLanguage: 'en',
    });
    ids = (j.items || []).map((x) => x.id && x.id.videoId).filter(Boolean);
  } catch (e) {
    console.log(`   ✘ 검색 「${q}」 — ${e.message.slice(0, 80)}`);
    return [];
  }
  if (!ids.length) return [];
  let out = [];
  try {
    const d = await yt('videos', { part: 'contentDetails,snippet,status', id: ids.join(',') });
    out = (d.items || []).map((v) => ({
      video_id: v.id,
      title: (v.snippet || {}).title || '',
      desc: (v.snippet || {}).description || '',
      privacy: (v.status && v.status.privacyStatus) || null,
      sec: isoSec(v.contentDetails && v.contentDetails.duration),
      thumb: ((v.snippet || {}).thumbnails && ((v.snippet.thumbnails.maxres) || v.snippet.thumbnails.high) || {}).url || null,
      channel: (v.snippet || {}).channelTitle || '',
      channel_id: (v.snippet || {}).channelId || '',
      published: (v.snippet || {}).publishedAt || null,
      _ch: null,                          /* 검색에서 온 것은 채널 점수 0 */
    }));
  } catch (e) { /* 지나갑니다 */ }
  return out;
}

/* ── 담을 모양으로 ──────────────────────────────────────── */
function toRow(v, sc, memberId) {
  const min = v.sec ? Math.round(v.sec / 60) : null;
  const src = v.channel || '';
  return {
    /* ★ 올린 사람 — 관리자 계정입니다(위 adminId 주석 참고).
         instructor_id 는 비웁니다 — 우리 강사가 아니라 남의 공개 영상입니다. */
    member_id: memberId,
    kind: 'vod',
    tab: sc.tab,
    status: 'draft',                /* ★ 검수 대기. 아무에게도 보이지 않습니다 */
    source: 'curated',
    field: sc.field || '기타',
    title: v.title.slice(0, 120),
    subtitle: null,
    /* ★ 소개문은 <b>지어내지 않습니다.</b> 「왜 이 영상을 골랐는지」는
       사람이 쓸 몫입니다(레슨 등록 화면 안내에 그렇게 적혀 있습니다).
       대신 검수에 쓸 정보를 적어 두고, 파트너가 지우고 다시 쓰십니다. */
    summary: '[자동수집] ' + (src ? src + ' · ' : '')
      + (min ? min + '분 · ' : '')
      + '점수 ' + sc.s + ' (' + sc.why.join(' ') + ')'
      + '\n\n' + String(v.desc || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    cover_url: v.thumb || null,
    video_provider: 'youtube',
    video_id: v.video_id,
    sample_provider: 'none',
    sample_id: null,
    duration_min: min,
    credit: src || null,
    credit_url: 'https://www.youtube.com/watch?v=' + v.video_id,
    price: 0,
  };
}

/* ── 담는 사람(member_id) 찾기 ─────────────────────────────
   ★ 2026-08-14 · <b>member_id 는 비울 수 없는 칸입니다</b> (실행에서 드러남)
     ─────────────────────────────────────────────────────────────
     사람이 올린 것이 아니니 비워 두었는데 표가 거부했습니다 —
       null value in column "member_id" … violates not-null constraint
     레슨은 「누가 올렸나」가 있어야 하는 자료입니다(등록·수정 권한이
     그것으로 갈립니다).
   ▶ <b>관리자 계정</b>을 올린 사람으로 둡니다. 자동수집한 것이니
     관리자가 들여온 것으로 보는 편이 뜻에 맞고, 어드민에서 고치거나
     지울 수 있습니다(source='curated' 로 구분됩니다).
   ★ 번호를 코드에 적어 두지 않습니다 — is_admin 으로 찾습니다.
     계정이 바뀌어도 스크립트를 고칠 일이 없습니다.
   ★ 환경변수 OC_ADMIN_ID 를 주면 그것을 먼저 씁니다(여러 관리자가
     있을 때 어느 계정으로 담을지 정하고 싶을 때). */
async function adminId() {
  if (process.env.OC_ADMIN_ID) return process.env.OC_ADMIN_ID;
  const rows = await sb('members?select=id,name&is_admin=is.true&order=created_at.asc&limit=1');
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0].id;
}

/* ── 이미 있는 것은 건너뜁니다 ──────────────────────────── */
async function existingIds() {
  const out = new Set();
  let from = 0;
  /* ★ Supabase 는 한 번에 200줄까지 줍니다. 실수령 행 수만큼 전진해야
     합니다 — 요청한 수와 견주면 첫 쪽에서 멈춥니다(이 저장소의 함정). */
  for (;;) {
    const res = await fetch(`${SB_URL}/rest/v1/lessons?select=video_id&video_id=not.is.null`, {
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        Range: `${from}-${from + 199}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
    const rows = await res.json();
    if (!rows.length) break;
    for (const r of rows) if (r.video_id) out.add(r.video_id);
    from += rows.length;
  }
  return out;
}

async function save(rows) {
  let done = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const part = rows.slice(i, i + 100);
    await sb('lessons', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(part),
    });
    done += part.length;
  }
  return done;
}

/* ── 실행 ───────────────────────────────────────────────── */
(async () => {
  console.log('══ 레슨:ON — 마스터클래스 · 공개레슨 모으기 ══');
  console.log(`   재생목록: ${PLAYLISTS.length}개`);
  console.log(`   채널   : ${CH_LIMIT ? CH_LIMIT + '곳만' : CHANNELS.length + '곳'}`);
  console.log(`   채널마다: 최신 ${PER}개`);
  console.log(`   점수 기준: ${MIN}점 이상`);
  console.log(`   검색   : ${SEARCH ? '켬 (보조)' : '끔'}`);
  console.log(`   담기   : ${SAVE ? '예 (--save)' : '아니오 — 세어만 봅니다'}`);
  console.log('');

  /* ★ 담기 전에 <b>먼저</b> 확인합니다 — 백오십 개를 다 모은 뒤
     저장에서 실패하면 유튜브 호출을 헛되게 씁니다. */
  let MEMBER = null;
  if (SAVE) {
    MEMBER = await adminId();
    if (!MEMBER) {
      console.error('관리자 계정을 찾지 못했습니다 (members.is_admin = true 인 줄이 없습니다).');
      console.error('환경변수 OC_ADMIN_ID 로 회원 번호를 직접 주실 수도 있습니다.');
      process.exit(1);
    }
    console.log(`   담는 사람 : 관리자 계정 (${MEMBER})`);
    console.log('');
  }

  const have = await existingIds();
  console.log(`   이미 담긴 영상 ${have.size}개는 건너뜁니다`);
  console.log('');

  const all = [];
  const seen = new Set();

  /* ── ① 재생목록 (가장 정확) ── */
  if (PLAYLISTS.length) {
    console.log('   ── 재생목록 ──');
    for (const pl of PLAYLISTS) {
      const vids = await fromPlaylist(pl);
      let keep = 0, drop = 0;
      for (const v of vids) {
        if (seen.has(v.video_id)) continue;
        seen.add(v.video_id);
        if (have.has(v.video_id)) { drop++; continue; }
        /* ★ 비공개·삭제된 영상 — 가장 먼저 걸러냅니다 (2026-08-14) */
        if (isGone(v)) { drop++; if (LIST === 'drop') console.log(`      버림(비공개·삭제) ${v.video_id}`); continue; }
        if (isShort(v)) { drop++; if (LIST === 'drop') console.log(`      버림(짧음) ${v.title}`); continue; }
        if (blocked(v.title)) { drop++; if (LIST === 'drop') console.log(`      버림(제목) ${v.title}`); continue; }
        const sc = score(v, v._ch);
        if (sc.s < MIN) { drop++; if (LIST === 'drop') console.log(`      버림(${sc.s}점) ${v.title}`); continue; }
        /* ★ 재생목록 경로에도 <b>빈약 검사</b>를 둡니다 — 여기에 없어서
           껍데기가 통과했습니다(채널 훑기에는 있었습니다). */
        const row0 = toRow(v, sc, 'check');
        if (!row0.title || !row0.video_id) { drop++; continue; }
        all.push({ v, sc }); keep++;
      }
      console.log(`   ${pl.name.slice(0, 44).padEnd(46)} 받음 ${String(vids.length).padStart(3)} · 담을 것 ${keep} · 버림 ${drop}`);
      await sleep(200);
    }
    console.log('');
  }

  /* ── ② 채널 훑기 (보조) ── */
  console.log('   ── 채널 훑기 ──');
  const list = CH_LIMIT ? CHANNELS.slice(0, CH_LIMIT) : CHANNELS;
  for (const ch of list) {
    const vids = await fromChannel(ch);
    let keep = 0, drop = 0;
    for (const v of vids) {
      if (seen.has(v.video_id)) continue;
      seen.add(v.video_id);
      if (have.has(v.video_id)) { drop++; continue; }
      if (isGone(v)) { drop++; if (LIST === 'drop') console.log(`      버림(비공개·삭제) ${v.video_id}`); continue; }
      if (isShort(v)) { drop++; if (LIST === 'drop') console.log(`      버림(짧음) ${v.title}`); continue; }
      if (blocked(v.title)) { drop++; if (LIST === 'drop') console.log(`      버림(제목) ${v.title}`); continue; }
      const sc = score(v, ch);
      if (sc.s < MIN) {
        drop++;
        if (LIST === 'drop') console.log(`      버림(${sc.s}점) ${v.title}`);
        continue;
      }
      all.push({ v, sc });
      keep++;
    }
    console.log(`   ${(ch.realName || ch.name).padEnd(30)} 받음 ${String(vids.length).padStart(3)} · 담을 것 ${keep} · 버림 ${drop}`);
    await sleep(200);
  }

  if (SEARCH) {
    console.log('');
    console.log('   ── 검색으로 더 찾습니다 (채널 목록에 없는 곳) ──');
    for (const q of QUERIES) {
      const vids = await fromSearch(q);
      let keep = 0;
      for (const v of vids) {
        if (seen.has(v.video_id) || have.has(v.video_id)) continue;
        seen.add(v.video_id);
        if (isGone(v) || isShort(v) || blocked(v.title)) continue;
        const sc = score(v, null);       /* 채널 점수 0 — 나머지로 55점을 넘어야 합니다 */
        if (sc.s < MIN) continue;
        all.push({ v, sc }); keep++;
      }
      console.log(`   「${q}」 → ${keep}개`);
      await sleep(300);
    }
  }

  console.log('');
  const byTab = { master: 0, open: 0 };
  all.forEach(({ sc }) => { byTab[sc.tab] = (byTab[sc.tab] || 0) + 1; });
  console.log(`   ▶ 담을 것 모두 ${all.length}개 — 마스터클래스 ${byTab.master || 0} · 공개레슨 ${byTab.open || 0}`);

  const fTally = new Map();
  all.forEach(({ sc }) => fTally.set(sc.field || '기타', (fTally.get(sc.field || '기타') || 0) + 1));
  if (fTally.size) {
    console.log('   ▶ 분야별');
    [...fTally.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([f, n]) => console.log(`        ${String(n).padStart(3)}  ${f}`));
  }

  if (LIST === 'keep' || !SAVE) {
    console.log('   ▶ 표본 (점수 높은 순)');
    [...all].sort((a, b) => b.sc.s - a.sc.s).slice(0, LIST === 'keep' ? all.length : 10)
      .forEach(({ v, sc }, i) => {
        console.log(`      ${String(i + 1).padStart(3)}. [${sc.tab === 'open' ? '공개' : '마스터'}·${sc.field || '기타'}·${sc.s}점] ${v.title}`);
        console.log(`           ${v.channel} · ${v.sec ? Math.round(v.sec / 60) + '분' : '길이모름'}`);
      });
  }

  if (!SAVE) {
    console.log('');
    console.log('   담지 않았습니다. 위 표본이 알맞아 보이면 --save 를 붙여 다시 돌리십시오.');
    console.log('   담으면 <b>준비중(draft)</b> 으로 들어가므로 목록에는 나오지 않습니다 —');
    console.log('   admin/lesson-review.html 에서 보시고 통과시키면 그때 공개됩니다.');
    return;
  }

  const rows = all.map(({ v, sc }) => toRow(v, sc, MEMBER));
  const n = await save(rows);
  console.log('');
  console.log(`   ▶ 담았습니다 — ${n}개 (모두 준비중 · 검수 대기)`);
  console.log('   ▶ admin/lesson-review.html 에서 보시고 통과·버림을 정해 주십시오.');
})().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
