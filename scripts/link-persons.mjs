// ============================================================
// OPUSCLAM 인물 관계(entity_links) 자동 연결기 (v1)
// 원칙: 사람이 넣은 관계는 절대 건드리지 않는다
//  - 위키데이터: 사사(P1066) · 제자(P802) · 소속(P463) · 출신학교(P69)
//  - 단체DB · 학교DB 에 있으면 링크(to_id), 없으면 이름만(to_label + to_ref)
//    → 나중에 그 항목이 DB에 생기면 to_ref(위키데이터 ID)로 정확히 승격 가능
//  - 소속 중 단체DB 에 없는 것은 fellow_of(관련 단체·학회)로 분리
//  - source='wikidata' 인 관계만 지우고 다시 채웁니다
//    source='admin' (관리자·회원이 넣은 관계) 은 보존됩니다
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, (선택) BATCH_LIMIT
// ============================================================

import { readJson } from './lib/json.mjs';

const VERSION      = 'v1.0';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const UA        = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const CH_SPARQL = 150;   // 위키데이터 배치
const CH_INSERT = 500;   // 저장 배치
const NAME_KEYS = ['name_ko', 'name', 'name_kr', 'title', 'org_name', 'school_name', 'name_en'];
const WD_RELS   = ['teacher', 'student', 'member_of', 'fellow_of', 'alumnus_of'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const val   = (b, k) => (b[k] && b[k].value) ? b[k].value : '';
const qidOf = (u) => u ? String(u).split('/').pop() : '';
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

function norm(s) {
  if (s === null || s === undefined) return '';
  let t = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase();
  return t.replace(/[^a-z0-9가-힣]/g, '');
}

/* ---------- Supabase (REST) ---------- */
const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
async function sbGetAll(table, select, filter, maxRows) {
  const out = []; const STEP = 1000; let from = 0;
  const cap = (maxRows === undefined || maxRows === null) ? 200000 : maxRows;
  if (cap <= 0) return out;
  while (out.length < cap) {
    const take = Math.min(STEP, cap - out.length);
    const url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (filter || '') + orderFor(table);
    const r = await fetch(url, { headers: { ...H, Range: from + '-' + (from + take - 1) } });
    if (!r.ok) {
      const body = await r.text();
      console.error('  ✗ 조회 실패 ' + r.status);
      console.error('    URL : ' + url);
      console.error('    응답: ' + body.slice(0, 300));
      throw new Error('GET ' + r.status);
    }
    const batch = await readJson(r); out.push(...batch);
    if (!batch.length) break;              // 더 없으면 끝
    from += batch.length;                 // ★ 받은 만큼만 나아갑니다
  }
  return out;
}
async function sbProbe(table) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=*&limit=1', { headers: H });
  if (!r.ok) { console.log('  ⚠ ' + table + ' 조회 불가 (' + r.status + ') — 이름만 저장합니다'); return null; }
  const rows = await readJson(r);
  if (!rows.length) { console.log('  ⚠ ' + table + ' 가 비어 있습니다'); return []; }
  return Object.keys(rows[0]);
}
async function sbDelete(path) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path,
    { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  if (!r.ok) throw new Error('DELETE ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
async function sbInsert(table, rows) {
  if (!rows.length) return 0;
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table,
    { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) { console.log('    (저장 오류, 계속):', r.status, (await r.text()).slice(0, 200)); return 0; }
  return rows.length;
}

/* ---------- 위키데이터 ---------- */
async function sparql(query, tries = 3) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
      if (res.status === 429 || res.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('SPARQL ' + res.status);
      return (await readJson(res)).results.bindings;
    } catch (e) { if (i === tries - 1) { console.log('    (SPARQL 배치 오류, 계속):', e.message); return []; } await sleep(3000 * (i + 1)); }
  }
  return [];
}
// 사사 · 제자 · 소속 · 출신학교를 한 번에 (요청 수를 4분의 1로)
function relQuery(qids) {
  const vs = qids.map(q => 'wd:' + q).join(' ');
  return 'SELECT ?item ?val ?rel WHERE { VALUES ?item { ' + vs + ' } '
    + '{ ?item wdt:P1066 ?val . BIND("teacher" AS ?rel) } UNION '
    + '{ ?item wdt:P802  ?val . BIND("student" AS ?rel) } UNION '
    + '{ ?item wdt:P463  ?val . BIND("member"  AS ?rel) } UNION '
    + '{ ?item wdt:P69   ?val . BIND("school"  AS ?rel) } }';
}
// DB에 없는 상대의 이름 (한국어 우선)
async function fetchLabels(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += CH_SPARQL) {
    const vs = ids.slice(i, i + CH_SPARQL).map(q => 'wd:' + q).join(' ');
    const q = 'SELECT ?item ?ko ?en WHERE { VALUES ?item { ' + vs + ' } '
      + 'OPTIONAL { ?item rdfs:label ?ko FILTER(LANG(?ko)="ko") } '
      + 'OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en)="en") } }';
    const rows = await sparql(q);
    rows.forEach(b => {
      const id = qidOf(val(b, 'item'));
      out[id] = val(b, 'ko') || val(b, 'en') || '';
    });
    console.log('    이름 조회 ' + Math.min(i + CH_SPARQL, ids.length) + '/' + ids.length);
    await sleep(1000);
  }
  return out;
}

