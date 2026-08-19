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
//            SCAN_DICT=1    사전만 짓고 멈춥니다 (작품 규칙 확인용 · 몇 초)
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
/* ★ 2026-08-19 · 사전만 짓고 멈춥니다 — 작품 규칙을 고칠 때 숫자만 빨리
   보기 위한 것입니다. 글 5,364개를 훑지 않으니 몇 초면 끝납니다. */
const DICT_ONLY = process.env.SCAN_DICT === '1';

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
  /* ★ 2026-08-19 시험 실행에서 드러난 것 —
     「김나지움」은 독일 인문계 고등학교를 가리키는 <b>보통 이름</b>이고,
     「왕립음악원」은 런던·덴마크·스웨덴 등 <b>여러 나라에 있습니다.</b>
     학교DB 에 나라 없이 이 이름만 들어 있는 줄이 있어서 아무 글에나
     걸렸습니다(입시요강에서 왕립음악원 8 · 김나지움 4).
     ▶ 자료를 「런던 왕립음악원」으로 고치면 <b>저절로 다시 잡힙니다.</b> */
  '김나지움','왕립음악원','왕립음악대학','국립음악원','시립교향악단',
  '음악학원','예술학교','예술고등학교','오페라하우스','오페라 하우스',
]);

/* ★★ 영문 일반명사 — 2026-08-19 시험에서 <b>「conservatory」</b>가
   두 글에 걸렸습니다. 학교DB 에 그 이름만 든 줄이 있다는 뜻입니다.
   ★ <b>이름 전체가 이것과 똑같을 때만</b> 버립니다. 그래서
     「Sydney Opera House」·「Musikverein」·「Concertgebouw」는 남습니다. */
