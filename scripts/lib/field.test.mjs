/* 분야 판정 규칙 양방향 검증
   ★ 「걸려야 하는 것」과 「걸리면 안 되는 것」을 함께 봅니다.
     한쪽만 보면 「리」 한 글자 사건이 또 납니다. */

import { fieldFromText, hasEvidence, guessField, decideField } from './field.mjs';

let pass = 0, fail = 0;
const bad = [];
function t(label, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) bad.push('  ✗ ' + label + '\n      나온 값: ' + JSON.stringify(got) + '  ·  바라는 값: ' + JSON.stringify(want));
}

/* ══ 1. 이번에 고친 두 사람 ══════════════════════════════ */
const JOOST = 'Oskar Joost (9 June 1898 – 29 May 1941) was a German musician, who played violin, tenor saxophone and was a bandleader of a popular dance orchestra.';
const WELSH = 'Thomas Welsh (c. 1780 - 24 or 31 January 1848) was an English composer and operatic bass.';

/* ★ fix-person-field.mjs 가 한 사람을 어떻게 처리하는지 그대로 흉내 냅니다.
     판정 함수만 떼어 보면 이음새를 놓칩니다 (2026-08-11 교훈 ③). */
function outcome(p) {
  const d = decideField(p);
  const cur = (p.field == null ? '' : String(p.field)).trim();
  if (!d.field) return '정할 수 없음';
  if (!cur) return '빈칸 채움 → ' + d.field;
  if (d.field === cur) return '그대로';
  if (d.from === '직업목록') return '그냥 둠';
  const base = (d.from === 'ko소개') ? p.description : p.description_en;
  if (hasEvidence(cur, base)) return '그대로';
  return '바뀜 → ' + d.field;
}

t('요스트 — 테너 색소폰이 성악으로 가지 않아야',
  fieldFromText(JOOST) === '성악' ? '성악으로 감(오판)' : '성악 아님', '성악 아님');
t('요스트 — 지휘로 적힌 것을 건드리지 않아야',
  outcome({ field: '지휘', description: null, description_en: JOOST,
            wd_occupation: 'bandleader, composer, conductor' }), '그냥 둠');
t('웰시 — 성악으로 그대로 두어야',
  outcome({ field: '성악', description: null, description_en: WELSH,
            wd_occupation: 'opera singer, composer' }), '그대로');
t('폴리니 — 작곡에서 연주로 바뀌어야',
  outcome({ field: '작곡', description: '마우리치오 폴리니는 이탈리아의 피아니스트이다.',
            wd_occupation: 'pianist, composer' }), '바뀜 → 연주');
t('힌데미트 — 작곡 그대로 두어야',
  outcome({ field: '작곡', description: '독일의 바이올리니스트, 비올리스트 및 작곡가이다.',
            wd_occupation: 'composer' }), '그대로');
t('웰시 — 소개문 첫 직업은 작곡', fieldFromText(WELSH), '작곡');
t('웰시 — 지금 값 성악에 근거가 있어야 (operatic bass)', hasEvidence('성악', WELSH), true);

/* ══ 2. 악기인 「테너·알토·베이스」 — 성악으로 가면 안 됨 ══ */
t('테너 색소폰(한글)', fieldFromText('그는 테너 색소폰을 연주했다.'), '');
t('알토 색소폰(한글)', fieldFromText('알토 색소폰 주자였다.'), '');
t('tenor saxophone', fieldFromText('X played the tenor saxophone.'), '');
t('tenor horn', fieldFromText('X played the tenor horn.'), '');
t('tenor trombone', fieldFromText('X was a tenor trombone player.'), '');
t('basso continuo — 오르가니스트여야', fieldFromText('X was a German organist and basso continuo specialist.'), '연주');
t('베이스 기타 연주자', fieldFromText('X is an American bassist and songwriter.'), '연주');
t('더블베이스 주자', fieldFromText('X was a virtuoso double bassist.'), '연주');

