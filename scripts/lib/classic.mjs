/* ============================================================
   OPUSCLAM 클래식 판정 — scripts/lib/classic.mjs
   ------------------------------------------------------------
   ★ 이 파일이 정본입니다.
     「클래식인가」를 묻는 곳은 모두 이 파일만 부릅니다.

   ────────────────────────────────────────────────────────────
   ★★ 왜 만들었나 (2026-08-08 · 파트너 결정)

   그동안 클래식 판정이 <b>일곱 군데</b>에 흩어져 있었습니다.
     admin.html(인물 수집 SPARQL) · collect-foundations.mjs
     collect-spot-events.mjs · collect-persons-kr.mjs
     collect-modern.mjs · db-audit.html · modern-clean.html
   각자 다른 잣대라 한 곳을 조여도 다른 곳으로 들어왔습니다.
   야니 사건, 인물 분야 판정 3연속 실패가 모두 이 구조 탓이었습니다.

   ★ 새 원칙 — 「클래식과 연관이 있는가」가 아니라
                「클래식 음악인인가」를 묻습니다.

     · 정치인이 취미로 피아노를 쳐도 받지 않습니다
     · 대중가수가 오케스트라와 협연해도 받지 않습니다
     · 애매하면 <b>버립니다</b>

     놓친 것은 조건을 넓혀 다시 받으면 됩니다(비용 0).
     들어온 쓰레기는 사람이 눈으로 골라내야 합니다(비용 큼).
     그러니 <b>엄격하게 받는 쪽이 압도적으로 유리</b>합니다.

   ────────────────────────────────────────────────────────────
   ★ 2026-08-08 실측 (scripts/count-classic.mjs)

     지금 조건(문서 8개 이상·클래식 확인 없음)   27,779명
     엄격(클래식 장르 필수·문서 수 무관)         20,266명
     그때 우리 인물DB                             9,025명

     ▶ 엄격하게 조여도 지금보다 <b>두 배 넘게</b> 받을 수 있습니다.
       문서 8개 언어 문턱이 진짜 병목이었습니다.
       지휘 +209 · 성악 +252 · 바이올린 +218 · 음악교육 +309 …
       클래식 장르가 분명한데 유명하지 않다고 버려지고 있었습니다.

     ▶ 다만 <b>작곡만은 줄어듭니다</b> (14,196 → 6,799).
       옛 작곡가는 위키데이터에 장르(P136)가 아예 없는 일이 많습니다.
       바로크·고전기 작곡가 상당수가 그렇습니다.
       파트너 결정에 따라 <b>장르를 필수로 둡니다.</b>
       놓친 큰 이름은 뒤에 목록으로 보강하는 편이 낫습니다.
   ============================================================ */

/* ── 직업 번호 ─────────────────────────────────────────────
   ★ 2026-08-08 에 위키데이터에 이름을 물어 확인한 것만 넣었습니다.
     (그 전에는 번호와 한국어 이름이 어긋나 있었습니다 —
      Q16003954 를 「비올라」로 적어 두었는데 실제로는 oboist 였습니다) */
export const JOBS = [
  { qid: 'Q36834',    en: 'composer',        field: '작곡' },
  { qid: 'Q158852',   en: 'conductor',       field: '지휘' },
  { qid: 'Q2865819',  en: 'opera singer',    field: '성악' },
  { qid: 'Q486748',   en: 'pianist',         field: '피아노' },
  { qid: 'Q765778',   en: 'organist',        field: '피아노' },
  { qid: 'Q5371902',  en: 'harpsichordist',  field: '피아노' },
  { qid: 'Q1259917',  en: 'violinist',       field: '현악' },
  { qid: 'Q13219637', en: 'cellist',         field: '현악' },
  { qid: 'Q899758',   en: 'violist',         field: '현악' },
  { qid: 'Q1214796',  en: 'double-bassist',  field: '현악' },
  { qid: 'Q3127709',  en: 'harpist',         field: '현악' },
  { qid: 'Q16003954', en: 'oboist',          field: '관악' },
  { qid: 'Q12902372', en: 'flautist',        field: '관악' },
  { qid: 'Q118865',   en: 'clarinetist',     field: '관악' },
  { qid: 'Q12310971', en: 'bassoonist',      field: '관악' },
  { qid: 'Q12377274', en: 'trumpeter',       field: '관악' },
  { qid: 'Q544972',   en: 'trombonist',      field: '관악' },
  { qid: 'Q14915627', en: 'musicologist',    field: '음악학' },
  { qid: 'Q16145150', en: 'music educator',  field: '음악교육' }
];

