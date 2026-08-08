/* ============================================================
   OPUSCLAM 인물 분야 판정 — scripts/lib/field.mjs
   ------------------------------------------------------------
   ★ 이 파일이 정본입니다. 규칙을 여러 곳에 두면 반드시 어긋납니다.
     쓰는 곳 — enrich-persons.mjs · fix-person-field.mjs

   ────────────────────────────────────────────────────────────
   ★★ 2026-08-08 · 두 번 틀리고 세 번째입니다. 기록해 둡니다.

   [처음]  규칙 차례대로 훑어 처음 맞는 것 — `composer` 가 맨 앞
     폴리니(concertmaster, pianist, … composer) → 「작곡」  ✗

   [두 번째] 직업 목록에 적힌 차례를 따름
     ▶ 「위키데이터는 주업을 앞에 적는다」고 짐작했는데 틀렸습니다.
       모차르트  music educator, violinist, organist, pianist, musician, composer
       폴리니    concertmaster, pianist, musician, conductor, composer
     둘 다 composer 가 맨 뒤입니다. 차례에 뜻이 없습니다.
     실제로 돌려 보니 5,946명이 바뀌는데 그 안에
       모차르트·바흐 → 음악교육 · 바그너 → 평론 · 쇼팽 → 연주
     가 들어 있었습니다.
     ▶ 제가 만든 시험 15가지로만 확인하고 실제 자료로 확인하지 않은 것이
       원인입니다. 어제 문서에 「표본을 먼저 뽑으라」고 적어 놓고 어겼습니다.

   [지금] 소개문의 첫 대목을 봅니다
     description(한국어 위키백과)·description_en(영문 위키백과)은
     그 사람이 무엇으로 알려졌는지를 첫 문장에 적습니다.
       모차르트  「… 오스트리아의 작곡가이다」      → 작곡
       폴리니    「… 이탈리아의 피아니스트이다」    → 연주
       카라얀    「… 오스트리아의 지휘자이다」      → 지휘
     여러 직업이 나오면 문장에서 먼저 나온 것을 씁니다.
       「작곡가 겸 피아니스트」 → 작곡
       「피아니스트 겸 작곡가」 → 연주

   ★ 소개문이 없으면 아무것도 바꾸지 않습니다.
     짐작으로 고치느니 그대로 두는 편이 낫습니다.
   ============================================================ */

/* ── 소개문에서 찾을 말 ─────────────────────────────────────
   ★ 문장에서 먼저 나온 것이 이깁니다. 아래 차례는 뜻이 없습니다.
   ★ 「음악교육」·「평론」은 일부러 넣지 않았습니다.
     첫 문장에 「교육자」·「평론가」가 먼저 오는 일은 드물고,
     넣으면 모차르트가 음악교육자가 되는 일이 또 생깁니다. */
const TEXT_RULES = [
  ['작곡', /작곡가|\bcomposer\b/i],
  ['지휘', /지휘자|\bconductor\b|kapellmeister|dirigent/i],
  ['성악', /성악가|보컬리스트|소프라노|메조|알토|테너|바리톤|오페라\s*가수|\bsoprano\b|\bmezzo|\bcontralto\b|\btenor\b|\bbaritone\b|countertenor|opera singer|\bsinger\b|vocalist/i],
  ['연주', /피아니스트|바이올리니스트|첼리스트|비올리스트|오르가니스트|하피스트|플루티스트|기타리스트|연주자|\bpianist\b|\bviolinist\b|\bcellist\b|\bviolist\b|\borganist\b|\bharpsichordist\b|\bflautist\b|\bflutist\b|\boboist\b|\bclarinetist\b|\bbassoonist\b|\btrumpeter\b|\btrombonist\b|\bharpist\b|\bguitarist\b|percussionist|concertmaster|instrumentalist|\bvirtuoso\b/i],
  ['음악학', /음악학자|음악\s*이론가|음악\s*사학자|musicolog|music theorist|music historian/i],
  ['국악', /국악인|판소리|명창|가야금|거문고|해금|대금|정가|gugak|pansori/i],
  ['편곡', /편곡자|\barranger\b|orchestrator/i]
];

/* ── 소개문이 없을 때 쓰는 직업 목록 규칙 ────────────────────
   ★ 처음 방식(규칙 차례대로)을 그대로 둡니다.
     빈칸을 채울 때만 씁니다 — 이미 들어 있는 값을 이것으로 고치지 않습니다. */