const GENERIC_EN = new Set([
  'conservatory','conservatoire','conservatorio','konservatorium',
  'academy','academy of music','music academy','music school',
  'school of music','college of music','university','college','school',
  'gymnasium','hochschule','musikhochschule','philharmonic','orchestra',
  'symphony','symphony orchestra','opera','opera house','concert hall',
  'chamber orchestra','royal academy of music','royal college of music',
  /* ★ 2026-08-19 실제 실행에서 남은 것 —
     「Hochschule für Musik und Theater」는 라이프치히·하노버·뮌헨·
     로스토크·함부르크에 <b>다 있습니다.</b> 도시 이름이 없으면 어디인지
     알 수 없습니다. 「Academy of Music」도 같습니다. */
  'hochschule für musik','hochschule für musik und theater',
  'universität für musik','universität für musik und darstellende kunst',
  'accademia','accademia di musica','escuela de música','école de musique',
  'staatliche hochschule für musik','musikkonservatorium',
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

/* ★★ 2026-08-19 · <b>넣기만 하고 빼지 않고 있었습니다</b>
   ─────────────────────────────────────────────────────────────
     훑개는 찾은 것을 <b>덧쓰기만</b> 했습니다. 그러면 —
       · 글을 <b>숨기면</b> 다시 안 훑으므로, 예전에 적어 둔 줄이 남습니다
         → 인물 화면에 <b>눌러도 볼 수 없는 글</b>이 뜹니다
       · 글을 <b>고쳐서</b> 이름을 지워도, 예전 줄이 그대로 남습니다
         → 나오지도 않는 사람이 「이 글에 나온 것」에 뜹니다
     ▶ 그래서 훑고 난 뒤 <b>이번에 못 찾은 줄은 거둡니다.</b>
   ★ 사람이 물린 것(status='no')은 건드리지 않습니다. */
async function sbDeleteIds(ids) {
  for (let i = 0; i < ids.length; i += 150) {
    const part = ids.slice(i, i + 150);
    const r = await fetch(SUPABASE_URL + '/rest/v1/entity_mentions'
      + '?id=in.(' + part.join(',') + ')', { method: 'DELETE', headers: H });
    if (!r.ok) throw new Error('DELETE ' + r.status + ' ' + (await r.text()).slice(0, 160));
  }
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
  /* ★★ 2026-08-19 · 작품을 더합니다
     ★ 칸 이름이 다릅니다 — 다른 갈래는 name_ko/name_en 인데
       작품은 <b>title_ko/title</b> 입니다. 그래서 적어 둡니다.
     ★ 「사람들이 실제로 부르는 이름」만 씁니다. 아래 workOk 참조. */
  { type:'work', table:'person_works', who:false, label:'작품',
    ko:'title_ko', en:'title', extra:'genre' },
];

/* ★★ 작품 이름은 <b>다른 갈래보다 훨씬 까다롭게</b> 거릅니다
   ─────────────────────────────────────────────────────────────
   2026-08-19 · 실제 자료로 재 보고 정한 규칙입니다
   (sql/workscan-01·02-A-preview.sql)

   ★ 무엇이 문제인가 — 작품 제목은 <b>서로 겹칩니다.</b>
       「교향곡 2번」  ← 31 작품이 같은 이름을 씁니다
       「발라드 3번」  ← 우리 DB 엔 쇼팽 것뿐이지만, 브람스도 썼습니다
     겹치는 이름을 그대로 넣으면 <b>엉뚱한 작곡가의 곡</b>으로 이어집니다.

   ★ 그리고 <b>아무도 그렇게 부르지 않는 이름</b>이 많습니다.
       「피아노, 플루트, 바순을 위한 삼중주, WoO 37」
       「Ich lasse dich nicht, du segnest mich denn, BWV 157」
     글에 이대로 적힐 일이 없으니 넣어 봐야 걸리지 않습니다.

   ★ 그래서 <b>담백한 이름</b>만 씁니다 —
     겨울 나그네 · 죽음의 무도 · 마탄의 사수 · 라 보엠 · 마술피리 · 정화된 밤 */
const WORK_BAN = new Set([
  '봄','여름','가을','겨울','사랑','노래','기도','꿈','바다','하늘',
  '아침','저녁','밤','축제','행진','무곡','서곡','전주곡','환상곡','환타지아',
  '연습곡','야상곡','녹턴','즉흥곡','왈츠','소나타','교향곡','협주곡',
  '모음곡','변주곡','미사','레퀴엠','푸가','대푸가','팔중주','8중주','나비','해적',
]);

/* ★★ 2026-08-19 실제 실행에서 드러난 것 — <b>형식 이름이 통째로 걸립니다</b>
   ─────────────────────────────────────────────────────────────────
     「피아노 소나타」  78건   「바이올린 소나타」  「피아노 삼중주」
     「피아노 오중주」        「클라리넷 협주곡」  「사라방드」
   이것들은 <b>곡 이름이 아니라 형식 이름</b>입니다. 우리 DB 에 그 이름을
   가진 작품이 하나뿐이라 「혼자 쓰는 이름」으로 통과했지만, 글에서는
   <b>아무 작곡가의 피아노 소나타</b>를 뜻합니다.

   ★ 낱말을 하나하나 금지어에 적는 방법은 끝이 없습니다
     (피아노 소나타 · 바이올린 소나타 · 첼로 소나타 · 플루트 소나타 …).
   ▶ 그래서 <b>「악기말 + 형식말 로만 이루어진 제목」</b>을 통째로 뺍니다.
     「겨울 나그네」·「죽음의 무도」·「대지의 노래」는 살아남고,
     「피아노 소나타」·「현악 사중주」는 빠집니다.

   ★ 성부 이름(알토·소프라노…)은 <b>일부러 넣지 않았습니다</b> —
     브람스 「알토 랩소디」처럼 <b>진짜 곡 이름</b>이 걸려 버립니다. */
const FORM_WORD = new Set([
  /* 악기·편성 */
  '피아노','바이올린','비올라','첼로','콘트라베이스','더블베이스',
  '플루트','피콜로','오보에','클라리넷','바순','색소폰','리코더',
  '호른','트럼펫','트롬본','튜바','코르넷','하프','기타','류트',
  '오르간','하프시코드','쳄발로','클라비코드','건반','타악기','팀파니',
  '관현악','현악','목관','금관','실내','관악','독주','합주','무반주',
  /* 형식·갈래 */
  '소나타','소나티나','협주곡','교향곡','신포니아','모음곡','조곡',
  '변주곡','전주곡','간주곡','후주곡','서곡','야상곡','즉흥곡',
  '환상곡','환타지아','연습곡','무곡','왈츠','행진곡','랩소디','광시곡',
  '발라드','스케르초','카프리치오','론도','푸가','카논','파르티타',
  '파사칼리아','샤콘느','사라방드','알르망드','쿠랑트','지그','지그송',
  '미뉴에트','가보트','부레','폴로네즈','마주르카','타란텔라',
  '미사','레퀴엠','칸타타','오라토리오','모테트','마드리갈','아리아',
  '세레나데','디베르티멘토','로망스','엘레지','토카타','인벤션',
  '노벨레테','바가텔','간주','전주','후주','서주','임프롬프투',
  /* 중주·중창 */
  '이중주','삼중주','사중주','오중주','육중주','칠중주','팔중주','구중주',
  '2중주','3중주','4중주','5중주','6중주','7중주','8중주','9중주',
  '중주','중창','합창','듀오','트리오','콰르텟','퀸텟',
  '을','를','와','과','위한',    /* 「…를 위한 …」 꼴을 흘려보냅니다 */
]);

/* 제목이 <b>형식말로만</b> 이루어졌나
   ★ 낱말에 조사가 붙어 옵니다 — 「바이올린<b>과</b> 피아노를 위한 소나타」.
     그래서 그대로 안 맞으면 <b>조사를 떼고 한 번 더</b> 봅니다.
     이걸 안 했더니 저 제목이 살아남았습니다(시험에서 잡았습니다). */
const TAIL = ['와', '과', '을', '를', '의', '에', '은', '는', '이', '가'];

function formWord(x) {
  if (FORM_WORD.has(x)) return true;
  for (const t of TAIL) {
    if (x.length > t.length && x.slice(-t.length) === t
        && FORM_WORD.has(x.slice(0, -t.length))) return true;
  }
  return false;
}

function formOnly(t) {
  const w = String(t).trim().split(/\s+/).filter(Boolean);
  if (!w.length) return true;
  for (const x of w) if (!formWord(x)) return false;
  return true;
}

/* ★★★ 2026-08-19 (둘째 판) · <b>우리말 문장으로 더 자주 쓰이는 제목</b>
   ══════════════════════════════════════════════════════════════
   225건에 한글 제목을 손으로 채운 뒤 드러난 문제입니다.
   슈베르트 「겨울 나그네」 스물네 곡이 한꺼번에 들어왔는데, 그 제목이
   <b>평범한 우리말 구절</b>입니다 — 「그 마을에서 열린 축제」라는 문장이
   슈베르트 가곡으로 이어지면 안 됩니다.

   ★★★ 내가 <b>영리한 규칙을 만들려다 크게 틀렸습니다.</b>
     악보 주소(imslp_ref)가 자기 제목과 다른 큰 작품을 가리키면 「한 곡」이라고
     보았습니다. 겨울 나그네에는 잘 들었지만, 실제 자료로 돌려 보니 —

         [뺌] 피가로의 결혼         ← Le nozze di Figaro
         [뺌] 마술피리              ← Die Zauberflöte
         [뺌] 대관식 미사            ← Mass in C major
         [뺌] 크리스마스 오라토리오   ← Weihnachtsoratorium
         [뺌] G선상의 아리아         ← Orchestral Suite No.3

     <b>주소는 원어, 제목 칸은 영어</b>입니다. 그래서 「말이 다른 것」과
     「큰 작품의 한 곡」을 갈라내지 못했습니다. 108가지가 잘못 빠졌습니다.
     ▶ 자료가 스스로 말해 주는 것 같았지만 실은 <b>말이 달랐을 뿐</b>입니다.

   ▶ 그래서 되돌리고 <b>손으로 적은 짧은 목록</b>을 씁니다.
     영리한 규칙보다 지루하지만 무엇이 빠지는지 <b>눈에 다 보입니다.</b>

   ★ 여기 적는 것은 「곡 이름이면서 <b>평범한 우리말 구절</b>인 것」뿐입니다.
     「도깨비불」·「우편마차」·「거리의 악사」처럼 도드라지는 이름은 그냥 둡니다 —
     글에 그 말이 나오면 정말 그 곡을 가리킬 때가 많습니다.
   ★ 「…에서」로 끝나는 것을 통째로 빼는 규칙도 <b>버렸습니다.</b> 여섯 가지가
     걸렸는데 그중 넷이 멀쩡한 작품이었습니다 —
     「중앙아시아의 초원에서」(보로딘) · 「멀리 있는 연인에게」(베토벤) ·
     「산왕의 궁전에서」 · 「이탈리아에서」. */
const WORK_PHRASE_BAN = new Set([
  /* 겨울 나그네(슈베르트) 가운데, 곡 이름보다 문장으로 더 자주 쓰이는 것 */
  '마을에서', '강 위에서', '봄의 꿈', '마지막 희망', '밤 인사',
  '얼어붙은 마음', '폭풍의 아침', '넘쳐흐르는 눈물',
  /* ★★ 2026-08-19 (셋째 판) · 실제 자료를 재서 찾은 것
     ─────────────────────────────────────────────────────────
     ⓐ <b>작품이 아니라 묶음·갈래·개념</b>인 줄. 위키백과의 「목록 문서」가
       작품처럼 들어온 것입니다. 영문 제목이 <b>복수</b>인 것이 표시입니다 —
         바흐 칸타타(Bach cantata) · 쇼팽이 작곡한 왈츠(Waltzes) ·
         런던 교향곡(London symphonies) · 텔레만의 수난곡(Passions) ·
         트리스탄 화음(Tristan chord ← 이건 <b>화성 이론 용어</b>입니다)
     ⓑ <b>평범한 말과 똑같은</b> 제목.
         「오스트리아의 국가」 ← 「오스트리아의 국가 대표팀」에 걸립니다
         「강제 결혼」        ← 그냥 낱말입니다
     ⓒ 작품이 아닌 것 — 「트러스티 벨」은 <b>비디오 게임</b>입니다. */
  '바흐 칸타타', '쇼팽이 작곡한 왈츠', '런던 교향곡', '텔레만의 수난곡',
  '베토벤의 피아노를 위한 바가텔', '후기 현악 사중주', '트리스탄 화음',
  '오스트리아의 국가', '강제 결혼', '트러스티 벨',
  /* ★ 목록 뒷부분(ㅍ~ㅎ)을 보고 두 가지 더 — 둘 다 <b>묶음 이름</b>입니다.
     지난 표가 80줄에서 잘려 이 대목을 못 봤습니다. 끝까지 봐야 했습니다. */
  '파리 교향곡', '후기 피아노 소나타',
]);

/* ★★★ 2026-08-19 (셋째 판) · <b>작품표에 영화가 섞여 있습니다</b>
   ══════════════════════════════════════════════════════════════
   시험 실행의 「넣은 것 표본」에 이런 것이 있었습니다 —

       아마데우스 · 카핑 베토벤 · 비리디아나 · 엘리펀트 ·
       봄 이야기 · 미녀 갱 카르멘 · 사형수 탈출하다 · 테이킹 사이즈

   모차르트·베토벤 음악을 쓴 <b>영화</b>가 위키데이터에서 그 작곡가에 딸려
   작품표로 들어온 것입니다. 「봄 이야기」·「엘리펀트」는 우리말 글에 아주
   흔한 말이라, 겨울 나그네보다 <b>훨씬 위험합니다.</b>

   ★★ 이번엔 <b>짐작하지 않고 재고 나서</b> 정했습니다
     (sql/workscan-03-A-preview.sql) —

       genre 값별 · 사전에 들어갈 만한 703건 가운데
         Stage 147 · Orchestral 136 · <b>Screen 120</b> · Vocal 90 ·
         Keyboard 86 · Chamber 33 · (빈칸) 91

     짚어 본 영화 열한 편이 <b>전부 Screen</b> 이었습니다. 파솔리니의
     「에디푸스 왕」도 Screen 이라 함께 빠집니다(스트라빈스키의 오페라는
     Stage 이므로 남습니다).

   ★★ 반대로 <b>「빈칸」은 영화 표시가 아닙니다.</b> 91건을 눈으로 보니
     「나의 조국」·「천지창조」·「영웅의 생애」·「왕벌의 비행」·
     「아름답고 푸른 도나우」·「짐노페디」 — 대부분 <b>멀쩡한 작품</b>입니다.
     ▶ 빈칸을 함께 뺐다면 이 작품들을 다 잃었습니다. <b>재 보고 살았습니다.</b> */
const WORK_GENRE_BAN = new Set(['Screen']);

function workOk(ko, genre) {
  const t = String(ko || '').trim();
  /* ★★ 영화·게임 — 갈래 칸이 Screen 인 줄. 재서 확인한 규칙입니다. */
  if (WORK_GENRE_BAN.has(String(genre || '').trim())) return false;
  if (t.length < 4 || t.length > 20) return false;      /* 너무 짧거나 긴 것 */
  if (t.indexOf(',') >= 0 || t.indexOf('(') >= 0) return false;  /* 설명이 붙은 것 */
  if (WORK_BAN.has(t)) return false;                    /* 흔한 말 */
  /* 작품 번호 표기가 붙은 것 — 글에 그대로 적히지 않습니다 */
  if (/(BWV|WoO|Op\.|K\.|D\.|Hob|작품 ?번호)/i.test(t)) return false;
  /* ★★ 「… N번」으로 끝나는 것은 <b>뺍니다.</b>
     우리 DB 에 하나뿐이어도 세상에는 여럿입니다. 「발라드 3번」이
     브람스 글에서 쇼팽으로 이어지면 안 됩니다. */
  if (/[0-9]+ ?번$/.test(t)) return false;
  /* ★ 형식 이름뿐인 제목 — 「피아노 소나타」·「현악 사중주」 */
  if (formOnly(t)) return false;
  /* ★★ 우리말 문장으로 더 자주 쓰이는 제목 — 아래 목록 */
  if (WORK_PHRASE_BAN.has(t)) return false;
  return true;
}

/* 같은 말이 여러 갈래를 가리킬 때 무엇을 먼저 볼 것인가 */
const HOW_RANK  = { fullname:3, fullname_en:3, entity:2, entity_en:2, surname:1 };
const KIND_RANK = { person:6, modern:5, venue:4, school:3, org:2, foundation:1 };

/* 작품 규칙이 무엇을 넣고 무엇을 뺐는지 적어 둡니다 (화면에만 보여 줍니다) */
const WORK_LOG = { ok: [], phrase: [], screen: [] };

async function buildDict() {
  const bySurface = new Map();   // 드러난 말 -> { refs:[{type,id,how}] }
  function put(surface, type, id, how) {
    if (!bySurface.has(surface)) bySurface.set(surface, { refs: [] });
    bySurface.get(surface).refs.push({ type, id, how });
  }

  for (const k of KINDS) {
    /* ★ 숨긴 항목은 담지 않습니다 — 눌러도 갈 곳이 없습니다.
       hidden 이 비어 있는(null) 줄도 살아 있는 것으로 봅니다. */
    /* ★ 갈래마다 이름 칸이 다릅니다 — 적혀 있으면 그것을, 없으면 기본값을. */
    const koCol = k.ko || 'name_ko', enCol = k.en || 'name_en';
    /* ★ 갈래마다 더 필요한 칸이 있을 수 있습니다 — 작품은 악보 주소를 봅니다 */
    const sel = 'id,' + koCol + ',' + enCol + (k.extra ? ',' + k.extra : '');
    const raw = await sbGetAll(k.table, sel, '&hidden=not.is.true');
    /* 아래 코드가 name_ko/name_en 을 보므로 이름을 맞춰 둡니다 */
    const rows = raw.map(r => ({
      id: r.id, name_ko: r[koCol], name_en: r[enCol],
      extra: k.extra ? r[k.extra] : null,
    }));
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
        /* ★ 작품은 규칙이 따로입니다 — 영문 제목은 아예 쓰지 않습니다.
           우리말 글에 영문 원제가 그대로 적히는 일은 드물고,
           적혀도 「Symphony No. 5」처럼 겹치는 것이 대부분입니다. */
        if (k.type === 'work') {
          if (workOk(ko, o.extra)) {
            put(ko, k.type, o.id, 'entity');
            WORK_LOG.ok.push(ko);
          } else if (ko && WORK_PHRASE_BAN.has(ko)) {
            WORK_LOG.phrase.push(ko);
          } else if (ko && WORK_GENRE_BAN.has(String(o.extra || '').trim())) {
            WORK_LOG.screen.push(ko);
          }
          continue;
        }
        /* ★★ 2026-08-19 · <b>한글 칸에 영문이 들어 있는 줄이 있습니다.</b>
           실제 실행에서 「Academy of Music」·「Hochschule für Musik und
           Theater」가 걸렸는데, 둘 다 <b>name_ko 칸</b>에 있던 것입니다.
           그래서 영문 목록으로도 함께 걸러야 합니다 —
           한글 목록만 보면 그냥 통과합니다. */
        if (ko.length >= 4 && !GENERIC.has(ko)
            && !GENERIC_EN.has(ko.toLowerCase())) put(ko, k.type, o.id, 'entity');
        const en = String(o.name_en || '').trim();
        if (en.length >= 8 && !GENERIC_EN.has(en.toLowerCase())
            && /^[A-Za-z][A-Za-z0-9 .'&\-]+$/.test(en)) {
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

  /* ── 작품 규칙이 한 일 ──────────────────────────────────────
     ★ 숫자만 보고 넘기지 말고 <b>표본을 눈으로</b> 보십시오.
       「피아노 소나타」 78건도 숫자만 봤을 때는 몰랐습니다. */
  const uniq = (a) => Array.from(new Set(a));
  const okU = uniq(WORK_LOG.ok);
  console.log('  ── 작품 규칙 ──');
  console.log('   · 사전에 넣은 제목  ' + okU.length + '가지 (줄 ' + WORK_LOG.ok.length + ')');
  console.log('   · 문장·묶음·개념이라 뺌  '
    + uniq(WORK_LOG.phrase).length + '가지 · ' + uniq(WORK_LOG.phrase).join(' · '));
  console.log('   · 영화·게임(genre=Screen)이라 뺌  '
    + uniq(WORK_LOG.screen).length + '가지');
  console.log('     ' + uniq(WORK_LOG.screen).slice(0, 20).join(' · '));
  console.log('   · 넣은 것 표본 40가지');
  for (const s of okU.slice(0, 40)) console.log('     [넣음] ' + s);

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

  /* ★★ 2026-08-19 · <b>숨긴 글까지 훑고 있었습니다</b>
     ─────────────────────────────────────────────────────────────
       정보SPOT 처럼 `hidden` 칸이 있는 표는 <b>숨긴 글</b>이 있습니다.
       그걸 그대로 훑으면, 인물 화면의 「여기가 나온 글」에
       <b>숨겨 둔 글이 뜹니다.</b> 눌러도 볼 수 없는 글입니다.

     ★ 그런데 게시판마다 `hidden` 칸이 <b>있기도 하고 없기도</b> 합니다.
       (핫토픽·뉴스·지식나눔·공연사진·현대음악·태교·유틸리티·
        입시요강·입시커뮤니티 아홉 곳에는 <b>없습니다</b> — 파트너가
        보내 주신 `_oc_hid` 표에서 확인했습니다)
       없는 표에 그 조건을 걸면 통째로 실패합니다(42703).

     ▶ 그래서 <b>먼저 걸어 보고, 없다고 하면 빼고 다시</b> 받습니다.
       표마다 손으로 적어 두면 새 게시판이 생길 때 또 어긋납니다. */
  let docs;
  try {
    docs = await sbGetAll(sc.table, 'id,title,body', '&hidden=not.is.true');
  } catch (e) {
    /* ★ 42703 은 「그런 칸 없음」입니다. 혹시 몰라 400 도 함께 봅니다 —
       칸이 없을 때 오는 답이 언제나 같은 모양이라고 믿지 않습니다. */
    const msg = String(e.message);
    if (msg.indexOf('42703') < 0 && msg.indexOf(' 400 ') < 0) throw e;
    docs = await sbGetAll(sc.table, 'id,title,body', '');
    console.log('  · 이 표에는 hidden 칸이 없습니다 — 그대로 훑습니다');
  }
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
    /*  ★★ 2026-08-19 · <b>여섯 갈래로 넓히면서 여기를 함께 못 고쳤습니다.</b>
        ─────────────────────────────────────────────────────────────
        사전은 갈래를 갖게 됐는데(`type`·`id`), 이 대목은 <b>사람으로 못 박혀</b>
        있었습니다 — `m.ids` 를 읽었지만 사전에는 그런 칸이 없어졌으므로
          TypeError: Cannot read properties of undefined (reading 'slice')
        로 <b>첫 언급에서 바로 멈춥니다.</b>
        ★ 사전만 시험하고 <b>줄 만드는 데까지 이어서 돌려 보지 않아</b> 놓쳤습니다.
          앞으로 이 파일은 <b>사전→훑기→줄 만들기</b>를 한 줄로 이어 시험합니다. */
    const one = new Map();
    for (const m of ms) {
      if (noSet.has(d.id + '|' + m.type + '|' + m.id)) continue;
      const key = m.type + '|' + m.id;
      const conf = scoreOf(m);
      const cur = one.get(key);
      if (!cur) {
        one.set(key, { type: m.type, id: m.id, surface: m.surface,
                       hits: m.hits, conf, how: m.how });
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
        to_type: v.type, to_id: v.id,
        surface: v.surface, hits: v.hits,
        confidence: v.conf, matched_by: v.how,
        status: 'auto', updated_at: new Date().toISOString(),
      });
    }
  }
  if (merged) console.log('  · 같은 것을 여러 이름으로 부른 것 ' + merged + '건을 합쳤습니다');

  console.log('  · 무언가 걸린 글 ' + docHit + '건 · 적을 줄 ' + rows.length + '건');
  const top = {};
  rows.forEach(r => { top[r.surface] = (top[r.surface] || 0) + 1; });
  const top10 = Object.keys(top).sort((a, b) => top[b] - top[a]).slice(0, 10);
  if (top10.length) console.log('  · 많이 나온 것: ' + top10.map(k => k + ' ' + top[k]).join(' · '));

  if (DRY) { console.log('  · 시험 실행이므로 저장하지 않습니다'); return; }

  for (let i = 0; i < rows.length; i += 500) {
    await sbUpsert(rows.slice(i, i + 500));
  }

  /* ── 이번에 못 찾은 줄 거두기 ──────────────────────────────
     ★ 훑개가 스스로 적은 것(status='auto')만 봅니다.
       사람이 물린 것(no)·사람이 맞다고 한 것(ok)은 그대로 둡니다. */
  const keep = new Set(rows.map(r => r.src_id + '|' + r.to_type + '|' + r.to_id));
  const had = await sbGetAll('entity_mentions', 'id,src_id,to_type,to_id',
    '&src_type=eq.' + encodeURIComponent(sc.src) + '&status=eq.auto');
  const gone = had
    .filter(x => !keep.has(x.src_id + '|' + x.to_type + '|' + x.to_id))
    .map(x => x.id);
  if (gone.length) await sbDeleteIds(gone);

  console.log('  · 저장했습니다 · 새로 적은 줄 ' + rows.length
    + (gone.length ? ' · 낡아서 거둔 줄 ' + gone.length : ''));
}

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 글에서 우리 자료 찾기', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');
  const dict = await buildDict();
  if (DICT_ONLY) { console.log('■ 사전만 짓고 멈춥니다 (SCAN_DICT=1)'); return; }
  for (const sc of SOURCES) {
    if (ONLY && ONLY !== sc.src) continue;
    try { await runSource(sc, dict); }
    catch (e) { console.log('■ ' + sc.label + ' 건너뜀 · ' + String(e.message).slice(0, 140)); }
  }
  console.log('■ 완료');
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
