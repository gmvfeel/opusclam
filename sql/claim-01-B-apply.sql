/* ════════════════════════════════════════════════════════════════
   OPUSCLAM — 「이 항목이 저입니다」 잇기 ①  만들기      B-apply.sql
   2026-08-11
   ────────────────────────────────────────────────────────────────

   ★ 무엇을 푸는가 (파트너 물음 · 2026-08-11)
     「관련기관·재단DB 에 크레디아를 이미 넣어 두었는데,
       크레디아 관계자가 단체 회원으로 가입하면 어떻게 됩니까」

     지금은 <b>아무 일도 일어나지 않습니다.</b> 회원은 members 에,
     크레디아는 foundations 에 따로 앉아 서로를 모릅니다.
     그대로 두면 같은 크레디아가 <b>두 벌</b>이 됩니다.

     이것은 기관·재단만의 일이 아닙니다. 인물 15,250명 · 단체 · 공연장 ·
     학교 · 현대음악 — <b>일곱 갈래 모두</b>에 해당합니다.

   ★ 어떻게 푸는가 — 「클레임」
     이미 있는 항목을 지우지도, 새로 만들지도 않습니다.
     <b>「이게 저희입니다」 라고 주장 → 관리자가 확인 → 잇기</b> 입니다.
     구글 비즈니스 프로필·링크드인 회사 페이지가 쓰는 방식입니다.

   ★ 왜 표 하나로 두는가 (일곱 표에 칸을 더하지 않고)
     ⑴ 일곱 갈래에 <b>같은 방식</b>으로 붙습니다. OPUSFINE 에도 그대로 씁니다.
     ⑵ 신청·승인·거절 <b>이력이 남습니다.</b> 나중에 다투게 되면 근거가 됩니다.
     ⑶ 한 단체에 관계자가 <b>여럿</b>일 수 있습니다 (기획팀장·홍보담당).
        칸 하나로는 담지 못합니다.

   ★ 인물은 더 엄하게 봅니다
     단체는 「우리 회사」가 뚜렷한데, 인물은 <b>동명이인</b>이 있고
     본인임을 가리기 어렵습니다. 그래서 인물 갈래는 관리자가 반드시
     사람 눈으로 봅니다 (oc_claim_needs_review 가 true 를 냅니다).

   ★ 회사 메일이면 손이 덜 갑니다
     신청자의 메일 도메인이 그 항목의 누리집 도메인과 같으면
     「도메인 맞음」 표를 달아 둡니다. 관리자가 그 표를 보고 빨리
     판단할 수 있습니다. <b>다만 저절로 승인되지는 않습니다</b> —
     도메인은 빌릴 수도 있고, 큰 기관은 부서가 여럿이기 때문입니다.

   ────────────────────────────────────────────────────────────────
   쓰는 법
     Supabase → SQL Editor → New query → 이 파일 전체 붙이기 → Run
     맨 끝에 확인 표가 나옵니다.

   되돌리기
     sql/claim-01-C-undo.sql
   ════════════════════════════════════════════════════════════════ */


/* ────────────────────────────────────────────────────────────
   1단계.  다룰 수 있는 갈래를 못박습니다

   ★ 글자로 그냥 두면 'orgs' · 'org' · 'organization' 이 섞입니다.
     한 번 섞이면 목록이 갈라지고 되돌리기 어렵습니다.
   ★ 갈래 이름은 <b>표 이름 그대로</b>입니다 — 화면에서 조회할 때
     이름을 옮길 필요가 없습니다.
   ──────────────────────────────────────────────────────────── */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'oc_entity_kind') then
    create type oc_entity_kind as enum
      ('persons', 'orgs', 'venues', 'schools', 'foundations', 'modern_composers', 'academic');
  end if;
end $$;


/* ────────────────────────────────────────────────────────────
   2단계.  잇기 신청 표
   ──────────────────────────────────────────────────────────── */

