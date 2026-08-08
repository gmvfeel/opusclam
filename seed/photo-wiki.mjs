/* ============================================================
   OPUSCLAM 위키백과 대표 사진 수집 — seed/photo-wiki.mjs
   ------------------------------------------------------------
   ★ 왜 만들었나 (2026-08-08)

   인물DB 가 15,250명으로 늘면서 <b>사진 있는 사람이 29.3%</b>로 떨어졌습니다.
     사진 있음  4,464명
     사진 없음 10,775명

   지금 있는 두 길은 이렇습니다.
     사진 · 인물·단체(주간)  위키데이터 P18 을 봅니다
     사진 · 커먼즈(주간)     커먼즈 <b>카테고리</b>를 훑습니다 (성공률 3.3%)

   그런데 <b>위키백과 문서에는 사진이 있는데</b> 위키데이터 P18 이 비어 있고
   커먼즈 카테고리도 없는 경우가 많습니다. 그 사이를 이 수집기가 메웁니다.

   ★ 어떻게 가져오나
     위키백과 REST 의 요약(summary) 에는 <b>대표 사진</b>이 들어 있습니다.
     문서 첫머리에 걸린 그 사진입니다.
     한국어판을 먼저 보고, 없으면 영문판을 봅니다.

   ★ 저작권 — 이것이 가장 중요합니다
     · 대표 사진이 <b>커먼즈에 있는 것</b>만 받습니다.
       위키백과에 직접 올라온 파일(local upload)은 공정이용으로 올린
       것이 섞여 있어 밖에서 쓰면 안 됩니다.
     · 라이선스와 저작자를 함께 저장합니다. 화면에 표시할 수 있어야 합니다.
     · 라이선스를 확인하지 못한 것은 <b>담지 않습니다.</b>

   ★ 사람 손으로 넣은 사진을 덮지 않습니다
     이미 entity_photos 에 사진이 있는 사람은 건너뜁니다.

   쓰는 법
     node seed/photo-wiki.mjs                    확인만 (담지 않습니다)
     node seed/photo-wiki.mjs --save             실제로 담습니다
     node seed/photo-wiki.mjs --limit=300        한 번에 볼 사람 수
     node seed/photo-wiki.mjs --type=person      person · org · school · venue

   필요한 환경변수
     SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { makeGetJSON, isStop, sleep } from '../scripts/lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SAVE  = !!args.save;
const DEBUG = !!args.debug;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 250;
const TYPE  = typeof args.type === 'string' ? args.type : 'person';

const UA = 'OpusclamPhotoBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
const getJSON = makeGetJSON({ ua: UA, accept: 'application/json', tries: 4 });

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

/* 표마다 어느 칸을 보는지 */
const TYPES = {
  person: { table: 'persons',  label: '인물',   name: 'name_ko', name2: 'name_en',
            wiki: 'wd_links',  imgCol: 'image_url' },
  org:    { table: 'orgs',     label: '단체',   name: 'name_ko', name2: 'name_en',
            wiki: null,        imgCol: 'image_url' },
  school: { table: 'schools',  label: '학교',   name: 'name_ko', name2: 'name_en',
            wiki: null,        imgCol: 'image_url' },
  venue:  { table: 'venues',   label: '공연장', name: 'name_ko', name2: 'name_en',
            wiki: null,        imgCol: 'image_url' },
};

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init, headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다. */
async function getAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await rest(path + '&limit=200&offset=' + off);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    off += rows.length;
    if (rows.length < 200) break;
  }
  return out;
}

/* ── 위키백과 요약에서 대표 사진 ─────────────────────────
   ★ 커먼즈에 있는 것만 받습니다.
     위키백과에 직접 올라온 파일은 공정이용으로 올린 것이 섞여
     밖에서 쓰면 안 됩니다. */
async function summaryPhoto(lang, title) {
  const url = 'https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/'
            + encodeURIComponent(title);
  let j;
  try {
    j = await getJSON(url);
  } catch (e) {
    /* ★ 속도 제한은 위로 올려야 합니다.
       여기서 null 로 삼키면 「사진 없음」으로 세어져,
       막힌 것인지 정말 없는 것인지 알 수 없게 됩니다.
       (첫 실행에서 400명이 전부 「없음」으로 나온 까닭입니다) */
    if (isStop(e)) throw e;
    return null;
  }
  const src = (j && j.originalimage && j.originalimage.source)
           || (j && j.thumbnail && j.thumbnail.source);
  if (!src) return null;

  /* ★ 커먼즈 파일만 받습니다.
     upload.wikimedia.org/wikipedia/<b>commons</b>/ 인 것만 통과시킵니다.
     .../wikipedia/en/ 처럼 언어판 경로는 그 위키에 직접 올린 파일이고,
     공정이용으로 올린 것이 섞여 있어 밖에서 쓰면 안 됩니다.
     (라이선스 조회에서도 걸러지지만 여기서 먼저 막습니다) */
  if (src.indexOf('upload.wikimedia.org/wikipedia/commons/') < 0) return null;

  /* 파일 이름을 뽑습니다 — 썸네일 주소면 /thumb/ 뒤 마지막 조각 */
  let file = '';
  const m = /\/([^\/]+)$/.exec(src.split('?')[0]);
  if (m) file = decodeURIComponent(m[1]);
  if (/^\d+px-/.test(file)) file = file.replace(/^\d+px-/, '');
  if (!file) return null;

  return { file, thumb: (j.thumbnail && j.thumbnail.source) || src };
}

