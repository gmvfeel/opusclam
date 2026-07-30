/* ============================================================
   OPUSCLAM 정보SPOT 사진·로고 수집 — seed/spot-photo.mjs

   무엇을 하나
    · 정보SPOT 항목(축제·콩쿠르·기관·공연장)의 사진과 로고를
      위키데이터·커먼즈에서 찾아 채웁니다
    · 우리 서버에 파일을 두지 않고 커먼즈 주소를 그대로 가리킵니다
      (저장 공간이 들지 않고, 원본이 바뀌면 함께 바뀝니다)

   왜 위키데이터인가
    · 축제·콩쿠르는 대부분 위키데이터에 항목이 있고
      P154(로고)와 P18(대표 사진)이 붙어 있습니다
    · 커먼즈 사진은 라이선스가 밝혀져 있어 표기만 하면 쓸 수 있습니다
    · 값이 들지 않고, 새 항목이 들어와도 이 수집기를 다시 돌리면 채워집니다

   어떻게 찾나
    1) 위키데이터에 이름으로 물어봅니다 (영문 이름을 먼저 씁니다)
    2) 찾은 후보가 정말 그것인지 확인합니다
       — 갈래(P31)가 축제·경연·기관·공연장 계열인지 봅니다
       — 엉뚱한 항목을 잡으면 사진이 통째로 어긋나므로 이 확인이 중요합니다
    3) P154 로고 · P18 사진을 가져옵니다
    4) 커먼즈에서 축소본 주소와 라이선스·저작자를 받습니다
    5) spot 표의 logo_url · thumb_url · photo_credit · wikidata_id 를 채웁니다

   쓰는 법
     node seed/spot-photo.mjs                    사진 없는 항목 전체
     node seed/spot-photo.mjs --section=페스티벌   한 갈래만
     node seed/spot-photo.mjs --limit=10          열 건만
     node seed/spot-photo.mjs --dry               저장하지 않고 찾은 것만 봅니다
     node seed/spot-photo.mjs --force             이미 채워진 것도 다시 찾습니다

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { makeGetJSON, isStop, sleep } from '../scripts/lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

/* 위키미디어는 연락처가 담긴 User-Agent 를 요구합니다 */
const UA = 'OpusclamSpotPhotoBot/1.0 (https://opusclam.com; contact@opusclam.com)';
const wdGet      = makeGetJSON({ ua: UA, accept: 'application/json' });
const commonsGet = makeGetJSON({ ua: UA, accept: 'application/json' });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const ONLY_SEC = args.section ? String(args.section) : null;
const LIMIT    = Number(args.limit || 200);
const DRY      = !!args.dry;
const FORCE    = !!args.force;

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
   1) 채울 대상 — 사진이 없는 항목
   ============================================================ */
async function loadTargets() {
  let q = 'spot?select=id,section,title,title_en,country,city,organizer,link_url,'
        + 'wikidata_id,logo_url,thumb_url'
        + '&video_id=is.null'                      /* 영상은 유튜브 썸네일을 이미 씁니다 */
        + '&hidden=is.false'
        + `&limit=${LIMIT}`;
  if (ONLY_SEC) q += '&section=eq.' + encodeURIComponent(ONLY_SEC);
  if (!FORCE)   q += '&thumb_url=is.null';
  const rows = await sb(q);
  return rows || [];
}

/* ============================================================
   2) 위키데이터에서 항목 찾기
   ============================================================ */

/* 갈래(P31)가 이 가운데 하나에 닿으면 「맞는 항목」으로 봅니다.
   엉뚱한 항목을 잡으면 사진이 통째로 어긋나므로 이 확인이 중요합니다. */
const OK_KINDS = new Set([
  'Q132241',   // 축제 festival
  'Q868557',   // 음악 축제 music festival
  'Q54958201', // 클래식 음악 축제
  'Q2627728',  // 오페라 축제
  'Q2138848',  // 경연 competition
  'Q26898',    // 음악 경연 music competition
  'Q841654',   // 피아노 경연
  'Q43229',    // 조직 organization
  'Q31855',    // 연구기관
  'Q163740',   // 비영리 단체
  'Q1614493',  // 콘서트홀 concert hall
  'Q24354',    // 극장 theater
  'Q153562',   // 오페라 하우스
  'Q17350442', // 공연장 venue
  'Q18127',    // 음반사 record label
  'Q327333',   // 정부 기관
  'Q7075',     // 도서관
  'Q3918',     // 대학
  'Q875538',   // 공립 대학
  'Q4671277',  // 학술 기관
]);

