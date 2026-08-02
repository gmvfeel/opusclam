/* ============================================================
   OPUSCLAM 리쿠르트 공용 — assets/recruit.js

   무엇이 담겼나
    · 직종 분류 (오케스트라·합창단·입시레슨·연주단체·음악관련업체)
    · 지역 (시도 · 시군구)
    · 근무형태 · 급여 · 학력 · 우대조건 · 근무요일 · 근무시간
    · 목록·검색·등록 화면이 함께 쓰는 도우미 함수

   왜 한곳에 모으나
    같은 분류를 목록·상세·등록 세 화면에서 씁니다.
    화면마다 적어 두면 하나를 고칠 때 세 곳을 고쳐야 하고,
    빠뜨린 곳이 생깁니다. 그래서 여기 한곳만 고치면 모두 바뀌게 했습니다.

   쓰는 법
     <script src="/assets/recruit.js"></script>
     OCRecruit.fillJobCat1(el)          직종 1차를 셀렉트에 채웁니다
     OCRecruit.fillJobCat2(el, '오케스트라')  그 아래 2차를 채웁니다
     OCRecruit.fillRegion1(el)          시도를 채웁니다
     OCRecruit.fillRegion2(el, '서울')   그 시도의 시군구를 채웁니다
     OCRecruit.bindPair(sel1, sel2, 'job')   1차를 고르면 2차가 저절로 바뀝니다
   ============================================================ */
