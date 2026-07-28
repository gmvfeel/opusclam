// ============================================================
// OPUSCLAM 학술(academic) 자동 수집기 (v1 · 충실도 우선)
//  - 소스: OpenAlex (무료 · 인증 불필요 · mailto 로 polite pool 사용)
//  - 음악 세부분야를 자동으로 찾아낸 뒤 연도 구간별로 나눠 수집합니다
//  - 초록은 OpenAlex 가 단어 위치를 뒤집어 주므로 문장으로 복원합니다
//  - 충실도 컷오프 · 충실도 정렬 · 빈칸보강 · 사람값 보호 · 중복방지
//  - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
//              ACADEMIC_FULL=1 이면 전체 구간, 없으면 최근분만 갱신
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1';
const MAIL    = 'cser@wixon.co.kr';          // OpenAlex polite pool
const UA      = 'OpusclamBot/1.0 (https://opusclam.com; ' + MAIL + ')';
const OA      = 'https://api.openalex.org';
const FULL    = process.env.ACADEMIC_FULL === '1';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

// 한 쿼리에서 가져올 상한 (무료 실행 시간을 지키기 위한 안전장치)
const CAP_PER_QUERY = FULL ? 900 : 300;

// ── 공통 유틸 ────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';
const clean = (s) => isEmpty(s) ? null : String(s).replace(/\s+/g, ' ').trim();

// GitHub Actions 는 여러 사용자가 IP 를 공유하므로 429(요청 과다)가 자주 납니다.
// 우리 요청 빈도 탓이 아니라 남이 쓴 몫까지 합산되기 때문입니다.
// 그래서 오래 기다렸다 다시 시도합니다. Retry-After 를 주면 그만큼 따릅니다.
const BACKOFF = [5000, 15000, 30000, 60000, 90000, 120000];

async function getJSON(url, tries = 6) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 429 || r.status >= 500) {
        const ra = Number(r.headers.get('retry-after'));
        const wait = (ra > 0 ? ra * 1000 : 0) || BACKOFF[i] || 120000;
        last = new Error('HTTP ' + r.status);
        if (i < tries - 1) {
          console.log('    (' + r.status + ' · ' + Math.round(wait / 1000) + '초 기다린 뒤 다시 시도 '
                      + (i + 2) + '/' + tries + ')');
          await sleep(wait);
          continue;
        }
        throw last;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return await r.json();
    } catch (e) {
      last = e;
      if (i === tries - 1) throw last;
      if (!/HTTP (429|5\d\d)/.test(String(e.message))) await sleep(BACKOFF[i] || 60000);
    }
  }
  throw last;
}

// ── OpenAlex 초록 복원 ───────────────────────────────────────
// abstract_inverted_index 는 { 단어: [위치, ...] } 형태입니다.
function unabstract(inv) {
  if (!inv || typeof inv !== 'object') return null;
  const pos = [];
  for (const w of Object.keys(inv)) {
    const idxs = inv[w];
    if (!Array.isArray(idxs)) continue;
    for (const i of idxs) pos[i] = w;
  }
  const s = pos.filter(Boolean).join(' ').replace(/\s+([,.;:)])/g, '$1').trim();
  return s.length < 40 ? null : s.slice(0, 2000);
}

// ── 음악 세부분야 자동 탐색 ──────────────────────────────────
// subfield 번호를 코드에 박아두면 분류 체계가 바뀔 때 조용히 실패합니다.
// 그래서 실행할 때마다 이름으로 찾아내고 로그에 남깁니다.
// 탐색 자체가 막히면(429 등) 아래 대비값으로 진행하고 그 사실을 로그에 남깁니다.
const FALLBACK_SUBFIELD = { id: '1210', name: 'Music(대비값 · 미확인)' };

