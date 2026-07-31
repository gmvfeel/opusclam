/* ============================================================
   OPUSCLAM 한국 작곡가 보강 — seed/kr-composer.mjs

   무엇을 하나
    · 정해진 명단의 한국 클래식 작곡가를 한국어 위키백과에서 찾아
      인물DB(persons)에 담습니다

   왜 명단으로 하나
    처음에는 「대한민국의 작곡가」 분류를 훑었습니다. 그런데 그 분류에는
    1,146명이 있고 대부분 대중음악 쪽이었습니다.
    249명을 골라 봤더니 클래식 작곡가는 스무 명쯤이고
    나머지는 가수·랩퍼·배우·연주자였습니다.

      DJ 클래지 · 기리보이 · 성시경 · 임창정 · 구혜선 · 노부스 콰르텟 …

    걸러내기를 조여도 엉뚱한 사람이 섞일 위험이 남습니다.
    그래서 <b>명단을 정해 그 이름만 찾습니다.</b> 수는 적지만 틀림이 없습니다.

   지어내지 않습니다
    명단에는 <b>이름만</b> 적습니다. 생몰년·학력·설명은 모두 위키백과에서
    받습니다. 위키백과에 없는 분은 담지 않고 로그로 알려 드립니다 —
    그러면 다른 자료로 채우실지 판단하실 수 있습니다.

   명단을 늘리려면
    아래 KR_COMPOSERS 에 이름을 한 줄 더하시면 됩니다.

   출처
    한국어 위키백과 · CC BY-SA. 각 항목에 링크를 적어 둡니다.

   쓰는 법
     node seed/kr-composer.mjs --dry           담지 않고 누가 들어올지 보기
     node seed/kr-composer.mjs                 실제로 담기
     node seed/kr-composer.mjs --dry --debug   찾는 과정을 자세히

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const DRY = !!args.dry;
const DEBUG = !!args.debug;

const WP = 'https://ko.wikipedia.org/w/api.php';
const UA = 'OpusclamKrComposerBot/1.0 (https://opusclam.com)';

/* ============================================================
   한국 클래식 작곡가 명단

   세대별로 묶었습니다. 이름만 적고 나머지는 위키백과에서 받습니다.
   국악 작곡가도 함께 담습니다 — 오퍼스클램은 국악을 함께 다룹니다.

   ★ 늘리시려면 알맞은 자리에 이름을 한 줄 더하시면 됩니다.
   ============================================================ */
const KR_COMPOSERS = [
  /* ── 근대 (개화기~일제강점기에 활동) ── */
  '홍난파', '현제명', '채동선', '안익태', '박태준', '김세형',
  '이흥렬', '조두남', '김성태', '김동진', '윤용하', '나운영',
  '김순남', '정율성', '금수현', '임원식',

  /* ── 현대 1세대 (1920~1940년대 태어남) ── */
  '윤이상', '정추', '이상근', '정회갑', '김희조', '변훈',
  '강석희', '백병동', '나인용', '김정길', '이영조', '강준일',
  '박영희', '이건용', '박준상', '이성천', '박범훈', '백대웅',

  /* ── 현대 2세대 (1950~1960년대 태어남) ── */
  '황성호', '정태봉', '이돈응', '김영동', '이신우', '임준희',
  '진은숙', '신동일', '김대성', '최우정', '류재준',

  /* ── 현대 3세대 (1970년대 이후 태어남) ── */
  '김택수', '조은화', '신동훈', '우효원',

  /* ── 우리 영상 자료에 작품이 나온 분들 ── */
  '김신', '강경묵', '신동선',
];

/* 이 사람이 작곡가인지 가려낼 말 — 소개글에 하나라도 있어야 담습니다 */
const OK_WORDS = /(작곡가|작곡을|작곡 활동|작곡을 공부|음악가)/;