async function wdSearch(name, lang) {
  const url = 'https://www.wikidata.org/w/api.php'
    + '?action=wbsearchentities&format=json&origin=*'
    + '&type=item&limit=5'
    + '&language=' + lang + '&uselang=' + lang
    + '&search=' + encodeURIComponent(name);
  const j = await wdGet(url);
  return (j && j.search) ? j.search : [];
}

async function wdEntities(qids) {
  if (!qids.length) return {};
  const url = 'https://www.wikidata.org/w/api.php'
    + '?action=wbgetentities&format=json&origin=*'
    + '&props=claims|labels&languages=ko|en'
    + '&ids=' + qids.join('|');
  const j = await wdGet(url);
  return (j && j.entities) ? j.entities : {};
}

function claimValues(ent, prop) {
  const c = ent && ent.claims && ent.claims[prop];
  if (!c) return [];
  return c.map((x) => x.mainsnak && x.mainsnak.datavalue && x.mainsnak.datavalue.value)
          .filter(Boolean);
}

/* 이것은 절대 아닙니다. 사진이 붙어 있어도 거릅니다.
   「잘츠부르크 페스티벌」 로 찾다가 사람이나 도시가 잡히면
   엉뚱한 인물 사진·풍경 사진이 들어가게 됩니다. */
const NO_KINDS = new Set([
  'Q5',        // 사람
  'Q515',      // 도시
  'Q6256',     // 나라
  'Q3957',     // 마을
  'Q486972',   // 사람이 사는 곳
  'Q11424',    // 영화
  'Q7889',     // 비디오게임
  'Q482994',   // 음반
  'Q134556',   // 싱글
  'Q7366',     // 노래
  'Q105543609',// 음악 작품
  'Q2188189',  // 음악 작품(다른 갈래)
  'Q571',      // 책
  'Q7725634',  // 문학 작품
  'Q13442814', // 학술 논문
  'Q4830453',  // 사업체
  'Q431289',   // 상표
]);

/* ── 이름이 실제로 닿는지 확인합니다 ──

   이것이 없어서 첫 시험에서 엉뚱한 사진이 들어갔습니다.
     「롱티보 국제 콩쿠르」 로 찾았는데 「리즈 국제 피아노 콩쿠르」 문서가 잡히고,
     갈래가 「음악 경연」 이라 그대로 통과했습니다.
     「인디애나폴리스」 에는 차이콥스키 콩쿠르가, 「아르코 국제교류」 에는
     예술의전당 사진이 들어갔습니다.

   방법 — 우리 이름에서 갈래를 뜻하는 말을 떼어내고 남은 고유명사가
   찾은 이름 안에 있어야 합니다. 「롱티보」 가 「리즈…」 에 없으므로 걸러집니다. */

/* 갈래·꾸밈을 뜻하는 말 — 고유명사가 아니므로 견줄 때 뺍니다 */
const GENERIC = new RegExp(
  '(국제|전국|세계|음악|콩쿠르|콩쿨|경연|대회|페스티벌|축제|음악제|음악축제|음악회|'
  + '피아노|바이올린|첼로|성악|작곡|관악|국악|현악|지휘|실내악|오페라|'
  + '지원|사업|공모|공연예술|예술|재단|위원회|센터|협회|연맹|기금|'
  + 'international|national|world|music|musical|competition|concours|concorso|'
  + 'wettbewerb|festival|festspiele|festspiel|piano|violin|cello|voice|vocal|'
  + 'composition|award|prize|foundation|council|center|centre|association|federation|'
  + 'the|of|for|and|de|du|des|la|le|les|von|der|die|das|und|und|in|at|'
  + '주최|주관|기념|제\\d+회|\\d{4})', 'gi');

/* 견줄 수 있게 다듬습니다 — 갈래어를 떼고 기호·빈칸을 없앱니다 */
function coreOf(name) {
  let t = String(name || '')
    .replace(/[(（][^)）]*[)）]/g, ' ')      /* 괄호 안 제거 */
    .replace(GENERIC, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')       /* 글자와 숫자만 남깁니다 */
    .toLowerCase();
  return t;
}

/* 우리 이름의 고유명사가 찾은 이름 안에 있는지 봅니다.
   한쪽이 다른 쪽에 담기면 맞는 것으로 봅니다
   (「Tanglewood」 ↔ 「Tanglewood Music Center」 처럼 길이가 다를 수 있습니다). */
