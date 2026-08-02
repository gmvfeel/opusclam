#!/usr/bin/env bash
# ============================================================
#  OPUSCLAM DB 백업 — scripts/db-backup.sh
#
#  무엇을 하나
#    ① 전체 덤프        public 스키마 통째로 (구조 + 자료)
#    ② 회원 계정 덤프    auth.users · auth.identities
#    ③ 핵심 표 CSV      되돌릴 수 없는 것들을 사람이 읽을 수 있게
#    ④ 암호를 걸어 하나로 묶습니다
#
#  ★ 왜 암호를 거는가 — <b>반드시</b> 걸어야 합니다
#    저장소(gmvfeel/opusclam)가 공개입니다. GitHub Actions 가 남기는
#    파일은 저장소를 볼 수 있는 사람이면 내려받을 수 있습니다.
#    암호를 걸지 않으면 <b>회원 이메일·전화번호·비밀번호 해시가
#    그대로 공개</b>됩니다. 그래서 암호 없이는 이 스크립트가
#    아예 멈추도록 해 두었습니다.
#
#  ★ ①만으로 충분한데 ③을 왜 또 만드나
#    ①은 재난 대비입니다. 자료가 통째로 사라졌을 때 씁니다.
#    그런데 실제로 자주 필요한 일은 「차단 목록만 되돌리기」 처럼
#    <b>한 표만</b> 되살리는 것입니다. 그때 전체 덤프를 열어 보는 것은
#    번거롭고 위험합니다. CSV 는 열어서 눈으로 확인하고 필요한 줄만
#    되돌릴 수 있습니다.
#
#  ★ 다시 만들 수 있는 것과 없는 것
#    다시 만들 수 있음  인물·학교·공연장·논문·공연정보 (수집기가 다시 받아 옵니다)
#    다시 만들 수 없음  회원 · 채용 · 인재 · 지원 · <b>차단 목록</b> ·
#                      커뮤니티 글 · 감춘 표시 · 손으로 고친 값
#    ③에는 뒤쪽을 담습니다.
#
#  필요한 것 (GitHub Secrets)
#    SUPABASE_DB_URL     Supabase → Connect → Session pooler 연결 주소
#    BACKUP_PASSPHRASE   백업을 열 암호 (파트너님이 따로 적어 두셔야 합니다)
# ============================================================
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL 이 없습니다. GitHub Secrets 에 넣어 주십시오.}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE 가 없습니다. 암호 없이는 백업하지 않습니다 (공개 저장소이므로).}"

# ★ PostgreSQL 17 도구를 앞세웁니다.
#   실제로 겪은 일 — 워크플로에서 17을 설치했는데도 pg_dump 는 16.14 가
#   불려 「server version mismatch」 로 막혔습니다. 우분투에 이미 있던 16이
#   먼저 잡힌 것입니다. 여기서 한 번 더 못박아 둡니다.
if [ -x /usr/lib/postgresql/17/bin/pg_dump ]; then
  export PATH="/usr/lib/postgresql/17/bin:${PATH}"
fi

# ★ 판이 낮으면 여기서 멈춥니다.
#   pg_dump 는 서버보다 낮으면 스스로 거부합니다(옳은 동작입니다).
#   그래도 먼저 확인해 <b>무엇이 문제인지 분명한 말로</b> 알려 줍니다.
PGMAJ="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
if [ "${PGMAJ}" -lt 17 ]; then
  echo "★ pg_dump 판이 ${PGMAJ} 입니다. Supabase 서버(17)보다 낮아 뜰 수 없습니다."
  echo "  워크플로의 「pg_dump 17 설치」 단계를 확인해 주십시오."
  exit 1
fi

STAMP="$(date -u '+%Y%m%d-%H%M')"
WORK="oc-backup-${STAMP}"
OUT="backup"
mkdir -p "${WORK}/csv" "${OUT}"

echo "■ OPUSCLAM DB 백업 시작 · ${STAMP} (UTC)"
echo "  pg_dump 판: $(pg_dump --version)"

# ── ① 전체 덤프 (public 스키마) ─────────────────────────────
#   -Fc  묶음 형식 — 압축되고, 되돌릴 때 표를 골라 쓸 수 있습니다
#   --no-owner --no-privileges  다른 프로젝트에도 되돌릴 수 있게
echo "■ ① public 스키마 덤프"
pg_dump "${SUPABASE_DB_URL}" \
  --schema=public \
  --no-owner --no-privileges \
  --quote-all-identifiers \
  -Fc -f "${WORK}/public_all.dump"
echo "   → $(du -h "${WORK}/public_all.dump" | cut -f1)"

# ── ② 회원 계정 ────────────────────────────────────────────
#   ★ auth 스키마는 Supabase 가 관리합니다. 구조까지 되돌리면
#     충돌하므로 <b>자료만</b> 뜹니다.
#     이것이 없으면 회원이 로그인할 수 없게 됩니다.
echo "■ ② 회원 계정 (auth.users · auth.identities)"
pg_dump "${SUPABASE_DB_URL}" \
  --data-only --no-owner --no-privileges \
  -t auth.users -t auth.identities \
  -Fc -f "${WORK}/auth_users.dump" \
  || echo "   (auth 스키마를 뜨지 못했습니다 — 연결 권한을 확인해 주십시오)"
