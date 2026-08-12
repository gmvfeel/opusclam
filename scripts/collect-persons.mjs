/* ============================================================
   OPUSCLAM 인물 수집 (새 잣대) — scripts/collect-persons.mjs
   ------------------------------------------------------------
   ★ 왜 새로 만들었나 (2026-08-08 · 파트너 결정)

   예전에는 admin.html 안의 단추가 인물을 담았고, 조건이 이랬습니다.
       ?item wdt:P106 wd:{직업} ; wikibase:sitelinks ?sl .
       FILTER(?sl > 8)                    ← 위키백과 문서가 8개 언어 이상
       + 대중음악 제외 몇 가지              ← 클래식인지는 확인하지 않음

   <b>넓으면서 동시에 좁았습니다.</b>
     · 넓다 — 클래식 확인 없이 직업만 보아 대중음악 쪽이 들어왔습니다
     · 좁다 — 문서 8개 문턱 때문에 유명인만 들어왔습니다

   2026-08-08 실측 (scripts/count-classic.mjs)
       지금 조건                    27,779명
       새 잣대(장르 필수·문서 무관)   20,266명
       그때 우리 인물DB               9,058명
     ▶ 엄격하게 조여도 <b>두 배 넘게</b> 받을 수 있습니다.
       문서 수 문턱이 진짜 병목이었습니다.

   ★ 이 수집기의 조건
       ① 직업(P106)이 클래식 음악 직업이고
       ② 장르(P136)가 클래식·오페라 계열이며
       ③ 대중음악 표시가 없을 것
       ④ 문서 수는 보지 않습니다
       ⑤ 받아온 뒤 checkClassic() 으로 <b>한 번 더</b> 거릅니다

   ★ 이미 담긴 사람과 차단 목록은 건너뜁니다.
   ★ 사람이 고친 값을 덮지 않습니다 — 새로 담기만 하고 고치지 않습니다.

   쓰는 법
     node scripts/collect-persons.mjs                    무엇이 올지만 봅니다
     node scripts/collect-persons.mjs --save             실제로 담습니다
     node scripts/collect-persons.mjs --job=Q36834       한 직업만
     node scripts/collect-persons.mjs --limit=2000       직업당 <새 사람> 최대
     node scripts/collect-persons.mjs --list             받을 사람 전부 찍기

   필요한 환경변수
     SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { makeGetJSON, isStop, sleep } from './lib/http.mjs';
import {
  JOBS, sparqlClassicRequired,
  checkClassic, verifyQuery, verifyReport
} from './lib/classic.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SAVE  = !!args.save;
const LIST  = !!args.list;
const DEBUG = !!args.debug;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 4000;
const ONEJOB = typeof args.job === 'string' ? args.job : null;

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'OpusclamPersonBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';

const getJSON = makeGetJSON({
  ua: UA,
  accept: 'application/sparql-results+json',
  tries: 6,
  maxWaitMs: 200 * 1000,
  budgetMs: 45 * 60 * 1000,
  backoff: [5000, 20000, 45000, 90000, 150000, 200000]
});

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

const val   = (b, k) => (b && b[k] && b[k].value) || '';
const qidOf = (u) => (u || '').replace(/^.*\/entity\//, '');

async function sparql(q) {
  const d = await getJSON(SPARQL + '?format=json&query=' + encodeURIComponent(q));
  return (d.results && d.results.bindings) || [];
}

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init, headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 250));
  return t ? JSON.parse(t) : null;
}

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다.
   끝냄은 0줄일 때만, offset 은 실제로 받은 수만큼, order 에 id 필수. */
async function getAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await rest(path + '&limit=200&offset=' + off);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    off += rows.length;
    if (rows.length < 200) break;
    if (off % 2000 === 0) process.stdout.write('   읽는 중 ' + off + '명\r');
  }
  return out;
}

