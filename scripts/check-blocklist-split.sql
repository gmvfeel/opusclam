/* ============================================================
   OPUSCLAM  차단 목록이 두 갈래인 문제
   2026-08-03

   ★ 읽기만 합니다. 아무것도 고치지 않습니다.

   무엇을 발견했나
     차단 목록을 담는 표가 <b>둘</b>입니다.

       blocklist     어드민의 「삭제 + 차단」 이 여기에 남깁니다.
                     수집기 여섯 개가 이것을 읽습니다.
                       collect-persons-kr · collect-modern · collect-orgs
                       collect-schools · collect-venues · collect-foundations

       person_block  seed/kr-composer.mjs <b>하나만</b> 이것을 읽습니다.
                     이름(name_ko)과 위키데이터 번호로 걸러냅니다.

     즉 어드민에서 지운 인물은 blocklist 에만 들어가므로,
     <b>kr-composer 를 돌리면 그 인물이 다시 들어옵니다.</b>
     (collect-kr-composer 워크플로는 수동 실행이라 자주 돌지는 않습니다)

   무엇을 볼까
     ⓵ 두 표에 각각 몇 개가 있는지
     ⓶ 한쪽에만 있는 번호가 몇 개인지 — 이것이 새는 구멍입니다
     ⓷ 차단됐는데 인물DB 에 아직 남아 있는 인물 (지워지지 않은 것)
     ⓸ person_block 의 표본

   쓰는 법
     Supabase → SQL Editor → New query → 전체 붙이기 → Run
   ============================================================ */

select 구분, 항목, 값 from (

  /* ── ⓵ 두 표의 크기 ─────────────────────────────────────── */
  select 1 as ord, $a$⓵ 두 표의 크기$a$::text as 구분,
         $a$blocklist$a$::text as 항목,
         (count(*)::text || $a$개$a$)::text as 값
  from public.blocklist
  union all
  select 1, $a$⓵ 두 표의 크기$a$, $a$person_block$a$::text,
         (case when exists (
            select 1 from information_schema.tables
            where table_schema = $a$public$a$ and table_name = $a$person_block$a$)
          then (select count(*)::text || $a$개$a$ from public.person_block)
          else $a$표가 없습니다$a$ end)::text

  union all
  /* ── ⓶ 한쪽에만 있는 번호 — 새는 구멍 ─────────────────────── */
  select 2, $a$⓶ 한쪽에만 있음$a$, $a$blocklist 에만 있음 (kr-composer 가 못 봄)$a$::text,
         (case when exists (
            select 1 from information_schema.tables
            where table_schema = $a$public$a$ and table_name = $a$person_block$a$)
          then (select count(*)::text || $a$개$a$ from public.blocklist b
                where b.wikidata_id is not null
                  and not exists (select 1 from public.person_block q
                                  where q.wikidata_id = b.wikidata_id))
          else $a$person_block 표가 없어 견줄 수 없습니다$a$ end)::text
  union all
  select 2, $a$⓶ 한쪽에만 있음$a$, $a$person_block 에만 있음 (수집기 여섯이 못 봄)$a$::text,
         (case when exists (
            select 1 from information_schema.tables
            where table_schema = $a$public$a$ and table_name = $a$person_block$a$)
          then (select count(*)::text || $a$개$a$ from public.person_block q
                where q.wikidata_id is not null
                  and not exists (select 1 from public.blocklist b
                                  where b.wikidata_id = q.wikidata_id))
          else $a$-$a$ end)::text

  union all
  /* ── ⓷ 차단됐는데 인물DB 에 남아 있음 ─────────────────────── */
  select 3, $a$⓷ 지워지지 않은 것$a$, $a$blocklist 에 있는데 인물DB 에 남아 있음$a$::text,
         (count(*)::text || $a$명$a$)::text
  from public.persons p
  where p.wikidata_id in (select wikidata_id from public.blocklist)

) z

union all

/* ── ⓸ 차단됐는데 남아 있는 인물 표본 10명 ──────────────────
   이들이 왜 남아 있는지 봅니다 — 차단만 되고 삭제가 안 된 것인지,
   지운 뒤 수집이 다시 담은 것인지. */
select $a$⓸ 남아 있는 표본$a$::text, t.nm, t.info from (
  select (p.id::text || $a$ · $a$ || coalesce(p.name_ko, p.name_en, $a$-$a$))::text as nm,
         (coalesce(p.wikidata_id, $a$-$a$) || $a$ · 출처 $a$ || coalesce(p.source, $a$-$a$)
          || $a$ · 분야 $a$ || coalesce(p.field, $a$-$a$))::text as info
  from public.persons p
  where p.wikidata_id in (select wikidata_id from public.blocklist)
  order by p.id
  limit 10
) t

order by 1, 2;
