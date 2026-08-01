/* ============================================================
   OPUSCLAM 커먼즈 카테고리 이미지 수집 — seed/photo-commons.mjs

   무엇을 하나
    · 위키데이터 P18 수집(photo-collect.mjs)은 항목당 한 장만 가져옵니다.
      이 스크립트는 커먼즈 카테고리를 뒤져 항목당 여러 장을 모읍니다.
    · 공연장·학교처럼 건물과 공간이 있는 대상에 효과가 큽니다.
      인물은 초상이 한 장뿐인 경우가 많아 대상에서 제외했습니다.

   어떻게 하나
    1) 위키데이터에서 커먼즈 카테고리 이름(P373)을 받아옵니다
    2) 그 카테고리의 파일 목록을 조회합니다
    3) 카테고리가 없으면 항목 이름으로 검색하되, 파일 이름을 검증해
       무관한 사진을 걸러냅니다 (확신할 수 없으면 넣지 않습니다)
    4) 파일 정보(주소·썸네일·라이선스·저작자)를 확인해 entity_photos 에 넣습니다

   쓰는 법
     node seed/photo-commons.mjs --type=venue  --limit=200
     node seed/photo-commons.mjs --type=school --limit=200
     node seed/photo-commons.mjs --type=venue  --limit=200 --max=8

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_KEY   (옛 이름 SUPABASE_SERVICE_ROLE_KEY 도 받습니다)
   ============================================================ */

import { makeGetJSON, isStop, sleep } from '../scripts/lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 필요합니다.');
  process.exit(1);
}

const UA = 'OpusclamPhotoBot/1.0 (https://opusclam.com; contact@opusclam.com)';

const sparqlGet  = makeGetJSON({ ua: UA, accept: 'application/sparql-results+json' });
const commonsGet = makeGetJSON({ ua: UA, accept: 'application/json' });

/* ── 수집 대상 ──
   건물·공간이 있는 대상만 넣었습니다.
   인물(person)은 넣지 않습니다 — 초상이 한 장뿐이고 초상권 문제도 피할 수 있습니다. */
const TARGETS = {
  venue:  { table: 'venues',  type: 'venue',  nameCol: 'name_ko', nameEn: 'name_en' },
  school: { table: 'schools', type: 'school', nameCol: 'name_ko', nameEn: 'name_en' },
  org:    { table: 'orgs',    type: 'org',    nameCol: 'name_ko', nameEn: 'name_en' },
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const TYPE  = String(args.type || 'venue');
const LIMIT = Number(args.limit || 200);
const MAXP  = Number(args.max || 6);      /* 항목당 최대 장수 */
const DRY   = !!args.dry;

const T = TARGETS[TYPE];
if (!T) {
  console.error(`--type 은 ${Object.keys(TARGETS).join(' / ')} 중 하나여야 합니다.`);
  console.error('인물(person)은 이 스크립트의 대상이 아닙니다.');
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

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* ============================================================
   1) 대상 목록
      · 이미 사진이 2장 이상인 항목은 건너뜁니다 (이미 여러 장 확보)
      · 사진이 없거나 한 장뿐인 항목만 대상입니다
   ============================================================ */
async function loadTargets() {
  /* 항목별 현재 사진 장수를 센다 */
  const count = new Map();
  let from = 0;
  for (;;) {
    const rows = await sb(
      `entity_photos?select=entity_id&entity_type=eq.${T.type}&limit=1000&offset=${from}`
    );
    if (!rows || !rows.length) break;
    rows.forEach((r) => count.set(r.entity_id, (count.get(r.entity_id) || 0) + 1));
    from += rows.length;        // ★ 받은 만큼만 나아갑니다 (서버가 200에서 자릅니다)
  }
  const already = [...count.values()].filter((n) => n >= 2).length;
  console.log(`이미 여러 장을 가진 항목: ${already}건 (건너뜁니다)`);

  const out = [];
  let off = 0;
  while (out.length < LIMIT) {
    const rows = await sb(
      `${T.table}?select=id,${T.nameCol},${T.nameEn},wikidata_id` +
      `&wikidata_id=not.is.null&order=id&limit=1000&offset=${off}`
    );
    if (!rows || !rows.length) break;
    for (const r of rows) {
      if ((count.get(r.id) || 0) >= 2) continue;
      const qid = String(r.wikidata_id || '').trim().match(/Q\d+/);
      if (!qid) continue;
      out.push({
        id: r.id,
        name: r[T.nameCol] || '',
        nameEn: r[T.nameEn] || '',
        qid: qid[0],
        have: count.get(r.id) || 0,
      });
      if (out.length >= LIMIT) break;
    }
    off += rows.length;          // ★ 받은 만큼만 나아갑니다
  }
  return out;
}

/* ============================================================
   2) 위키데이터 — 커먼즈 카테고리 이름(P373)
   ============================================================ */
async function sparqlCategories(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const query = `
SELECT ?item ?cat WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P373 ?cat.
}`;
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);

  const j = await sparqlGet(url);
  const map = new Map();
  if (!j || !j.results) return map;
  for (const b of j.results.bindings) {
    const qid = String(b.item.value).split('/').pop();
    if (!map.has(qid)) map.set(qid, b.cat.value);
  }
  return map;
}

