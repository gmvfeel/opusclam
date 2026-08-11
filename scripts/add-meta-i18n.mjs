/* ════════════════════════════════════════════════════════════════
   검색 설명(meta description) 의 영어·일본어를 사전에 보탭니다
   ────────────────────────────────────────────────────────────────
   실행:  node scripts/add-meta-i18n.mjs
   결과:  assets/i18n/en.json · ja.json 에 없는 것만 보탭니다
          (이미 있는 열쇠는 건드리지 않습니다 — 여러 번 돌려도 안전)

   ★ 왜 따로 두는가
     화면 문구는 이미 96% 옮겨져 있는데, 이번에 새로 지은 설명글은
     사전에 없습니다. 그 스물세 개만 여기 담습니다.

   ★ 옮길 때 지킨 것
     · 검색창에 칠 만한 말을 넣습니다 — classical music · orchestra ·
       competition 같은 것이 들어가야 그 말로 찾는 사람에게 닿습니다.
     · 「오퍼스클램」은 OPUSCLAM 으로 둡니다 (이름이므로 옮기지 않습니다)
     · 일본어는 <b>중점(・)</b>을 씁니다 — 한국어의 가운뎃점 자리입니다
   ════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const T = [
  ['클래식 음악 전문 포털 오퍼스클램 — 인물 · 음악단체 · 공연장 · 음악학교 · 현대음악 · 기관재단 · 학술 자료를 하나로 잇습니다.',
   'OPUSCLAM, the classical music portal — people, ensembles, venues, conservatories, contemporary music, foundations and scholarship, all connected in one place.',
   'クラシック音楽専門ポータル OPUSCLAM — 人物・音楽団体・コンサートホール・音楽学校・現代音楽・機関財団・学術資料をひとつにつなぎます。'],

  ['오퍼스클램 통합검색 — 인물 · 단체 · 공연장 · 학교 · 작품 · 논문 · 커뮤니티 글을 한 번에 찾습니다.',
   'OPUSCLAM search — find people, ensembles, venues, schools, works, papers and community posts all at once.',
   'OPUSCLAM 統合検索 — 人物・団体・ホール・学校・作品・論文・コミュニティ投稿をまとめて探せます。'],

  ['잠들기 어려운 밤에, 아기와 함께, 몸이 무거운 날 — 상황에 맞춰 고른 클래식 곡 목록입니다. 각 곡에서 작곡가와 악보로 이어집니다.',
   'Playlists of classical pieces chosen for sleepless nights, time with your baby, and heavy days. Each piece links to its composer and score.',
   '眠れない夜に、赤ちゃんと一緒に、体が重い日に — 場面に合わせて選んだクラシック曲のリストです。各曲から作曲家と楽譜へつながります。'],

  ['오퍼스클램 커뮤니티 — 핫토픽 · 공연사진영상 · 입시 · 뉴스',
   'OPUSCLAM community — hot topics, concert photos and video, admissions, and news from the classical music world.',
   'OPUSCLAM コミュニティ — ホットトピック・公演写真映像・入試・ニュース'],

  ['오퍼스클램이 매달 소개하는 음악학교 — 학교 정보와 입학 안내를 한곳에서',
   'A conservatory featured each month on OPUSCLAM — school information and admissions guidance in one place.',
   'OPUSCLAM が毎月紹介する音楽学校 — 学校情報と入学案内をひとつの場所で。'],

  ['오퍼스클램이 매일 소개하는 음악인 — 프로필과 이력을 한곳에서',
   'A musician featured each day on OPUSCLAM — profile and career history in one place.',
   'OPUSCLAM が毎日紹介する音楽家 — プロフィールと経歴をひとつの場所で。'],

  ['오퍼스클램 데이터 저작권·출처 정책 — 자료를 어디서 가져오고 어떤 조건으로 쓰는지, 출처를 어떻게 밝히는지 정리했습니다.',
   'OPUSCLAM data copyright and source policy — where our material comes from, the terms under which we use it, and how we credit sources.',
   'OPUSCLAM データ著作権・出典ポリシー — 資料の入手元、利用条件、出典の明示方法について定めています。'],

  ['오퍼스클램 데이터 무단 수집·도용 금지 — 자동 수집과 무단 복제를 허락하지 않는 범위와 근거를 밝힙니다.',
   'OPUSCLAM prohibition on unauthorised scraping and reuse — the scope of what is not permitted, and the grounds for it.',
   'OPUSCLAM データの無断収集・盗用の禁止 — 自動収集と無断複製を認めない範囲とその根拠を示します。'],

  ['오퍼스클램 개인정보처리방침 — 어떤 정보를 어떤 목적으로 모으고, 얼마나 두었다가 어떻게 없애는지 밝힙니다.',
   'OPUSCLAM privacy policy — what we collect, why, how long we keep it, and how it is deleted.',
   'OPUSCLAM プライバシーポリシー — どの情報を何のために集め、どれだけ保管し、どのように削除するかを示します。'],

  ['오퍼스클램 서비스 이용약관 — 회원 자격, 서비스 이용 조건, 게시물의 권리와 책임을 정합니다.',
   'OPUSCLAM terms of service — membership, conditions of use, and the rights and responsibilities attached to posts.',
   'OPUSCLAM サービス利用規約 — 会員資格、サービス利用条件、投稿の権利と責任を定めます。'],

  ['콩쿠르 공고를 오퍼스클램 콩쿨 목록 맨 위에 올려 드립니다. 요금과 신청 방법을 안내합니다.',
   'Place your competition listing at the top of the OPUSCLAM competition directory. Rates and how to apply.',
   'コンクール告知を OPUSCLAM コンクール一覧の最上部に掲載します。料金と申込方法をご案内します。'],

  ['오퍼스클램 리쿠르트 — 순수음악 분야의 채용정보와 인재정보를 잇는 서비스입니다. 이용 방법과 회원 종류별 권한을 안내합니다.',
   'OPUSCLAM Recruit — connecting jobs and talent in classical music. How it works and what each membership type can do.',
   'OPUSCLAM リクルート — クラシック音楽分野の求人情報と人材情報をつなぐサービスです。利用方法と会員種別ごとの権限をご案内します。'],

  ['오퍼스클램 SHOPPING 입점 안내 — 악기·악보·음반·음향·공연용품을 다루는 곳을 클래식 음악 하는 사람들에게 이어 드립니다. 입점 문의를 받습니다.',
   'OPUSCLAM SHOPPING for sellers — reach musicians directly with instruments, scores, recordings, audio equipment and stage supplies. Enquiries welcome.',
   'OPUSCLAM SHOPPING 出店のご案内 — 楽器・楽譜・音盤・音響・公演用品を扱う方をクラシック音楽に携わる人々へつなぎます。出店のお問い合わせを受け付けています。'],

  ['오퍼스클램 데이터베이스 — 인물 · 음악단체 · 공연장 · 음악학교 · 현대음악 · 관련기관재단 · 학술',
   'OPUSCLAM database — people, ensembles, venues, conservatories, contemporary music, foundations and scholarship.',
   'OPUSCLAM データベース — 人物・音楽団体・コンサートホール・音楽学校・現代音楽・関連機関財団・学術'],

  ['클래식 음악 용어와 현대음악 기법을 한국어로 정리했습니다. 교향곡·소나타·푸가부터 12음 기법·음색선율·스펙트럴 음악까지, 각 항목에서 작품DB로 이어집니다.',
   'A dictionary of classical forms and contemporary techniques — from symphony, sonata and fugue to twelve-tone technique, Klangfarbenmelodie and spectral music. Each entry links to the works database.',
   'クラシック音楽の用語と現代音楽の技法をまとめました。交響曲・ソナタ・フーガから十二音技法・音色旋律・スペクトル楽派まで、各項目から作品DBへつながります。'],

  ['중세부터 오늘까지 서양 음악사를 한 줄로 봅니다. 시대를 누르면 그 시대의 작곡가·작품·용어가 펼쳐집니다.',
   'Western music history on a single timeline, from the medieval period to today. Select an era to see its composers, works and terms.',
   '中世から今日まで、西洋音楽史をひとつの流れで見わたせます。時代を選ぶとその時代の作曲家・作品・用語が開きます。'],

  ['레슨:ON — 클래식 음악 레슨을 온라인으로. 마스터클래스 · 공개레슨 · 1:1 · 그룹레슨을 한곳에서 찾습니다.',
   'Lesson:ON — classical music lessons online. Masterclasses, open lessons, one-to-one and group lessons in one place.',
   'Lesson:ON — クラシック音楽のレッスンをオンラインで。マスタークラス・公開レッスン・1対1・グループレッスンをひとつの場所で。'],

  ['마스터클래스 — 국내외 연주자와 교수진의 마스터클래스 영상을 편성별로 보실 수 있습니다.',
   'Masterclasses — video masterclasses from performers and faculty in Korea and abroad, browsable by instrument.',
   'マスタークラス — 国内外の演奏家と教授陣によるマスタークラス映像を編成別にご覧いただけます。'],

  ['공개레슨 — 누구나 볼 수 있는 클래식 음악 레슨 영상을 편성과 수준별로 모았습니다.',
   'Open lessons — freely viewable classical music lesson videos, sorted by instrument and level.',
   '公開レッスン — どなたでもご覧いただけるクラシック音楽のレッスン映像を、編成と レベル別に集めました。'],

  ['진행중 레슨 — 지금 신청할 수 있는 클래식 음악 레슨을 모았습니다.',
   'Lessons open now — classical music lessons currently accepting registration.',
   '開講中のレッスン — 今お申し込みいただけるクラシック音楽のレッスンを集めました。'],

  ['분야별 1:1 레슨 — 전공과 편성에 맞는 개인 레슨을 찾고 신청하실 수 있습니다.',
   'One-to-one lessons — find and book private lessons matched to your instrument and field of study.',
   '分野別 1対1 レッスン — 専攻と編成に合った個人レッスンを探して申し込めます。'],

  ['분야별 그룹레슨 — 여럿이 함께 듣는 클래식 음악 레슨을 편성별로 찾습니다.',
   'Group lessons — classical music lessons taken together with others, browsable by instrument.',
   '分野別グループレッスン — 複数人で受けるクラシック音楽のレッスンを編成別に探せます。'],

  ['인스트럭터 정보 — 레슨:ON에서 가르치는 연주자와 교육자의 이력과 강의를 보실 수 있습니다.',
   'Instructors — the performers and teachers who lead lessons on Lesson:ON, with their backgrounds and courses.',
   'インストラクター情報 — Lesson:ON で教える演奏家と教育者の経歴と講座をご覧いただけます。'],
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
  /* 열쇠 차례를 지켜 씁니다 — 나중에 견주기 쉽습니다 */
  const sorted = {};
  for (const k of Object.keys(dict).sort()) sorted[k] = dict[k];
  writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`  ${lang}.json  보탬 ${add}개 · 이미 있던 것 ${has}개 · 모두 ${Object.keys(sorted).length}개`);
}