/* 이 말이 있으면 담지 않습니다 — 같은 이름의 다른 사람일 수 있습니다 */
const NG_WORDS = /(가수이자|랩퍼|래퍼|아이돌|배우이자|배우로|정치인|축구|야구|기업인|의사|변호사)/;

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function wp(params) {
  const q = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const res = await fetch(`${WP}?${q}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`위키백과 HTTP ${res.status}`);
  return await res.json();
}

/* ============================================================
   위키백과에서 한 사람을 찾습니다

   「이름」 으로 먼저 찾고, 그 문서가 작곡가가 아니면
   「이름 (작곡가)」 를 봅니다. 그래도 없으면 검색을 씁니다.
   ============================================================ */
async function findPerson(name) {
  const tried = [];

  const titles = [name, name + ' (작곡가)', name + ' (음악가)'];
  let data;
  try {
    data = await wp({
      action: 'query', prop: 'extracts|pageprops',
      titles: titles.join('|'),
      exintro: '1', explaintext: '1', redirects: '1',
    });
  } catch (e) {
    return { name: name, found: false, why: '위키백과를 읽지 못했습니다' };
  }

  const pages = Object.values((data.query && data.query.pages) || {});
  for (const p of pages) {
    if (!p.title || p.missing !== undefined) continue;
    const ex = String(p.extract || '').replace(/\s+/g, ' ').trim();
    tried.push(p.title);
    if (!ex) continue;
    if (NG_WORDS.test(ex.slice(0, 160))) continue;   /* 같은 이름의 다른 사람 */
    if (!OK_WORDS.test(ex)) continue;
    return {
      name: name, found: true, title: p.title, extract: ex,
      qid: (p.pageprops && p.pageprops.wikibase_item) || null,
    };
  }

  /* 검색으로 한 번 더 — 「이름 작곡가」 로 찾습니다 */
  try {
    const sr = await wp({
      action: 'query', list: 'search',
      srsearch: name + ' 작곡가', srlimit: '5',
    });
    const hits = (sr.query && sr.query.search) || [];
    for (const h of hits) {
      const bare = String(h.title).replace(/\s*\([^)]*\)\s*$/, '');
      if (bare !== name) continue;
      const d2 = await wp({
        action: 'query', prop: 'extracts|pageprops',
        titles: h.title, exintro: '1', explaintext: '1', redirects: '1',
      });
      const p2 = Object.values((d2.query && d2.query.pages) || {})[0];
      if (!p2 || p2.missing !== undefined) continue;
      const ex2 = String(p2.extract || '').replace(/\s+/g, ' ').trim();
      tried.push(p2.title);
      if (!ex2 || NG_WORDS.test(ex2.slice(0, 160)) || !OK_WORDS.test(ex2)) continue;
      return {
        name: name, found: true, title: p2.title, extract: ex2,
        qid: (p2.pageprops && p2.pageprops.wikibase_item) || null,
      };
    }
  } catch (e) { /* 검색이 안 되면 넘어갑니다 */ }

  return {
    name: name, found: false,
    why: tried.length ? `문서는 있으나 작곡가로 보이지 않습니다 (${tried.join(', ')})`
                      : '위키백과에 문서가 없습니다',
  };
}

/* ============================================================
   소개글에서 정보를 캐냅니다
   ============================================================ */
function pickLife(text) {
  const t = String(text || '');
  const m = t.match(/(\d{4})\s*년[^~)]{0,24}[~–-]\s*(\d{4})?\s*년?/);
  if (m) {
    const b = m[1], d = m[2] || '';
    return { born: Number(b), died: d ? Number(d) : null, life: d ? `${b} – ${d}` : `${b}~` };
  }
  const m2 = t.match(/(\d{4})\s*년[^.]{0,20}?(출생|태어|생)/);
  if (m2) return { born: Number(m2[1]), died: null, life: `${m2[1]}~` };
  const m3 = t.match(/\((\d{4})\s*[~–-]/);
  if (m3) return { born: Number(m3[1]), died: null, life: `${m3[1]}~` };
  return { born: null, died: null, life: null };
}

function pickSchool(text) {
  const t = String(text || '');
  const m = t.match(/([가-힣A-Za-z·]{2,20}(대학교|대학|음악원|예술종합학교|콘서바토리|음악대학))/);
  return m ? m[1] : null;
}

function pickEra(born) {
  if (!born) return null;
  if (born >= 1945) return '현대';
  if (born >= 1900) return '근·현대';
  return '근대';
}

/* 국악 쪽인지 봅니다 — 분야를 갈라 두면 나중에 가려 보기 좋습니다 */
function pickField(text) {
  const t = String(text || '');
  if (/(국악|판소리|창극|정악|민속악|가야금|거문고|대금|해금)/.test(t)) return '작곡·국악';
  return '작곡';
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  console.log('── 한국 작곡가 보강 (명단으로) ──');
  console.log(`명단 ${KR_COMPOSERS.length}명${DRY ? ' · 담지 않음(dry)' : ''}\n`);

  /* 이미 담긴 사람 — 한글만 남겨 견줍니다 */
  const have = [];
  for (let off = 0; ; off += 1000) {
    const part = await sb(`persons?select=id,name_ko&limit=1000&offset=${off}`);
    if (!part || !part.length) break;
    have.push(...part);
    if (part.length < 1000) break;
  }
  const onlyKo = (v) => String(v || '').replace(/[^가-힣]/g, '');
  const haveSet = new Set(have.map((h) => onlyKo(h.name_ko)).filter(Boolean));
  console.log(`인물DB 에 이미 있는 사람 : ${have.length}명\n`);

  const rows = [], skipped = [], missing = [];

  for (const name of KR_COMPOSERS) {
    if (haveSet.has(onlyKo(name))) { skipped.push(name); continue; }

    const r = await findPerson(name);
    await new Promise((x) => setTimeout(x, 220));

    if (!r.found) {
      missing.push({ name: name, why: r.why });
      if (DEBUG) console.log(`  [못 찾음] ${name} — ${r.why}`);
      continue;
    }

    const life = pickLife(r.extract);
    rows.push({
      name_ko: name,
      field: pickField(r.extract),
      nationality: '대한민국 (KOR)',
      nat_code: 'KOR',
      life: life.life,
      era_name: pickEra(life.born),
      school: pickSchool(r.extract),
      description: r.extract.slice(0, 900),
      link_wiki: 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(r.title.replace(/ /g, '_')),
      wikidata_id: r.qid,
      is_oc: false,
      hidden: false,
    });
  }

  console.log('── 찾은 결과 ──');
  console.log(`담을 사람 ${rows.length}명 · 이미 있어 건너뜀 ${skipped.length}명 · 못 찾음 ${missing.length}명\n`);

  if (rows.length) {
    console.log('── 담을 사람 ──');
    rows.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ${r.name_ko.padEnd(9)} ${(r.life || '-').padEnd(13)}`
        + `${(r.era_name || '-').padEnd(7)} ${(r.field === '작곡·국악' ? '국악 ' : '    ')}`
        + `${(r.school || '').slice(0, 20)}`);
    });
    console.log('');
  }

  if (skipped.length) {
    console.log('── 이미 있어 건너뛴 사람 ──');
    console.log('  ' + skipped.join(', ') + '\n');
  }

  if (missing.length) {
    console.log('── 위키백과에서 찾지 못한 사람 ──');
    missing.forEach((m) => console.log(`  ${m.name.padEnd(9)} ${m.why}`));
    console.log('  ※ 이분들은 담지 않았습니다. 다른 자료로 채우실지 판단해 주십시오.\n');
  }

  if (DRY) {
    console.log('※ --dry 였으므로 아무것도 담지 않았습니다.');
    console.log('※ 목록을 보시고 엉뚱한 사람이 있으면 알려 주십시오.');
    return;
  }

  if (!rows.length) { console.log('새로 담을 사람이 없습니다.'); return; }

  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50);
    try {
      await sb('persons', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(part),
      });
      saved += part.length;
    } catch (e) {
      console.log(`  [저장 실패] ${i + 1}~${i + part.length}번째 — ${e.message}`);
    }
  }
  console.log('── 끝 ──');
  console.log(`담은 사람 ${saved}명`);
  console.log('※ 출처는 한국어 위키백과(CC BY-SA)이며 각 항목에 링크를 적어 두었습니다.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
