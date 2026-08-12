/* ============================================================
   OPUSCLAM 자동 시드 콘텐츠 풀 — 인덱스
   ------------------------------------------------------------
   실제 글은 pool/ 폴더 안에 게시판별로 나뉘어 있습니다.
   새 게시판이 생기면 pool/ 에 파일 하나 추가하고
   아래에 import 한 줄, posts 에 한 줄만 넣으면 됩니다.

   ── 배치 기록 ──
     1차  hottopic(9) · admission(9) · qna(8)          = 26
     2차  hottopic-2(12) · admission-2(12) · qna-2(18) = 42
     3차  hottopic-3(12) · admission-3(12) · qna-3(14) = 38
     뉴스 news(6)  ← 만들어 두고 쓰이지 않던 것을 이번에 살렸습니다
     4차  modern(14) · prenatal(12) · utility(12) = 38
          ★ 자동시드가 다섯 게시판만 다뤄 현대음악·태교음악이
            8건에서 멈춰 있었습니다. 게시판 설정도 함께 넣었습니다.
     5차  utility-2(12) · news-2(8) · qna-4(12)    = 32
     6차  admission-4(12) · hottopic-4(12)
          modern-2(6) · prenatal-2(6)              = 36
          ★ 2026-08-08 · 런칭 전이라 모든 게시판을 채워 둡니다.
            그때 남은 양 — 입시 1개 · 핫토픽 7개 · 현대음악 4개
            태교음악 2개. 입시가 거의 바닥이었습니다.
          ★ 2026-08-08 · 풀이 바닥나 만든 것입니다.
            그때 상태 — 풀 150개 · 담긴 것 295건
            utility · news · qna 는 이미 소진돼 「남은 글 없음」이
            뜨기 직전이었습니다.
          ★ 자동시드를 하루 두 번에서 <b>한 번</b>으로 줄였습니다.
            남은 것으로 두 배 오래 갑니다.
     7차  qna-5(21) · news-3(14)                  = 35
     8차  admission-5(14) · hottopic-5(12)
          modern-3(8) · prenatal-3(8) · utility-3(8) = 50
          ★ 7차와 같은 날 이어서 만들었습니다. 남은 것이 열흘~한 달
            안쪽이던 게시판을 모두 채웠습니다.
          ★ 만들면서 <b>주제가 겹친 네 개를 찾아 갈아 끼웠습니다</b> —
            제목은 달랐는데 내용이 같았습니다(좌석·오페라 줄거리·
            아이 악기 시작·공개 리허설). 제목만 대조하면 놓칩니다.
          ★ 2026-08-12 · <b>남은 양을 SQL 로 세어 보고</b> 바닥난 곳부터
            채웠습니다. 그때 상태 —
              지식나눔  담긴 것 114 · 풀 52 → <b>이미 바닥</b> (매일 도는 게시판)
              뉴스      담긴 것  12 · 풀 14 → 남은 것 <b>2개</b>
              입시커뮤니티 10 · 핫토픽 18 · 유틸리티 9
              현대음악 8 · 태교음악 8 (이 셋은 weekly 라 천천히 줄어듭니다)
          ★ 파트너 요청으로 <b>내용을 더 충실하게</b> 썼습니다 —
            지식나눔 답변 총량 글당 평균 667자(예전 300자 안팎)
            뉴스 본문 평균 677자 · 문단 7개(예전 5~7문단)
          ★ 사진은 넣지 않았습니다. 아래 「사진」 항목과 같은 까닭입니다.

   ★ 사진 게시판(gallery)은 아직 넣지 않았습니다.
     requireThumb 설정 때문에 그림 주소가 있어야 올라가는데,
     함부로 쓸 수 없는 사진을 붙이면 저작권 문제가 됩니다.
     정식으로 쓸 수 있는 사진이 준비되면 그때 pool/gallery.mjs 를
     만들어 아래 두 줄만 더하면 됩니다.
   ============================================================ */

import { HOTTOPIC } from './pool/hottopic.mjs';
import { ADMISSION } from './pool/admission.mjs';
import { QNA } from './pool/qna.mjs';
import { HOTTOPIC2 } from './pool/hottopic-2.mjs';
import { ADMISSION2 } from './pool/admission-2.mjs';
import { QNA2 } from './pool/qna-2.mjs';
import { HOTTOPIC3 } from './pool/hottopic-3.mjs';
import { ADMISSION3 } from './pool/admission-3.mjs';
import { QNA3 } from './pool/qna-3.mjs';
import { NEWS } from './pool/news.mjs';
import { MODERN } from './pool/modern.mjs';
import { PRENATAL } from './pool/prenatal.mjs';
import { UTILITY } from './pool/utility.mjs';
import { UTILITY2 } from './pool/utility-2.mjs';
import { NEWS2 } from './pool/news-2.mjs';
import { QNA4 } from './pool/qna-4.mjs';
import { ADMISSION4 } from './pool/admission-4.mjs';
import { HOTTOPIC4 } from './pool/hottopic-4.mjs';
import { MODERN2 } from './pool/modern-2.mjs';
import { PRENATAL2 } from './pool/prenatal-2.mjs';
import { QNA5 } from './pool/qna-5.mjs';
import { NEWS3 } from './pool/news-3.mjs';
import { ADMISSION5 } from './pool/admission-5.mjs';
import { HOTTOPIC5 } from './pool/hottopic-5.mjs';
import { MODERN3 } from './pool/modern-3.mjs';
import { PRENATAL3 } from './pool/prenatal-3.mjs';
import { UTILITY3 } from './pool/utility-3.mjs';
// 사진 준비 뒤: import { GALLERY } from './pool/gallery.mjs';

/* 일반 게시판용 닉네임 풀 (글에 author 가 지정돼 있으면 그것을 씁니다)
   ※ 지식나눔은 닉네임 규칙이 달라서(음악용어+숫자) 글마다 직접 지정해 뒀습니다 */
export const AUTHORS = [
  '예당러버', '새벽연습', '브람스밤', '실황중독', '늦깎이피아노', '실내악좋아',
  '현의노래', '노부부의음악회', '첼로켜는날', '연습벌레', '무대위에서', '비올라비올라',
  '두아이맘', '앙상블리더', '타건의맛', '목관사랑', '악보수집가', '로만티스트',
  '음악하는지민', '드레스코드', '앙코르요정', '기립박수', '입시맘', '입문가이드',
  '저녁여덟시', '시험날아침', '스물한살', '선곡고민', '남행열차', '청음노트',
  '취소표사냥', '오페라입문', '중고악기', '연습일지', '마흔에성악', '손끝의떨림',
  '갈림길에서', '지휘봉', '온라인레슨', '예고맘', '돌아온사람', '일반고에서',
  '목소리찾기', '작곡전공자', '초보선생',
];

export const POOL = {
  authors: AUTHORS,
  posts: [
    ...HOTTOPIC,
    ...ADMISSION,
    ...QNA,
    ...HOTTOPIC2,
    ...ADMISSION2,
    ...QNA2,
    ...HOTTOPIC3,
    ...ADMISSION3,
    ...QNA3,
    ...NEWS,
    ...MODERN,
    ...PRENATAL,
    ...UTILITY,
    ...UTILITY2,
    ...NEWS2,
    ...QNA4,
    ...ADMISSION4,
    ...HOTTOPIC4,
    ...MODERN2,
    ...PRENATAL2,
    ...QNA5,
    ...NEWS3,
    ...ADMISSION5,
    ...HOTTOPIC5,
    ...MODERN3,
    ...PRENATAL3,
    ...UTILITY3,
    // ...GALLERY,
  ],
};
