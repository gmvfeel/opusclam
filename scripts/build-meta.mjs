/* ════════════════════════════════════════════════════════════════
   각 화면에 <meta name="description"> 을 넣습니다
   ────────────────────────────────────────────────────────────────
   실행:  node scripts/build-meta.mjs
   결과:  해당 html 파일들을 고칩니다 (이미 있으면 건드리지 않습니다)

   ★ 이것이 무엇인가
     검색 결과에서 제목 아래 나오는 <b>두 줄 설명</b>입니다.
     없으면 구글이 본문에서 아무 데나 긁어다 씁니다. 그런데 우리 화면은
     본문을 자바스크립트로 채우므로 <b>긁어갈 것도 없습니다.</b>
     그래서 빈 설명으로 나가거나, 아예 다른 화면 글이 붙습니다.

   ★ 왜 손으로 적지 않는가
     화면마다 이미 <b>자기 소개 문장</b>이 있습니다 — 제목 아래 회색 글
     (.pdb-lead). 그것을 그대로 씁니다. 두 곳에 같은 말을 적으면
     한쪽만 고쳤을 때 갈라집니다.

   ★ 번역은 저절로 따라옵니다
     그 문장들은 <b>이미 사전에 들어 있습니다</b> (37개 전부 확인).
     assets/i18n.js 가 description 도 번역하도록 해 두었으므로,
     영어·일본어 화면에서는 그 말로 바뀝니다.

   ★ 소개 문장이 없는 화면(홈·검색·레슨·약관)만 아래 EXTRA 에 적습니다.
   ════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 소개 문장이 없는 화면 — 여기에 적습니다 ─────────────────────
   ★ 길이는 <b>70~150자</b>가 알맞습니다. 너무 길면 구글이 잘라 냅니다.
   ★ 그 화면에서 사람들이 <b>검색창에 칠 만한 말</b>이 들어가야 합니다. */
const EXTRA = {
  '/home.html':
    '클래식 음악 전문 포털 오퍼스클램 — 인물 · 음악단체 · 공연장 · 음악학교 · 현대음악 · 기관재단 · 학술 자료를 하나로 잇습니다.',
  '/search.html':
    '오퍼스클램 통합검색 — 인물 · 단체 · 공연장 · 학교 · 작품 · 논문 · 커뮤니티 글을 한 번에 찾습니다.',

  '/lesson/index.html':
    '레슨:ON — 클래식 음악 레슨을 온라인으로. 마스터클래스 · 공개레슨 · 1:1 · 그룹레슨을 한곳에서 찾습니다.',
  '/lesson/master.html':
    '마스터클래스 — 국내외 연주자와 교수진의 마스터클래스 영상을 편성별로 보실 수 있습니다.',
  '/lesson/open.html':
    '공개레슨 — 누구나 볼 수 있는 클래식 음악 레슨 영상을 편성과 수준별로 모았습니다.',
  '/lesson/live.html':
    '진행중 레슨 — 지금 신청할 수 있는 클래식 음악 레슨을 모았습니다.',
  '/lesson/one.html':
    '분야별 1:1 레슨 — 전공과 편성에 맞는 개인 레슨을 찾고 신청하실 수 있습니다.',
  '/lesson/group.html':
    '분야별 그룹레슨 — 여럿이 함께 듣는 클래식 음악 레슨을 편성별로 찾습니다.',
  '/lesson/instructor.html':
    '인스트럭터 정보 — 레슨:ON에서 가르치는 연주자와 교육자의 이력과 강의를 보실 수 있습니다.',

  '/legal/terms.html':
    '오퍼스클램 서비스 이용약관 — 회원 자격, 서비스 이용 조건, 게시물의 권리와 책임을 정합니다.',
  '/legal/privacy.html':
    '오퍼스클램 개인정보처리방침 — 어떤 정보를 어떤 목적으로 모으고, 얼마나 두었다가 어떻게 없애는지 밝힙니다.',
  '/legal/data-policy.html':
    '오퍼스클램 데이터 저작권·출처 정책 — 자료를 어디서 가져오고 어떤 조건으로 쓰는지, 출처를 어떻게 밝히는지 정리했습니다.',
  '/legal/data-protection.html':
    '오퍼스클램 데이터 무단 수집·도용 금지 — 자동 수집과 무단 복제를 허락하지 않는 범위와 근거를 밝힙니다.',
};

/* sitemap 과 같은 51개 화면 */
const PAGES = [
  '/home.html', '/search.html',
  '/db/index.html', '/db/person.html', '/db/venue.html', '/db/modern.html',
  '/db/org.html', '/db/school.html', '/db/foundation.html', '/db/work.html',
  '/db/timeline.html', '/db/terms.html', '/db/academic.html',
  '/community/index.html', '/community/news.html', '/community/hottopic.html',
  '/community/qna.html', '/community/prenatal.html', '/community/prenatal-playlist.html',
  '/community/selfpr.html', '/community/school-month.html', '/community/gallery.html',
  '/community/modern.html', '/community/utility.html', '/community/admission.html',
  '/community/admission-community.html',
  '/spot/index.html', '/spot/concert.html', '/spot/concours.html',
  '/spot/concours-price.html', '/spot/festival.html', '/spot/funding.html',
  '/spot/score.html', '/spot/media.html', '/spot/sites.html',
  '/lesson/index.html', '/lesson/master.html', '/lesson/open.html', '/lesson/live.html',
  '/lesson/one.html', '/lesson/group.html', '/lesson/instructor.html',
  '/recruit/guide.html', '/recruit/job.html', '/recruit/talent.html',
  '/shop/apply.html',
  '/legal/terms.html', '/legal/privacy.html', '/legal/data-policy.html',
  '/legal/data-protection.html',
];

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

let added = 0, kept = 0, noText = [], noFile = [];

for (const page of PAGES) {
  const file = join(ROOT, page.replace(/^\//, ''));
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch { noFile.push(page); continue; }

  if (/<meta\s+name="description"/i.test(src)) { kept++; continue; }

  /* ① 적어 둔 것이 있으면 그것을, ② 없으면 화면의 소개 문장을 씁니다 */
  let text = EXTRA[page];
  if (!text) {
    const m = src.match(/class="pdb-lead"[^>]*>\s*([^<]{10,300}?)\s*</);
    if (m) text = m[1].split(/\s+/).join(' ');
  }
  if (!text) { noText.push(page); continue; }

  /* <title> 바로 아래에 넣습니다 — 사람이 열어 봐도 찾기 쉬운 자리입니다 */
  const t = src.match(/<title>[\s\S]*?<\/title>\s*\n?/);
  if (!t) { noText.push(page + ' (title 없음)'); continue; }
  const at = t.index + t[0].length;
  const line = `<meta name="description" content="${esc(text)}">\n`;
  writeFileSync(file, src.slice(0, at) + line + src.slice(at), 'utf8');
  added++;
}

console.log(`  넣음 ${added}개 · 이미 있어 그대로 둠 ${kept}개`);
if (noText.length) console.log(`  글감을 못 찾음 ${noText.length}개: ${noText.join(', ')}`);
if (noFile.length) console.log(`  파일 없음 ${noFile.length}개: ${noFile.join(', ')}`);
