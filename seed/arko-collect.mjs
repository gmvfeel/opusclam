/* ============================================================
   OPUSCLAM 아르코 공모 갱신 — seed/arko-collect.mjs

   무엇을 하나
    · 한국문화예술위원회(아르코)의 「문예진흥기금 공모 한눈에 보기」 를 읽어
      정보SPOT 「지원금」 갈래의 공모 일정을 갱신합니다

   왜 필요한가
    아르코 공모는 해마다 새로 열립니다. 지금 담긴 20건의 마감일은
    2025년 9~12월이라 이미 지났고, 2027년 공모는 2026년 9월 무렵 나옵니다.
    그때 손으로 20건을 다시 고치지 않으려고 만들었습니다.

   어떻게 새 연도를 찾나
    아르코 페이지에는 연도 탭(2026·2025·2024·2023)이 있습니다.
    시작 페이지를 읽어 그 탭에서 <b>가장 큰 연도</b>를 골라 따라갑니다.
    그래서 2027년 페이지가 생기면 저절로 그쪽을 읽습니다.
    탭을 찾지 못하면 시작 페이지를 그대로 읽습니다.

   이미 담긴 것은 어떻게 되나
    arko_key(아르코 쪽 사업명)로 짝을 맞춥니다.
      · 짝이 있으면 <b>마감일·기간만 갱신</b> — 우리가 쓴 설명은 그대로 둡니다
      · 짝이 없으면 새 사업으로 담습니다 (설명은 나중에 채우시면 됩니다)
    없어진 사업은 지우지 않고 그대로 둡니다 — 지난 공모도 다음 공모를
    짐작하는 데 쓸모가 있습니다.

   합법 여부
    이 페이지는 공공누리(공공저작물 자유이용)입니다.

   쓰는 법
     node seed/arko-collect.mjs                     새 연도를 찾아 갱신
     node seed/arko-collect.mjs --dry               담지 않고 보기만
     node seed/arko-collect.mjs --url=…/content/NNNN  페이지를 직접 지정
     node seed/arko-collect.mjs --year=2027         그 연도 탭을 골라 읽기

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const DRY = !!args.dry;
const WANT_YEAR = args.year ? Number(args.year) : null;

/* 2026년 공모 페이지 — 여기서 시작해 연도 탭을 따라갑니다 */
const START = args.url ? String(args.url) : 'https://www.arko.or.kr/content/6123';
const BASE = 'https://www.arko.or.kr';
const UA = 'OpusclamArkoBot/1.0 (https://opusclam.com)';

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

async function getHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.text();
}

/* ============================================================
   글자 다듬기
   ============================================================ */
function strip(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* ============================================================
   연도 탭에서 가장 큰 연도를 찾습니다

   페이지에 「2026 · 2025 · 2024 · 2023」 같은 링크가 있습니다.
   2027년 페이지가 생기면 그 링크가 늘어나므로, 가장 큰 연도를 고릅니다.
   ============================================================ */
function findYearLinks(html) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']*\/content\/\d+)["'][^>]*>\s*(20\d\d)\s*<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].charAt(0) === '/' ? BASE + m[1] : m[1];
    out.push({ year: Number(m[2]), url: href });
  }
  /* 같은 연도가 여러 번 나오면 하나만 */
  const seen = new Set(), uniq = [];
  for (const x of out) {
    if (seen.has(x.year)) continue;
    seen.add(x.year); uniq.push(x);
  }
  return uniq.sort((a, b) => b.year - a.year);
}

/* ============================================================
   표에서 사업명과 신청기간을 뽑습니다

   구조가 조금 달라도 견디도록 느슨하게 읽습니다.
     · 링크가 있는 칸  → 사업명
     · 날짜가 있는 칸  → 신청기간
   분야 칸은 읽지 않습니다 — 우리 쪽 구분은 따로 정해 두었습니다.
   ============================================================ */
