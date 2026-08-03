/* ============================================================
   OPUSCLAM — 역할 정리 ①  되돌리기
   2026-08-03

   roles-01-apply.sql 을 <b>적용 이전 상태로</b> 완전히 돌립니다.
   2026-08-03 점검에서 읽어 낸 원래 정의를 그대로 복원합니다.

   ★ 순서가 중요합니다
     지원 규칙을 먼저 원래대로 돌린 뒤에 oc_is_individual() 을 지웁니다.
     (규칙이 그 함수를 붙들고 있으므로 순서를 바꾸면 오류가 납니다)

   쓰는 법
     Supabase → SQL Editor → New query → 전체 붙이기 → Run
   ============================================================ */


/* ── 1. 지원 등록 규칙 원래대로 (회원 종류 조건 없음) ──────── */

drop policy if exists recruit_app_insert on public.recruit_applications;

create policy recruit_app_insert
  on public.recruit_applications
  for insert
  to authenticated
  with check (
    applicant_id = auth.uid()
    and exists (
      select 1
      from recruit_jobs j
      where j.id = recruit_applications.job_id
        and coalesce(j.hidden, false) = false
        and coalesce(j.accept_site, true) = true
    )
  );


/* ── 2. 새로 만든 함수 지우기 ──────────────────────────────── */

drop function if exists public.oc_is_individual();


/* ── 3. oc_is_hiring() 원래대로 (승인 조건 없음) ───────────── */

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
      and ( m.member_type in ('industry', 'org', 'school')
            or coalesce(m.is_admin, false) = true )
  );
$fn$;


/* ── 4. oc_is_seeker() 원래대로 (전공자·일반, 승인 조건 없음) ── */

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
      and ( m.member_type in ('major', 'general')
            or coalesce(m.is_admin, false) = true )
  );
$fn$;


/* ── 5. 인재정보 공개 목록 뷰 원래대로 ─────────────────────── */

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
      and ( member_id = auth.uid()
            or exists (
              select 1 from members m
              where m.id = auth.uid()
                and ( m.member_type = any (array['industry'::text, 'org'::text, 'school'::text])
                      or m.is_admin = true )
            ) )
  $v$;

  if had_invoker then
    execute 'alter view public.recruit_talents_public set (security_invoker = true)';
  end if;
end
$do$;


/* ── 6. 연락처 열람 함수 원래대로 ──────────────────────────── */

create or replace function public.recruit_talent_contact(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  mt  text;
  ok  boolean := false;
  out jsonb;
begin
  select member_type into mt from public.members where id = auth.uid();

  if mt in ('industry', 'org', 'school') then
    ok := true;
  end if;

  if exists (
    select 1 from public.members
    where id = auth.uid() and coalesce(is_admin, false)
  ) then
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
      'why', '인재의 연락처는 음악관계자·단체·기업 회원과 음악학교 회원만 보실 수 있습니다.'
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