/* ★ 아직 넣지 않은 것 — 번호를 확인한 뒤에 더하십시오.
     클래식 기타리스트 · 타악 주자 · 성악(오페라 밖) ·
     반주자 · 악장(concertmaster) · 편곡자
   ▶ scripts/count-classic.mjs 에 번호를 넣고 돌리면
     이름과 인원이 함께 나옵니다. 짐작으로 넣지 마십시오. */

/* ── 클래식 장르 계열 ─────────────────────────────────────
   하위 갈래(P279*)까지 봅니다 — 바로크·고전파·낭만·현대음악 등 */
export const CLASSIC_FAM = [
  { qid: 'Q9730', en: 'classical music' },
  { qid: 'Q1344', en: 'opera' }
];

/* ── 배제할 것 ─────────────────────────────────────────────
   admin.html 이 쓰던 번호를 그대로 옮겼습니다. */
/* ★ 아래 세가지는 지금 <b>쓰지 않습니다.</b>
   SPARQL 배제 조각을 빼면서 쓸모가 없어졌고,
   대중음악 판정은 글자(G_POP · O_POP)로 합니다.
   count-classic.mjs 같은 조사용으로만 남겨 둡니다. */
export const POP_FAM  = [{ qid: 'Q373342', en: 'popular music' }];
/* ★ 2026-08-08 바로잡음 — Q37073 은 jazz 가 아니라 <b>pop music</b> 입니다.
   admin.html 에서 번호를 옮길 때 이름을 짐작으로 붙였다가 틀렸습니다.
   위키데이터에 물어보고나서야 알았습니다. */
export const POP_ONE  = [{ qid: 'Q37073',  en: 'pop music' }];
export const POP_JOBS = [
  { qid: 'Q33999',  en: 'actor' },
  { qid: 'Q177220', en: 'singer' }   /* 클래식 성악가는 Q2865819 로 따로 있습니다 */
];

/* ============================================================
   1) 수집할 때 — SPARQL 조각
   ============================================================ */

/** 클래식 장르를 <b>반드시</b> 갖도록 하는 조각 */
export function sparqlClassicRequired(v = '?item') {
  return ' VALUES ?ocFam { ' + CLASSIC_FAM.map(f => 'wd:' + f.qid).join(' ') + ' } '
       + v + ' wdt:P136/wdt:P279* ?ocFam . ';
}

/** 대중음악 쪽을 걸러내는 조각
 *
 *  ★ 2026-08-08 — <b>기본으로는 쓰지 마십시오.</b>
 *    SPARQL 로 미리 빼면 우리 잣대와 어긋납니다.
 *      SPARQL   재즈 장르가 있으면 → 배제   ← 거슈윈이 여기서 빠집니다
 *      우리 잣대  클래식이 있으면 → 받음
 *    또 singer · actor 를 빼면 <b>오페라 가수 대부분이 빠집니다</b> —
 *    오페라 가수는 P106 에 opera singer 와 singer 를 함께 갖고,
 *    무대에 서므로 actor 가 붙습니다(마르타 에게르트 사례).
 *
 *  ▶ <b>클래식 장르를 필수로 두면 그것만으로 충분합니다.</b>
 *    받아온 뒤 checkClassic() 이 한 곳에서 판단합니다.
 *    (조사용으로만 남겨 둡니다 — count-classic.mjs)
 */
export function sparqlPopExcluded(v = '?item') {
  let q = '';
  POP_FAM.forEach(f => {
    q += ' FILTER NOT EXISTS { ' + v + ' wdt:P136 ?ocG . ?ocG wdt:P279* wd:' + f.qid + ' } ';
  });
  POP_ONE.forEach(f => {
    q += ' FILTER NOT EXISTS { ' + v + ' wdt:P136 wd:' + f.qid + ' } ';
  });
  POP_JOBS.forEach(j => {
    q += ' FILTER NOT EXISTS { ' + v + ' wdt:P106 wd:' + j.qid + ' } ';
  });
  return q;
}

