// ============================================================
// OPUSCLAM 학술 ↔ 인물 주제 연결 (v1)
//
//  논문 제목에 나오는 작곡가 · 연주자를 인물DB 와 잇습니다.
//  그러면 인물 페이지에 '그를 다룬 논문' 이 붙고,
//  논문에서 인물 페이지로 넘어갈 수 있습니다.
//
//  왜 성으로만 맞추는가
//    논문 제목에는 성만 나옵니다 · "Beethoven's compositional process"
//    그래서 인물DB 의 영문명 마지막 낱말을 성으로 보고 대조합니다.
//
//  잘못 잇지 않기 위한 장치
//    ① 성이 5자 이상이어야 합니다 (Kim · Lee · Park · Bach 는 제외됩니다)
//    ② 그 성을 가진 인물이 인물DB 에 한 명뿐이어야 합니다
//       (Bach · Wagner · Weber 처럼 여러 명이면 특정할 수 없어 건너뜁니다)
//    ③ 일반 영어 낱말과 겹치는 성은 쓰지 않습니다
//       ('Young musicians in the choir' 가 Young 이라는 인물에 붙는 것을 막습니다)
//    ④ 한글 이름은 제목에 그대로 나오므로 전체를 맞춥니다
//
//  기존 entity_links 규칙을 따릅니다 · rel 은 영문 소문자 · 양방향 두 줄 저장
//
//  환경변수 · SUPABASE_URL, SUPABASE_SERVICE_KEY
//            SUBJECT_DRY=1 이면 저장하지 않고 결과만 보여줍니다
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1';
const DRY = process.env.SUBJECT_DRY === '1';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

const MIN_SUR = 5;        // 성 최소 길이
const CONF_EN = 70;       // 영문 성 매칭 신뢰도 (성만 맞춘 것이라 낮게)
const CONF_KO = 85;       // 한글 전체 이름 매칭 신뢰도

// 성이면서 일반 낱말인 것들. 이 목록이 없으면 오탐이 쏟아집니다.
// 음악 논문 제목에 자주 나오는 낱말을 특히 챙겼습니다.
const STOP = new Set(('young church brown white green black price field water river stone '
 + 'world first other sound voice music study order place space times works style forms '
 + 'theory review culture history school method model system process effect change group '
 + 'level value range scale early later major minor sharp cross bell noble royal grand '
 + 'chief queen bishop baker miller taylor turner walker cooper carter foster porter mason '
 + 'gardner marshall german french british english italian russian polish czech japanese '
 + 'korean chinese american french modern classic romantic baroque medieval popular sacred '
 + 'social human public private national international regional local urban rural '
 + 'primary secondary higher lower middle central northern southern eastern western '
 + 'sonata opera choral vocal piano violin cello organ flute drums bands songs pieces '
 + 'analysis practice performance education research learning teaching student teacher '
 + 'gender women children youth adult elder people person body brain memory emotion '
 + 'identity meaning language speech reading writing listening singing playing making '
 + 'between within through during before after above under about again these those their '
 + 'there where which while would could should might still three above under').split(/\s+/));

// ── 유틸 ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sbGetAll(table, select, extra) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (extra || ''),
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + table + ' ' + r.status + ' ' + await r.text());
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < STEP) break;
    from += STEP;
    if (from > 100000) break;
  }
  return out;
}

