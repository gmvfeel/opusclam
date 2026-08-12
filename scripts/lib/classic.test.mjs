/* ============================================================
   클래식 판정 양방향 검증 — scripts/lib/classic.test.mjs
   ------------------------------------------------------------
   ★ 「걸러야 할 것」과 「지켜야 할 사람」을 <b>함께</b> 봅니다.
     한쪽만 보면 세 번 겪은 실패를 또 겪습니다 —
       ① composer 가 맨 앞이라 폴리니가 작곡가가 된 일
       ② 「리」 한 글자가 이탈리아·바이올리니스트를 깎은 일
       ③ 이름 30명을 손으로 막다가 야니를 놓친 일

   돌리는 법
     node scripts/lib/classic.test.mjs
   ============================================================ */

import { checkClassic, checkModern } from './classic.mjs';

let pass = 0, fail = 0;
const bad = [];

function t(label, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) bad.push('  ✗ ' + label + '\n      나온 값 ' + JSON.stringify(got)
                    + ' · 바라는 값 ' + JSON.stringify(want));
}
function drop(label, p) { const r = checkClassic(p); t('버려야 함 — ' + label, r.ok, false); return r; }
function keep(label, p) { const r = checkClassic(p); t('지켜야 함 — ' + label, r.ok, true);  return r; }

/* ══ 1. 대중음악 장르에 박힌 클래식 낱말 (2026-08-12 구멍) ══ */
drop('심포닉메탈 밴드',      { wd_genre: 'symphonic metal, gothic metal', wd_occupation: 'singer' });
drop('심포닉 블랙메탈',      { wd_genre: 'symphonic black metal', wd_occupation: 'musician' });
drop('록 오페라',            { wd_genre: 'rock opera, hard rock', wd_occupation: 'singer' });
drop('오케스트럴 팝',        { wd_genre: 'orchestral pop, indie pop', wd_occupation: 'singer' });
drop('바로크 팝',            { wd_genre: 'baroque pop', wd_occupation: 'musician' });
drop('체임버 팝',            { wd_genre: 'chamber pop, indie rock', wd_occupation: 'guitarist' });
drop('심포닉 록',            { wd_genre: 'symphonic rock', wd_occupation: 'drummer' });
drop('오페라틱 메탈',        { wd_genre: 'operatic metal', wd_occupation: 'singer' });
drop('클래시컬 크로스오버',  { wd_genre: 'classical crossover', wd_occupation: 'singer' });
drop('오페라틱 팝',          { wd_genre: 'operatic pop', wd_occupation: 'singer' });

/* ══ 2. 대중음악 겸업 작곡·제작 ══ */
drop('장르없는 팝 작곡가',
  { wd_occupation: 'singer, songwriter, composer, record producer' });
drop('작곡가 겸 래퍼',       { wd_occupation: 'composer, rapper' });
drop('편곡가 겸 DJ',         { wd_occupation: 'music arranger, DJ' });

/* ══ 3. 소개문 ══ */
drop('대중음악가',           { description: '대한민국의 대중음악가이자 프로듀서이다.' });
drop('실용음악 교수',        { description: '실용음악과 교수이며 작곡가로 활동한다.' });
drop('밴드 보컬',            { description: '록 밴드의 보컬이자 기타리스트이다.' });
drop('걸그룹 멤버',          { description: '걸그룹 출신 가수이다.' });

/* ══ 4. 근거가 하나도 없는 사람 ══ */
{
  const r = checkClassic({});
  t('버려야 함 — 아무 정보 없음', r.ok, false);
  t('  근거없음 표가 붙어야', r.noEvidence, true);
}
{
  /* ★ 대중음악이라서 빠진 것에는 근거없음 표가 붙으면 안 됩니다 —
       지우는 도구가 둘을 섞으면 안 되기 때문입니다. */
  const r = checkClassic({ wd_genre: 'k-pop' });
  t('  대중음악은 근거없음이 아님', !!r.noEvidence, false);
}

/* ══ 5. 음악 밖 직업 ══ */
drop('배우만',               { wd_occupation: 'actor, television presenter' });
drop('정치인',               { wd_occupation: 'politician' });
drop('밴드 기타리스트',      { wd_occupation: 'guitarist, singer' });

/* ══ 6. ★ 지켜야 하는 사람 — 여기가 깨지면 큰 사고입니다 ══ */
keep('브람스(장르 없음)',    { wd_occupation: 'pianist, conductor, composer' });
keep('거슈윈(재즈 겸업)',    { wd_genre: 'jazz, classical music', wd_occupation: 'composer' });
keep('번스타인',             { wd_genre: 'classical music, musical theatre', wd_occupation: 'conductor, composer' });
keep('윈턴 마살리스',        { wd_genre: 'jazz, classical music', wd_occupation: 'trumpeter' });
keep('모리코네(영화음악)',   { wd_genre: 'film score', wd_occupation: 'composer' });
keep('히사이시 조',          { wd_genre: 'film music, classical music', wd_occupation: 'composer, conductor' });
keep('센주 아키라(DJ 겸업)', { wd_occupation: 'conductor, DJ producer, composer' });
keep('진은숙',               { wd_genre: 'contemporary classical music', wd_occupation: 'composer' });
keep('윤이상',               { wd_genre: 'contemporary classical music, opera', wd_occupation: 'composer' });
keep('김자경(소개문만)',     { description: '대한민국의 성악가이자 오페라 연출가이다.' });
keep('금수현(소개문만)',     { description: '대한민국의 작곡가이다. 가곡 「그네」를 작곡하였다.' });
keep('마르타 에게르트',      { wd_occupation: 'film actor, opera singer, stage actor' });
keep('김주택',               { wd_occupation: 'opera singer, musical theatre actor, singer' });
keep('순수 작곡가만',        { wd_occupation: 'composer' });
keep('음악교육자만',         { wd_occupation: 'music educator' });
keep('악기 제작자',          { wd_occupation: 'luthier, violin maker' });
keep('교회음악가',           { wd_occupation: 'church musician, organist' });
keep('국악인',               { description: '판소리 명창이다.' });
keep('브라스 밴드 지휘자',   { description: '브라스 밴드를 지휘하는 지휘자이다.' });
keep('윈드 밴드 작곡가',     { wd_genre: 'concert band music, classical music', wd_occupation: 'composer' });
keep('바로크 음악 전문',     { wd_genre: 'baroque music', wd_occupation: 'harpsichordist' });
keep('오페레타',             { wd_genre: 'operetta', wd_occupation: 'composer' });
keep('더블베이스 주자',      { wd_occupation: 'double bassist' });