/* ---------- 본체 ---------- */
async function main() {
  console.log('■ 인물 관계 연결 시작 [' + VERSION + ']', new Date().toISOString());

  // 1) 인물 · 단체 · 학교 로드
  const persons = await sbGetAll('persons', 'id,wikidata_id,hidden');
  const byQid = new Map();
  persons.forEach(p => { if (p.wikidata_id) byQid.set(p.wikidata_id, p); });
  const srcQids = persons.filter(p => p.wikidata_id && p.hidden === false).map(p => p.wikidata_id);
  console.log('  · 인물', persons.length, '명 · 위키데이터ID 보유(표시중)', srcQids.length);

  // 단체 · 학교는 컬럼명을 실행 시점에 파악합니다
  const idx = {};
  for (const [kind, table] of [['org', 'orgs'], ['school', 'schools']]) {
    const cols = await sbProbe(table);
    if (!cols) { idx[kind] = null; continue; }
    const nameCols = NAME_KEYS.filter(c => cols.indexOf(c) >= 0);
    const hasQid = cols.indexOf('wikidata_id') >= 0;
    const sel = ['id'].concat(nameCols).concat(hasQid ? ['wikidata_id'] : []).join(',');
    const rows = await sbGetAll(table, sel);
    const byQ = {}, byName = {};
    rows.forEach(r => {
      if (hasQid && r.wikidata_id) byQ[r.wikidata_id] = r;
      nameCols.forEach(c => { const n = norm(r[c]); if (n && !byName[n]) byName[n] = r; });
    });
    idx[kind] = { byQ, byName, hasQid };
    console.log('  · ' + table, rows.length, '건 · 이름컬럼 [' + nameCols.join(', ') + ']'
      + (hasQid ? ' · 위키데이터ID 있음' : ' · 위키데이터ID 없음'));
  }

  if (!srcQids.length) { console.log('■ 대상이 없습니다. 종료'); return; }

  // 2) 위키데이터에서 관계 조회
  console.log('■ 위키데이터 관계 조회 (' + srcQids.length + '건)');
  const found = new Set();   // "출발QID>도착QID>종류"
  for (let i = 0; i < srcQids.length; i += CH_SPARQL) {
    const rows = await sparql(relQuery(srcQids.slice(i, i + CH_SPARQL)));
    rows.forEach(b => {
      const a = qidOf(val(b, 'item')), v = qidOf(val(b, 'val')), k = val(b, 'rel');
      if (a && v && a !== v) found.add(a + '>' + v + '>' + k);
    });
    console.log('  · ' + Math.min(i + CH_SPARQL, srcQids.length) + '/' + srcQids.length
      + ' · 누적 관계 ' + found.size);
    await sleep(1200);
  }
  const keys = [...found];
  if (!keys.length) { console.log('■ 찾은 관계가 없습니다. 종료'); return; }

  // 3) DB에 없는 상대의 이름 확보
  const unknown = new Set();
  keys.forEach(k => {
    const [a, v, kind] = k.split('>');
    if (kind === 'teacher' || kind === 'student') { if (!byQid.has(v)) unknown.add(v); if (!byQid.has(a)) unknown.add(a); }
    else {
      const x = idx[kind === 'member' ? 'org' : 'school'];
      const hit = x && x.hasQid && x.byQ[v];
      if (!hit) unknown.add(v);          // 이름 대조·표시를 위해 필요
    }
  });
  console.log('■ DB에 없는 상대 이름 조회 (' + unknown.size + '건)');
  const labels = unknown.size ? await fetchLabels([...unknown]) : {};

  // 4) 관계 행 만들기
  const rows = [], seen = new Set();
  const stat = { teacher: 0, student: 0, member_of: 0, fellow_of: 0, alumnus_of: 0, skipped: 0 };
  function push(fromP, rel, toType, toId, toLabel, toRef, conf) {
    if (!toId && !toLabel) { stat.skipped++; return; }
    const uk = fromP.id + '|' + rel + '|' + toType + '|' + (toId || '') + '|' + (toLabel || '');
    if (seen.has(uk)) return;
    seen.add(uk);
    rows.push({
      from_type: 'person', from_id: fromP.id, rel,
      to_type: toType, to_id: toId || null, to_label: toId ? null : toLabel,
      to_ref: toRef || null, source: 'wikidata', confidence: conf
    });
    stat[rel]++;
  }

  keys.forEach(k => {
    const [aQ, vQ, kind] = k.split('>');
    const aP = byQid.get(aQ);

    if (kind === 'teacher' || kind === 'student') {
      // P1066: item 이 val 에게 배움 / P802: item 의 제자가 val
      const studentQ = (kind === 'teacher') ? aQ : vQ;
      const teacherQ = (kind === 'teacher') ? vQ : aQ;
      const sP = byQid.get(studentQ), tP = byQid.get(teacherQ);
      if (sP && sP.hidden === false) {
        push(sP, 'teacher', 'person', tP ? tP.id : null,
             tP ? null : (labels[teacherQ] || ''), teacherQ, tP ? 100 : 70);
      }
      if (tP && tP.hidden === false) {
        push(tP, 'student', 'person', sP ? sP.id : null,
             sP ? null : (labels[studentQ] || ''), studentQ, sP ? 100 : 70);
      }
      return;
    }

    if (!aP || aP.hidden !== false) return;
    const isOrg = (kind === 'member');
    const x = idx[isOrg ? 'org' : 'school'];
    const nm = labels[vQ] || '';
    let hit = null;
    if (x) {
      if (x.hasQid && x.byQ[vQ]) hit = x.byQ[vQ];
      if (!hit && nm) hit = x.byName[norm(nm)] || null;
    }
    if (isOrg) {
      // 단체DB에 있으면 소속, 없으면 학회·아카데미로 분리
      if (hit) push(aP, 'member_of', 'org', hit.id, null, vQ, x.hasQid && x.byQ[vQ] ? 100 : 70);
      else     push(aP, 'fellow_of', 'org', null, nm, vQ, 50);
    } else {
      push(aP, 'alumnus_of', 'school', hit ? hit.id : null, hit ? null : nm, vQ,
           hit ? (x.hasQid && x.byQ[vQ] ? 100 : 70) : 50);
    }
  });

  console.log('■ 만든 관계:', rows.length, '건');
  console.log('  · 스승', stat.teacher, '· 제자', stat.student,
              '· 소속', stat.member_of, '· 학회', stat.fellow_of, '· 출신학교', stat.alumnus_of);
  if (stat.skipped) console.log('  · 이름을 못 찾아 건너뜀', stat.skipped);

  // 5) 위키데이터에서 온 관계만 교체 (사람이 넣은 관계는 보존)
  console.log('■ 기존 위키데이터 관계 삭제');
  await sbDelete('entity_links?source=eq.wikidata&rel=in.(' + WD_RELS.join(',') + ')');

  console.log('■ 저장');
  let ok = 0;
  for (let i = 0; i < rows.length; i += CH_INSERT) {
    ok += await sbInsert('entity_links', rows.slice(i, i + CH_INSERT));
    if (i % 2500 === 0) console.log('  · ' + Math.min(i + CH_INSERT, rows.length) + '/' + rows.length);
  }
  console.log('■ 저장 완료 —', ok, '건');
  console.log('■ 완료', new Date().toISOString());
}
main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
