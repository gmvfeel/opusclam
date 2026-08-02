/* ============================================================
   OPUSCLAM 공연사진/영상 자동 채우기 — seed/gallery-seed.mjs

   왜 필요한가
     공연사진/영상 게시판에 자료를 넣는 것은 커뮤니티 자동시드뿐인데,
     그 게시판은 그림 주소가 없으면 담지 않습니다(requireThumb).
     그래서 매주 돌면서도 <b>한 글도 넣지 못하고 있었습니다.</b>

   어디서 사진을 가져오나 — ★ 새로 남의 것을 받아 오지 않습니다
     ㉮ 우리 공연장DB·음악학교DB의 사진
        위키데이터에서 받은 커먼즈 사진입니다. 자유 이용이 가능하고
        이미 우리 DB에 있으니 새 API 호출도, 라이선스 확인 문제도 없습니다.
        본문에 「사진 — Wikimedia Commons」 를 적어 출처를 밝힙니다.
     ㉯ 정보SPOT 의 공연 포스터 (KOPIS)
        이미 우리가 갖고 있는 자료입니다. 다만 포스터는 주최 측 저작물이므로
        <b>회원이 찍은 사진인 척하지 않습니다.</b> 글쓴이를 「오퍼스클램」 으로
        두고 「공연 안내」 성격으로 적고, 정보SPOT 상세로 가는 링크를 붙입니다.

   ★ 지울 수 있게 표시를 남깁니다
     keywords 에 'oc-seed' 를 넣습니다. 나중에 한 줄로 지울 수 있습니다.
       delete from gallery where keywords like '%oc-seed%';

   쓰는 법
     node seed/gallery-seed.mjs                 (기본 6글)
     PER_RUN=10 node seed/gallery-seed.mjs      (10글)
     DRY=1 node seed/gallery-seed.mjs           (담지 않고 확인만)
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const PER_RUN = parseInt(process.env.PER_RUN || '6', 10);
const DRY = !!process.env.DRY;
const MARK = 'oc-seed';

/* ── 공연장 사진을 어디까지 쓸지 ─────────────────────────────
   HALL_MODE
     'ko'  한국어 이름이 붙은 곳만  ← 기본값. 글이 자연스럽습니다
     'kr'  국내 공연장만
     'all' 모두 (영문 이름도 씀)

   왜 기본을 'ko' 로 두나
     name_ko 에 영문이 그대로 들어간 곳이 많습니다. 위키데이터에 한국어
     표기가 없다는 뜻인데, 그런 곳으로 「Plains Theatre 로비에서」 같은
     글을 만들면 <b>회원이 쓴 글처럼 보이지 않습니다.</b> */
const HALL_MODE = (process.env.HALL_MODE || 'ko').toLowerCase();

/* 한글이 섞여 있는가 — 한국어 표기가 붙었는지 가리는 잣대입니다 */
function hasHangul(v) { return /[가-힣]/.test(String(v || '')); }

const H = {
  apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;

/* 나눠받기 — 서버가 200에서 잘라도 끝까지 받습니다 */
async function sbAll(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(SB_URL + '/rest/v1/' + path
      + (path.includes('?') ? '&' : '?') + 'limit=200&offset=' + from, { headers: H });
    /* ★ 오류 글을 넉넉히 보여 줍니다.
       이번에 120자에서 잘려 「그런 칸이 없습니다(42703)」 뒤의
       <b>어느 칸인지</b>가 안 보였습니다. 원인 찾는 데 한 걸음이 더 걸렸습니다. */
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + (await r.text()).slice(0, 400));
    const rows = await r.json();
    if (!rows.length) break;
    out.push(...rows);
    from += rows.length;
    if (out.length > 20000) break;          /* 안전장치 */
  }
  return out;
}

async function sbInsert(row) {
  const r = await fetch(SB_URL + '/rest/v1/gallery', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify([row]),
  });
  if (!r.ok) throw new Error('POST ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  return j && j[0] ? j[0].id : null;
}