/* ── 번호가 맞는지 확인 ─────────────────────────────────── */
async function verify() {
  console.log('── 번호 확인 (이름이 엉뚱하면 번호가 틀린 것입니다) ──');
  try {
    const rows = await sparql(verifyQuery());
    const nm = {};
    rows.forEach(b => { nm[qidOf(val(b, 'c'))] = val(b, 'cLabel'); });
    const { rows: rep, bad } = verifyReport(nm);
    rep.forEach(r => {
      console.log('   ' + (r.ok ? '  ' : '★ ') + r.qid.padEnd(12)
        + r.got.padEnd(26) + ' → ' + r.ko
        + (r.ok ? '' : '   (적어 둔 이름 : ' + r.want + ')'));
    });

    /* ★ 2026-08-08 고침 — 어긋나도 <b>멈추지 않습니다.</b>
       예전에는 하나만 어긋나도 죽었는데, 화면에 무엇이 어긋났는지
       보이지 않아 고칠 수가 없었습니다.
       이름이 조금 달라도(대소문자·표기 차이) 수집에는 지장이 없습니다.
       정말 잘못된 번호라면 그 직업에서 0명이 나오므로 그때 압니다. */
    if (bad) {
      console.log('\n※ ' + bad + '개의 이름이 적어 둔 것과 다릅니다 (위의 ★ 표).');
      console.log('  표기 차이일 수 있으니 그대로 진행합니다.');
      console.log('  그 직업에서 0명이 나오면 번호가 정말 틀린 것입니다.');
    } else {
      console.log('   ✓ ' + rep.length + '개 모두 맞습니다.');
    }
  } catch (e) {
    console.log('   확인 실패 · 그대로 진행합니다 (' + String(e.message || '').slice(0, 50) + ')');
  }
}

/* ── 목록 쿼리 ──────────────────────────────────────────
   ★ 문서 수(sitelinks) 문턱을 넣지 않습니다 — 그것이 병목이었습니다. */
function listQuery(jobQid, offset, page) {
  /* ★ 대중음악 배제 조각을 <b>일부러 넣지 않았습니다.</b>
     SPARQL 로 미리 빼면 우리 잣대와 어긋납니다 —
       SPARQL   재즈 장르가 있으면 → 배제  ← 거슈윈이 여기서 빠집니다
       우리 잣대 클래식이 있으면 → 받음
     또 singer·actor 를 빼면 오페라 가수 대부분이 사라집니다.
     클래식 장르를 필수로 두는 것만으로 충분하고,
     판단은 받아온 뒤 checkClassic() 한 곳에서 합니다. */
  return `SELECT DISTINCT ?item WHERE {
  ?item wdt:P106 wd:${jobQid} .
  ${sparqlClassicRequired('?item')}
}
ORDER BY ?item
LIMIT ${page} OFFSET ${offset}`;
}

/* ── 상세 쿼리 ─────────────────────────────────────────── */
function detailQuery(qids) {
  const vs = qids.map(q => 'wd:' + q).join(' ');
  /* ★ 2026-08-08 고침 — 사람 하나가 여러 줄로 오던 문제
       예전에는 GROUP BY 에 ?birth ?death ?countryLabel 을 넣었습니다.
       위키데이터는 한 사람에게 <b>출처가 다른 생몰일을 여럿</b> 갖습니다.
       그러면 조합 수만큼 줄이 늘어납니다 —
         Momo Kodama 1972~ · 1967~ · 1972~ · 1967~  (네 줄)
       ▶ 값이 여럿일 수 있는 것은 SAMPLE() 로 하나만 뽑고,
         GROUP BY 는 ?item 하나로만 묶습니다. */
  return `SELECT ?item
       (SAMPLE(?enL)  AS ?en)
       (SAMPLE(?koL)  AS ?ko)
       (MIN(?birthV)  AS ?birth)
       (MIN(?deathV)  AS ?death)
       (SAMPLE(?slV)  AS ?sl)
       (GROUP_CONCAT(DISTINCT ?gL;separator=", ")  AS ?genres)
       (GROUP_CONCAT(DISTINCT ?oL;separator=", ")  AS ?occs)
WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item rdfs:label ?enL FILTER(lang(?enL)="en") }
  OPTIONAL { ?item rdfs:label ?koL FILTER(lang(?koL)="ko") }
  OPTIONAL { ?item wdt:P569 ?birthV }
  OPTIONAL { ?item wdt:P570 ?deathV }
  OPTIONAL { ?item wikibase:sitelinks ?slV }
  OPTIONAL { ?item wdt:P136 ?g . ?g rdfs:label ?gL FILTER(lang(?gL)="en") }
  OPTIONAL { ?item wdt:P106 ?o . ?o rdfs:label ?oL FILTER(lang(?oL)="en") }
}
GROUP BY ?item`;
}

