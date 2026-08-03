/* ============================================================
   OPUSCLAM — 인물DB 구조 보강
   2026-08-03

   무엇을 만드는가

   ⑴ persons.source — 이 줄이 어디서 왔는지
        'wikidata' 자동수집 · 'wixon' 파트너님 자료
        'member' 회원 등록 · 'admin' 관리자 직접
      왜 필요한가 — 앞으로 회원이 인물을 등록하기 시작하면
      「검증된 것」 과 「자기 신고」 를 갈라야 합니다. 어드민에서
      출처별로 골라 보고, 품질 잣대를 달리 적용할 수 있습니다.

      ※ 덮어쓰기 걱정은 없습니다. scripts/enrich-persons.mjs 를
        확인해 보니 이미 isEmpty() 검사를 하고 있어 <b>빈 칸만</b>
        채웁니다. name_ko 는 아예 갱신 대상이 아닙니다.
        이 칸은 「출처를 알기 위한」 것입니다.

   ⑵ person_works — 작품 목록
      지금 persons.works 는 「대표작」 <b>한 줄짜리 텍스트</b> 칸입니다.
      파트너님 자료에는 작품이 <b>619줄</b> 있습니다 —
      타카스 100곡 · 아놀드 쿡 113곡 · 로라 에이번 106곡 ·
      데 라 베가 140곡. 한 칸에 넣으면 검색도 정렬도 못 합니다.

      ★ 그리고 이 표가 있으면 앞으로 <b>악보를 작품에 이을 수</b>
        있습니다. 음원·영상·공연(KOPIS)도 작품에 붙습니다.
        7GB 악보 작업을 앞두고 있으니 지금 만드는 것이 순서입니다.

   ⑶ person_awards — 수상 이력
      하랄트 겐츠머 97개 · 예뇌 타카스 15개. 소개문에 밀어 넣으면
      읽을 수 없게 됩니다. 나중에 콩쿠르DB(foundations)와 이을
      수도 있습니다.

   ★ persons.works 는 <b>그대로 둡니다.</b> 「대표작 한 줄」 로 계속
     쓰고, 자세한 목록은 person_works 가 맡습니다. 목록 화면과
     검색이 이미 works 를 쓰고 있으므로 건드리면 위험합니다.

   되돌리기
     sql/persons-import-03-schema-rollback.sql

   쓰는 법
     Supabase → SQL Editor → New query → 전체 붙이기 → Run
     맨 끝에 확인 표가 나옵니다.
   ============================================================ */


/* ────────────────────────────────────────────────────────────
   1단계.  persons.source
   ──────────────────────────────────────────────────────────── */

alter table public.persons
  add column if not exists source text;

/* 지금 있는 9,271명은 모두 위키데이터 자동수집분입니다 */
update public.persons set source = 'wikidata' where source is null;

alter table public.persons
  alter column source set default 'wikidata';

create index if not exists persons_source_idx on public.persons (source);

comment on column public.persons.source is
  '이 줄의 출처 — wikidata(자동수집) · wixon(파트너 자료) · member(회원 등록) · admin(관리자 직접)';


/* ────────────────────────────────────────────────────────────
   2단계.  person_works — 작품 목록

   ★ 연도를 글자와 숫자로 <b>둘 다</b> 담습니다.
     자료에 '1943/44' · '1949/50' · '?' 처럼 숫자가 아닌 것이
     흔합니다. 글자는 보여 주기용(year_text), 숫자는 정렬용
     (year_from · year_to)입니다. 하나만 두면 둘 중 하나를
     반드시 잃습니다.

   ★ opus 도 글자입니다 — 'op. 42' · 'WoO 87' ·
     'ohne opus-Zahl'(작품번호 없음) 같은 값이 섞입니다.
   ──────────────────────────────────────────────────────────── */