create table if not exists entity_claims (
  id            bigint generated always as identity primary key,

  member_id     uuid not null references members(id) on delete cascade,
  entity_kind   oc_entity_kind not null,
  entity_id     bigint not null,

  /* ★ 어느 항목이었는지 <b>글자로도</b> 남깁니다.
       나중에 그 항목이 지워지거나 이름이 바뀌어도, 무엇을 두고
       주고받은 신청이었는지 알 수 있어야 합니다. */
  entity_name   text,

  /* pending 기다림 · approved 이어짐 · rejected 아님 · revoked 거둠 */
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','revoked')),

  /* 신청자가 적는 것 */
  role_title    text,                  /* 그 단체에서 맡은 일 — 기획팀장 등 */
  note          text,                  /* 하고 싶은 말 */
  evidence_url  text,                  /* 증빙 — 누리집의 담당자 소개 쪽 등 */

  /* 시스템이 적는 것 — 관리자가 판단할 때 봅니다 */
  email_domain  text,                  /* 신청자 메일의 도메인 */
  domain_match  boolean default false, /* 그 항목의 누리집과 도메인이 같은가 */
  needs_review  boolean default true,  /* 사람 눈이 꼭 필요한가 (인물은 늘 true) */

  /* 관리자가 적는 것 */
  decided_by    uuid references members(id),
  decided_at    timestamptz,
  decided_note  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table entity_claims is
  '회원이 DB 항목을 「이것이 나(우리)입니다」 라고 잇는 신청. 2026-08-11';


/* ── 같은 사람이 같은 항목을 두 번 신청하지 못하게 합니다 ──
   ★ 다만 <b>거절·철회된 것은 다시 신청할 수 있어야</b> 합니다.
     증빙을 갖춰 다시 오는 길을 막으면 안 됩니다.
     그래서 「기다림·이어짐」 인 것만 하나로 묶습니다. */
create unique index if not exists entity_claims_live_uniq
  on entity_claims (member_id, entity_kind, entity_id)
  where status in ('pending','approved');

/* ── 한 항목의 주인은 여럿일 수 있지만, 목록을 빨리 뽑아야 합니다 ── */
create index if not exists entity_claims_entity_idx
  on entity_claims (entity_kind, entity_id, status);

create index if not exists entity_claims_member_idx
  on entity_claims (member_id, status);

/* ── 관리자 화면이 「기다리는 것」 을 먼저 뽑습니다 ── */
create index if not exists entity_claims_pending_idx
  on entity_claims (created_at desc)
  where status = 'pending';


/* ────────────────────────────────────────────────────────────
   3단계.  고친 때를 저절로 남깁니다
   ──────────────────────────────────────────────────────────── */

create or replace function oc_claims_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists entity_claims_touch on entity_claims;
create trigger entity_claims_touch
  before update on entity_claims
  for each row execute function oc_claims_touch();


/* ────────────────────────────────────────────────────────────
   4단계.  판단을 돕는 함수들

   ★ 규칙을 <b>함수 안에만</b> 적습니다.
     정책·화면·다른 함수에 손으로 다시 적지 마십시오.
     지난번 회원 종류 목록을 여러 곳에 적었다가 org 를 네 번 빠뜨렸습니다.
   ──────────────────────────────────────────────────────────── */

/* 지금 사람이 관리자인가 */
create or replace function oc_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from members where id = auth.uid()), false)
$$;

/* 승인된 회원인가 — 승인 전에는 신청도 못 합니다 */
create or replace function oc_is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' from members where id = auth.uid()), false)
$$;

/* ★ 사람 눈이 꼭 필요한 갈래인가
     인물은 동명이인이 있고 본인임을 가리기 어렵습니다.
     학술(논문)도 저자 확인이 까다로워 함께 넣습니다. */
create or replace function oc_claim_needs_review(kind oc_entity_kind) returns boolean
language sql immutable as $$
  select kind in ('persons', 'modern_composers', 'academic')
$$;

/* 이 회원이 이 항목의 주인으로 인정되었는가 — 화면이 물어봅니다 */
create or replace function oc_owns_entity(kind oc_entity_kind, eid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from entity_claims
     where member_id = auth.uid()
       and entity_kind = kind
       and entity_id = eid
       and status = 'approved')