function parseRows(html) {
  const rows = [];
  const trs = html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) || [];

  for (const tr of trs) {
    const tds = tr.match(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi) || [];
    if (tds.length < 2) continue;

    let name = '', link = '', period = '', plain = '';

    /* 링크가 있는 칸을 사업명으로 먼저 찾습니다.
       분야 칸(「공연 예술」 처럼)이 사업명으로 잡히던 일이 있었습니다 —
       분야는 링크가 없고 사업명에는 상세 공고 링크가 붙어 있습니다. */
    for (const td of tds) {
      const a = td.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (a && strip(a[2]).length >= 3) {
        name = strip(a[2]);
        link = a[1].charAt(0) === '/' ? BASE + a[1] : a[1];
        break;
      }
    }

    /* 신청기간을 찾습니다 */
    for (const td of tds) {
      const text = strip(td);
      if (!text || text === name) continue;
      const hasDate = /\d{4}\s*\.\s*\d{1,2}|\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*\(|예정|미정|마감/.test(text);
      if (hasDate && !period) period = text;
      else if (!hasDate && !plain && text.length >= 4 && text.length <= 60) plain = text;
    }

    /* 링크가 아예 없는 표라면 글자 칸을 사업명으로 씁니다 */
    if (!name) name = plain;
    if (!name || name.length < 3) continue;
    /* 머리글 줄은 건너뜁니다 */
    if (/^(분야|사업명|지원사업명|지원신청|구분)$/.test(name)) continue;

    /* 표에서 여러 사업이 기간 칸을 함께 쓰는 일이 많습니다
       (한 칸에 여러 줄을 묶어 두는 짜임).
       기간이 비어 있으면 바로 앞 사업의 기간을 물려받습니다. */
    if (!period && rows.length) period = rows[rows.length - 1].period;

    rows.push({ name: name, link: link, period: period });
  }
  return rows;
}

/* ============================================================
   신청기간 글자에서 날짜를 뽑습니다

   보기
     2025.9.23.(화) 10:00 ~ 10.30.(목) 15:00 마감  → 2025-09-23 ~ 2025-10-30
     2025.12.1.(월) ~ 2026.2.27.(금) 15:00 마감    → 2025-12-01 ~ 2026-02-27
     2026년 상반기 예정                             → 날짜 없음
   ============================================================ */
