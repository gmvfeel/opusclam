/* ============================================================
   OPUSCLAM 일본어 이름 채우기 — scripts/collect-name-ja.mjs
   ------------------------------------------------------------
   ★ 무엇을 하는가
     위키데이터에서 <b>일본어 이름(ラベル)</b>을 받아 name_ja 를 채웁니다.
     인물·단체·공연장·학교·현대음악·기관재단 여섯 표가 대상입니다.
     (학술·작품·용어는 위키데이터 고리가 없거나 성격이 달라 뺐습니다)

   ★ 왜 위키데이터인가 — 돈이 들지 않습니다
     기계번역에 맡기면 「진은숙」 이 엉뚱한 소리가 되기 쉽습니다.
     사람 이름과 단체 이름은 <b>정해진 표기</b>가 있고, 위키데이터에
     이미 들어 있습니다. 받아 오면 정확하고 공짜입니다.
       진은숙 → チン・ウンスク      베토벤 → ルートヴィヒ・ヴァン・ベートーヴェン
       예술의전당 → 芸術の殿堂       빈 필하모닉 → ウィーン・フィルハーモニー管弦楽団

   ★ 사람이 손댄 값을 덮지 않습니다
     이미 name_ja 가 채워진 줄은 건드리지 않습니다.
     회원이 보강한 표기를 자동수집이 밀어내면 안 됩니다.
     (2026-08-10 「위키가 소개글을 덮어쓰던 일」 에서 얻은 원칙)

   ★ 한자만 그대로인 것은 담지 않습니다
     위키데이터의 일본어 라벨이 영문 그대로인 일이 있습니다
     (예: "Seoul Arts Center"). 그런 것은 name_en 과 같으므로
     담아 봐야 화면이 달라지지 않고, 오히려 「일본어가 있다」 고
     잘못 알려 영어로 내려가지 못하게 막습니다. → 거릅니다.

   쓰는 법
     node scripts/collect-name-ja.mjs                 무엇이 올지만 봅니다
     node scripts/collect-name-ja.mjs --save          실제로 담습니다
     node scripts/collect-name-ja.mjs --table=persons 한 표만
     node scripts/collect-name-ja.mjs --limit=500     표당 최대

   필요한 환경변수
     SUPABASE_URL · SUPABASE_SERVICE_KEY
   ============================================================ */

import { makeGetJSON, isStop, sleep } from './lib/http.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json'
};

const argv = process.argv.slice(2);
const SAVE  = argv.includes('--save');
const ONE   = (argv.find(a => a.startsWith('--table=')) || '').split('=')[1] || '';
const LIMIT = Number((argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0) || 0;

/* 대상 표 — 위키데이터 고리(wikidata_id)가 있는 것만 */
const TABLES = ['persons', 'orgs', 'venues', 'schools', 'modern_composers', 'foundations'];

const SPARQL = 'https://query.wikidata.org/sparql';
const getJSON = makeGetJSON({ ua: 'OPUSCLAM/1.0 (name_ja collector; cser@wixon.co.kr)' });

/* ── Supabase 읽기 (200줄 서버 캡이 있어 나누어 받습니다) ────── */
async function getAll(path) {
  const STEP = 1000;
  let from = 0, out = [];
  for (;;) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers: { ...H, Range: from + '-' + (from + STEP - 1) }
    });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const rows = await r.json();
    out = out.concat(rows);
    if (rows.length < STEP) break;
    from += STEP;
  }
  return out;
}

async function patch(table, id, body) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('PATCH ' + r.status + ' ' + await r.text());
}

/* ── 위키데이터에서 일본어 라벨 받기 ─────────────────────────
   ★ 한 번에 너무 많이 물으면 시간 초과가 납니다. 200개씩 끊습니다. */
async function labelsJa(qids) {
  const out = new Map();
  const CH = 200;
  for (let i = 0; i < qids.length; i += CH) {
    const part = qids.slice(i, i + CH);
    const vs = part.map(q => 'wd:' + q).join(' ');
    const q = `SELECT ?item (SAMPLE(?jaL) AS ?ja) WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item rdfs:label ?jaL FILTER(lang(?jaL)="ja") }
} GROUP BY ?item`;
    const url = SPARQL + '?format=json&query=' + encodeURIComponent(q);
    let j;
    try {
      j = await getJSON(url);
    } catch (e) {
      if (isStop(e)) throw e;
      console.log('   질의 실패 — 건너뜁니다 (' + String(e).slice(0, 50) + ')');
      continue;
    }
    for (const b of (j?.results?.bindings || [])) {
      const qid = String(b.item?.value || '').split('/').pop();
      const ja  = (b.ja?.value || '').trim();
      if (qid && ja) out.set(qid, ja);
    }
    process.stdout.write('   받는 중 ' + Math.min(i + CH, qids.length) + '/' + qids.length + '\r');
    await sleep(400);
  }
  process.stdout.write('\n');
  return out;
}

