/* ============================================================
   OPUSCLAM 음원·동영상 수집 — seed/youtube-collect.mjs

   무엇을 하나
    · 믿을 수 있는 채널(spot_media_channel)이 새로 올린 영상을 받아
      spot 표(section='음원영상')에 담습니다  ← 주력
    · 검색 조건(spot_media_query)으로 찾아오는 길도 있습니다  ← 보조
    · 담긴 것은 숨김 상태이며, 어드민에서 확인해 내보낸 것만 화면에 나옵니다

   왜 채널 훑기가 주력인가
     첫 시험에서 검색으로 26개를 담았는데 쓸 만한 것이 6개였습니다
     (재즈·무용·코믹콘이 섞였습니다). 쓸 만했던 6개는 모두 정식 채널 것이었습니다.
     한도도 검색은 707, 채널 훑기는 약 120 입니다.

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
     node seed/youtube-collect.mjs                      채널 훑기 (주력)
     node seed/youtube-collect.mjs --channels=20        채널 20곳만 (처음 나눠 돌 때)
     node seed/youtube-collect.mjs --mode=search        검색만 (보조)
     node seed/youtube-collect.mjs --mode=both          둘 다
     node seed/youtube-collect.mjs --per=25             채널마다 최신 25개까지
     node seed/youtube-collect.mjs --dry                저장하지 않고 결과만 봅니다
     node seed/youtube-collect.mjs --show-rejected      버린 것도 이유와 함께

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
/* 방식 — channels 채널 훑기(주력) · search 검색(보조) · both 둘 다 */
const MODE      = String(args.mode || 'channels');
/* 한 번에 훑을 채널 수. 처음에는 채널 번호를 알아내는 데 한도가 들어
   나눠 도는 편이 안전합니다 (예: --channels=20 으로 사흘에 나누기) */
const CH_LIMIT  = args.channels ? Number(args.channels) : null;
/* 채널마다 최신 몇 개를 볼지 */
const PER_CH    = args.per ? Number(args.per) : 15;

if (!['channels', 'search', 'both'].includes(MODE)) {
  console.error('--mode 는 channels / search / both 중 하나여야 합니다.');
  process.exit(1);
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
    blockTitle: prepBlocks(blocks, 'title'),
    blockChannel: prepBlocks(blocks, 'channel'),
  };
}

/* 제외어를 미리 다듬어 둡니다.

   왜 이렇게 하나 — 첫 채널 시험에서 이런 일이 있었습니다.
     「discover」 의 cover 에 걸려 정상 영상이 버려졌습니다
     「Tchaikovsky」 의 vs 에 걸려 차이코프스키가 버려졌습니다
   글자 이어짐으로 찾았기 때문입니다. 로마자는 낱말 경계로 찾습니다.
   한글은 낱말 경계가 없으므로 그대로 이어짐으로 찾습니다(「모음집」의 「모음」). */
function prepBlocks(blocks, target) {
  return (blocks || [])
    .filter((b) => b.target === target)
    .map((b) => {
      const w = String(b.word || '').toLowerCase().trim();
      if (!w) return null;
      if (/[가-힣]/.test(w)) return { w, ko: true };
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s\\-]+');
      /* 앞 경계만 봅니다 — 뒤는 열어 둡니다.
           앞을 막으므로   discover 의 cover · Tchaikovsky 의 vs · Malcolm 의 calm 은 안 걸립니다
           뒤를 열어 두므로 dance 로 dancer·dancing 까지, cover 로 covered 까지 걸립니다 */
      return { w, ko: false, re: new RegExp('(^|[^a-z0-9])' + esc, 'i') };
    })
    .filter(Boolean);
}

