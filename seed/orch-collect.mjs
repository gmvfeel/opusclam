#!/usr/bin/env node
/* ============================================================
   명문 악단 공식 일정 수집 — seed/orch-collect.mjs
   ------------------------------------------------------------
   2026-08-15 · 파트너 요청

   ★ 왜 필요한가
     Ticketmaster 에 <b>세계 최고 악단들이 없습니다.</b> 빈 필·베를린 필은
     표를 자기 사이트에서 직접 팝니다. 그래서 해외 공연 784건에
     정작 가장 이름난 악단이 빠져 있었습니다.
     클래식 포털에서 이건 눈에 띄는 구멍입니다.

   ★ 어떻게 받나 — 기계용 창구가 <b>없습니다</b>
     ics·RSS 같은 자동수집용 길을 열어 둔 악단이 없습니다. 개별 공연마다
     「내 달력에 담기」 단추가 있을 뿐이고 그건 사람용입니다.
     ▶ 그래서 <b>공개된 일정 화면</b>을 읽습니다.

   ★ 지켜야 할 선 (파트너와 확인)
     · 악단이 <b>알리고 싶어 하는</b> 공연 홍보 정보만 받습니다
     · 출처를 밝히고 <b>원본 링크</b>로 보냅니다 — 예매는 그쪽에서
     · 값·좌석은 적지 않습니다. 자주 바뀌고, 그건 그쪽 몫입니다
     · robots 표시를 지킵니다(빈 필은 index, follow 로 열려 있습니다)
     · 사이트에 부담을 주지 않게 <b>천천히</b> 부릅니다
     ▶ KOPIS·Ticketmaster·위키백과와 같은 결입니다.

   ★ 짜임이 악단마다 다릅니다 — 그래서 이렇게 나눴습니다
     · 공통 뼈대(받기·정리·담기)는 이 파일 하나에
     · 악단마다 다른 것은 <b>ORCHESTRAS 설정</b>에만
     ▶ 새 악단을 더할 때 설정 한 덩어리만 쓰면 됩니다.
       화면 짜임이 바뀌어도 그 악단 설정만 고칩니다.

   ★ 한 곳이 조용히 멈추는 것을 막습니다
     악단이 사이트를 고치면 파싱이 0건이 됩니다. 그때 <b>실패로
     끝내지 않고</b> 몇 건을 받았는지 또렷이 알립니다. 0건이면
     경고를 남겨 워크플로 기록에서 눈에 띄게 합니다.

   쓰는 법
     node seed/orch-collect.mjs                  세어만 봅니다
     node seed/orch-collect.mjs --save           실제로 담습니다
     node seed/orch-collect.mjs --only=wph       한 악단만
     node seed/orch-collect.mjs --dump           받은 것을 눈으로

   환경변수 : SUPABASE_URL, SUPABASE_SERVICE_KEY
   ============================================================ */

import { sleep } from '../scripts/lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ARGS = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
}));
const SAVE = !!ARGS.save;
const DUMP = !!ARGS.dump;
const ONLY = typeof ARGS.only === 'string' ? ARGS.only : null;

const UA = 'OpusclamBot/1.0 (+https://opusclam.com; classical music database)';

/* 몇 달 앞까지 받을까 — 그보다 먼 것은 바뀔 여지가 커서 담지 않습니다 */
const MONTHS = parseInt(process.env.MONTHS || '14', 10);


/* ══ 악단 설정 ═══════════════════════════════════════════════
   새 악단을 더할 때는 여기 한 덩어리만 씁니다.

   key        구별용 짧은 이름 (--only 에 씁니다)
   nameKo     화면에 쓸 한국어 이름
   nameEn     원어·영문 이름 (제목 뒤에 붙입니다)
   url        일정 화면 주소
   base       상대 주소를 절대 주소로 만들 때 쓸 뿌리
   parse      화면 글에서 공연을 뽑아내는 함수
   ══════════════════════════════════════════════════════════ */