/* ══ 8. ★★ 2026-08-12 실제 실행에서 잘못 걸렸던 사람들 ★★
     첫 dry run 이 48명을 골라냈는데 그 가운데 <b>29명이 오판</b>이었습니다.
     같은 실수를 되풀이하지 않도록 실제 값을 그대로 넣어 둡니다. ══ */
keep('기욤 드 마쇼(아르스 노바)',
  { wd_genre: 'dit, ars nova, lay, virelai, rondeau',
    wd_occupation: 'writer, songwriter, poet, composer' });
keep('현제명(희망의 나라로)',   { wd_occupation: 'songwriter, singer, composer' });
keep('김희경',                  { wd_occupation: 'music educator, songwriter, composer' });
keep('이찬해',                  { wd_occupation: 'music educator, songwriter, composer' });
keep('장성 · 피아노 연주자',    { description: '대한민국의 피아노 연주자이다.' });
keep('김남윤 · 바이올린 연주자',{ description: '대한민국의 바이올린 연주자, 대학 교수이다.' });
keep('정사인 · 플루트 연주자',  { description: '대한민국의 플루트 연주자이다.' });
keep('최수영 · 바이올린 연주자',{ description: '대한민국의 청소년 바이올린 연주자이다' });
keep('이현준 · 트럼페터',       { description: '대한민국의 트럼페터이다.' });
keep('가야금 연주자',           { description: '가야금 연주자이다.' });

/* 그래도 빠져야 하는 사람 — 실제 값 그대로 */
drop('원오트릭스 포인트 네버',
  { wd_genre: 'electronic music, ambient music, drone music',
    wd_occupation: 'musician, record producer, singer, composer' });
drop('Roy Wood',
  { wd_genre: 'art rock, symphonic rock, glam rock, pop rock, jazz fusion',
    wd_occupation: 'composer, record producer, singer-songwriter, guitarist' });
drop('Tony MacAlpine',
  { wd_genre: 'jazz fusion, neo-classical metal',
    wd_occupation: 'jazz guitarist, violinist, guitarist' });
drop('로타 엥베리(슐라거)',
  { wd_genre: 'schlager music, dansband music',
    wd_occupation: 'pianist, television presenter, schlager singer' });
drop('Jan Tabachnyk',
  { wd_occupation: 'music educator, accordionist, television presenter, record producer' });
drop('노이즈 음악가',
  { wd_genre: 'ambient music, drone music, noise music, dark ambient',
    wd_occupation: 'recording artist, musician, composer' });

/* ══ 9. ★ 2026-08-12 두 번째 dry run — 영화·게임음악이 빠지던 것
     인물DB 는 영화·게임음악을 <b>넣습니다</b>(파트너 결정).
     현대음악DB 만 뺍니다. ══ */
keep('레나 레인 · 게임음악',
  { wd_genre: 'video game music',
    wd_occupation: 'video game developer, DJ producer, composer' });
keep('페드로 브롬프만 · 영화음악',
  { wd_occupation: 'DJ producer, composer',
    description: '브라질의 영화음악 작곡가이다.' });
keep('히사이시 · 게임음악 겸',
  { wd_genre: 'film music, video game music', wd_occupation: 'composer' });
drop('소개문 없는 DJ 겸 작곡가',
  { wd_occupation: 'DJ producer, composer' });
drop('핫토리 료이치 · 가요쿄쿠',
  { wd_genre: 'kayōkyoku',
    wd_occupation: 'jazz musician, music arranger, lyricist, pop music, composer' });
drop('김택수 · 싱어송라이터',
  { wd_occupation: 'singer', description: '대한민국의 싱어송라이터 겸 작곡가, 음악 프로듀서다.' });

/* ★ 현대음악DB 는 게임·영화음악을 빼야 합니다 — 인물DB 와 다릅니다 */
t('현대음악 — 게임음악 빠짐',
  checkModern({ wd_genre: 'video game music', wd_occupation: 'composer',
                birth_year: 1990 }).ok, false);

/* ══ 7. 현대음악DB 판정도 함께 (연주자·영화음악 제외 유지) ══ */
t('현대음악 — 진은숙 담김',
  checkModern({ wd_genre: 'contemporary classical music', wd_occupation: 'composer',
                birth_year: 1961 }).ok, true);
t('현대음악 — 심포닉메탈 빠짐',
  checkModern({ wd_genre: 'symphonic metal', wd_occupation: 'composer',
                birth_year: 1970 }).ok, false);

console.log('\n══ 클래식 판정 검증 ══');
console.log('  통과 : ' + pass + '개');
console.log('  실패 : ' + fail + '개');
if (bad.length) { console.log('\n── 실패한 것 ──'); console.log(bad.join('\n')); process.exit(1); }
console.log('\n  전부 통과했습니다.');