function parsePeriod(text) {
  const t = String(text || '');
  const pad = (n) => String(n).padStart(2, '0');

  /* 연도가 붙은 날짜를 모두 찾습니다 */
  const full = [...t.matchAll(/(20\d\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/g)]
    .map((m) => ({ y: +m[1], mo: +m[2], d: +m[3], at: m.index, len: m[0].length }));

  if (!full.length) return { from: null, to: null, text: t };

  const first = full[0];
  const from = `${first.y}-${pad(first.mo)}-${pad(first.d)}`;

  /* 마감일 — 연도가 붙은 두 번째 날짜가 있으면 그것,
     없으면 연도 없이 적힌 날짜(10.30 같은)를 첫 날짜의 연도로 읽습니다 */
  let to = null;
  if (full.length > 1) {
    const last = full[full.length - 1];
    to = `${last.y}-${pad(last.mo)}-${pad(last.d)}`;
  } else {
    /* 첫 날짜 전체를 건너뛰어야 합니다.
       예전에는 네 글자만 건너뛰어 「2025.9.23」 의 「9.23」 을
       마감일로 잘못 읽었습니다. */
    const tail = t.slice(first.at + first.len);
    const m2 = tail.match(/(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*\(/);
    if (m2) {
      let y = first.y, mo = +m2[1], d = +m2[2];
      /* 달이 뒤로 가지 않으면 해가 넘어간 것입니다 */
      if (mo < first.mo) y += 1;
      to = `${y}-${pad(mo)}-${pad(d)}`;
    }
  }
  return { from: from, to: to, text: t };
}

/* 짧은 날짜 표기 — 목록의 좁은 칸에 들어갑니다 */
function shortDeadline(p) {
  if (p.to) {
    const [y, m, d] = p.to.split('-');
    return `${y.slice(2)}.${m}.${d} 마감`;
  }
  if (/상반기/.test(p.text)) return '상반기 예정';
  if (/하반기/.test(p.text)) return '하반기 예정';
  if (/(예정|미정)/.test(p.text)) return '일정 미정';
  return '그 해 공고 확인';
}

/* ============================================================
   실행
   ============================================================ */
async function main() {
  console.log('── 아르코 공모 갱신 ──');

  /* ① 시작 페이지를 읽고 연도 탭에서 가장 큰 연도를 고릅니다 */
  let pageUrl = START, pageYear = null;
  try {
    const html0 = await getHtml(START);
    const years = findYearLinks(html0);
    if (years.length) {
      console.log('연도 탭 : ' + years.map((y) => y.year).join(' · '));
      const pick = WANT_YEAR ? years.find((y) => y.year === WANT_YEAR) : years[0];
      if (pick) { pageUrl = pick.url; pageYear = pick.year; }
      else if (WANT_YEAR) {
        console.log(`  ${WANT_YEAR}년 탭이 없습니다 — 시작 페이지를 그대로 읽습니다`);
      }
    } else {
      console.log('연도 탭을 찾지 못했습니다 — 시작 페이지를 그대로 읽습니다');
    }
  } catch (e) {
    console.error('시작 페이지를 읽지 못했습니다:', e.message);
    process.exit(1);
  }

  console.log(`읽는 곳 : ${pageUrl}${pageYear ? ` (${pageYear}년)` : ''}${DRY ? ' · 담지 않음(dry)' : ''}`);

  /* ② 표를 읽습니다 */
  let rows = [];
  try {
    const html = await getHtml(pageUrl);
    rows = parseRows(html);
  } catch (e) {
    console.error('페이지를 읽지 못했습니다:', e.message);
    process.exit(1);
  }

  if (!rows.length) {
    console.log('\n표에서 사업을 찾지 못했습니다.');
    console.log('아르코가 페이지 짜임을 바꾼 것일 수 있습니다 — 알려 주시면 읽는 규칙을 고치겠습니다.');
    process.exit(1);
  }
  console.log(`찾은 사업 : ${rows.length}개\n`);

  /* ③ 이미 담긴 것을 불러 짝을 맞춥니다 */
  const have = (await sb('spot?select=id,title,arko_key,deadline_text&section=eq.'
    + encodeURIComponent('지원금') + '&arko_key=not.is.null&limit=200')) || [];
  const byKey = {};
  for (const h of have) byKey[h.arko_key] = h;

  let upd = 0, add = 0, same = 0;

  for (const r of rows) {
    const p = parsePeriod(r.period);
    const dl = shortDeadline(p);
    const found = byKey[r.name];

    if (found) {
      if (found.deadline_text === dl) { same++; continue; }
      console.log(`  [갱신] ${r.name}`);
      console.log(`         ${found.deadline_text || '(없음)'} → ${dl}`);
      if (!DRY) {
        try {
          await sb(`spot?id=eq.${found.id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
              deadline_text: dl,
              date_from: p.from, date_to: p.to,
              link_url: r.link || undefined,
            }),
          });
          upd++;
        } catch (e) { console.log(`         갱신 실패: ${e.message}`); }
      } else upd++;
      continue;
    }

    /* 새 사업 — 설명은 비워 두고 담습니다 (나중에 채우시면 됩니다) */
    console.log(`  [새 사업] ${r.name}  ·  ${dl}`);
    if (!DRY) {
      try {
        await sb('spot', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{
            section: '지원금', region: '국내', country: '대한민국',
            category: '창작지원',
            title: '아르코 ' + r.name,
            arko_key: r.name,
            body: '<p>한국문화예술위원회(아르코)의 문예진흥기금 지원사업입니다.</p>'
                + '<h3>알아두면 좋은 것</h3><table>'
                + `<tr><th>지원신청</th><td>${r.period || '공식 홈페이지 확인'}</td></tr>`
                + '<tr><th>신청</th><td>국가문화예술지원시스템 (NCAS)</td></tr>'
                + '</table>'
                + '<p>자세한 안내는 아르코 공고문에서 확인하실 수 있습니다.</p>',
            date_from: p.from, date_to: p.to,
            deadline_text: dl,
            organizer: '한국문화예술위원회 (아르코)',
            link_url: r.link || 'https://www.arko.or.kr/',
            source: '한국문화예술위원회 「문예진흥기금 공모 한눈에 보기」',
            source_url: pageUrl,
            keywords: '아르코,' + r.name + ',문예진흥기금,지원사업,NCAS',
            logo_text: '아르코',
            author_name: '오퍼스클램',
            hidden: false,
          }]),
        });
        add++;
      } catch (e) { console.log(`           담기 실패: ${e.message}`); }
    } else add++;
  }

  console.log('\n── 끝 ──');
  console.log(`갱신 ${upd}건 · 새 사업 ${add}건 · 그대로 ${same}건`);
  if (DRY) console.log('※ --dry 였으므로 아무것도 담지 않았습니다.');
  if (add) console.log('※ 새 사업에는 간단한 설명만 넣었습니다 — 필요하시면 뒤에 채우시면 됩니다.');
}

main().catch((e) => {
  console.error('멈춤:', e.message);
  process.exit(1);
});
