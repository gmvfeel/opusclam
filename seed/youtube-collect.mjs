/* ============================================================
   OPUSCLAM 음원·동영상 수집 — seed/youtube-collect.mjs

   무엇을 하나
    · spot_media_query 에 등록된 검색 조건으로 유튜브를 찾아
      쓸 만한 영상만 골라 spot 표(section='음원영상')에 담습니다
    · 담긴 것은 숨김 상태이며, 어드민에서 확인해 내보낸 것만 화면에 나옵니다

   어떻게 걸러내나 — 네 겹
    1) 제목·채널 제외어   spot_media_block  (모음집·배경음악·홍보 영상)
    2) 재생 시간          조건의 min_sec ~ max_sec 밖이면 버림
    3) 채널 신뢰도        spot_media_channel 에 있으면 점수를 크게 줌
    4) 인물DB 대조        제목·설명에 인물DB 이름이 나오면 점수를 줌
   합계가 조건의 min_score 에 못 미치면 저장하지 않습니다.

   점수 배점
     채널 신뢰   trust 3 → 45 · 2 → 32 · 1 → 18 · 목록에 없으면 0
     인물DB      한글 이름 20 · 로마자 이름 14 (합계 최대 48)
     길이 적정   15
     작품번호    8   (Op. BWV K. D. Hob. RV 등)
     작품 갈래   8   (협주곡·교향곡·concerto·quartet 등)
     실황·초연   8
     설명 충실   5   (200자 이상)

   쓰는 법
     node seed/youtube-collect.mjs                 모든 활성 조건
     node seed/youtube-collect.mjs --id=3          조건 하나만
     node seed/youtube-collect.mjs --dry           저장하지 않고 점수만 봅니다
     node seed/youtube-collect.mjs --show-rejected 버린 것도 이유와 함께 보여줍니다

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
     YOUTUBE_KEY

   드는 비용
     유튜브 무료 한도는 하루 10,000. 조건 하나에 약 101 이 듭니다.
     조건 일곱 개면 약 707 로, 한도의 7% 입니다.
     한도를 넘으면 과금이 아니라 그날 중단되고 다음날 초기화됩니다.
   ============================================================ */

import { makeGetJSON, isStop, sleep } from '../scripts/lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const YT_KEY = process.env.YOUTUBE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}
if (!YT_KEY) {
  console.error('환경변수 YOUTUBE_KEY 가 필요합니다. (GitHub Secrets 에 등록)');
  process.exit(1);
}

const UA = 'OpusclamMediaBot/1.0 (https://opusclam.com; contact@opusclam.com)';
const ytGet = makeGetJSON({ ua: UA, accept: 'application/json' });

/* ── 실행 인자 ── */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const ONLY_ID   = args.id ? Number(args.id) : null;
const DRY       = !!args.dry;
const SHOW_REJ  = !!args['show-rejected'];

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

/* 1000행씩 끝까지 받아옵니다 (Supabase 기본 상한이 1000행입니다) */
async function sbAll(path, select) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await sb(`${path}${path.includes('?') ? '&' : '?'}select=${select}` +
                          `&limit=1000&offset=${from}`);
    if (!Array.isArray(rows) || !rows.length) break;
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/* ============================================================
   설정 읽기
   ============================================================ */
async function loadConfig() {
  const q = ONLY_ID
    ? await sb(`spot_media_query?select=*&id=eq.${ONLY_ID}`)
    : await sb('spot_media_query?select=*&is_active=is.true&order=sort_order.asc.nullslast,id.asc');

  const channels = await sb('spot_media_channel?select=*&is_active=is.true');
  const blocks   = await sb('spot_media_block?select=word,target&is_active=is.true');

  return {
    queries: q || [],
    channels: (channels || []).map((c) => ({ ...c, m: String(c.name_match || '').toLowerCase() })),
    blockTitle: (blocks || []).filter((b) => b.target === 'title')
                              .map((b) => String(b.word).toLowerCase()),
    blockChannel: (blocks || []).filter((b) => b.target === 'channel')
                                .map((b) => String(b.word).toLowerCase()),
  };
}

/* 이미 담은 영상과, 한 번 버린 영상은 다시 담지 않습니다 */
async function loadSeen() {
  const rows = await sbAll('spot?video_id=not.is.null', 'video_id,review_status');
  const seen = new Set();
  for (const r of rows) if (r.video_id) seen.add(r.video_id);
  return seen;
}

/* ============================================================
   인물DB 이름 — 영상이 진짜 클래식인지 가리는 가장 센 잣대
   ============================================================ */

/* 사람 이름으로 쓰기 위험한 흔한 낱말.
   예전에 성이 일반 낱말과 겹쳐 엉뚱하게 이어진 일이 있었습니다. */
