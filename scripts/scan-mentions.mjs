// ============================================================
// OPUSCLAM 글에서 우리 자료 찾아 잇기 (v2 · 여섯 갈래)
//   인물 · 현대음악 · 공연장 · 음악학교 · 음악단체 · 기관재단
//
//  커뮤니티 글·정보SPOT 본문을 훑어, 우리 DB 에 있는 항목이
//  언급됐으면 entity_mentions 에 적어 둡니다.
//
//    글 쪽으로 찾으면   → 「이 글에 나온 것」
//    항목 쪽으로 찾으면 → 「베토벤이 언급된 글 전부」
//
//  ★ 왜 미리 적어 두나
//    글을 볼 때마다 이름 몇천 개를 훑으면 화면이 느려집니다.
//    여기서 미리 해 두면 상세 화면은 자기 줄 몇 개만 읽으면 됩니다.
//
//  ★★ 규칙은 2026-08-19 에 실제 자료로 네 번 재서 정했습니다
//     (sql/mentions-01 ~ 04-A-preview.sql · 결과는 그 파일 머리말에)
//
//  환경변수 · SUPABASE_URL, SUPABASE_SERVICE_KEY
//            SCAN_DRY=1     저장하지 않고 결과만 보여줍니다
//            SCAN_ONLY=spot 한 게시판만 훑습니다
//            SCAN_LIMIT=500 갈래마다 이만큼만 (시험용)
// ============================================================

import { readJson } from './lib/json.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v2';
const DRY   = process.env.SCAN_DRY === '1';
const ONLY  = (process.env.SCAN_ONLY || '').trim();
const LIMIT = Number(process.env.SCAN_LIMIT || 0);

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

// ── 훑을 곳 ──────────────────────────────────────────────────
//  ★ 표를 늘릴 때는 여기 한 줄만 더하면 됩니다.
const SOURCES = [
  { src: 'spot',                table: 'spot',                label: '정보SPOT' },
  { src: 'hottopic',            table: 'hottopic',            label: '핫토픽' },
  { src: 'news',                table: 'news',                label: '뉴스·공지' },
  { src: 'qna',                 table: 'qna',                 label: '지식나눔' },
  { src: 'gallery',             table: 'gallery',             label: '공연사진·영상' },
  { src: 'modern_music',        table: 'modern_music',        label: '현대음악' },
  { src: 'prenatal_music',      table: 'prenatal_music',      label: '태교음악' },
  { src: 'utility',             table: 'utility',             label: '유틸리티' },
  { src: 'admission',           table: 'admission',           label: '입시요강' },
  { src: 'admission_community', table: 'admission_community', label: '입시커뮤니티' },
  { src: 'opusnity',            table: 'opusnity',            label: '오퍼니티' },
];

// ── 쓰지 않을 말 ─────────────────────────────────────────────
//  ★ 사람 이름이 아니라 음악 낱말인 것들입니다. 성으로 뽑히면
//    아무 글에나 걸립니다. 실제 자료에서 확인해 늘려 온 목록입니다.
const BAN = new Set([
  '교향악단','오케스트라','필하모닉','심포니','앙상블','합창단',
  '콰르텟','사중주','삼중주','오중주','트리오','듀오',
  '포스터','아카데미','콩쿠르','콩쿨','페스티벌','리사이틀',
  '마스터클래스','오페라','발레','뮤지컬','챔버','스튜디오',
  '프로젝트','시리즈','클래식','콘서트','음악당','예술의전당',
  '아트홀','아트센터','문화회관','음악원','음악학교','음악대학',
  '교향곡','협주곡','소나타','모음곡','변주곡','전주곡',
  '아리아','칸타타','레퀴엠','미사','세레나데','왈츠',
  // 뜻이 겹치는 흔한 말 (2026-08-19 실제 자료에서 확인)
  '리스트','브리지','사이드','포스트','스코어','마스터',
  /* ★ 「말씀 드리고」처럼 <b>띄어 쓰면</b> 낱말 경계 검사를 통과합니다.
     성으로는 쓰지 않고, 「리카르도 드리고」 풀네임으로만 찾습니다. */
  '드리고','바치고','부치고',
]);

