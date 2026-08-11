/* ════════════════════════════════════════════════════════════════
   OPUSCLAM — 「이 항목이 저입니다」 잇기 ①  미리보기   A-preview.sql
   2026-08-11
   ────────────────────────────────────────────────────────────────
   ★ 아무것도 바꾸지 않습니다. 열어서 그대로 실행하십시오.
   ★ B-apply 를 돌리기 <b>전에</b> 지금 상태를 확인합니다.
   ════════════════════════════════════════════════════════════════ */

select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='entity_claims')      as "신청표 (0이어야 함)",
  (select count(*) from pg_type where typname='oc_entity_kind')      as "갈래종류 (0이어야 함)",
  (select count(*) from members)                                     as "회원 수",
  (select count(*) from members where status='approved')             as "승인된 회원",
  (select count(*) from members where member_type='org')             as "단체·기업 회원",
  (select count(*) from persons)                                     as "인물DB",
  (select count(*) from orgs)                                        as "음악단체DB",
  (select count(*) from venues)                                      as "공연장DB",
  (select count(*) from schools)                                     as "음악학교DB",
  (select count(*) from foundations)                                 as "기관·재단DB";