const RISKY = new Set([
  'about','music','musik','north','south','east','west','smart','young','king','queen',
  'brown','white','green','black','best','love','hope','grace','may','august','march',
  'river','stone','field','wood','hall','park','young','long','short','little','great',
  'new','old','first','last','light','dark','summer','winter','spring','autumn','fall',
  'day','night','morning','evening','song','sound','voice','piano','violin','cello',
  'opera','orchestra','concert','festival','live','studio','records','classic','classical',
]);

async function loadPersons() {
  const rows = await sbAll('persons?hidden=is.false', 'id,name_ko,name_en,field');
  const list = [];
  for (const p of rows) {
    const push = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return;
      const low = s.toLowerCase();
      if (RISKY.has(low)) return;
      /* 한글은 세 글자부터, 로마자는 다섯 글자부터 씁니다.
         짧은 이름은 다른 낱말에 걸려 엉뚱한 결과를 냅니다. */
      const hangul = /[가-힣]/.test(s);
      if (hangul ? s.replace(/\s/g, '').length < 3 : low.length < 5) return;
      list.push({ id: p.id, name: s, key: low });
    };
    push(p.name_ko);
    push(p.name_en);
    /* 로마자 이름의 성만으로도 찾습니다 (베토벤·말러처럼 성만 쓰는 일이 흔합니다).
       다만 다섯 글자 이상이고 흔한 낱말이 아닐 때만 씁니다. */
    const en = String(p.name_en || '').trim();
    if (en && !/[가-힣]/.test(en)) {
      const parts = en.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        const sur = parts[parts.length - 1].replace(/[^A-Za-zÀ-ÿ'-]/g, '');
        const low = sur.toLowerCase();
        if (sur.length >= 5 && !RISKY.has(low)) list.push({ id: p.id, name: sur, key: low });
      }
    }
  }
  /* 같은 열쇠는 하나만 남깁니다 */
  const map = new Map();
  for (const it of list) if (!map.has(it.key)) map.set(it.key, it);
  return [...map.values()];
}

function matchPersons(text, persons) {
  const low = String(text || '').toLowerCase();
  if (!low) return [];
  const hit = [];
  for (const p of persons) {
    if (low.includes(p.key)) {
      hit.push(p);
      if (hit.length >= 6) break;
    }
  }
  return hit;
}

/* ============================================================
   유튜브에서 받아오기
   ============================================================ */
const YT = 'https://www.googleapis.com/youtube/v3';

async function ytSearch(qcfg) {
  const p = new URLSearchParams({
    key: YT_KEY,
    part: 'snippet',
    type: 'video',
    q: qcfg.q,
    order: qcfg.order_by || 'relevance',
    maxResults: String(Math.min(Number(qcfg.max_results) || 12, 50)),
    /* 우리 화면에서 바로 재생하므로, 밖에서 재생할 수 있는 영상만 받습니다 */
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    safeSearch: 'strict',
  });
  if (qcfg.after_months) {
    const d = new Date();
    d.setMonth(d.getMonth() - Number(qcfg.after_months));
    p.set('publishedAfter', d.toISOString());
  }
  /* 길이 조건이 20분을 넘으면 긴 영상만 달라고 미리 알려 결과 품질을 올립니다 */
  if (Number(qcfg.min_sec) >= 1200) p.set('videoDuration', 'long');
  else if (Number(qcfg.max_sec) <= 240) p.set('videoDuration', 'short');

  const j = await ytGet(`${YT}/search?${p}`);
  return (j && j.items ? j.items : [])
    .map((it) => (it.id && it.id.videoId) ? it.id.videoId : null)
    .filter(Boolean);
}

async function ytDetails(ids) {
  if (!ids.length) return [];
  const p = new URLSearchParams({
    key: YT_KEY,
    part: 'snippet,contentDetails,statistics,status',
    id: ids.join(','),
    maxResults: '50',
  });
  const j = await ytGet(`${YT}/videos?${p}`);
  return (j && j.items) ? j.items : [];
}

/* PT1H23M45S → 초 */
function isoToSec(iso) {
  const m = String(iso || '').match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600)
       + (Number(m[3] || 0) * 60) + Number(m[4] || 0);
}

/* ============================================================
   점수 매기기
   ============================================================ */