/* ============================================================
   파일 이름으로 잡음을 걸러내기

   커먼즈 카테고리에는 그 대상뿐 아니라 주변 건물·거리·행사 사진과
   지도·포스터·현판이 함께 들어 있는 경우가 많습니다.
   첫 시험에서 실제로 이런 것들이 섞여 들어왔습니다.
     · 도네츠크 필하모니 카테고리 → 레닌 광장, 보로실로프 지구 사진
     · 가스타이크 카테고리 → 독일박물관 항공사진
     · 월트 디즈니 콘서트홀 카테고리 → 4V4A2878 copy 2.jpg (카메라 기본 이름)
   그래서 두 단계로 걸러냅니다.
   ============================================================ */

/* 1단계 — 명백한 잡음. 대상이 무엇이든 제외합니다. */
const NOISE = [
  /* 카메라가 붙인 기본 이름 — 무엇을 찍었는지 알 수 없습니다 */
  /^(dsc|dscn|img|imgp|pict|photo|foto|p\d{7}|\d+v\d+a\d+|_mg|cimg|sam_|hpim)[\s_-]?\d/i,
  /^\d{2,4}[\s_-]?\d{4,}\.(jpe?g|png)$/i,
  /copy\s*\d*\.(jpe?g|png)$/i,
  /* 다른 시설 */
  /(museum|church|kirche|cathedral|dom\b|münster|munster|rathaus|town.hall|hotel|bahnhof|station|bridge|brücke|tower|turm|castle|schloss|palace|palais|university.library)/i,
  /* 장소 일반 — 그 건물이 아니라 동네 사진입니다 */
  /(square|plaza|platz|street|stra[sß]?e|district|avenue|boulevard|panorama.of|skyline|aerial.view.of.the.city|район|улица|площадь)/i,
  /* 자료·문서 */
  /(logo|coat.of.arms|flag|map\b|plan\b|diagram|blueprint|poster|ticket|programme|program\b|plaque|sign\b|seal\b|icon|leaflet|brochure|score\b|sheet.music)/i,
  /* 사람 얼굴 위주로 보이는 것 — 공연장 소개에 쓰기 어렵습니다 */
  /(portrait|selfie|tourists)/i,
];

function isNoise(file) {
  return NOISE.some((re) => re.test(file));
}

/* 2단계 — 대상 이름과 맞는지 확인합니다.
   이름의 주요 낱말이 하나라도 파일 이름에 들어 있으면 받아들입니다.
   카테고리로 찾은 경우에는 이미 그 대상의 카테고리이므로 이 정도로 충분합니다.
   이름의 모든 낱말이 일반 명사여서 판정할 수 없으면(예: Academy of Music)
   카테고리를 신뢰하고 1단계만 적용합니다. */