/* ── 커먼즈에서 라이선스·저작자 확인 ─────────────────────
   ★ 이것을 확인하지 못하면 담지 않습니다. */
async function commonsInfo(files) {
  if (!files.length) return new Map();
  const titles = files.map(f => 'File:' + f).join('|');
  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query&format=json&origin=*'
    + '&prop=imageinfo&iiprop=url|extmetadata'
    + '&iiurlwidth=400'
    + '&titles=' + encodeURIComponent(titles);

  let j;
  try {
    j = await getJSON(url);
  } catch (e) {
    return new Map();
  }
  const pages = (j && j.query && j.query.pages) || {};
  const out = new Map();
  const strip = v => String(v || '').replace(/<[^>]+>/g, '').trim();

  for (const k of Object.keys(pages)) {
    const p = pages[k];
    if (!p.imageinfo || !p.imageinfo[0]) continue;
    const ii = p.imageinfo[0];
    const meta = ii.extmetadata || {};
    const lic = strip(meta.LicenseShortName && meta.LicenseShortName.value);
    /* 라이선스를 못 읽으면 건너뜁니다 */
    if (!lic) continue;
    out.set(String(p.title).replace(/^File:/, ''), {
      src: ii.url,
      thumb: ii.thumburl || ii.url,
      page: ii.descriptionurl || '',
      license: lic,
      author: strip(meta.Artist && meta.Artist.value).slice(0, 200),
      caption: strip(meta.ImageDescription && meta.ImageDescription.value).slice(0, 400),
    });
  }
  return out;
}

/* 위키백과 주소에서 언어와 제목을 뽑습니다 */
function parseWiki(v) {
  const s = String(v || '');
  const m = /https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^\s"',]+)/i.exec(s);
  if (!m) return null;
  return { lang: m[1], title: decodeURIComponent(m[2]) };
}