async function sbInsert(rows) {
  if (!rows.length) return 0;
  const r = await fetch(SUPABASE_URL + '/rest/v1/entity_links', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows),
  });
  if (r.ok) return rows.length;
  const txt = await r.text();
  // 중복이면 한 줄씩 넣어 건너뜁니다
  if (r.status === 409 || txt.indexOf('23505') >= 0) {
    let ok = 0;
    for (const row of rows) {
      const r2 = await fetch(SUPABASE_URL + '/rest/v1/entity_links', {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify([row]),
      });
      if (r2.ok) ok++;
    }
    return ok;
  }
  throw new Error('INSERT ' + r.status + ' ' + txt);
}

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 학술 ↔ 인물 주제 연결', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');

  const persons = await sbGetAll('persons', 'id,name_ko,name_en');
  console.log('■ 인물', persons.length, '명');

  // 1) 성 사전 만들기 · 유일한 성만 남깁니다
  const surCount = new Map();   // 성 -> 인물 수
  const surFirst = new Map();   // 성 -> 첫 인물
  for (const p of persons) {
    const en = String(p.name_en || '').trim();
    if (!en) continue;
    const parts = en.split(/\s+/);
    const sur = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (sur.length < MIN_SUR) continue;
    if (STOP.has(sur)) continue;
    surCount.set(sur, (surCount.get(sur) || 0) + 1);
    if (!surFirst.has(sur)) surFirst.set(sur, p);
  }
  const surMap = new Map();
  for (const [sur, n] of surCount) if (n === 1) surMap.set(sur, surFirst.get(sur));
  console.log('■ 쓸 수 있는 성', surMap.size, '개 (겹치거나 일반 낱말인 것은 제외)');

  // 2) 한글 이름 사전 · 두 자 이상이고 유일한 이름만
  const koCount = new Map(), koFirst = new Map();
  for (const p of persons) {
    const ko = String(p.name_ko || '').trim();
    if (ko.length < 2 || !/^[가-힣]+$/.test(ko)) continue;
    koCount.set(ko, (koCount.get(ko) || 0) + 1);
    if (!koFirst.has(ko)) koFirst.set(ko, p);
  }
  const koMap = new Map();
  for (const [ko, n] of koCount) if (n === 1) koMap.set(ko, koFirst.get(ko));
  console.log('■ 쓸 수 있는 한글 이름', koMap.size, '개');

  const papers = await sbGetAll('academic', 'id,name_ko,name_en');
  console.log('■ 논문', papers.length, '건 · 제목 대조 시작');

  // 3) 이미 있는 연결 (다시 넣지 않기 위해)
  const have = new Set();
  const links = await sbGetAll('entity_links', 'from_type,from_id,rel,to_type,to_id',
    "&from_type=eq.academic&rel=eq.subject");
  for (const l of links) have.add(l.from_id + ':' + l.to_id);
  console.log('■ 이미 있는 주제 연결', have.size, '건');

  // 4) 제목에서 인물 찾기
  const pairs = [];        // { paperId, personId, how }
  let hitEn = 0, hitKo = 0;
  for (const a of papers) {
    const title = String(a.name_en || a.name_ko || '');
    if (!title) continue;
    const found = new Map();   // personId -> how

    // 영문 · 제목을 낱말로 쪼개 성 사전과 맞춥니다
    const words = title.toLowerCase().match(/[a-z]+/g) || [];
    for (const w of words) {
      if (w.length < MIN_SUR) continue;
      const p = surMap.get(w);
      if (p && !found.has(p.id)) { found.set(p.id, 'en'); hitEn++; }
    }
    // 한글 · 이름이 제목에 그대로 나오는지 봅니다
    if (/[가-힣]/.test(title)) {
      for (const [ko, p] of koMap) {
        if (title.indexOf(ko) >= 0 && !found.has(p.id)) { found.set(p.id, 'ko'); hitKo++; }
      }
    }
    for (const [pid, how] of found) {
      if (have.has(a.id + ':' + pid)) continue;
      pairs.push({ paperId: a.id, personId: pid, how });
    }
  }
  console.log('■ 새로 이을 연결', pairs.length, '건 (영문 성 ' + hitEn + ' · 한글 이름 ' + hitKo + ')');

  if (!pairs.length) { console.log('■ 넣을 것이 없습니다. 종료.'); return; }

  // 5) 미리보기
  const byPerson = new Map();
  for (const p of pairs) byPerson.set(p.personId, (byPerson.get(p.personId) || 0) + 1);
  const top = [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const pName = new Map(persons.map(p => [p.id, p.name_ko || p.name_en]));
  console.log('■ 논문이 많이 붙는 인물 12명');
  for (const [pid, n] of top) console.log('   ' + String(pName.get(pid) || pid).padEnd(24) + n + '건');

  if (DRY) { console.log('■ 시험 실행이므로 저장하지 않습니다.'); return; }

  // 6) 양방향 저장 (기존 teacher/student 쌍과 같은 방식)
  const rows = [];
  for (const p of pairs) {
    const conf = p.how === 'ko' ? CONF_KO : CONF_EN;
    const src = p.how === 'ko' ? 'title-match-ko' : 'title-match-en';
    rows.push({ from_type: 'academic', from_id: p.paperId, rel: 'subject',
                to_type: 'person', to_id: p.personId, source: src, confidence: conf });
    rows.push({ from_type: 'person', from_id: p.personId, rel: 'studied_by',
                to_type: 'academic', to_id: p.paperId, source: src, confidence: conf });
  }
  let ins = 0;
  for (let i = 0; i < rows.length; i += 500) {
    ins += await sbInsert(rows.slice(i, i + 500));
    await sleep(120);
  }
  console.log('■ 저장', ins, '줄 (양방향이므로 연결 수의 두 배입니다)');
  console.log('■ 완료');
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