/**
 * 한 직업에 대한 <b>엄격한</b> 조건 전체.
 *   직업이 있고 + 클래식 장르가 있고 + 대중음악 표시가 없음
 * ★ 문서 수(sitelinks) 문턱은 넣지 않습니다 — 그것이 병목이었습니다.
 */
export function sparqlStrictPerson(jobQid, v = '?item') {
  return v + ' wdt:P106 wd:' + jobQid + ' . '
       + sparqlClassicRequired(v)
       + sparqlPopExcluded(v);
}

/** 여러 직업을 한꺼번에 (VALUES 로 묶습니다) */
export function sparqlStrictAnyJob(v = '?item') {
  return ' VALUES ?ocJob { ' + JOBS.map(j => 'wd:' + j.qid).join(' ') + ' } '
       + v + ' wdt:P106 ?ocJob . '
       + sparqlClassicRequired(v)
       + sparqlPopExcluded(v);
}

/* ============================================================
   2) 이미 담긴 자료를 다시 볼 때 — 글자로 판정
   ------------------------------------------------------------
   ★ 글자 판정은 <b>SPARQL 보다 못합니다.</b>
     수집 단계에서 거르는 것이 가장 정확하고, 이 함수는
     이미 담긴 것을 <b>다시 살펴볼 때</b>만 씁니다.
   ============================================================ */

/* ════════════════════════════════════════════════════════
   2026-08-08 · 두 번째 판 — 첫 판이 크게 틀려서 다시 짰습니다

   [첫 판] 「클래식 장르가 있어야 받는다」
     ▶ 실제로 돌려 보니 <b>브람스가 빠졌습니다.</b>
       위키데이터에 장르가 적힌 작곡가는 5.5% 뿐입니다(133,412 중 7,391).
       장르를 필수로 두면 대부분이 탈락합니다.
     ▶ 클래식 장르 목록도 너무 좁았습니다 —
       operetta · motet · mass · impressionism · minimalist ·
       symphonic poem · ballet · art song 이 전부 빠져 있었습니다.
     ▶ chanson 을 대중음악으로 넣은 탓에 <b>조스캥 데프레</b>가 걸렸습니다.
       샹송은 르네상스 성악곡이기도 합니다.
     ▶ 「대중음악이 섞이면 배제」가 너무 세서 거슈윈·번스타인·
       필립 글래스·윈턴 마살리스가 전부 빠졌습니다.

   [두 번째 판] <b>직업을 중심축</b>으로 씁니다
     장르는 5.5%만 적혀 있지만 직업은 대부분 적혀 있습니다.

     ① 클래식 장르가 하나라도 있으면        → 받음
        (대중음악이 섞여 있어도 받습니다 — 거슈윈·마살리스)
     ② 대중음악 장르만 있으면              → 뺌
     ③ 대중음악 전용 직업이면              → 뺌
     ④ 클래식 직업이 있으면                → 받음
        (장르가 비어 있어도 — 브람스·진은숙·백병동)
     ⑤ 장르도 직업도 없으면                → <b>그대로 둡니다</b>
        판정할 근거가 없으므로 건드리지 않습니다 (스티브 라이히)

   ★ 파트너 결정 (2026-08-08) — 다음은 모두 <b>넣습니다</b>
     영화음악 · 오페레타 · 클래식＋재즈 · 탱고/민속 계열
   ════════════════════════════════════════════════════════ */

/* ── 클래식으로 인정하는 장르 ──────────────────────────────
   ★ 갈래·형식·사조를 모두 넣었습니다. 위키데이터는 장르 칸에
     「motet」「symphony」「minimalist music」처럼 형식을 적기도 합니다. */