async function findMusicSubfields() {
  const found = new Map();   // id -> name
  const probes = ['music', 'musicology', 'ethnomusicology'];
  let okAny = false;

  for (const q of probes) {
    let d = null;
    try {
      d = await getJSON(OA + '/topics?filter=display_name.search:' + encodeURIComponent(q)
                        + '&per-page=200&mailto=' + MAIL);
      okAny = true;
    } catch (e) {
      console.log('  · 분야 탐색 실패(' + q + ') ·', String(e.message).slice(0, 60));
      continue;
    }
    for (const t of (d.results || [])) {
      const sf = t.subfield;
      if (!sf || !sf.id) continue;
      const nm = String(sf.display_name || '');
      // 음악 자체인 세부분야만 취합니다.
      // 'Visual Arts and Performing Arts' 처럼 음악 외 예술이 섞인 것은 제외합니다.
      if (/^music$/i.test(nm)) found.set(String(sf.id), nm);
    }
    await sleep(1500);
  }

  if (found.size) {
    return [...found.entries()].map(([id, name]) => ({ id: id.split('/').pop(), name }));
  }
  // 이름으로 못 찾은 경우
  console.log('  · 세부분야를 확인하지 못했습니다'
              + (okAny ? ' (응답은 왔으나 Music 이 없었습니다)' : ' (요청이 막혔습니다)')
              + ' · 대비값 ' + FALLBACK_SUBFIELD.id + ' 으로 진행합니다.');
  console.log('    수집 후 topic_raw 컬럼을 보시면 분류가 맞는지 확인할 수 있습니다.');
  return [FALLBACK_SUBFIELD];
}

// ── 수집 쿼리 목록 ───────────────────────────────────────────
function buildQueries(subfieldIds) {
  const sf = subfieldIds.join('|');
  const qs = [];

  if (sf) {
    // 음악 세부분야 · 연도 구간별로 나눠 담습니다 (한쪽 시기에 쏠리지 않게)
    const spans = FULL
      ? [[1990, 1999], [2000, 2009], [2010, 2015], [2016, 2020], [2021, 2026]]
      : [[2023, 2026]];
    for (const [a, b] of spans) {
      qs.push({
        label: '음악 ' + a + '–' + b,
        filter: 'primary_topic.subfield.id:' + sf
              + ',from_publication_date:' + a + '-01-01'
              + ',to_publication_date:' + b + '-12-31'
              + ',has_abstract:true',
        sort: 'cited_by_count:desc',
      });
    }
    // 한국 소속 저자의 음악 연구는 시기 제한 없이 모읍니다 (국내 자료가 귀합니다)
    qs.push({
      label: '한국 소속 저자',
      filter: 'primary_topic.subfield.id:' + sf
            + ',authorships.institutions.country_code:kr',
      sort: 'publication_year:desc',
    });
  }

  // 세부분야로 안 잡히는 주변 영역은 검색어로 보완합니다.
  const topics = FULL
    ? ['music education', 'music therapy', 'musical acoustics',
       'Korean traditional music', 'church music', 'music technology',
       'conducting orchestra', 'music analysis theory']
    : ['music education', 'Korean traditional music'];
  for (const t of topics) {
    qs.push({
      label: '검색: ' + t,
      search: t,
      filter: 'has_abstract:true,type:article',
      sort: 'cited_by_count:desc',
    });
  }
  return qs;
}

// ── 한 쿼리 수집 (cursor 페이징) ─────────────────────────────
const SELECT = [
  'id', 'doi', 'title', 'display_name', 'publication_year', 'language', 'type',
  'authorships', 'primary_location', 'biblio', 'abstract_inverted_index',
  'cited_by_count', 'open_access', 'primary_topic', 'keywords',
].join(',');

async function fetchQuery(q) {
  const out = [];
  let cursor = '*';
  while (out.length < CAP_PER_QUERY) {
    let url = OA + '/works?per-page=200&cursor=' + encodeURIComponent(cursor)
            + '&select=' + SELECT + '&mailto=' + MAIL;
    if (q.filter) url += '&filter=' + encodeURIComponent(q.filter);
    if (q.search) url += '&search=' + encodeURIComponent(q.search);
    if (q.sort)   url += '&sort=' + encodeURIComponent(q.sort);

    const d = await getJSON(url);
    const rows = d.results || [];
    out.push(...rows);
    cursor = d.meta && d.meta.next_cursor;
    if (!cursor || rows.length === 0) break;
    await sleep(900);   // 요청 과다(429) 를 피하려고 넉넉히 둡니다
  }
  return out.slice(0, CAP_PER_QUERY);
}