const OPUS_RE = /\b(op\.?\s?\d+|bwv\s?\d+|kv?\.?\s?\d{2,3}|d\.?\s?\d{2,4}|hob\.|rv\s?\d+|sz\.\s?\d+|woo\s?\d+)/i;
const LIVE_RE = /(premiere|première|world premiere|live|실황|초연|first performance)/i;
/* 작품 갈래가 제목에 드러나면 연주 영상일 가능성이 큽니다 */
const FORM_RE = /(협주곡|교향곡|소나타|사중주|삼중주|오중주|가곡|모테트|칸타타|미사|서곡|변주곡|전주곡|모음곡|concerto|symphon|sonata|quartet|quintet|trio|etude|étude|prelude|fugue|cantata|requiem|nocturne|rhapsod|suite for|for orchestra|for piano|for violin|for cello)/i;

function judge(v, qcfg, cfg, persons) {
  const title = String(v.snippet?.title || '');
  const desc  = String(v.snippet?.description || '');
  const chName = String(v.snippet?.channelTitle || '');
  const chId  = String(v.snippet?.channelId || '');
  const sec   = isoToSec(v.contentDetails?.duration);
  const lowT  = title.toLowerCase();
  const lowC  = chName.toLowerCase();

  /* ① 제외어 — 하나라도 걸리면 바로 버립니다 */
  for (const w of cfg.blockTitle) if (lowT.includes(w)) return { ok: false, why: `제목 제외어 「${w}」` };
  for (const w of cfg.blockChannel) if (lowC.includes(w)) return { ok: false, why: `채널 제외어 「${w}」` };

  /* 밖에서 재생할 수 없는 영상은 우리 화면에서 못 틉니다 */
  if (v.status && v.status.embeddable === false) return { ok: false, why: '외부 재생 불가' };

  /* ② 재생 시간 */
  if (!sec) return { ok: false, why: '재생 시간 확인 불가' };
  const minS = Number(qcfg.min_sec) || 0;
  const maxS = Number(qcfg.max_sec) || 999999;
  if (sec < minS) return { ok: false, why: `너무 짧음 ${Math.round(sec/60)}분 (기준 ${Math.round(minS/60)}분)` };
  if (sec > maxS) return { ok: false, why: `너무 김 ${Math.round(sec/60)}분 (기준 ${Math.round(maxS/60)}분)` };

  /* ③ 채널 신뢰도 */
  let score = 0;
  const parts = [];
  const ch = cfg.channels.find((c) =>
    (c.channel_id && c.channel_id === chId) || (c.m && lowC.includes(c.m)));
  if (ch) {
    const add = ch.trust >= 3 ? 45 : ch.trust === 2 ? 32 : 18;
    score += add; parts.push(`채널 ${ch.name} +${add}`);
  } else if (qcfg.trusted_only) {
    return { ok: false, why: '믿을 수 있는 채널이 아님' };
  }

  /* ④ 인물DB 대조 */
  const hits = matchPersons(title + ' ' + desc.slice(0, 900), persons);
  if (hits.length) {
    /* 한글 이름은 로마자보다 무게를 더 둡니다.
       「진은숙」이 제목에 있으면 우연히 겹칠 일이 거의 없습니다.
       반면 로마자 성(Bach·Ligeti)은 다른 뜻으로 쓰일 수 있습니다. */
    let add = 0;
    for (const h of hits) add += /[가-힣]/.test(h.name) ? 20 : 14;
    add = Math.min(add, 48);
    score += add; parts.push(`인물 ${hits.map((h) => h.name).join('·')} +${add}`);
  }

  /* ⑤ 덧점 */
  score += 15; parts.push('길이 적정 +15');
  if (OPUS_RE.test(title)) { score += 8; parts.push('작품번호 +8'); }
  if (FORM_RE.test(title)) { score += 8; parts.push('작품 갈래 +8'); }
  if (LIVE_RE.test(title)) { score += 8; parts.push('실황·초연 +8'); }
  if (desc.length >= 200) { score += 5; parts.push('설명 충실 +5'); }

  const need = Number(qcfg.min_score) || 55;
  if (score < need) return { ok: false, why: `점수 ${score} < ${need} (${parts.join(' / ')})` };

  return { ok: true, score, parts, sec, hits, ch, title, desc, chName, chId };
}

/* ============================================================
   담기
   ============================================================ */