create table if not exists public.person_works (
  id              bigserial primary key,
  person_id       bigint not null
                    references public.persons(id) on delete cascade,
  title           text not null,        /* 원어 제목 */
  title_ko        text,                 /* 한글 제목 (있으면) */
  opus            text,                 /* op. 42 · WoO 87 · 작품번호 없음 */
  year_text       text,                 /* 1941 · 1943/44 · ? */
  year_from       integer,              /* 정렬용 */
  year_to         integer,
  genre           text,                 /* 피아노 · 실내악 · 관현악 · 교향악 · 성악 · 합창·오르간 · 무대 */
  instrumentation text,                 /* 편성 */
  note            text,
  source          text not null default 'wixon',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create index if not exists person_works_person_idx on public.person_works (person_id);
create index if not exists person_works_genre_idx  on public.person_works (genre);
create index if not exists person_works_year_idx   on public.person_works (year_from);

/* ★ 같은 작품을 두 번 담지 않게 — 제목이 길 수 있으므로 md5 로 견줍니다.
   (다시 담기를 해도 중복이 생기지 않습니다) */
create unique index if not exists person_works_uniq
  on public.person_works (person_id, md5(lower(btrim(title))), coalesce(opus, ''));

comment on table public.person_works is
  '인물의 작품 목록. persons.works(대표작 한 줄)와 별개. 앞으로 악보·음원·공연을 이 표에 이을 수 있습니다.';


/* ────────────────────────────────────────────────────────────
   3단계.  person_awards — 수상 이력
   ──────────────────────────────────────────────────────────── */

create table if not exists public.person_awards (
  id         bigserial primary key,
  person_id  bigint not null
               references public.persons(id) on delete cascade,
  year       integer,
  year_text  text,                      /* 연도가 불확실한 경우 */
  title      text not null,             /* 상 이름 (원어) */
  title_ko   text,
  org        text,                      /* 주는 곳 */
  note       text,
  source     text not null default 'wixon',
  created_at timestamptz not null default now()
);

create index if not exists person_awards_person_idx on public.person_awards (person_id);
create index if not exists person_awards_year_idx   on public.person_awards (year);

create unique index if not exists person_awards_uniq
  on public.person_awards (person_id, coalesce(year, -1), md5(lower(btrim(title))));

comment on table public.person_awards is
  '인물의 수상 이력. 나중에 콩쿠르DB(foundations)와 이을 수 있습니다.';


/* ────────────────────────────────────────────────────────────
   4단계.  권한 규칙 — persons 와 <b>같은 방식</b>으로 둡니다

   ★ persons 정책은 is_admin() 을 씁니다(oc_is_admin() 이 아닙니다).
     같은 일을 하는 함수가 두 개인 것은 정리 대상이지만, 지금
     굳이 다르게 두면 헷갈리니 persons 를 따릅니다.
   ──────────────────────────────────────────────────────────── */

alter table public.person_works  enable row level security;
alter table public.person_awards enable row level security;

drop policy if exists person_works_read on public.person_works;
create policy person_works_read on public.person_works
  for select to public using (true);

drop policy if exists person_works_admin on public.person_works;
create policy person_works_admin on public.person_works
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists person_awards_read on public.person_awards;
create policy person_awards_read on public.person_awards
  for select to public using (true);

drop policy if exists person_awards_admin on public.person_awards;
create policy person_awards_admin on public.person_awards
  for all to authenticated using (is_admin()) with check (is_admin());


/* ────────────────────────────────────────────────────────────
   5단계.  확인 — 이 표를 주십시오
   ──────────────────────────────────────────────────────────── */

select '① persons.source'::text as 구분,
       coalesce(source, '(비어 있음)')::text as 이름,
       (count(*)::text || '명')::text as 내용
from public.persons
group by source

union all
select '② 새 표', c.relname::text,
       (case when c.relrowsecurity then 'RLS 켜짐 · ' else '★RLS 꺼짐 · ' end
        || (select count(*)::text from information_schema.columns
            where table_schema = 'public' and table_name = c.relname) || '칸')::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('person_works', 'person_awards')

union all
select '③ 정책', (tablename || ' · ' || policyname || ' [' || cmd || ']')::text,
       coalesce(qual, with_check, '(없음)')::text
from pg_policies
where schemaname = 'public' and tablename in ('person_works', 'person_awards')

union all
select '④ 중복 막는 색인', indexname::text,
       replace(indexdef, 'CREATE UNIQUE INDEX ', '')::text
from pg_indexes
where schemaname = 'public'
  and indexname in ('person_works_uniq', 'person_awards_uniq')

union all
select '⑤ 담긴 줄', 'person_works'::text,
       (select count(*)::text || '줄' from public.person_works)
union all
select '⑤ 담긴 줄', 'person_awards'::text,
       (select count(*)::text || '줄' from public.person_awards)

order by 1, 2;