// ── 분야 매핑 (기존 12개 분야에 맞춥니다) ────────────────────
// 주의 · 정규식을 고칠 때 두 가지를 지켜야 합니다.
//  (1) 어간으로 잡으려면 뒤쪽에 \b 를 붙이지 않습니다.
//      \bacoustic\b 는 'acoustics' 를 놓칩니다. \bacoustic 이라야 잡힙니다.
//  (2) 반대로 흔한 낱말은 완전 단어로 묶어야 합니다.
//      \borgan 으로 두면 'organization' 이 교회음악으로 잡힙니다.
//      \bconduct 로 두면 'the study was conducted' 가 지휘로 잡힙니다.
const FIELD_RULES = [
  [/\b(church music|sacred music|liturg|hymn|plainchant|gregorian|organs?\b|chorale)/i, '교회음악'],
  [/(korean traditional|gugak|pansori|sanjo|nongak|gagok|jeongak|samulnori)/i,          '국악'],
  [/\b(music education|music teacher|pedagog|curricul|classroom|music learning)/i,      '음악교육'],
  [/\b(acoustic|psychoacoust|reverberat|sound field|room response|vibrato analysis)/i,  '음향학'],
  [/\b(music information retrieval|signal processing|sound synthesis|midi|audio engineering|machine learning|computational music|deep learning)/i, '음악공학'],
  [/\b(music industry|streaming platform|copyright|music market|music consumption|record label)/i, '음악산업'],
  [/\b(conductor|conducting|orchestral direction|kapellmeister)/i,                      '지휘'],
  [/\b(composition|compositional|composer|twelve-tone|serialism|spectral music|electroacoustic|aleatoric)/i, '작곡'],
  [/\b(performance practice|interpretation|recital|virtuos|orchestra|ensemble|chamber music|historically informed)/i, '연주·공연'],
  [/\b(harmon|counterpoint|schenker|set theory|music analysis|tonality|tonal|modal|musical form)/i, '음악이론'],
  [/\b(music history|baroque|renaissance|medieval|classical period|romantic|19th-century|18th-century|reception history|manuscript)/i, '음악사'],
];
function toField(w) {
  const hay = [
    w.display_name || w.title || '',
    (w.primary_topic && w.primary_topic.display_name) || '',
    (w.keywords || []).map(k => k.display_name || '').join(' '),
  ].join(' ');
  for (const [re, name] of FIELD_RULES) if (re.test(hay)) return name;
  return '음악학';   // 기본값
}

// ── 유형·배지·언어 매핑 ─────────────────────────────────────
function toType(w) {
  const t = String(w.type || '').toLowerCase();
  if (t === 'dissertation' || t === 'thesis') return '학위논문';
  if (t === 'book' || t === 'monograph' || t === 'book-chapter') return '연구서';
  return '학술논문';
}
const AVA = { '학술논문': '논', '학위논문': '학', '연구서': '서', '저널 · 학술지': '저' };

const LANG = { ko: '국문', en: '영문', de: '독문', fr: '불문', it: '이문', ja: '일문', zh: '중문', es: '서문', ru: '노문' };
function toLang(code) { return LANG[String(code || '').toLowerCase()] || null; }

