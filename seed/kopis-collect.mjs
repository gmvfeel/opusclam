/* ============================================================
   OPUSCLAM 공연정보 수집 — seed/kopis-collect.mjs

   무엇을 하나
    · 공연예술통합전산망(KOPIS)에서 <b>클래식·국악 공연</b>만 받아
      정보SPOT 「공연정보」 갈래에 담습니다

   지난번 실패를 되풀이하지 않으려고
    예전에 KOPIS 를 붙였다가 걷어낸 적이 있습니다.
    공연 하나하나의 상세를 불러 GitHub Actions 무료 시간이 터졌습니다.

    그래서 이번에는 <b>목록 API 만</b> 씁니다.
    목록에 이미 이만큼이 들어 있어 화면을 채우기에 넉넉합니다.
      공연명 · 기간 · 공연장 · 포스터 · 장르 · 지역 · 공연상태
    상세에만 있는 것(출연진·가격·줄거리)은 부르지 않습니다.
    한 번 돌리는 데 API 호출이 열 번 안쪽이라 시간이 터질 일이 없습니다.

   무엇을 걸러내나
    · 장르를 <b>서양음악(클래식) 하나로</b> 못박습니다.
      예전에 KOPIS 를 걷어낸 까닭이 「카페 같은 쓰레기 자료」 였는데,
      그것은 <b>공연시설 API</b>(공연을 올릴 수 있는 모든 장소)를 썼기 때문입니다.
      이 수집기는 <b>공연목록 API</b> 를 쓰고 갈래를 좁혀 그 문제를 피합니다
    · 제목에 「뮤지컬」「트로트」 같은 말이 들어간 것은 뺍니다
      (장르가 클래식으로 잡혀 있어도 실제로는 다른 공연인 일이 있습니다)

   쓰는 법
     node seed/kopis-collect.mjs                  앞으로 석 달
     node seed/kopis-collect.mjs --months=6       앞으로 여섯 달
     node seed/kopis-collect.mjs --genre=CCCC     국악만 (기본에는 없습니다)
     node seed/kopis-collect.mjs --dry            담지 않고 보기만
     node seed/kopis-collect.mjs --past=1         지난 한 달도 함께

   필요한 환경변수
     KOPIS_KEY                    KOPIS 오픈API 서비스키
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const KOPIS_KEY = process.env.KOPIS_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}
if (!KOPIS_KEY) {
  console.error('환경변수 KOPIS_KEY 가 필요합니다.');
  console.error('KOPIS 홈페이지 → 고객센터 → 오픈API → 오픈API 신청 에서 받으실 수 있습니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);

const MONTHS = Number(args.months || 3);      /* 앞으로 몇 달까지 */
const PAST   = Number(args.past || 0);        /* 지난 몇 달까지 함께 */
const DRY    = !!args.dry;
const ONLY   = args.genre ? String(args.genre) : null;

/* KOPIS 장르 코드

   기본은 <b>서양음악(클래식) 하나뿐</b>입니다.
   국악은 담지 않습니다 — 오퍼스클램의 공연정보는 클래식을 위한 자리이고,
   갈래를 좁게 두는 것이 쓰레기 자료를 막는 가장 확실한 방법입니다.

   나중에 국악을 담고 싶으시면 --genre=CCCC 로 부르시면 됩니다.
   기본으로는 절대 함께 오지 않습니다. */
const ALL_GENRES = [
  { code: 'CCCA', name: '클래식' },
  { code: 'CCCC', name: '국악' },   /* 부르지 않으면 담지 않습니다 */
];
const DEFAULT_CODES = ['CCCA'];      /* ★ 기본은 클래식만 */

/* 장르가 클래식으로 잡혀 있어도 실제로는 다른 공연인 일이 있습니다 */
const TITLE_BLOCK = [
  '뮤지컬', '트로트', '가요', 'k-pop', 'kpop', '아이돌', '팬미팅', '팬콘',
  '개그', '코미디', '마술', '서커스', '무술', '난타',
  '토크쇼', '강연', '세미나', '워크숍', '오디션', '전시',
];

const UA = 'OpusclamKopisBot/1.0 (https://opusclam.com)';

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/* ============================================================
   Supabase
   ============================================================ */
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
   KOPIS 목록 API

   응답이 XML 입니다. 구조가 단순해서 따로 묶음을 들이지 않고
   정규식으로 뽑습니다. 태그 안에 태그가 겹치지 않는 모양입니다.
   ============================================================ */
function xmlPick(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

async function kopisList(genre, stdate, eddate, page) {
  const url = 'https://www.kopis.or.kr/openApi/restful/pblprfr'
    + '?service=' + encodeURIComponent(KOPIS_KEY)
    + '&stdate=' + stdate + '&eddate=' + eddate
    + '&cpage=' + page + '&rows=100'
    + '&shcate=' + genre;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`KOPIS ${res.status}`);
  const xml = await res.text();

  /* 키가 잘못됐거나 승인 전이면 오류 XML 이 옵니다 */
  if (/<returnReasonCode>|<faultstring>|인증|서비스키/i.test(xml) && !/<db>/i.test(xml)) {
    const why = xmlPick(xml, 'returnAuthMsg') || xmlPick(xml, 'faultstring')
             || xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(`KOPIS 가 자료를 주지 않았습니다 — ${why}`);
  }

  const rows = [];
  const blocks = xml.match(/<db>[\s\S]*?<\/db>/gi) || [];
  for (const b of blocks) {
    rows.push({
      id:      xmlPick(b, 'mt20id'),
      name:    xmlPick(b, 'prfnm'),
      from:    xmlPick(b, 'prfpdfrom'),
      to:      xmlPick(b, 'prfpdto'),
      place:   xmlPick(b, 'fcltynm'),
      poster:  xmlPick(b, 'poster'),
      genre:   xmlPick(b, 'genrenm'),
      state:   xmlPick(b, 'prfstate'),
      area:    xmlPick(b, 'area'),
      openrun: xmlPick(b, 'openrun'),
    });
  }
  return rows;
}