/* 걸리면 그 낱말을, 안 걸리면 null 을 돌려줍니다 */
function findBlocked(text, list) {
  const low = String(text || '').toLowerCase();
  if (!low) return null;
  for (const b of list) {
    if (b.ko ? low.includes(b.w) : b.re.test(low)) return b.w;
  }
  return null;
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
  /* 작곡가로 등록되고 시대 정보가 있는 사람만 봅니다.
     연주자·지휘자까지 넣으면 흔한 성이 늘어나 엉뚱하게 걸립니다. */
  const rows = await sbAll(
    'persons?hidden=is.false&field=ilike.*%EC%9E%91%EA%B3%A1*&era_name=not.is.null',
    'id,name_ko,name_en'
  );
  const list = [];
  for (const p of rows) {
    const push = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return;
      const low = s.toLowerCase();
      if (RISKY.has(low)) return;
      const hangul = /[가-힣]/.test(s);
      /* 한글은 세 글자부터. 로마자는 「이름 성」처럼 두 낱말 이상이어야 합니다.
         성만으로는 찾지 않습니다 — 이것이 첫 시험에서 엉뚱한 결과를 낸 까닭입니다. */
      if (hangul) {
        if (s.replace(/\s/g, '').length < 3) return;
      } else {
        const words = low.split(/\s+/).filter(Boolean);
        if (words.length < 2) return;
        if (low.length < 8) return;
        if (words.some((w) => RISKY.has(w))) return;
      }
      list.push({ id: p.id, name: s, key: low });
    };
    push(p.name_ko);
    push(p.name_en);
  }
  const map = new Map();
  for (const it of list) if (!map.has(it.key)) map.set(it.key, it);
  return [...map.values()];
}

/* 제목에서만 찾습니다.
   첫 시험에서 설명문 900자까지 뒤졌더니 「Musician」「London」「Still」 같은 성이
   온갖 낱말에 걸려, 재즈 영상이 인물 네 명 매칭으로 48점을 받고 통과했습니다.
   이제 점수를 주지 않고, 어느 인물과 이어 줄지 찾는 데만 씁니다. */
