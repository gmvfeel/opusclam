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

// 바깥 자료원 호출은 공용 모듈이 담당합니다 · scripts/lib/http.mjs
//   429 대기 상한 90초 · 실행 예산 25분 · 막히면 모은 것까지 저장하고 정상 종료합니다.
//   이 정책을 고치려면 http.mjs 한 곳만 고치면 모든 수집기에 반영됩니다.
import { makeGetJSON, isStop, sleep } from './lib/http.mjs';

import { readJson } from './lib/json.mjs';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1.1';   // 공용 http 모듈 적용판 (로그에서 새 코드인지 구분하는 표시)
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
const CAT_MUSIC = /음악|작곡|연주자|성악|지휘|합창|오페라|피아노|바이올린|비올라|첼로|콘트라베이스|플루트|클라리넷|오보에|바순|호른|트럼펫|트롬본|색소폰|하프|오르간|타악/;

// 대중음악 계열 분류는 그물에서 빼냅니다.
// 이걸 두지 않으면 '음악 그룹(1199명)' 같은 큰 분류가 상한을 다 차지해서
// 정작 필요한 '성악가(129명)' 분류가 밀려납니다.
const CAT_DENY = /음악 그룹|밴드|아이돌|보이 그룹|걸 그룹|댄스|팝 음악|힙합|랩 |래퍼|록 음악|메탈|펑크|트로트|음악 프로듀서|싱어송라이터|음반 레이블|음악 축제|경연|서바이벌|아카펠라 그룹|음악 방송|주제가|사운드트랙|국악|판소리|가야금|거문고|해금|대금|아쟁|소리꾼|민요|창극|사물놀이|농악|시조|정가|무형문화재/;

const SRC_STRONG = /클래식|현대음악|오페라|성악가|지휘자|음악학자|음악 교육자|바이올린 연주자|비올라|첼로|오르간 연주자|플루트|오보에|트럼펫|콘트라베이스|하프 연주자/;

const CLASSIC_STRONG = /교향곡|교향악|관현악|실내악|협주곡|칸타타|미사곡|현악 사중주|필하모닉|교향악단|독주회|리사이틀|콩쿠르|음악학자|음악학 박사|현대음악|국립오페라|합창단을 지휘|악장으로|오페라를 작곡|가곡/;

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

// ★ 나눠받기에는 <b>순서를 확정해</b> 주어야 합니다.
//
//   왜 필요한가 (2026-08-03 실제로 겪은 일입니다)
//     Range 로 페이지를 나눠 받는데 정렬이 없으면, 데이터베이스는
//     <b>매 페이지마다 다른 순서</b>로 줄 수 있습니다. 그러면 어떤 줄은
//     두 번 오고 어떤 줄은 아예 오지 않습니다.
//
//     어드민 화면에서 인물 9,346명을 그렇게 받다가 같은 인물이 두 번
//     담겼고, 삭제할 때 같은 위키데이터 번호를 두 번 보내
//       ON CONFLICT DO UPDATE command cannot affect row a second time
//     오류가 났습니다. 300명으로 재현해 보니 <b>돌릴 때마</b> 중복 5~8줄,
//     누락 5~8명이 생겼습니다.
//
//     수집기들은 「이미 담긴 항목 목록」 을 이렇게 받아 중복을 피합니다.
//     목록이 새면 <b>이미 있는 것을 또 담거나, 있는 것을 못 알아봅니다.</b>
//
//   기본키는 겹치지 않으므로 정렬에 붙이면 순서가 확정됩니다.
//   blocklist 는 기본키가 wikidata_id 이고, 나머지는 id 입니다.
function orderFor(table) {
  return '&order=' + (table === 'blocklist' ? 'wikidata_id' : 'id') + '.asc';
}

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
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const clean = (s) => isEmpty(s) ? null : String(s).replace(/\s+/g, ' ').trim();
const stripParen = (s) => String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

