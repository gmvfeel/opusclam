/* ============================================================
   OPUSCLAM 한국 작곡가 보강 — seed/kr-composer.mjs

   무엇을 하나
    · 한국어 위키백과에서 한국 작곡가를 찾아 인물DB(persons)에 담습니다

   왜 필요한가
    인물 9,145명은 대부분 위키데이터에서 왔습니다. 그런데 위키데이터는
    영문 정보가 넉넉한 사람에 치우쳐 있어, 국내에서만 활동한 작곡가가
    통째로 빠졌습니다. 서른 명을 짚어 보니 열넷이 없었습니다.

      담김 : 윤이상 · 진은숙 · 강석희 · 백병동  (국제적으로 알려진 분들)
      빠짐 : 이영조 · 김택수 · 최우정 · 임준희 · 이건용 · 홍난파 …

    한국 클래식 포털에 이영조·최우정이 없는 것은 큰 빈틈입니다.
    한국 작곡가는 <b>한국어 위키백과에 훨씬 잘 정리되어</b> 있으므로
    그쪽을 봅니다.

   컷오프를 낮춥니다
    「빈약한 항목은 담지 않는다」 는 원칙은 옳지만, 한국 작곡가에게는
    그 기준이 너무 높았습니다. 위키데이터에 이름과 생년만 있는 분들이
    한국 음악계의 중심인 경우가 많습니다.
    그래서 <b>이름과 생몰년만 있어도 담습니다.</b>

   대중음악은 걸러냅니다
    「대한민국의 작곡가」 분류에는 가요·드라마 음악 작곡가도 함께 있습니다.
    설명글을 보고 순수음악 쪽만 담습니다.

   출처
    한국어 위키백과 · CC BY-SA. 각 항목에 출처를 적어 둡니다.

   쓰는 법
     node seed/kr-composer.mjs --dry            담지 않고 누가 들어올지 보기
     node seed/kr-composer.mjs                  실제로 담기
     node seed/kr-composer.mjs --dry --debug    분류를 어떻게 훑었는지 자세히
     node seed/kr-composer.mjs --limit=50       50명만
     node seed/kr-composer.mjs --loose          걸러내기를 느슨하게 (더 많이 담김)

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
const DRY   = !!args.dry;
const DEBUG = !!args.debug;
const LOOSE = !!args.loose;
const LIMIT = args.limit ? Number(args.limit) : 0;

const WP = 'https://ko.wikipedia.org/w/api.php';
const UA = 'OpusclamKrComposerBot/1.0 (https://opusclam.com)';

/* 훑을 분류 — 어느 것이 있는지 확실하지 않아 여러 개를 시도합니다.
   없는 분류는 그냥 건너뜁니다. */
const CATEGORIES = [
  '대한민국의 작곡가',
  '대한민국의 클래식 음악가',
  '한국의 작곡가',
  '대한민국의 여성 작곡가',
  '일제강점기의 작곡가',
];

/* 순수음악으로 볼 말 — 하나라도 있으면 담습니다 */
const CLASSIC_WORDS = /(클래식|현대음악|교향곡|관현악|실내악|오페라|칸타타|가곡|합창|협주곡|피아노곡|현악|국악|창극|무대음악|작곡가로서|음악대학|음대|예술원|한국음악|서울대학교 음악|한국예술종합학교)/;

/* 대중음악·다른 갈래로 볼 말 — 순수음악 말이 없을 때 이것이 있으면 뺍니다 */
const POP_WORDS = /(가요|트로트|k-?pop|아이돌|보이그룹|걸그룹|힙합|랩|밴드|기타리스트|드라마 (음악|OST)|영화음악감독|CM송|광고음악|프로듀서|싱어송라이터|뮤지컬 작곡)/i;

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
   ① 분류에서 사람 이름을 모읍니다 (하위 분류도 한 겹 들어갑니다)
   ============================================================ */
