/* ============================================================
   OPUSCLAM 인물 생몰일 모으기 — scripts/birthdate-collect.mjs
   ------------------------------------------------------------
   2026-08-16

   무엇을 하나
     위키데이터에서 인물의 <b>태어난 날·죽은 날</b>을 받아
     persons.birth_date · death_date 에 담습니다.

   ★ 왜 따로 만드나
     enrich-persons.mjs 가 이미 P569/P570 을 받고 있는데,
     <b>연도 넉 자만</b> 뽑아 쓰고 나머지를 버렸습니다(yr 함수).
     그 수집기는 여러 가지를 한꺼번에 다뤄 무겁고, 이미 훑은 인물은
     다시 안 봅니다(wd_checked_at). 그래서 <b>생몰일만</b> 받는
     가벼운 수집기를 따로 둡니다.

   ★ 무엇에 쓰나
       · 「오늘의 클래식」 — 오늘이 생일인 음악가
       · 인물 상세에 정확한 생몰
       · 한국 클래식 연표
     하나만 보고 하는 것이 아니라 <b>기본 정보</b>입니다.

   ★ life 는 건드리지 않습니다
     화면 여러 곳이 그것을 읽고 있습니다. 새 칸에만 담고,
     화면이 그쪽을 먼저 보게 하면 됩니다.

   ★ 한 번에 정해진 만큼만
     위키데이터에 한꺼번에 많이 물으면 거절당합니다.
     기본 2,000명씩, 다시 돌리면 이어서 합니다.

   환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_KEY

   쓰는 법
     node scripts/birthdate-collect.mjs                 2,000명
     node scripts/birthdate-collect.mjs --limit=5000    5,000명
     node scripts/birthdate-collect.mjs --dry           담지 않고 보기만
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const LIMIT = Number(args.limit || 2000);
const DRY   = !!args.dry;

const UA    = 'OpusclamBirthBot/1.0 (https://opusclam.com)';
const SPARQL_URL = 'https://query.wikidata.org/sparql';
const CH = 250;                 /* 한 번에 물어볼 인물 수 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   Supabase
   ============================================================ */
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

/* ============================================================
   위키데이터
   ============================================================ */