function nameMatches(ourName, foundName) {
  const a = coreOf(ourName), b = coreOf(foundName);
  if (!a || !b) return false;
  if (a.length < 2 || b.length < 2) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  if (b.length >= 3 && a.includes(b)) return true;
  /* 앞 세 글자만 같은 것으로는 인정하지 않습니다 — 「리즈」와 「롱티보」 를 가릅니다 */
  return false;
}

/* 이 항목이 우리가 찾던 것인지 확인합니다 */
function looksRight(ent) {
  const kinds = claimValues(ent, 'P31').map((v) => v && v.id).filter(Boolean);
  /* ① 절대 아닌 것부터 거릅니다 */
  if (kinds.some((k) => NO_KINDS.has(k))) return false;
  /* ② 축제·경연·기관·공연장 계열이면 받아들입니다 */
  if (kinds.some((k) => OK_KINDS.has(k))) return true;
  /* ③ 갈래가 목록에 없어도 로고나 사진이 붙어 있으면 받아들입니다.
        위키데이터의 갈래는 아주 잘게 나뉘어 있어 목록으로 다 담을 수 없습니다.
        다만 ① 에서 사람·지명·작품을 이미 걸렀으므로 크게 어긋날 일은 없습니다. */
  return claimValues(ent, 'P154').length > 0 || claimValues(ent, 'P18').length > 0;
}

/* ============================================================
   2-2) 위키백과를 거쳐 찾기

   위키데이터 검색은 이름이 라벨과 거의 같아야 걸립니다.
   그래서 「ARD 뮌헨 국제음악콩쿠르」 처럼 우리가 붙인 이름으로는
   위키데이터에 항목이 분명히 있어도 못 찾는 일이 많습니다.

   위키백과 검색은 훨씬 관대합니다. 문서를 찾으면
     · 그 문서에 붙은 위키데이터 번호(wikibase_item) 를 얻고
     · 문서 대표 이미지(pageimage) 도 함께 얻습니다
   대표 이미지는 위키데이터에 P18 이 없는 항목에도 있는 일이 많습니다.
   ============================================================ */
async function wpSearch(name, lang) {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  /* 이름으로 문서를 찾습니다 */
  const s1 = await wdGet(base + '?action=query&format=json&origin=*'
    + '&list=search&srlimit=3&srsearch=' + encodeURIComponent(name));
  const hits = (s1 && s1.query && s1.query.search) || [];
  if (!hits.length) return null;

  /* 찾은 문서들의 위키데이터 번호와 대표 이미지를 한 번에 받습니다 */
  const titles = hits.map((h) => h.title).join('|');
  const s2 = await wdGet(base + '?action=query&format=json&origin=*'
    + '&prop=pageprops|pageimages&ppprop=wikibase_item&piprop=original'
    + '&titles=' + encodeURIComponent(titles));
  const pages = (s2 && s2.query && s2.query.pages) || {};
  const out = [];
  for (const k of Object.keys(pages)) {
    const p = pages[k];
    if (Number(k) < 0) continue;
    out.push({
      title: p.title,
      qid: p.pageprops && p.pageprops.wikibase_item,
      /* original.source 는 커먼즈 원본 주소입니다 (파일 이름만 떼어 씁니다) */
      imageFile: p.original && p.original.source
        ? decodeURIComponent(String(p.original.source).split('/').pop())
        : null,
    });
  }
  /* 찾은 순서를 지킵니다 (검색이 매긴 관련도 순) */
  out.sort((a, b) => hits.findIndex((h) => h.title === a.title)
                   - hits.findIndex((h) => h.title === b.title));
  return out.length ? out : null;
}

/* ============================================================
   3) 커먼즈 — 축소본 주소와 라이선스·저작자
   ============================================================ */
async function commonsInfo(fileNames) {
  if (!fileNames.length) return new Map();
  const titles = fileNames.map((f) => 'File:' + f).join('|');
  const url = 'https://commons.wikimedia.org/w/api.php'
    + '?action=query&format=json&origin=*&prop=imageinfo'
    + '&iiprop=url|extmetadata&iiurlwidth=1000'
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
      thumb: ii.thumburl || ii.url,
      page: ii.descriptionurl || '',
      license: strip(meta.LicenseShortName && meta.LicenseShortName.value),
      author: strip(meta.Artist && meta.Artist.value).slice(0, 160),
    });
  }
  return out;
}

