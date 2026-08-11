/* ════════════════════════════════════════════════════════════════
   OPUSCLAM — 「이 항목이 저입니다」 잇기 ①  되돌리기    C-undo.sql
   2026-08-11
   ────────────────────────────────────────────────────────────────
   ⚠ 이 파일은 신청 표를 <b>통째로 없앱니다.</b> 신청 이력도 함께 사라집니다.
     ★ 그래서 지우는 부분은 <b>주석으로 막아 두었습니다.</b>
       통째로 실행해도 아무것도 지워지지 않습니다.

   ★ DB 7종(인물·단체·공연장·학교·기관·현대음악·학술)은 <b>손대지 않습니다.</b>
     이 작업은 표를 하나 <b>더한</b> 것이라, 없애도 기존 자료는 그대로입니다.
   ════════════════════════════════════════════════════════════════ */


/* ══════════ ① 먼저 무엇이 담겼는지 봅니다 ══════════ */
select id as "번호", member_id as "회원", entity_kind as "갈래", entity_id as "항목",
       entity_name as "이름", status as "상태", created_at as "신청한 때"
  from entity_claims
 order by created_at desc;


/* ══════════ ② 신청만 비우기 (표는 남깁니다) ══════════ */
--   시험 삼아 넣어 본 것을 치울 때 씁니다.
-- delete from entity_claims;


/* ══════════ ③ 통째로 없애기 ══════════ */
--   ★ 일부러 주석으로 막아 두었습니다.
--     정말 되돌리시려면 아래 여섯 줄의 맨 앞 -- 만 지우고 실행하십시오.
-- drop view  if exists entity_claim_badge;
-- drop table if exists entity_claims;
-- drop type  if exists oc_entity_kind;
-- drop function if exists oc_owns_entity(oc_entity_kind, bigint);
-- drop function if exists oc_claim_needs_review(oc_entity_kind);
-- drop function if exists oc_claim_revoke(bigint);
-- drop function if exists oc_claims_touch();
--   ★ oc_is_admin() · oc_is_approved() 는 <b>지우지 않습니다.</b>
--     다른 곳에서도 쓸 수 있는 일반 함수입니다.
