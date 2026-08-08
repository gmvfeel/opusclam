/* ============================================================
   위키데이터에 클래식 음악인이 실제로 몇 명인지 세기
   scripts/count-classic.mjs

   왜 필요한가 (2026-08-08 · 파트너 물음)
     「엄격하게 조여도 9,025명밖에 안 될까?」

     지금 인물 수집 조건을 열어 보니 두 가지 문제가 있었습니다.
       ① FILTER(?sl > 8)  — 위키백과 문서가 8개 언어 이상인 사람만
          → 유명인만 들어옵니다. 수가 적은 진짜 까닭입니다.
       ② 「지휘자」 버튼에는 클래식 조건이 없습니다
          → 직업만 보고 받으므로 대중음악 쪽 사람도 들어옵니다.

     넓으면서 동시에 좁습니다. 순도는 낮고 수는 적습니다.

   ★ 이 스크립트는 아무것도 담지 않습니다. 세기만 합니다.
   ★ 번호를 짐작하지 않습니다 — 실행할 때마다 이름을 물어 찍습니다.

   쓰는 법
     node scripts/count-classic.mjs
     node scripts/count-classic.mjs --quick    (빠르게 · 핵심만)
   ============================================================ */

import { makeGetJSON, isStop, sleep } from './lib/http.mjs';

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'OpusclamCountBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/sparql-results+json',
  tries: 5,
  maxWaitMs: 200 * 1000,
  budgetMs: 40 * 60 * 1000,
  backoff: [5000, 20000, 45000, 90000, 150000]
});

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const QUICK = !!args.quick;

/* ── 직업 번호 ─────────────────────────────────────────────
   ★ admin.html 의 수집 단추가 쓰는 번호를 그대로 가져왔습니다.
     이름은 실행할 때 확인합니다. 엉뚱하면 바로 드러납니다. */
const JOBS = [
  ['Q36834',    '작곡'],
  ['Q158852',   '지휘'],
  ['Q2865819',  '성악(오페라)'],
  ['Q486748',   '피아노'],
  ['Q1259917',  '바이올린'],
  ['Q13219637', '첼로'],
  ['Q16003954', '비올라'],
  ['Q12377274', '오르간'],
  ['Q12902372', '하프시코드'],
  ['Q118865',   '플루트'],
  ['Q12310971', '오보에'],
  ['Q765778',   '클라리넷'],
  ['Q3127709',  '바순'],
  ['Q544972',   '하프'],
  ['Q899758',   '기타(클래식)'],
  ['Q1214796',  '트럼펫'],
  ['Q5371902',  '타악'],
  ['Q14915627', '음악학'],
  ['Q16145150', '음악교육']
];

/* 클래식 계열 장르 — 하위 갈래까지 봅니다 */
const FAM = ['Q9730', 'Q1344'];   // classical music · opera

const val = (b, k) => (b && b[k] && b[k].value) || '';

async function sparql(q) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(q));
  return (d.results && d.results.bindings) || [];
}

async function one(q) {
  const rows = await sparql(q);
  if (!rows.length) return 0;
  return Number(val(rows[0], 'n') || 0);
}

