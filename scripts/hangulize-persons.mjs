// ============================================================
// OPUSCLAM  인물DB 한글 이름 보강      scripts/hangulize-persons.mjs
//
//  하는 일
//    name_ko 에 한글이 없는 인물을 찾아, 위키데이터에서 한국어 표기를
//    가져와 채웁니다. 한국어 위키백과 문서 제목을 먼저 쓰고, 없으면
//    위키데이터의 한국어 라벨을 씁니다.
//
//  왜 필요한가
//    2026-08-03 확인 — 인물 9,348명 가운데 6,346명(68%)이 한글 이름이
//    없습니다. 한글 이름이 없으면 <b>한국 사용자가 검색으로 찾을 수
//    없습니다.</b> 「국내 최고 품질」 을 내세우는 곳에서 세 명 중 두 명을
//    못 찾는 것은 큰 구멍입니다.
//
//    이 일을 하는 기능이 admin/kr-collect.html 에 이미 있었지만
//    <b>브라우저 창을 열어 두어야</b> 돌고, 닫으면 끊깁니다. 6,346명을
//    손으로 지키고 앉아 있을 수는 없으므로 자동화합니다.
//
//  ★ 덮어쓰지 않습니다
//    한글이 이미 든 name_ko 는 건드리지 않습니다. 손으로 다듬은 표기와
//    회원이 넣은 표기를 지킵니다.
//
//  ★ 영문 이름을 잃지 않습니다
//    name_ko 에 영문이 들어 있고 name_en 이 비어 있으면, 한글로 바꾸기
//    전에 그 영문을 name_en 으로 옮겨 보존합니다.
//
//  환경변수
//    SUPABASE_URL, SUPABASE_SERVICE_KEY
//    (선택) DAILY_LIMIT  이번 실행에서 처리할 인물 수 (기본 1500)
//    (선택) DRY_RUN      '1' 이면 저장하지 않고 미리보기만
// ============================================================

import { sleep, makeGetJSON, isStop, stopReason, budgetLeftMin } from './lib/http.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const DAILY_LIMIT  = parseInt(process.env.DAILY_LIMIT || '1500', 10);
const DRY_RUN      = process.env.DRY_RUN === '1';
/* 위키데이터 주소 — 보통은 그대로 두십시오.
   시험할 때 흉내 서버를 가리키게 하거나, 나중에 미러를 쓸 때 바꿉니다. */
const WD_API       = process.env.WD_API || 'https://www.wikidata.org/w/api.php';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

/* ★ 공용 HTTP 모듈을 씁니다 — 429(요청 과다)와 5xx 를 스스로 다루고,
   자료원이 몇 시간을 기다리라고 해도 따르지 않고 멈춥니다.
   GitHub Actions 는 IP 를 여럿이 함께 써서 남의 몫까지 합산되는 일이
   있습니다. 그때 그대로 기다리면 실행 제한에 걸려 취소됩니다. */
const getJSON = makeGetJSON();

/* ── 한글이 들어 있는가 ────────────────────────────────────── */
const HANGUL = /[가-힣]/;
function hasHangul(s) { return HANGUL.test(String(s || '')); }

/* 문서 제목 뒤의 괄호를 뗍니다 — 「홍길동 (작곡가)」 → 「홍길동」
   위키백과는 같은 이름을 구별하려고 괄호를 붙입니다. 그것은 문서
   제목의 사정이고 사람 이름이 아닙니다. */