$$;


/* ────────────────────────────────────────────────────────────
   5단계.  누가 무엇을 할 수 있는가 (RLS)
   ──────────────────────────────────────────────────────────── */

alter table entity_claims enable row level security;

/* 읽기 — 자기 것과 관리자 */
drop policy if exists claims_read_own on entity_claims;
create policy claims_read_own on entity_claims
  for select using (member_id = auth.uid() or oc_is_admin());

/* 신청 — 승인된 회원이 <b>자기 이름으로만</b>.
   ★ status 를 손으로 'approved' 라고 적어 넣지 못하게 막습니다.
     막지 않으면 스스로 승인하고 들어옵니다. */
drop policy if exists claims_insert_own on entity_claims;
create policy claims_insert_own on entity_claims
  for insert with check (
    member_id = auth.uid()
    and oc_is_approved()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
  );

/* 고치기 — 신청자는 <b>기다리는 동안</b> 자기 글만 손봅니다.
   ★ 승인된 뒤에는 손대지 못합니다. 승인 근거가 바뀌면 안 됩니다.
   ★ 스스로 status 를 올리지 못하도록 pending 으로 못박습니다. */
drop policy if exists claims_update_own on entity_claims;
create policy claims_update_own on entity_claims
  for update using (member_id = auth.uid() and status = 'pending')
              with check (member_id = auth.uid() and status = 'pending');

/* 관리자 — 모두 */
drop policy if exists claims_admin_all on entity_claims;
create policy claims_admin_all on entity_claims
  for all using (oc_is_admin()) with check (oc_is_admin());

/* 거두기(철회) — 신청자가 자기 것을 물릴 수 있게 합니다.
   지우지 않고 revoked 로 둡니다. 이력이 남아야 합니다.
   ★ 함수로 두는 까닭 — 위 update 정책은 pending 만 열어 두었습니다.
     이어진(approved) 것을 물리는 길은 여기 하나뿐이어야 합니다. */
create or replace function oc_claim_revoke(claim_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update entity_claims
     set status = 'revoked', decided_at = now(), decided_by = auth.uid()
   where id = claim_id
     and member_id = auth.uid()
     and status in ('pending','approved')
  returning true into ok;
  return coalesce(ok, false);
end $$;


/* ────────────────────────────────────────────────────────────
   6단계.  화면이 쓸 조회 창구

   ★ 상세 화면은 「이 항목에 인증된 주인이 있는가」 만 알면 됩니다.
     누가 주인인지, 무엇을 적어 냈는지는 <b>보여 주지 않습니다.</b>
     신청서에는 연락처·증빙이 들어 있어 남에게 보일 것이 아닙니다.
   ──────────────────────────────────────────────────────────── */

create or replace view entity_claim_badge as
  select entity_kind, entity_id, count(*)::int as owner_count,
         min(decided_at) as verified_at
    from entity_claims
   where status = 'approved'
   group by entity_kind, entity_id;

comment on view entity_claim_badge is
  '상세 화면의 「공식 인증」 표시용. 누가 주인인지는 담지 않습니다.';

grant select on entity_claim_badge to anon, authenticated;


/* ────────────────────────────────────────────────────────────
   7단계.  확인
   ──────────────────────────────────────────────────────────── */

select
  (select count(*) from pg_type where typname = 'oc_entity_kind')                    as "갈래 종류",
  (select count(*) from information_schema.tables
    where table_name = 'entity_claims')                                              as "신청 표",
  (select count(*) from pg_indexes where tablename = 'entity_claims')                as "찾아보기",
  (select count(*) from pg_policies where tablename = 'entity_claims')               as "권한 규칙",
  (select count(*) from information_schema.views where table_name='entity_claim_badge') as "인증 표시",
  (select count(*) from pg_proc where proname in
    ('oc_is_admin','oc_is_approved','oc_claim_needs_review','oc_owns_entity','oc_claim_revoke'))
                                                                                     as "함수";