const G_CLASSIC = new RegExp([
  // 큰 갈래
  'classical', 'art music', 'concert music', 'orchestral', 'symphon',
  '\\bopera\\b', 'operatic', 'operetta', 'singspiel', 'zarzuela',
  'chamber music', 'choral', 'sacred music', 'church music', 'liturgical',
  // 시대·사조
  'baroque', 'renaissance music', 'medieval music', 'early music',
  'romantic music', 'romanticism', 'classicism', 'impressionism',
  'expressionism', 'minimalis', 'serialism', 'twelve-tone', 'atonal',
  'neoclassic', 'avant-?garde', 'contemporary classical', 'new music',
  'experimental music', 'electroacoustic', 'musique concr',
  // 형식
  'motet', '\\bmass\\b', 'requiem', 'oratorio', 'cantata', 'passion',
  'chorale', 'madrigal', '\\bchanson\\b', '\\blied\\b', 'art song',
  'concerto', 'sonata', '\\bfugue\\b', '\\betude\\b', 'prelude',
  'nocturne', 'symphonic poem', 'tone poem', 'overture', 'suite',
  '\\bballet\\b', 'incidental music', 'chamber opera',
  // 영화·무대 음악 (★ 파트너 결정으로 포함)
  'film score', 'film music', 'soundtrack', 'score music',
  // 한국어
  '클래식', '고전음악', '현대음악', '오페라', '오페레타', '관현악', '교향',
  '실내악', '합창', '가곡', '성가', '미사', '칸타타', '협주곡', '소나타',
  '발레', '영화음악', '창작음악', '국악'
].join('|'), 'i');

/* ── 대중음악 전용 장르 ────────────────────────────────────
   ★ 클래식 장르가 <b>하나도 없을 때만</b> 쓰입니다.
     거슈윈처럼 클래식과 재즈를 함께 하는 사람은 ①에서 이미 받습니다.
   ★ chanson 은 뺐습니다 — 르네상스 성악곡이기도 합니다. */
const G_POP = new RegExp([
  '\\bpop\\b', 'pop music', 'k-?pop', 'j-?pop', 'c-?pop',
  '\\brock\\b', 'punk', 'metal', 'grunge', 'indie rock',
  'hip.?hop', '\\brap\\b', 'r&b', 'rhythm and blues', '\\bsoul\\b',
  '\\bfunk\\b', '\\bdisco\\b', '\\bblues\\b',
  '\\bjazz\\b', 'bebop', 'swing music', 'dixieland', 'ragtime', 'boogie',
  'electronic dance', '\\bedm\\b', 'techno', 'trance', 'dubstep',
  'house music', 'drum and bass', 'ambient', 'new-?age',
  'country music', 'bluegrass', 'reggae', '\\bska\\b', 'reggaeton',
  '\\benka\\b', '\\btrot\\b', 'schlager',
  'classical crossover', 'operatic pop', 'popera',
  '가요', '트로트', '힙합', '아이돌', '댄스음악'
].join('|'), 'i');

/* ── 클래식 직업 ───────────────────────────────────────────
   ★ 장르가 비어 있어도 이것으로 받습니다.
     브람스(장르 없음 · pianist, conductor, composer)가 살아나는 길입니다.
   ★ 「가끔 클래식」을 막는 일은 위 ②③이 맡습니다. */
const O_CLASSIC = new RegExp([
  'composer', 'conductor', 'kapellmeister', 'chapelmaster',
  'opera singer', 'opera director', 'opera vocal coach', 'voice teacher',
  'pianist', 'organist', 'harpsichordist', 'fortepianist',
  'violinist', 'violist', 'cellist', 'double-?bassist', 'harpist',
  'flautist', 'flutist', 'oboist', 'clarinetist', 'bassoonist',
  'trumpeter', 'trombonist', 'tubist', 'french horn',
  'concertmaster', 'r[eé]p[eé]titeur', 'orchestrator',
  'musicolog', 'music theorist', 'music historian', 'ethnomusicolog',
  'lutenist', 'viol player', 'carillonist', 'church musician',
  'choir director', 'chorus master', 'music director',
  'music educator', 'music teacher', 'piano teacher', 'violin teacher',
  'music arranger', 'librettist', 'chapelmaster', 'court musician',
  'musical instrument maker', 'luthier', 'organ builder', 'piano maker',
  'classical composer', 'film score composer', 'accompanist'
].join('|'), 'i');