export const FIELD_RULES = [
  [/\bcomposer\b|songwriter/i, '작곡'],
  [/opera singer|\bsinger\b|soprano|mezzo|contralto|\btenor\b|baritone|countertenor|\bbass\b|vocalist|chanteuse/i, '성악'],
  [/conductor|kapellmeister|choir director|music director/i, '지휘'],
  [/pianist|violinist|cellist|violist|organist|flautist|flutist|oboist|clarinet|bassoon|trumpet|trombon|tubist|harpist|percussion|guitarist|bassist|drummer|harpsichord|instrumentalist|accompanist|concertmaster|luthier|violin maker/i, '연주'],
  [/musicolog|music theorist|music historian/i, '음악학'],
  [/music educator|music teacher|pedagogue|university teacher/i, '음악교육'],
  [/arranger|orchestrator/i, '편곡'],
  [/music critic|critic/i, '평론']
];

/**
 * 소개문에서 분야를 고릅니다.
 *  ★ 문장에서 가장 먼저 나온 직업어를 씁니다.
 *  ★ 첫머리만 봅니다 — 뒤쪽의 「작곡가의 아들로 태어나」에 걸리지 않게.
 */
export function fieldFromText(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return '';

  /* 첫 문장까지만. 문장이 길면 앞 170자.
     ★ 「J. S. Bach」처럼 이름 안의 마침표를 문장 끝으로 보지 않도록
       한 글자 약자는 미리 지워 두고 위치를 찾습니다. */
  let head = raw.slice(0, 400);
  const probe = head.replace(/\b[A-Z]\.\s?/g, 'XX');
  const m = /[.。!?](?:\s|$)/.exec(probe);
  if (m && m.index > 20) head = head.slice(0, m.index + 1);
  if (head.length > 170) head = head.slice(0, 170);

  let best = '';
  let bestAt = Infinity;
  for (const [label, re] of TEXT_RULES) {
    const hit = re.exec(head);
    if (hit && hit.index < bestAt) { best = label; bestAt = hit.index; }
  }
  return best;
}

/**
 * 지금 적힌 분야가 소개문에 나오는지 봅니다.
 *
 *  ★ 2026-08-08 세 번째 고침 — 가장 중요한 부분입니다.
 *    소개문의 처음에 나오는 직업이 그 사람의 대표 직업이라고
 *    짐작했는데 틀렸습니다.
 *      힌데미트  「독일의 바이올리니스트, 비올리스트 및 작곡가」
 *      체르니    「오스트리아의 피아니스트, 교사이자 작곡가」
 *    둘 다 작곡가로 기억되는 사람인데 연주가 먼저 적혀 있습니다.
 *
 *  ▶ 그래서 「무엇으로 바꿀까」가 아니라
 *    「지금 값이 틀렸다고 확신할 수 있나」를 봅니다.
 *    지금 값이 소개문에 <b>아예 나오지 않을 때만</b> 고칩니다.
 *      폴리니  「이탈리아의 피아니스트」 — 작곡가가 없음 → 고침
 *      힌데미트 작곡가가 있음 → 그대로 둡니다
 *    애매한 것은 손대지 않습니다. 틀리게 고치느니 그대로 두고
 *    신고를 받아 하나씩 고치는 편이 낫습니다.
 *
 * @returns {boolean} 근거가 있으면 true · 규칙이 없는 분야도 true(건들지 않음)
 */
export function hasEvidence(field, text) {
  const f = String(field == null ? '' : field).trim();
  if (!f) return false;

  const rule = TEXT_RULES.find(r => r[0] === f);
  /* 「음악교육」·「평론」처럼 소개문 규칙이 없는 분야는
     틀렸다고 단정할 수 없으므로 그대로 둡니다. */
  if (!rule) return true;

  const raw = String(text == null ? '' : text).trim();
  if (!raw) return false;
  return rule[1].test(raw.slice(0, 400));
}

/** 직업 목록에서 분야를 고릅니다 (소개문이 없을 때만). */
export function guessField(occ) {
  const t = String(occ == null ? '' : occ);
  if (!t.trim()) return '';
  for (const [re, label] of FIELD_RULES) if (re.test(t)) return label;
  return '';
}

/**
 * 인물 한 명의 분야를 정합니다.
 * @returns {{field:string, from:string}}
 *   from — 'ko소개' · 'en소개' · '직업목록' · '' (정할 수 없음)
 */
export function decideField(p) {
  const ko = fieldFromText(p && p.description);
  if (ko) return { field: ko, from: 'ko소개' };

  const en = fieldFromText(p && p.description_en);
  if (en) return { field: en, from: 'en소개' };

  const oc = guessField(p && p.wd_occupation);
  if (oc) return { field: oc, from: '직업목록' };

  return { field: '', from: '' };
}
