// ============================================================
// OPUSCLAM 국내 인물(persons) 자동 수집기 (v1)
//
//  admin/kr-collect.html 의 수동 수집을 자동 실행으로 옮긴 것입니다.
//  화면에서 사람이 분류를 고르고 결과를 검토하던 두 단계를 대신하려면
//  판정 규칙이 코드에 있어야 합니다. 아래 세 관문이 그 역할입니다.
//
//    ① 대중음악 장르면 받지 않습니다 (GENRE)
//    ② 분류 이름이 클래식 계열이면 받습니다 (SRC_STRONG)
//    ③ 아니면 소개문에 클래식 지표가 있어야 받습니다 (CLASSIC_STRONG)
//    ④ 위 조건을 넘겨도 소개문과 생몰이 모두 없으면 받지 않습니다
//
//  분류 이름을 코드에 박지 않습니다. 접두어로 찾아내므로
//  위키백과 분류 체계가 바뀌어도 계속 동작합니다.
//
//  환경변수 · SUPABASE_URL, SUPABASE_SERVICE_KEY
//            PERSONS_DRY=1 이면 저장하지 않고 판정 결과만 로그로 남깁니다
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1';
const DRY     = process.env.PERSONS_DRY === '1';
const UA      = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const WIKI    = 'https://ko.wikipedia.org/w/api.php';
const SPARQL  = 'https://query.wikidata.org/sparql';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

// 분류를 찾을 접두어. 이 접두어로 시작하는 분류를 모두 훑습니다.
const PREFIXES = ['대한민국의', '한국의'];

// 한 번 실행에서 다룰 상한 (무료 실행 시간을 지키기 위한 안전장치)
const MAX_CATS    = 80;
const MAX_TITLES  = 8000;

// ── 판정 규칙 ────────────────────────────────────────────────
// 두 가지를 구분해서 씁니다.
//
//  CAT_MUSIC   · 분류를 '찾을' 때 쓰는 넓은 그물.
//                이걸 좁게 잡으면 '대한민국의 작곡가' 같은 큰 분류를 놓칩니다.
//  SRC_STRONG  · 인물을 '받을' 때 쓰는 강한 근거.
//                넓은 그물로 들어온 분류는 이 조건에 안 맞으므로
//                소개문에 클래식 지표가 있어야 통과합니다.
//
// 그래서 범위는 넓히고 품질은 지킬 수 있습니다.
const CAT_MUSIC = /음악|작곡|연주자|성악|지휘|합창|오페라|피아노|바이올린|비올라|첼로|콘트라베이스|플루트|클라리넷|오보에|바순|호른|트럼펫|트롬본|색소폰|하프|오르간|타악|국악|판소리|가야금|거문고|해금|대금|아쟁|소리꾼/;

const SRC_STRONG = /클래식|현대음악|오페라 작곡가|성악가|지휘자|음악학자|음악 교육자|바이올린 연주자|비올라|첼로|오르간 연주자|플루트|오보에|트럼펫|콘트라베이스|하프 연주자/;

const CLASSIC_STRONG = /교향곡|교향악|관현악|실내악|협주곡|칸타타|미사곡|현악 사중주|필하모닉|교향악단|독주회|리사이틀|콩쿠르|음악학자|음악학 박사|현대음악|국립오페라|합창단을 지휘|악장으로|오페라를 작곡|가곡|국악|판소리|명창|중요무형문화재|국립국악원/;

const GENRE = /\bpop\b|popular music|k-?pop|rock|hip ?hop|\brap\b|r&b|rhythm and blues|soul|trot|ballad|electronic|dance|jazz|blues|reggae|funk|metal|\bfolk\b|country|musical theat|film score|video game/i;

// 분류 이름에서 분야와 악기를 추정합니다
const FIELD = [
  [/작곡/, '작곡'], [/지휘/, '지휘'],
  [/성악|소프라노|메조|테너|바리톤|베이스|카운터테너/, '성악'],
  [/음악학|음악 이론|평론/, '음악학'],
  [/교육/, '음악교육'],
  [/연주|피아노|바이올린|첼로|비올라|플루트|클라리넷|오보에|바순|호른|트럼펫|트롬본|하프|오르간|타악|콘트라베이스/, '연주'],
];
const INSTR = ['피아노','바이올린','첼로','비올라','플루트','클라리넷','오보에','바순',
               '호른','트럼펫','트롬본','하프','오르간','타악기','콘트라베이스','기타',
               '아코디언','색소폰'];

