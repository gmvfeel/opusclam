/* ════════════════════════════════════════════════════════════════
   OPUSCLAM — 「자료 없음」 안내문의 영어·일본어를 사전에 보탭니다
   ────────────────────────────────────────────────────────────────
   실행:  node scripts/add-empty-i18n.mjs
   결과:  assets/i18n/en.json · ja.json 에 없는 것만 보탭니다
          (이미 있는 열쇠는 건드리지 않습니다 — 여러 번 돌려도 안전)

   ★ 왜 필요한가 (파트너가 알려 주신 것 · 2026-08-11)
     영문 화면에서 자료가 없을 때 이렇게 나왔습니다 —

         「자격을 갖춘 회원은 직접 등록·보강You may do so.」

     이 영역 문구가 <b>거의 사전에 없어</b> 한국어가 그대로 나왔고,
     마지막 조각만 사전에 있어 영어로 바뀌어 뒤섞였습니다.

   ★ 함께 고친 것 — assets/db-list.js
     한국어 낱말을 &lt;b&gt; 로 감싼 곳을 없앴습니다. i18n 은 글자
     <b>조각 단위</b>로 옮기므로, &lt;b&gt; 가 문장을 나누면 일부만
     옮겨집니다. 이제 온전한 문장이라 통째로 바뀝니다.

   ★ 변수가 끼는 자리는 <b>조각으로</b> 담습니다
     '오퍼스클램의 ' + 갈래 + ' 자료는 지금 ' + 숫자 + '건입니다.'
     처럼 이어 붙이는 문장은 통째로 담을 수 없습니다. 조각을 각각
     담아 두면 그 부분씩 옮겨집니다.
     ★ 영어는 말차례가 달라 조각 번역이 어색할 수 있습니다.
       그래서 조각을 <b>말차례에 덜 얽히게</b> 옮겼습니다 —
       'OPUSCLAM currently holds ' / ' entries in ' / ' at this time.'
   ════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const T = [
  /* ── 머리글 ── */
  [' 로 찾은 결과가 없습니다.',
   ' returned no results.',
   ' では見つかりませんでした。'],
  ['조건에 맞는 자료가 없습니다.',
   'No entries match these filters.',
   '条件に一致する資料がありません。'],

  /* ── 찾기를 돕는 말 ── */
  ['한글 · 영문 · 원어 표기를 바꿔 찾아보십시오.',
   'Try the Korean, English, or original-language spelling.',
   'ハングル・英文・原語の表記を変えてお探しください。'],
  ['이름 전체보다 일부만 넣어 보십시오. 그편이 잘 찾아집니다.',
   'Try part of the name rather than the whole thing — it usually works better.',
   '名前の全体よりも一部だけを入れてみてください。そのほうが見つかりやすいです。'],
  ['검색칸 옆의 국내/외 · 분야 조건을 함께 걸어 두셨습니다. 그것을 풀고 다시 찾아보십시오.',
   'Filters beside the search box (region, field) are also applied. Try clearing them.',
   '検索欄の横にある「国内/海外・分野」の条件も設定されています。それを外して再度お試しください。'],

  /* ── 갈래별 덧말 ── */
  ['(같은 사람이 다른 표기로 담겨 있을 수 있습니다)',
   '(the same person may be listed under a different spelling)',
   '（同じ人物が別の表記で収録されている場合があります）'],
  ['(「서울시립교향악단」 · 「Seoul Philharmonic」 처럼 표기가 여럿입니다)',
   '(names vary — e.g. “Seoul Philharmonic Orchestra” or its Korean form)',
   '（「ソウル市立交響楽団」・「Seoul Philharmonic」のように表記が複数あります）'],
  ['(「예술의전당 콘서트홀」 처럼 홀 이름까지 넣거나, 반대로 빼고 찾아보십시오)',
   '(try including the hall name — e.g. “Seoul Arts Center Concert Hall” — or leaving it out)',
   '（「芸術の殿堂コンサートホール」のようにホール名まで入れる、または逆に外してお探しください）'],
  ['(「예술고등학교」 · 「예고」 처럼 줄임말도 해 보십시오)',
   '(abbreviations also work — e.g. “arts high school”)',
   '（「芸術高等学校」・「芸高」のような略称もお試しください）'],
  ['(원어 표기로도 찾아보십시오)',
   '(try the original-language spelling as well)',
   '（原語の表記でもお探しください）'],
  ['(재단·협회·음반사·콩쿠르 주최를 함께 담고 있습니다)',
   '(foundations, associations, labels and competition organisers are all included here)',
   '（財団・協会・レコード会社・コンクール主催を併せて収録しています）'],
  ['(제목 전체보다 낱말 하나로 찾는 편이 잘 됩니다)',
   '(a single word usually works better than the full title)',
   '（タイトル全体よりも単語一つで探すほうが見つかりやすいです）'],

  /* ── 등록을 권하는 말 ── */
  ['찾으시는 분이 목록에 없습니까?',
   'Not finding the person you are looking for?',
   'お探しの方が一覧にありませんか？'],
  ['찾으시는 단체가 없습니까?',
   'Not finding the ensemble you are looking for?',
   'お探しの団体がありませんか？'],
  ['찾으시는 공연장이 없습니까?',
   'Not finding the venue you are looking for?',
   'お探しのホールがありませんか？'],
  ['찾으시는 학교가 없습니까?',
   'Not finding the school you are looking for?',
   'お探しの学校がありませんか？'],
  ['찾으시는 작곡가가 없습니까?',
   'Not finding the composer you are looking for?',
   'お探しの作曲家がありませんか？'],
  ['찾으시는 기관이 없습니까?',
   'Not finding the organisation you are looking for?',
   'お探しの機関がありませんか？'],
  ['찾으시는 자료가 없습니까?',
   'Not finding what you are looking for?',
   'お探しの資料がありませんか？'],

  ['자격을 갖춘 회원은 직접 등록·보강하실 수 있습니다.',
   'Qualified members can add or improve entries themselves.',
   '資格を持つ会員は、ご自身で登録・補強していただけます。'],
  ['없는 것이 아니라 아직 담기지 않은 것일 수 있습니다.',
   'It may not be missing — simply not yet added.',
   '存在しないのではなく、まだ収録されていないだけかもしれません。'],
  ['등록하신 자료는 관리자 확인을 거쳐 반영됩니다.',
   'Submissions are published after review.',
   'ご登録いただいた資料は、管理者の確認を経て反映されます。'],
  ['메일로 알려 주기',
   'Tell us by email',
   'メールで知らせる'],

  /* ── 건수 문장 ──
     ★ 숫자를 앞에 두고 <b>나머지를 온전한 한 문장</b>으로 담습니다.
       조각으로 나누면 영어 말차례가 어긋나 뒤엉킵니다. */
  ['오퍼스클램에 ',
   'OPUSCLAM holds ',
   'OPUSCLAM には'],
  ['건의 음악인 자료가 담겨 있습니다.',
   ' musician entries.',
   '件の音楽家の資料が収録されています。'],
  ['건의 음악단체 자료가 담겨 있습니다.',
   ' ensemble entries.',
   '件の音楽団体の資料が収録されています。'],
  ['건의 공연장 자료가 담겨 있습니다.',
   ' venue entries.',
   '件のホールの資料が収録されています。'],
  ['건의 음악학교 자료가 담겨 있습니다.',
   ' conservatory entries.',
   '件の音楽学校の資料が収録されています。'],
  ['건의 현대음악 작곡가 자료가 담겨 있습니다.',
   ' contemporary composer entries.',
   '件の現代音楽作曲家の資料が収録されています。'],
  ['건의 기관·재단 자료가 담겨 있습니다.',
   ' organisation entries.',
   '件の機関・財団の資料が収録されています。'],
  ['건의 학술 자료가 담겨 있습니다.',
   ' scholarly entries.',
   '件の学術資料が収録されています。'],
  ['건의 자료가 담겨 있습니다.',
   ' entries.',
   '件の資料が収録されています。'],

  ['등록·보강하기',
   'add or improve',
   '登録・補強する'],

  /* ── 갈래 이름 (사전에 없던 것만) ── */
  ['음악인',           'Musicians',            '音楽家'],
  ['현대음악 작곡가',   'Contemporary composers', '現代音楽の作曲家'],
  ['기관·재단',        'Organisations',        '機関・財団'],
  ['학술 자료',        'Scholarship',          '学術資料'],
  ['자료',            'Entries',              '資料'],
];

for (const [lang, idx] of [['en', 1], ['ja', 2]]) {
  const path = join(ROOT, 'assets', 'i18n', lang + '.json');
  const dict = JSON.parse(readFileSync(path, 'utf8'));
  let add = 0, has = 0;
  for (const row of T) {
    if (dict[row[0]] !== undefined) { has++; continue; }
    dict[row[0]] = row[idx];
    add++;
  }
  const sorted = {};
  for (const k of Object.keys(dict).sort()) sorted[k] = dict[k];
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`  ${lang}.json  보탬 ${add}개 · 이미 있던 것 ${has}개 · 모두 ${Object.keys(sorted).length}개`);
}