/* 독일어 달 이름 → 숫자
   ★ 오스트리아는 1월을 Jänner 로 씁니다(독일은 Januar).
     빈 필 화면이 Jänner 를 쓰므로 둘 다 넣습니다. */
const DE_MONTH = {
  'jänner': 1, 'januar': 1, 'februar': 2, 'märz': 3, 'april': 4, 'mai': 5, 'juni': 6,
  'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'dezember': 12,
};

/* 나라 이름 독일어 → 한국어
   ★ 없는 나라는 원문 그대로 둡니다. 지어내지 않습니다. */
const DE_COUNTRY = {
  'Österreich': '오스트리아', 'Deutschland': '독일', 'Schweiz': '스위스',
  'USA': '미국', 'Japan': '일본', 'China': '중국', 'Frankreich': '프랑스',
  'England': '영국', 'Großbritannien': '영국', 'Luxemburg': '룩셈부르크',
  'Slowenien': '슬로베니아', 'Slowakei': '슬로바키아', 'Ungarn': '헝가리',
  'Tschechische Republik': '체코', 'Spanien': '스페인', 'Italien': '이탈리아',
  'Niederlande': '네덜란드', 'Belgien': '벨기에', 'Polen': '폴란드',
  'Republik Korea': '대한민국', 'Südkorea': '대한민국', 'Korea': '대한민국',
};