function matchesName(file, item) {
  const keys = keyWords(item);
  if (!keys.length) return true;          /* 판정 불가 → 카테고리를 신뢰 */
  const low = file.toLowerCase();
  return keys.some((w) => low.includes(w.toLowerCase()));
}

/* ============================================================
   3) 커먼즈 카테고리의 파일 목록
   ============================================================ */
async function categoryFiles(cat, max) {
  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query&format=json&list=categorymembers'
    + '&cmtype=file&cmlimit=' + Math.min(max * 4, 40)
    + '&cmtitle=' + encodeURIComponent('Category:' + cat);

  const j = await commonsGet(url);
  const arr = (j && j.query && j.query.categorymembers) || [];
  return arr
    .map((x) => String(x.title).replace(/^File:/, ''))
    .filter((f) => /\.(jpe?g|png)$/i.test(f))   /* 사진만 — svg·pdf·ogg 제외 */
    .filter((f) => !isNoise(f));                /* 주변 건물·거리·자료 제외 */
}

/* ============================================================
   4) 이름으로 검색 (카테고리가 없을 때)
      파일 이름에 항목 이름의 주요 낱말이 들어 있는 것만 받아들입니다.
      확신할 수 없으면 아무것도 넣지 않습니다.
   ============================================================ */
const STOP = new RegExp('^(' + [
  'und','für','the','of','and','for','de','des','der','die','das','la','le','les','el','il',
  'university','universität','hochschule','academy','akademie','conservatory','konservatorium',
  'college','school','schule','music','musik','musique','musica','theatre','theater','hall',
  'concert','opera','philharmonic','philharmonie','orchestra','orchester','centre','center',
  '대학교','대학','음악','학교','극장','공연장','오케스트라','필하모니','콘서트홀',
].join('|') + ')$', 'i');

/* 파일 이름은 대개 로마자이므로, 판정에는 로마자 낱말만 씁니다.
   한글 낱말을 섞으면 절대 맞지 않아 정당한 사진까지 거부됩니다. */
