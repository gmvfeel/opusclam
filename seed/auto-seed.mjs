/* ============================================================
   OPUSCLAM 자동 시드 스크립트 (GitHub Actions 크론에서 실행)
   · 매 실행마다: 새 글 소량 + 댓글 소량 + 일부 글 조회수 소폭 상승
   · 전부 author_id = NULL (실제 회원과 구분, 나중에 일괄 삭제 가능)
   · 정지 가드: 실제 회원 글이 충분히 쌓이면 스스로 종료
   · 환경변수(GitHub Secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */
import { createClient } from '@supabase/supabase-js';
import { AUTHORS, POSTS, COMMENTS } from './content-pool.mjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error('환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.'); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

/* ── 설정 ── */
const BOARDS = {
  hottopic:            { table: 'hottopic',            comments: 'hottopic_comments',            reactions: true },
  gallery:             { table: 'gallery',             comments: 'gallery_comments',             reactions: true },
  admission_community: { table: 'admission_community', comments: 'admission_community_comments', reactions: true },
  news:                { table: 'news',                comments: 'news_comments',                reactions: false },
};
const STOP_WHEN_REAL_POSTS = 120; // 실제 회원 글이 이만큼 쌓이면 자동시드 종료
const MAX_SEED_POSTS = 300;       // 시드 글 상한(도배 방지)

/* ── 유틸 ── */
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
const thumb = () => `https://picsum.photos/seed/oc${Date.now()}${rand(100, 999)}/640/420`;
const kstDay = new Date(Date.now() + 9 * 3600 * 1000).getUTCDay(); // 0 일 ~ 6 토
const isWeekend = (kstDay === 0 || kstDay === 6);

async function countPosts(filterNull) {
  let total = 0;
  for (const b of Object.values(BOARDS)) {
    let q = sb.from(b.table).select('id', { count: 'exact', head: true });
    q = filterNull ? q.is('author_id', null) : q.not('author_id', 'is', null);
    const { count, error } = await q;
    if (!error && count != null) total += count;
  }
  return total;
}

async function titleExists(table, title) {
  const { data } = await sb.from(table).select('id').eq('title', title).limit(1);
  return !!(data && data.length);
}

async function addPosts(n) {
  if (n <= 0) return 0;
  let made = 0;
  for (const p of shuffle(POSTS)) {
    if (made >= n) break;
    const cfg = BOARDS[p.board];
    if (!cfg) continue;
    if (await titleExists(cfg.table, p.title)) continue; // 이미 올라간 글은 건너뜀(반복 방지)
    const row = {
      category: p.category, title: p.title, body: p.body,
      thumb_url: thumb(), author_name: pick(AUTHORS),
      view_count: rand(15, 90), created_at: new Date().toISOString(),
    };
    if (cfg.reactions) { row.like_count = rand(2, 18); row.dislike_count = rand(0, 3); }
    const { error } = await sb.from(cfg.table).insert(row);
    if (error) { console.warn(`[post] ${p.board} 실패: ${error.message}`); continue; }
    made++;
    console.log(`[post] ${p.board} · ${p.title}`);
  }
  return made;
}

async function addComments(n) {
  if (n <= 0) return 0;
  let made = 0, tries = 0;
  const keys = Object.keys(BOARDS);
  while (made < n && tries < n * 6) {
    tries++;
    const bk = pick(keys);
    const cfg = BOARDS[bk];
    const pool = COMMENTS[bk] || [];
    if (!pool.length) continue;
    // 최근 글 중 하나 고르기(너무 오래된 글엔 잘 안 달리게 상위 40개에서)
    const { data: posts, error } = await sb.from(cfg.table).select('id, created_at').order('created_at', { ascending: false }).limit(40);
    if (error || !posts || !posts.length) continue;
    const target = pick(posts);
    const body = pick(pool);
    // 같은 글에 같은 댓글 중복 방지(가벼운 체크)
    const { data: dup } = await sb.from(cfg.comments).select('id').eq('news_id', target.id).eq('body', body).limit(1);
    if (dup && dup.length) continue;
    const { error: cerr } = await sb.from(cfg.comments).insert({
      news_id: target.id, author_name: pick(AUTHORS), body,
      created_at: new Date().toISOString(),
    });
    if (cerr) { console.warn(`[comment] ${bk} 실패: ${cerr.message}`); continue; }
    made++;
    console.log(`[comment] ${bk} → #${target.id}`);
  }
  return made;
}

async function bumpViews() {
  // 게시판별 최근 글 몇 개의 조회수를 소폭 올려 '읽히는' 느낌
  for (const cfg of Object.values(BOARDS)) {
    const { data: posts } = await sb.from(cfg.table).select('id, view_count, like_count').order('created_at', { ascending: false }).limit(25);
    if (!posts || !posts.length) continue;
    const sample = shuffle(posts).slice(0, rand(2, 5));
    for (const p of sample) {
      const upd = { view_count: (p.view_count || 0) + rand(1, 12) };
      if (cfg.reactions && Math.random() < 0.25) upd.like_count = (p.like_count || 0) + 1; // 가끔 추천 +1
      await sb.from(cfg.table).update(upd).eq('id', p.id);
    }
  }
}

async function main() {
  console.log(`=== auto-seed 시작 (KST 요일:${kstDay}, 주말:${isWeekend}) ===`);

  const real = await countPosts(false);
  if (real >= STOP_WHEN_REAL_POSTS) {
    console.log(`실제 회원 글 ${real}개(임계 ${STOP_WHEN_REAL_POSTS}) 이상 → 자동시드 종료.`);
    return;
  }
  const seeded = await countPosts(true);

  // 이번 회차 새 글 수 (주말/조용한 회차 변동)
  let nPosts = rand(1, 3);
  if (isWeekend) nPosts = rand(0, 2);
  if (Math.random() < 0.15) nPosts = 0;           // 가끔 새 글 없는 회차
  if (seeded >= MAX_SEED_POSTS) nPosts = 0;        // 상한 도달 시 새 글 중단(도배 방지)

  // 이번 회차 댓글 수
  let nComments = isWeekend ? rand(2, 5) : rand(3, 6);

  const madeP = await addPosts(nPosts);
  const madeC = await addComments(nComments);
  await bumpViews();

  console.log(`=== 완료: 새 글 ${madeP} · 댓글 ${madeC} (누적 시드글 ${seeded + madeP}, 실제글 ${real}) ===`);
}

main().catch(e => { console.error('auto-seed 오류:', e); process.exit(1); });