/* 저작자 표기 — 커먼즈 사진은 라이선스에 따라 표기가 필요합니다 */
function creditText(info) {
  const bits = [];
  if (info.author) bits.push(info.author);
  if (info.license) bits.push(info.license);
  const s = bits.join(' · ');
  return s ? ('사진 ' + s + ' (위키미디어 커먼즈)') : '위키미디어 커먼즈';
}

/* ============================================================
   4) 한 항목 처리
   ============================================================ */
/* 이미 쓴 위키데이터 항목 — 같은 사진이 여러 자료에 들어가는 것을 막습니다.
   첫 시험에서 예술의전당 사진이 아르코 지원사업에도 들어갔습니다. */
const usedQids = new Set();

async function handleOne(r) {
  /* ① 위키데이터 번호를 이미 알면 그대로 씁니다 */
  let qid = r.wikidata_id || null;
  let ent = null;
  let wpImage = null;   /* 위키데이터에 사진이 없을 때 쓰는 위키백과 대표 이미지 */

  if (qid) {
    const ents = await wdEntities([qid]);
    ent = ents[qid] || null;
  } else {
    /* ② 이름으로 찾습니다. 영문 이름을 먼저 쓰고, 없으면 우리말 이름을 씁니다.
          우리말 이름에서는 「국제·페스티벌·콩쿠르」 처럼 갈래를 뜻하는 말이
          위키데이터 표기와 어긋나는 일이 많아 영문이 훨씬 잘 맞습니다. */
    const tries = [];
    if (r.title_en) tries.push([r.title_en, 'en']);
    tries.push([String(r.title || '').replace(/\s*[(（][^)）]*[)）]/g, '').trim(), 'ko']);

    for (const [name, lang] of tries) {
      if (!name) continue;
      let hits = [];
      try { hits = await wdSearch(name, lang); }
      catch (e) { continue; }
      if (!hits.length) continue;
      const ents = await wdEntities(hits.slice(0, 3).map((h) => h.id));
      for (const h of hits.slice(0, 3)) {
        const e = ents[h.id];
        if (!e || !looksRight(e)) continue;
        /* 이름이 실제로 닿는지 봅니다.
           견줄 때는 「찾을 때 쓴 언어」 의 라벨만 씁니다 —
           한글 이름과 영문 라벨은 글자가 달라 견줄 수 없습니다
           (「쇼팽」 ↔ 「Chopin」 은 같은 것인데 글자로는 하나도 겹치지 않습니다).
           별칭으로 걸린 경우(h.match)는 그 별칭도 함께 봅니다. */
        const cand = [h.label, h.match && h.match.text,
                      e.labels && e.labels[lang] && e.labels[lang].value]
                     .filter(Boolean);
        if (!cand.some((c) => nameMatches(name, c))) continue;
        qid = h.id; ent = e; break;
      }
      if (ent) break;
      await sleep(200);
    }

    /* ③ 위키데이터 검색이 빗나가면 위키백과를 거쳐 찾습니다.
          이름이 조금 달라도 문서를 찾아내므로 훨씬 잘 걸립니다. */
    if (!ent) {
      for (const [name, lang] of tries) {
        if (!name) continue;
        let cands = null;
        try { cands = await wpSearch(name, lang === 'ko' ? 'ko' : 'en'); }
        catch (e) { continue; }
        if (!cands) continue;
        /* 위키데이터 번호가 붙은 후보를 먼저 확인합니다 */
        /* 문서 제목이 우리 이름과 실제로 닿는 것만 남깁니다.
           위키백과 검색은 관대해서 이름이 조금만 비슷해도 결과를 냅니다. */
        const withQ = cands.filter((c) => c.qid && nameMatches(name, c.title));
        if (withQ.length) {
          const ents = await wdEntities(withQ.map((c) => c.qid));
          for (const c of withQ) {
            const e = ents[c.qid];
            if (e && looksRight(e)) {
              qid = c.qid; ent = e;
              /* 위키데이터에 사진이 없으면 위키백과 대표 이미지를 씁니다 */
              if (c.imageFile && !claimValues(e, 'P18').length) wpImage = c.imageFile;
              break;
            }
          }
        }
        if (ent) break;
        await sleep(200);
      }
    }
  }

  if (!ent) return { ok: false, why: '위키데이터·위키백과에서 찾지 못함',
                     tried: [r.title_en, r.title].filter(Boolean).join(' / ') };

  /* 다른 자료가 이미 쓴 항목이면 물리칩니다 */
  if (usedQids.has(qid) && qid !== r.wikidata_id) {
    return { ok: false, why: '다른 자료가 이미 쓰고 있는 항목', qid: qid };
  }

  /* ③ 로고와 사진 */
  const logoFile = claimValues(ent, 'P154')[0] || null;   // 로고
  /* 위키데이터 대표 사진(P18)이 없으면 위키백과 문서 대표 이미지를 씁니다 */
  const imgFile  = claimValues(ent, 'P18')[0] || wpImage || null;
  if (!logoFile && !imgFile) return { ok: false, why: '로고·사진을 찾지 못함', qid: qid };

  const info = await commonsInfo([logoFile, imgFile].filter(Boolean));
  const logo = logoFile ? info.get(logoFile) : null;
  const img  = imgFile  ? info.get(imgFile)  : null;
  if (!logo && !img) return { ok: false, why: '커먼즈에서 파일을 읽지 못함', qid: qid };

  const patch = { wikidata_id: qid };
  if (logo) patch.logo_url = logo.thumb;
  if (img) {
    patch.thumb_url = img.thumb;
    patch.photo_credit = creditText(img);
  } else if (logo) {
    /* 사진이 없고 로고만 있으면 로고를 대표 그림으로도 씁니다 */
    patch.thumb_url = logo.thumb;
    patch.photo_credit = creditText(logo);
  }
  usedQids.add(qid);
  return { ok: true, qid: qid, patch: patch, hasLogo: !!logo, hasImg: !!img };
}