const year = (s) => { const m = /^(-?\d{4})/.exec(s || ''); return m ? m[1].replace(/^-/, '기원전 ') : ''; };

function lifeOf(b, d) {
  const y1 = year(b), y2 = year(d);
  if (!y1 && !y2) return null;
  return (y1 || '?') + '~' + (y2 || '');
}

/* ── 한 직업 처리 ───────────────────────────────────────── */
async function runJob(job, have, blocked) {
  console.log('\n════════════════════════════════════════════');
  console.log(' ' + job.en + '  →  ' + job.field);
  console.log('════════════════════════════════════════════');

  const PAGE = 500;
  const qids = [];
  let stopped = false;

  /* ★★ 2026-08-12 · 상한을 <b>「새 사람」 기준</b>으로 바꿨습니다 ★★
     ──────────────────────────────────────────────────────────────
     ★ 무엇이 잘못됐나
       예전에는 <b>받아온 항목 수</b>를 4000에서 끊었습니다.
       그런데 위키데이터는 늘 <b>같은 번호 순서</b>로 돌려줍니다.
       작곡가는 앞 4000명 가운데 <b>3,932명이 이미 담긴 사람</b>이었습니다.

         받은 것 4000  →  이미 있음 3932  →  새 사람 68

       그래서 다시 돌려도 <b>같은 4000명을 또 봅니다.</b>
       4000명 뒤쪽에는 영영 닿지 못했습니다.
       「담으신 뒤 다시 돌리면 이어서 받습니다」라는 안내는
       사실이 아니었습니다.

     ★ 어떻게 고쳤나
       <b>새 사람이 상한만큼 모일 때까지</b> 쪽을 넘깁니다.
       이미 담긴 사람·차단된 사람은 자리를 차지하지 않습니다.
       위키데이터가 더 줄 것이 없으면(한 쪽이 다 안 차면) 끝냅니다.

     ★ 헛돌지 않게 쪽 수에 울타리를 둡니다
       한 직업에 최대 400쪽(20만 항목)까지만 봅니다.
       쪽마다 1.5초 쉬므로 400쪽이면 10분입니다. 제한 시간은 60분입니다. */
  const MAX_PAGES = 400;
  let scanned = 0;
  let reachedEnd = false;

  for (let pg = 0; pg < MAX_PAGES; pg++) {
    const off = pg * PAGE;
    let rows;
    try {
      rows = await sparql(listQuery(job.qid, off, PAGE));
    } catch (e) {
      if (isStop(e)) { stopped = true; console.log('  ※ ' + e.message); break; }
      console.log('  · 목록 ' + off + '~ 실패 · 건너뜁니다 (' + String(e.message || '').slice(0, 50) + ')');
      continue;
    }
    if (!rows.length) { reachedEnd = true; break; }
    rows.forEach(b => { const q = qidOf(val(b, 'item')); if (q) qids.push(q); });
    scanned += rows.length;

    /* 새 사람이 몇 명 모였나 — 이것으로 끊습니다 */
    const newSoFar = qids.filter(q => !have.has(q) && !blocked.has(q)).length;
    process.stdout.write('   훑는 중 ' + scanned + '항목 · 새 사람 ' + newSoFar + '명\r');

    if (rows.length < PAGE) { reachedEnd = true; break; }
    if (newSoFar >= LIMIT) break;
    await sleep(1500);
  }
  process.stdout.write('                                                  \r');

  const newCount = qids.filter(q => !have.has(q) && !blocked.has(q)).length;
  const hitLimit = !reachedEnd && newCount >= LIMIT;
  console.log('위키데이터에서 훑은 항목 : ' + qids.length + '명'
    + (stopped ? '  ※ 속도 제한으로 중간에 멈췄습니다' : '')
    + (reachedEnd ? '  (끝까지 훑었습니다)' : '')
    + (hitLimit ? '  ★ 새 사람 상한(' + LIMIT + ')에 닿았습니다 — 더 있습니다' : ''));

  /* 이미 담긴 것·차단된 것 먼저 걸러 상세 요청을 줄입니다 */
  const fresh = qids.filter(q => !have.has(q) && !blocked.has(q));
  console.log('  이미 있음 · 차단됨 : ' + (qids.length - fresh.length) + '명');
  console.log('  상세를 받을 것     : ' + fresh.length + '명');
  if (!fresh.length) return { job, add: [], stopped };

  const add = [];
  const why = new Map();
  let dup = 0;

  for (let i = 0; i < fresh.length; i += 150) {
    const part = fresh.slice(i, i + 150);
    let rows;
    try {
      rows = await sparql(detailQuery(part));
    } catch (e) {
      if (isStop(e)) { stopped = true; console.log('  ※ ' + e.message); break; }
      console.log('  · 상세 실패 · 건너뜁니다 (' + String(e.message || '').slice(0, 50) + ')');
      continue;
    }

    for (const b of rows) {
      const qid = qidOf(val(b, 'item'));
      if (!qid) continue;

      /* ★ 같은 번호가 두 번 오면 건너뜁니다.
         SPARQL 을 고쳐 두었지만 안전장치를 하나 더 둡니다. */
      if (have.has(qid)) { dup++; continue; }

      const en = val(b, 'en');
      const ko = val(b, 'ko');
      const nm = ko || en;
      if (!nm) { why.set('이름 없음', (why.get('이름 없음') || 0) + 1); continue; }

      const genres = val(b, 'genres');
      const occs   = val(b, 'occs');

      /* ★ SPARQL 로 걸렀지만 한 번 더 봅니다 — 잣대는 한 곳(classic.mjs)뿐입니다 */
      const c = checkClassic({ wd_genre: genres, wd_occupation: occs });
      why.set(c.why, (why.get(c.why) || 0) + 1);
      if (!c.ok) {
        if (DEBUG) console.log('   [뺌] ' + nm + ' — ' + c.why);
        continue;
      }

      add.push({
        wikidata_id:   qid,
        name_ko:       ko || null,
        name_en:       en || null,
        field:         job.field,
        wd_genre:      genres || null,
        wd_occupation: occs || null,
        wd_links:      Number(val(b, 'sl')) || null,
        life:          lifeOf(val(b, 'birth'), val(b, 'death')),
        hidden:        false
      });
      have.add(qid);   /* 다음 직업에서 겹치지 않게 */
    }
    process.stdout.write('   상세 ' + Math.min(i + 150, fresh.length) + '/' + fresh.length + '\r');
    await sleep(1500);
  }

  console.log('\n── 걸러낸 까닭 ──');
  [...why.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(6) + '  ' + k));
  if (dup) console.log('   ' + String(dup).padStart(6) + '  같은 번호가 두 번 옴(건너뜀)');

  const withKo = add.filter(a => a.name_ko).length;
  console.log('\n  새로 담을 수 있는 것 : ' + add.length + '명 (한국어 이름 ' + withKo + '명)');

  const show = LIST ? add.length : Math.min(15, add.length);
  if (add.length) {
    console.log('  ── ' + (LIST ? '전부' : '표본 ' + show + '명') + ' ──');
    add.slice(0, show).forEach((a, i) => {
      console.log('    ' + String(i + 1).padStart(4) + '. '
        + (a.name_ko || a.name_en) + '  [' + a.field + ']'
        + (a.life ? ' ' + a.life : '')
        + '  ' + String(a.wd_genre || '').slice(0, 40));
    });
  }

  return { job, add, stopped, hitLimit };
}

