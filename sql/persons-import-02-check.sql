/* ============================================================
   OPUSCLAM — 워드 문서 인물 30명 정확 확인  (2차)
   2026-08-03

   ★ 읽기만 합니다. 아무것도 고치거나 담지 않습니다.

   1차(persons-import-01)에서 무엇이 잘못됐나
     성(姓)을 부분일치(like '%berger%')로 견주었습니다. 그래서
     「Jean Berger」 가 Kirnberger · Rheinberger · Hellmesberger 등
     <b>25명과 걸렸습니다.</b> 쓸 수 없는 결과였습니다.

   이번에 고친 것
     ⑴ 성은 <b>마지막 낱말이 정확히 같을 때만</b> 봅니다 (부분일치 아님)
     ⑵ 악센트 글자 문제를 없앴습니다 — Takács · Kačinskas 처럼
       악센트가 든 이름은 확장 기능(unaccent) 없이는 견주기 어렵습니다.
       그래서 <b>양쪽을 똑같은 방법으로 납작하게</b> 만들어 견줍니다
       (소문자로 바꾸고 a-z0-9 가 아닌 글자를 모두 지웁니다).
       납작한 값은 이 파일에 미리 적어 두었으므로 결과가 흔들리지 않습니다
     ⑶ 문서에서 새로 찾은 5명을 더했습니다 —
       미콜라 콜레사 · 고프레도 페트라시 · 마누엘 로젠탈 ·
       머레이 아다스킨 · 예로니마스 카친스카스
     ⑷ <b>한글 이름을 보강해야 하는지</b>를 함께 봅니다.
       인물DB 에 있어도 name_ko 가 비어 있거나 영문 그대로면,
       한국 사용자가 <b>검색으로 찾을 수 없습니다.</b>

   ※ 헝가리 이름 「Takács Jenő」 는 성이 앞에 옵니다. 마지막 낱말로
     성을 견주는 방법이 이런 이름에는 맞지 않으니, 그 줄은 결과를
     사람이 한 번 봐 주셔야 합니다.

   쓰는 법
     Supabase → SQL Editor → New query → 전체 붙이기 → Run
     결과를 CSV 로 내려받아 주시거나 화면 캡처로 주십시오.
   ============================================================ */

with 워드인물(출처, 번호, 원어이름, 한글이름, 납작키, 성키) as (
  values
    ('composer_info',  1, 'Takács Jenő', '예뇌 타카스', 'takcsjen', 'jen'),
    ('composer_info',  2, 'Aurelio de la Vega', '아우렐리오 데 라 베가', 'aureliodelavega', 'vega'),
    ('composer_info',  3, 'Mykola Kolessa', '미콜라 콜레사', 'mykolakolessa', 'kolessa'),
    ('composer_info',  4, 'Goffredo Petrassi', '고프레도 페트라시', 'goffredopetrassi', 'petrassi'),
    ('composer_info',  5, 'Manuel Rosenthal', '마누엘 로젠탈', 'manuelrosenthal', 'rosenthal'),
    ('composer_info',  6, 'Joaquim Homs', '호아킴 홈스', 'joaquimhoms', 'homs'),
    ('composer_info',  7, 'Murray Adaskin', '머레이 아다스킨', 'murrayadaskin', 'adaskin'),
    ('composer_info',  8, 'Arnold Cooke', '아놀드 쿡', 'arnoldcooke', 'cooke'),
    ('composer_info',  9, 'Normand Lockwood', '노르망 록우드', 'normandlockwood', 'lockwood'),
    ('composer_info', 10, 'Bernhard Christensen', '베른하르트 크리스텐센', 'bernhardchristensen', 'christensen'),
    ('composer_info', 12, 'Lora Aborn', '로라 에이번', 'loraaborn', 'aborn'),
    ('composer_info', 13, 'Jeronimas Kačinskas', '예로니마스 카친스카스', 'jeronimaskainskas', 'kainskas'),
    ('composer_info', 14, 'Elliott Carter', '엘리엇 카터', 'elliottcarter', 'carter'),
    ('composer_info', 15, 'Jean-Yves Daniel-Lesur', '장 이브 다니엘 레쉬르', 'jeanyvesdaniellesur', 'lesur'),
    ('composer_info', 16, 'Trude Rittmann', '트러드 리트만', 'truderittmann', 'rittmann'),
    ('composer_info', 17, 'Alice Samter', '앨리스 잠터', 'alicesamter', 'samter'),
    ('composer_info', 18, 'Kurt Schwaen', '커트 슈완', 'kurtschwaen', 'schwaen'),
    ('composer_info', 19, 'Harald Genzmer', '하랄트 겐츠머', 'haraldgenzmer', 'genzmer'),
    ('composer_info', 20, 'Jean Berger', '장 버거', 'jeanberger', 'berger'),
    ('composer_info', 21, 'Robin Orr', '로빈 오어', 'robinorr', 'orr'),
    ('인물DB',  1, 'Elliott Carter', '엘리엇 카터', 'elliottcarter', 'carter'),
    ('인물DB',  2, 'Giovanni Martinelli', '조반니 마르티넬리', 'giovannimartinelli', 'martinelli'),
    ('인물DB',  3, 'Hector Berlioz', '엑토르 베를리오즈', 'hectorberlioz', 'berlioz'),
    ('인물DB',  4, 'Gennady Rozhdestvensky', '겐나디 로제스트벤스키', 'gennadyrozhdestvensky', 'rozhdestvensky'),
    ('인물DB',  5, 'Simon Preston', '사이먼 프레스턴', 'simonpreston', 'preston'),
    ('인물DB',  6, 'Ludwig van Beethoven', '루트비히 판 베토벤', 'ludwigvanbeethoven', 'beethoven'),
    ('인물DB',  7, 'Claudio Arrau', '클라우디오 아라우', 'claudioarrau', 'arrau'),
    ('인물DB',  8, 'Bernard Haitink', '베르나르트 하이팅크', 'bernardhaitink', 'haitink'),
    ('인물DB',  9, 'Vincent d''Indy', '뱅상 당디', 'vincentdindy', 'dindy'),
    ('인물DB', 10, 'Elly Ameling', '엘리 아멜링', 'ellyameling', 'ameling'),
    ('인물DB', 11, 'Sergey Prokofiev', '세르게이 프로코피예프', 'sergeyprokofiev', 'prokofiev')
),