async function main() {
  const T = TYPES[TYPE];
  if (!T) {
    console.error('type 은 person · org · school · venue 중 하나여야 합니다.');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  위키백과 대표 사진 수집                             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(SAVE ? '\n★ 실제로 담습니다 (--save)\n'
                   : '\n※ 담지 않고 몇 장을 얻을 수 있는지만 봅니다.\n');
  console.log('대상 : ' + T.label + ' (' + T.table + ')');

  /* ① 사진이 없는 사람 */
  let sel = 'id,' + T.name + ',' + T.name2 + ',' + T.imgCol;
  if (T.wiki) sel += ',' + T.wiki;
  const rows = await getAll(T.table + '?select=' + sel
    + '&' + T.imgCol + '=is.null&order=id.asc');
  console.log('사진 칸이 빈 ' + T.label + ' : ' + rows.length + '명');

  /* ② 이미 사진 저장소에 있는 사람은 건너뜁니다 */
  const have = new Set();
  try {
    const ph = await getAll('entity_photos?select=entity_id&entity_type=eq.'
      + TYPE + '&order=entity_id.asc');
    ph.forEach(r => have.add(r.entity_id));
    console.log('이미 사진이 있는 ' + T.label + ' : ' + have.size + '명');
  } catch (e) {
    console.log('사진 저장소를 읽지 못했습니다 · 걸러내지 않고 이어갑니다');
  }

  const todo = rows.filter(r => !have.has(r.id)).slice(0, LIMIT);
  console.log('이번에 볼 것 : ' + todo.length + '명 (상한 ' + LIMIT + ')\n');
  if (!todo.length) { console.log('볼 것이 없습니다.'); return; }

  /* ③ 위키백과에서 대표 사진 찾기 */
  const found = [];
  const why = new Map();
  let n = 0;

  for (const r of todo) {
    n++;
    if (n % 50 === 0) process.stdout.write('   ' + n + '/' + todo.length + '\r');

    /* 문서 주소가 있으면 그것을, 없으면 이름으로 찾습니다 */
    let cand = [];
    const w = T.wiki ? parseWiki(r[T.wiki]) : null;
    if (w) cand.push(w);
    if (r[T.name])  cand.push({ lang: 'ko', title: r[T.name] });
    if (r[T.name2]) cand.push({ lang: 'en', title: r[T.name2] });
    if (!cand.length) { why.set('이름 없음', (why.get('이름 없음') || 0) + 1); continue; }

    let got = null;
    let stopped = false;
    for (const c of cand) {
      try {
        got = await summaryPhoto(c.lang, c.title);
      } catch (e) {
        if (isStop(e)) { stopped = true; break; }
      }
      /* ★ 2026-08-08 · 0.22초는 너무 촘촘해서 위키백과가 막았습니다.
         첫 실행에서 400명 전부 「문서·사진 없음」으로 나왔는데,
         사진이 없어서가 아니라 물어보지도 못한 것이었습니다.
           ■ 요청 3건이 재시도를 모두 소진했습니다
         1초로 늘립니다. 250명이면 5~8분쯤 걸립니다. */
      await sleep(1000);
      if (got) break;
    }
    if (stopped) {
      console.log('\n★ 위키백과가 요청을 막았습니다. 여기까지만 모읍니다.');
      console.log('  20~30분 뒤에 다시 돌리시면 이어서 받습니다.');
      break;
    }

    if (!got) { why.set('문서·사진 없음', (why.get('문서·사진 없음') || 0) + 1); continue; }
    found.push({ row: r, file: got.file });
    if (DEBUG) console.log('   [찾음] ' + (r[T.name] || r[T.name2]) + ' → ' + got.file);
  }

  console.log('\n대표 사진을 찾은 ' + T.label + ' : ' + found.length + '명');
  [...why.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(5) + '  ' + k));

  if (!found.length) return;

  /* ④ 커먼즈에서 라이선스 확인 — 확인 못 하면 담지 않습니다 */
  console.log('\n라이선스를 확인합니다…');
  const rowsToSave = [];
  let noLic = 0;

  for (let i = 0; i < found.length; i += 40) {
    const part = found.slice(i, i + 40);
    const info = await commonsInfo(part.map(x => x.file));
    for (const x of part) {
      const d = info.get(x.file);
      if (!d) { noLic++; continue; }
      rowsToSave.push({
        entity_type: TYPE,
        entity_id: x.row.id,
        file_name: x.file,
        src: d.src,
        thumb: d.thumb,
        page_url: d.page || null,
        license: d.license,
        author: d.author || null,
        caption: d.caption || null,
        source: 'wikipedia-summary',
        /* ★ photo-commons.mjs 와 같은 칸을 채웁니다.
           kind · sort_no · is_primary 를 빠뜨렸다가 실제 코드를 보고 잡았습니다. */
        kind: 'photo',
        /* 위키데이터 P18 로 받은 사진이 대표가 되도록 뒤 번호를 씁니다.
           커먼즈 수집기가 10부터 쓰므로 그보다 앞인 5를 둡니다 —
           문서 첫머리 사진이 카테고리에서 아무거나 고른 것보다 낫습니다. */
        sort_no: 5,
        is_primary: false,
      });
    }
    await sleep(500);
  }

  console.log('   담을 수 있는 것 : ' + rowsToSave.length + '장');
  console.log('   라이선스를 못 읽어 뺀 것 : ' + noLic + '장');

  const show = Math.min(15, rowsToSave.length);
  if (show) {
    console.log('\n── 표본 ' + show + '장 ──');
    rowsToSave.slice(0, show).forEach((x, i) => {
      const r = found.find(f => f.row.id === x.entity_id);
      const nm = r ? (r.row[T.name] || r.row[T.name2]) : ('#' + x.entity_id);
      console.log('   ' + String(i + 1).padStart(3) + '. ' + nm
        + '   [' + x.license + ']');
    });
  }

  if (!SAVE) {
    console.log('\n※ 아무것도 담지 않았습니다.');
    console.log('  ' + rowsToSave.length + '장을 담으시려면 --save 를 주십시오.');
    return;
  }
  if (!rowsToSave.length) { console.log('\n담을 것이 없습니다.'); return; }

  console.log('\n── 담는 중 ──');
  let ok = 0;
  for (let i = 0; i < rowsToSave.length; i += 50) {
    const part = rowsToSave.slice(i, i + 50);
    try {
      await rest('entity_photos?on_conflict=entity_type,entity_id,file_name', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(part)
      });
      ok += part.length;
    } catch (e) {
      console.log('   [실패] ' + String(e.message || '').slice(0, 120));
    }
    process.stdout.write('   ' + ok + '/' + rowsToSave.length + '\r');
  }
  console.log('   담기 끝 · ' + ok + '장        ');
  console.log('\n※ 목록 화면은 entity_photo_main 을 보므로 바로 반영됩니다.');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