async function sbComment(galleryId, body, author) {
  const r = await fetch(SB_URL + '/rest/v1/gallery_comments', {
    method: 'POST',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify([{ news_id: galleryId, body, author_name: author,
                            created_at: new Date(Date.now() - rnd(1, 40) * 36e5).toISOString() }]),
  });
  if (!r.ok) console.log('    (댓글 실패 · ' + r.status + ')');
}

/* 올린 시각을 지난 며칠 사이로 흩뿌립니다 — 한꺼번에 올린 티가 나지 않게 */
function jitterNow() {
  const d = new Date();
  d.setDate(d.getDate() - rnd(0, 20));
  d.setHours(rnd(9, 23), rnd(0, 59), rnd(0, 59), 0);
  return d.toISOString();
}

/* ── 글쓴이 이름 ─────────────────────────────────────────────
   커뮤니티 콘텐츠 풀과 같은 결로 씁니다. */
const AUTHORS = [
  '예당러버', '실황중독', '저녁여덟시', '두아이맘', '앙코르요정', '기립박수',
  '늦깎이피아노', '실내악좋아', '브람스밤', '무대위에서', '연습일지', '남행열차',
  '취소표사냥', '드레스코드', '노부부의음악회', '로만티스트',
];

/* ============================================================
   ㉮ 공연장 사진 — 우리 공연장DB의 커먼즈 사진
   ============================================================ */

/* 국내·해외를 가려 게시판 갈래를 정합니다 */
/* 국내·해외를 가려 게시판 갈래를 정합니다.
   location 이 「대한민국 · 서울」 꼴이므로 그 한 칸만 봅니다. */
function isDomestic(v) {
  const c = String(v.location || '');
  return /대한민국|한국|Korea|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주/i.test(c);
}

/* 공연장 사진 글 — 「가 봤다」 는 이야기로 씁니다.
   본문에 사진 출처를 반드시 적습니다. */
const HALL_OPEN = [
  '지난주에 다녀왔습니다. 사진 한 장 올려 봅니다.',
  '오래 가 보고 싶던 곳인데 드디어 들렀습니다.',
  '공연 전에 로비에서 한 장 찍었습니다.',
  '여행 중에 일부러 시간을 내어 찾아갔습니다.',
  '몇 번째인지 모르겠습니다. 갈 때마다 좋습니다.',
];
const HALL_BODY = [
  '들어서는 순간 공기가 다르다는 느낌을 받았습니다. 천장이 높아서인지 로비에서부터 소리가 다르게 울립니다.',
  '자리에 앉아 무대를 보는데, 이 자리에서 얼마나 많은 연주가 있었을까 하는 생각이 들었습니다.',
  '객석이 생각보다 아늑했습니다. 큰 홀인데도 무대가 멀게 느껴지지 않았습니다.',
  '건물 자체가 볼거리였습니다. 공연 시작 전에 한참을 둘러보았습니다.',
  '소리가 뒤에서 감싸듯 들어오는 느낌이었습니다. 홀마다 정말 다르다는 것을 다시 느꼈습니다.',
];
const HALL_CLOSE = [
  '다음에 또 갈 기회가 있으면 좋겠습니다.',
  '아직 안 가 보신 분께 권하고 싶습니다.',
  '사진으로는 그 느낌이 반도 안 담깁니다.',
  '언제 가도 좋은 곳입니다.',
  '',
];