function matchPersons(title, persons) {
  const low = String(title || '').toLowerCase();
  if (!low) return [];
  const hit = [];
  const seen = new Set();
  for (const p of persons) {
    if (!low.includes(p.key)) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id); hit.push(p);
    if (hit.length >= 4) break;
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
   채널 훑기 — 이제 이것이 주력입니다

   왜 검색이 아니라 채널인가
     첫 시험에서 검색으로 26개를 담았는데 쓸 만한 것이 6개였습니다.
     쓸 만했던 6개는 모두 정식 채널이 올린 것이었습니다.
     그러니 검색으로 뒤지는 대신, 믿을 수 있는 채널이 새로 올리는 것을 받습니다.

   드는 한도
     채널 번호를 이미 아는 곳   2 (올린 목록 + 상세)
     번호를 모르는 곳           102 (채널 찾기 100 + 위 2) — 처음 한 번만
   ============================================================ */

/* 채널 번호와 「올린 것 모음」 목록 번호를 알아냅니다.
   손잡이(@handle)를 알면 1, 이름으로 찾아야 하면 100 이 듭니다. */
async function resolveChannel(ch) {
  if (ch.uploads_playlist) return { uploads: ch.uploads_playlist, cost: 0, chId: ch.channel_id };

  /* ① 번호를 안다 */
  if (ch.channel_id) {
    const j = await ytGet(`${YT}/channels?key=${YT_KEY}&part=contentDetails&id=${ch.channel_id}`);
    const up = j?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (up) return { uploads: up, cost: 1, chId: ch.channel_id };
  }

  /* ② 손잡이를 안다 */
  if (ch.handle) {
    const h = String(ch.handle).replace(/^@/, '');
    const j = await ytGet(`${YT}/channels?key=${YT_KEY}&part=contentDetails,snippet&forHandle=${encodeURIComponent(h)}`);
    const it = j?.items?.[0];
    if (it?.contentDetails?.relatedPlaylists?.uploads) {
      return { uploads: it.contentDetails.relatedPlaylists.uploads, cost: 1, chId: it.id, foundName: it.snippet?.title };
    }
  }

  /* ③ 이름으로 찾는다 (한도 100 · 처음 한 번만) */
  const p = new URLSearchParams({
    key: YT_KEY, part: 'snippet', type: 'channel',
    q: ch.name_match, maxResults: '3',
  });
  const j = await ytGet(`${YT}/search?${p}`);
  const items = j?.items || [];
  /* 찾은 것 가운데 이름이 실제로 들어맞는 것만 씁니다.
     엉뚱한 채널을 잡으면 그 뒤 모든 영상이 잘못 들어옵니다. */
  const want = String(ch.name_match).toLowerCase();
  const hit = items.find((it) => String(it.snippet?.channelTitle || it.snippet?.title || '')
    .toLowerCase().includes(want));
  if (!hit) {
    return { uploads: null, cost: 100, why: `이름 「${ch.name_match}」 로 채널을 못 찾음`,
             candidates: items.map((it) => it.snippet?.channelTitle || it.snippet?.title).filter(Boolean) };
  }
  const chId = hit.snippet?.channelId || hit.id?.channelId;
  if (!chId) return { uploads: null, cost: 100, why: '채널 번호를 못 읽음' };

  const j2 = await ytGet(`${YT}/channels?key=${YT_KEY}&part=contentDetails&id=${chId}`);
  const up = j2?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  return { uploads: up || null, cost: 101, chId,
           foundName: hit.snippet?.channelTitle || hit.snippet?.title,
           why: up ? null : '올린 목록을 못 읽음' };
}

/* 그 채널이 올린 최신 영상 번호를 받아옵니다 (한도 1) */
async function ytUploads(uploadsId, n) {
  const p = new URLSearchParams({
    key: YT_KEY, part: 'contentDetails',
    playlistId: uploadsId, maxResults: String(Math.min(n || 20, 50)),
  });
  const j = await ytGet(`${YT}/playlistItems?${p}`);
  return (j?.items || []).map((it) => it.contentDetails?.videoId).filter(Boolean);
}

/* 채널 훑기용 판정 기준 — 채널이 이미 믿을 수 있으므로 길이와 제외어만 봅니다 */
function channelQuery(ch) {
  return {
    id: null,
    category: '동영상',
    min_sec: 300,        /* 5분 미만은 홍보·짧은 소식 */
    max_sec: 7200,       /* 2시간 넘으면 모음집·전곡 묶음 */
    min_score: 0,        /* 채널을 이미 믿으므로 점수 문턱을 두지 않습니다 */
    trusted_only: true,
    _channel: ch,
  };
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

  /* ① 제외어 — 하나라도 걸리면 바로 버립니다.
        로마자는 낱말 경계로 찾으므로 discover 의 cover 에는 걸리지 않습니다. */
  const bt = findBlocked(title, cfg.blockTitle);
  if (bt) return { ok: false, why: `제목 제외어 「${bt}」` };
  const bc = findBlocked(chName, cfg.blockChannel);
  if (bc) return { ok: false, why: `채널 제외어 「${bc}」` };

  /* 밖에서 재생할 수 없는 영상은 우리 화면에서 못 틉니다 */
  if (v.status && v.status.embeddable === false) return { ok: false, why: '외부 재생 불가' };

  /* ② 재생 시간 */
  if (!sec) return { ok: false, why: '재생 시간 확인 불가' };
  const minS = Number(qcfg.min_sec) || 0;
  const maxS = Number(qcfg.max_sec) || 999999;
  if (sec < minS) return { ok: false, why: `너무 짧음 ${Math.round(sec/60)}분 (기준 ${Math.round(minS/60)}분)` };
  if (sec > maxS) return { ok: false, why: `너무 김 ${Math.round(sec/60)}분 (기준 ${Math.round(maxS/60)}분)` };

  /* ③ 채널 신뢰도
        채널 훑기로 온 영상은 어느 채널에서 왔는지 이미 알고 있습니다(_channel).
        그때는 이름으로 다시 찾지 않습니다 — 채널 표기가 조금 달라도(일본어·약칭)
        엉뚱하게 「믿을 수 있는 채널이 아님」으로 버려지는 것을 막습니다. */
  let score = 0;
  const parts = [];
  const ch = qcfg._channel || cfg.channels.find((c) =>
    (c.channel_id && c.channel_id === chId) || (c.m && lowC.includes(c.m)));
  if (ch) {
    const add = ch.trust >= 3 ? 45 : ch.trust === 2 ? 32 : 18;
    score += add; parts.push(`채널 ${ch.name} +${add}`);
  } else if (qcfg.trusted_only) {
    return { ok: false, why: '믿을 수 있는 채널이 아님' };
  }

  /* ④ 인물DB 대조 — 점수를 주지 않습니다.
        어느 인물과 이어 줄지 찾기만 합니다. 오탐이 나도 점수에 영향이 없습니다. */
  const hits = matchPersons(title, persons);
  if (hits.length) parts.push(`인물 ${hits.map((h) => h.name).join('·')}`);

  /* ⑤ 클래식 전용이 아닌 채널이면 클래식 단서를 요구합니다.

        첫 채널 시험에서 이런 일이 있었습니다.
          ARTE Concert 에서 여덟 개가 담겼는데 전부 메탈·테크노·DJ 였습니다
          파리 필하모니에서 비디오게임 전시·플라멩코가 담겼습니다
          엘프필하모니에서 힙합·재즈가 담겼습니다
        이 세 곳은 클래식 전용이 아니라 종합 공연장·방송입니다.
        그래서 이런 채널은 「클래식임을 알려 주는 단서」가 있어야 통과시킵니다. */
  const hasOpus = OPUS_RE.test(title);
  const hasForm = FORM_RE.test(title);
  if (ch && ch.classical_only === false) {
    if (!hits.length && !hasOpus && !hasForm) {
      return { ok: false, why: '클래식 전용이 아닌 채널인데 클래식 단서가 없음'
                             + ' (작곡가 이름·작품번호·작품 갈래 가운데 하나가 필요합니다)' };
    }
  }

  /* ⑥ 덧점 */
  score += 15; parts.push('길이 적정 +15');
  if (hasOpus) { score += 8; parts.push('작품번호 +8'); }
  if (hasForm) { score += 8; parts.push('작품 갈래 +8'); }
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
    media_query_id: qcfg.id || null,
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
async function runChannels(cfg, seen, persons) {
  let n = 0, rej = 0, quota = 0;
  const chans = await sb('spot_media_channel?select=*&is_active=is.true'
    + '&order=last_run_at.asc.nullsfirst,sort_order.asc.nullslast,id.asc'
    + (CH_LIMIT ? `&limit=${CH_LIMIT}` : ''));

  console.log(`\n══ 채널 훑기 — ${(chans || []).length}곳 ══`);

  for (const ch of (chans || [])) {
    if (isStop()) { console.log('시간·실패 한도에 걸려 여기까지 저장하고 멈춥니다.'); break; }

    let r;
    try { r = await resolveChannel(ch); }
    catch (e) { console.log(`  [건너뜀] ${ch.name} — ${e.message}`); continue; }
    quota += r.cost || 0;

    if (!r.uploads) {
      console.log(`  [못 찾음] ${ch.name} — ${r.why}`);
      if (r.candidates?.length) console.log(`             비슷한 채널: ${r.candidates.join(' / ')}`);
      if (!DRY) {
        try {
          await sb(`spot_media_channel?id=eq.${ch.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ resolve_note: r.why, last_run_at: new Date().toISOString() }),
          });
        } catch (e) {}
      }
      continue;
    }

    /* 알아낸 번호를 적어 둡니다 — 다음부터는 한도 2 로 끝납니다 */
    if (!DRY && (!ch.uploads_playlist || (!ch.channel_id && r.chId))) {
      try {
        await sb(`spot_media_channel?id=eq.${ch.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            uploads_playlist: r.uploads,
            channel_id: r.chId || ch.channel_id || null,
            resolve_note: null,
          }),
        });
      } catch (e) {}
    }

    let ids = [];
    try { ids = await ytUploads(r.uploads, PER_CH); quota += 1; }
    catch (e) { console.log(`  [실패] ${ch.name} — ${e.message}`); continue; }

    const fresh = ids.filter((id) => !seen.has(id));
    if (!fresh.length) { console.log(`  ${ch.name} — 새것 없음`); await sleep(250); continue; }

    let items = [];
    try { items = await ytDetails(fresh); quota += 1; }
    catch (e) { console.log(`  [실패] ${ch.name} — ${e.message}`); continue; }

    const q = channelQuery(ch);
    const rows = [];
    for (const v of items) {
      const jd = judge(v, q, cfg, persons);
      if (!jd.ok) {
        rej++;
        if (SHOW_REJ) console.log(`    버림 · ${String(v.snippet?.title || '').slice(0, 44)} → ${jd.why}`);
        continue;
      }
      console.log(`    담음 ${String(jd.score).padStart(3)}점 · ${jd.title.slice(0, 52)}`);
      if (jd.parts.length) console.log(`           ${jd.parts.join(' / ')}`);
      rows.push(buildRow(v, jd, q));
      seen.add(v.id);
    }
    console.log(`  ${ch.name} — 새것 ${fresh.length}개 중 ${rows.length}개 담음`);

    if (rows.length && !DRY) {
      try {
        await sb('spot?on_conflict=video_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        });
      } catch (e) { console.log(`    저장 실패: ${e.message}`); }
    }
    if (!DRY) {
      try {
        await sb(`spot_media_channel?id=eq.${ch.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_run_at: new Date().toISOString(), last_found: rows.length }),
        });
      } catch (e) {}
    }
    n += rows.length;
    await sleep(250);
  }
  return { n, rej, quota };
}

async function runSearch(cfg, seen, persons) {
  let n = 0, rej = 0, quota = 0;
  if (!cfg.queries.length) { console.log('\n켜진 검색 조건이 없습니다.'); return { n, rej, quota }; }

  console.log(`\n══ 검색 (보조) — 조건 ${cfg.queries.length}개 ══`);
  for (const q of cfg.queries) {
    if (isStop()) break;
    console.log(`\n  [${q.id}] ${q.name} — "${q.q}"`);

    let ids = [];
    try { ids = await ytSearch(q); quota += 100; }
    catch (e) { console.log(`    검색 실패: ${e.message}`); continue; }

    const fresh = ids.filter((id) => !seen.has(id));
    console.log(`    찾음 ${ids.length}개 · 새것 ${fresh.length}개`);
    if (!fresh.length) { await sleep(300); continue; }

    let items = [];
    try { items = await ytDetails(fresh); quota += 1; }
    catch (e) { console.log(`    상세 실패: ${e.message}`); continue; }

    const rows = [];
    for (const v of items) {
      const jd = judge(v, q, cfg, persons);
      if (!jd.ok) {
        rej++;
        if (SHOW_REJ) console.log(`    버림 · ${String(v.snippet?.title || '').slice(0, 44)} → ${jd.why}`);
        continue;
      }
      console.log(`    담음 ${jd.score}점 · ${jd.title.slice(0, 52)}`);
      console.log(`           ${jd.parts.join(' / ')}`);
      rows.push(buildRow(v, jd, q));
      seen.add(v.id);
    }

    if (rows.length && !DRY) {
      try {
        await sb('spot?on_conflict=video_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        });
      } catch (e) { console.log(`    저장 실패: ${e.message}`); }
    }
    if (!DRY) {
      try {
        await sb(`spot_media_query?id=eq.${q.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_run_at: new Date().toISOString(), last_found: rows.length }),
        });
      } catch (e) {}
    }
    n += rows.length;
    await sleep(400);
  }
  return { n, rej, quota };
}

