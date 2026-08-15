/* ============================================================
   OPUSCLAM 커뮤니티 자동 시드 — seed/auto-seed.mjs
   ------------------------------------------------------------
   · GitHub Actions 크론이 하루 2회 이 파일을 실행합니다.
   · 게시판마다 테이블·컬럼·본문형식이 달라서 BOARDS 에 config 로 정리했습니다.
     새 게시판이 생기면 BOARDS 에 블록 하나만 추가하면 됩니다(스크립트 수정 불필요).
   · 콘텐츠는 seed/pool/*.mjs 에 있습니다. 엔진은 내용을 모릅니다.

   환경변수(GitHub Secrets):
     SUPABASE_URL
     SUPABASE_SERVICE_KEY        (sb_secret_... 또는 service_role 키)
                                 옛 이름 SUPABASE_SERVICE_ROLE_KEY 도 받아들입니다

   ★★ 2026-08-12 · 「한꺼번에 채우기」를 더했습니다 ★★
   ────────────────────────────────────────────────────────────
   ★ 왜 (파트너 지적)
     손으로 돌려도 글이 늘지 않는 일이 있었습니다. 고장이 아니고
     <b>일부러 넣어 둔 장치</b> 때문입니다 —
       · 「조용한 회차」   평일 18% · 주말 35% 확률로 아무것도 안 올림
       · perRun [0, 1]    게시판마다 0건일 수도 있음
       · weekly           현대음악·태교음악·유틸리티는 대개 건너뜀
     날마다 조금씩 자연스럽게 쌓이게 하려는 것이라 평소에는 이게 맞습니다.
     그런데 <b>런칭 전에 화면을 채워 두려면</b> 몇 달을 기다릴 수 없습니다.

   ★ 어떻게 쓰나 — 손으로 돌릴 때만 씁니다
     node seed/auto-seed.mjs                      평소대로 (아무것도 안 바뀝니다)
     node seed/auto-seed.mjs --fill=30            지금 30건까지 채웁니다
     node seed/auto-seed.mjs --fill=30 --board=qna  그 게시판만
     node seed/auto-seed.mjs --fill=30 --dry      담지 않고 무엇이 올라갈지만

   ★ --fill 을 주면 이 셋을 건너뜁니다
     조용한 회차 · perRun 상한 · weekly 건너뛰기
   ★ 건너뛰지 <b>않는</b> 것 — 안전장치는 그대로 지킵니다
     · 이미 있는 제목은 담지 않습니다
     · 게시판별 시드 상한(GUARD_SEED_POSTS)
     · 회원 글이 많은 게시판은 손대지 않음(GUARD_REAL_POSTS)
     · onlyCategory · requireThumb 조건
   ★ 예약(크론)에는 영향이 없습니다 — 옵션을 주지 않으면 예전과 같습니다.

   ★★ 2026-08-15 · 영어·일본어 글을 함께 담습니다 (파트너 요청) ★★
   ────────────────────────────────────────────────────────────
   ★ 무엇을 하나
     한국어 글만 담던 것을 <b>영어·일본어 글도</b> 담도록 넓혔습니다.
     번역이 아닙니다 — 그 언어권 사람이 <b>처음부터 그 말로 쓴 글</b>입니다.
     연습실 예약 다툼(영어권), 방음실 임대(일본) 처럼 부딪히는 벽이
     나라마다 달라서, 한국어 글을 옮겨서는 결이 살지 않습니다.

   ★ 언어로 거르지 않습니다 (파트너 결정)
     한국어 화면에도 영어 글이 함께 보이고, 그 반대도 마찬가지입니다.
     영어를 읽는 한국분도, 한국어를 읽는 외국분도 계시니까요.
     목록에서는 board.js 가 제목 옆에 <b>EN · 日 배지</b>를 답니다.

   ★ 게시판마다 <b>켜고 끕니다</b> — langs 를 보십시오
     입시는 <b>한국어만</b> 돕니다. 한국 음대 입시 이야기를 영어권
     사람이 쓸 일이 없습니다. 없는 글을 지어내면 그 순간 들킵니다.

   ★ 언어 비율을 정해 둡니다 — 왜 필요한가
     그냥 섞어 두면 <b>한국어가 거의 다 뽑힙니다.</b> 한국어 후보가
     300개인데 영어가 12개면 영어가 뽑힐 확률이 4%입니다. 그래서
     <b>언어를 먼저 고르고</b> 그 안에서 글을 뽑습니다.

   ★ 상한도 언어마다 따로 셉니다
     한 게시판 300개 상한을 언어가 나눠 쓰면, 한국어가 다 차지한 뒤
     영어는 한 편도 못 올라갑니다. 언어별로 셉니다.

   ★ lang 칸이 아직 없으면 <b>예전처럼 돕니다</b>
     sql/community-lang-RUN-NOW.sql 을 아직 안 돌리셨어도 멈추지
     않습니다. 칸이 있는지 먼저 보고, 없으면 한국어만 담습니다.

     node seed/auto-seed.mjs --fill=12 --board=hottopic --lang=en
                                        핫토픽 영어 글만 12건
   ============================================================ */