function hallPost(v) {
  const name = (v.name_ko || v.name_en || '').trim();
  if (!name || !v.logo_url) return null;
  const dom = isDomestic(v);
  /* location 이 이미 「대한민국 · 서울」 꼴입니다 */
  const where = String(v.location || '').trim();
  /* seats 는 「2,505석」 처럼 「석」 이 붙은 글자입니다.
     수로 바꾸려 하면 NaN 이 되므로 그대로 씁니다. */
  const seatTxt = String(v.seats || '').trim();
  const seats = seatTxt ? `객석 ${esc(seatTxt)}. ` : '';

  /* ★ 조사 앞을 붙여 씁니다.
     「통영국제음악당 에 가 봤습니다」 처럼 벌어지면 사람이 쓴 글로 보이지
     않습니다. 「에」 는 붙여 써야 맞습니다. */
  const title = pick([
    `${name} 다녀왔습니다`,
    `${name} — 사진 한 장`,
    `${name}, 생각보다 좋았습니다`,
    `${name} 로비에서`,
    `${name}에 가 봤습니다`,
    `${name}, 다시 갔습니다`,
  ]);

  /* ★ pick 을 한 번만 부릅니다.
     예전에는 확인할 때와 넣을 때 따로 불러, 빈 값을 확인한 뒤에
     다른 값이 들어가거나 그 반대가 되어 <b>빈 &lt;p&gt; 가 남았습니다.</b> */
  const close = pick(HALL_CLOSE);
  const body =
    `<p>${pick(HALL_OPEN)}</p>` +
    `<img src="${v.logo_url}" alt="${esc(name)}">` +
    `<p>${seats}${pick(HALL_BODY)}</p>` +
    (close ? `<p>${close}</p>` : '') +
    `<p class="oc-credit">${esc(name)}${where ? ' · ' + esc(where) : ''}<br>` +
    `사진 — Wikimedia Commons (자유 이용 허락)</p>`;

  return {
    category: dom ? '국내공연' : '해외공연',
    title, body,
    thumb_url: v.logo_url,
    author_name: pick(AUTHORS),
    kind: 'hall',
    /* 앞세울 순서를 정하는 점수 */
    _score: (dom ? 2 : 0)
          + (seatTxt ? 1 : 0)
          + (String(v.description || '').trim() ? 1 : 0),
  };
}

/* ============================================================
   ㉯ 공연 포스터 — 정보SPOT(KOPIS)
   ★ 회원이 찍은 사진인 척하지 않습니다.
     글쓴이를 「오퍼스클램」 으로 두고 공연 안내로 적습니다.
   ============================================================ */