function stripParen(s) {
  return String(s || '').replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/* ── Supabase 나눠받기 ──────────────────────────────────────
   ★ 받은 만큼 다음 자리를 옮깁니다. Supabase 는 한 번에 돌려주는
     줄 수에 상한이 있어서(이 프로젝트는 200줄), 「요청한 수보다
     적게 왔으면 끝」 으로 판단하면 첫 묶음에서 멈춰 버립니다.
     실제로 어드민 화면이 9,348명 가운데 200명만 훑고 있었습니다. */
async function sbGetAll(table, select, filter) {
  const out = [];
  const STEP = 1000;
  let from = 0;
  for (;;) {
    const url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (filter || '');
    const r = await fetch(url, { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) {
      console.error('  ✗ 조회 실패 ' + r.status + ' — ' + (await r.text()).slice(0, 200));
      throw new Error('GET ' + r.status);
    }
    const batch = await r.json();
    if (!batch.length) break;
    out.push(...batch);
    from += batch.length;
    if (out.length > 200000) break;      // 끝없이 도는 것을 막는 안전장치
  }
  return out;
}

async function sbUpdate(id, patch) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/persons?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('PATCH ' + r.status + ' — ' + (await r.text()).slice(0, 160));
}

/* ── 위키데이터에서 한국어 표기 가져오기 ─────────────────────
   한 번에 50개까지 물어볼 수 있습니다. 그보다 많이 넣으면 거절됩니다. */
async function fetchKorean(qids) {
  const url = WD_API
    + '?action=wbgetentities&format=json&origin=*'
    + '&props=labels%7Csitelinks&languages=ko&sitefilter=kowiki'
    + '&ids=' + qids.join('%7C');
  const j = await getJSON(url);
  return (j && j.entities) || {};
}

/* ══════════════════════════════════════════════════════════ */
async function main() {
  console.log('── OPUSCLAM 인물DB 한글 이름 보강 ──');
  console.log('   이번 실행 처리 한도: ' + DAILY_LIMIT + '명'
    + (DRY_RUN ? '  · 미리보기만(저장하지 않습니다)' : ''));

  /* ① 대상 고르기 — 위키데이터 번호가 있고, name_ko 에 한글이 없는 인물
     ★ 어느 것을 먼저 채울까 — sort_no 가 큰 순서로 합니다.
       sort_no 는 위키데이터 사이트링크 수(널리 알려진 정도)에서 왔습니다.
       널리 알려진 인물부터 채우면 검색에 걸릴 확률이 먼저 올라갑니다. */
  console.log('■ 대상 조회');
  const all = await sbGetAll('persons', 'id,name_ko,name_en,wikidata_id,sort_no',
    '&wikidata_id=not.is.null&order=sort_no.desc.nullslast');
  const targets = all.filter(p => !hasHangul(p.name_ko)).slice(0, DAILY_LIMIT);
  console.log('   위키데이터 번호가 있는 인물 : ' + all.length + '명');
  console.log('   한글 이름이 없는 인물       : ' + all.filter(p => !hasHangul(p.name_ko)).length + '명');
  console.log('   이번에 처리할 인물          : ' + targets.length + '명');
  if (!targets.length) {
    console.log('✅ 채울 것이 없습니다.');
    return;
  }

  /* ② 위키데이터 조회 */
  console.log('■ 위키데이터에서 한국어 표기 조회 (50명씩)');
  const fix = [];
  let asked = 0;
  for (let i = 0; i < targets.length; i += 50) {
    /* ★ stopReason() 으로 봅니다. isStop() 은 <b>오류 객체를 받아</b>
       그것이 멈춤인지 판별하는 함수라, 인자 없이 부르면 늘 false 입니다. */
    const why = stopReason();
    if (why) { console.log('   ⏸ 바깥 자료원이 막혀 조회를 멈춥니다 — ' + why); break; }
    const part = targets.slice(i, i + 50);
    let ents = {};
    try {
      ents = await fetchKorean(part.map(p => p.wikidata_id));
    } catch (e) {
      if (isStop(e)) { console.log('   ⏸ ' + (e.message || e)); break; }
      console.log('   ✗ 묶음 조회 실패 — 건너뜁니다: ' + (e.message || e));
      continue;
    }
    asked += part.length;
    for (const p of part) {
      const e = ents[p.wikidata_id];
      if (!e) continue;
      /* 한국어 위키백과 문서 제목을 먼저 씁니다 — 사람이 쓴 표기라
         라벨보다 다듬어져 있는 편입니다. */
      const site = e.sitelinks && e.sitelinks.kowiki && e.sitelinks.kowiki.title;
      const lab  = e.labels && e.labels.ko && e.labels.ko.value;
      const nk = stripParen(site || lab || '');
      if (nk && hasHangul(nk)) {
        fix.push({ id: p.id, from: p.name_ko, to: nk, en: p.name_en });
      }
    }
    if (i % 500 === 0) {
      console.log('   ' + Math.min(i + 50, targets.length) + '/' + targets.length
        + ' · 찾은 표기 ' + fix.length + ' · 남은 예산 ' + budgetLeftMin() + '분');
    }
    await sleep(180);
  }
  console.log('   ▶ 물어본 인물 ' + asked + '명 · 한국어 표기를 찾은 인물 ' + fix.length + '명');

  /* ③ 미리보기 — 앞 20명은 늘 찍습니다. 무엇이 바뀌는지 로그에 남겨
        나중에 되돌릴 근거가 되게 합니다. */
  console.log('■ 미리보기 (앞 20명)');
  fix.slice(0, 20).forEach(f => console.log('   · ' + f.from + '  →  ' + f.to));

  if (DRY_RUN) {
    console.log('✅ 미리보기만 했습니다. 저장하지 않았습니다.');
    return;
  }
  if (!fix.length) {
    console.log('✅ 채울 표기를 찾지 못했습니다. 이 인물들은 한국어 문서가 없습니다.');
    return;
  }

  /* ④ 저장 */
  console.log('■ 저장');
  let ok = 0, bad = 0;
  for (let k = 0; k < fix.length; k++) {
    const f = fix[k];
    const patch = { name_ko: f.to };
    /* 영문 이름이 비어 있으면, 지금 name_ko 에 든 영문을 옮겨 보존합니다.
       그러지 않으면 영문 표기를 잃습니다. */
    if (!f.en || !String(f.en).trim()) patch.name_en = f.from;
    try {
      await sbUpdate(f.id, patch);
      ok++;
    } catch (e) {
      bad++;
      if (bad <= 3) console.log('   ✗ ' + f.to + ': ' + (e.message || e));
    }
    if (k % 200 === 0 && k) console.log('   저장 ' + k + '/' + fix.length);
  }

  console.log('✅ 완료 — ' + ok + '명의 한글 이름을 채웠습니다.'
    + (bad ? ' (실패 ' + bad + '명)' : ''));
  const left = all.filter(p => !hasHangul(p.name_ko)).length - ok;
  console.log('   아직 한글 이름이 없는 인물: 약 ' + Math.max(left, 0) + '명');
  console.log('   ※ 한국어 위키백과 문서가 없는 인물은 이 방법으로 채울 수 없습니다.');
}

main().catch(e => {
  console.error('✗ 중단: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
