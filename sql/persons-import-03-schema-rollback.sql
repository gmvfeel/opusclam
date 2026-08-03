/* ============================================================
   OPUSCLAM — 인물DB 구조 보강  되돌리기
   2026-08-03

   persons-import-03-schema.sql 을 적용 이전으로 돌립니다.

   ★ 두 표를 지우면 그 안의 <b>작품·수상 자료가 함께 사라집니다.</b>
     그래서 기본은 「표는 남기고 아무것도 하지 않기」 입니다.
     화면 쪽에서 쓰지 않으면 표가 있어도 아무 일도 일어나지 않습니다.

     정말로 지우시려면 아래 각 묶음의 주석을 벗기십시오.
     되돌릴 수 없습니다.

   쓰는 법
     Supabase → SQL Editor → New query → 필요한 부분만 붙이기 → Run
   ============================================================ */


/* ── ① persons.source 되돌리기 ──────────────────────────────
   이 칸은 지워도 잃는 것이 거의 없습니다(출처 표시일 뿐).
   다만 나중에 다시 만들려면 9,271명을 또 표시해야 합니다. */

-- drop index if exists public.persons_source_idx;
-- alter table public.persons drop column if exists source;


/* ── ② 작품 표 지우기 ───────────────────────────────────────
   ★ 담긴 작품이 모두 사라집니다. 먼저 몇 줄인지 확인하십시오 —
     select count(*) from public.person_works; */

-- drop table if exists public.person_works;


/* ── ③ 수상 표 지우기 ───────────────────────────────────────
   ★ 담긴 수상이 모두 사라집니다. */

-- drop table if exists public.person_awards;


/* ── ④ 지우지 않고 「쓰지 않는 상태」 로만 두려면 ─────────────
   권한 규칙만 걷어 두면 아무도 읽지 못합니다. 자료는 남습니다.
   나중에 규칙만 다시 만들면 그대로 살아납니다. */

-- drop policy if exists person_works_read   on public.person_works;
-- drop policy if exists person_works_admin  on public.person_works;
-- drop policy if exists person_awards_read  on public.person_awards;
-- drop policy if exists person_awards_admin on public.person_awards;


/* ── 지금 무엇이 담겨 있는지 먼저 보십시오 ──────────────────── */

select 'persons.source 가 있는가'::text as 구분,
       (case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'persons'
            and column_name = 'source')
        then '있습니다' else '없습니다' end)::text as 내용
union all
select 'person_works 줄 수',
       coalesce((select count(*)::text || '줄' from public.person_works), '표가 없습니다')
union all
select 'person_awards 줄 수',
       coalesce((select count(*)::text || '줄' from public.person_awards), '표가 없습니다')
order by 1;
