/* ============================================================
   OPUSCLAM 이미지 수집 — seed/photo-collect.mjs

   무엇을 하나
    · DB 항목의 wikidata_id 를 열쇠로 위키데이터에서 이미지를 찾아
      entity_photos 표에 모읍니다
    · 기존 컬럼(persons.image_url 등)은 건드리지 않습니다

   어떻게 하나
    1) Supabase 에서 대상 목록을 가져옵니다 (이미 사진이 모인 항목은 건너뜀)
    2) 위키데이터 SPARQL 에 QID 를 묶어서 물어봅니다 (한 번에 250개)
       - P18 대표 이미지, P154 로고를 함께 가져옵니다
    3) 커먼즈 API 로 그 파일들의 라이선스·저작자·축소 이미지 주소를 확인합니다
       (한 번에 50개)
    4) entity_photos 에 넣습니다

   쓰는 법
     node seed/photo-collect.mjs --type=person --limit=500
     node seed/photo-collect.mjs --type=school --limit=300
     node seed/photo-collect.mjs --type=person --limit=9999   (전체)

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { makeGetJSON, isStop, sleep } from '../scripts/lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
/* 열쇠 이름은 두 가지를 모두 받아들입니다.
   워크플로와 스크립트를 각각 고쳐도 어느 시점에도 멈추지 않게 하기 위해서입니다. */
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 필요합니다.');
  process.exit(1);
}

/* 위키미디어는 요청에 연락처가 담긴 User-Agent 를 요구합니다 */
const UA = 'OpusclamPhotoBot/1.0 (https://opusclam.com; contact@opusclam.com)';

/* 자료원별 조회 함수 — 재시도·대기·중단 판단은 공용 모듈이 맡습니다 */
const sparqlGet  = makeGetJSON({ ua: UA, accept: 'application/sparql-results+json' });
const commonsGet = makeGetJSON({ ua: UA, accept: 'application/json' });

/* ── 수집 대상 정의 ──
   table  : Supabase 표 이름
   type   : entity_photos 에 기록할 종류 이름
   nameCol: 로그에 쓸 이름 칸 */
const TARGETS = {
  person: { table: 'persons', type: 'person', nameCol: 'name_ko' },
  school: { table: 'schools', type: 'school', nameCol: 'name_ko' },
  venue:  { table: 'venues',  type: 'venue',  nameCol: 'name_ko' },
  org:    { table: 'orgs',    type: 'org',    nameCol: 'name_ko' },
  /* 현대음악DB — 관계 표에서 쓰는 이름은 modern, 실제 표는 modern_composers 입니다.
     인물DB와 겹치는 작곡가가 있을 수 있어 중복 점검 후에 돌리는 것이 좋습니다. */
  modern: { table: 'modern_composers', type: 'modern', nameCol: 'name_ko' },
};

/* ── 실행 인자 ── */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const TYPE  = String(args.type || 'person');
const LIMIT = Number(args.limit || 500);
const DRY   = !!args.dry;

const T = TARGETS[TYPE];
if (!T) {
  console.error(`--type 은 ${Object.keys(TARGETS).join(' / ')} 중 하나여야 합니다.`);
  process.exit(1);
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* ============================================================
   1) 대상 목록 — wikidata_id 가 있고 아직 사진을 모으지 않은 항목
   ============================================================ */
async function loadTargets() {
  /* 이미 사진이 있는 항목의 id 를 먼저 받아 제외한다 */
  const done = new Set();
  let from = 0;
  for (;;) {
    const rows = await sb(
      `entity_photos?select=entity_id&entity_type=eq.${T.type}` +
      `&limit=1000&offset=${from}`
    );
    if (!rows || !rows.length) break;
    rows.forEach((r) => done.add(r.entity_id));
    if (rows.length < 1000) break;
    from += 1000;
  }
  console.log(`이미 사진이 있는 항목: ${done.size}건`);

  const out = [];
  let off = 0;
  while (out.length < LIMIT) {
    const rows = await sb(
      `${T.table}?select=id,${T.nameCol},wikidata_id` +
      `&wikidata_id=not.is.null&order=id&limit=1000&offset=${off}`
    );
    if (!rows || !rows.length) break;
    for (const r of rows) {
      if (done.has(r.id)) continue;
      const qid = String(r.wikidata_id || '').trim().match(/Q\d+/);
      if (!qid) continue;
      out.push({ id: r.id, name: r[T.nameCol] || '', qid: qid[0] });
      if (out.length >= LIMIT) break;
    }
    if (rows.length < 1000) break;
    off += 1000;
  }
  return out;
}

/* ============================================================
   2) 위키데이터 SPARQL — P18(이미지) · P154(로고)
   ============================================================ */
async function sparqlImages(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const query = `
SELECT ?item ?image ?logo WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P18 ?image. }
  OPTIONAL { ?item wdt:P154 ?logo. }
}`;
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);

  const j = await sparqlGet(url);
  const map = new Map();
  if (!j || !j.results) return map;
  for (const b of j.results.bindings) {
    const qid = String(b.item.value).split('/').pop();
    const cur = map.get(qid) || { image: null, logo: null };
    if (b.image && !cur.image) cur.image = decodeURIComponent(String(b.image.value).split('/').pop());
    if (b.logo  && !cur.logo)  cur.logo  = decodeURIComponent(String(b.logo.value).split('/').pop());
    map.set(qid, cur);
  }
  return map;
}