[ -f "${WORK}/auth_users.dump" ] && echo "   → $(du -h "${WORK}/auth_users.dump" | cut -f1)"

# ── ③ 되돌릴 수 없는 표를 CSV 로 ───────────────────────────
#   ★ 여기 없는 표는 수집기가 다시 만들 수 있는 것들입니다
#     (persons · schools · venues · academic · spot 등).
#     그것까지 CSV 로 뜨면 파일이 커지고 정작 필요한 것을 찾기 어렵습니다.
echo "■ ③ 되돌릴 수 없는 표 CSV"
KEEP_TABLES="
blocklist
members
recruit_jobs
recruit_talents
recruit_applications
recruit_drafts
member_favorites
hero_slides
features
hottopic
hottopic_comments
news
news_comments
qna
qna_comments
gallery
gallery_comments
admission
admission_community
admission_community_comments
modern_music
modern_music_comments
prenatal_music
prenatal_music_comments
utility
utility_comments
entity_links
"
ok=0; miss=0
for t in ${KEEP_TABLES}; do
  if psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -q \
      -c "\copy (select * from public.${t}) to '${WORK}/csv/${t}.csv' with (format csv, header true)" 2>/dev/null; then
    n=$(( $(wc -l < "${WORK}/csv/${t}.csv") - 1 ))
    printf '   %-34s %s줄\n' "${t}" "${n}"
    ok=$((ok+1))
  else
    printf '   %-34s (표가 없어 건너뜀)\n' "${t}"
    rm -f "${WORK}/csv/${t}.csv"
    miss=$((miss+1))
  fi
done
echo "   → 담은 표 ${ok}개 · 건너뛴 것 ${miss}개"

# ── 무엇이 들었는지 적어 둡니다 ────────────────────────────
{
  echo "OPUSCLAM DB 백업"
  echo "뜬 시각(UTC) : ${STAMP}"
  echo "pg_dump      : $(pg_dump --version)"
  echo ""
  echo "[들어 있는 것]"
  echo "  public_all.dump   public 스키마 전체 (구조 + 자료)"
  echo "  auth_users.dump   회원 계정 (자료만)"
  echo "  csv/*.csv         되돌릴 수 없는 표 ${ok}개"
  echo ""
  echo "[되돌리는 법]  docs/BACKUP-RESTORE.md 를 보십시오"
  echo ""
  echo "[표별 줄 수]"
  for f in "${WORK}"/csv/*.csv; do
    [ -e "$f" ] || continue
    printf '  %-34s %s\n' "$(basename "$f" .csv)" "$(( $(wc -l < "$f") - 1 ))"
  done
} > "${WORK}/README.txt"

# ── ④ 묶어서 암호를 겁니다 ─────────────────────────────────
echo "■ ④ 묶고 암호 걸기"
tar czf "${WORK}.tar.gz" "${WORK}"
RAW=$(du -h "${WORK}.tar.gz" | cut -f1)

#   AES256 · 대칭키. 암호는 GitHub Secrets 에만 있고 로그에 남지 않습니다.
gpg --batch --yes --symmetric --cipher-algo AES256 \
    --passphrase-fd 0 \
    -o "${OUT}/opusclam-db-${STAMP}.tar.gz.gpg" \
    "${WORK}.tar.gz" <<< "${BACKUP_PASSPHRASE}"

ENC=$(du -h "${OUT}/opusclam-db-${STAMP}.tar.gz.gpg" | cut -f1)
echo "   원본 ${RAW} → 암호 걸린 것 ${ENC}"

# ── ⑤ 제대로 되었는지 확인 ─────────────────────────────────
#   ★ 「백업했다」 는 말만 남기고 실제로는 빈 파일인 경우가 가장 위험합니다.
#     그래서 크기를 보고, 암호로 실제로 열리는지까지 확인합니다.
echo "■ ⑤ 확인"
SIZE=$(stat -c%s "${OUT}/opusclam-db-${STAMP}.tar.gz.gpg")
if [ "${SIZE}" -lt 10000 ]; then
  echo "   ★ 파일이 너무 작습니다 (${SIZE} 바이트). 백업이 제대로 되지 않았습니다."
  exit 1
fi
gpg --batch --yes --decrypt --passphrase-fd 0 \
    -o /tmp/verify.tar.gz "${OUT}/opusclam-db-${STAMP}.tar.gz.gpg" <<< "${BACKUP_PASSPHRASE}" 2>/dev/null
tar tzf /tmp/verify.tar.gz > /tmp/verify.list
echo "   암호로 열리는지     : 됨"
echo "   들어 있는 파일 수   : $(wc -l < /tmp/verify.list)개"
echo "   전체 덤프 들었는지  : $(grep -c 'public_all.dump' /tmp/verify.list)개"
echo "   CSV 들었는지        : $(grep -c 'csv/.*\.csv' /tmp/verify.list)개"
rm -f /tmp/verify.tar.gz /tmp/verify.list

# ── 뒷정리 — 암호 걸리지 않은 것은 남기지 않습니다 ─────────
rm -rf "${WORK}" "${WORK}.tar.gz"
echo "■ 완료 · ${OUT}/opusclam-db-${STAMP}.tar.gz.gpg"