async function main() {
  console.log('── 음원·동영상 수집 시작 ──');
  const cfg = await loadConfig();
  console.log(`믿을 수 있는 채널 ${cfg.channels.length}곳 · 검색 조건 ${cfg.queries.length}개 ·`
            + ` 제외어 ${cfg.blockTitle.length + cfg.blockChannel.length}개`);

  const seen = await loadSeen();
  console.log(`이미 담긴(또는 버린) 영상 ${seen.size}개`);

  const persons = await loadPersons();
  console.log(`인물 대조용 이름 ${persons.length}개 (작곡가 · 전체 이름만)`);
  console.log(`방식: ${MODE}${DRY ? ' · 저장 안 함(dry)' : ''}`);

  let tot = { n: 0, rej: 0, quota: 0 };
  const add = (r) => { tot.n += r.n; tot.rej += r.rej; tot.quota += r.quota; };

  if (MODE === 'channels' || MODE === 'both') add(await runChannels(cfg, seen, persons));
  if (MODE === 'search'   || MODE === 'both') add(await runSearch(cfg, seen, persons));

  console.log(`\n── 끝 ──`);
  console.log(`담은 것 ${tot.n}개 · 버린 것 ${tot.rej}개 · 쓴 한도 약 ${tot.quota} (하루 10,000)`);
  if (DRY) console.log('※ --dry 였으므로 아무것도 저장하지 않았습니다.');
  else if (tot.n) console.log('※ 담긴 것은 숨김 상태입니다. 어드민에서 확인해 내보내 주세요.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