async function sparql(query) {
  const res = await fetch(SPARQL_URL + '?query=' + encodeURIComponent(query), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  const j = await res.json();
  return (j.results && j.results.bindings) || [];
}

const val   = (b, k) => (b[k] && b[k].value) || '';
const qidOf = (u) => String(u || '').replace(/^.*\//, '');

/* ★ 위키데이터는 「1810-03-01T00:00:00Z」 꼴로 줍니다.
     ─────────────────────────────────────────────────────
     ★ 조심할 것 —
       · 「1810-00-00」처럼 <b>월·일이 0</b>인 것이 있습니다.
         연도만 아는 경우인데, 날짜로 담으면 오류가 납니다.
       · 기원전(-0500-01-01)은 <b>담지 않습니다.</b> 클래식 음악가에
         해당이 없고, 날짜 칸이 다루지 못합니다.
       · 「율리우스력」으로 적힌 옛 인물이 있습니다. 그대로 담습니다 —
         고쳐 적으면 위키백과와 어긋나 오히려 헷갈립니다. */
function toDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (mo === '00' || d === '00') return null;      /* 월·일을 모르는 것 */
  const yy = parseInt(y, 10);
  if (yy < 1000 || yy > 2100) return null;         /* 너무 옛날·앞날은 뺍니다 */
  return `${y}-${mo}-${d}`;
}

function query(qids) {
  const vs = qids.map((q) => 'wd:' + q).join(' ');
  return `
SELECT ?item ?birth ?death WHERE {
  VALUES ?item { ${vs} }
  OPTIONAL { ?item wdt:P569 ?birth }
  OPTIONAL { ?item wdt:P570 ?death }
}`;
}

/* ============================================================
   실행
   ============================================================ */
(async () => {
  console.log('══ 인물 생몰일 모으기 ══');
  console.log(DRY ? '   담지 않고 봅니다 (--dry)' : `   한 번에 ${LIMIT}명까지`);
  console.log('');

  /* 아직 안 채운 인물 — 위키데이터 번호가 있어야 물어볼 수 있습니다.
     ★ Supabase 는 한 번에 200줄까지만 줍니다. Range 로 나눠 받습니다. */
  const todo = [];
  for (let from = 0; from < LIMIT; from += 200) {
    const to = Math.min(from + 199, LIMIT - 1);
    const part = await fetch(SB_URL + '/rest/v1/persons?select=id,wikidata_id,name_ko,name_en'
      + '&wikidata_id=not.is.null&birth_date=is.null'
      + '&order=id.asc', {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${from}-${to}` },
    }).then((r) => (r.ok ? r.json() : []));
    if (!part || !part.length) break;
    todo.push(...part);
    if (part.length < to - from + 1) break;
  }

  if (!todo.length) {
    console.log('채울 인물이 없습니다. 모두 마쳤습니다.');
    return;
  }
  console.log(`물어볼 인물 ${todo.length}명\n`);

  /* 위키데이터 번호로 찾아오려고 미리 짝지어 둡니다 */
  const byQid = {};
  todo.forEach((p) => { byQid[p.wikidata_id] = p; });

  const rows = [];
  let asked = 0, gotB = 0, gotD = 0, shown = 0;

  for (let i = 0; i < todo.length; i += CH) {
    const part = todo.slice(i, i + CH);
    let res = [];
    try {
      res = await sparql(query(part.map((p) => p.wikidata_id)));
    } catch (e) {
      console.log(`  ★ ${i}~${i + part.length} 묶음을 받지 못했습니다 — ${e.message}`);
      await sleep(2000);
      continue;
    }
    asked += part.length;
    await sleep(900);      /* 위키데이터에 부담을 주지 않으려고 */

    res.forEach((b) => {
      const qid = qidOf(val(b, 'item'));
      const p = byQid[qid];
      if (!p) return;
      const bd = toDate(val(b, 'birth'));
      const dd = toDate(val(b, 'death'));
      if (!bd && !dd) return;

      const row = { id: p.id };
      if (bd) { row.birth_date = bd; gotB++; }
      if (dd) { row.death_date = dd; gotD++; }
      rows.push(row);

      if (shown < 8) {
        shown++;
        console.log(`  ${(p.name_ko || p.name_en || '').slice(0, 20).padEnd(22)}`
          + `${bd || '—'}${dd ? ' ~ ' + dd : ''}`);
      }
    });

    if ((i / CH) % 4 === 3) {
      console.log(`  … ${asked}명 물어봄 · ${rows.length}명 찾음`);
    }
  }

  console.log('');
  console.log(`=== 물어봄 ${asked}명 · 찾음 ${rows.length}명`
    + ` (태어난날 ${gotB} · 죽은날 ${gotD}) ===`);

  if (DRY) { console.log('\n담지 않았습니다 (--dry)'); return; }
  if (!rows.length) return;

  /* 담기 — 200개씩 나눠
     ★ 한 묶음이 실패해도 나머지는 담습니다. */
  let saved = 0, lost = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    try {
      await sb('persons?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(part),
      });
      saved += part.length;
    } catch (e) {
      lost += part.length;
      console.log(`    ★ ${part.length}명을 담지 못했습니다 — ${String(e.message).slice(0, 90)}`);
    }
  }
  console.log(`    담음 ${saved}명` + (lost ? ` · 못 담음 ${lost}명` : ''));

  /* 얼마나 남았나 */
  const left = await fetch(SB_URL + '/rest/v1/persons?select=id'
    + '&wikidata_id=not.is.null&birth_date=is.null', {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
               Prefer: 'count=exact', Range: '0-0' },
  }).then((r) => {
    const cr = r.headers.get('content-range') || '';
    return parseInt((cr.split('/')[1] || '0'), 10) || 0;
  }).catch(() => -1);

  if (left >= 0) {
    console.log(`\n▶ 남은 인물 ${left}명`
      + (left ? ' — 다시 돌리시면 이어서 합니다' : ' — 모두 마쳤습니다'));
  }
})().catch((e) => { console.error('■ 실패:', e); process.exit(1); });
