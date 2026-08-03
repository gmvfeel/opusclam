/* ============================================================
   OPUSCLAM — 역할 정리 ①  적용 전 확인
   2026-08-03

   ★ 읽기만 합니다. 아무것도 고치지 않습니다.

   무엇을 보는가
     1) 지금 올라와 있는 공고·인재정보를 <b>누가</b> 올렸는지
        → 규칙에 「승인」 을 넣으면 누가 막히는지 미리 압니다
     2) is_admin() 함수가 정말 있는지 (정책이 그것을 부르고 있습니다)
     3) persons.id 의 형 (뒤에 인물DB 검수를 얹을 때 필요합니다)

   쓰는 법
     Supabase → SQL Editor → New query → 전체 붙이기 → Run
   ============================================================ */

select '① 공고를 올린 회원'::text as 구분,
       (coalesce(m.member_type, '(회원 기록 없음)')
          || ' · ' || coalesce(m.status, '-')
          || ' · ' || coalesce(m.name, m.username, '-'))::text as 이름,
       (count(*)::text || '건')::text as 내용
from recruit_jobs j
left join members m on m.id = j.member_id
group by 1, 2

union all
select '② 인재정보를 올린 회원',
       coalesce(m.member_type, '(회원 기록 없음)') || ' · ' || coalesce(m.status, '-'),
       count(*)::text || '건'
from recruit_talents t
left join members m on m.id = t.member_id
group by 1, 2

union all
select '③ 지원을 넣은 회원',
       coalesce(m.member_type, '(회원 기록 없음)') || ' · ' || coalesce(m.status, '-'),
       count(*)::text || '건'
from recruit_applications a
left join members m on m.id = a.applicant_id
group by 1, 2

union all
select '④ is_admin() 함수',
       (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')::text,
       regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')::text
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' and p.proname = 'is_admin'

union all
select '⑤ persons.id 형',
       column_name::text,
       data_type::text
from information_schema.columns
where table_schema = 'public' and table_name = 'persons' and column_name = 'id'

union all
select '⑥ 뷰 실행 방식',
       'recruit_talents_public',
       coalesce(array_to_string(c.reloptions, ', '), '(옵션 없음 — 소유자 권한으로 실행)')
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'recruit_talents_public'

order by 1, 2;