/* persons 쪽도 <b>똑같은 방법</b>으로 납작하게 만듭니다 */
디비 as (
  select id, name_ko, name_en,
         regexp_replace(lower(coalesce(name_en, '')), '[^a-z0-9]', '', 'g') as en_key,
         regexp_replace(lower(coalesce(name_ko, '')), '[^a-z0-9]', '', 'g') as ko_key,
         regexp_replace(
           lower(split_part(replace(coalesce(name_en, ''), '-', ' '), ' ',
                 greatest(array_length(string_to_array(
                   replace(coalesce(name_en, ''), '-', ' '), ' '), 1), 1))),
           '[^a-z0-9]', '', 'g') as 성키
  from persons
),

/* ① 이름 전체가 같은 것 — 이것만 「확실히 있다」 입니다 */
정확 as (
  select w.출처, w.번호, w.원어이름, w.한글이름,
         d.id, d.name_ko, d.name_en
  from 워드인물 w
  join 디비 d
    on d.en_key = w.납작키
    or (d.ko_key <> '' and d.ko_key = w.납작키)
),

/* ② 성만 같은 것 — 정확 일치가 <b>없는</b> 사람에게만 보여 줍니다.
   마지막 낱말이 <b>완전히</b> 같아야 합니다 (Kirnberger 는 안 걸립니다) */
성만 as (
  select w.출처, w.번호, w.원어이름, w.한글이름,
         d.id, d.name_ko, d.name_en
  from 워드인물 w
  join 디비 d on d.성키 = w.성키 and length(w.성키) >= 3
  where not exists (select 1 from 정확 e
                    where e.출처 = w.출처 and e.번호 = w.번호)
)

select * from (

  /* ── 확실히 있는 사람 — 무엇을 보강해야 하는지 함께 ── */
  select '① 이미 있음'::text as 구분,
         출처, 번호::text as 번호, 원어이름,
         한글이름                          as 워드문서_한글이름,
         ('id ' || id)::text               as 인물DB,
         coalesce(name_ko, '(비어 있음)')  as 등록된_한글이름,
         case
           when name_ko is null or btrim(name_ko) = ''
             then '★ 한글 이름을 넣어야 합니다'
           when regexp_replace(lower(name_ko), '[^a-z0-9]', '', 'g')
              = regexp_replace(lower(coalesce(name_en, '')), '[^a-z0-9]', '', 'g')
             then '★ 한글 이름이 영문 그대로입니다 — 바꿔야 합니다'
           else '한글 이름 있음 — 그대로 둡니다'
         end::text                         as 할일
  from 정확

  union all

  /* ── 정확 일치가 없어 성만 걸린 사람 — 사람이 봐야 합니다 ── */
  select '② 성만 같음 (확인 필요)',
         출처, 번호::text, 원어이름, 한글이름,
         ('id ' || id)::text,
         coalesce(name_ko, '(비어 있음)'),
         '다른 사람일 수 있습니다 — 눈으로 확인'
  from 성만

  union all

  /* ── 아무것도 안 걸린 사람 = 새로 담을 사람 ── */
  select '③ 없음 — 새로 담을 것',
         w.출처, w.번호::text, w.원어이름, w.한글이름,
         '-', '-', '★ 새로 담습니다'
  from 워드인물 w
  where not exists (select 1 from 정확  e where e.출처 = w.출처 and e.번호 = w.번호)
    and not exists (select 1 from 성만  s where s.출처 = w.출처 and s.번호 = w.번호)

) z
order by 구분, 출처, (번호)::int, 인물DB;