// 요청 과다(429)와 일시 오류에 참을성 있게 대응합니다
const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/json',
  tries: 5,
});

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
        if (!name || n <= 0) continue;
        // 배제를 가장 먼저 봅니다.
        // 뒤에 두면 '국악 성악가' 처럼 두 성격이 섞인 분류가
        // '성악가' 에 걸려 통과해 버립니다.
        if (CAT_DENY.test(name)) continue;
        // 클래식 근거가 확실한 분류는 담습니다
        if (SRC_STRONG.test(name)) { out.set(name, n); continue; }
        // 나머지 음악 관련 분류는 담되, 인물 판정은 따로 합니다
        if (CAT_MUSIC.test(name)) out.set(name, n);
      }
      from = d['continue'] && d['continue'].accontinue;
      if (!from) break;
      await sleep(400);
    }
  }
  // 클래식 근거가 확실한 분류를 먼저 담고, 그 안에서 인원이 많은 순으로 봅니다.
  // 인원순으로만 자르면 큰 대중음악 분류가 상한을 차지합니다.
  return [...out.entries()]
    .sort((a, b) => {
      const sa = SRC_STRONG.test(a[0]) ? 1 : 0;
      const sb = SRC_STRONG.test(b[0]) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return b[1] - a[1];
    })
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
    } catch (e) { if (isStop(e)) break; await sleep(1200); continue; }
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
      + '(GROUP_CONCAT(DISTINCT ?genL; separator=", ") AS ?gen) '
      + '(GROUP_CONCAT(DISTINCT ?t; separator=" ") AS ?types) WHERE { '
      + 'VALUES ?item { ' + vs + ' } '
      + 'OPTIONAL { ?item wdt:P31 ?t } '
      + 'OPTIONAL { ?item wdt:P569 ?birth } '
      + 'OPTIONAL { ?item wdt:P570 ?death } '
      + 'OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)="en") } '
      + 'OPTIONAL { ?item wdt:P1303 ?i0 . ?i0 rdfs:label ?insL FILTER(lang(?insL)="ko") } '
      + 'OPTIONAL { ?item wdt:P69 ?s0 . ?s0 rdfs:label ?schL FILTER(lang(?schL)="ko") } '
      + 'OPTIONAL { ?item wdt:P136 ?g0 . ?g0 rdfs:label ?genL FILTER(lang(?genL)="en") } '
      + '} GROUP BY ?item ?birth ?death ?en';
    let rows = [];
    try { rows = await sparql(q); }
    catch (e) { if (isStop(e)) break; console.log('  · 위키데이터 조회 실패 · 건너뜀'); await sleep(2000); continue; }
    for (const b of rows) {
      const id = b.item.value.split('/').pop();
      const yr = (v) => v ? String(v.value).slice(0, 4) : '';
      out[id] = {
        life: yr(b.birth) ? yr(b.birth) + '\u2013' + yr(b.death) : '',
        en:  b.en  ? b.en.value  : '',
        ins: b.ins ? b.ins.value : '',
        sch: b.sch ? b.sch.value : '',
        gen: b.gen ? b.gen.value : '',
        types: b.types ? b.types.value : '',
      };
    }
    await sleep(800);
  }
  return out;
}

// ── 판정 · 사람 검토를 대신하는 관문 ─────────────────────────
// 단체 이름에 흔히 붙는 말입니다.
// 위키데이터에 개체 유형이 없는 경우를 대비한 보조 장치입니다.
const GROUP_NAME = /콰르텟|콰르뎃|앙상블|트리오|듀오|오케스트라|교향악단|필하모닉|합창단|중창단|사중주단|삼중주단|현악단|관악단|국악단|무용단|악단|밴드|프로젝트$|컴퍼니|재단|협회|학회/;

// 국악 계열을 가려내는 낱말입니다.
// 오퍼스클램은 클래식 전문이므로 국악인은 인물DB 에 넣지 않습니다.
// 특히 국악 전공자가 트로트나 크로스오버로 옮기는 경우 위키백과 분류는
// '국악인' 으로 남아 있고 장르 정보 갱신은 늦어서, 장르 관문만으로는 못 막습니다.
//
// '국악' 단독은 넣지 않았습니다. 서양음악 연주자의 소개문에도
// '국악관현악단과 협연' 처럼 나올 수 있어 오탐이 생깁니다.
const KOREAN_TRAD = /판소리|명창|국악인|가야금|거문고|해금|아쟁|대금 연주|창극|사물놀이|농악|소리꾼|무형문화재|남도민요|경기민요|정가 /;

// 위키데이터 개체 유형에 사람(Q5)이 있는지 봅니다.
// true = 사람 · false = 사람 아님 · null = 판단할 자료가 없음
function isHuman(types) {
  if (!types) return null;
  return String(types).split(/\s+/).some(u => u.endsWith('/Q5'));
}

// 소개문에 나타나는 대중음악 표시입니다.
// 위키데이터 장르가 비어 있으면 장르 관문이 작동하지 않아
// '헤비메탈 드러머' 같은 인물이 그대로 통과합니다.
const POP_TEXT = /메탈|드러머|베이시스트|기타리스트|키보디스트|디제이|아이돌|보이그룹|걸그룹|보이 그룹|걸 그룹|트로트|힙합|래퍼|케이팝|k-?pop|가요계|댄스 음악|록 음악|밴드의 (보컬|멤버)|싱어송라이터|음악 프로듀서|연예인/i;

// 소개문에 음악 이야기가 있는지 봅니다.
// 분류가 잘못 붙은 경우(방송인이 성악가 분류에 들어가 있는 등)를 막습니다.
const MUSIC_TEXT = /음악|연주|작곡|지휘|성악|노래|소프라노|테너|바리톤|베이스|메조|피아니스트|바이올리니스트|첼리스트|오케스트라|교향|협주|독주|리사이틀|콩쿠르|오페라|합창|앙상블|실내악|악단|악장|성부|가곡/;