/* ── 대중음악 <b>전용</b> 직업 ────────────────────────────
   ★ 2026-08-08 두 번째 고침 — 첫 판에서 <b>오페라 가수가 대거 빠졌습니다.</b>
       마르타 에게르트  film actor, opera singer, stage actor
       김주택          opera singer, musical theatre actor, singer
     오페라 가수는 무대에 서니 stage actor 가 붙는 것이 당연합니다.
     그런데 배우·정치인 검사를 클래식 직업보다 앞에 두어
     opera singer 가 있어도 actor 때문에 빠졌습니다.

   ▶ 이제 여기에는 <b>대중음악 전용 직업만</b> 둡니다.
     배우·정치인·방송인 같은 「음악 밖 직업」은 여기 넣지 않습니다.
     그런 사람은 <b>음악 직업이 하나도 없을 때</b> 걸러집니다. */
const O_POP = new RegExp([
  '\\brapper\\b', '\\bdj\\b', 'disc jockey', 'turntablist', 'beatboxer',
  'singer-songwriter', 'pop singer', 'rock musician', 'idol\\b',
  'jazz musician', 'jazz pianist', 'jazz guitarist', 'jazz singer',
  'session musician', 'backing vocalist'
].join('|'), 'i');


/* ── 소개문으로 보는 마지막 근거 ──────────────────────────
   ★ 2026-08-08 세 번째 고침 — 한국 근현대 음악가가 대거 빠졌습니다.
       김자경(한국 최초 오페라단) · 김천애(봉선화) · 금수현(그네)
       안병원(우리의 소원) · 박태준(오빠생각)
     위키데이터에 opera singer 가 아니라 그냥 singer · academic 으로만
     적혀 있어 직업으로는 살릴 길이 없었습니다.
   ▶ 소개문(위키백과)에 「성악가」「작곡가」가 적혀 있으면 살립니다. */
const D_CLASSIC = /성악가|작곡가|지휘자|피아니스트|바이올리니스트|첼리스트|비올리스트|오르가니스트|음악학자|국악인|명창|클래식|고전음악|현대음악|오페라|관현악|교향악|실내악|합창단|소프라노|메조|알토|테너|바리톤|베이스\s*가수|음악\s*교육자|음악가|作曲家|classical|opera singer|\bcomposer\b|\bconductor\b|\bpianist\b|\bviolinist\b|\bcellist\b|musicolog/i;

/* 소개문에 대중음악 표시가 뚜렷하면 살리지 않습니다 */
const D_POP = /대중가수|아이돌|가요|트로트|힙합|래퍼|록\s*밴드|재즈\s*(?:뮤지션|연주자|가수)|싱어송라이터|k-?pop|\brapper\b|\bidol\b|rock band|pop singer/i;

/**
 * 이미 담긴 자료가 클래식인지 다시 봅니다.
 *
 * @param {object} p  { wd_genre, wd_occupation, description, description_en, field }
 * @returns {{ ok:boolean, why:string }}
 *
 * 판정 차례
 *   ① 장르에 대중음악이 섞이면        → 뺌 (클래식 낱말이 있어도)
 *   ② 장르에 클래식이 있으면          → 받음
 *   ③ 직업이 클래식 전용이면          → 받음
 *   ④ 직업이 대중·연기·정치 쪽이면    → 뺌
 *   ⑤ 그 밖                          → 「근거 없음」으로 뺌
 */