/* ★ 곳·단체의 <b>이름이 곧 일반명사</b>인 것 — 이런 줄은 자료가 잘못
   들어온 것입니다. 「예술의전당」처럼 진짜 이름은 여기 없습니다. */
const GENERIC = new Set([
  '오케스트라','교향악단','합창단','앙상블','필하모닉','심포니',
  '음악당','아트홀','아트센터','문화회관','콘서트홀','대극장','소극장',
  '음악원','음악학교','음악대학','예술대학','대학교','고등학교',
  '클래식','콘서트','페스티벌','콩쿠르','콩쿨','오페라','발레',
]);

// ── 우리말 조사 ──────────────────────────────────────────────
//  ★ 「베토벤의」·「베토벤이」는 이름 뒤에 조사가 붙은 것입니다.
//    이것을 허용하지 않으면 우리말 글에서는 거의 안 걸립니다.
const JOSA1 = new Set(['은','는','이','가','을','를','의','와','과','도','에','만','로','랑','씨','님','역','작','곡','풍']);
const JOSA2 = new Set(['에서','에게','으로','부터','까지','처럼','보다','이나','이란','이라','와의','과의','에는','에도','이며','으며']);

// ── 도우미 ───────────────────────────────────────────────────
const isHangul = (ch) => ch >= '가' && ch <= '힣';

/* 태그를 걷어 냅니다. 본문이 <p><strong>베토벤</strong></p> 이면
   태그 때문에 이름이 쪼개져 보입니다. */
function plain(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

/* ★★ 낱말 경계 검사 — 이 함수가 이 파일의 심장입니다
   ──────────────────────────────────────────────────────────
   왼쪽  : 글 첫머리이거나, 한글이 아닌 것
   오른쪽: 글 끝이거나, 한글이 아니거나, 조사

   이러면
     말씀드리고     → 왼쪽이 「씀」이라 걸리지 않습니다
     하이델베르크   → 왼쪽이 「델」이라 걸리지 않습니다
     프라이부르크   → 오른쪽이 「부」이고 조사가 아니라 걸리지 않습니다
     베토벤의       → 오른쪽이 조사 「의」라 걸립니다             */
/* ★ 영문에도 같은 원리를 씁니다 — 다만 조사가 없으므로 더 단순합니다.
     John Cage 를 찾을 때 Johnson 안에서 걸리면 안 됩니다. */
const isWordEn = (ch) =>
  (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');

function edgeOk(text, at, len) {
  const end = at + len;
  const first = text[at], last = text[end - 1];

  /* ── 왼쪽 ── 같은 갈래의 글자가 이어져 있으면 낱말 가운데입니다 */
  if (at > 0) {
    const p = text[at - 1];
    if (isHangul(first) && isHangul(p)) return false;
    if (isWordEn(first) && isWordEn(p)) return false;
  }

  /* ── 오른쪽 ── */
  if (end >= text.length) return true;
  const c1 = text[end];
  if (isWordEn(last)) return !isWordEn(c1);      /* 영문은 조사가 없습니다 */
  if (!isHangul(c1)) return true;
  if (JOSA2.has(text.slice(end, end + 2))) return true;
  if (JOSA1.has(c1)) return true;
  return false;
}

async function sbGetAll(table, select, extra) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table
      + '?select=' + select + (extra || '') + '&order=id.asc',
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + table + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const b = await readJson(r);
    out.push(...b);
    if (!b.length) break;
    from += b.length;
    if (LIMIT && out.length >= LIMIT) return out.slice(0, LIMIT);
    if (from > 60000) break;
  }
  return out;
}