function guessField(cat) {
  for (const [re, name] of FIELD) if (re.test(cat)) return name;
  return '';
}
function guessInstr(cat) {
  for (const ins of INSTR) if (cat.indexOf(ins) >= 0) return ins;
  return '';
}

// 사람이 아닌 문서(목록 · 개요 등)를 걸러냅니다
const NOT_PERSON = /^(.*\s)?(목록|일람|개요|역사|음악|틀|위키)$|목록$|^분류|^위키프로젝트/;

// ── 공통 유틸 ────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const clean = (s) => isEmpty(s) ? null : String(s).replace(/\s+/g, ' ').trim();
const stripParen = (s) => String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

// 요청 과다(429)와 일시 오류에 참을성 있게 대응합니다
const BACKOFF = [4000, 12000, 30000, 60000, 90000];

async function getJSON(url, tries = 5) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 429 || r.status >= 500) {
        const ra = Number(r.headers.get('retry-after'));
        const wait = (ra > 0 ? ra * 1000 : 0) || BACKOFF[i] || 90000;
        last = new Error('HTTP ' + r.status);
        if (i < tries - 1) {
          console.log('    (' + r.status + ' · ' + Math.round(wait / 1000) + '초 대기 후 재시도)');
          await sleep(wait); continue;
        }
        throw last;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
      return await r.json();
    } catch (e) {
      last = e;
      if (i === tries - 1) throw last;
      if (!/HTTP (429|5\d\d)/.test(String(e.message))) await sleep(BACKOFF[i] || 30000);
    }
  }
  throw last;
}

function wikiUrl(params) {
  const p = new URLSearchParams(Object.assign({ format: 'json', origin: '*' }, params));
  return WIKI + '?' + p.toString();
}

async function sparql(query) {
  const url = SPARQL + '?format=json&query=' + encodeURIComponent(query);
  const d = await getJSON(url);
  return (d.results && d.results.bindings) || [];
}

// ── 1단계 · 분류 찾기 ────────────────────────────────────────
async function findCategories() {
  const out = new Map();
  for (const prefix of PREFIXES) {
    let from = null;
    for (let i = 0; i < 20; i++) {
      const p = { action: 'query', list: 'allcategories', acprefix: prefix,
                  aclimit: 500, acprop: 'size' };
      if (from) p.acfrom = from;
      let d;
      try { d = await getJSON(wikiUrl(p)); }
      catch (e) { console.log('  · 분류 조회 실패(' + prefix + ') ·', String(e.message).slice(0, 60)); break; }
      for (const x of (d.query && d.query.allcategories) || []) {
        const name = x['*'] || x.category || '';
        const n = x.pages || 0;
        // 음악 관련 분류를 넓게 담습니다. 실제 판정은 인물 단위로 따로 합니다.
        // 사람이 한 명도 없는 분류는 건너뜁니다.
        if (name && n > 0 && CAT_MUSIC.test(name)) out.set(name, n);
      }
      from = d['continue'] && d['continue'].accontinue;
      if (!from) break;
      await sleep(400);
    }
  }
  // 인원이 많은 분류부터 다룹니다
  return [...out.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CATS)
    .map(([name, n]) => ({ name, n }));
}

// ── 2단계 · 분류별 인물 목록 ─────────────────────────────────
async function membersOf(cat) {
  const titles = [];
  let cont = null;
  for (let p = 0; p < 4; p++) {
    const q = { action: 'query', list: 'categorymembers', cmtitle: '분류:' + cat,
                cmlimit: 500, cmnamespace: 0 };
    if (cont) q.cmcontinue = cont;
    let d;
    try { d = await getJSON(wikiUrl(q)); }
    catch (e) { break; }
    for (const m of (d.query && d.query.categorymembers) || []) {
      if (m.title && !NOT_PERSON.test(m.title)) titles.push(m.title);
    }
    cont = d['continue'] && d['continue'].cmcontinue;
    if (!cont) break;
    await sleep(350);
  }
  return titles;
}

