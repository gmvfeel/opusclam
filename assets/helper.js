/* ════════════════════════════════════════════════════════════════
   OPUSCLAM · 도우미            assets/helper.js
   2026-08-20
   ────────────────────────────────────────────────────────────────

   ★ 무엇을 하나
     화면 오른쪽 아래 단추. 누르면 물어볼 수 있습니다.
       ① 정해진 답 — 「탈퇴하고 싶어요」·「Linked가 뭐예요」 같은 것
       ② 우리 DB 찾기 — 「베토벤」 하면 인물·작품·공연장에서 찾아 줍니다
       ③ 그래도 없으면 — 통합검색과 메일 문의로 넘깁니다

   ★ 왜 AI 를 붙이지 않았나 (파트너와 정한 것 · 2026-08-20)
     · <b>월 비용이 듭니다.</b> 예산이 0인 지금과 맞지 않습니다
     · 누가 반복 호출하면 요금이 그대로 나갑니다
     · ★ 가장 큰 까닭 — <b>틀린 말을 자연스럽게 합니다.</b> 「베토벤
       교향곡 10번」 같은 답을 하면 <b>DB 전체의 신뢰가 깎입니다.</b>
       우리는 정보를 파는 곳이라 그 값이 편의보다 큽니다.
     ▶ 그래서 <b>지어내지 않는</b> 도우미로 만들었습니다. 모르면
       모른다고 하고 사람에게 넘깁니다.
     ★ 나중에 AI 를 얹더라도 이 뼈대를 그대로 씁니다.

   ★ 어디에 실리나
     assets/app.js 의 OC_ENGINES 가 실어 줍니다. app.js 는 122개
     화면에 이미 실려 있으므로 <b>한 곳만 고치면 전부</b> 됩니다.
     관리자 화면(/admin/)에는 싣지 않습니다.

   ★ 자리 — 「맨 위로」 단추(right:24px bottom:24px · 46px)가 이미
     있어서 그 <b>위</b>에 놓습니다. 겹치면 둘 다 못 누릅니다.

   ★ 아무것도 보내지 않습니다 — 물어본 말을 우리 서버에 남기지
     않습니다. DB 를 찾을 때만 그 낱말이 조회에 쓰입니다.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.OCHelper) return;
  if (location.pathname.indexOf('/admin/') === 0) return;

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H   = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  var MAIL = 'cser@wixon.co.kr';

  /* ══════════════════════════════════════════════════════════════
     정해진 답
     ★ 낱말은 <b>띈 자리를 뗀 뒤</b> 견줍니다 — 「회원 가입」과
       「회원가입」이 같게 걸리도록.
     ★ 답에는 <b>반드시 갈 곳</b>을 함께 둡니다. 말만 해 주고 끝내면
       「그래서 어디로?」 가 됩니다.
     ══════════════════════════════════════════════════════════════ */
  var ASK = [
    { k: ['회원가입','가입하고','가입방법','가입하려','어떻게가입','계정만들'],
      a: '회원 종류가 <b>네 가지</b>예요. 전공자 · 음악관계자 및 단체·기업 · '
       + '음악학교 · 일반이요. 일반 회원은 <b>바로</b> 쓸 수 있고, 앞의 셋은 '
       + '관리자가 자격을 한 번 확인해요.',
      l: [['회원가입 하러 가기','/account/join.html'],
          ['회원 종류 자세히','/guide.html#join']] },

    { k: ['로그인안','로그인이안','로그인못','접속안','로그인실패'],
      a: '아이디나 비밀번호가 맞는지 먼저 봐 주세요. 카카오·구글로 가입하셨다면 '
       + '그 단추로 들어가셔야 해요. 그래도 안 되면 메일로 알려 주세요.',
      l: [['아이디 찾기','/account/find-id.html'],
          ['비밀번호 찾기','/account/find-pw.html'],
          ['메일로 문의','mailto:' + MAIL]] },

    { k: ['비밀번호','패스워드','암호'],
      a: '비밀번호를 잊으셨으면 찾기로, 바꾸시려면 회원정보에서 하실 수 있어요.',
      l: [['비밀번호 찾기','/account/find-pw.html'],
          ['비밀번호 바꾸기','/account/change-password.html']] },

    { k: ['아이디찾','아이디잊','아이디를모'],
      a: '가입할 때 넣으신 정보로 찾으실 수 있어요.',
      l: [['아이디 찾기','/account/find-id.html']] },

    { k: ['탈퇴','계정삭제','회원삭제','그만쓰'],
      a: '탈퇴하면 로그인과 서비스 이용이 중단돼요. 등록·보강해 주신 자료는 '
       + '서비스 운영을 위해 보관될 수 있어요. <b>다시 가입</b>하고 싶으시면 '
       + '메일로 알려 주세요.',
      l: [['탈퇴 화면','/account/withdraw.html'],['메일로 문의','mailto:' + MAIL]] },

    { k: ['심사','승인','언제승인','대기','자격'],
      a: '전공자·음악관계자·음악학교 회원은 관리자가 하나씩 확인해요. 며칠 걸릴 '
       + '수 있어요. <b>승인 전에도 로그인과 자료 열람은 됩니다</b> — 등록·보강만 '
       + '승인 뒤에 열려요.',
      l: [['자세히 보기','/guide.html#join'],['오래 걸리면 문의','mailto:' + MAIL]] },

    { k: ['회원종류','종류변경','등급변경','전공자로','일반에서'],
      a: '회원 종류는 스스로 바꿀 수 없어요. 등록 권한과 이어져 있어서예요. '
       + '바꿔야 할 사정이 있으면 메일로 알려 주세요.',
      l: [['메일로 문의','mailto:' + MAIL]] },

    { k: ['linked','링크드','인맥','친구','이어지'],
      a: '<b>Linked</b>는 회원끼리 이어 두는 기능이에요. <b>양쪽이 승낙</b>해야 '
       + '이어지고, 이어지면 <b>쪽지</b>를 주고받을 수 있어요. 마이페이지 '
       + 'Linked 탭에서 <b>아이디로 찾아</b> 청하시거나, 글쓴이 이름 옆 '
       + '「+ Linked」를 누르세요.',
      l: [['Linked 자세히','/guide.html#linked'],['마이페이지','/account/mypage.html']] },

    { k: ['쪽지','메시지','메세지','디엠','dm'],
      a: '쪽지는 <b>Linked 로 이어진 회원과만</b> 주고받아요. 그래서 모르는 '
       + '사람의 광고가 오지 않아요. 마이페이지 <b>「쪽지」</b> 탭에서 보시고, '
       + 'Linked 탭의 이어진 줄에서 <b>「쪽지」</b> 단추로 시작해요.',
      l: [['쪽지 탭 열기','/account/mypage.html#msg'],
          ['자세히 보기','/guide.html#linked']] },

    { k: ['차단','신고','괴롭','스팸','광고쪽지','불편한사람'],
      a: '쪽지 대화 위쪽에 <b>신고</b>와 <b>차단</b>이 있어요. 차단하면 이어짐도 '
       + '함께 끊어지고 서로 쪽지를 주고받을 수 없어요. 상대는 <b>30일 동안</b> '
       + '다시 청할 수 없어요.',
      l: [['자세히 보기','/guide.html#linked'],['관리자에게 메일','mailto:' + MAIL]] },

    { k: ['즐겨찾기','킵','저장함','담아','북마크','스크랩'],
      a: '상세 화면 위쪽 <b>즐겨찾기</b>는 「계속 보러 올 것」, <b>킵</b>은 '
       + '「나중에 볼 것」이에요. 담은 것은 마이페이지 <b>저장함</b>에서 두 줄로 '
       + '나뉘어 보여요.',
      l: [['저장함 열기','/account/mypage.html#saved'],
          ['자세히 보기','/guide.html#member']] },

    { k: ['등급','포인트','활동점수','레벨','clamer'],
      a: '글쓰기·댓글·추천받기·DB보강으로 <b>활동점수</b>가 쌓이고 그게 등급을 '
       + '정해요. <b>쓸포인트</b>는 유료 서비스에 쓰는 것이고, <b>써도 등급은 '
       + '내려가지 않아요.</b> 매일 로그인해도 조금씩 쌓여요.',
      l: [['내 등급 보기','/account/mypage.html#activity'],
          ['자세히 보기','/guide.html#member']] },

    { k: ['틀렸','잘못된','오류','수정','고쳐','db보강','보강','정정'],
      a: '알려 주시면 정말 고맙습니다. 상세 화면 아래 <b>「DB보강하기」</b>(자격 '
       + '회원)나 <b>「메일문의하기」</b>(누구나)로 알려 주세요. <b>어느 화면인지 '
       + '주소를 함께</b> 주시면 훨씬 빨라요.',
      l: [['자세히 보기','/guide.html#wrong'],['메일로 알리기','mailto:' + MAIL]] },

    { k: ['본인','제가맞','인증','공식인증','관계자이신'],
      a: '인물·공연장·음악학교·단체 상세 화면에서 <b>「이 분이 본인이신가요」</b> '
       + '또는 <b>「관계자이신가요」</b>를 누르면 인증을 신청하실 수 있어요. '
       + '확인되면 <b>공식 인증</b> 표시가 붙고 내용을 직접 고치실 수 있어요.',
      l: [['자세히 보기','/guide.html#member']] },

    { k: ['공연','연주회','티켓','예매','공연일정'],
      a: '클래식 공연 일정은 <b>정보SPOT</b>의 공연정보에 모아 두었어요. '
       + '대문 큰 화면에 돌아가는 공연도 여기서 뽑아 와요.',
      l: [['공연정보 보기','/spot/concert.html'],['페스티벌','/spot/festival.html']] },

    { k: ['콩쿨','콩쿠르','대회','입상','수상'],
      a: '접수 중인 콩쿨은 <b>콩쿨정보</b>에, 쇼팽·차이콥스키처럼 이름 있는 '
       + '국제 콩쿨의 <b>역대 입상자</b>는 <b>국제 콩쿨 아카이브</b>에 있어요.',
      l: [['콩쿨정보','/spot/concours.html'],
          ['국제 콩쿨 아카이브','/spot/concours-archive.html']] },

    { k: ['지원금','정책자금','펀딩','보조금','후원'],
      a: '연주자·단체가 신청할 수 있는 지원 사업을 모아 두었어요.',
      l: [['지원금 · 정책자금','/spot/funding.html'],
          ['관련기관 · 재단 DB','/db/foundation.html']] },

    { k: ['악보','스코어','imslp','파트보'],
      a: '악기·편성별 악보는 <b>분야별 악보</b>에 있어요. 작품 상세 화면에서는 '
       + '<b>IMSLP</b> 악보로 바로 이어져요.',
      l: [['분야별 악보','/spot/score.html'],['작품 DB','/db/work.html']] },

    { k: ['레슨','배우','가르치','마스터클래스','인스트럭터','과외'],
      a: '<b>레슨:ON</b>에 마스터클래스·공개레슨·1:1·그룹레슨이 있어요. '
       + '가르치실 분은 <b>인스트럭터 신청</b>을 하시면 돼요.',
      l: [['레슨:ON','/lesson/index.html'],
          ['인스트럭터 신청','/lesson/instructor-apply.html']] },

    { k: ['채용','구인','일자리','취업','오디션','모집'],
      a: '단체·기업·학교가 올린 자리는 <b>채용정보</b>에, 연주자·전공자가 스스로 '
       + '알리는 곳은 <b>인재정보</b>예요.',
      l: [['채용정보','/recruit/job.html'],['인재정보','/recruit/talent.html'],
          ['서비스안내','/recruit/guide.html']] },

    { k: ['광고','배너광고','광고문의','홍보하고'],
      a: '광고 자리와 안내를 정리해 두었어요.',
      l: [['광고안내','/advertise.html']] },

    { k: ['입점','쇼핑','판매','shopping'],
      a: 'SHOPPING 은 준비 중이고, 지금은 <b>입점 문의</b>를 받고 있어요.',
      l: [['입점문의 · 안내','/shop/apply.html']] },

    { k: ['어둡게','다크','눈부','밝기','테마'],
      a: '오른쪽 위 <b>반달 모양 단추</b>를 누르면 어두운 화면으로 바뀌어요. '
       + '고른 것은 다음에 오실 때도 그대로 남아요.',
      l: [] },

    { k: ['앱','설치','홈화면','바로가기','pwa'],
      a: '따로 앱은 없지만, 브라우저의 <b>「홈 화면에 추가」</b>를 누르시면 '
       + '앱처럼 쓰실 수 있어요.',
      l: [] },

    { k: ['연표','음악사','시대','바로크','고전','낭만','낭만주의'],
      a: '<b>음악사 연표</b>에서 시대를 따라 훑어보실 수 있어요. 한국 클래식 '
       + '연표도 따로 있어요.',
      l: [['음악사 연표','/db/timeline.html']] },

    { k: ['용어','뜻이','무슨말','알레그로','다카포','약어'],
      a: '악보에 나오는 이탈리아어·독일어 용어는 <b>음악 용어사전</b>에 뜻과 '
       + '읽는 법을 적어 두었어요.',
      l: [['음악 용어사전','/db/terms.html']] },

    { k: ['퍼가','복사','저작권','크롤','수집','인용'],
      a: '개인적으로 찾아보고 참고하시는 건 괜찮아요. 다만 <b>자료를 대량으로 '
       + '긁어 가거나 그대로 옮겨 서비스를 만드시는 것</b>은 안 돼요.',
      l: [['데이터 정책','/legal/data-policy.html'],
          ['데이터 무단수집 금지','/legal/data-protection.html']] },

    { k: ['개인정보','정보보호','약관','정책'],
      a: '약관과 개인정보 처리방침, 데이터 정책을 한 화면에 모아 두었어요.',
      l: [['약관 · 정책','/legal/terms.html']] },

    { k: ['연락처','전화','전화번호','메일','문의','고객센터','상담'],
      a: '사람이 봐야 하는 일은 메일로 보내 주세요. 하나씩 다 읽어요. '
       + '<b>어느 화면인지(주소)</b>와 <b>쓰시는 아이디</b>를 함께 적어 주시면 '
       + '훨씬 빨라요.',
      l: [['메일 보내기','mailto:' + MAIL],['이용안내','/guide.html#ask']] },

    { k: ['어떤곳','뭐하는','소개','오퍼스클램이','무엇을할수'],
      a: '오퍼스클램은 <b>클래식 음악 한 분야만</b> 다루는 데이터베이스예요. '
       + '연주자·작곡가·작품·공연장·음악학교·음악단체·콩쿨·공연 정보를 모아 두고 '
       + '<b>서로 이어</b> 두었어요.',
      l: [['이용안내 처음부터','/guide.html'],['DATABASE','/db/index.html']] },

    { k: ['사용법','어떻게써','어디서찾','도움','가이드','이용안내','메뉴얼','매뉴얼'],
      a: '<b>이용안내</b>에 하나하나 적어 두었어요. 목차만 훑어도 어디서 무엇을 '
       + '찾을 수 있는지 보여요.',
      l: [['이용안내 보기','/guide.html']] }
  ];

  /* 인사 — 답이 아니라 말을 받아 주는 것입니다 */
  var HI  = ['안녕','하이','헬로','hello','hi','반가'];
  var THX = ['고마','감사','ㄱㅅ','thanks','thank'];

  /* ══════════════════════════════════════════════════════════════
     DB 찾기 — 정해진 답에 안 걸릴 때
     ★ 표마다 이름 칸이 다릅니다. 짐작하지 않고 <b>여기 적은 것</b>만
       씁니다 (assets/mentions.js 의 TO_META 와 같은 짜임입니다).
     ══════════════════════════════════════════════════════════════ */
  var FIND = [
    { t:'persons',          cols:['name_ko','name_en'],  view:'/db/person-view.html',     label:'인물' },
    /* ★ by : <b>만든 사람</b> 칸입니다. 작품만 있습니다 —
       「베토벤 교향곡 5번」 처럼 작곡가와 제목을 붙여 묻기 때문입니다. */
    { t:'person_works',     cols:['title_ko','title'],   view:'/db/work-view.html',       label:'작품',
      by:['composer_ko','composer_en'] },
    { t:'venues',           cols:['name_ko','name_en'],  view:'/db/venue-view.html',      label:'공연장' },
    { t:'schools',          cols:['name_ko','name_en'],  view:'/db/school-view.html',     label:'음악학교' },
    { t:'orgs',             cols:['name_ko','name_en'],  view:'/db/org-view.html',        label:'음악단체' },
    { t:'oc_terms',         cols:['term_ko','term_en'],  view:'/db/terms-view.html',      label:'음악용어' },
    { t:'modern_composers', cols:['name_ko','name_en'],  view:'/db/modern-view.html',     label:'현대음악' }
  ];

  /* ── 잔손 ─────────────────────────────────────────────────── */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  /* 견주기용으로 다듬습니다 — 띈 자리·물음표·마침표를 뗍니다 */
  function flat(s) {
    return String(s || '').toLowerCase().replace(/[\s?!.,·…~"'’]/g, '');
  }
  /* 조회에 쓸 낱말 — or() 짜임을 깨는 글자를 뗍니다 */
  function safe(s) {
    return String(s || '').replace(/[(),*%]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function pick(q) {
    var f = flat(q), best = null, score = 0;
    for (var i = 0; i < ASK.length; i++) {
      var n = 0;
      for (var j = 0; j < ASK[i].k.length; j++) {
        if (f.indexOf(flat(ASK[i].k[j])) >= 0) n += ASK[i].k[j].length;
      }
      if (n > score) { score = n; best = ASK[i]; }
    }
    return best;
  }

  /* ★★ 2026-08-20 · 「베토벤 교향곡 5번」 을 못 찾았습니다 (파트너 지적) ★★
     ─────────────────────────────────────────────────────────────────
     ★ 왜 못 찾았나
       물어본 말을 <b>통째로</b> 찾았습니다. 그런데 우리 표에는
       작품 제목이 「교향곡 5번」 이고 작곡가는 <b>다른 칸</b>에 있습니다.
       「베토벤 교향곡 5번」 이라는 글자는 어느 칸에도 없습니다.
       ▶ 사람은 <b>작곡가 + 작품</b>을 붙여서 묻습니다. 그렇게 찾아야 합니다.

     ★ 세 번에 걸쳐 찾습니다
       ① 통째로 — 「겨울 나그네」 처럼 한 덩이 이름
       ② 갈라서 — 「베토벤」 + 「교향곡 5번」 (작곡가 칸과 제목 칸을 함께)
                  앞을 작곡가로 본 것과 뒤를 작곡가로 본 것, 두 가지
       ③ 가장 긴 낱말 하나로 — 그다음 나머지 낱말이 들어 있는 줄을 앞에
       ★ 앞 단계에서 찾으면 뒤는 하지 않습니다. 없을 때만 넓혀 갑니다.

     ★ 「베토벤의」 처럼 토씨가 붙으면 못 걸립니다. 흔한 토씨는 뗍니다. */
  var JOSA = ['으로','로서','에서','에게','까지','부터','이랑','하고',
              '의','은','는','이','가','을','를','에','도','와','과','랑'];
  function stem(w) {
    for (var i = 0; i < JOSA.length; i++) {
      var j = JOSA[i];
      if (w.length > j.length + 1 && w.slice(-j.length) === j) return w.slice(0, -j.length);
    }
    return w;
  }
  function words(q) {
    return safe(q).split(' ').map(stem).filter(function (w) { return w.length >= 1; });
  }

  function rowsOf(d, rows, extra) {
    return (Array.isArray(rows) ? rows : []).map(function (o) {
      var nm = '';
      for (var i = 0; i < d.cols.length; i++) {
        if (o[d.cols[i]] && String(o[d.cols[i]]).trim()) { nm = o[d.cols[i]]; break; }
      }
      var by = d.by ? (o[d.by[0]] || o[d.by[1]] || '') : '';
      return { label: d.label, name: nm || ('#' + o.id), by: by,
               text: (nm + ' ' + by).toLowerCase(),
               href: d.view + '?id=' + encodeURIComponent(o.id) };
    }).concat(extra || []);
  }

  function get(url) {
    return fetch(url, { headers: H })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }
  function ors(cols, w) {
    return cols.map(function (c) {
      return c + '.ilike.*' + encodeURIComponent(w) + '*';
    }).join(',');
  }
  function sel(d) {
    return 'select=id,' + d.cols.join(',') + (d.by ? ',' + d.by.join(',') : '');
  }

  /* ① 통째로 */
  async function findWhole(w) {
    var all = await Promise.all(FIND.map(function (d) {
      return get(SB + '/rest/v1/' + d.t + '?' + sel(d)
                 + '&or=(' + ors(d.cols, w) + ')&limit=3')
        .then(function (rows) { return rowsOf(d, rows); });
    }));
    return all.reduce(function (a, b) { return a.concat(b); }, []);
  }

  /* ② 작곡가 + 작품 — 사람은 이렇게 묻습니다 */
  async function findByMaker(ws) {
    var d = FIND.filter(function (x) { return x.t === 'person_works'; })[0];
    if (!d || ws.length < 2) return [];
    var tries = [
      { who: ws[0],              what: ws.slice(1).join(' ') },
      { who: ws[ws.length - 1],  what: ws.slice(0, -1).join(' ') }
    ];
    var all = await Promise.all(tries.map(function (x) {
      if (!x.who || !x.what) return [];
      var url = SB + '/rest/v1/' + d.t + '?' + sel(d)
        + '&and=(or(' + ors(d.by, x.who) + '),or(' + ors(d.cols, x.what) + '))'
        + '&limit=4';
      return get(url).then(function (rows) { return rowsOf(d, rows); });
    }));
    return all.reduce(function (a, b) { return a.concat(b); }, []);
  }

  /* ③ 가장 긴 낱말 하나로 넓혀 찾고, 나머지 낱말이 든 줄을 앞으로 */
  async function findLoose(ws) {
    var long = ws.slice().sort(function (a, b) { return b.length - a.length; })[0];
    if (!long || long.length < 2) return [];
    var rest = ws.filter(function (w) { return w !== long && w.length >= 2; })
                 .map(function (w) { return w.toLowerCase(); });
    var all = await Promise.all(FIND.map(function (d) {
      var cols = d.cols.concat(d.by || []);
      return get(SB + '/rest/v1/' + d.t + '?' + sel(d)
                 + '&or=(' + ors(cols, long) + ')&limit=8')
        .then(function (rows) { return rowsOf(d, rows); });
    }));
    var flat2 = all.reduce(function (a, b) { return a.concat(b); }, []);
    /* 나머지 낱말이 많이 든 줄부터 — 없으면 그냥 순서대로 */
    flat2.forEach(function (r) {
      r.hit = rest.filter(function (w) { return r.text.indexOf(w) >= 0; }).length;
    });
    flat2.sort(function (a, b) { return b.hit - a.hit; });
    return flat2;
  }

  function dedupe(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      if (seen[list[i].href]) continue;
      seen[list[i].href] = 1;
      out.push(list[i]);
    }
    return out;
  }

  async function findInDb(q) {
    var w = safe(q);
    if (w.length < 2) return [];
    var ws = words(q);

    var hit = dedupe(await findWhole(w));
    if (hit.length) return hit.slice(0, 8);

    if (ws.length >= 2) {
      hit = dedupe(await findByMaker(ws));
      if (hit.length) return hit.slice(0, 8);

      hit = dedupe(await findLoose(ws));
      /* 나머지 낱말이 하나도 안 걸린 것만 남았으면 <b>버립니다</b> —
         「베토벤 교향곡 5번」 에 엉뚱한 베토벤 작품 여덟 개를 내놓는 것보다
         「못 찾았다」 가 정직합니다. */
      var good = hit.filter(function (r) { return r.hit > 0; });
      if (good.length) return good.slice(0, 8);
      if (ws.length === 1) return hit.slice(0, 8);
      return [];
    }
    return [];
  }

  /* ══════════════════════════════════════════════════════════════
     모양
     ══════════════════════════════════════════════════════════════ */
  function css() {
    if (document.getElementById('ocHelpCss')) return;
    var s = document.createElement('style');
    s.id = 'ocHelpCss';
    s.textContent = [
      /* ★★ 2026-08-20 · 모바일에서 세 가지가 겹쳤습니다 (파트너 지적) ★★
         ─────────────────────────────────────────────────────────────
         ① <b>하단 띠</b>(assets/tabbar.js · 68px · 880px 아래에서 보임)를
            제가 몰랐습니다. 상자 아래쪽(입력칸)이 그 띠에 가려 있었습니다.
         ② <b>자판</b>이 올라오면 입력칸이 그 아래로 숨습니다. 화면 높이는
            그대로인데 보이는 자리만 줄기 때문에, 아래에 붙여 둔 것은
            자판 뒤로 들어갑니다.
         ③ 좁은 화면에서 도우미 단추가 「맨 위로」 단추와 자리를 다툽니다.

         ▶ 고친 방법
           · --ocH-bar : 하단 띠 높이만큼 모두 위로 올립니다
           · --ocH-kb  : 자판이 가린 높이만큼 상자를 더 올립니다
                         (아래 fitKb() 가 visualViewport 로 재서 넣습니다)
           · 좁은 화면에서는 도우미 단추를 <b>왼쪽</b>으로 보냅니다 —
             「맨 위로」는 오른쪽이니 서로 안 부딪칩니다. */
      ':root{--ocH-bar:0px;--ocH-kb:0px}',
      '@media (max-width:880px){:root{--ocH-bar:calc(68px + env(safe-area-inset-bottom,0px))}}',

      /* 단추 — 「맨 위로」(bottom:24px · 46px) 위에 놓습니다 */
      '.ocH-btn{position:fixed;right:24px;bottom:calc(82px + var(--ocH-bar));z-index:70;height:46px;',
      ' padding:0 17px 0 14px;border:0;border-radius:99px;cursor:pointer;',
      ' background:var(--ink,#2b2740);color:#fff;font-family:inherit;font-size:13.5px;',
      ' font-weight:700;display:flex;align-items:center;gap:8px;',
      ' box-shadow:0 10px 26px -8px rgba(20,18,40,.45);transition:filter .15s,transform .15s}',
      '.ocH-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}',
      '.ocH-btn svg{width:18px;height:18px;flex:0 0 auto}',
      '.ocH-btn.hide{display:none}',

      /* 상자 */
      '.ocH{position:fixed;right:24px;z-index:71;width:372px;max-width:calc(100vw - 32px);',
      ' bottom:calc(82px + var(--ocH-bar) + var(--ocH-kb));',
      ' background:var(--paper,#fff);border:1px solid var(--line,#e6e6ee);border-radius:16px;',
      ' box-shadow:0 24px 60px -14px rgba(20,18,40,.4);display:none;',
      ' flex-direction:column;overflow:hidden;font-family:inherit}',
      '.ocH.on{display:flex}',
      '.ocH-top{padding:15px 17px;border-bottom:1px solid var(--line,#e6e6ee);',
      ' display:flex;align-items:flex-start;gap:10px}',
      '.ocH-top .tt{flex:1 1 auto;min-width:0}',
      '.ocH-top .tt b{display:block;font-size:14.5px;font-weight:800}',
      '.ocH-top .tt span{display:block;font-size:11.5px;line-height:1.6;color:var(--text-3,#8b87a0);',
      ' margin-top:3px}',
      '.ocH-x{flex:0 0 auto;width:28px;height:28px;border:0;border-radius:8px;cursor:pointer;',
      ' background:transparent;color:var(--text-3,#8b87a0);font-size:19px;line-height:1}',
      '.ocH-x:hover{background:var(--paper-2,#f2f0f7);color:var(--text,#2b2740)}',

      '.ocH-log{padding:15px 17px;overflow-y:auto;max-height:min(52vh,420px);',
      ' display:flex;flex-direction:column;gap:11px}',
      '.ocH-b{max-width:88%;padding:11px 13px;border-radius:13px;font-size:13.5px;',
      ' line-height:1.8;word-break:break-word}',
      '.ocH-b.me{align-self:flex-end;background:var(--ink,#2b2740);color:#fff;',
      ' border-bottom-right-radius:4px}',
      '.ocH-b.oc{align-self:flex-start;background:var(--paper-2,#f2f0f7);',
      ' border-bottom-left-radius:4px}',
      '.ocH-b.oc b{font-weight:700}',
      '.ocH-go{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}',
      '.ocH-go a{display:inline-block;padding:7px 12px;border-radius:8px;font-size:12.5px;',
      ' font-weight:700;text-decoration:none;background:var(--paper,#fff);',
      ' border:1px solid var(--line,#e6e6ee);color:var(--violet-2,#5b4b9e)}',
      '.ocH-go a:hover{border-color:var(--violet-2,#5b4b9e)}',
      '.ocH-hit{display:block;padding:9px 12px;border-radius:9px;text-decoration:none;',
      ' border:1px solid var(--line,#e6e6ee);background:var(--paper,#fff);margin-top:6px}',
      '.ocH-hit .l{font-size:10.5px;font-weight:800;letter-spacing:.06em;',
      ' color:var(--text-3,#8b87a0);display:block}',
      '.ocH-hit .n{font-size:13.5px;font-weight:700;color:var(--text,#2b2740)}',
      '.ocH-hit:hover{border-color:var(--violet-2,#5b4b9e)}',

      '.ocH-chips{padding:0 17px 13px;display:flex;flex-wrap:wrap;gap:6px}',
      '.ocH-chips button{padding:7px 11px;border-radius:99px;cursor:pointer;font-family:inherit;',
      ' font-size:12.5px;border:1px solid var(--line,#e6e6ee);background:var(--paper,#fff);',
      ' color:var(--text-2,#5a5b74)}',
      '.ocH-chips button:hover{border-color:var(--violet-2,#5b4b9e);color:var(--violet-2,#5b4b9e)}',

      '.ocH-in{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--line,#e6e6ee)}',
      '.ocH-in input{flex:1 1 auto;min-width:0;height:38px;padding:0 12px;border-radius:9px;',
      ' border:1px solid var(--line,#e6e6ee);background:var(--paper,#fff);color:inherit;',
      ' font-family:inherit;font-size:13.5px}',
      '.ocH-in input:focus{outline:2px solid var(--violet-2,#5b4b9e);outline-offset:-1px}',
      '.ocH-in button{flex:0 0 auto;height:38px;padding:0 15px;border:0;border-radius:9px;',
      ' cursor:pointer;background:var(--ink,#2b2740);color:#fff;font-family:inherit;',
      ' font-size:13px;font-weight:700}',
      '.ocH-in button:hover{filter:brightness(1.15)}',

      '@media (max-width:560px){',
      /* ★ 도우미는 <b>왼쪽</b>으로 — 오른쪽에는 「맨 위로」가 있습니다 */
      ' .ocH-btn{left:16px;right:auto;bottom:calc(14px + var(--ocH-bar));',
      '  height:42px;padding:0 14px 0 12px;font-size:12.5px}',
      ' .ocH{right:8px;left:8px;width:auto;max-width:none;border-radius:14px;',
      '  bottom:calc(10px + var(--ocH-bar) + var(--ocH-kb))}',
      ' .ocH-log{max-height:38vh}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════
     자판이 가린 만큼 상자를 올립니다
     ★ 왜 이렇게 하나 — 자판이 올라와도 <b>window.innerHeight 는 그대로</b>
       입니다. 그래서 bottom 으로 붙여 둔 것은 자판 뒤로 들어갑니다.
       실제로 보이는 높이는 visualViewport 가 알려 줍니다.
     ★ 이걸 못 쓰는 브라우저에서는 아무 일도 하지 않습니다 —
       그때는 예전처럼 띠 위에만 올라가 있습니다.
     ══════════════════════════════════════════════════════════════ */
  function fitKb() {
    var vv = window.visualViewport;
    if (!vv) return;
    var hid = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    document.documentElement.style.setProperty('--ocH-kb', hid + 'px');
    /* 자판이 올라오면 대화 칸을 줄여 상자가 화면에 들어오게 합니다.
       ★ 200 은 상자에서 대화 칸을 뺀 나머지(머리·단추줄·입력줄)의 어림값입니다. */
    if (!log) return;
    if (hid > 120) log.style.maxHeight = Math.max(84, Math.round(vv.height - 240)) + 'px';
    else log.style.removeProperty('max-height');
  }

  /* ══════════════════════════════════════════════════════════════
     그리기
     ══════════════════════════════════════════════════════════════ */
  var box, log, btn, input;

  function say(who, html) {
    var d = document.createElement('div');
    d.className = 'ocH-b ' + who;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function links(list) {
    if (!list || !list.length) return '';
    return '<div class="ocH-go">' + list.map(function (x) {
      var out = x[1].indexOf('mailto:') === 0;
      return '<a href="' + esc(x[1]) + '"'
        + (out ? '' : '') + '>' + esc(x[0]) + '</a>';
    }).join('') + '</div>';
  }

  function hits(list) {
    return list.map(function (x) {
      return '<a class="ocH-hit" href="' + esc(x.href) + '">'
        + '<span class="l">' + esc(x.label)
        +   (x.by ? ' · ' + esc(x.by) : '') + '</span>'
        + '<span class="n">' + esc(x.name) + '</span></a>';
    }).join('');
  }

  async function answer(q) {
    say('me', esc(q));
    var f = flat(q);

    /* 인사는 받아 줍니다 — 답을 찾아 헤매지 않게 */
    for (var i = 0; i < HI.length; i++) if (f.indexOf(HI[i]) === 0) {
      say('oc', '안녕하세요! 무엇을 찾으시나요? 아래 단추를 누르셔도 되고, '
        + '사람 이름이나 작품 제목을 그냥 넣어 보셔도 돼요.');
      return;
    }
    for (var t = 0; t < THX.length; t++) if (f.indexOf(THX[t]) >= 0 && f.length < 12) {
      say('oc', '도움이 되었으면 좋겠어요. 더 궁금한 게 있으면 언제든지요.');
      return;
    }

    /* ① 정해진 답 */
    var m = pick(q);
    if (m) { say('oc', m.a + links(m.l)); return; }

    /* ② 우리 DB 에서 찾기 */
    var wait = say('oc', 'DB 에서 찾아볼게요…');
    var found = [];
    try { found = await findInDb(q); } catch (e) { found = []; }

    if (found.length) {
      wait.innerHTML = '<b>' + esc(q) + '</b> 로 찾은 것이에요.' + hits(found)
        + links([['통합검색에서 더 보기','/search.html?q=' + encodeURIComponent(q)]]);
      log.scrollTop = log.scrollHeight;
      return;
    }

    /* ③ 모르면 모른다고 합니다 */
    wait.innerHTML = '제가 아는 것으로는 못 찾았어요. 저는 <b>정해진 답과 '
      + '오퍼스클램 DB</b>만 찾을 수 있어서, 없는 것을 지어내지는 않아요.<br>'
      + '통합검색으로 찾아보시거나, 사람이 봐야 할 일이면 메일로 보내 주세요.'
      + links([['통합검색','/search.html?q=' + encodeURIComponent(q)],
               ['메일로 문의','mailto:' + MAIL],
               ['이용안내','/guide.html']]);
    log.scrollTop = log.scrollHeight;
  }

  function build() {
    css();

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ocH-btn';
    btn.setAttribute('aria-label', '도우미 열기');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"'
      + ' stroke-linecap="round" aria-hidden="true">'
      + '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z"/>'
      + '<path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3"/>'
      + '<path d="M12 16.6h.01"/></svg>도우미';
    document.body.appendChild(btn);

    box = document.createElement('div');
    box.className = 'ocH';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '오퍼스클램 도우미');
    box.innerHTML =
        '<div class="ocH-top"><div class="tt"><b>무엇을 찾으시나요?</b>'
      /* ★ 한 줄로 줄였습니다 — 처음엔 「AI 가 아니라서」 를 넣었더니
         좁은 상자에서 「아니 / 라서」 로 끊겨 읽기 나빴습니다. */
      + '<span>정해진 답과 오퍼스클램 DB에서 찾아 드려요.<br>'
      + '<b>없는 것을 지어내지 않아요.</b></span></div>'
      + '<button type="button" class="ocH-x" aria-label="닫기">×</button></div>'
      + '<div class="ocH-log" id="ocHLog"></div>'
      + '<div class="ocH-chips">'
      + '<button type="button">회원가입</button>'
      + '<button type="button">Linked가 뭐예요</button>'
      + '<button type="button">쪽지 보내는 법</button>'
      + '<button type="button">공연 정보</button>'
      + '<button type="button">잘못된 정보를 봤어요</button>'
      + '<button type="button">문의하기</button>'
      + '</div>'
      + '<div class="ocH-in">'
      + '<input type="text" id="ocHIn" autocomplete="off" maxlength="80"'
      + ' placeholder="사람 이름·작품 제목도 됩니다">'
      + '<button type="button" id="ocHGo">묻기</button></div>';
    document.body.appendChild(box);

    log = box.querySelector('#ocHLog');
    input = box.querySelector('#ocHIn');

    say('oc', '안녕하세요. 오퍼스클램 도우미예요.<br>'
      + '아래 단추를 누르시거나, 찾으시는 <b>사람 이름·작품 제목</b>을 그냥 '
      + '넣어 보세요.');

    btn.addEventListener('click', open);
    box.querySelector('.ocH-x').addEventListener('click', close);
    box.querySelector('#ocHGo').addEventListener('click', go);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); go(); }
    });
    box.querySelectorAll('.ocH-chips button').forEach(function (c) {
      c.addEventListener('click', function () { answer(c.textContent.trim()); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('on')) close();
    });

    /* 자판이 오르내릴 때마다 다시 잽니다 */
    var vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', fitKb);
      vv.addEventListener('scroll', fitKb);
    }
    input.addEventListener('focus', function () { setTimeout(fitKb, 250); });
    input.addEventListener('blur', function () { setTimeout(fitKb, 250); });
  }

  function go() {
    var q = (input.value || '').trim();
    if (!q) { input.focus(); return; }
    input.value = '';
    answer(q);
  }
  function open() {
    box.classList.add('on');
    btn.classList.add('hide');
    fitKb();
    /* ★ 좁은 화면에서는 <b>저절로 자판을 올리지 않습니다.</b>
       열자마자 자판이 화면 절반을 덮으면 단추도 안내도 안 보입니다.
       입력칸을 직접 누르실 때 올라오는 것이 자연스럽습니다. */
    if (window.innerWidth > 560)
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
  }
  function close() {
    box.classList.remove('on');
    btn.classList.remove('hide');
    document.documentElement.style.setProperty('--ocH-kb', '0px');
    if (log) log.style.removeProperty('max-height');
  }

  window.OCHelper = { open: open, close: close, ask: function (q) { open(); answer(q); } };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', build);
  else build();
})();