/* ══ 3. 목소리인 「테너·베이스」 — 성악으로 가야 함 ══════ */
t('이탈리아 테너', fieldFromText('X was an Italian tenor.'), '성악');
t('lyric tenor', fieldFromText('X is a lyric tenor.'), '성악');
t('operatic bass', fieldFromText('X was an operatic bass.'), '성악');
t('bass-baritone', fieldFromText('X is a bass-baritone.'), '성악');
t('bass singer', fieldFromText('X was a bass singer.'), '성악');
t('basso profondo', fieldFromText('X was a Russian basso profondo.'), '성악');
t('오페라 베이스(한글)', fieldFromText('그는 오페라 베이스로 활동했다.'), '성악');
t('베이스 바리톤(한글)', fieldFromText('베이스 바리톤 가수이다.'), '성악');
t('테너(한글, 뒤에 악기 없음)', fieldFromText('그는 대한민국의 테너이다.'), '성악');

/* ══ 4. 새로 넣은 연주자 이름 ══════════════════════════ */
for (const [w, want] of [['saxophonist','연주'],['bassist','연주'],['drummer','연주'],
  ['timpanist','연주'],['accordionist','연주'],['lutenist','연주'],['mandolinist','연주'],
  ['색소포니스트','연주']]) {
  t('새 낱말 ' + w, fieldFromText('X is a ' + w + '.'), want);
}

/* ══ 5. 이미 잘 되던 것 — 절대 깨지면 안 됨 ══════════════ */
t('모차르트', fieldFromText('볼프강 아마데우스 모차르트는 오스트리아의 작곡가이다.'), '작곡');
t('폴리니', fieldFromText('마우리치오 폴리니는 이탈리아의 피아니스트이다.'), '연주');
t('카라얀', fieldFromText('헤르베르트 폰 카라얀은 오스트리아의 지휘자이다.'), '지휘');
t('조수미', fieldFromText('조수미는 대한민국의 소프라노이다.'), '성악');
t('힌데미트 — 작곡 근거 지켜야', hasEvidence('작곡', '독일의 바이올리니스트, 비올리스트 및 작곡가이다.'), true);
t('체르니 — 작곡 근거 지켜야', hasEvidence('작곡', '오스트리아의 피아니스트, 교사이자 작곡가이다.'), true);
t('폴리니 — 작곡 근거 없어야', hasEvidence('작곡', '마우리치오 폴리니는 이탈리아의 피아니스트이다.'), false);
t('크레메르', fieldFromText('기돈 크레머는 라트비아인 클래식 음악 바이올린 연주자, 예술 감독이다.'), '연주');
t('로버트 코헨', fieldFromText('Robert Cohen (born 15 June 1959) is a British concert cellist.'), '연주');
t('토비아스 콜', fieldFromText('Tobias Cole is an Australian countertenor and leading singer.'), '성악');
t('음악학자', fieldFromText('X is a German musicologist.'), '음악학');
t('판소리 명창', fieldFromText('그는 판소리 명창이다.'), '국악');
t('작곡가의 아들 — 첫머리만 보므로 걸리면 안 됨',
  fieldFromText('X는 대한민국의 피아니스트이다. 작곡가 김철수의 아들로 태어났다.'), '연주');

/* ══ 6. 빈칸 채우기용 직업목록 규칙 ══════════════════════ */
t('직업 double bass player', guessField('double bass player'), '연주');
t('직업 bass guitarist', guessField('bass guitarist'), '연주');
t('직업 tenor saxophonist', guessField('tenor saxophonist'), '연주');
t('직업 saxophonist', guessField('saxophonist'), '연주');
t('직업 contrabassist', guessField('contrabassist'), '연주');
t('직업 bass singer', guessField('bass singer'), '성악');
t('직업 opera singer', guessField('opera singer'), '성악');
t('직업 tenor (악기 아님)', guessField('tenor, opera singer'), '성악');
t('직업 composer 먼저', guessField('composer, pianist'), '작곡');
t('직업 conductor', guessField('conductor'), '지휘');

/* ══ 7. decideField 이음새 ══════════════════════════════ */
t('소개문 우선 — 직업목록보다',
  decideField({ description: '이탈리아의 피아니스트이다.', wd_occupation: 'composer' }).field, '연주');
t('소개문 없으면 직업목록',
  decideField({ description: null, description_en: null, wd_occupation: 'pianist' }).from, '직업목록');
t('아무것도 없으면 빈칸',
  decideField({ description: null, description_en: null, wd_occupation: null }).field, '');

console.log('\n══ 분야 판정 규칙 검증 ══');
console.log('  통과 : ' + pass + '개');
console.log('  실패 : ' + fail + '개');
if (bad.length) { console.log('\n── 실패한 것 ──'); console.log(bad.join('\n')); process.exit(1); }
console.log('\n  전부 통과했습니다.');
