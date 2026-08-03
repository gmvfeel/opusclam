/* ============================================================
   OPUSCLAM — 역할 정리 ①  적용
   2026-08-03

   무엇을 고치는가 (파트너님 결정 세 가지)
     ⑴ 승인되지 않은 회원은 공고를 올리지 못하게 합니다
     ⑵ 사업자(관계자·단체·학교)는 공고에 지원하지 못하게 합니다
     ⑶ 인재정보는 <b>전공자만</b> 올리게 합니다

   왜 함수를 셋으로 나누는가
     지금 oc_is_seeker() 하나가 「전공자·일반」 을 함께 뜻합니다.
     그것만 전공자로 좁히면 <b>일반 회원이 지원도 못 하게</b> 됩니다.
     하는 일이 다르면 함수도 달라야 합니다 —

       oc_is_hiring()      공고 등록 · 인재 열람   관계자·단체·학교 + 승인
       oc_is_seeker()      인재정보 등록           전공자 + 승인
       oc_is_individual()  공고 지원               전공자·일반 + 승인   ← 신설

     ★ 회원 종류 목록은 이 세 함수 <b>안에만</b> 적습니다.
       정책·뷰·다른 함수에 손으로 다시 적지 마십시오.
       그렇게 적었다가 org 를 네 번 빠뜨렸습니다.

   함께 고치는 두 곳 (손으로 목록을 적어 둔 자리입니다)
     · recruit_talents_public 뷰
     · recruit_talent_contact() 함수
     둘 다 ARRAY['industry','org','school'] 를 직접 품고 있었습니다.
     이제 oc_is_hiring() 을 부르게 바꿉니다.

   ★ 적용하면 곧바로 일어나는 일
     지금 공고 46건은 <b>그대로 보입니다</b>(공개 읽기는 hidden 만 봅니다).
     다만 그 46건을 올린 시험용 단체 계정(status=rejected)은
     <b>새 등록·수정이 막힙니다.</b>
     시험을 이어가시려면 어드민 → 회원 관리 · 승인 에서
     그 계정을 <b>승인</b> 으로 바꿔 주십시오.

   되돌리기
     sql/roles-01-rollback.sql — 이 파일 전체를 원래대로 돌립니다

   쓰는 법
     Supabase → SQL Editor → New query → 전체 붙이기 → Run
     맨 끝에 확인 표가 나옵니다. 그것을 주십시오.
   ============================================================ */


/* ────────────────────────────────────────────────────────────
   1단계.  역할 함수 셋
   ──────────────────────────────────────────────────────────── */

/* 공고를 올리고 인재 연락처를 여는 쪽 — 뽑는 회원입니다.
   승인(approved)을 받은 뒤에만 됩니다. 관리자는 언제나 됩니다. */
create or replace function public.oc_is_hiring()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from members m
    where m.id = auth.uid()
      and ( coalesce(m.is_admin, false) = true
            or ( m.member_type in ('industry', 'org', 'school')
                 and m.status = 'approved' ) )
  );
$fn$;

/* 인재정보를 올리는 쪽 — <b>전공자만</b> 입니다.
   예전에는 일반 회원도 올릴 수 있었습니다. */
create or replace function public.oc_is_seeker()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from members m
    where m.id = auth.uid()
      and ( coalesce(m.is_admin, false) = true
            or ( m.member_type = 'major'
                 and m.status = 'approved' ) )
  );
$fn$;

/* 공고에 지원하는 쪽 — 개인 회원(전공자·일반)입니다.
   사업자(관계자·단체·학교)는 여기에 들지 않으므로 지원이 막힙니다.

   ★ 일반 회원은 가입할 때 곧바로 approved 가 되므로(assets/auth.js)
     따로 승인을 기다리지 않습니다. */
create or replace function public.oc_is_individual()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from members m
    where m.id = auth.uid()
      and ( coalesce(m.is_admin, false) = true
            or ( m.member_type in ('major', 'general')
                 and m.status = 'approved' ) )
  );
$fn$;

comment on function public.oc_is_hiring()     is '뽑는 회원(관계자·단체·학교) + 승인. 회원 종류 목록은 이 함수에만 적습니다.';
comment on function public.oc_is_seeker()     is '인재정보를 올리는 회원(전공자) + 승인.';
comment on function public.oc_is_individual() is '공고에 지원하는 개인 회원(전공자·일반) + 승인.';


/* ────────────────────────────────────────────────────────────
   2단계.  인재정보 공개 목록 뷰 — 손으로 적은 목록을 함수로 바꿉니다

   바뀌는 것은 마지막 조건 한 줄뿐이고, 내주는 칸은 그대로입니다.
   (뷰의 실행 방식 옵션은 원래대로 되돌려 둡니다)
   ──────────────────────────────────────────────────────────── */

do $do$
declare
  had_invoker boolean := false;