// ── 한 건을 표 형식으로 ──────────────────────────────────────
function toRow(w) {
  const title = clean(w.display_name || w.title);
  if (!title) return null;

  const ko = /[가-힣]/.test(title);
  const auth = (w.authorships || [])
    .map(a => (a.author && a.author.display_name) || a.raw_author_name)
    .filter(Boolean);
  const affil = (w.authorships || [])
    .flatMap(a => (a.institutions || []).map(i => i.display_name))
    .filter(Boolean);

  const src = w.primary_location && w.primary_location.source;
  const bib = w.biblio || {};
  const pages = (bib.first_page && bib.last_page)
    ? bib.first_page + '–' + bib.last_page
    : (bib.first_page || null);

  const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, '') : null;
  const oa  = w.open_access || {};
  const type = toType(w);

  return {
    name_ko:   ko ? title : null,
    name_en:   ko ? null : title,
    ava:       AVA[type] || '논',
    type,
    author:    auth.length ? auth.slice(0, 8).join(', ') : null,
    pub_year:  w.publication_year ? String(w.publication_year) : null,
    publisher: clean(src && src.display_name),
    field:     toField(w),
    language:  toLang(w.language),
    keywords:  (w.keywords || []).map(k => k.display_name).filter(Boolean).slice(0, 8).join(', ') || null,
    description: unabstract(w.abstract_inverted_index),
    link_full: oa.is_oa && oa.oa_url ? oa.oa_url : null,
    link_cite: doi ? 'https://doi.org/' + doi : null,
    doi,
    volume:    clean(bib.volume),
    issue:     clean(bib.issue),
    pages:     clean(pages),
    cited_by:  Number(w.cited_by_count || 0),
    is_oa:     !!oa.is_oa,
    affil:     affil.length ? [...new Set(affil)].slice(0, 5).join(', ') : null,
    topic_raw: clean(w.primary_topic && w.primary_topic.display_name),
    source:    'openalex',
    source_id: String(w.id || '').split('/').pop() || null,
    is_oc:     false,
    hidden:    false,
  };
}

// ── 충실도 판정 ─────────────────────────────────────────────
// 이름만 있는 항목은 넣지 않습니다. (데이터 품질 우선 원칙)
function substanceCount(r) {
  let n = 0;
  if (r.author) n++;
  if (r.pub_year) n++;
  if (r.publisher) n++;
  if (r.description) n++;
  if (r.doi) n++;
  return n;
}
function keep(r) {
  if (!r) return false;
  if (!r.name_ko && !r.name_en) return false;
  if (!r.source_id) return false;
  const t = (r.name_ko || r.name_en);
  if (t.length < 8) return false;
  return substanceCount(r) >= 3;      // 저자·연도·학술지·초록·DOI 중 3개 이상
}
function richness(r) {
  // 큰 값이 앞으로 오게 정렬합니다.
  let s = substanceCount(r) * 10;
  if (r.description) s += Math.min(20, Math.floor(String(r.description).length / 120));
  if (r.is_oa) s += 4;
  s += Math.min(12, Math.floor(Number(r.cited_by || 0) / 25));
  return s;
}

// ── Supabase ────────────────────────────────────────────────
async function sbGetAll(table, select) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select,
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + r.status + ' ' + await r.text());
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < STEP) break;
    from += STEP;
  }
  return out;
}

async function sbInsert(rows) {
  if (!rows.length) return { ok: 0, dup: 0 };
  const post = (batch) => fetch(SUPABASE_URL + '/rest/v1/academic', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(batch),
  });
  const r = await post(rows);
  if (r.ok) return { ok: rows.length, dup: 0 };

  const txt = await r.text();
  // 이미 있는 항목 때문이면 한 건씩 넣어 중복만 건너뜁니다.
  // (on_conflict 방식은 이 환경에서 제약을 인식하지 못해 쓰지 않습니다)
  if (r.status === 409 || txt.indexOf('23505') >= 0) {
    let ok = 0, dup = 0;
    for (const row of rows) {
      const r2 = await post([row]);
      if (r2.ok) { ok++; continue; }
      const t2 = await r2.text();
      if (r2.status === 409 || t2.indexOf('23505') >= 0) { dup++; continue; }
      throw new Error('INSERT ' + r2.status + ' ' + t2);
    }
    return { ok, dup };
  }
  throw new Error('INSERT ' + r.status + ' ' + txt);
}

async function sbUpdate(id, patch) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/academic?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('UPDATE ' + r.status + ' ' + await r.text());
}