async function listCategory(cat, depth = 0, seen = new Set(), out = new Set()) {
  if (depth > 1 || seen.has(cat)) return out;
  seen.add(cat);
  let cont = null, page = 0;
  for (;;) {
    let data;
    try {
      data = await wp({
        action: 'query', list: 'categorymembers',
        cmtitle: 'Category:' + cat, cmlimit: '500',
        cmtype: 'page|subcat', ...(cont ? { cmcontinue: cont } : {}),
      });
    } catch (e) {
      if (DEBUG) console.log(`    [분류] ${cat} — 읽지 못했습니다 (${e.message})`);
      return out;
    }
    const members = (data.query && data.query.categorymembers) || [];
    if (!members.length && page === 0 && DEBUG) {
      console.log(`    [분류] ${cat} — 비었거나 없는 분류입니다`);
    }
    for (const m of members) {
      if (m.ns === 14) {
        /* 하위 분류 — 한 겹만 더 들어갑니다 */
        const sub = String(m.title).replace(/^Category:|^분류:/, '');
        await listCategory(sub, depth + 1, seen, out);
      } else if (m.ns === 0) {
        out.add(m.title);
      }
    }
    cont = data.continue && data.continue.cmcontinue;
    page++;
    if (!cont || page > 6) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (DEBUG && depth === 0) console.log(`    [분류] ${cat} → 여기까지 모은 사람 ${out.size}명`);
  return out;
}

/* ============================================================
   ② 사람마다 소개글과 위키데이터 번호를 받습니다 (50명씩 묶어서)
   ============================================================ */
async function fetchPeople(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const part = titles.slice(i, i + 40);
    let data;
    try {
      data = await wp({
        action: 'query', prop: 'extracts|pageprops',
        titles: part.join('|'),
        exintro: '1', explaintext: '1', redirects: '1',
      });
    } catch (e) {
      console.log(`  [실패] ${i + 1}~${i + part.length}번째 — ${e.message}`);
      continue;
    }
    const pages = (data.query && data.query.pages) || {};
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      if (!p.title || p.missing !== undefined) continue;
      out.push({
        title: p.title,
        extract: String(p.extract || '').replace(/\s+/g, ' ').trim(),
        qid: (p.pageprops && p.pageprops.wikibase_item) || null,
      });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

/* ============================================================
   ③ 소개글에서 정보를 캐냅니다

   보기
     이영조(李永朝, 1943년 ~ )는 대한민국의 작곡가이다.
     홍난파(洪蘭坡, 1898년 4월 10일 ~ 1941년 8월 30일)는 한국의 작곡가…
   ============================================================ */
function pickLife(text) {
  const t = String(text || '');
  /* 「1898년 … ~ 1941년」 또는 「1943년 ~ 」 */
  const m = t.match(/(\d{4})\s*년[^~)]{0,24}[~–-]\s*(\d{4})?\s*년?/);
  if (m) {
    const b = m[1], d = m[2] || '';
    return { born: Number(b), died: d ? Number(d) : null, life: d ? `${b} – ${d}` : `${b}~` };
  }
  /* 태어난 해만 적힌 경우 — 「1980년 부산에서 태어난」 처럼
     해와 「태어」 사이에 지명이 끼어드는 일이 많습니다. */
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

/* 이름에서 괄호와 한자를 떼어냅니다 — 「이영조 (작곡가)」 → 「이영조」 */
function cleanName(title) {
  return String(title || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 순수음악인지 가려냅니다 */
function isClassic(text, title) {
  const t = String(text || '');
  if (CLASSIC_WORDS.test(t)) return true;
  if (LOOSE) return !POP_WORDS.test(t);
  /* 순수음악 말이 없으면, 대중음악 말이 없고 설명이 짧지 않을 때만 담습니다 */
  if (POP_WORDS.test(t)) return false;
  return t.length >= 40;
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  console.log('── 한국 작곡가 보강 ──');
  console.log(`훑을 분류 ${CATEGORIES.length}개${DRY ? ' · 담지 않음(dry)' : ''}${LOOSE ? ' · 느슨하게' : ''}`);

  /* ① 이름 모으기 */
  const names = new Set();
  for (const c of CATEGORIES) await listCategory(c, 0, new Set(), names);
  let titles = [...names];
  if (LIMIT) titles = titles.slice(0, LIMIT);
  console.log(`분류에서 모은 사람 : ${titles.length}명\n`);
  if (!titles.length) {
    console.log('사람을 찾지 못했습니다. 분류 이름이 바뀐 것일 수 있습니다.');
    console.log('--debug 를 붙여 어느 분류가 비었는지 보실 수 있습니다.');
    process.exit(1);
  }

  /* ② 소개글 받기 */
  const people = await fetchPeople(titles);
  console.log(`소개글을 받은 사람 : ${people.length}명\n`);

  /* ③ 이미 담긴 사람 불러오기 — 한글만 남겨 견줍니다 */
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

  /* ④ 담을 것 고르기 */
  const rows = [];
  let cutPop = 0, cutThin = 0, dup = 0;

  for (const p of people) {
    const name = cleanName(p.title);
    if (!name || !/[가-힣]/.test(name)) continue;

    if (haveSet.has(onlyKo(name))) { dup++; continue; }

    if (!isClassic(p.extract, p.title)) { cutPop++; continue; }

    const life = pickLife(p.extract);
    /* 컷오프를 낮춥니다 — 생몰년이 있거나 설명이 서른 자를 넘으면 담습니다 */
    if (!life.born && p.extract.length < 30) { cutThin++; continue; }

    rows.push({
      name_ko: name,
      field: '작곡',
      nationality: '대한민국 (KOR)',
      nat_code: 'KOR',
      life: life.life,
      era_name: pickEra(life.born),
      school: pickSchool(p.extract),
      description: p.extract.slice(0, 900),
      link_wiki: 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')),
      wikidata_id: p.qid,
      is_oc: false,
      hidden: false,
    });
  }

  console.log(`담을 사람 ${rows.length}명`);
  console.log(`  이미 있어 건너뜀 ${dup}명 · 순수음악이 아니라 뺌 ${cutPop}명 · 자료가 너무 적어 뺌 ${cutThin}명\n`);

  if (!rows.length) {
    console.log('새로 담을 사람이 없습니다.');
    return;
  }

  /* 미리 보여 드립니다 */
  const show = DRY ? rows.length : Math.min(rows.length, 20);
  console.log(`── 담을 사람 ${DRY ? '전체' : '앞 ' + show + '명'} ──`);
  rows.slice(0, show).forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(3)}. ${r.name_ko.padEnd(10)} ${(r.life || '-').padEnd(12)} `
      + `${(r.era_name || '-').padEnd(7)} ${(r.school || '').slice(0, 18)}`);
  });

  if (DRY) {
    console.log('\n※ --dry 였으므로 아무것도 담지 않았습니다.');
    console.log('※ 목록을 보시고 엉뚱한 사람이 있으면 알려 주십시오 — 걸러내기를 조이겠습니다.');
    return;
  }

  /* ⑤ 담기 — 쉰 명씩 나눠 넣습니다 */
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
  console.log(`\n── 끝 ──`);
  console.log(`담은 사람 ${saved}명`);
  console.log('※ 출처는 한국어 위키백과(CC BY-SA)이며 각 항목에 링크를 적어 두었습니다.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