begin
  select coalesce(array_to_string(c.reloptions, ','), '') ilike '%security_invoker=true%'
    into had_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'recruit_talents_public';

  execute $v$
    create or replace view public.recruit_talents_public as
    select
      id,
      title,
      mask_name(name) as name_masked,
      gender,
      case when birth_year is not null
           then ((extract(year from current_date))::integer - birth_year) + 1
           else null::integer
      end as age,
      job_cat1,
      job_cat2,
      job_etc,
      pay_type,
      pay_amount,
      pay_daily,
      region1,
      region2,
      emp_types,
      now_status,
      veteran,
      disability,
      disability_grade,
      military,
      schools,
      career,
      body,
      view_count,
      created_at
    from recruit_talents t
    where hidden = false
      and is_open = true
      and ( member_id = auth.uid() or oc_is_hiring() )
  $v$;

  if had_invoker then
    execute 'alter view public.recruit_talents_public set (security_invoker = true)';
  end if;
end
$do$;


/* ────────────────────────────────────────────────────────────
   3단계.  연락처 열람 함수 — 손으로 적은 목록을 함수로 바꿉니다

   내주는 칸(name·phone·tel·email·addr1·addr2·photo_url·birth)은
   하나도 바뀌지 않습니다. 판단하는 방식만 바뀝니다.
   ──────────────────────────────────────────────────────────── */

create or replace function public.recruit_talent_contact(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  ok  boolean := false;
  out jsonb;
begin
  /* 뽑는 회원(승인됨)이거나, 관리자이거나, 본인이면 볼 수 있습니다.
     ★ 회원 종류를 여기 적지 않습니다 — oc_is_hiring() 이 압니다. */
  if oc_is_hiring() then
    ok := true;
  end if;

  if exists (
    select 1 from public.recruit_talents
    where id = p_id and member_id = auth.uid()
  ) then
    ok := true;
  end if;

  if not ok then
    return jsonb_build_object(
      'ok', false,
      'why', '인재의 연락처는 승인된 음악관계자·단체·기업 회원과 음악학교 회원만 보실 수 있습니다.'
    );
  end if;

  select jsonb_build_object(
    'ok',        true,
    'name',      t.name,
    'phone',     t.phone,
    'tel',       t.tel,
    'email',     t.email,
    'addr1',     t.addr1,
    'addr2',     t.addr2,
    'photo_url', t.photo_url,
    'birth',     case when t.birth_year is not null
                      then t.birth_year
                           || '.' || lpad(coalesce(t.birth_month, 0)::text, 2, '0')
                           || '.' || lpad(coalesce(t.birth_day,   0)::text, 2, '0')
                      else null
                 end
  )
  into out
  from public.recruit_talents t
  where t.id = p_id
    and t.hidden = false;

  return coalesce(out, jsonb_build_object('ok', false, 'why', '그 인재정보를 찾을 수 없습니다.'));
end
$fn$;


/* ────────────────────────────────────────────────────────────
   4단계.  지원 등록 규칙 — 개인 회원만

   원래 조건(본인 명의 · 숨긴 공고 아님 · 사이트 지원을 받는 공고)은
   그대로 두고, oc_is_individual() 한 줄만 더합니다.
   ──────────────────────────────────────────────────────────── */

drop policy if exists recruit_app_insert on public.recruit_applications;

create policy recruit_app_insert
  on public.recruit_applications
  for insert
  to authenticated
  with check (
    applicant_id = auth.uid()
    and oc_is_individual()
    and exists (
      select 1
      from recruit_jobs j
      where j.id = recruit_applications.job_id
        and coalesce(j.hidden, false) = false
        and coalesce(j.accept_site, true) = true
    )
  );


/* ────────────────────────────────────────────────────────────
   5단계.  확인 — 이 표를 주십시오
   ──────────────────────────────────────────────────────────── */

select '① 함수'::text as 구분,
       (p.proname || '()')::text as 이름,
       regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')::text as 내용
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.proname in ('oc_is_hiring', 'oc_is_seeker', 'oc_is_individual')

union all
select '② 정책',
       (tablename || ' · ' || policyname || ' [' || cmd || ']')::text,
       coalesce(regexp_replace(with_check, '\s+', ' ', 'g'), '(없음)')::text
from pg_policies
where schemaname = 'public'
  and tablename in ('recruit_applications', 'recruit_talents', 'recruit_jobs')
  and cmd = 'INSERT'

union all
select '③ 뷰',
       'recruit_talents_public'::text,
       regexp_replace(pg_get_viewdef('public.recruit_talents_public'::regclass, true), '\s+', ' ', 'g')::text

union all
select '④ 뷰 실행 방식',
       'recruit_talents_public'::text,
       coalesce(array_to_string(c.reloptions, ', '), '(옵션 없음)')::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'recruit_talents_public'

union all
select '⑤ 연락처 함수',
       'recruit_talent_contact'::text,
       (case when regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g') ilike '%industry%'
             then '★ 아직 회원 종류를 직접 품고 있습니다 — 확인 필요'
             else '깨끗합니다 (oc_is_hiring() 을 부릅니다)'
        end)::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.proname = 'recruit_talent_contact'

union all
select '⑥ 남은 손 목록 점검',
       ('정책: ' || tablename || ' · ' || policyname)::text,
       '★ 회원 종류를 직접 품고 있습니다'::text
from pg_policies
where schemaname = 'public'
  and ( coalesce(qual, '') like '%industry%'
     or coalesce(with_check, '') like '%industry%' )

order by 1, 2;