// 사람이 채운 값은 건드리지 않고, 비어 있는 칸만 채웁니다.
const FILL_COLS = ['name_en', 'author', 'pub_year', 'publisher', 'language', 'keywords',
                   'description', 'link_full', 'link_cite', 'doi', 'volume', 'issue',
                   'pages', 'affil', 'topic_raw'];

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 학술 수집기', VERSION, FULL ? '(전체 구간)' : '(최근분 갱신)');

  let subs = [];
  try {
    subs = await findMusicSubfields();
  } catch (e) {
    console.log('■ 분야 탐색 단계에서 막혔습니다 ·', String(e.message).slice(0, 80));
    console.log('  대비값 ' + FALLBACK_SUBFIELD.id + ' 으로 진행합니다.');
    subs = [FALLBACK_SUBFIELD];
  }
  if (subs.length) {
    console.log('■ 음악 세부분야:', subs.map(s => s.name + '(' + s.id + ')').join(', '));
  }

  const queries = buildQueries(subs.map(s => s.id));
  const bag = new Map();      // source_id -> row

  for (const q of queries) {
    let works = [];
    try {
      works = await fetchQuery(q);
    } catch (e) {
      console.log('  · ' + q.label + ' 실패 · 건너뜀 ·', String(e.message).slice(0, 120));
      continue;
    }
    let kept = 0;
    for (const w of works) {
      const row = toRow(w);
      if (!keep(row)) continue;
      if (!bag.has(row.source_id)) { bag.set(row.source_id, row); kept++; }
    }
    console.log('  · ' + q.label + ' · 받음 ' + works.length + ' · 채택 ' + kept);
    await sleep(2000);  // 쿼리 사이는 더 넉넉히
  }

  const rows = [...bag.values()];
  console.log('■ 수집 후보:', rows.length, '건');
  if (!rows.length) { console.log('■ 넣을 것이 없습니다. 종료.'); return; }

  // 기존과 대조
  const have = await sbGetAll('academic', 'id,source,source_id,doi,' + FILL_COLS.join(','));
  const bySid = new Map(), byDoi = new Map();
  for (const h of have) {
    if (h.source === 'openalex' && h.source_id) bySid.set(String(h.source_id), h);
    if (h.doi) byDoi.set(String(h.doi).toLowerCase(), h);
  }
  console.log('■ 기존 학술 행:', have.length, '건');

  const fresh = [], patch = [];
  for (const r of rows) {
    const old = bySid.get(r.source_id) || (r.doi && byDoi.get(String(r.doi).toLowerCase()));
    if (!old) { fresh.push(r); continue; }
    const p = {};
    for (const c of FILL_COLS) if (isEmpty(old[c]) && !isEmpty(r[c])) p[c] = r[c];
    if (Object.keys(p).length) patch.push({ id: old.id, p });
  }

  // 충실한 것부터 넣습니다.
  fresh.sort((a, b) => richness(b) - richness(a));

  let ins = 0, dup = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const r = await sbInsert(fresh.slice(i, i + 200));
    ins += r.ok; dup += r.dup;
  }
  console.log('■ 신규 저장:', ins, '건' + (dup ? ' · 이미 있어 건너뜀 ' + dup + '건' : ''));

  let up = 0;
  for (const { id, p } of patch) { await sbUpdate(id, p); up++; }
  console.log('■ 빈칸 보강:', up, '건');

  // 충실도 순으로 sort_no 재정렬 (빈약한 항목이 뒤로 갑니다)
  const all = await sbGetAll('academic',
    'id,sort_no,author,pub_year,publisher,description,doi,is_oa,cited_by');
  all.sort((a, b) => richness(b) - richness(a));
  let done = 0;
  for (let i = 0; i < all.length; i++) {
    const want = i + 1;
    if (all[i].sort_no !== want) { await sbUpdate(all[i].id, { sort_no: want }); done++; }
  }
  console.log('■ 재정렬:', all.length, '행 · sort_no 갱신', done);
  console.log('■ 완료 · 학술 총', all.length, '건');
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