import { POOL } from './content-pool.mjs';

const SB_URL = process.env.SUPABASE_URL;
/* 열쇠 이름은 두 가지를 모두 받아들입니다.
   워크플로와 스크립트를 각각 고쳐도 어느 시점에도 멈추지 않게 하기 위해서입니다. */
const SB_KEY = process.env.SUPABASE_SERVICE_KEY
            || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

/* ── 손으로 돌릴 때 쓰는 옵션 ──────────────────────────────── */
const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
/* --fill=30 → 이번에 담을 <b>전체</b> 목표 건수 (0 이면 평소 동작) */
const FILL = /^\d+$/.test(String(ARGS.fill)) ? Number(ARGS.fill) : 0;
/* --board=qna → 그 게시판만 */
const ONLY_BOARD = typeof ARGS.board === 'string' ? ARGS.board : null;
/* --dry → 담지 않고 무엇이 올라갈지만 */
const DRY = !!ARGS.dry;
/* --lang=en → 그 언어 글만 (적지 않으면 게시판 설정의 비율대로 섞습니다) */
const ONLY_LANG = typeof ARGS.lang === 'string' ? ARGS.lang : null;
if (ONLY_LANG && !['ko', 'en', 'ja'].includes(ONLY_LANG)) {
  console.error('--lang 은 ko · en · ja 만 받습니다 : ' + ONLY_LANG);
  process.exit(1);
}

/* ============================================================
   1) 게시판 설정
   ------------------------------------------------------------
   table        글 테이블
   commentTable 댓글 테이블
   fk           댓글이 글을 가리키는 컬럼 (현재 전부 news_id)
   body         'html'  → 본문이 <p> 태그 형식
                (지금은 모든 게시판이 html 입니다 — 보기 화면이 HTML 로 렌더링)
   authorName   글 테이블에 author_name 컬럼이 있는가
   likes        like_count 컬럼이 있는가
   dislikes     dislike_count 컬럼이 있는가
   extraCols    글마다 추가로 넣는 컬럼 (예: qna 의 track, keywords)
   requireThumb thumb_url 이 없는 글은 올리지 않음 (사진 게시판)
   onlyCategory 이 분류만 자동 등록 (설계에 없는 분류가 들어가는 것을 막는 장치)
   perRun       한 회차에 올릴 새 글 수 [최소, 최대]
   weekly       true 면 대략 주 1~2회만 올림 (매 회차마다 확률로 건너뜀)
   langs        이 게시판이 다루는 언어와 비율 (2026-08-15 신설)
                적지 않으면 { ko: 1 } — <b>예전과 똑같이</b> 한국어만 돕니다.
                { ko: 0.6, en: 0.25, ja: 0.15 } 이면 열 번에 여섯 번쯤
                한국어, 두세 번 영어, 한두 번 일본어를 고릅니다.
                ★ 고른 언어에 남은 글이 없으면 다른 언어로 넘어갑니다 —
                  영어가 바닥났다고 그 회차를 버리지 않습니다.
   ============================================================ */

/* ── 언어 비율 ──────────────────────────────────────────────
   ★ 왜 게시판마다 다른가
     연습·악기·공연 이야기는 <b>국경이 없습니다</b> — 셋 다 돕니다.
     한국 음대 입시는 <b>한국 이야기</b>입니다 — 한국어만 돕니다.
   ★ 지금은 한국어 글이 압도적으로 많으니 한국어 비율을 높게 둡니다.
     영어·일본어 글이 쌓이면 이 숫자를 고쳐 균형을 맞추면 됩니다
     (여기 한 줄만 고치면 됩니다 — 다른 곳은 손댈 것이 없습니다). */
const MIX_ALL  = { ko: 0.6, en: 0.25, ja: 0.15 };   // 국경 없는 이야기
const MIX_KO   = { ko: 1 };                          // 한국 이야기만