/* ── 번호 이름 확인 ───────────────────────────────────────── */
async function verify() {
  const all = JOBS.map(j => 'wd:' + j[0]).concat(FAM.map(f => 'wd:' + f));
  const q = 'SELECT ?c ?cLabel WHERE { VALUES ?c { ' + all.join(' ') + ' } '
          + '?c rdfs:label ?cLabel FILTER(lang(?cLabel)="en") }';
  const rows = await sparql(q);
  const nm = {};
  rows.forEach(b => { nm[val(b, 'c').replace(/^.*\//, '')] = val(b, 'cLabel'); });

  console.log('── 번호 확인 (이름이 엉뚱하면 번호가 틀린 것입니다) ──');
  JOBS.forEach(([q2, ko]) => {
    console.log('   ' + q2.padEnd(12) + (nm[q2] || '★ 이름을 못 받았습니다').padEnd(34) + ' → ' + ko);
  });
  FAM.forEach(f => {
    console.log('   ' + f.padEnd(12) + (nm[f] || '★ 이름을 못 받았습니다').padEnd(34) + ' → 클래식 계열 장르');
  });
  return nm;
}

/* ── 조건별 쿼리 ─────────────────────────────────────────── */
function qJobOnly(job) {
  return `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P106 wd:${job} .
}`;
}
function qJobLinks(job, sl) {
  return `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P106 wd:${job} ; wikibase:sitelinks ?sl .
  FILTER(?sl > ${sl})
}`;
}
function qJobClassic(job) {
  return `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P106 wd:${job} .
  VALUES ?fam { ${FAM.map(f => 'wd:' + f).join(' ')} }
  ?item wdt:P136/wdt:P279* ?fam .
}`;
}
function qStrict(job) {
  /* ★ 우리가 새로 쓸 잣대 —
     직업이 있고 + 클래식 장르가 있고 + 대중음악 표시가 없는 사람 */
  return `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  ?item wdt:P106 wd:${job} .
  VALUES ?fam { ${FAM.map(f => 'wd:' + f).join(' ')} }
  ?item wdt:P136/wdt:P279* ?fam .
  FILTER NOT EXISTS { ?item wdt:P136 ?g . ?g wdt:P279* wd:Q373342 }
  FILTER NOT EXISTS { ?item wdt:P136 wd:Q37073 }
  FILTER NOT EXISTS { ?item wdt:P106 wd:Q33999 }
}`;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  위키데이터에 클래식 음악인이 몇 명인지 세기         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n※ 아무것도 담지 않습니다. 세기만 합니다.');
  console.log('※ 위키데이터가 무거워 한 줄에 10~20초씩 걸립니다.\n');

  await verify();

  console.log('\n\n── 직업별 인원 ──');
  console.log('   ① 직업만        직업(P106)이 그것인 사람 전부');
  console.log('   ② 문서 8개 이상  ← 지금 우리 조건 (유명인만)');
  console.log('   ③ 클래식 장르    직업 + 장르가 클래식·오페라 계열');
  console.log('   ④ 엄격           ③ + 대중음악 표시가 없는 사람  ← 새로 쓸 잣대\n');
  console.log('   ' + '직업'.padEnd(14) + '①직업만'.padStart(10) + '②문서8+'.padStart(10)
    + '③클래식'.padStart(10) + '④엄격'.padStart(10));
  console.log('   ' + '─'.repeat(56));

  const jobs = QUICK ? JOBS.slice(0, 6) : JOBS;
  let sumStrict = 0, sumMine = 0;

  for (const [qid, ko] of jobs) {
    let a = 0, b = 0, c = 0, d = 0;
    try {
      a = await one(qJobOnly(qid));      await sleep(1200);
      b = await one(qJobLinks(qid, 8));  await sleep(1200);
      c = await one(qJobClassic(qid));   await sleep(1200);
      d = await one(qStrict(qid));       await sleep(1200);
    } catch (e) {
      if (isStop(e)) { console.log('\n   ※ ' + e.message); break; }
      console.log('   ' + ko.padEnd(14) + '  (실패 — ' + String(e.message || '').slice(0, 40) + ')');
      continue;
    }
    sumStrict += d;
    sumMine += b;
    console.log('   ' + ko.padEnd(14)
      + String(a).padStart(10) + String(b).padStart(10)
      + String(c).padStart(10) + String(d).padStart(10));
  }

  console.log('   ' + '─'.repeat(56));
  console.log('   ' + '합계(겹침 포함)'.padEnd(14)
    + ''.padStart(10) + String(sumMine).padStart(10)
    + ''.padStart(10) + String(sumStrict).padStart(10));

  console.log('\n\n── 겹치지 않게 센 전체 ──');
  console.log('   ※ 한 사람이 여러 직업을 가질 수 있어 위 합계와 다릅니다.\n');

  const allJobs = jobs.map(j => 'wd:' + j[0]).join(' ');
  try {
    const nowQ = `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  VALUES ?job { ${allJobs} }
  ?item wdt:P106 ?job ; wikibase:sitelinks ?sl .
  FILTER(?sl > 8)
}`;
    const now = await one(nowQ);
    await sleep(1500);

    const strictQ = `SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
  VALUES ?job { ${allJobs} }
  ?item wdt:P106 ?job .
  VALUES ?fam { ${FAM.map(f => 'wd:' + f).join(' ')} }
  ?item wdt:P136/wdt:P279* ?fam .
  FILTER NOT EXISTS { ?item wdt:P136 ?g . ?g wdt:P279* wd:Q373342 }
  FILTER NOT EXISTS { ?item wdt:P136 wd:Q37073 }
  FILTER NOT EXISTS { ?item wdt:P106 wd:Q33999 }
}`;
    const strict = await one(strictQ);

    console.log('   지금 조건 (문서 8개 이상 · 클래식 확인 없음) : ' + now.toLocaleString() + '명');
    console.log('   새 잣대   (클래식 장르 필수 · 문서 수 무관)   : ' + strict.toLocaleString() + '명');
    console.log('\n   지금 우리 인물DB                              : 9,025명');
    if (strict > now) {
      console.log('\n   ▶ 엄격하게 조여도 ' + (strict - now).toLocaleString()
        + '명이 <b>더</b> 들어옵니다.');
      console.log('     문서 수 문턱이 진짜 병목이었습니다.');
    } else {
      console.log('\n   ▶ 엄격하게 조이면 ' + (now - strict).toLocaleString() + '명이 줄어듭니다.');
    }
  } catch (e) {
    console.log('   전체 세기 실패 — ' + String(e.message || '').slice(0, 80));
  }

  console.log('\n끝났습니다. 이 숫자를 보고 방향을 정하십시오.');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
