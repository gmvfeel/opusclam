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
   ============================================================ */
const BOARDS = {
  hottopic: {
    table: 'hottopic', commentTable: 'hottopic_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1],
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
    perRun: [0, 1],
  },
  admission_community: {
    table: 'admission_community', commentTable: 'admission_community_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1],
  },
  qna: {
    table: 'qna', commentTable: 'qna_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    extraCols: ['track', 'keywords'],
    perRun: [0, 1],
    // comment_count 는 trg_qna_cmt 트리거가 자동으로 셉니다 → 직접 넣지 않음
  },
  gallery: {
    table: 'gallery', commentTable: 'gallery_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    requireThumb: true,
    perRun: [0, 1], weekly: true,
  },
  news: {
    table: 'news', commentTable: 'news_comments', fk: 'news_id',
    body: 'html', authorName: false, likes: false, dislikes: false,
    onlyCategory: ['국내', '해외'],
    perRun: [0, 1], weekly: true,
  },

  /* ★ 세 게시판을 새로 넣습니다.
     지금까지 자동시드가 다섯 게시판만 다뤄, 현대음악·태교음악·
     유틸리티는 8~9건에서 멈춰 있었습니다.
     회차당 0~1글씩 · 주 1회로 두어 천천히 쌓이게 합니다. */
  modern_music: {
    table: 'modern_music', commentTable: 'modern_music_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], weekly: true,
  },
  prenatal_music: {
    table: 'prenatal_music', commentTable: 'prenatal_music_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], weekly: true,
  },
  utility: {
    table: 'utility', commentTable: 'utility_comments', fk: 'news_id',
    body: 'html', authorName: true, likes: true, dislikes: true,
    perRun: [0, 1], weekly: true,
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

  // 상한·가드 확인
  const [realCnt, seedCnt] = await Promise.all([
    sbCount(cfg.table, 'author_id=not.is.null'),
    sbCount(cfg.table, 'author_id=is.null'),
  ]);
  if (realCnt >= GUARD_REAL_POSTS) {
    console.log(`[skip] ${key} — 실제 회원 글 ${realCnt}개, 자동 등록 중단`);
    return 0;
  }
  if (seedCnt >= GUARD_SEED_POSTS) {
    console.log(`[skip] ${key} — 시드 글 상한(${GUARD_SEED_POSTS}) 도달`);
    return 0;
  }
  /* ★ --fill 로 채우는 중이면 「느린 게시판」 건너뛰기를 하지 않습니다.
       평소에는 이 줄이 현대음악·태교음악·유틸리티를 대개 넘겨 줍니다. */
  if (!want0 && cfg.weekly && !chance(0.28)) return 0;   // 느린 게시판

  // 이미 올라간 제목은 건너뜀
  const rows = await sbGet(`${cfg.table}?select=title&author_id=is.null&limit=1000`);
  const used = new Set(rows.map((r) => r.title));
  let cand = posts.filter((p) => !used.has(p.title));
  if (cfg.onlyCategory) cand = cand.filter((p) => cfg.onlyCategory.includes(p.category));
  if (cfg.requireThumb) cand = cand.filter((p) => !!p.thumb_url);
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

  if (DRY) {
    console.log(`[dry] ${key} — ${want}건 올릴 수 있습니다 (남은 글 ${cand.length}개)`);
    cand.slice(0, Math.min(want, 5)).forEach((p, i) => {
      console.log(`        ${i + 1}. ${p.category} · ${p.title}`);
    });
    if (want > 5) console.log(`        … 그리고 ${want - 5}건`);
    return want;
  }

  let made = 0;
  for (let i = 0; i < want; i++) {
    const p = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
    const row = {
      category: p.category,
      title: p.title,
      body: p.body,
      created_at: jitterNow(),
      view_count: rnd(3, 40),
    };
    if (cfg.authorName) row.author_name = p.author || pick(POOL.authors);
    if (cfg.likes) row.like_count = rnd(0, 3);
    if (cfg.dislikes) row.dislike_count = chance(0.15) ? rnd(1, 2) : 0;
    if (p.thumb_url) row.thumb_url = p.thumb_url;
    (cfg.extraCols || []).forEach((c) => { if (p[c] !== undefined) row[c] = p[c]; });

    const saved = await sbInsert(cfg.table, row);
    console.log(`[post] ${key} · ${p.category} · ${p.title}`);
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