// ── 3단계 · 소개문과 위키데이터 ID ───────────────────────────
async function extractsOf(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    let d;
    try {
      d = await getJSON(wikiUrl({
        action: 'query', prop: 'extracts|pageprops',
        exintro: 1, explaintext: 1, redirects: 1,
        titles: batch.join('|'),
      }));
    } catch (e) { await sleep(1200); continue; }
    for (const pid of Object.keys((d.query && d.query.pages) || {})) {
      const pg = d.query.pages[pid];
      if (!pg || pg.missing !== undefined) continue;
      out[pg.title] = {
        extract: (pg.extract || '').replace(/\s+/g, ' ').trim(),
        qid: (pg.pageprops && pg.pageprops.wikibase_item) || '',
      };
    }
    await sleep(300);
  }
  return out;
}

// ── 4단계 · 위키데이터 상세 ──────────────────────────────────
async function wikidataOf(qids) {
  const out = {};
  for (let i = 0; i < qids.length; i += 150) {
    const vs = qids.slice(i, i + 150).map(q => 'wd:' + q).join(' ');
    const q = 'SELECT ?item ?birth ?death ?en '
      + '(GROUP_CONCAT(DISTINCT ?insL; separator=" · ") AS ?ins) '
      + '(GROUP_CONCAT(DISTINCT ?schL; separator=" · ") AS ?sch) '
      + '(GROUP_CONCAT(DISTINCT ?genL; separator=", ") AS ?gen) WHERE { '
      + 'VALUES ?item { ' + vs + ' } '
      + 'OPTIONAL { ?item wdt:P569 ?birth } '
      + 'OPTIONAL { ?item wdt:P570 ?death } '
      + 'OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") } '
      + 'OPTIONAL { ?item wdt:P1303 ?i0 . ?i0 rdfs:label ?insL FILTER(lang(?insL)="ko") } '
      + 'OPTIONAL { ?item wdt:P69 ?s0 . ?s0 rdfs:label ?schL FILTER(lang(?schL)="ko") } '
      + 'OPTIONAL { ?item wdt:P136 ?g0 . ?g0 rdfs:label ?genL FILTER(lang(?genL)="en") } '
      + '} GROUP BY ?item ?birth ?death ?en';
    let rows = [];
    try { rows = await sparql(q); }
    catch (e) { console.log('  · 위키데이터 조회 실패 · 건너뜀'); await sleep(2000); continue; }
    for (const b of rows) {
      const id = b.item.value.split('/').pop();
      const yr = (v) => v ? String(v.value).slice(0, 4) : '';
      out[id] = {
        life: yr(b.birth) ? yr(b.birth) + '\u2013' + yr(b.death) : '',
        en:  b.en  ? b.en.value  : '',
        ins: b.ins ? b.ins.value : '',
        sch: b.sch ? b.sch.value : '',
        gen: b.gen ? b.gen.value : '',
      };
    }
    await sleep(800);
  }
  return out;
}

// ── 판정 · 사람 검토를 대신하는 관문 ─────────────────────────
function judge(cand) {
  const gen = cand.wd.gen || '';
  // ① 대중음악 장르는 받지 않습니다
  if (GENRE.test(gen)) return { ok: false, why: '대중음악 장르' };
  // ② 분류 이름이 클래식 계열이면 받습니다
  const strongCat = SRC_STRONG.test(cand.cat);
  // ③ 아니면 소개문에 클래식 지표가 있어야 합니다
  const strongText = CLASSIC_STRONG.test(cand.extract || '');
  if (!strongCat && !strongText) return { ok: false, why: '클래식 근거 없음' };
  // ④ 소개문과 생몰이 모두 없으면 빈약하므로 받지 않습니다
  if (isEmpty(cand.extract) && isEmpty(cand.wd.life)) return { ok: false, why: '내용 빈약' };
  return { ok: true, why: strongCat ? '분류 근거' : '소개문 근거' };
}

function toRow(cand) {
  const w = cand.wd;
  return {
    name_ko: stripParen(cand.title),
    name_en: clean(w.en),
    field: cand.field || null,
    nationality: '대한민국',
    nat_code: 'KOR',
    life: clean(w.life),
    instrument: cand.instr || (w.ins ? w.ins.split(' · ')[0] : null),
    school: clean(w.sch),
    description: cand.extract ? cand.extract.slice(0, 400) : null,
    link_wiki: 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(cand.title.replace(/ /g, '_')),
    wikidata_id: cand.qid || null,
  };
}

// ── Supabase ────────────────────────────────────────────────
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select,
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < STEP) break;
    from += STEP;
    if (from > 80000) break;
  }
  return out;
}

