/* ============================================================
   OPUSCLAM 자동 시드 콘텐츠 풀 — 인덱스
   ------------------------------------------------------------
   실제 글은 pool/ 폴더 안에 게시판별로 나뉘어 있습니다.
   새 게시판이 생기면 pool/ 에 파일 하나 추가하고
   아래에 import 한 줄, posts 에 한 줄만 넣으면 됩니다.
   ============================================================ */

import { HOTTOPIC } from './pool/hottopic.mjs';
import { ADMISSION } from './pool/admission.mjs';
import { QNA } from './pool/qna.mjs';
import { HOTTOPIC2 } from './pool/hottopic-2.mjs';
import { ADMISSION2 } from './pool/admission-2.mjs';
// 2차 예정: import { GALLERY } from './pool/gallery.mjs';
// 2차 예정: import { NEWS }    from './pool/news.mjs';

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
  '목소리찾기',
];

export const POOL = {
  authors: AUTHORS,
  posts: [
    ...HOTTOPIC,
    ...ADMISSION,
    ...QNA,
    ...HOTTOPIC2,
    ...ADMISSION2,
    // ...GALLERY,
    // ...NEWS,
  ],
};