async function sbUpsert(rows) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/entity_mentions'
    + '?on_conflict=src_type,src_id,to_type,to_id', {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error('UPSERT ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

// ── ① 이름 사전 만들기 ──────────────────────────────────────
/*  ★ 갈래마다 담는 것이 다릅니다
      사람(인물·현대음악) — 풀네임 · 성 · 영문 풀네임
      곳·단체(공연장·학교·음악단체·기관재단) — <b>이름 통째로만</b>
        「예술의전당」을 「전당」으로 줄이면 아무 데나 걸립니다.

    ★ 남의 이름 앞쪽에도 쓰이는 낱말은 성으로 쓰지 않습니다.
      「루트비히」는 「루트비히 판 베토벤」의 앞 낱말인데, 이름이
      「… 루트비히」로 끝나는 다른 사람이 있어서 그 사람이 78번
      언급된 것처럼 세어졌습니다. (2026-08-19 실제 자료)

    ★★ 그리고 <b>긴 것부터</b> 찾습니다. 이것이 갈래를 넓히는 핵심입니다 —
        「시벨리우스 아카데미」(학교)가 「시벨리우스」(사람)보다 먼저
        잡혀야 합니다. 입시요강 다섯 건이 학교를 사람으로 잡고 있었는데,
        학교 이름을 사전에 넣으면 <b>규칙을 안 고쳐도</b> 저절로 바로잡힙니다. */

/* 갈래별 설정 — ★ 늘릴 때는 여기 한 줄만 더하면 됩니다 */
const KINDS = [
  { type:'person',     table:'persons',          who:true,  label:'인물' },
  { type:'modern',     table:'modern_composers', who:true,  label:'현대음악' },
  { type:'venue',      table:'venues',           who:false, label:'공연장' },
  { type:'school',     table:'schools',          who:false, label:'음악학교' },
  { type:'org',        table:'orgs',             who:false, label:'음악단체' },
  { type:'foundation', table:'foundations',      who:false, label:'기관·재단' },
];

/* 같은 말이 여러 갈래를 가리킬 때 무엇을 먼저 볼 것인가 */
const HOW_RANK  = { fullname:3, fullname_en:3, entity:2, entity_en:2, surname:1 };
const KIND_RANK = { person:6, modern:5, venue:4, school:3, org:2, foundation:1 };

async function buildDict() {
  const bySurface = new Map();   // 드러난 말 -> { refs:[{type,id,how}] }
  function put(surface, type, id, how) {
    if (!bySurface.has(surface)) bySurface.set(surface, { refs: [] });
    bySurface.get(surface).refs.push({ type, id, how });
  }

  for (const k of KINDS) {
    /* ★ 숨긴 항목은 담지 않습니다 — 눌러도 갈 곳이 없습니다.
       hidden 이 비어 있는(null) 줄도 살아 있는 것으로 봅니다. */
    const rows = await sbGetAll(k.table, 'id,name_ko,name_en', '&hidden=not.is.true');
    const withKo = rows.filter(r => r.name_ko && String(r.name_ko).trim()).length;
    console.log('  · ' + k.label + ' ' + rows.length + '개 (한글 이름 ' + withKo + '개)');

    if (k.who) {
      /* ── 사람 ── */
      const nonLast = new Set();
      for (const p of rows) {
        if (!p.name_ko) continue;
        const w = String(p.name_ko).trim().split(/\s+/);
        for (let i = 0; i < w.length - 1; i++) nonLast.add(w[i]);
      }
      for (const p of rows) {
        const full = String(p.name_ko || '').trim();
        if (full) {
          const w = full.split(/\s+/);
          if (w.length > 1 && full.length >= 4) put(full, k.type, p.id, 'fullname');
          const s = w[w.length - 1];
          if (s.length >= 3 && /^[가-힣]+$/.test(s) && !BAN.has(s) && !nonLast.has(s)) {
            put(s, k.type, p.id, 'surname');
          }
        }
        /* 영문은 풀네임만 — 성만 쓰면 Sin←Sinfonia 처럼 낱말 가운데 걸립니다 */
        const en = String(p.name_en || '').trim();
        if (en.length >= 8 && en.indexOf(' ') > 0 && /^[A-Za-z][A-Za-z .'\-]+$/.test(en)) {
          put(en, k.type, p.id, 'fullname_en');
        }
      }
    } else {
      /* ── 곳 · 단체 ── 이름 통째로만 ──
         ★★ 2026-08-19 · <b>BAN 을 여기 쓰면 안 됩니다.</b>
           BAN 은 「사람 성으로 뽑혔을 때 아무 데나 걸리는 말」 목록입니다.
           그런데 거기 <b>「예술의전당」·「음악당」</b> 같은 것이 들어 있어서,
           <b>진짜 공연장 이름까지 통째로 버려졌습니다.</b>
           (시험에서 「예술의전당에서 진은숙 신작 초연」의 공연장을 놓쳤습니다)
         ★ 곳·단체는 <b>이름 통째로</b> 맞은 것이라 그런 걱정이 없습니다.
           대신 <b>이름이 곧 일반명사</b>인 것만 따로 거릅니다 —
           그런 줄은 사실 자료가 잘못 들어온 것입니다. */
      for (const o of rows) {
        const ko = String(o.name_ko || '').trim();
        if (ko.length >= 4 && !GENERIC.has(ko)) put(ko, k.type, o.id, 'entity');
        const en = String(o.name_en || '').trim();
        if (en.length >= 8 && /^[A-Za-z][A-Za-z0-9 .'&\-]+$/.test(en)) {
          put(en, k.type, o.id, 'entity_en');
        }
      }
    }
  }

  const list = [...bySurface.entries()].map(([surface, v]) => {
    /* 같은 말이 여럿을 가리키면 <b>더 또렷한 쪽</b>을 먼저 둡니다 */
    const refs = v.refs.slice().sort((a, b) =>
      (HOW_RANK[b.how] - HOW_RANK[a.how]) ||
      (KIND_RANK[b.type] - KIND_RANK[a.type]) ||
      (a.id - b.id));
    const best = refs[0];
    /* 헷갈리는 정도 — 같은 갈래·같은 방식으로 맞는 것이 몇인가 */
    const same = refs.filter(r => r.type === best.type && r.how === best.how).length;
    return { surface, type: best.type, id: best.id, how: best.how, same };
  }).sort((a, b) => b.surface.length - a.surface.length);   /* ★ 긴 것부터 */

  const by = {};
  list.forEach(x => { by[x.type] = (by[x.type] || 0) + 1; });
  console.log('  · 찾을 말 ' + list.length + '개 — '
    + KINDS.map(k => k.label + ' ' + (by[k.type] || 0)).join(' · '));
  return list;
}

// ── ② 글 하나 훑기 ──────────────────────────────────────────
/*  ★ 이미 잡은 자리는 다시 잡지 않습니다.
    「루트비히 판 베토벤」을 풀네임으로 잡았으면, 그 안의 「베토벤」을
    또 잡아 두 줄로 만들지 않습니다.                                */
function scanOne(text, dict) {
  const taken = new Uint8Array(text.length);
  const found = new Map();   // key -> {surface,how,ids,hits}

  /* ★★ 빠르게 만드는 한 줄 — <b>첫 글자가 글에 없으면 아예 찾지 않습니다.</b>
     찾을 말이 12,000개, 글이 4,664건입니다. 그냥 하면 5,600만 번 훑습니다.
     글에 쓰인 글자를 한 번 모아 두면 대부분이 그 자리에서 걸러집니다. */
  const chars = new Set(text);

  for (const d of dict) {
    const s = d.surface;
    if (!chars.has(s[0])) continue;
    let at = text.indexOf(s);
    while (at >= 0) {
      let clash = false;
      for (let i = at; i < at + s.length; i++) if (taken[i]) { clash = true; break; }
      if (!clash && edgeOk(text, at, s.length)) {
        for (let i = at; i < at + s.length; i++) taken[i] = 1;
        const cur = found.get(s);
        if (cur) cur.hits++;
        else found.set(s, { surface: s, how: d.how, type: d.type, id: d.id, same: d.same, hits: 1 });
      }
      at = text.indexOf(s, at + 1);
    }
  }
  return [...found.values()];
}

/* 확신도 ─────────────────────────────────────────────────────
   풀네임        90 — 거의 틀리지 않습니다
   성 · 한 사람  75 — 그 성을 쓰는 사람이 하나뿐
   성 · 여럿     45 — 누구인지 모릅니다. 화면에서 가릴 수 있게 낮게 둡니다 */
function scoreOf(m) {
  if (m.how === 'fullname')    return m.same === 1 ? 90 : 70;
  if (m.how === 'fullname_en') return m.same === 1 ? 85 : 70;
  /* 곳·단체는 이름 통째로 맞은 것이라 사람 성보다 든든합니다 */
  if (m.how === 'entity' || m.how === 'entity_en') return m.same === 1 ? 85 : 60;
  return m.same === 1 ? 75 : 45;            /* 사람 성 */
}

// ── ③ 한 갈래 훑기 ─────────────────────────────────────────
async function runSource(sc, dict) {
  console.log('■ ' + sc.label + ' (' + sc.src + ')');
  const docs = await sbGetAll(sc.table, 'id,title,body', '');
  console.log('  · 글 ' + docs.length + '건');

  // 사람이 물린 것은 다시 만들지 않습니다
  const no = await sbGetAll('entity_mentions', 'src_id,to_type,to_id',
    '&src_type=eq.' + sc.src + '&status=eq.no');
  const noSet = new Set(no.map(x => x.src_id + '|' + x.to_type + '|' + x.to_id));
  if (noSet.size) console.log('  · 사람이 물린 것 ' + noSet.size + '건은 건너뜁니다');

  const rows = [];
  let docHit = 0, merged = 0;
  for (const d of docs) {
    const text = plain((d.title || '') + ' ' + (d.body || ''));
    if (text.length < 4) continue;
    const ms = scanOne(text, dict);
    if (!ms.length) continue;
    docHit++;

    /* ★★ 한 글 안에서 <b>같은 사람이 여러 이름으로</b> 걸립니다
       ─────────────────────────────────────────────────────────
         「루트비히 판 베토벤」 · 「베토벤」 · 「Ludwig van Beethoven」
       셋 다 같은 사람입니다. 그대로 보내면 <b>같은 열쇠가 한 묶음에
       세 번</b> 들어가고, 포스트그레스가 이렇게 거절합니다 —
         ON CONFLICT DO UPDATE command cannot affect row a second time
       (2026-08-03 어드민 화면에서 똑같은 것으로 멈춘 적이 있습니다)

       ▶ 그래서 <b>보내기 전에 합칩니다.</b>
         · 나온 횟수는 <b>더하고</b>
         · 확신도는 <b>가장 높은 것</b>을 쓰고
         · 드러난 말은 <b>가장 긴 것</b>을 남깁니다 (풀네임이 더 알아보기 쉽습니다) */
    const one = new Map();
    for (const m of ms) {
      // 성을 여럿이 쓰면 누구인지 모릅니다 — 가장 작은 번호 하나만 답니다
      const pid = m.ids.slice().sort((a, b) => a - b)[0];
      if (noSet.has(d.id + '|person|' + pid)) continue;
      const key = 'person|' + pid;
      const conf = scoreOf(m);
      const cur = one.get(key);
      if (!cur) {
        one.set(key, { pid, surface: m.surface, hits: m.hits, conf, how: m.how });
      } else {
        merged++;
        cur.hits += m.hits;
        if (conf > cur.conf) { cur.conf = conf; cur.how = m.how; }
        if (m.surface.length > cur.surface.length) cur.surface = m.surface;
      }
    }

    for (const v of one.values()) {
      rows.push({
        src_type: sc.src, src_id: d.id,
        to_type: 'person', to_id: v.pid,
        surface: v.surface, hits: v.hits,
        confidence: v.conf, matched_by: v.how,
        status: 'auto', updated_at: new Date().toISOString(),
      });
    }
  }
  if (merged) console.log('  · 같은 사람을 여러 이름으로 부른 것 ' + merged + '건을 합쳤습니다');

  console.log('  · 무언가 걸린 글 ' + docHit + '건 · 적을 줄 ' + rows.length + '건');
  const top = {};
  rows.forEach(r => { top[r.surface] = (top[r.surface] || 0) + 1; });
  const top10 = Object.keys(top).sort((a, b) => top[b] - top[a]).slice(0, 10);
  if (top10.length) console.log('  · 많이 나온 것: ' + top10.map(k => k + ' ' + top[k]).join(' · '));

  if (DRY) { console.log('  · 시험 실행이므로 저장하지 않습니다'); return; }

  for (let i = 0; i < rows.length; i += 500) {
    await sbUpsert(rows.slice(i, i + 500));
  }
  console.log('  · 저장했습니다');
}

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 글에서 우리 자료 찾기', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');
  const dict = await buildDict();
  for (const sc of SOURCES) {
    if (ONLY && ONLY !== sc.src) continue;
    try { await runSource(sc, dict); }
    catch (e) { console.log('■ ' + sc.label + ' 건너뜀 · ' + String(e.message).slice(0, 140)); }
  }
  console.log('■ 완료');
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
