// ============================================================
// OPUSCLAM  인물DB 한국어 소개문 보강   scripts/describe-persons.mjs
//
//  하는 일
//    description 이 빈 인물을 찾아, 한국어 위키백과의 문서 앞머리(요약)를
//    가져와 채웁니다. 위키데이터 번호로 한국어 문서 제목을 먼저 찾고,
//    그 제목으로 요약을 받아옵니다.
//
//  왜 필요한가
//    2026-08-03 확인 — 인물 9,348명 가운데 7,599명(81%)이 소개가 없습니다.
//    소개가 없으면 상세 화면이 이름과 생몰년만 남은 빈 껍데기가 됩니다.
//
//    이 일을 하는 기능이 admin/admin.html 에 있었지만
//      ① 브라우저 창을 열어 두어야 돌고, 닫으면 끊깁니다
//      ② limit(3000) 이 실제로는 <b>200명만</b> 가져왔습니다
//         (Supabase 는 한 번에 돌려주는 줄 수에 상한이 있습니다)
//    그래서 7,599명 가운데 200명만 대상으로 돌고 있었습니다.
//
//  ★ 덮어쓰지 않습니다
//    이미 소개가 있는 인물은 건드리지 않습니다. 손으로 쓴 소개문과
//    회원이 넣은 소개문을 지킵니다.
//
//  ★ 저작권 — 한국어 위키백과는 CC BY-SA 입니다.
//    그래서 <b>요약 앞머리만</b> 가져오고, 500자에서 끊고, 출처를 함께
//    담습니다(link_wiki 가 비어 있으면 문서 주소를 넣습니다).
//    전문을 옮기지 않는 것이 중요합니다.
//
//  환경변수
//    SUPABASE_URL, SUPABASE_SERVICE_KEY
//    (선택) DAILY_LIMIT  이번 실행에서 처리할 인물 수 (기본 1200)
//    (선택) DRY_RUN      '1' 이면 저장하지 않고 미리보기만
// ============================================================

import { sleep, makeGetJSON, isStop, stopReason, budgetLeftMin } from './lib/http.mjs';

import { readJson } from './lib/json.mjs';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const DAILY_LIMIT  = parseInt(process.env.DAILY_LIMIT || '1200', 10);
const DRY_RUN      = process.env.DRY_RUN === '1';
const WD_SPARQL    = process.env.WD_SPARQL || 'https://query.wikidata.org/sparql';
const KO_API       = process.env.KO_API    || 'https://ko.wikipedia.org/w/api.php';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};
const getJSON = makeGetJSON();

/* ★★ 2026-08-19 · 500 → 4000 자 (파트너 지시)
     ─────────────────────────────────────────────────────
   ★ 무엇이 문제였나
     소개문이 <b>정확히 501자에서 끊기는</b> 사람이 있었습니다 —
     미셸린 오스테르메이에·크리스토퍼 호그우드. 화면에는 「여기서
     끊깁니다」 안내가 붙어 원문으로 보내고 있었습니다.

   ★ enrich-persons 는 2026-08-12 에 <b>이미 4,000자로</b> 늘렸는데
     이 수집기만 500자로 남아 있었습니다. 두 수집기가 <b>같은 칸</b>
     (description)을 채우면서 서로 다른 잣대를 쓰고 있던 셈입니다.

   ★ 저작권 — 도입부만 받아 오고(exintro), 화면에 「출처: 위키백과 ·
     CC BY-SA」를 함께 보입니다. 실제 도입부는 대개 200~800자라
     4,000자는 <b>사실상 자르지 않는</b> 값입니다. */
const MAX_LEN = 4000;

/* ── Supabase 나눠받기 ──────────────────────────────────────
   ★ 받은 만큼 다음 자리를 옮깁니다. 「요청한 수보다 적게 왔으면 끝」 으로
     판단하면 상한(이 프로젝트는 200줄) 때문에 첫 묶음에서 멈춥니다. */
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
    const batch = await readJson(r);
    if (!batch.length) break;
    out.push(...batch);
    from += batch.length;
    if (out.length > 200000) break;
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

/* ── ① 위키데이터에서 한국어 문서 제목 찾기 ──────────────────
   SPARQL 로 한 번에 여러 개를 물어봅니다. 150개씩 묶습니다 —
   그보다 크게 묶으면 질의가 커져 시간 초과가 납니다. */
async function fetchKoTitles(qids) {
  const values = qids.map(q => 'wd:' + q).join(' ');
  const query = 'SELECT ?item ?title WHERE { VALUES ?item { ' + values + ' } '
    + '?article schema:about ?item ; schema:isPartOf <https://ko.wikipedia.org/> ; '
    + 'schema:name ?title . }';
  const url = WD_SPARQL + '?format=json&query=' + encodeURIComponent(query);
  const j = await getJSON(url);
  const map = {};
  const rows = (j && j.results && j.results.bindings) || [];
  for (const b of rows) {
    const qid = b.item.value.split('/').pop();
    map[qid] = b.title.value;
  }
  return map;
}