async function sbInsert(rows) {
  if (!rows.length) return { ok: 0, dup: 0 };
  const post = (b) => fetch(SUPABASE_URL + '/rest/v1/persons', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(b),
  });
  const r = await post(rows);
  if (r.ok) return { ok: rows.length, dup: 0 };
  const txt = await r.text();
  // 이미 있는 항목이면 한 건씩 넣어 중복만 건너뜁니다
  if (r.status === 409 || txt.indexOf('23505') >= 0) {
    let ok = 0, dup = 0;
    for (const row of rows) {
      const r2 = await post([row]);
      if (r2.ok) { ok++; continue; }
      const t2 = await r2.text();
      if (r2.status === 409 || t2.indexOf('23505') >= 0) { dup++; continue; }
      throw new Error('INSERT ' + r2.status + ' ' + t2);
    }
    return { ok, dup };
  }
  throw new Error('INSERT ' + r.status + ' ' + txt);
}

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 국내 인물 수집기', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');

  const cats = await findCategories();
  console.log('■ 음악 관련 분류', cats.length, '개');
  if (!cats.length) { console.log('■ 분류를 찾지 못했습니다. 종료.'); return; }
  console.log('  상위 5개:', cats.slice(0, 5).map(c => c.name + '(' + c.n + ')').join(' · '));

  // 분류별 인물 목록
  const found = new Map();   // title -> { cat, field, instr }
  for (const c of cats) {
    let titles = [];
    try { titles = await membersOf(c.name); } catch (e) { continue; }
    const fld = guessField(c.name), ins = guessInstr(c.name);
    for (const t of titles) {
      if (!found.has(t)) found.set(t, { cat: c.name, field: fld, instr: ins });
    }
    if (found.size >= MAX_TITLES) break;
    await sleep(250);
  }
  console.log('■ 후보 문서', found.size, '건');
  if (!found.size) return;

  // 기존 인물 (중복 방지)
  const exist = await sbGetAll('persons', 'id,name_ko,name_en,wikidata_id');
  const haveQid = new Set(), haveName = new Set();
  for (const p of exist) {
    if (p.wikidata_id) haveQid.add(String(p.wikidata_id));
    if (p.name_ko) haveName.add(norm(stripParen(p.name_ko)));
    if (p.name_en) haveName.add(norm(p.name_en));
  }
  console.log('■ 기존 인물', exist.length, '명');

  // 이미 있는 이름은 미리 걸러 요청 수를 줄입니다
  const titles = [...found.keys()].filter(t => !haveName.has(norm(stripParen(t))));
  console.log('■ 새 이름', titles.length, '건 · 소개문 조회 시작');

  const ex = await extractsOf(titles);
  const qids = [...new Set(Object.values(ex).map(v => v.qid).filter(Boolean))]
    .filter(q => !haveQid.has(q));
  console.log('■ 위키데이터 조회', qids.length, '건');

  const wd = await wikidataOf(qids);

  // 판정
  const rows = [], reasons = {};
  for (const t of titles) {
    const e = ex[t]; if (!e) continue;
    if (e.qid && haveQid.has(e.qid)) continue;
    const meta = found.get(t) || {};
    const cand = { title: t, cat: meta.cat || '', field: meta.field, instr: meta.instr,
                   extract: e.extract, qid: e.qid, wd: wd[e.qid] || {} };
    const v = judge(cand);
    reasons[v.why] = (reasons[v.why] || 0) + 1;
    if (v.ok) rows.push(toRow(cand));
  }

  console.log('■ 판정 결과');
  for (const k of Object.keys(reasons)) console.log('   ' + k + ': ' + reasons[k] + '건');
  console.log('■ 저장 대상', rows.length, '명');

  if (DRY) {
    console.log('■ 시험 실행이므로 저장하지 않습니다. 앞 10명:');
    rows.slice(0, 10).forEach(r => console.log('   ' + r.name_ko
      + ' · ' + (r.field || '분야없음') + ' · ' + (r.life || '생몰없음')));
    return;
  }

  let ins = 0, dup = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const r = await sbInsert(rows.slice(i, i + 200));
    ins += r.ok; dup += r.dup;
  }
  console.log('■ 신규 저장', ins, '명' + (dup ? ' · 이미 있어 건너뜀 ' + dup + '명' : ''));

  const total = await fetch(SUPABASE_URL + '/rest/v1/persons?select=id&limit=1',
    { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = total.headers.get('content-range') || '';
  console.log('■ 완료 · 인물 총', (cr.split('/')[1] || '?'), '명');
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