const BOARDS = {
  hottopic: {
    table: 'hottopic', commentTable: 'hottopic_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], langs: MIX_ALL,
  },
  /* ★ 2026-08-13 · 오퍼니티 (파트너 요청)
       핫토픽보다 자유롭게 쓰는 커뮤니티 게시판입니다.
     ★ 설정이 핫토픽과 <b>똑같습니다</b> — 표만 다릅니다.
       댓글 외래키도 news_id 입니다(board.js 에 박혀 있어 그렇게 만들었습니다).
     ★ weekly 를 주지 않습니다 — 커뮤니티 게시판이라 매일 도는 편이
       자연스럽습니다(핫토픽·지식나눔과 같은 결). */
  opusnity: {
    table: 'opusnity', commentTable: 'opusnity_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], langs: MIX_ALL,
  },
  admission_community: {
    table: 'admission_community', commentTable: 'admission_community_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    /* ★ 한국어만 — 한국 음대 입시 이야기입니다 */
    perRun: [0, 1], langs: MIX_KO,
  },
  qna: {
    table: 'qna', commentTable: 'qna_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    extraCols: ['track', 'keywords'],
    perRun: [0, 1], langs: MIX_ALL,
    // comment_count 는 trg_qna_cmt 트리거가 자동으로 셉니다 → 직접 넣지 않음
  },
  gallery: {
    table: 'gallery', commentTable: 'gallery_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    requireThumb: true,
    /* ★ 한국어만 — 사진이 있어야 올라가는 게시판이라 뒤로 미룹니다 */
    perRun: [0, 1], weekly: true, langs: MIX_KO,
  },
  news: {
    table: 'news', commentTable: 'news_comments', fk: 'news_id',
    body: 'html', authorName: false, likes: false, dislikes: false,
    onlyCategory: ['국내', '해외'],
    perRun: [0, 1], weekly: true, langs: MIX_ALL,
  },

  /* ★ 세 게시판을 새로 넣습니다.
     지금까지 자동시드가 다섯 게시판만 다뤄, 현대음악·태교음악·
     유틸리티는 8~9건에서 멈춰 있었습니다.
     회차당 0~1글씩 · 주 1회로 두어 천천히 쌓이게 합니다. */
  modern_music: {
    table: 'modern_music', commentTable: 'modern_music_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], weekly: true, langs: MIX_ALL,
  },
  prenatal_music: {
    table: 'prenatal_music', commentTable: 'prenatal_music_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], weekly: true, langs: MIX_ALL,
  },
  utility: {
    table: 'utility', commentTable: 'utility_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], weekly: true, langs: MIX_ALL,
  },
};

/* 안전장치 */
const GUARD_REAL_POSTS = 120;   // 실제 회원 글이 이만큼 쌓이면 그 게시판은 자동 등록 중단
const GUARD_SEED_POSTS = 300;   // 게시판별 시드 글 상한 (도배 방지)
const COMMENTS_PER_RUN = [2, 5]; // 회차당 붙일 댓글 수 (전체 게시판 합계)

/* ============================================================
   2) Supabase REST 헬퍼
   ============================================================ */
const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
};

