// ============================================================
// OPUSCLAM 공연장(venues) — KOPIS(공연예술통합전산망) 수집기
//  - 소스: KOPIS 오픈API (국내 공연시설 = 정부 공식 실데이터)
//  - 목록(prfplc) + 상세(prfplc/{id}): 좌석·주소·홈페이지·전화·개관연도 등
//  - 원칙: 신규추가 / 빈칸만 보강 / 사람값 보호, 이름·kopis_id 중복방지
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, KOPIS_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const KOPIS_KEY    = process.env.KOPIS_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
if (!KOPIS_KEY) { console.error('환경변수 필요: KOPIS_KEY (data.go.kr 일반 인증키 Decoding)'); process.exit(1); }

const KOPIS_BASE = 'http://www.kopis.or.kr/openApi/restful/prfplc';
const UA = 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '').trim();

// --- 아주 단순한 XML 파서 (KOPIS 응답 구조가 단순) ---
function blocks(xml, tag) {
  const re = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'g');
  const out = []; let m; while ((m = re.exec(xml))) out.push(m[1]); return out;
}
function tagv(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}

async function kget(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      if (!r.ok) throw new Error('KOPIS ' + r.status);
      return await r.text();
    } catch (e) { if (i === tries - 1) throw e; await sleep(2000 * (i + 1)); }
  }
  return '';
}

// 목록 전체 페이지 수집
async function fetchList() {
  const svc = encodeURIComponent(KOPIS_KEY);
  const rows = 100; let cpage = 1; const all = [];
  while (cpage <= 100) {
    const url = KOPIS_BASE + '?service=' + svc + '&cpage=' + cpage + '&rows=' + rows;
    const xml = await kget(url);
    const dbs = blocks(xml, 'db');
    if (!dbs.length) break;
    for (const b of dbs) {
      all.push({
        kopis_id: tagv(b, 'mt10id'),
        name_ko: tagv(b, 'fcltynm'),
        type: tagv(b, 'fcltychartr'),
        sido: tagv(b, 'sidonm'),
        gugun: tagv(b, 'gugunnm'),
        opened: tagv(b, 'opende'),
      });
    }
    console.log('  · 목록 페이지', cpage, '→ 누적', all.length);
    if (dbs.length < rows) break;
    cpage++; await sleep(120);
  }
  return all;
}

// 상세 조회 (좌석·주소·홈페이지 등)
async function fetchDetail(mt10id) {
  const svc = encodeURIComponent(KOPIS_KEY);
  const url = KOPIS_BASE + '/' + encodeURIComponent(mt10id) + '?service=' + svc + '&newsql=Y';
  const xml = await kget(url);
  const b = (blocks(xml, 'db')[0]) || '';
  if (!b) return {};
  const seat = tagv(b, 'seatscale');
  return {
    seats: seat ? (parseInt(seat.replace(/[^0-9]/g, ''), 10) || 0) : 0,
    adres: tagv(b, 'adres'),
    telno: tagv(b, 'telno'),
    relateurl: tagv(b, 'relateurl'),
  };
}

const H = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select, { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json(); out.push(...batch);
    if (batch.length < STEP) break; from += STEP;
  }
  return out;
}
async function sbInsert(rows) { if (!rows.length) return; const r = await fetch(SUPABASE_URL + '/rest/v1/venues', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows) }); if (!r.ok) throw new Error('INSERT ' + r.status + ' ' + await r.text()); }
async function sbUpdate(id, patch) { const r = await fetch(SUPABASE_URL + '/rest/v1/venues?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text()); }

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

async function main() {
  console.log('■ KOPIS 공연장 수집 시작', new Date().toISOString());

  // 1) 목록
  const list = await fetchList();
  console.log('■ KOPIS 공연시설 목록:', list.length, '곳');

  // 2) 기존 venues 로드
  const existing = await sbGetAll('venues', 'id,kopis_id,wikidata_id,name_ko,type,location,opened,seats,operator,link_home,sort_no');
  const byKopis = new Map(); const byName = new Map(); let maxSort = 0;
  for (const r of existing) {
    if (r.kopis_id) byKopis.set(r.kopis_id, r);
    if (r.name_ko) byName.set(norm(r.name_ko), r);
    if (typeof r.sort_no === 'number' && r.sort_no > maxSort) maxSort = r.sort_no;
  }
  console.log('■ 기존 venues:', existing.length, '행');

  // 3) 상세 보강 + 병합
  let inserted = 0, updated = 0, skipped = 0, detailErr = 0;
  const toIns = [];
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (!v.name_ko || !v.kopis_id) continue;
    let d = {};
    try { d = await fetchDetail(v.kopis_id); } catch (e) { detailErr++; }
    await sleep(120);

    const location = d.adres || [v.sido, v.gugun].filter(Boolean).join(' ');
    const seats = d.seats && d.seats > 0 ? d.seats.toLocaleString('en-US') + '석' : '';
    const link_home = d.relateurl || '';
    const row = {
      kopis_id: v.kopis_id, name_ko: v.name_ko,
      type: v.type || '', location, opened: v.opened || '', seats, link_home,
    };

    const match = byKopis.get(v.kopis_id) || byName.get(norm(v.name_ko));
    if (match) {
      const patch = {};
      if (isEmpty(match.kopis_id)) patch.kopis_id = v.kopis_id;
      for (const k of ['type', 'location', 'opened', 'seats', 'link_home']) {
        if (isEmpty(match[k]) && !isEmpty(row[k])) patch[k] = row[k];
      }
      if (Object.keys(patch).length) { await sbUpdate(match.id, patch); updated++; } else skipped++;
    } else {
      row.source = 'kopis'; row.sort_no = ++maxSort;
      toIns.push(row); byName.set(norm(v.name_ko), row);
    }
    if ((i + 1) % 200 === 0) console.log('  · 진행', i + 1, '/', list.length, '(신규', toIns.length, '보강', updated, ')');
  }
  for (let i = 0; i < toIns.length; i += 100) await sbInsert(toIns.slice(i, i + 100));

  console.log('■ 완료 — 신규추가:', toIns.length, '· 빈칸보강:', updated, '· 변경없음:', skipped, '· 상세오류:', detailErr);
}
main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
