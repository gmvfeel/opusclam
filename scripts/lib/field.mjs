/* ============================================================
   OPUSCLAM 인물 분야 판정 — scripts/lib/field.mjs
   ------------------------------------------------------------
   ★ 이 파일이 <b>정본</b>입니다.
     분야를 정하는 규칙은 여기에만 둡니다. 여러 곳에 적으면
     반드시 어긋납니다 (작품 형식표를 하루에 두 번 늘렸던 일).

     쓰는 곳
       scripts/enrich-persons.mjs    새로 들어오는 인물
       scripts/fix-person-field.mjs  이미 담긴 인물 다시 판정

   ★ 2026-08-08 고침 — 무엇이 잘못이었나
     예전에는 <b>규칙을 위에서부터</b> 훑어 처음 맞는 것을 썼습니다.
     `composer` 가 맨 앞이라, 직업 목록에 composer 가 하나라도 있으면
     무조건 「작곡」이 되었습니다.

       마우리치오 폴리니
         concertmaster, pianist, musician, conductor, composer
         → 맨 뒤의 composer 때문에 「작곡」  ✗  (피아니스트입니다)

     위키데이터는 연주자에게도 composer 를 자주 붙입니다.
     그래서 <b>직업 목록에 적힌 순서</b>를 따르도록 바꿨습니다.
     위키데이터는 대체로 주업을 앞에 적습니다.

       폴리니        concertmaster 가 첫 번째 → 연주  ✓
       라흐마니노프   composer 가 첫 번째      → 작곡  ✓

   ★ 그래도 완벽하지는 않습니다.
     위키데이터 편집자가 순서를 아무렇게나 넣은 경우도 있습니다.
     그래서 <b>데이터 신고 통로</b>가 필요합니다. 사람이 알려주면 고칩니다.
   ============================================================ */

/* 직업 하나가 어느 분야인지 — 순서는 「한 직업 안에서만」 씁니다 */
export const FIELD_RULES = [
  [/\bcomposer\b|songwriter/i, '작곡'],
  [/opera singer|\bsinger\b|soprano|mezzo|contralto|\btenor\b|baritone|countertenor|\bbass\b|vocalist|chanteuse/i, '성악'],
  [/conductor|kapellmeister|choir director|music director/i, '지휘'],
  [/pianist|violinist|cellist|violist|organist|flautist|flutist|oboist|clarinet|bassoon|trumpet|trombon|tubist|harpist|percussion|guitarist|bassist|drummer|harpsichord|instrumentalist|accompanist|concertmaster|luthier|violin maker/i, '연주'],
  [/musicolog|music theorist|music historian/i, '음악학'],
  [/music educator|music teacher|pedagogue|university teacher/i, '음악교육'],
  [/arranger|orchestrator/i, '편곡'],
  [/music critic|critic/i, '평론'],
];

/* 분야를 정할 수 없는 너무 넓은 직업 — 건너뜁니다.
   ★ 이런 것을 근거로 삼으면 안 됩니다. 작품DB에서 「musical work」가
     69%를 차지하고도 쓸모없었던 것과 같은 이유입니다. */
const TOO_BROAD = /^(musician|artist|performer|music artist|recording artist|singer-songwriter\?|person|human)$/i;

/**
 * 직업 목록에서 분야를 고릅니다.
 *
 *  ★ 목록에 적힌 순서를 먼저 봅니다 (주업이 앞에 오는 경향).
 *    한 직업이 여러 분야에 걸리면 그때만 위 규칙 순서를 씁니다.
 *
 * @param {string} occ  예) "concertmaster, pianist, musician, conductor, composer"
 * @returns {string}    예) "연주"  · 정할 수 없으면 빈 문자열
 */
export function guessField(occ) {
  const raw = String(occ == null ? '' : occ);
  if (!raw.trim()) return '';

  const list = raw.split(/[,;·\/|]/).map(s => s.trim()).filter(Boolean);

  for (const one of list) {
    if (TOO_BROAD.test(one)) continue;
    for (const [re, label] of FIELD_RULES) {
      if (re.test(one)) return label;
    }
  }

  /* 쉼표로 나뉘지 않은 한 덩어리일 수도 있습니다 (예전 자료).
     그때는 예전처럼 통째로 봅니다 — 없는 것보다는 낫습니다. */
  if (list.length <= 1) {
    for (const [re, label] of FIELD_RULES) {
      if (re.test(raw)) return label;
    }
  }

  return '';
}