/* ── ② 한국어 위키백과에서 요약 받기 ─────────────────────────
   exintro=1 로 <b>앞머리만</b> 받습니다. 전문을 옮기지 않습니다.
   exlimit 은 20이 상한이므로 20개씩 묶습니다. */
async function fetchExtracts(titles) {
  const url = KO_API + '?action=query&format=json&origin=*'
    + '&prop=extracts&exintro=1&explaintext=1&exlimit=20&redirects=1'
    + '&titles=' + encodeURIComponent(titles.join('|'));
  const j = await getJSON(url);
  const pages = (j && j.query && j.query.pages) || {};
  const byTitle = {};
  /* 넘겨주기(redirect)가 있으면 물어본 제목과 돌아온 제목이 다릅니다.
     그 짝을 따라가야 어느 인물의 것인지 알 수 있습니다. */
  const redir = {};
  for (const r of ((j && j.query && j.query.redirects) || [])) redir[r.from] = r.to;
  const norm = {};
  for (const n of ((j && j.query && j.query.normalized) || [])) norm[n.from] = n.to;
  for (const k of Object.keys(pages)) {
    const pg = pages[k];
    if (pg && pg.extract) byTitle[pg.title] = pg.extract;
  }
  return { byTitle, redir, norm };
}

function tidy(s) {
  /* ★★ 2026-08-19 · <b>줄바꿈을 살립니다</b>
       \s+ → ' ' 로 뭉개면 여러 문단이 <b>한 덩어리</b>로 붙어 화면에서
       읽기 어렵습니다. enrich-persons 는 2026-08-12 에 이것을 고쳤는데
       이 파일은 그대로 남아 있었습니다.
     ★ 줄 <b>안의</b> 여러 공백만 정리하고, 빈 줄이 셋 이상이면
       둘로 줄입니다. */
  let t = String(s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
  if (t.length > MAX_LEN) {
    /* 문장 가운데서 끊지 않으려고, 마지막 마침표까지만 남깁니다 */
    const cut = t.slice(0, MAX_LEN);
    const dot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '), cut.lastIndexOf('다.'));
    t = (dot > MAX_LEN * 0.5 ? cut.slice(0, dot + 1) : cut) + ' …';
  }
  return t;
}

/* ══════════════════════════════════════════════════════════ */
async function main() {
  console.log('── OPUSCLAM 인물DB 한국어 소개문 보강 ──');
  console.log('   이번 실행 처리 한도: ' + DAILY_LIMIT + '명'
    + (DRY_RUN ? '  · 미리보기만(저장하지 않습니다)' : ''));

  /* 대상 — 위키데이터 번호가 있고 소개가 빈 인물.
     널리 알려진 인물부터(sort_no 내림차순) 채웁니다. */
  console.log('■ 대상 조회');
  const all = await sbGetAll('persons', 'id,name_ko,name_en,description,link_wiki,wikidata_id,sort_no',
    '&wikidata_id=not.is.null&order=sort_no.desc.nullslast,id.asc'
    /* ★ id 를 뒤에 붙여 순서를 확정합니다. sort_no 는 같은 값이 수십 명씩
       있어서, 그것만으로 정렬하면 페이지 경계에서 어떤 줄은 두 번 오고
       어떤 줄은 아예 오지 않습니다. */);
  /* ★★ 2026-08-19 · <b>잘린 소개문도 다시 받습니다</b> (--recut)
       ─────────────────────────────────────────────────────
     ★ 무엇이 문제였나
       이 수집기는 <b>소개문이 없는 사람만</b> 봅니다. 그래서 길이를
       500 → 4,000자로 늘려도 <b>이미 잘려서 담긴 사람은 그대로</b>
       남습니다. 채우려면 그들을 다시 봐야 합니다.

     ★ 어떻게 가려내나 — 「…」 로 끝나거나, 문장이 온전히 끝나지 않은
       것을 잘린 것으로 봅니다. <b>화면과 같은 잣대</b>입니다
       (community/selfpr.html 의 cutNote).
       ★ 콩쿠르 입상 이력처럼 <b>「…위」로 끝나는 목록</b>은 잘린 것이
         아닙니다 — 다시 받으면 그 이력이 위키 글로 <b>덮여 사라집니다.</b>
         이것을 빼지 않으면 어제 담은 683명의 입상 이력을 잃습니다. */
  const RECUT = process.argv.includes('--recut');
  function looksCut(t) {
    const v = String(t || '').trim();
    if (!v) return false;
    if (/…\s*$/.test(v)) return true;                    /* 잘릴 때 붙인 표시 */
    if (/[.!?。]["')\]]?$/.test(v)) return false;         /* 온전히 끝남 */
    if (/(습니다|입니다|이다|였다|한다)$/.test(v)) return false;
    if (/(\d+\s*위|위|등|상|수상)$/.test(v)) return false;  /* 이력 목록 — 건드리지 않습니다 */
    return true;
  }

  const empty = all.filter(p => !(p.description && String(p.description).trim()));
  const cut   = RECUT ? all.filter(p => looksCut(p.description)) : [];
  const pool  = empty.concat(cut);
  const targets = pool.slice(0, DAILY_LIMIT);
  console.log('   위키데이터 번호가 있는 인물 : ' + all.length + '명');
  console.log('   소개가 없는 인물            : ' + empty.length + '명');
  if (RECUT) console.log('   소개가 잘린 인물 (--recut)  : ' + cut.length + '명');
  console.log('   이번에 처리할 인물          : ' + targets.length + '명');
  if (!targets.length) { console.log('✅ 채울 것이 없습니다.'); return; }

  /* ① 한국어 문서 제목 */
  console.log('■ 한국어 위키백과 문서 제목 조회 (150명씩)');
  const titleMap = {};
  for (let i = 0; i < targets.length; i += 150) {
    const why = stopReason();
    if (why) { console.log('   ⏸ 자료원이 막혀 멈춥니다 — ' + why); break; }
    const part = targets.slice(i, i + 150);
    try {
      Object.assign(titleMap, await fetchKoTitles(part.map(p => p.wikidata_id)));
    } catch (e) {
      if (isStop(e)) { console.log('   ⏸ ' + (e.message || e)); break; }
      console.log('   ✗ 묶음 조회 실패 — 건너뜁니다: ' + (e.message || e));
    }
    console.log('   ' + Math.min(i + 150, targets.length) + '/' + targets.length
      + ' · 문서를 찾은 인물 ' + Object.keys(titleMap).length);
    await sleep(400);
  }
  const withDoc = targets.filter(p => titleMap[p.wikidata_id]);
  console.log('   ▶ 한국어 문서가 있는 인물: ' + withDoc.length + '명 / '
    + (targets.length - withDoc.length) + '명은 문서가 없어 채울 수 없습니다');
  if (!withDoc.length) { console.log('✅ 채울 것이 없습니다.'); return; }

  /* ② 요약 받아 채우기 */
  console.log('■ 요약 받기 (20명씩) · ' + MAX_LEN + '자에서 끊습니다');
  let ok = 0, bad = 0, miss = 0;
  const preview = [];
  for (let i = 0; i < withDoc.length; i += 20) {
    const why = stopReason();
    if (why) { console.log('   ⏸ 자료원이 막혀 멈춥니다 — ' + why); break; }
    const batch = withDoc.slice(i, i + 20);
    const titles = batch.map(p => titleMap[p.wikidata_id]);
    let res;
    try {
      res = await fetchExtracts(titles);
    } catch (e) {
      if (isStop(e)) { console.log('   ⏸ ' + (e.message || e)); break; }
      console.log('   ✗ 묶음 실패 — 건너뜁니다: ' + (e.message || e));
      continue;
    }
    for (const p of batch) {
      let t = titleMap[p.wikidata_id];
      if (res.norm[t]) t = res.norm[t];
      if (res.redir[t]) t = res.redir[t];
      const ex = res.byTitle[t];
      if (!ex) { miss++; continue; }
      const text = tidy(ex);
      if (text.length < 20) { miss++; continue; }   /* 너무 짧으면 쓸모가 없습니다 */
      const patch = { description: text };
      /* 출처를 함께 남깁니다 — CC BY-SA 는 출처 표시를 요구합니다 */
      if (!p.link_wiki || !String(p.link_wiki).trim()) {
        patch.link_wiki = 'https://ko.wikipedia.org/wiki/' + encodeURIComponent(t);
      }
      if (preview.length < 10) {
        preview.push('   · ' + (p.name_ko || p.name_en) + ' — ' + text.slice(0, 70) + '…');
      }
      if (DRY_RUN) { ok++; continue; }
      try { await sbUpdate(p.id, patch); ok++; }
      catch (e) { bad++; if (bad <= 3) console.log('   ✗ ' + (p.name_ko || p.name_en) + ': ' + (e.message || e)); }
    }
    if (i % 200 === 0) {
      console.log('   ' + Math.min(i + 20, withDoc.length) + '/' + withDoc.length
        + ' · 채움 ' + ok + ' · 남은 예산 ' + budgetLeftMin() + '분');
    }
    await sleep(250);
  }

  console.log('■ 미리보기');
  preview.forEach(x => console.log(x));

  if (DRY_RUN) {
    console.log('✅ 미리보기만 했습니다. ' + ok + '명을 채울 수 있습니다. 저장하지 않았습니다.');
    return;
  }
  console.log('✅ 완료 — ' + ok + '명의 소개를 채웠습니다.'
    + (bad ? ' (저장 실패 ' + bad + '명)' : '')
    + (miss ? ' · 요약이 비어 건너뜀 ' + miss + '명' : ''));
  console.log('   아직 소개가 없는 인물: 약 ' + Math.max(empty.length - ok, 0) + '명');
  console.log('   ※ 한국어 위키백과 문서가 없는 인물은 이 방법으로 채울 수 없습니다.');
  console.log('   ※ 그런 인물에게는 db-audit 화면의 「영문 원문 확보」 가 있습니다 —');
  console.log('     번역하지 않고 영문 요약을 description_en 에 따로 담습니다.');
}

main().catch(e => {
  console.error('✗ 중단: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