/* ============================================================
   3) 커먼즈 API — 라이선스 · 저작자 · 축소 이미지 주소
   ============================================================ */
async function commonsInfo(fileNames) {
  const titles = fileNames.map((f) => 'File:' + f).join('|');
  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query&format=json&prop=imageinfo'
    + '&iiprop=url|extmetadata&iiurlwidth=1200'
    + '&titles=' + encodeURIComponent(titles);

  const j = await commonsGet(url);
  const out = new Map();
  const pages = (j && j.query && j.query.pages) || {};
  for (const k of Object.keys(pages)) {
    const p = pages[k];
    if (!p.imageinfo || !p.imageinfo[0]) continue;
    const ii = p.imageinfo[0];
    const meta = ii.extmetadata || {};
    const strip = (v) => String(v || '').replace(/<[^>]+>/g, '').trim();
    out.set(String(p.title).replace(/^File:/, ''), {
      src: ii.url,
      thumb: ii.thumburl || ii.url,
      page: ii.descriptionurl || '',
      license: strip(meta.LicenseShortName && meta.LicenseShortName.value),
      author: strip(meta.Artist && meta.Artist.value).slice(0, 200),
      caption: strip(meta.ImageDescription && meta.ImageDescription.value).slice(0, 400),
    });
  }
  return out;
}

/* ============================================================
   4) 저장
   ============================================================ */
async function saveRows(rows) {
  if (!rows.length) return 0;
  if (DRY) { console.log(`  (연습 모드) ${rows.length}건 저장 생략`); return rows.length; }
  /* 같은 파일이 이미 있으면 무시 — unique(entity_type, entity_id, file_name) */
  await sb('entity_photos?on_conflict=entity_type,entity_id,file_name', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return rows.length;
}

/* ============================================================
   본체
   ============================================================ */
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

(async () => {
  console.log(`=== 이미지 수집 시작 · 대상 ${TYPE} · 최대 ${LIMIT}건 ===`);

  const targets = await loadTargets();
  console.log(`조회 대상: ${targets.length}건\n`);
  if (!targets.length) { console.log('수집할 대상이 없습니다.'); return; }

  let foundImg = 0, foundLogo = 0, saved = 0, noImage = 0;

  const groups = chunk(targets, 250);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    console.log(`[${gi + 1}/${groups.length}] 위키데이터 조회 ${g.length}건`);

    let map;
    try {
      map = await sparqlImages(g.map((x) => x.qid));
    } catch (e) {
      if (isStop(e)) { console.log('  ■ 자료원이 응답하지 않아 여기서 멈춥니다'); break; }
      throw e;
    }

    /* 파일명 모으기 */
    const need = new Set();
    for (const t of g) {
      const r = map.get(t.qid);
      if (!r) { noImage++; continue; }
      if (r.image) need.add(r.image);
      if (r.logo)  need.add(r.logo);
      if (!r.image && !r.logo) noImage++;
    }
    console.log(`  파일 ${need.size}개 발견 → 커먼즈 정보 조회`);

    /* 커먼즈 정보 (50개씩) */
    const info = new Map();
    let stopped = false;
    for (const part of chunk([...need], 50)) {
      try {
        const m = await commonsInfo(part);
        m.forEach((v, k) => info.set(k, v));
      } catch (e) {
        if (isStop(e)) { console.log('  ■ 커먼즈가 응답하지 않아 여기까지만 처리합니다'); stopped = true; break; }
        throw e;
      }
      await sleep(400);
    }

    /* 저장할 행 만들기 */
    const rows = [];
    for (const t of g) {
      const r = map.get(t.qid);
      if (!r) continue;
      const push = (file, kind, sort) => {
        if (!file) return;
        const i = info.get(file);
        if (!i || !i.src) return;
        rows.push({
          entity_type: T.type,
          entity_id: t.id,
          src: i.src,
          thumb: i.thumb,
          file_name: file,
          page_url: i.page,
          license: i.license || null,
          author: i.author || null,
          caption: i.caption || null,
          source: 'wikidata',
          kind,
          sort_no: sort,
          is_primary: sort === 0,
        });
        if (kind === 'logo') foundLogo++; else foundImg++;
      };
      /* 인물은 초상, 그 외는 사진으로 기록 */
      push(r.image, TYPE === 'person' ? 'portrait' : 'photo', 0);
      push(r.logo, 'logo', 1);
    }

    saved += await saveRows(rows);
    console.log(`  저장 ${rows.length}건 (누적 ${saved})\n`);

    if (stopped) break;   /* 모은 것은 이미 저장되었고, 나머지는 다음 예약이 받아온다 */

    /* 위키미디어에 부담을 주지 않도록 잠시 쉰다 */
    await sleep(1200);
  }

  console.log('=== 완료 ===');
  console.log(`사진 ${foundImg}건 · 로고 ${foundLogo}건 · 저장 ${saved}건`);
  console.log(`이미지가 없는 항목: ${noImage}건`);
})().catch((e) => {
  /* 자료원이 막혀 멈춘 것은 실패가 아닙니다.
     모은 것은 이미 저장되었고 못 채운 몫은 다음 예약이 받아옵니다. */
  if (isStop(e)) { console.log('■ 여기까지 · ' + e.message); return; }
  console.error('■ 실패:', e);
  process.exit(1);
});