function buildRow(v, j, qcfg) {
  const sn = v.snippet || {};
  /* 설명은 앞부분만 담습니다. 유튜브 설명에는 링크·해시태그가 길게 붙습니다. */
  const body = String(sn.description || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);

  return {
    section: '음원영상',
    category: qcfg.category || '동영상',
    region: /[가-힣]/.test(j.title) ? '국내' : '해외',
    title: j.title.slice(0, 200),
    body: body || null,
    video_id: v.id,
    link_url: `https://www.youtube.com/watch?v=${v.id}`,
    thumb_url: sn.thumbnails?.high?.url || sn.thumbnails?.medium?.url || null,
    channel_id: j.chId || null,
    channel_name: j.chName || null,
    duration_sec: j.sec,
    published_at: sn.publishedAt || null,
    yt_views: Number(v.statistics?.viewCount || 0) || null,
    organizer: j.chName || null,
    keywords: (j.hits || []).map((h) => h.name).join(',') || null,
    matched_names: (j.hits || []).map((h) => h.name).join(', ') || null,
    person_ids: (j.hits || []).map((h) => h.id),
    media_score: j.score,
    media_query_id: qcfg.id,
    fetched_at: new Date().toISOString(),
    review_status: 'pending',
    hidden: true,                 /* 확인 전에는 화면에 나오지 않습니다 */
    source: `유튜브 · ${j.chName}`,
    source_url: `https://www.youtube.com/watch?v=${v.id}`,
    author_name: '자동수집',
  };
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  console.log('── 음원·동영상 수집 시작 ──');
  const cfg = await loadConfig();
  if (!cfg.queries.length) {
    console.log('활성 검색 조건이 없습니다. spot_media_query 를 확인하세요.');
    return;
  }
  console.log(`검색 조건 ${cfg.queries.length}개 · 믿을 수 있는 채널 ${cfg.channels.length}곳 ·`
            + ` 제외어 ${cfg.blockTitle.length + cfg.blockChannel.length}개`);

  const seen = await loadSeen();
  console.log(`이미 담긴(또는 버린) 영상 ${seen.length || seen.size}개`);

  const persons = await loadPersons();
  console.log(`인물DB 대조용 이름 ${persons.length}개`);

  let totalNew = 0, totalRej = 0, quota = 0;
  const newChannelIds = new Map();

  for (const q of cfg.queries) {
    if (isStop()) { console.log('시간·실패 한도에 걸려 여기까지 저장하고 멈춥니다.'); break; }
    console.log(`\n[${q.id}] ${q.name} — "${q.q}"`);

    let ids = [];
    try {
      ids = await ytSearch(q);
      quota += 100;
    } catch (e) {
      console.log(`  검색 실패: ${e.message}`);
      continue;
    }
    const fresh = ids.filter((id) => !seen.has(id));
    console.log(`  찾음 ${ids.length}개 · 새것 ${fresh.length}개`);
    if (!fresh.length) { await sleep(300); continue; }

    let items = [];
    try {
      items = await ytDetails(fresh);
      quota += 1;
    } catch (e) {
      console.log(`  상세 실패: ${e.message}`);
      continue;
    }

    const rows = [];
    for (const v of items) {
      const j = judge(v, q, cfg, persons);
      if (!j.ok) {
        totalRej++;
        if (SHOW_REJ) console.log(`  버림 · ${String(v.snippet?.title || '').slice(0, 46)} → ${j.why}`);
        continue;
      }
      console.log(`  담음 ${j.score}점 · ${j.title.slice(0, 46)}`);
      console.log(`        ${j.parts.join(' / ')}`);
      rows.push(buildRow(v, j, q));
      seen.add(v.id);
      /* 채널 번호를 아직 모르는 신뢰 채널이면 기억해 둡니다 */
      if (j.ch && !j.ch.channel_id && j.chId) newChannelIds.set(j.ch.id, j.chId);
    }

    if (rows.length && !DRY) {
      try {
        await sb('spot?on_conflict=video_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        });
      } catch (e) {
        console.log(`  저장 실패: ${e.message}`);
      }
    }
    totalNew += rows.length;

    if (!DRY) {
      try {
        await sb(`spot_media_query?id=eq.${q.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_run_at: new Date().toISOString(), last_found: rows.length }),
        });
      } catch (e) { /* 기록 실패는 넘어갑니다 */ }
    }
    await sleep(400);
  }

  /* 신뢰 채널의 번호를 채워 둡니다 — 다음부터는 이름이 아니라 번호로 정확히 알아봅니다 */
  if (newChannelIds.size && !DRY) {
    for (const [id, chId] of newChannelIds) {
      try {
        await sb(`spot_media_channel?id=eq.${id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ channel_id: chId }),
        });
      } catch (e) { /* 넘어갑니다 */ }
    }
    console.log(`\n채널 번호 ${newChannelIds.size}곳을 채웠습니다.`);
  }

  console.log(`\n── 끝 ──`);
  console.log(`담은 것 ${totalNew}개 · 버린 것 ${totalRej}개 · 쓴 한도 약 ${quota} (하루 10,000)`);
  if (DRY) console.log('※ --dry 였으므로 아무것도 저장하지 않았습니다.');
  else if (totalNew) console.log('※ 담긴 것은 숨김 상태입니다. 어드민에서 확인해 내보내 주세요.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
