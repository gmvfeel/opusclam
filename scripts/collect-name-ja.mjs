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

const getJSON = makeGetJSON({ ua: 'OPUSCLAM/1.0 (name_ja collector; cser@wixon.co.kr)' });

/* ── Supabase 읽기 (200줄 서버 캡이 있어 나누어 받습니다) ────── */
/* ── Supabase 읽기 ────────────────────────────────────────────
   ★★ 여기서 크게 잘못했었습니다 (2026-08-10 · 첫 실행에서 드러남) ★★
     STEP 을 1000 으로 두고 「1000개보다 적게 오면 끝」 이라 보았습니다.
     그런데 Supabase 는 <b>한 번에 200줄까지만</b> 돌려줍니다.
     그래서 첫 번째로 200줄을 받고 200 < 1000 이므로 「다 받았다」 고
     판단해 <b>표마다 200줄에서 멈췄습니다.</b>
     인물 15,248명 가운데 200명만 본 것입니다.

   ▶ 서버가 자르는 크기와 <b>같은 크기로</b> 달라고 해야 합니다.
     그리고 「받은 만큼」 앞으로 갑니다 — 서버가 더 적게 주더라도
     자리를 건너뛰지 않습니다.

   ※ 인계 문서에 「Supabase 200행 서버 캡 → .range() 루프 필요」 라고
     적혀 있었는데, 새 수집기를 쓰면서 그대로 되풀이했습니다. */
const PAGE = 200;          // 서버가 잘라 주는 크기

async function getAll(path) {
  let from = 0, out = [];
  for (;;) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers: { ...H, Range: from + '-' + (from + PAGE - 1) }
    });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const rows = await r.json();
    if (!rows.length) break;
    out = out.concat(rows);
    if (rows.length < PAGE) break;   // 마지막 쪽
    from += rows.length;             // ★ 받은 만큼만 앞으로
    if (out.length > 200000) break;  // 끝없이 도는 것을 막는 안전장치
  }
  return out;
}

async function patch(table, id, body) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('PATCH ' + r.status + ' ' + await r.text());
}

/* ── 위키데이터에서 일본어 이름 받기 ────────────────────────────
   ★★ SPARQL 을 버리고 <b>라벨 API</b> 로 바꿨습니다 (2026-08-10) ★★
     처음에는 SPARQL 로 200개씩 물었습니다. 그런데 7,200개쯤에서
     위키데이터가 <b>「2분 뒤에 오라」(HTTP 429)</b> 며 문을 닫았습니다.
     SPARQL 은 무거운 질의라 한도가 빡빡합니다.
     우리가 필요한 것은 <b>이름 한 줄</b>뿐이니 SPARQL 은 과했습니다.

   ▶ wbgetentities 는 이름만 돌려주는 가벼운 창구입니다.
     한 번에 50개까지 물을 수 있고 한도가 훨씬 넉넉합니다.

   ★ 이 함수는 <b>50개씩만</b> 받아 돌려줍니다.
     바깥에서 받는 대로 곧바로 담습니다 — 아래 ② 를 보십시오. */
const API = 'https://www.wikidata.org/w/api.php';