export const ORCHESTRAS = [
  {
    key: 'wph',
    nameKo: '빈 필하모닉',
    nameEn: 'Wiener Philharmoniker',
    url: 'https://www.wienerphilharmoniker.at/de/konzerte',
    base: 'https://www.wienerphilharmoniker.at',
    home: 'https://www.wienerphilharmoniker.at/',

    /* ── 빈 필 화면 읽기 ──────────────────────────────────
       화면이 이런 차례로 되어 있습니다 —
           Mittwoch / 3 / September 2025          ← 요일·일·달·해
           Mi, 3. September 2025                  ← 다시 한 번
           ## [제목](주소)
           (때로) 부제 한 줄
           19:00                                  ← 시각
           Wolkenturm, Grafenegg, Österreich      ← 장소, 도시, 나라
           ### DIRIGENT  또는  ### DIRIGENTIN
           지휘자 이름
           ### WERKE VON
           - 작곡가,
           - 작곡가

       ★ 「Mi, 3. September 2025」 줄을 <b>기준점</b>으로 삼습니다.
         이 꼴이 가장 또렷하고 흔들림이 적습니다. 위쪽 세 줄짜리
         날짜는 화면 꾸밈이라 바뀌기 쉽습니다.
       ★ 지휘자 이름표가 <b>DIRIGENT</b>(남)·<b>DIRIGENTIN</b>(여) 둘입니다.
         하나만 잡으면 여성 지휘자 공연이 통째로 빠집니다. */
    parse(text) {
      const out = [];
      const lines = text.split('\n');

      /* 「Mi, 3. September 2025」 · 요일 두 글자는 언어에 따라 흔들리므로
         「, 숫자. 달이름 연도」 부분만 봅니다 */
      const DATE_RE = /^[A-Za-zÄÖÜäöü]{2,10},\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})\s*$/;

      for (let i = 0; i < lines.length; i++) {
        const m = DATE_RE.exec(lines[i].trim());
        if (!m) continue;

        const day = +m[1];
        const mon = DE_MONTH[m[2].toLowerCase()];
        const year = +m[3];
        if (!mon) continue;                     /* 모르는 달 이름 — 건너뜁니다 */

        /* 이 날짜 아래에서 다음 날짜가 나오기 전까지가 한 공연입니다 */
        let title = '', link = '', time = '', place = '', sub = '', thumb = '';
        const conductors = [], composers = [];
        let mode = '';

        for (let j = i + 1; j < lines.length && j < i + 40; j++) {
          const raw = lines[j];
          const t = raw.trim();
          if (DATE_RE.test(t)) break;           /* 다음 공연 */
          if (!t) continue;

          /* 그림 — 「![설명](주소)」 · 링크에 싸여 있어도 잡습니다.
             ★ 이 화면의 그림은 <b>포스터가 아니라 홍보 사진</b>입니다
               (지휘자·공연장·여행 공연용). 같은 사진이 여러 공연에
               되풀이되는 것이 정상이므로 겹친다고 버리지 않습니다 —
               목록에 빈 자리가 죽 늘어서면 죽어 보입니다. */
          if (!thumb) {
            const mi = /!\[[^\]]*\]\((https?:[^)]+)\)/.exec(t);
            if (mi) { thumb = mi[1]; continue; }
          }

          /* 제목 — ## [이름](주소) */
          if (!title) {
            const mt = /^##\s*\[([^\]]+)\]\(([^)]+)\)/.exec(t);
            if (mt) { title = mt[1].trim(); link = mt[2].trim(); continue; }
          }
          /* 시각 — 19:30 */
          if (!time && /^\d{1,2}:\d{2}$/.test(t)) { time = t; continue; }
          /* 이름표 */
          if (/^###\s*DIRIGENT(IN)?\s*$/i.test(t)) { mode = 'cond'; continue; }
          if (/^###\s*WERKE VON\s*$/i.test(t)) { mode = 'work'; continue; }
          if (/^###/.test(t)) { mode = ''; continue; }

          /* 작곡가 — 「- 이름,」 꼴 */
          if (mode === 'work') {
            const mw = /^-\s*(.+?),?\s*$/.exec(t);
            if (mw && mw[1]) composers.push(mw[1].trim());
            continue;
          }
          /* 지휘자 — 이름표 바로 다음 줄 */
          if (mode === 'cond') {
            if (!/^[-#!\[]/.test(t)) { conductors.push(t); mode = ''; }
            continue;
          }
          /* 장소 — 쉼표가 있고 그림·링크가 아닌 줄, 시각 뒤에 옵니다 */
          if (title && time && !place && t.indexOf(',') > 0
              && !/^[-#!\[]/.test(t) && !/^©/.test(t) && t.length < 140) {
            place = t; continue;
          }
          /* 부제 — 제목 다음, 시각 앞의 짧은 줄 (「Salzburger Festspiele 2026」 등) */
          if (title && !time && !sub && !/^[-#!\[]/.test(t) && t.length < 80) {
            sub = t; continue;
          }
        }

        if (!title) continue;

        /* 장소를 「홀, 도시, 나라」로 가릅니다.
           ★ 홀 이름 안에 쉼표가 또 있는 경우가 있습니다
             (예: Musikverein, Großer Saal, Wien, Österreich).
             그래서 <b>뒤에서부터</b> 나라·도시를 떼고 나머지를 홀로 봅니다. */
        let venue = place, city = '', country = '';
        if (place) {
          const parts = place.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length >= 3) {
            country = parts[parts.length - 1];
            city = parts[parts.length - 2];
            venue = parts.slice(0, parts.length - 2).join(', ');
          } else if (parts.length === 2) {
            city = parts[1]; venue = parts[0];
          }
        }

        out.push({
          date: `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          time, title, sub, link, venue, city, country, conductors, composers, thumb,
        });
      }
      return out;
    },
  },
];


/* ══ 잡동사니 ═══════════════════════════════════════════════ */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ymd = (d) => d.toISOString().slice(0, 10);

/* 화면 글 받기
   ★ 사이트에 부담을 주지 않게 한 곳만 부르고 곧바로 쉽니다.
     여러 쪽을 훑지 않습니다 — 한 쪽에 다 들어 있습니다. */
async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

/* HTML 을 읽기 좋은 글로 — 파서가 보는 것과 같은 꼴로 만듭니다
   ★ web_fetch 가 만들어 주던 마크다운을 여기서 직접 만듭니다.
     제목은 「## [글](주소)」, 이름표는 「### 이름」 꼴로 바꿉니다. */
export function toText(html) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  /* 제목 안의 링크를 마크다운으로
     ★ <h2> 와 <a> 사이에 다른 태그가 끼어 있을 수 있어, 「h2 안 어딘가에
       링크가 있다」로 느슨하게 봅니다. 딱 붙어 있을 때만 잡으면
       실제 사이트에서 제목이 통째로 사라집니다(시험에서 잡았습니다). */
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (m, inner) => {
    /* ★ href 가 <b>큰따옴표·작은따옴표·따옴표 없음</b> 셋 다 올 수 있습니다.
         큰따옴표만 찾으면 사이트에 따라 링크를 통째로 놓칩니다. */
    const a = /<a[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i.exec(inner);
    if (a) return `\n## [${strip(a[4])}](${a[1] || a[2] || a[3] || ''})\n`;
    return `\n## ${strip(inner)}\n`;
  });
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (m, t) => `\n### ${strip(t)}\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, t) => `\n- ${strip(t)}\n`);
  /* 그림 — 「![설명](주소)」 꼴로 남깁니다
     ★ 요즘 사이트는 화면에 보일 때까지 그림을 미루느라 주소를
       src 가 아니라 <b>data-src·data-original</b> 에 넣어 둡니다.
       src 만 보면 빈 그림(1픽셀 자리표)을 잡게 됩니다.
     ★ srcset 은 「주소 1x, 주소 2x」 꼴이라 <b>첫 주소</b>만 뗍니다. */
  s = s.replace(/<img\b([^>]*)>/gi, (m, attr) => {
    const pick = (name) => {
      const r = new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(attr);
      return r ? (r[1] || r[2] || r[3] || '') : '';
    };
    let src = pick('data-src') || pick('data-original') || pick('src');
    if (!src) {
      const ss = pick('srcset') || pick('data-srcset');
      if (ss) src = ss.split(',')[0].trim().split(/\s+/)[0];
    }
    if (!src) return ' ';
    return `\n![${strip(pick('alt'))}](${src})\n`;
  });
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|section|article|h1|h2|h3|h4|tr)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = unent(s);
  s = s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}
function strip(t) { return unent(String(t).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(); }
/* HTML 실체참조 풀기
   ★ 독일어·오스트리아 사이트는 <b>ä ö ü ß</b> 를 &auml; 꼴로 적는 일이
     흔합니다. 이것을 풀지 않으면 「M&ouml;st」 「&Ouml;sterreich」가
     그대로 담기고, 달 이름(&Auml;)도 못 알아봅니다.
   ★ &amp; 는 <b>맨 나중에</b> 풉니다. 먼저 풀면 「&amp;ouml;」 같은
     이중 표기가 잘못 풀립니다. */
const ENT = {
  auml:'ä', ouml:'ö', uuml:'ü', Auml:'Ä', Ouml:'Ö', Uuml:'Ü', szlig:'ß',
  eacute:'é', egrave:'è', agrave:'à', ccedil:'ç', ntilde:'ñ',
  aacute:'á', iacute:'í', oacute:'ó', uacute:'ú', uuml2:'ü',
  nbsp:' ', lt:'<', gt:'>', quot:'"', apos:"'", laquo:'«', raquo:'»',
  ldquo:'“', rdquo:'”', lsquo:'‘', rsquo:'’', ndash:'–', mdash:'—',
  hellip:'…', middot:'·', copy:'©', deg:'°', euro:'€',
};
function unent(t) {
  return String(t)
    .replace(/&([A-Za-z]+);/g, (m, k) => (k === 'amp' ? m : (ENT[k] !== undefined ? ENT[k] : m)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&');
}

/* spot 표에 담을 꼴로
   ★ tm-collect 와 <b>같은 칸</b>을 씁니다. 화면(spot/concert.html)이
     한 엔진으로 둘을 함께 보여 주기 때문입니다. */
export function toRow(o, orch) {
  const link = o.link && o.link.startsWith('http') ? o.link
             : (o.link ? orch.base + o.link : orch.home);

  /* 나라 이름은 한국어로 — 화면에 「Republik Korea」가 그대로 나오면
     어색합니다. 사전에 없는 나라는 원문을 그대로 둡니다(지어내지 않습니다).
     ★ 도시 이름은 <b>원문 그대로</b> 둡니다 — tm-collect 도 그렇습니다.
       도시 사전을 만들기 시작하면 세계 도시를 다 채워야 하고,
       빠진 것이 생기면 화면에서 두 말이 섞입니다. */
  const countryKo = DE_COUNTRY[o.country] || o.country || '';

  const bits = [];
  if (o.sub) bits.push('<p><b>' + esc(o.sub) + '</b></p>');
  bits.push('<p><b>' + esc(orch.nameKo) + '</b> · ' + esc(orch.nameEn) + '</p>');
  if (o.conductors.length) bits.push('<p>지휘 : ' + esc(o.conductors.join(' · ')) + '</p>');
  if (o.composers.length)  bits.push('<p>연주 : ' + esc(o.composers.join(' · ')) + '</p>');
  if (o.venue) bits.push('<p>장소 : ' + esc([o.venue, o.city, countryKo].filter(Boolean).join(', ')) + '</p>');
  if (o.time)  bits.push('<p>시각 : ' + esc(o.time) + '</p>');
  bits.push('<p>예매와 자세한 안내는 아래 원본 페이지에서 확인하실 수 있습니다. '
    + '값과 좌석은 자주 바뀌므로 이곳에 적지 않습니다.</p>');

  return {
    section: '공연정보',
    category: '클래식',
    region: '해외',
    country: countryKo,
    city: o.city || '',
    /* 제목에 악단 이름을 앞세웁니다 — 「Konzert in Luzern」만으로는
       목록에서 어느 악단인지 알 수 없습니다. */
    title: `${orch.nameKo} — ${o.title}`,
    body: bits.join(''),
    date_from: o.date,
    date_to: o.date,
    date_text: o.date,
    venue_name: o.venue || '',
    thumb_url: o.thumb || null,
    link_url: link,
    organizer: orch.nameEn,
    /* tm_id 자리를 씁니다 — 같은 표에서 겹치지 않게 하는 열쇠입니다.
       Ticketmaster 것과 섞이지 않도록 앞에 악단 이름표를 붙입니다. */
    tm_id: `orch:${orch.key}:${o.date}:${(o.link || o.title).slice(-60)}`,
    source: `${orch.nameEn} 공식 일정`,
    source_url: link,
    keywords: [orch.nameKo, orch.nameEn, o.city, countryKo, '공연정보', '클래식']
      .filter(Boolean).join(','),
    author_name: '오퍼스클램',
    hidden: false,
  };
}

/* ── 담기 ─────────────────────────────────────────────────── */
async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function save(rows) {
  let done = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    await sb('spot?on_conflict=tm_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(part),
    });
    done += part.length;
  }
  return done;
}


/* ══ 실행 ═══════════════════════════════════════════════════
   ★ <b>직접 돌릴 때만</b> 실행합니다.
     이 파일을 import 하면(시험할 때) 곧바로 수집이 시작되어,
     시험만 하려는데 사이트를 부르게 됩니다. */
const RUN_DIRECT = import.meta.url === `file://${process.argv[1]}`;

async function main() {
  const today = new Date();
  const until = new Date(today.getTime());
  until.setMonth(until.getMonth() + MONTHS);
  const fromYmd = ymd(today), toYmd = ymd(until);

  console.log('══ 명문 악단 공식 일정 ══');
  console.log(`   기간 : ${fromYmd} ~ ${toYmd} (${MONTHS}달)`);
  console.log(`   담기 : ${SAVE ? '예 (--save)' : '아니오 — 세어만 봅니다'}`);
  console.log('');

  const targets = ONLY ? ORCHESTRAS.filter(o => o.key === ONLY) : ORCHESTRAS;
  if (!targets.length) {
    console.error('그런 악단이 없습니다 : ' + ONLY);
    console.error('쓸 수 있는 이름 : ' + ORCHESTRAS.map(o => o.key).join(' · '));
    process.exit(1);
  }

  let grand = 0, warned = 0;

  for (const orch of targets) {
    console.log(`── ${orch.nameKo} (${orch.key})`);
    let text = '';
    try {
      text = toText(await fetchText(orch.url));
    } catch (e) {
      console.log(`   ★ 화면을 받지 못했습니다 — ${e.message}`);
      warned++;
      continue;
    }
    await sleep(1500);           /* 사이트에 부담을 주지 않게 */

    let list = [];
    try {
      list = orch.parse(text) || [];
    } catch (e) {
      console.log(`   ★ 읽는 중 오류 — ${e.message}`);
      warned++;
      continue;
    }

    /* ★ 0건이면 <b>사이트가 바뀐 것</b>일 수 있습니다.
         조용히 지나가면 몇 달 뒤에야 알아챕니다. */
    if (!list.length) {
      console.log('   ★★ 한 건도 읽지 못했습니다 — 화면 짜임이 바뀌었는지 확인해 주십시오');
      warned++;
      continue;
    }
    console.log(`   화면에서 읽음 : ${list.length}건`);

    /* 기간으로 거릅니다 — 지난 것과 너무 먼 것은 담지 않습니다 */
    const kept = list.filter(o => o.date >= fromYmd && o.date <= toYmd);
    console.log(`   기간 안 : ${kept.length}건 (지난 것·먼 것 ${list.length - kept.length}건 제외)`);

    if (DUMP) {
      kept.slice(0, 12).forEach(o => {
        console.log(`     ${o.date} ${o.time.padEnd(6)} ${o.title}`);
        console.log(`        ${[o.venue, o.city, o.country].filter(Boolean).join(', ')}`);
        if (o.conductors.length) console.log(`        지휘 ${o.conductors.join(' · ')}`);
        if (o.composers.length)  console.log(`        연주 ${o.composers.join(' · ')}`);
      });
      if (kept.length > 12) console.log(`     … 그리고 ${kept.length - 12}건`);
    }

    /* 나라별로 몇 건인지 — 국내 공연이 있으면 눈에 띄게 */
    const byC = {};
    kept.forEach(o => { const c = DE_COUNTRY[o.country] || o.country || '(없음)'; byC[c] = (byC[c] || 0) + 1; });
    console.log('   나라별 : ' + Object.entries(byC).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`).join(' · '));

    /* 그림이 얼마나 붙었나 — 0 이면 그림 읽기가 깨진 것입니다 */
    const withImg = kept.filter(o => o.thumb).length;
    const kinds = new Set(kept.map(o => o.thumb).filter(Boolean)).size;
    console.log(`   그림 : ${withImg}건에 붙음 (${kinds}가지) · 없음 ${kept.length - withImg}건`);
    if (!withImg) console.log('   ★ 그림을 하나도 읽지 못했습니다 — 화면 짜임을 확인해 주십시오');

    if (SAVE) {
      if (!SB_URL || !SB_KEY) {
        console.log('   ★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없어 담지 못합니다');
      } else {
        const rows = kept.map(o => toRow(o, orch));
        const n = await save(rows);
        console.log(`   담음 : ${n}건`);
      }
    }
    grand += kept.length;
    console.log('');
  }

  console.log(`=== ${SAVE ? '담은' : '담을 수 있는'} 공연 ${grand}건 ===`);
  if (warned) console.log(`※ 살펴볼 악단 ${warned}곳 — 위 ★ 표시를 확인해 주십시오`);
}

if (RUN_DIRECT) {
  main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
}