/* 「2026.08.01」 을 날짜로 */
function toDate(s) {
  const m = String(s || '').match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${m[1]}-${p(m[2])}-${p(m[3])}`;
}

function blocked(title) {
  const t = String(title || '').toLowerCase();
  return TITLE_BLOCK.some((w) => t.includes(w.toLowerCase()));
}

/* ============================================================
   담기
   ============================================================ */
function toRow(r, genreName) {
  const df = toDate(r.from);
  const dt = toDate(r.to);
  const bits = [];
  if (r.place) bits.push(r.place);
  if (r.area) bits.push(r.area);
  if (df && dt) bits.push(df === dt ? df : `${df} ~ ${dt}`);

  return {
    section: '공연정보',
    category: genreName,
    region: '국내',
    country: '대한민국',
    title: r.name,
    body: '<p>' + bits.join(' · ') + '</p>'
        + '<h3>알아두면 좋은 것</h3><table>'
        + (r.place ? `<tr><th>공연장</th><td>${esc(r.place)}</td></tr>` : '')
        + (r.area ? `<tr><th>지역</th><td>${esc(r.area)}</td></tr>` : '')
        + (df ? `<tr><th>기간</th><td>${df}${dt && dt !== df ? ' ~ ' + dt : ''}</td></tr>` : '')
        + (r.genre ? `<tr><th>갈래</th><td>${esc(r.genre)}</td></tr>` : '')
        + (r.state ? `<tr><th>상태</th><td>${esc(r.state)}</td></tr>` : '')
        + '</table>'
        + '<p>예매와 자세한 안내는 공연예술통합전산망(KOPIS)에서 확인하실 수 있습니다.</p>',
    date_from: df,
    date_to: dt,
    date_text: df ? (dt && dt !== df ? `${df} ~ ${dt}` : df) : null,
    venue_name: r.place || null,
    thumb_url: r.poster || null,
    kopis_id: r.id,
    kopis_state: r.state || null,
    organizer: null,
    source: '공연예술통합전산망(KOPIS)',
    source_url: 'https://www.kopis.or.kr/',
    keywords: [r.genre, r.place, r.area, '공연정보', 'KOPIS']
      .filter(Boolean).join(','),
    author_name: '오퍼스클램',
    hidden: false,
  };
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function save(rows) {
  if (!rows.length) return 0;
  /* kopis_id 에 온전한 unique 인덱스가 있어야 합니다.
     예전에 부분 인덱스를 써서 저장이 통째로 실패한 적이 있습니다(spot-07). */
  await sb('spot?on_conflict=kopis_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return rows.length;
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - PAST);
  const end = new Date(today);
  end.setMonth(end.getMonth() + MONTHS);

  const stdate = ymd(start), eddate = ymd(end);
  /* 갈래를 따로 부르지 않으면 클래식만 담습니다 */
  const genres = ONLY
    ? ALL_GENRES.filter((g) => g.code === ONLY)
    : ALL_GENRES.filter((g) => DEFAULT_CODES.includes(g.code));
  if (!genres.length) {
    console.error(`--genre=${ONLY} 는 다루지 않는 갈래입니다.`);
    console.error('CCCA(클래식) 또는 CCCC(국악) 만 쓸 수 있습니다.');
    process.exit(1);
  }

  console.log('── KOPIS 공연정보 수집 ──');
  console.log(`기간 ${stdate} ~ ${eddate}${DRY ? ' · 담지 않음(dry)' : ''}`);
  console.log(`갈래 ${genres.map((g) => g.name).join(' · ')}`);

  let got = 0, kept = 0, cut = 0, saved = 0;

  for (const g of genres) {
    let page = 1;
    for (;;) {
      let list;
      try { list = await kopisList(g.code, stdate, eddate, page); }
      catch (e) { console.log(`  [실패] ${g.name} ${page}쪽 — ${e.message}`); break; }

      if (!list.length) break;
      got += list.length;

      const rows = [];
      for (const r of list) {
        if (!r.id || !r.name) { cut++; continue; }
        if (blocked(r.name)) { cut++; continue; }
        rows.push(toRow(r, g.name));
      }
      kept += rows.length;

      console.log(`  ${g.name} ${page}쪽 — 받은 것 ${list.length} · 담을 것 ${rows.length}`);
      if (rows.length && DRY) {
        for (const r of rows.slice(0, 3)) {
          console.log(`      ${r.title} | ${r.venue_name || '-'} | ${r.date_text || '-'}`);
        }
      }
      if (rows.length && !DRY) {
        try { saved += await save(rows); }
        catch (e) { console.log(`      저장 실패: ${e.message}`); }
      }

      if (list.length < 100) break;   /* 마지막 쪽 */
      page++;
      if (page > 20) { console.log(`  ${g.name} — 스무 쪽에서 멈춥니다`); break; }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log('\n── 끝 ──');
  console.log(`받은 것 ${got} · 담을 것 ${kept} · 걸러낸 것 ${cut}${DRY ? '' : ` · 담은 것 ${saved}`}`);
  if (DRY) console.log('※ --dry 였으므로 아무것도 담지 않았습니다.');
  else if (saved) console.log('※ 같은 공연은 새로 쌓지 않고 갱신됩니다(kopis_id 기준).');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
