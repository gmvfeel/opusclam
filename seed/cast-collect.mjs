/* ============================================================
   OPUSCLAM 공연 출연자 모으기 — seed/cast-collect.mjs
   ------------------------------------------------------------
   2026-08-16 · 파트너 아이디어(2026-08-15)를 실행합니다

   무엇을 하나
     이미 담긴 공연(spot)의 KOPIS <b>상세</b>를 불러 출연진(prfcast)을
     뽑아 oc_cast 에 담습니다. 인물DB 와 잇는 것은 <b>다음 단계</b>이고,
     여기서는 이름만 모읍니다.

   ★ 왜 상세를 부르나 — 목록에는 출연진이 없습니다
     포스터에서 글자를 읽는 방법도 살펴봤지만, OCR 은 「누가 연주자인지」를
     모릅니다. 작곡가·공연장·후원사가 다 사람 이름처럼 생겼습니다.
     prfcast 는 <b>출연진만</b> 따로 들어 있어 가려낼 필요가 없습니다.

   ★★ 예전 실패를 되풀이하지 않으려고
     KOPIS 를 처음 붙였을 때 <b>상세를 한꺼번에</b> 불러 GitHub Actions
     무료 시간이 터졌습니다. 그래서 이렇게 합니다 —
       · 한 번에 <b>정해진 만큼만</b> 부릅니다 (기본 250건)
       · 부른 공연에는 spot.cast_fetched_at 을 적어 <b>다음번엔 건너뜁니다</b>
       · 부르는 사이에 짧게 쉽니다 (KOPIS 에 부담을 주지 않으려고)
     1,011건이면 나흘이면 다 채워지고, 그다음부터는 새로 들어온 것만
     부르므로 하루 몇십 건입니다.

   ★ 이름이 아닌 것을 걸러냅니다
     prfcast 에는 사람 이름만 오는 것이 원칙이지만 실제로는 섞입니다 —
       「서울시립교향악단」 (단체)  「지휘 정명훈」 (직함이 붙음)
       「(주)크레디아」 (기획사)   「미정」·「추후공지」
     단체·기획사는 빼고, 직함은 <b>떼어 role 에</b> 옮깁니다.

   환경변수
     KOPIS_KEY                    KOPIS 오픈API 서비스키
     SUPABASE_URL
     SUPABASE_SERVICE_KEY

   쓰는 법
     node seed/cast-collect.mjs                 250건
     node seed/cast-collect.mjs --limit=400     400건
     node seed/cast-collect.mjs --dry           담지 않고 보기만
   ============================================================ */

const KOPIS_KEY = process.env.KOPIS_KEY;
const SB_URL    = process.env.SUPABASE_URL;
const SB_KEY    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KOPIS_KEY) { console.error('환경변수 KOPIS_KEY 가 필요합니다.'); process.exit(1); }
if (!SB_URL || !SB_KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 필요합니다.'); process.exit(1); }

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const LIMIT = Number(args.limit || 250);
const DRY   = !!args.dry;
const UA    = 'OpusclamCastBot/1.0 (https://opusclam.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   Supabase
   ============================================================ */
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

/* ============================================================
   KOPIS 상세 API
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

async function kopisDetail(mt20id) {
  const url = 'https://www.kopis.or.kr/openApi/restful/pblprfr/' + encodeURIComponent(mt20id)
            + '?service=' + encodeURIComponent(KOPIS_KEY);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`KOPIS ${res.status}`);
  const xml = await res.text();

  if (/<returnReasonCode>|<faultstring>/i.test(xml) && !/<db>/i.test(xml)) {
    const why = xmlPick(xml, 'returnAuthMsg') || xmlPick(xml, 'faultstring') || '까닭 모름';
    throw new Error(`KOPIS 가 자료를 주지 않았습니다 — ${why}`);
  }
  return {
    cast: xmlPick(xml, 'prfcast'),      /* 출연진 */
    crew: xmlPick(xml, 'prfcrew'),      /* 제작진 — 지휘자가 여기 있기도 합니다 */
  };
}

/* ============================================================
   이름 고르기

   ★ prfcast 는 쉼표로 이어진 한 줄입니다 —
       「조성진, 서울시립교향악단, 지휘 정명훈」
     여기서 <b>사람 이름만</b> 골라야 합니다.
   ============================================================ */

/* 단체·기획사 — 사람이 아닙니다.
   ★ 끝말뿐 아니라 <b>어디에 있어도</b> 봅니다. 「(주)크레디아」처럼
     앞에 붙는 것이 있어 끝말만 보면 놓칩니다(시험에서 잡았습니다). */
const ORG_WORD = /(교향악단|필하모닉|오케스트라|앙상블|합창단|중창단|사중주단|콰르텟|트리오|밴드|악단|악회|재단|협회|문화원|예술단|컴퍼니|프로덕션|엔터테인먼트|주식회사|\(주\)|㈜|Co\.|Inc\.)/;
/* 끝에 올 때만 단체인 말 — 「기획」은 「김기획」 같은 이름일 수 있어 따로 */
const ORG_TAIL = /(기획|컴퍼니|스튜디오)$/;

/* 직함 — 이름 앞에 붙습니다. 떼어 role 로 옮깁니다 */
const ROLE_HEAD = /^(지휘자?|연출|피아노|바이올린|비올라|첼로|콘트라베이스|플루트|오보에|클라리넷|바순|호른|트럼펫|트롬본|튜바|하프|기타|타악|퍼커션|소프라노|메조소프라노|알토|테너|바리톤|베이스|반주|협연|作曲|작곡|편곡)\s*[:：]?\s*/;