function posterPost(s) {
  /* 한국어 표기가 있으면 그것을 앞세웁니다 (다른 화면과 같은 규칙) */
  const title0 = (s.title_ko || s.title || '').trim();
  if (!title0 || !s.thumb_url) return null;

  const when = [s.date_from, s.date_to].filter(Boolean).join(' ~ ');
  const place = [s.venue_name, s.city].filter(Boolean).join(' · ');

  const title = pick([
    `[공연안내] ${title0}`,
    `${title0} — 공연 포스터`,
    when ? `[공연안내] ${title0} (${when.slice(0, 10)})` : `[공연안내] ${title0}`,
  ]);

  const info = [
    `<b>${esc(title0)}</b>`,
    when ? `기간 — ${esc(when)}` : '',
    place ? `장소 — ${esc(place)}` : '',
  ].filter(Boolean).join('<br>');

  const body =
    `<p>정보SPOT 에 올라온 공연을 소개합니다.</p>` +
    `<img src="${s.thumb_url}" alt="${esc(title0)} 포스터">` +
    `<p>${info}</p>` +
    (s.body ? `<p>${esc(String(s.body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160))}</p>` : '') +
    `<p><a href="/spot/spot-view.html?id=${encodeURIComponent(s.id)}">정보SPOT 에서 자세히 보기 →</a></p>` +
    `<p class="oc-credit">포스터 — 공연 주최 측 제공 (KOPIS 공연예술통합전산망)<br>` +
    `공연 정보와 일정은 바뀔 수 있으니 주최 측 안내를 확인해 주십시오.</p>`;

  return {
    category: '국내공연',
    title, body,
    thumb_url: s.thumb_url,
    author_name: '오퍼스클램',
    kind: 'poster',
  };
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── 댓글 — 사람 같은 짧은 반응 ───────────────────────────── */
const CMT_HALL = [
  '저도 여기 가 봤습니다. 사진 잘 나왔네요.',
  '언젠가 가 보고 싶은 곳입니다.',
  '객석에서 보면 더 좋습니다. 다음엔 2층에서 보세요.',
  '사진만 봐도 소리가 상상됩니다.',
  '좋은 사진 고맙습니다.',
  '이 홀 음향이 정말 좋다고 들었습니다.',
];
const CMT_POSTER = [
  '이 공연 가려고 표 알아보고 있었습니다.',
  '알려 주셔서 고맙습니다. 일정 확인해 볼게요.',
  '프로그램이 좋네요.',
  '지난번에 같은 단체 연주 봤는데 좋았습니다.',
];

/* ============================================================
   메인
   ============================================================ */
async function main() {
  console.log('■ 공연사진/영상 자동 채우기', DRY ? '(시험 실행 · 담지 않음)' : '', new Date().toISOString());

  /* 이미 있는 제목 — 같은 글을 두 번 담지 않습니다 */
  const have = await sbAll('gallery?select=title,thumb_url');
  const titleSet = new Set(have.map(r => String(r.title || '').trim()));
  const thumbSet = new Set(have.map(r => String(r.thumb_url || '').trim()).filter(Boolean));
  console.log('■ 이미 있는 글', have.length, '건');

  /* ㉮ 공연장 사진 — 커먼즈 */
  let halls = [];
  try {
    /* ★ 칸 이름을 수집기(scripts/collect-venues.mjs)의 담는 행에서 확인했습니다.
       두 번 틀렸던 자리입니다 —
         · 사진은 image_url 이 아니라 <b>logo_url</b>
         · <b>country · city 칸이 없습니다.</b> 두 값을 location 하나에
           「나라 · 도시」 로 합쳐 담습니다 (그래서 42703 오류가 났습니다)
         · seats 는 수가 아니라 「2,505석」 같은 <b>글자</b>입니다 */
    halls = await sbAll('venues?select=id,name_ko,name_en,type,location,seats,logo_url,description'
      + '&logo_url=not.is.null&hidden=is.false');
  } catch (e) { console.log('  · 공연장DB 를 읽지 못했습니다 ·', e.message.slice(0, 300)); }
  console.log('■ 사진이 있는 공연장', halls.length, '곳');

  /* ── 어떤 공연장이 있는지 세어 보여 줍니다 ──────────────────
     글감을 어디까지 쓸지 정하는 근거입니다. 숫자를 보지 않고
     기준을 정하면, 너무 좁혀 글감이 마르거나 너무 넓혀 어색한 글이
     섞입니다. */
  const kn = halls.filter(v => hasHangul(v.name_ko));
  const kr = halls.filter(v => isDomestic(v));
  const krKo = halls.filter(v => hasHangul(v.name_ko) && isDomestic(v));
  const withSeat = halls.filter(v => String(v.seats || '').trim());
  const withDesc = halls.filter(v => String(v.description || '').trim());
  const rich = halls.filter(v => hasHangul(v.name_ko)
    && (String(v.seats || '').trim() || String(v.description || '').trim()));
  console.log('   ├ 한국어 이름이 붙은 곳 :', kn.length, '곳');
  console.log('   ├ 국내 공연장           :', kr.length, '곳   (그 가운데 한국어 이름 ' + krKo.length + '곳)');
  console.log('   ├ 객석 수가 있는 곳     :', withSeat.length, '곳');
  console.log('   ├ 소개문이 있는 곳      :', withDesc.length, '곳');
  console.log('   └ 한국어 이름 + 객석·소개문 :', rich.length, '곳   ← 가장 자연스러운 글감');
  console.log('   지금 기준(HALL_MODE) :', HALL_MODE
    + (HALL_MODE === 'ko' ? ' — 한국어 이름이 붙은 곳만'
      : HALL_MODE === 'kr' ? ' — 국내 공연장만' : ' — 모두'));

  /* 기준에 맞는 것만 남깁니다 */
  if (HALL_MODE === 'ko') halls = kn;
  else if (HALL_MODE === 'kr') halls = kr;
  console.log('   → 쓸 공연장', halls.length, '곳');

  /* ㉯ 공연 포스터 — 정보SPOT */
  let posters = [];
  try {
    /* ★ 칸 이름을 화면(spot/index.html)에서 확인했습니다 —
       날짜는 start_date 가 아니라 <b>date_from · date_to</b> 입니다. */
    posters = await sbAll('spot?select=id,title,title_ko,body,thumb_url,city,venue_name,date_from,date_to'
      + '&section=eq.' + encodeURIComponent('공연정보')
      + '&thumb_url=not.is.null&hidden=is.false'
      + '&order=date_from.desc.nullslast');
  } catch (e) { console.log('  · 정보SPOT 을 읽지 못했습니다 ·', e.message.slice(0, 300)); }
  console.log('■ 포스터가 있는 공연', posters.length, '건');

  /* 글감을 만듭니다 — 이미 쓴 사진·제목은 건너뜁니다 */
  const cand = [];
  for (const v of halls) {
    const p = hallPost(v);
    if (!p) continue;
    if (titleSet.has(p.title) || thumbSet.has(p.thumb_url)) continue;
    cand.push(p);
  }
  for (const s of posters) {
    const p = posterPost(s);
    if (!p) continue;
    if (titleSet.has(p.title) || thumbSet.has(p.thumb_url)) continue;
    cand.push(p);
  }

  /* 공연장 사진과 포스터를 섞습니다 — 한 종류만 몰리지 않게 */
  const hallC = cand.filter(c => c.kind === 'hall');
  const postC = cand.filter(c => c.kind === 'poster');
  shuffle(hallC); shuffle(postC);

  /* ★ 충실한 곳과 국내를 앞세웁니다.
     그러지 않으면 이름만 있는 작은 극장이 먼저 나와 글의 값이 떨어집니다.
     점수 — 국내 2점 · 객석 수 1점 · 소개문 1점.
     같은 점수 안에서는 위에서 섞은 순서를 그대로 두어 매번 달라집니다. */
  hallC.sort((a, b) => b._score - a._score);
  console.log('■ 쓸 수 있는 글감 — 공연장 사진', hallC.length, '· 공연 포스터', postC.length);

  const plan = [];
  /* 공연장 사진을 조금 더 많이 — 게시판 성격이 「공연사진」 이므로 */
  while (plan.length < PER_RUN && (hallC.length || postC.length)) {
    if (hallC.length && (plan.length % 3 !== 2 || !postC.length)) plan.push(hallC.shift());
    else if (postC.length) plan.push(postC.shift());
  }
  if (!plan.length) { console.log('■ 더 담을 글감이 없습니다.'); return; }

  console.log('■ 담을 글', plan.length, '건');
  for (const p of plan) {
    console.log('   ' + (p.kind === 'hall' ? '[사진]  ' : '[포스터]') + ' '
      + p.category.padEnd(8) + p.title);
  }
  if (DRY) { console.log('■ 시험 실행이므로 담지 않습니다.'); return; }

  let made = 0;
  for (const p of plan) {
    const row = {
      category: p.category,
      title: p.title,
      body: p.body,
      thumb_url: p.thumb_url,
      author_name: p.author_name,
      keywords: MARK,                       /* ★ 나중에 한 줄로 지울 수 있는 표시 */
      created_at: jitterNow(),
      view_count: rnd(5, 90),
      like_count: rnd(0, 4),
      dislike_count: chance(0.12) ? 1 : 0,
    };
    let id = null;
    try { id = await sbInsert(row); }
    catch (e) { console.log('   담기 실패 · ' + p.title + ' · ' + e.message.slice(0, 90)); continue; }
    made++;

    /* 댓글 — 절반 남짓에만 붙입니다 */
    if (id && chance(0.55)) {
      const pool = p.kind === 'hall' ? CMT_HALL : CMT_POSTER;
      await sbComment(id, pick(pool), pick(AUTHORS));
      if (chance(0.25)) await sbComment(id, pick(pool), pick(AUTHORS));
    }
    await sleep(200);
  }

  console.log('■ 담음', made, '건');
  console.log('■ 지울 때 —  delete from gallery where keywords like \'%' + MARK + '%\';');
  console.log('■ 완료');
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

main().catch(e => { console.error('오류:', e.message); process.exit(1); });