/* ── 담을 만한 값인가 ────────────────────────────────────────
   ① 비어 있지 않고
   ② 영문 이름과 같지 않고 (일본어 라벨이 영문 그대로인 일이 있습니다)
   ③ 한국어 이름과도 같지 않고
   ④ 일본 글자(가나·한자)가 하나라도 들어 있을 것
      — 로마자만 있으면 영어와 다를 바 없습니다 */
const JP = /[\u3040-\u30ff\u3400-\u9fff]/;
function usable(ja, row) {
  if (!ja) return false;
  const t = ja.trim();
  if (!t) return false;
  if (t === (row.name_en || '').trim()) return false;
  if (t === (row.name_ko || '').trim()) return false;
  if (!JP.test(t)) return false;
  return true;
}

/* ── 한 표 처리 ─────────────────────────────────────────── */
async function runTable(table) {
  console.log('\n════════════════════════════════════════════');
  console.log(' ' + table);
  console.log('════════════════════════════════════════════');

  let rows;
  try {
    rows = await getAll(table +
      '?select=id,name_ko,name_en,name_ja,wikidata_id' +
      '&wikidata_id=not.is.null&name_ja=is.null&order=id.asc');
  } catch (e) {
    console.log(' 읽지 못했습니다 — 건너뜁니다 (' + String(e).slice(0, 70) + ')');
    return { got: 0, saved: 0 };
  }
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log(' 일본어 이름이 비어 있고 위키 고리가 있는 줄: ' + rows.length);
  if (!rows.length) return { got: 0, saved: 0 };

  const qids = [...new Set(rows.map(r => String(r.wikidata_id).trim()).filter(Boolean))];
  const labels = await labelsJa(qids);

  let got = 0, saved = 0, skipped = 0;
  const show = [];
  for (const r of rows) {
    const ja = labels.get(String(r.wikidata_id).trim());
    if (!usable(ja, r)) { if (ja) skipped++; continue; }
    got++;
    if (show.length < 8) show.push([r.name_ko || r.name_en || '(이름 없음)', ja]);
    if (SAVE) {
      try { await patch(table, r.id, { name_ja: ja }); saved++; }
      catch (e) { console.log('   담기 실패 id=' + r.id + ' ' + String(e).slice(0, 60)); }
    }
  }

  console.log(' 받은 일본어 이름 ' + got + '개' +
              (skipped ? ' (영문과 같거나 일본 글자가 없어 거른 것 ' + skipped + '개)' : ''));
  for (const [a, b] of show) console.log('    ' + a + '  →  ' + b);
  if (SAVE) console.log(' 담았습니다: ' + saved + '개');
  return { got, saved };
}

/* ── 실행 ───────────────────────────────────────────────── */
(async () => {
  const list = ONE ? [ONE] : TABLES;
  if (ONE && !TABLES.includes(ONE)) {
    console.error('다룰 수 있는 표: ' + TABLES.join(' · '));
    process.exit(1);
  }
  console.log(SAVE ? '★ 실제로 담습니다 (--save)' : '살펴만 봅니다 — 담으려면 --save');

  let tg = 0, ts = 0;
  for (const t of list) {
    try {
      const r = await runTable(t);
      tg += r.got; ts += r.saved;
    } catch (e) {
      if (isStop(e)) { console.log('\n★ 위키데이터가 잠시 받지 않습니다 — 여기서 멈춥니다.'); break; }
      console.log('\n' + t + ' 처리 중 문제 — 건너뜁니다: ' + String(e).slice(0, 80));
    }
  }
  console.log('\n────────────────────────────────────────────');
  console.log(' 받은 것 ' + tg + '개' + (SAVE ? ' · 담은 것 ' + ts + '개' : ' (담지 않았습니다)'));
  if (!SAVE && tg) console.log(' 실제로 담으려면:  node scripts/collect-name-ja.mjs --save');
})();