/* ============================================================
   5) 실행
   ============================================================ */
async function main() {
  console.log('── 정보SPOT 사진·로고 수집 ──');

  /* 이미 담긴 위키데이터 항목을 먼저 알아 둡니다 —
     이번에 찾은 것이 그것과 겹치면 물리칩니다. */
  try {
    const used = await sb('spot?select=wikidata_id&wikidata_id=not.is.null&limit=1000');
    for (const u of (used || [])) if (u.wikidata_id) usedQids.add(u.wikidata_id);
    if (usedQids.size) console.log(`이미 쓰고 있는 위키데이터 항목 ${usedQids.size}개`);
  } catch (e) {}

  const rows = await loadTargets();
  console.log(`대상 ${rows.length}건${DRY ? ' · 저장 안 함(dry)' : ''}${FORCE ? ' · 다시 찾기' : ''}`);
  if (!rows.length) return;

  let done = 0, miss = 0;
  for (const r of rows) {
    if (isStop()) { console.log('시간·실패 한도에 걸려 여기까지 하고 멈춥니다.'); break; }

    let res;
    try { res = await handleOne(r); }
    catch (e) { console.log(`  [실패] ${r.title} — ${e.message}`); miss++; await sleep(300); continue; }

    if (!res.ok) {
      console.log(`  [못 찾음] ${String(r.title).slice(0, 34)} — ${res.why}`
        + (res.qid ? ` (${res.qid})` : '')
        + (res.tried ? `\n             찾아본 이름: ${res.tried}` : ''));
      miss++;
      /* 번호는 찾았으면 적어 둡니다 — 나중에 손으로 사진을 넣을 때 도움이 됩니다 */
      if (res.qid && !DRY && !r.wikidata_id) {
        try {
          await sb(`spot?id=eq.${r.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ wikidata_id: res.qid }),
          });
        } catch (e) {}
      }
      await sleep(250);
      continue;
    }

    const mark = (res.hasLogo ? '로고' : '') + (res.hasLogo && res.hasImg ? '+' : '') + (res.hasImg ? '사진' : '');
    console.log(`  [채움] ${String(r.title).slice(0, 34)} — ${mark} (${res.qid})`);
    if (!DRY) {
      try {
        await sb(`spot?id=eq.${r.id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(res.patch),
        });
      } catch (e) { console.log(`         저장 실패: ${e.message}`); miss++; await sleep(250); continue; }
    }
    done++;
    await sleep(250);
  }

  console.log(`\n── 끝 ──`);
  console.log(`채운 것 ${done}건 · 못 찾은 것 ${miss}건`);
  if (DRY) console.log('※ --dry 였으므로 아무것도 저장하지 않았습니다.');
  else if (miss) console.log('※ 못 찾은 것은 위키데이터에 항목이나 사진이 없는 경우입니다.'
    + ' 그런 항목은 로고 배지(logo_text)가 그대로 쓰입니다.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