async function sbGet(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: HDR });
  if (!r.ok) throw new Error('GET ' + path + ' → ' + r.status + ' ' + (await r.text()));
  return r.json();
}
async function sbCount(table, query) {
  const r = await fetch(SB_URL + '/rest/v1/' + table + '?select=id&' + query, {
    headers: { ...HDR, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) throw new Error('COUNT ' + table + ' → ' + r.status);
  const cr = r.headers.get('content-range') || '0-0/0';
  return parseInt(cr.split('/')[1] || '0', 10);
}
async function sbInsert(table, row) {
  const r = await fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: { ...HDR, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('INSERT ' + table + ' → ' + r.status + ' ' + (await r.text()));
  const j = await r.json();
  return Array.isArray(j) ? j[0] : j;
}
async function sbPatch(table, id, patch) {
  const r = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH', headers: HDR, body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('PATCH ' + table + ' → ' + r.status);
}

/* ============================================================
   3) 잡동사니
   ============================================================ */
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

/** 지금보다 살짝 과거 시각 (분 단위로 흩어서 정각에 몰리지 않게) */
function jitterNow(maxHours = 5) {
  const d = new Date(Date.now() - rnd(5, maxHours * 60) * 60 * 1000);
  return d.toISOString();
}

/* ★★ 2026-08-13 · 한꺼번에 채울 때 날짜를 <b>여러 날에 흩습니다</b> ★★
   ─────────────────────────────────────────────────────────────
   ★ 무엇이 문제였나 (파트너 지적)
     --fill=25 로 오퍼니티를 채웠더니 <b>스물다섯 개가 모두 오늘 날짜</b>가
     됐습니다. 목록을 열면 같은 날짜가 죽 늘어서 「한꺼번에 만든 것」이
     한눈에 보입니다.
     까닭은 jitterNow 가 <b>최대 다섯 시간</b>만 뒤로 물리기 때문입니다.
     평소 회차는 하루 한두 건이라 그게 맞지만, 한꺼번에 채울 때는
     맞지 않습니다.

   ★ 어떻게 흩나
     담을 건수에 맞춰 <b>기간을 정합니다</b> — 하루에 한두 건씩 올라간 것처럼
     보이도록. 25건이면 열엿새쯤에 걸칩니다.
     그 기간 안에서 <b>고르지 않게</b> 흩습니다. 날마다 똑같이 한 건이면
     그것도 기계 같아 보입니다.

   ★ 시각도 사람처럼 둡니다
     새벽 3~6시는 피합니다 — 그 시간에 글이 올라오는 일은 드뭅니다.
     저녁(19~23시)에 조금 더 몰리게 둡니다.

   ★ 앞뒤 순서는 걱정하지 않아도 됩니다
     목록은 created_at 으로 정렬하므로, 흩어 놓으면 저절로 섞입니다. */
/* ★★ 2026-08-15 · <b>이미 있는 글과 같은 기간</b>에 흩습니다 (파트너 지적) ★★
   ─────────────────────────────────────────────────────────────
   ★ 무엇이 문제였나
     영어 12편을 --fill 로 담았더니 <b>최근 여드레</b>에 몰렸습니다.
     건수에 맞춰 기간을 잡기 때문입니다(12건 ÷ 1.5 = 8일).
     한국어 글은 몇 달에 걸쳐 있는데 외국어만 맨 위에 뭉쳐 있으면,
     목록을 열자마자 <b>한꺼번에 넣은 것</b>이 보입니다.

   ★ 어떻게 고쳤나
     그 게시판에 <b>이미 있는 시드 글이 걸쳐 있는 기간</b>을 받아,
     같은 기간에 흩습니다. 한국어가 넉 달에 걸쳐 있으면 영어도
     넉 달에 흩어져 서로 섞입니다.

   ★ spanDays 를 주지 않으면 예전과 똑같이 돕니다 — 게시판이 비어
     있어 견줄 것이 없을 때가 그렇습니다. */
function spreadDate(idx, total, spanDays) {
  /* 기간 — 있는 글에 맞추되, 없으면 건수로 잡습니다(하루 1.5건) */
  const days = spanDays
    ? Math.max(3, Math.min(400, spanDays))
    : Math.max(3, Math.min(90, Math.ceil(total / 1.5)));
  /* idx 를 기준으로 삼되 앞뒤로 흔들어 고르지 않게 만듭니다 */
  const step = days / Math.max(1, total);
  const base = (idx + Math.random()) * step;
  /* 흔들림은 <b>간격에 비례</b>합니다. 예전에는 늘 ±0.8일이라, 기간이
     넉 달로 늘어나면 거의 일정한 간격으로 줄을 서 버립니다. */
  const jitter = (Math.random() - 0.5) * step * 1.6;
  const back = Math.min(days, Math.max(0.02, base + jitter));

  const d = new Date(Date.now() - back * 86400000);
  /* 시각 — 새벽 3~6시는 피하고 저녁에 조금 더 몰리게 */
  const HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,
                 19,19,20,20,21,21,22,22,23,23,0,1,2];
  d.setHours(HOURS[Math.floor(Math.random() * HOURS.length)],
             rnd(0, 59), rnd(0, 59), 0);
  /* 앞날로 넘어가지 않게 — 오늘 것이 미래가 되면 목록 맨 위가 이상해집니다 */
  const now = Date.now() - 4 * 60 * 1000;
  return new Date(Math.min(d.getTime(), now)).toISOString();
}
/** 기준 시각 이후 ~ 지금 사이의 임의 시각 (댓글용) */
function afterButBeforeNow(isoBase, minMinutes = 40) {
  const base = new Date(isoBase).getTime() + minMinutes * 60 * 1000;
  const now = Date.now() - 3 * 60 * 1000;
  if (base >= now) return new Date(now).toISOString();
  return new Date(base + Math.random() * (now - base)).toISOString();
}

/** 회차 분위기 — 주말은 조용하고, 가끔 아무 일도 없는 회차 */
function moodFactor() {
  const day = new Date().getUTCDay();       // 0 일 · 6 토
  const weekend = day === 0 || day === 6;
  if (chance(weekend ? 0.35 : 0.18)) return 0;   // 조용한 회차
  return weekend ? 0.6 : 1;
}

/* ============================================================
   3-b) 언어 (2026-08-15 신설)
   ============================================================ */

/* ── lang 칸이 있나 ──────────────────────────────────────────
   ★ 왜 확인하나
     sql/community-lang-RUN-NOW.sql 을 아직 안 돌리셨는데 크론이 먼저
     돌 수 있습니다. 그때 lang 을 넣어 저장하면 <b>글이 하나도 안 올라갑니다.</b>
     한 번 물어보고, 없으면 예전처럼 한국어만 담습니다.
   ★ 한 번만 물어봅니다 — 게시판마다 물으면 헛걸음이 아홉 번입니다. */
let HAS_LANG = null;
async function checkLangColumn() {
  if (HAS_LANG !== null) return HAS_LANG;
  try {
    await sbGet('hottopic?select=lang&limit=1');
    HAS_LANG = true;
    console.log('※ lang 칸 확인 — 영어·일본어 글도 담습니다');
  } catch (e) {
    HAS_LANG = false;
    console.log('※ lang 칸이 없습니다 — 한국어만 담습니다');
    console.log('   (sql/community-lang-RUN-NOW.sql 을 돌리시면 켜집니다)');
  }
  return HAS_LANG;
}

/** 글의 언어 — 적지 않았으면 한국어로 봅니다(옛 풀은 모두 한국어입니다) */
const langOf = (p) => p.lang || 'ko';

/* ── 어느 언어로 담을까 ──────────────────────────────────────
   ★ 비율대로 하나를 고릅니다. 다만 <b>후보가 있는 언어</b>만 놓고
     고릅니다 — 영어가 바닥났는데 영어를 골라 놓고 「없음」으로
     끝내면 그 회차를 통째로 버리게 됩니다.
   ★ 비율은 남은 언어끼리 다시 나눕니다(정규화). 영어가 바닥나면
     그 몫이 한국어·일본어로 자동으로 넘어갑니다. */
function pickLang(mix, available) {
  const usable = Object.entries(mix || { ko: 1 })
    .filter(([l, w]) => w > 0 && available.has(l));
  if (!usable.length) return null;
  const total = usable.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [l, w] of usable) { r -= w; if (r <= 0) return l; }
  return usable[usable.length - 1][0];
}

/* ============================================================
   4) 새 글 올리기
   ============================================================ */
/**
 * @param want0  ★ 이번에 이 게시판에 담을 <b>목표 건수</b>.
 *               0 이면 평소대로 perRun·mood 로 정합니다.
 *               숫자가 오면 그만큼 채우고, 조용한 회차·weekly·perRun 을
 *               건너뜁니다. 다만 남은 글이 그보다 적으면 있는 만큼만 담습니다.
 */
async function seedPosts(key, cfg, mood, want0 = 0) {
  const posts = POOL.posts.filter((p) => p.board === key);
  if (!posts.length) return 0;

  const hasLang = await checkLangColumn();

  // 상한·가드 확인
  const [realCnt, seedCnt] = await Promise.all([
    sbCount(cfg.table, 'author_id=not.is.null'),
    sbCount(cfg.table, 'author_id=is.null'),
  ]);
  if (realCnt >= GUARD_REAL_POSTS) {
    console.log(`[skip] ${key} — 실제 회원 글 ${realCnt}개, 자동 등록 중단`);
    return 0;
  }
  /* ★ 상한은 <b>언어마다 따로</b> 셉니다 (2026-08-15)
       한 게시판 300개를 언어가 나눠 쓰면, 한국어가 다 차지한 뒤
       영어는 한 편도 못 올라갑니다. 언어마다 300개를 줍니다. */
  const seedByLang = {};
  if (hasLang) {
    for (const l of ['ko', 'en', 'ja']) {
      seedByLang[l] = await sbCount(cfg.table, `author_id=is.null&lang=eq.${l}`);
    }
  } else {
    seedByLang.ko = seedCnt;
  }
  if (!hasLang && seedCnt >= GUARD_SEED_POSTS) {
    console.log(`[skip] ${key} — 시드 글 상한(${GUARD_SEED_POSTS}) 도달`);
    return 0;
  }
  /* ★ --fill 로 채우는 중이면 「느린 게시판」 건너뛰기를 하지 않습니다.
       평소에는 이 줄이 현대음악·태교음악·유틸리티를 대개 넘겨 줍니다. */
  if (!want0 && cfg.weekly && !chance(0.28)) return 0;   // 느린 게시판

  /* ★ 2026-08-15 · 이미 있는 시드 글이 <b>얼마나 긴 기간</b>에 걸쳐
       있는지 재어 둡니다. 새 글을 그 기간 안에 흩어 섞기 위해서입니다.
       ★ --fill 일 때만 씁니다. 평소 회차는 지금 시각 근처가 맞습니다.
       ★ 게시판이 비어 있으면 잴 것이 없으므로 0 을 둡니다. */
  let spanDays = 0;
  if (FILL) {
    const first = await sbGet(
      `${cfg.table}?select=created_at&author_id=is.null&order=created_at.asc&limit=1`);
    if (first.length && first[0].created_at) {
      const d = (Date.now() - new Date(first[0].created_at).getTime()) / 86400000;
      if (d > 0) spanDays = Math.round(d);
    }
  }

  // 이미 올라간 제목은 건너뜀
  const rows = await sbGet(`${cfg.table}?select=title&author_id=is.null&limit=1000`);
  const used = new Set(rows.map((r) => r.title));
  let cand = posts.filter((p) => !used.has(p.title));
  if (cfg.onlyCategory) cand = cand.filter((p) => cfg.onlyCategory.includes(p.category));
  if (cfg.requireThumb) cand = cand.filter((p) => !!p.thumb_url);

  /* ── 언어로 한 번 더 거릅니다 (2026-08-15) ──────────────────
     ★ lang 칸이 없으면 한국어만 — 저장할 자리가 없으니까요.
     ★ --lang=en 을 주셨으면 그 언어만.
     ★ 게시판이 다루지 않는 언어(입시의 영어 등)는 여기서 빠집니다.
     ★ 언어별 상한에 닿은 언어도 빠집니다. */
  const allowed = new Set(
    hasLang ? Object.keys(cfg.langs || { ko: 1 }) : ['ko']
  );
  if (ONLY_LANG) {
    if (!allowed.has(ONLY_LANG)) {
      console.log(`[skip] ${key} — ${ONLY_LANG} 글을 다루지 않는 게시판입니다`);
      return 0;
    }
    allowed.clear(); allowed.add(ONLY_LANG);
  }
  for (const l of Array.from(allowed)) {
    if ((seedByLang[l] || 0) >= GUARD_SEED_POSTS) {
      console.log(`[skip] ${key}/${l} — 시드 글 상한(${GUARD_SEED_POSTS}) 도달`);
      allowed.delete(l);
    }
  }
  cand = cand.filter((p) => allowed.has(langOf(p)));
  if (!cand.length) {
    console.log(`[pool] ${key} — 남은 글 없음 (댓글만 계속 달립니다)`);
    return 0;
  }

  let want;
  if (want0) {
    /* ★ 채우는 중 — 목표만큼, 다만 남은 글과 시드 상한을 넘지 않게 */
    const room = Math.max(0, GUARD_SEED_POSTS - seedCnt);
    want = Math.min(want0, cand.length, room);
  } else {
    want = rnd(cfg.perRun[0], cfg.perRun[1]);
    want = Math.min(Math.round(want * mood), cand.length);
  }
  if (want <= 0) return 0;

  if (FILL && spanDays) {
    console.log(`[날짜] ${key} — 이미 있는 글이 ${spanDays}일에 걸쳐 있어 같은 기간에 흩습니다`);
  }

  if (DRY) {
    console.log(`[dry] ${key} — ${want}건 올릴 수 있습니다 (남은 글 ${cand.length}개)`);
    cand.slice(0, Math.min(want, 5)).forEach((p, i) => {
      const tag = langOf(p) === 'ko' ? '' : `[${langOf(p).toUpperCase()}] `;
      console.log(`        ${i + 1}. ${p.category} · ${tag}${p.title}`);
    });
    if (want > 5) console.log(`        … 그리고 ${want - 5}건`);
    return want;
  }

  let made = 0;
  for (let i = 0; i < want; i++) {
    /* ★ 언어를 <b>먼저</b> 고르고 그 안에서 글을 뽑습니다 (2026-08-15)
         그냥 섞어 뽑으면 후보가 많은 한국어가 거의 다 뽑힙니다.
         한국어 300개 · 영어 12개면 영어가 뽑힐 확률이 4%입니다. */
    const have = new Set(cand.map(langOf));
    const useLang = pickLang(
      ONLY_LANG ? { [ONLY_LANG]: 1 } : (hasLang ? cfg.langs : { ko: 1 }),
      have
    );
    const bucket = cand.filter((p) => langOf(p) === useLang);
    const chosen = bucket[Math.floor(Math.random() * bucket.length)];
    cand.splice(cand.indexOf(chosen), 1);
    const p = chosen;
    const row = {
      category: p.category,
      title: p.title,
      body: p.body,
      /* ★ 평소 회차는 지금 시각 근처(jitterNow) —
           한꺼번에 채울 때는 <b>여러 날에 흩습니다</b>(spreadDate).
           그러지 않으면 담은 것이 모두 오늘 날짜가 됩니다. */
      created_at: FILL ? spreadDate(i, want, spanDays) : jitterNow(),
      view_count: rnd(3, 40),
    };
    /* ★ 어느 말로 쓴 글인지 적어 둡니다 — 목록의 EN·日 배지가 이걸 봅니다.
         칸이 없으면 넣지 않습니다(넣으면 저장이 통째로 실패합니다). */
    if (hasLang) row.lang = langOf(p);
    /* ★ 글쓴이 이름은 <b>그 나라 이름</b>이어야 합니다. 영어 글에
         「새벽연습」이 붙으면 그 자리에서 들킵니다. 풀에 적힌 이름을
         쓰고, 없을 때만 한국어 글에 한해 공용 이름을 씁니다. */
    if (cfg.authorName) {
      row.author_name = p.author || (langOf(p) === 'ko' ? pick(POOL.authors) : null);
      if (!row.author_name) delete row.author_name;
    }
    if (cfg.likes) row.like_count = rnd(0, 3);
    if (cfg.dislikes) row.dislike_count = chance(0.15) ? rnd(1, 2) : 0;
    if (p.thumb_url) row.thumb_url = p.thumb_url;
    (cfg.extraCols || []).forEach((c) => { if (p[c] !== undefined) row[c] = p[c]; });

    const saved = await sbInsert(cfg.table, row);
    const tag = langOf(p) === 'ko' ? '' : `[${langOf(p).toUpperCase()}] `;
    console.log(`[post] ${key} · ${p.category} · ${tag}${p.title}`);
    made++;

    // 갓 올라온 글에 댓글 하나가 바로 붙는 경우가 있음 (사람 같은 패턴)
    if (p.comments && p.comments.length && chance(0.45)) {
      await addComment(cfg, saved, p, 0);
    }
  }
  return made;
}

/* ============================================================
   5) 기존 글에 댓글 붙이기
   ------------------------------------------------------------
   글마다 풀에 준비된 댓글을 순서대로 하나씩 붙입니다.
   (순서대로여야 대화 흐름 — 원글쓴이 재답변·이견 — 이 깨지지 않습니다)
   ============================================================ */
async function addComment(cfg, postRow, poolPost, forcedIdx) {
  const list = poolPost.comments || [];
  if (!list.length) return false;

  let idx = forcedIdx;
  if (idx === undefined) {
    const have = await sbCount(cfg.commentTable, `${cfg.fk}=eq.${postRow.id}`);
    idx = have;
  }
  if (idx >= list.length) return false;

  const c = list[idx];
  await sbInsert(cfg.commentTable, {
    [cfg.fk]: postRow.id,
    author_name: c.author,
    body: c.body,
    created_at: afterButBeforeNow(postRow.created_at),
  });
  console.log(`[comment] ${cfg.table} #${postRow.id} ← ${c.author}`);
  return true;
}

async function seedComments(mood) {
  let want = Math.round(rnd(COMMENTS_PER_RUN[0], COMMENTS_PER_RUN[1]) * mood);
  if (want <= 0) return 0;

  // 댓글이 아직 다 안 붙은 시드 글 모으기
  const targets = [];
  for (const [key, cfg] of Object.entries(BOARDS)) {
    const posts = POOL.posts.filter((p) => p.board === key && p.comments && p.comments.length);
    if (!posts.length) continue;
    const byTitle = new Map(posts.map((p) => [p.title, p]));
    const rows = await sbGet(
      `${cfg.table}?select=id,title,created_at&author_id=is.null&order=created_at.desc&limit=120`
    );
    rows.forEach((r) => {
      const p = byTitle.get(r.title);
      if (p) targets.push({ cfg, row: r, pool: p });
    });
  }
  if (!targets.length) return 0;

  let made = 0, tries = 0;
  while (made < want && tries < want * 6) {
    tries++;
    const t = pick(targets);
    // 최근 글에 댓글이 더 잘 붙게 (오래된 글은 낮은 확률)
    const ageDays = (Date.now() - new Date(t.row.created_at).getTime()) / 86400000;
    if (ageDays > 10 && !chance(0.3)) continue;
    if (await addComment(t.cfg, t.row, t.pool)) made++;
  }
  return made;
}

/* ============================================================
   6) 조회수·추천 소폭 상승 (숫자가 멈춰 있으면 죽은 게시판처럼 보임)
   ============================================================ */
async function bumpNumbers() {
  let n = 0;
  for (const [, cfg] of Object.entries(BOARDS)) {
    const rows = await sbGet(
      `${cfg.table}?select=id,view_count${cfg.likes ? ',like_count' : ''}` +
      `&author_id=is.null&order=created_at.desc&limit=25`
    );
    for (const r of rows) {
      if (!chance(0.5)) continue;
      const patch = { view_count: (r.view_count || 0) + rnd(1, 14) };
      if (cfg.likes && chance(0.18)) patch.like_count = (r.like_count || 0) + 1;
      await sbPatch(cfg.table, r.id, patch);
      n++;
    }
  }
  return n;
}

/* ============================================================
   7) 실행
   ============================================================ */
(async () => {
  /* ── 어느 게시판을 볼지 ─────────────────────────────────── */
  let boards = Object.entries(BOARDS);
  if (ONLY_BOARD) {
    boards = boards.filter(([k]) => k === ONLY_BOARD);
    if (!boards.length) {
      console.error('그런 게시판이 없습니다 : ' + ONLY_BOARD);
      console.error('쓸 수 있는 이름 : ' + Object.keys(BOARDS).join(' · '));
      process.exit(1);
    }
  }

  /* ── 평소 회차 ──────────────────────────────────────────── */
  if (!FILL) {
    const mood = moodFactor();
    if (mood === 0) {
      console.log('=== 조용한 회차 — 새 글 없이 종료 ===');
      console.log('    (일부러 넣어 둔 장치입니다. 한꺼번에 채우시려면 --fill=30 을 주십시오)');
      return;
    }

    let posts = 0, comments = 0;
    for (const [key, cfg] of boards) {
      try {
        posts += await seedPosts(key, cfg, mood);
      } catch (e) {
        console.error(`[error] ${key} 글 등록 실패 — ${e.message}`);
      }
    }
    try { comments = await seedComments(mood); }
    catch (e) { console.error('[error] 댓글 실패 — ' + e.message); }

    let bumped = 0;
    try { bumped = await bumpNumbers(); }
    catch (e) { console.error('[error] 조회수 갱신 실패 — ' + e.message); }

    console.log(`=== 완료: 새 글 ${posts} · 댓글 ${comments} · 숫자갱신 ${bumped} ===`);
    return;
  }

  /* ── 한꺼번에 채우기 (--fill) ───────────────────────────────
     ★ 게시판에 <b>골고루</b> 나눠 담습니다. 한 게시판에 몰리면
       그 게시판만 갑자기 늘어나 어색합니다.
     ★ 남은 글이 없는 게시판은 저절로 건너갑니다 — 그만큼
       다른 게시판이 더 받도록 <b>여러 바퀴</b>를 돕니다. */
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  한꺼번에 채우기 (--fill)                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(DRY ? '\n※ 담지 않고 무엇이 올라갈지만 봅니다 (--dry)\n'
                  : `\n★ 목표 ${FILL}건을 지금 담습니다\n`);
  if (ONLY_BOARD) console.log(`※ ${ONLY_BOARD} 게시판만 봅니다\n`);

  let posts = 0;
  const per = {};
  /* 한 바퀴에 게시판마다 최대 몇 건씩 — 몰리지 않게 작게 잡고 여러 바퀴 */
  const STEP = Math.max(1, Math.ceil(FILL / (boards.length * 3)));

  for (let round = 1; round <= 40 && posts < FILL; round++) {
    let madeThisRound = 0;
    for (const [key, cfg] of boards) {
      if (posts >= FILL) break;
      const want = Math.min(STEP, FILL - posts);
      try {
        const n = await seedPosts(key, cfg, 1, want);
        posts += n; madeThisRound += n;
        if (n) per[key] = (per[key] || 0) + n;
      } catch (e) {
        console.error(`[error] ${key} 글 등록 실패 — ${e.message}`);
      }
    }
    /* 한 바퀴 돌아 아무것도 못 담았으면 더 돌아도 소용없습니다 */
    if (!madeThisRound) {
      console.log('\n※ 더 담을 글이 없습니다 — 풀이 모두 쓰였거나 상한에 닿았습니다.');
      break;
    }
  }

  console.log('\n── 게시판별 ──');
  for (const [key, cfg] of boards) {
    console.log(`   ${key.padEnd(20)} ${String(per[key] || 0).padStart(4)}건`);
    void cfg;
  }
  console.log(`\n=== ${DRY ? '올릴 수 있는 글' : '담은 글'} ${posts}건 / 목표 ${FILL}건 ===`);
  if (!DRY && posts) {
    console.log('    화면에서 확인해 보십시오. 댓글과 조회수는 평소 회차가 채웁니다.');
  }
})();