(function () {
  'use strict';

  /* ── 직종 분류 ────────────────────────────────────────────
     시안(01_채용정보)의 「직종구분」 표를 그대로 담았습니다. */
  var JOBS = {
    '오케스트라':   ['현악파트', '관악파트', '금관파트', '타악파트',
                     '정단원', '임시단원', '행정직', '지휘자'],
    '합창단':       ['소프라노', '알토', '테너', '베이스',
                     '정단원', '임시단원', '행정직', '지휘자', '반주자'],
    '입시레슨':     ['현악', '관악', '금관', '타악', '성악', '피아노',
                     '작곡/이론', '지휘', '기타'],
    '연주단체':     ['정단원', '임시단원', '행정직'],
    '음악관련업체': ['음악잡지기자', '음악신문기자', '연주기획자',
                     '판매/서비스직', '학원강사'],
  };

  /* ── 지역 ─────────────────────────────────────────────────
     구직·구인은 「어디서 일하는가」 가 중요하므로 시군구까지 둡니다. */
  var REGIONS = {
    '서울': ['강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
             '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
             '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'],
    '부산': ['강서구','금정구','기장군','남구','동구','동래구','부산진구','북구',
             '사상구','사하구','서구','수영구','연제구','영도구','중구','해운대구'],
    '대구': ['남구','달서구','달성군','동구','북구','서구','수성구','중구','군위군'],
    '인천': ['강화군','계양구','미추홀구','남동구','동구','부평구','서구','연수구','옹진군','중구'],
    '광주': ['광산구','남구','동구','북구','서구'],
    '대전': ['대덕구','동구','서구','유성구','중구'],
    '울산': ['남구','동구','북구','중구','울주군'],
    '세종': ['세종시'],
    '경기': ['가평군','고양시','과천시','광명시','광주시','구리시','군포시','김포시',
             '남양주시','동두천시','부천시','성남시','수원시','시흥시','안산시','안성시',
             '안양시','양주시','양평군','여주시','연천군','오산시','용인시','의왕시',
             '의정부시','이천시','파주시','평택시','포천시','하남시','화성시'],
    '강원': ['강릉시','고성군','동해시','삼척시','속초시','양구군','양양군','영월군',
             '원주시','인제군','정선군','철원군','춘천시','태백시','평창군','홍천군',
             '화천군','횡성군'],
    '충북': ['괴산군','단양군','보은군','영동군','옥천군','음성군','제천시','진천군',
             '청주시','충주시','증평군'],
    '충남': ['계룡시','공주시','금산군','논산시','당진시','보령시','부여군','서산시',
             '서천군','아산시','예산군','천안시','청양군','태안군','홍성군'],
    '전북': ['고창군','군산시','김제시','남원시','무주군','부안군','순창군','완주군',
             '익산시','임실군','장수군','전주시','정읍시','진안군'],
    '전남': ['강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시',
             '무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군',
             '장성군','장흥군','진도군','함평군','해남군','화순군'],
    '경북': ['경산시','경주시','고령군','구미시','김천시','문경시','봉화군','상주시',
             '성주군','안동시','영덕군','영양군','영주시','영천시','예천군','울릉군',
             '울진군','의성군','청도군','청송군','칠곡군','포항시'],
    '경남': ['거제시','거창군','고성군','김해시','남해군','밀양시','사천시','산청군',
             '양산시','의령군','진주시','창녕군','창원시','통영시','하동군','함안군',
             '함양군','합천군'],
    '제주': ['제주시','서귀포시'],
    '해외': ['미국','독일','오스트리아','프랑스','이탈리아','영국','러시아','일본',
             '중국','그 밖'],
  };

  /* ── 근무형태 ─────────────────────────────────────────────
     검색에 쓰는 것과 등록에 쓰는 것이 조금 다릅니다.
     검색은 큰 갈래만, 등록은 아르바이트·인턴까지 고를 수 있게 합니다. */
  var EMP_SEARCH = ['무관', '정규직', '계약직', '프리랜서', '개인레슨'];
  var EMP_TYPES  = ['정규직', '계약직', '프리랜서', '개인레슨', '아르바이트', '인턴', '병역특례'];

  /* ── 급여 ─────────────────────────────────────────────────*/
  var PAY_TYPES = ['협의', '연봉', '월급', '주급', '일급', '시급', '건당'];
  /* 검색에서 쓰는 급여 구간 */
  /* 풀다운 칸에 들어갈 만큼 짧게 적습니다.
     「2,000 ~ 2,400만원」 은 열다섯 자라 좁은 칸에서 잘립니다. */
  var PAY_BANDS = [
    { label: '급여별',          min: null, max: null },
    { label: '2000만원 미만',   min: 0,    max: 2000 },
    { label: '2000~2400만원',   min: 2000, max: 2400 },
    { label: '2400~2800만원',   min: 2400, max: 2800 },
    { label: '2800~3400만원',   min: 2800, max: 3400 },
    { label: '3400~3800만원',   min: 3400, max: 3800 },
    { label: '3800만원 이상',   min: 3800, max: null },
    { label: '회사내규·협의',   min: null, max: null },
  ];

  /* ── 학력 ─────────────────────────────────────────────────*/
  var EDU = ['학력무관', '고졸 이상', '전문대졸 이상', '대졸 이상',
             '석사 이상', '박사 이상'];

  /* ── 우대조건 ─────────────────────────────────────────────
     시안(03_채용등록)의 우대조건 체크 목록입니다. */
  var PREFER = [
    '국가유공자', '보훈대상', '고용촉진장려금대상', '장애인',
    '영어가능자', '일본어가능자', '중국어가능자', '독일어가능자',
    '프랑스어가능자', '스페인어가능자', '러시아어가능자',
    '국내외콩쿨입상자', '해외연수자', '프레젠테이션능력우수자',
    '컴퓨터활용능력우수자', '해외근무가능자', '병역특례',
    '엑셀고급능력보유자', '학점우수자',
  ];

  /* ── 근무요일·시간 ────────────────────────────────────────*/
  var WORK_DAYS = ['협의', '월~금', '월~토', '주 2일', '주 3일', '주 4일',
                   '주말(토·일)', '토요일', '일요일', '요일협의', '교대근무'];

  var HOURS = (function () {
    var out = ['협의'];
    for (var h = 6; h <= 23; h++) {
      out.push((h < 10 ? '0' : '') + h + ':00');
      out.push((h < 10 ? '0' : '') + h + ':30');
    }
    return out;
  })();

  /* ── 성별·현재상태·오디션·접수방법 ────────────────────────*/
  var GENDERS      = ['무관', '남성', '여성'];
  var NOW_STATUS   = ['구직중 (구직희망)', '재직중 (이직희망)'];
  var AUDITION     = ['없음 / 서류전형', '있음'];
  var APPLY_METHOD = ['이메일', '직접방문', '전화', '팩스', '당사홈페이지'];
  /* 정렬 — 마감이 가까운 것부터 보는 「마감순」 이 구직자에게 가장 쓸모 있습니다.
     마감일이 없는 것(상시모집)은 뒤로 갑니다(nullslast). */
  var SORTS = [
    { value: 'created_at.desc',        label: '최신순' },
    { value: 'apply_to.asc.nullslast', label: '마감순' },
    { value: 'view_count.desc',        label: '조회순' },
  ];

  /* ============================================================
     도우미 — 셀렉트를 채우고 서로 이어 줍니다
     ============================================================ */
  function opt(v, t) {
    var o = document.createElement('option');
    o.value = v; o.textContent = (t == null ? v : t);
    return o;
  }

  function fill(el, items, placeholder) {
    if (!el) return;
    el.innerHTML = '';
    if (placeholder) el.appendChild(opt('', placeholder));
    (items || []).forEach(function (x) {
      if (x && typeof x === 'object') el.appendChild(opt(x.value, x.label));
      else el.appendChild(opt(x));
    });
  }

  function fillJobCat1(el, placeholder) {
    fill(el, Object.keys(JOBS), placeholder || '1차직종선택');
  }
  function fillJobCat2(el, cat1, placeholder) {
    fill(el, JOBS[cat1] || [], placeholder || '2차직종선택');
  }
  function fillRegion1(el, placeholder) {
    fill(el, Object.keys(REGIONS), placeholder || '1차지역선택');
  }
  function fillRegion2(el, r1, placeholder) {
    fill(el, REGIONS[r1] || [], placeholder || '2차지역선택');
  }

  /* 1차를 고르면 2차가 저절로 바뀌게 이어 줍니다.
     kind 는 'job' 또는 'region' 입니다. */
  function bindPair(sel1, sel2, kind, placeholder1, placeholder2) {
    var a = typeof sel1 === 'string' ? document.querySelector(sel1) : sel1;
    var b = typeof sel2 === 'string' ? document.querySelector(sel2) : sel2;
    if (!a || !b) return;
    var isJob = (kind !== 'region');
    (isJob ? fillJobCat1 : fillRegion1)(a, placeholder1);
    (isJob ? fillJobCat2 : fillRegion2)(b, '', placeholder2);
    a.addEventListener('change', function () {
      (isJob ? fillJobCat2 : fillRegion2)(b, a.value, placeholder2);
    });
  }

  /* 체크 목록을 만듭니다 (근무형태·우대조건처럼 여럿 고르는 것) */
  function fillChecks(el, items, name) {
    if (!el) return;
    el.innerHTML = '';
    (items || []).forEach(function (x, i) {
      var id = name + '-' + i;
      var wrap = document.createElement('label');
      wrap.className = 'rc-check';
      wrap.setAttribute('for', id);
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = id; cb.name = name; cb.value = x;
      var sp = document.createElement('span');
      sp.textContent = x;
      wrap.appendChild(cb); wrap.appendChild(sp);
      el.appendChild(wrap);
    });
  }

  /* 체크된 것을 모읍니다 */
  function checked(scope, name) {
    var root = (typeof scope === 'string' ? document.querySelector(scope) : scope) || document;
    return [].slice.call(root.querySelectorAll('input[name="' + name + '"]:checked'))
             .map(function (x) { return x.value; });
  }

  /* 라디오 목록을 만듭니다 (성별처럼 하나만 고르는 것) */
  function fillRadios(el, items, name, checkedValue) {
    if (!el) return;
    el.innerHTML = '';
    (items || []).forEach(function (x, i) {
      var id = name + '-r' + i;
      var wrap = document.createElement('label');
      wrap.className = 'rc-check';
      wrap.setAttribute('for', id);
      var rb = document.createElement('input');
      rb.type = 'radio'; rb.id = id; rb.name = name; rb.value = x;
      if (x === checkedValue || (!checkedValue && i === 0)) rb.checked = true;
      var sp = document.createElement('span');
      sp.textContent = x;
      wrap.appendChild(rb); wrap.appendChild(sp);
      el.appendChild(wrap);
    });
  }

  /* ── 보여 줄 때 쓰는 도우미 ───────────────────────────────*/

  /* 「오케스트라 › 현악파트」 처럼 */
  function jobLabel(cat1, cat2, etc) {
    var a = [];
    if (cat1) a.push(cat1);
    if (cat2) a.push(cat2);
    var s = a.join(' › ');
    if (etc) s = s ? s + ' (' + etc + ')' : etc;
    return s;
  }

  /* 「서울 › 마포구」 처럼 */
  function regionLabel(r1, r2) {
    return [r1, r2].filter(Boolean).join(' › ');
  }

  /* 급여를 사람이 읽기 좋게 */
  function payLabel(type, amount, daily) {
    if (!type && !amount) return '';
    var s = '';
    if (type && type !== '협의') s = type;
    if (amount) s = s ? s + ' ' + amount : amount;
    if (!s) s = '협의';
    if (daily) s += ' · 당일지급';
    return s;
  }

  /* 접수기간을 두 줄로 나눕니다 — 표의 좁은 칸에 온전히 들어가게.
     「2026.08.01 ~ 2026.08.31」 은 스물한 자라 한 줄에 넣으면 잘립니다.
     같은 해면 마감 쪽 연도를 빼서 더 짧게 만듭니다.
       { top: '2026.08.01', bottom: '~ 08.31' }
     한 줄로 끝나는 것(상시모집 등)은 bottom 이 빕니다. */
  function applyLines(from, to, always, untilHired) {
    if (always) return { top: '상시모집', bottom: '' };
    if (untilHired) return { top: '채용시까지', bottom: '' };
    var d = function (v) { return String(v || '').slice(0, 10).replace(/-/g, '.'); };
    var a = d(from), b = d(to);
    if (a && b) {
      /* 해가 넘어가면 마감 쪽도 연도를 적어야 하는데 그러면 열두 자가 되어
         좁은 칸에서 잘립니다. 그때는 아래위 모두 두 자 연도로 줄입니다.
           2026.12.28 / ~ 2027.01.03  →  26.12.28 / ~ 27.01.03 */
      if (b.slice(0, 4) !== a.slice(0, 4)) {
        return { top: a.slice(2), bottom: '~ ' + b.slice(2) };
      }
      return { top: a, bottom: '~ ' + b.slice(5) };
    }
    /* 한쪽만 있는 경우도 두 줄로 나눠 잘리지 않게 합니다 */
    if (b) return { top: '마감', bottom: b };
    if (a) return { top: a, bottom: '~ 계속' };
    return { top: '상시모집', bottom: '' };
  }

  /* 접수기간을 사람이 읽기 좋게 (한 줄로 — 상세 화면에서 씁니다) */
  function applyLabel(from, to, always, untilHired) {
    if (always) return '상시모집';
    if (untilHired) return '채용시까지';
    var d = function (v) { return String(v || '').slice(0, 10).replace(/-/g, '.'); };
    var a = d(from), b = d(to);
    if (a && b) return a + ' ~ ' + b;
    if (b) return '~ ' + b;
    if (a) return a + ' ~';
    return '상시모집';
  }

  /* 마감이 얼마 남았는지 — 급한 것을 알아보게 */
  function daysLeft(to) {
    if (!to) return null;
    var end = new Date(String(to).slice(0, 10) + 'T23:59:59');
    if (isNaN(end)) return null;
    return Math.ceil((end - new Date()) / 86400000);
  }

  /* ============================================================
     보는 사람 확인 — 여기 한 곳에 둡니다

     ★ 왜 여기인가
       recruit.js 는 리쿠르트의 모든 화면이 부르는 공용 모듈입니다.
       목록 엔진과 상세 엔진이 같은 규칙으로 판단해야 하므로,
       두 곳에 따로 적지 않고 여기 하나만 둡니다.

     ★ 왜 필요한가
       인재정보는 <b>채용하는 회원과 본인</b>만 봅니다.
       그 판단을 서버(뷰)가 하는데, 서버는 요청에 실린 토큰으로
       「누구인지」 를 압니다. 익명 열쇠로만 물어보면 서버는
       언제나 손님으로 보아 한 줄도 내주지 않습니다.
       그래서 로그인한 분의 토큰을 실어 보내야 합니다.
     ============================================================ */
  /* ★ 채용하는 쪽 회원 종류 — 한 곳에 두고 모든 화면이 함께 씁니다.

     회원 종류는 다섯입니다 (assets/auth.js 의 TYPE 이 정답입니다)
       major    전공자
       industry 음악관계자
       org      단체·기업     ← 이것이 빠져 있어 채용등록이 막혔습니다
       school   음악학교
       general  일반

     채용정보를 올리고 인재 연락처를 여는 것은 <b>뽑는 쪽</b>입니다.
     같은 목록을 네 파일에 따로 적어 두었더니 한 곳이 빠졌고,
     그것이 정확히 채용의 주체(단체·기업)였습니다. */
  var HIRING = ['industry', 'org', 'school'];

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  var _sb = null, _viewer = null, _viewerPromise = null;

  function client() {
    if (!_sb && window.supabase) _sb = window.supabase.createClient(SB, KEY);
    return _sb;
  }

  /* 지금 보는 사람 — 한 번만 물어보고 그 뒤에는 기억해 둡니다 */
  function viewer() {
    if (_viewer) return Promise.resolve(_viewer);
    if (_viewerPromise) return _viewerPromise;

    _viewerPromise = (async function () {
      var out = { user: null, token: '', type: '', admin: false, canSeeTalents: false };
      var c = client();
      if (!c) { _viewer = out; return out; }
      try {
        var r = await c.auth.getSession();
        var ss = r.data && r.data.session;
        if (!ss || !ss.user) { _viewer = out; return out; }
        out.user = ss.user;
        out.token = ss.access_token || '';
        var mr = await c.from('members').select('*').eq('id', ss.user.id).maybeSingle();
        var m = mr.data || {};
        out.type = m.member_type || '';
        out.admin = !!m.is_admin;
        /* 인재정보를 볼 수 있는 회원 — 뽑는 쪽입니다.
           전공자·일반 회원은 자기 것만 보입니다(서버가 가립니다). */
        /* ★ 채용하는 쪽은 <b>넷</b>입니다 — org(단체·기업)가 빠져 있었습니다.
           회원 종류는 major(전공자) · industry(음악관계자) · org(단체·기업) ·
           school(음악학교) · general(일반) 다섯입니다(assets/auth.js 기준).
           채용을 올리는 주체가 바로 단체·기업인데 그것이 막혀 있었습니다. */
        out.canSeeTalents = HIRING.indexOf(out.type) >= 0 || out.admin;
      } catch (e) { /* 못 물어봐도 손님으로 둡니다 */ }
      _viewer = out;
      return out;
    })();

    return _viewerPromise;
  }

  /* 자료를 물어볼 때 붙일 머리글.
     로그인했으면 그분의 토큰을, 아니면 익명 열쇠를 씁니다. */
  async function headers(extra) {
    var v = await viewer();
    var t = v.token || KEY;
    return Object.assign({ apikey: KEY, Authorization: 'Bearer ' + t }, extra || {});
  }

  window.OCRecruit = {
    /* 자료 */
    JOBS: JOBS, REGIONS: REGIONS,
    EMP_SEARCH: EMP_SEARCH, EMP_TYPES: EMP_TYPES,
    PAY_TYPES: PAY_TYPES, PAY_BANDS: PAY_BANDS,
    EDU: EDU, PREFER: PREFER,
    WORK_DAYS: WORK_DAYS, HOURS: HOURS,
    GENDERS: GENDERS, NOW_STATUS: NOW_STATUS,
    AUDITION: AUDITION, APPLY_METHOD: APPLY_METHOD, SORTS: SORTS,
    /* 채우기 */
    fill: fill, opt: opt,
    fillJobCat1: fillJobCat1, fillJobCat2: fillJobCat2,
    fillRegion1: fillRegion1, fillRegion2: fillRegion2,
    bindPair: bindPair,
    fillChecks: fillChecks, fillRadios: fillRadios, checked: checked,
    /* 보는 사람 */
    SB: SB, KEY: KEY, HIRING: HIRING,
    client: client, viewer: viewer, headers: headers,
    /* 보여 주기 */
    jobLabel: jobLabel, regionLabel: regionLabel,
    payLabel: payLabel, applyLabel: applyLabel, applyLines: applyLines,
    daysLeft: daysLeft,
  };
})();