export function checkClassic(p) {
  const g = String((p && p.wd_genre) || (p && p.genre) || '');
  const o = String((p && p.wd_occupation) || (p && p.occupation) || '');
  const d = String((p && p.description) || '') + ' ' + String((p && p.description_en) || '');

  const hasG = !!g.trim();
  const hasO = !!o.trim();
  const hasD = !!d.trim();

  /* 장르도 직업도 소개문도 없으면 판정하지 않습니다 —
     근거 없이 빼면 스티브 라이히·다케미쓰가 사라집니다. */
  if (!hasG && !hasO && !hasD) return { ok: true, why: '근거 없음 · 그대로 둠' };

  /* ★ 「classical crossover」·「operatic pop」은 클래식이 아닙니다.
     낱말 안에 classical 이 있어 그냥 두면 통과해 버리므로 걷어낸 뒤 봅니다. */
  const gClean = g.replace(/classical\s+crossover|operatic\s+pop|popera|크로스오버/gi, ' ');

  /* ① 클래식 장르가 하나라도 있으면 받습니다.
        대중음악이 섞여 있어도 받습니다 — 거슈윈·번스타인·윈턴 마살리스. */
  if (G_CLASSIC.test(gClean)) return { ok: true, why: '장르가 클래식' };

  /* ② 대중음악 장르만 있으면 뺍니다 — 야니·이루마·크로스오버 가수 */
  if (G_POP.test(g)) return { ok: false, why: '대중음악 장르만 있음' };

  /* ③ 직업을 <b>항목마다 따로</b> 봅니다.
        ★ 통째로 보면 「jazz pianist」의 pianist 가 클래식으로 잡힙니다.
          쉼표로 나눠 항목별로 보면 그 항목은 재즈로 제대로 걸립니다.
        ★ 클래식 항목이 하나라도 있으면 받습니다 —
          「conductor, DJ producer, composer」(센주 아키라) 같은 겸업을
          대중음악 직업 하나 때문에 버리지 않기 위해서입니다. */
  const items = o.split(/[,;·\/|]/).map(x => x.trim()).filter(Boolean);
  const classicItems = items.filter(x => O_CLASSIC.test(x) && !O_POP.test(x));
  const popItems     = items.filter(x => O_POP.test(x));

  if (classicItems.length) return { ok: true, why: '클래식 직업' };
  if (popItems.length)     return { ok: false, why: '대중음악 전용 직업' };

  /* ④ 마지막으로 소개문을 봅니다.
        직업이 그냥 「singer」·「academic」으로만 적힌 한국 근현대
        음악가를 살리는 길입니다. */
  if (hasD && !D_POP.test(d) && D_CLASSIC.test(d)) {
    return { ok: true, why: '소개문이 클래식' };
  }

  /* ⑤ 음악 직업도 근거도 없습니다 */
  return { ok: false, why: hasO ? '음악 직업이 아님' : '클래식 근거 없음' };
}

/** 직업 글자에서 분야를 고릅니다 (JOBS 표를 씁니다) */
export function fieldFromOccupation(occ) {
  const t = String(occ == null ? '' : occ).toLowerCase();
  if (!t.trim()) return '';
  for (const j of JOBS) {
    if (t.indexOf(j.en) >= 0) return j.field;
  }
  return '';
}

/* ============================================================
   3) 번호가 맞는지 확인 — 실행할 때마다 이름을 물어 찍습니다
   ============================================================ */
export function verifyQuery() {
  /* ★ 2026-08-08 — <b>쓰는 번호만</b> 확인합니다.
     POP_FAM · POP_ONE · POP_JOBS 는 SPARQL 배제 조각을 빼면서
     쓰지 않게 됐는데, 확인 목록에는 남아 있어
     <b>쓰지도 않는 번호 때문에 수집기가 멈추었습니다.</b>
     대중음악 판정은 이제 글자(G_POP · O_POP)로만 합니다. */
  const all = []
    .concat(JOBS.map(j => j.qid))
    .concat(CLASSIC_FAM.map(f => f.qid));
  return 'SELECT ?c ?cLabel WHERE { VALUES ?c { '
       + all.map(q => 'wd:' + q).join(' ')
       + ' } ?c rdfs:label ?cLabel FILTER(lang(?cLabel)="en") }';
}

/** verifyQuery 결과를 받아 이름이 맞는지 견줍니다 */
export function verifyReport(nameByQid) {
  const rows = [];
  const all = []
    .concat(JOBS.map(j => ({ qid: j.qid, want: j.en, ko: j.field })))
    .concat(CLASSIC_FAM.map(f => ({ qid: f.qid, want: f.en, ko: '클래식 장르' })));

  let bad = 0;
  for (const x of all) {
    const got = nameByQid[x.qid] || '';
    const ok = got && got.toLowerCase() === x.want.toLowerCase();
    if (!ok) bad++;
    rows.push({ qid: x.qid, want: x.want, got: got || '(못 받음)', ko: x.ko, ok: !!ok });
  }
  return { rows, bad };
}