/* 이름이 아닌 것 */
function notName(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  if (t.length < 2 || t.length > 24) return true;
  if (ORG_WORD.test(t) || ORG_TAIL.test(t)) return true;
  if (/^(미정|추후|추후공지|없음|기타|외|등)$/.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  /* 「외 3명」·「등」 같은 꼬리말 */
  if (/^(외|등)\s*\d*\s*(명|인)?$/.test(t)) return true;
  return false;
}

function parseCast(text) {
  const out = [];
  const seen = new Set();
  /* 쉼표·가운뎃점·줄바꿈으로 가릅니다 */
  const parts = String(text || '').split(/[,\n·;]/);
  for (let raw of parts) {
    let s = raw.replace(/\s+/g, ' ').trim();
    if (!s) continue;

    /* 괄호 안 설명은 뗍니다 — 「조성진(피아노)」 */
    let role = null;
    const mp = s.match(/^(.+?)\s*[（(]\s*([^)）]{1,12})\s*[)）]\s*$/);
    if (mp) { s = mp[1].trim(); role = mp[2].trim(); }

    /* 앞에 붙은 직함을 뗍니다 — 「지휘 정명훈」 */
    const mh = s.match(ROLE_HEAD);
    if (mh) { role = role || mh[1]; s = s.slice(mh[0].length).trim(); }

    /* 「조성진 외 3명」 → 「조성진」. 뒤엣말은 사람 수일 뿐입니다. */
    s = s.replace(/\s+(외|등)\s*\d*\s*(명|인)?$/, '').trim();

    if (notName(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: s, role: role || null });
  }
  return out;
}

/* ============================================================
   실행
   ============================================================ */
(async () => {
  console.log('══ 공연 출연자 모으기 ══');
  console.log(DRY ? '   담지 않고 봅니다 (--dry)' : `   한 번에 ${LIMIT}건까지`);
  console.log('');

  /* 아직 안 부른 공연을 가져옵니다.
     ★ 최근 것부터 — 지난 공연보다 앞으로 열릴 것이 쓸모 있습니다. */
  const todo = await sb('spot?select=id,kopis_id,title'
    + '&section=eq.' + encodeURIComponent('공연정보')
    + '&kopis_id=not.is.null&cast_fetched_at=is.null'
    + '&order=date_from.desc.nullslast&limit=' + LIMIT);

  if (!todo || !todo.length) {
    console.log('부를 공연이 없습니다. 모두 마쳤습니다.');
    return;
  }
  console.log(`부를 공연 ${todo.length}건\n`);

  let ok = 0, empty = 0, fail = 0, names = 0;
  const rows = [];
  const donee = [];

  for (const p of todo) {
    let d = null;
    try {
      d = await kopisDetail(p.kopis_id);
    } catch (e) {
      fail++;
      console.log(`  ★ ${p.kopis_id} — ${e.message}`);
      await sleep(300);
      continue;
    }
    await sleep(220);       /* KOPIS 에 부담을 주지 않으려고 */

    /* 출연진 + 제작진 — 지휘자가 제작진에 있는 일이 있습니다 */
    const list = parseCast(d.cast).concat(parseCast(d.crew));
    const seen = new Set();
    const uniq = list.filter((x) => {
      const k = x.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    donee.push(p.id);
    if (!uniq.length) { empty++; continue; }

    ok++; names += uniq.length;
    uniq.forEach((x, i) => {
      rows.push({
        spot_id: p.id, kopis_id: p.kopis_id,
        name: x.name, role: x.role, ord: i + 1,
        person_id: null, link_status: 'none',
      });
    });

    if (ok <= 8) {
      console.log(`  ${p.title.slice(0, 30)}`);
      console.log(`     ${uniq.map((x) => x.name + (x.role ? `(${x.role})` : '')).join(' · ')}`);
    }
  }

  console.log('');
  console.log(`=== 부름 ${todo.length}건 · 출연자 있음 ${ok} · 없음 ${empty} · 실패 ${fail} ===`);
  console.log(`    모은 이름 ${names}개`);

  if (DRY) { console.log('\n담지 않았습니다 (--dry)'); return; }

  /* 담기 — 200개씩 나눠 */
  let saved = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    await sb('oc_cast?on_conflict=spot_id,name', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(part),
    });
    saved += part.length;
  }
  console.log(`    담음 ${saved}건`);

  /* ★ 부른 공연에 표시를 남깁니다. 이것이 없으면 다음번에 같은 것을
       또 불러 API 호출만 버립니다. 출연자가 없던 공연도 표시합니다 —
       없다는 것도 알아낸 결과입니다. */
  const now = new Date().toISOString();
  for (let i = 0; i < donee.length; i += 100) {
    const part = donee.slice(i, i + 100);
    await sb('spot?id=in.(' + part.join(',') + ')', {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ cast_fetched_at: now }),
    });
  }
  console.log(`    표시함 ${donee.length}건`);

  /* 얼마나 남았나 */
  const left = await fetch(SB_URL + '/rest/v1/spot?select=id'
    + '&section=eq.' + encodeURIComponent('공연정보')
    + '&kopis_id=not.is.null&cast_fetched_at=is.null', {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
               Prefer: 'count=exact', Range: '0-0' },
  }).then((r) => {
    const cr = r.headers.get('content-range') || '';
    return parseInt((cr.split('/')[1] || '0'), 10) || 0;
  }).catch(() => -1);

  if (left >= 0) {
    console.log(`\n▶ 남은 공연 ${left}건`
      + (left ? ` — 다시 돌리시면 이어서 부릅니다` : ' — 모두 마쳤습니다'));
  }
})().catch((e) => { console.error('■ 실패:', e); process.exit(1); });