function keyWords(item) {
  const src = [item.nameEn || '', item.name || ''].join(' ');
  return src.split(/[\s,·\-—()·:;'"]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !STOP.test(w))
    .filter((w) => /^[A-Za-zÀ-ÿ0-9'’.-]+$/.test(w));   /* 로마자만 */
}

async function searchFiles(item, max) {
  const q = (item.nameEn || item.name || '').trim();
  if (!q) return [];
  const keys = keyWords(item);
  if (!keys.length) return [];

  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query&format=json&list=search&srnamespace=6'
    + '&srlimit=' + Math.min(max * 3, 30)
    + '&srsearch=' + encodeURIComponent(q);

  const j = await commonsGet(url);
  const arr = (j && j.query && j.query.search) || [];

  return arr
    .map((x) => String(x.title).replace(/^File:/, ''))
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .filter((f) => !isNoise(f))
    .filter((f) => {
      const low = f.toLowerCase();
      const hit = keys.filter((w) => low.includes(w.toLowerCase())).length;
      /* 고유 낱말이 둘 이상 맞으면 통과.
         고유 낱말이 하나뿐인 경우에는 대상 종류를 가리키는 낱말이 함께 있어야 한다. */
      if (keys.length >= 2) return hit >= 2;
      const kindish = /(hall|theat|concert|opera|hochschule|musik|music|conservator|akademie|academy|philharmon)/i.test(f);
      return hit >= 1 && kindish;
    });
}

/* ============================================================
   5) 파일 정보 (주소 · 썸네일 · 라이선스 · 저작자)
   ============================================================ */
async function fileInfo(files) {
  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query&format=json&prop=imageinfo'
    + '&iiprop=url|extmetadata&iiurlwidth=1200'
    + '&titles=' + encodeURIComponent(files.map((f) => 'File:' + f).join('|'));

  const j = await commonsGet(url);
  const pages = (j && j.query && j.query.pages) || {};
  const out = new Map();
  const strip = (v) => String(v || '').replace(/<[^>]+>/g, '').trim();
  for (const k of Object.keys(pages)) {
    const p = pages[k];
    if (!p.imageinfo || !p.imageinfo[0]) continue;
    const ii = p.imageinfo[0];
    const meta = ii.extmetadata || {};
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

async function saveRows(rows) {
  if (!rows.length) return 0;
  if (DRY) { console.log(`  (연습 모드) ${rows.length}건 저장 생략`); return rows.length; }
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
(async () => {
  console.log(`=== 커먼즈 카테고리 수집 · 대상 ${TYPE} · 최대 ${LIMIT}건 · 항목당 ${MAXP}장 ===`);

  const targets = await loadTargets();
  console.log(`조회 대상: ${targets.length}건\n`);
  if (!targets.length) { console.log('수집할 대상이 없습니다.'); return; }

  let byCat = 0, bySearch = 0, none = 0, saved = 0;
  let stopped = false;

  /* 카테고리 이름을 250개씩 미리 받아둔다 */
  const catMap = new Map();
  for (const part of chunk(targets, 250)) {
    try {
      const m = await sparqlCategories(part.map((x) => x.qid));
      m.forEach((v, k) => catMap.set(k, v));
    } catch (e) {
      if (isStop(e)) { console.log('■ 위키데이터가 응답하지 않아 여기까지만 진행합니다'); stopped = true; break; }
      throw e;
    }
    await sleep(800);
  }
  console.log(`커먼즈 카테고리가 있는 항목: ${catMap.size}건\n`);

  for (let i = 0; i < targets.length; i++) {
    if (stopped) break;
    const t = targets[i];
    const label = `[${i + 1}/${targets.length}] ${t.name || t.nameEn || t.qid}`;

    try {
      const cat = catMap.get(t.qid);
      let files = [];
      let via = '';

      if (cat) {
        files = await categoryFiles(cat, MAXP);
        /* 카테고리 안에도 다른 대상 사진이 섞여 있으므로 이름을 한 번 더 확인한다 */
        files = files.filter((f) => matchesName(f, t));
        if (files.length) via = '카테고리';
      }
      if (!files.length) {
        files = await searchFiles(t, MAXP);
        if (files.length) via = '검색';
      }
      if (!files.length) { none++; continue; }

      files = files.slice(0, MAXP);
      const info = await fileInfo(files);

      const rows = [];
      files.forEach((f, ix) => {
        const d = info.get(f);
        if (!d || !d.src) return;
        rows.push({
          entity_type: T.type,
          entity_id: t.id,
          src: d.src,
          thumb: d.thumb,
          file_name: f,
          page_url: d.page,
          license: d.license || null,
          author: d.author || null,
          caption: d.caption || null,
          source: 'commons',
          kind: 'photo',
          /* P18 로 받은 사진이 대표가 되도록 뒤 번호부터 채운다 */
          sort_no: 10 + ix,
          is_primary: false,
        });
      });

      if (rows.length) {
        saved += await saveRows(rows);
        if (via === '카테고리') byCat++; else bySearch++;
        console.log(`${label} — ${via} ${rows.length}장 (누적 ${saved})`);
      } else {
        none++;
      }
    } catch (e) {
      if (isStop(e)) { console.log(`${label} — ■ 자료원이 응답하지 않아 여기서 멈춥니다`); break; }
      console.log(`${label} — 건너뜀 (${e.message})`);
    }

    await sleep(700);
  }

  console.log('\n=== 완료 ===');
  console.log(`카테고리로 찾음 ${byCat}건 · 검색으로 찾음 ${bySearch}건 · 못 찾음 ${none}건`);
  console.log(`저장한 사진 ${saved}장`);
})().catch((e) => {
  if (isStop(e)) { console.log('■ 여기까지 · ' + e.message); return; }
  console.error('■ 실패:', e);
  process.exit(1);
});