/* ── 담기 ───────────────────────────────────────────────
   ★ 200개 묶음에 하나만 걸려도 전체가 거부됩니다.
     그래서 거부되면 한 건씩 다시 넣습니다. */
async function save(rows) {
  let ok = 0, ng = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50);
    try {
      await rest('persons', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
        body: JSON.stringify(part)
      });
      ok += part.length;
    } catch (e) {
      for (const one of part) {
        try {
          await rest('persons', {
            method: 'POST',
            headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
            body: JSON.stringify([one])
          });
          ok++;
        } catch (e2) {
          ng++;
          if (ng <= 15) {
            console.log('   [실패] ' + (one.name_ko || one.name_en)
              + ' — ' + String(e2.message || '').slice(0, 90));
          }
        }
      }
    }
    process.stdout.write('   담는 중 ' + ok + '/' + rows.length + '\r');
  }
  console.log('   담기 끝 · 성공 ' + ok + '명 · 실패 ' + ng + '명        ');
  return ok;
}

/* ── 본체 ───────────────────────────────────────────────── */
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  인물 수집 (새 잣대 · 문서 수 문턱 없음)             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(SAVE ? '\n★ 실제로 담습니다 (--save)\n'
                   : '\n※ 담지 않고 무엇이 올지만 봅니다.\n');

  await verify();

  console.log('\n── 지금 있는 것 ──');
  const rows = await getAll('persons?select=wikidata_id&wikidata_id=not.is.null&order=id.asc');
  const have = new Set(rows.map(r => String(r.wikidata_id).trim()));
  console.log('   인물DB : ' + rows.length + '명 (위키데이터 번호 보유)        ');

  let blocked = new Set();
  try {
    const b = await getAll('blocklist?select=wikidata_id&order=wikidata_id.asc');
    blocked = new Set(b.map(r => String(r.wikidata_id).trim()));
    console.log('   차단 목록 : ' + blocked.size + '건');
  } catch (e) {
    console.log('   차단 목록을 읽지 못했습니다 · 걸러내지 않고 이어갑니다');
  }

  const jobs = ONEJOB ? JOBS.filter(j => j.qid === ONEJOB) : JOBS;
  if (!jobs.length) {
    console.error('그런 직업 번호가 없습니다 : ' + ONEJOB);
    process.exit(1);
  }

  const results = [];
  for (const j of jobs) results.push(await runJob(j, have, blocked));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  마무리                                              ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  let total = 0, anyStopped = false;
  for (const r of results) {
    if (r.add.length || r.stopped) {
      console.log('   ' + r.job.en.padEnd(18) + String(r.add.length).padStart(6) + '명'
        + (r.stopped ? '   ※ 중간에 멈춤' : ''));
    }
    total += r.add.length;
    if (r.stopped) anyStopped = true;
  }
  console.log('   ' + '─'.repeat(30));
  console.log('   ' + '모두'.padEnd(18) + String(total).padStart(6) + '명');

  if (anyStopped) {
    console.log('\n※ 위키데이터가 속도 제한을 걸어 다 받지 못했습니다.');
    console.log('  20~30분 뒤에 다시 돌리시면 이어서 받습니다.');
  }
  const over = results.filter(r => r.hitLimit);
  if (over.length) {
    console.log('\n★ 새 사람 상한(' + LIMIT + ')에 닿은 직업이 ' + over.length + '가지 있습니다 —');
    console.log('  ' + over.map(r => r.job.en).join(' · '));
    console.log('  이 직업들은 아직 더 남아 있습니다.');
    console.log('  담으신 뒤 같은 설정으로 다시 돌리면 이어서 받습니다');
    console.log('  (담은 사람은 「이미 있음」이 되어 자리를 차지하지 않으므로');
    console.log('   다음에는 그 뒤쪽을 훑습니다).');
  }

  if (!SAVE) {
    console.log('\n※ 아무것도 담지 않았습니다.');
    console.log('  ' + total + '명을 담으시려면 --save 를 주십시오.');
    return;
  }
  if (!total) { console.log('\n담을 것이 없습니다.'); return; }

  for (const r of results) {
    if (!r.add.length) continue;
    console.log('\n── ' + r.job.en + ' 담기 ──');
    await save(r.add);
  }

  console.log('\n끝났습니다.');
  console.log('※ 새로 담은 사람은 소개문·사진이 아직 비어 있습니다.');
  console.log('  「인물 보강」(enrich-persons) 과 「사진 채우기」를 이어서 돌려 주십시오.');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