async function labelsJaChunk(qids) {
  const out = new Map();
  if (!qids.length) return out;
  const url = API + '?action=wbgetentities&format=json&props=labels&languages=ja'
            + '&ids=' + qids.join('|');
  const j = await getJSON(url);
  const ents = j && j.entities;
  if (!ents) return out;
  for (const qid in ents) {
    const lab = ents[qid] && ents[qid].labels && ents[qid].labels.ja;
    const ja = lab && String(lab.value || '').trim();
    if (ja) out.set(qid, ja);
  }
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

  /* ★★ 받는 대로 <b>곧바로 담습니다</b> ★★
     예전에는 「전부 받은 뒤에」 담았습니다. 그래서 7,200개를 받아 놓고도
     위키데이터가 문을 닫자 <b>하나도 담지 못한 채 끝났습니다</b>
     — 로그에 「받은 것 0개 · 담은 것 0개」 라고 찍혔습니다
     (2026-08-10 · 파트너가 로그로 찾음).
     ▶ 50개 받으면 50개 담습니다. 중간에 멈춰도 <b>거기까지는 남습니다.</b>
     ▶ 다음 실행은 name_ja 가 빈 줄만 읽으므로 저절로 이어집니다. */
  const CH = 50;
  const byQid = new Map();
  for (const r of rows) {
    const q = String(r.wikidata_id || '').trim();
    if (!q) continue;
    if (!byQid.has(q)) byQid.set(q, []);
    byQid.get(q).push(r);
  }
  const qids = [...byQid.keys()];

  let got = 0, saved = 0, skipped = 0, stopped = false;
  const show = [];

  for (let i = 0; i < qids.length; i += CH) {
    const part = qids.slice(i, i + CH);
    let labels;
    try {
      labels = await labelsJaChunk(part);
    } catch (e) {
      if (isStop(e)) {
        console.log('\n   위키데이터가 잠시 문을 닫았습니다 — 여기까지 담고 멈춥니다.');
        stopped = true; break;
      }
      console.log('   한 묶음 실패 — 건너뜁니다 (' + String(e).slice(0, 50) + ')');
      continue;
    }

    /* 받은 것을 곧바로 담습니다 (여섯 개씩 함께) */
    const todo = [];
    for (const [q, rs] of byQid) {
      if (!labels.has(q)) continue;
      const ja = labels.get(q);
      for (const r of rs) {
        if (!usable(ja, r)) { skipped++; continue; }
        got++;
        if (show.length < 8) show.push([r.name_ko || r.name_en || '(이름 없음)', ja]);
        todo.push([r.id, ja]);
      }
      labels.delete(q);
    }
    if (SAVE && todo.length) {
      const LANE = 6;
      for (let k = 0; k < todo.length; k += LANE) {
        await Promise.all(todo.slice(k, k + LANE).map(async ([id, ja]) => {
          try { await patch(table, id, { name_ja: ja }); saved++; }
          catch (e) { console.log('   담기 실패 id=' + id + ' ' + String(e).slice(0, 50)); }
        }));
      }
    }

    if ((i / CH) % 20 === 0 || i + CH >= qids.length) {
      process.stdout.write('   ' + Math.min(i + CH, qids.length) + '/' + qids.length +
                           ' · 담은 것 ' + saved + '\r');
    }
    /* 라벨 창구는 가벼워서 이 정도면 넉넉합니다.
       그래도 위키데이터가 문을 닫으면 담은 것까지 남기고 곱게 멈춥니다. */
    await sleep(120);
  }
  process.stdout.write('\n');

  console.log(' 받은 일본어 이름 ' + got + '개' +
              (skipped ? ' (영문과 같거나 일본 글자가 없어 거른 것 ' + skipped + '개)' : ''));
  for (const [a, b] of show) console.log('    ' + a + '  →  ' + b);
  if (SAVE) console.log(' 담았습니다: ' + saved + '개');
  if (stopped) console.log(' ※ 위키데이터가 문을 닫아 여기까지입니다 —'
                         + ' 다음 실행에서 남은 것을 이어받습니다.');
  return { got, saved, stopped };
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
      if (r.stopped) {
        console.log('\n★ 위키데이터가 문을 닫아 여기서 멈춥니다.'
                  + ' 담은 것은 그대로 남습니다 — 다음 실행에서 이어받습니다.');
        break;
      }
    } catch (e) {
      if (isStop(e)) { console.log('\n★ 위키데이터가 잠시 받지 않습니다 — 여기서 멈춥니다.'); break; }
      console.log('\n' + t + ' 처리 중 문제 — 건너뜁니다: ' + String(e).slice(0, 80));
    }
  }
  console.log('\n────────────────────────────────────────────');
  console.log(' 받은 것 ' + tg + '개' + (SAVE ? ' · 담은 것 ' + ts + '개' : ' (담지 않았습니다)'));
  if (!SAVE && tg) console.log(' 실제로 담으려면:  node scripts/collect-name-ja.mjs --save');
})();