function judge(cand) {
  const w = cand.wd || {};

  // ① 사람이 아니면 받지 않습니다.
  //    노부스 콰르텟 같은 연주단체는 인물DB 가 아니라 단체DB 로 가야 합니다.
  const h = isHuman(w.types);
  if (h === false) return { ok: false, why: '사람이 아님(단체 등)' };
  if (GROUP_NAME.test(cand.title)) return { ok: false, why: '단체 이름' };
  //    개체 유형을 못 받았으면 생몰로 판단합니다. 단체는 생몰이 없습니다.
  if (h === null && isEmpty(w.life)) return { ok: false, why: '사람 여부 확인 불가' };

  // ② 국악 계열은 받지 않습니다 (클래식 전문 포털)
  if (KOREAN_TRAD.test(cand.extract || '') || KOREAN_TRAD.test(cand.cat)) {
    return { ok: false, why: '국악 계열' };
  }

  // ③ 대중음악은 받지 않습니다. 장르 정보와 소개문 양쪽을 봅니다.
  if (GENRE.test(w.gen || '')) return { ok: false, why: '대중음악 장르' };
  if (POP_TEXT.test(cand.extract || '')) return { ok: false, why: '대중음악 소개문' };

  // ④ 소개문에 음악 이야기가 없으면 받지 않습니다.
  //    분류가 잘못 붙은 인물(방송인 · 배우 등)이 이 관문에서 걸립니다.
  if (!MUSIC_TEXT.test(cand.extract || '')) return { ok: false, why: '소개문에 음악 없음' };

  // ⑤ 분류 이름이 클래식 계열이면 받습니다
  const strongCat = SRC_STRONG.test(cand.cat);
  // ⑥ 아니면 소개문에 클래식 지표가 있어야 합니다
  const strongText = CLASSIC_STRONG.test(cand.extract || '');
  if (!strongCat && !strongText) return { ok: false, why: '클래식 근거 없음' };

  // ⑦ 소개문과 생몰이 모두 없으면 빈약하므로 받지 않습니다
  if (isEmpty(cand.extract) && isEmpty(w.life)) return { ok: false, why: '내용 빈약' };

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
/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + orderFor(table),
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await readJson(r);
    out.push(...batch);
    if (!batch.length) break;              // 더 없으면 끝
    from += batch.length;                 // ★ 받은 만큼만 나아갑니다
    if (from > 80000) break;
  }
  return out;
}

// ── 차단 목록 ────────────────────────────────────────────────
//  어드민의 '삭제 + 차단' 은 blocklist 표에 위키데이터 번호를 남깁니다.
//  그런데 이 자동 수집기는 그 목록을 읽지 않았습니다.
//  어드민 화면의 수동 수집(admin.html)에는 있던 처리가
//  스크립트로 옮길 때 빠진 것입니다.
//  그래서 지운 인물이 다음 수집에서 그대로 되돌아왔습니다.
//    2026-07-29 확인 · 수집기 일곱 개가 모두 같은 상태였습니다.
async function loadBlocked() {
  try {
    const rows = await sbGetAll('blocklist', 'wikidata_id');
    const set = new Set();
    for (const r of rows || []) if (r && r.wikidata_id) set.add(String(r.wikidata_id).trim());
    if (set.size) console.log('■ 차단 목록', set.size, '건 읽음');
    return set;
  } catch (e) {
    console.log('■ 차단 목록을 읽지 못했습니다 · 걸러내지 않고 이어갑니다 ·', String(e.message).slice(0, 60));
    return new Set();
  }
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
    try { titles = await membersOf(c.name); } catch (e) { if (isStop(e)) break; continue; }
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
  const blocked = await loadBlocked();

  // 이미 있는 이름은 미리 걸러 요청 수를 줄입니다
  const titles = [...found.keys()].filter(t => !haveName.has(norm(stripParen(t))));
  console.log('■ 새 이름', titles.length, '건 · 소개문 조회 시작');

  const ex = await extractsOf(titles);
  const qidsAll = [...new Set(Object.values(ex).map(v => v.qid).filter(Boolean))]
    .filter(q => !haveQid.has(q));
  // 차단한 인물은 위키데이터를 물어보지도 않습니다. 요청까지 아낍니다.
  const qids = qidsAll.filter(q => !blocked.has(String(q)));
  if (qidsAll.length !== qids.length) {
    console.log('■ 차단 목록 제외', qidsAll.length - qids.length, '명');
  }
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

main().catch(e => {
  // 자료원이 막혀 멈춘 것은 실패가 아닙니다.
  // 모은 것은 이미 저장됐고 못 채운 몫은 다음 예약 실행이 받아옵니다.
  if (isStop(e)) {
    console.log('■ 여기까지 · ' + e.message);
    console.log('■ 다음 예약 실행에서 이어서 받아옵니다.');
    return;
  }
  console.error('■ 실패:', e);
  process.exit(1);
});
