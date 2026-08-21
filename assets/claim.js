/* ════════════════════════════════════════════════════════════════
   OPUSCLAM — 「이 항목이 저(저희)입니다」 잇기 공용 엔진
   2026-08-11
   ────────────────────────────────────────────────────────────────

   ★ 무엇을 푸는가 (파트너 물음 · 2026-08-11)
     기관·재단DB 에 크레디아를 이미 담아 두었는데, 크레디아 관계자가
     단체 회원으로 가입하면 <b>같은 크레디아가 두 벌</b>이 됩니다.
     인물 15,250명 · 단체 · 공연장 · 학교 — 일곱 갈래 모두 그렇습니다.

   ★ 어떻게 푸는가
     이미 있는 항목을 지우지도 새로 만들지도 않습니다.
     <b>「이게 저희입니다」 주장 → 관리자 확인 → 잇기</b> 입니다.

   ★ 왜 파일 하나로 두는가 — <b>세 곳에서 같은 일을 합니다</b>
       ① 가입 화면      단체명을 적으면 「이미 있는 곳인가」 알려 줍니다
       ② 상세 화면      「이 곳 관계자이신가요? 인증받기」
       ③ 마이페이지     내가 신청한 것 · 이어진 항목 관리
     화면마다 따로 적으면 규칙이 갈라집니다. 여기만 고치면 셋 다 바뀝니다.
     ★ OPUSFINE 에도 KINDS 만 갈아 끼우면 그대로 씁니다.

   ★ 쓰는 법
     <script src="/assets/claim.js"></script>
       ocClaim.search('크레디아')                 → 일곱 갈래에서 찾기
       ocClaim.mountPicker(el, {name, onPick})    → 고르는 상자 그리기
       ocClaim.request({kind,id,name,...})        → 잇기 신청
       ocClaim.mine()                             → 내 신청 목록
       ocClaim.mountBadge(el, kind, id)           → 상세 화면 인증 표시
       ocClaim.mountAsk(el, kind, id, name)       → 「관계자이신가요?」 단추

   ★ 짝이 되는 스키마: sql/claim-01-B-apply.sql
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ★★ 2026-08-21 · 상세 화면에 인증 표시가 <b>한 번도 안 나오고
        있었습니다</b> (파트너 지적)

     붙일 자리도 부르는 곳도 다 있었는데, 두 가지가 빠져 있었습니다.

     ① Supabase 를 <b>남이 만들어 주기를 기다렸습니다</b>
        sb() 는 window.__ocSb 를 그대로 쓸 뿐 스스로 만들지 않습니다.
        그 싱글턴은 assets/app.js 가 <b>헤더의 로그인 링크를 찾은 뒤</b>
        CDN 에서 supabase-js 를 받아 만듭니다. 헤더는 include.js 가
        따로 받아 오므로, 아래 attach() 가 기다리는 <b>3초</b>를
        넘기는 일이 잦습니다. 그러면 조용히 그만두고 표시가 안 붙습니다.
        ▶ 여기서 <b>스스로</b> 갖춥니다. 이미 있으면 그대로 씁니다 —
          싱글턴은 반드시 하나여야 합니다.

     ② 꾸밈(CSS)이 <b>어디에도 없었습니다</b>
        .oc-claim-badge · .oc-claim-ask · .oc-claim-form 규칙이
        style.css · base.css · 상세 화면 어디에도 없습니다. 붙어도
        맨 글자로만 보였을 것입니다.
        ▶ 별도 CSS 파일로 두면 상세 화면 일곱 곳에 link 를 넣어야
          합니다. 이 파일이 스스로 넣습니다 — 고칠 자리가 하나입니다.
     ══════════════════════════════════════════════════════════════ */

  /* ★ 내 <script> 태그를 <b>지금</b> 잡아 둡니다.
       data-kind 를 여기서 읽습니다. 나중에 읽으면 그 사이 다른 스크립트가
       끼어들어 document.currentScript 가 바뀔 수 있습니다. */
  var MY_SCRIPT = document.currentScript;

  var CSS_ID = 'oc-claim-css';
  /* ★ 클래스 이름은 아래 mountBadge · mountAsk · openForm · mountPicker 가
       실제로 그리는 것을 <b>그대로 옮겨 적었습니다.</b> 짐작해 적으면
       규칙이 하나도 안 걸립니다. */
  var CSS =
      /* ── 배지를 담는 상자 ──
         ★ 안에 무엇이 몇 개 들어오든 <b>가운데로 나란히</b> 섭니다.
           그리고 이 상자 하나만 이름에 맞춥니다.
         ★ 이름이 30px 이라 middle 로만 세우면 배지가 <b>위로 뜹니다</b> —
           한글은 x-height 가 로마자와 달라 middle 기준선이 높습니다.
           그래서 조금 내립니다(.14em ≈ 4px). */
      '.oc-claim-hold{display:inline-flex;align-items:center;gap:7px;'
    +   'vertical-align:middle;margin-left:9px;position:relative;top:.14em;'
    +   'line-height:1}'
    + '.oc-claim-hold:empty{display:none}'
    + '.oc-claim-hold .oc-claim-badge{margin-left:0}'
      /* 게시판에서 쓰는 여백은 상자 안에서 필요 없습니다 — gap 이 맡습니다 */
    + '.oc-claim-hold .bv-linked{margin-left:0}'

      /* ── 「공식 인증」 — 관리자 화면의 승인 색과 같게 둡니다 ── */
    + '.oc-claim-badge{display:inline-flex;align-items:center;gap:3px;'
    +   'font-size:11.5px;font-weight:800;color:#0f7a3d;background:#e2f3e8;'
    +   'border-radius:99px;padding:3px 9px;margin-left:8px;'
    +   'vertical-align:middle;line-height:1;white-space:nowrap}'
    + '.oc-claim-badge svg{flex:0 0 auto}'

      /* ── 「관계자이신가요?」 — 단추 줄 아래 ── */
    + '.oc-claim-slot{margin-top:10px}'
    + '.oc-claim-ask{display:inline-flex;align-items:center;gap:6px;'
    +   'font-size:12.5px;font-weight:700;color:#5f4aa0;background:#f4f1fb;'
    +   'border:1px solid #e0d8f4;border-radius:8px;padding:8px 13px;'
    +   'text-decoration:none;cursor:pointer;font-family:inherit;line-height:1.45;'
    +   'appearance:none;text-align:left}'
    + '.oc-claim-ask:hover{background:#ece6f8;border-color:#c9bce9}'
      /* 이미 주인이 있는 항목 — 동명이인을 위한 길이므로 조용히 둡니다.
         눈에 띄게 하면 인증된 항목을 놓고 다투게 부추기는 꼴입니다. */
    + '.oc-claim-ask.owned{color:#6b6d80;background:#f5f5f9;border-color:#e2e2ea;'
    +   'font-weight:600}'
    + '.oc-claim-ask.owned:hover{background:#eeeef4;border-color:#d5d5e0}'
    + '.oc-claim-ask.done{color:#0f7a3d;background:#e2f3e8;border-color:#cde5d6;'
    +   'cursor:default}'

      /* ── 신청 서식 ── */
    + '.oc-claim-form{border:1px solid #e0d8f4;border-radius:10px;'
    +   'background:#fbfaff;padding:15px 16px;margin-top:10px;max-width:540px}'
    + '.ocf-t{font-size:13.5px;font-weight:800;color:#20223a;margin-bottom:12px;'
    +   'line-height:1.5}'
    + '.ocf-l{display:block;font-size:11.5px;font-weight:700;color:#5c5e70;'
    +   'margin:0 0 4px}'
    + '.ocf-o{font-weight:600;color:#9a9cb0}'
    + '.ocf-i{width:100%;box-sizing:border-box;padding:9px 11px;'
    +   'border:1px solid #d8d8e2;border-radius:7px;font-size:13px;'
    +   'font-family:inherit;background:#fff;color:#20223a;margin-bottom:11px}'
    + '.ocf-i:focus{outline:none;border-color:#7C63B0}'
    + '.ocf-ta{min-height:64px;resize:vertical;line-height:1.7}'
    + '.ocf-note{font-size:12px;color:#6b6d80;line-height:1.7;'
    +   'background:#fff;border:1px solid #ece8f6;border-radius:7px;'
    +   'padding:9px 11px;margin-bottom:12px}'
    + '.ocf-btns{display:flex;gap:7px;flex-wrap:wrap}'
    + '.ocf-btns button{appearance:none;border:0;border-radius:7px;'
    +   'padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;'
    +   'font-family:inherit;background:#5f4aa0;color:#fff}'
    + '.ocf-btns button:hover{background:#4e3d87}'
    + '.ocf-no{background:#fff !important;color:#5c5e70 !important;'
    +   'border:1px solid #cfd0dd !important}'
    + '.ocf-no:hover{background:#f4f4f8 !important}'
    + '.ocf-msg{margin-top:9px;font-size:12px;color:#6b6d80;min-height:1em;line-height:1.6}'
    + '.ocf-msg.bad{color:#a01c1c}'
    + '.ocf-msg.good{color:#0f7a3d}'

      /* ── 고르는 상자 (가입 화면) ── */
    + '.oc-claim-pick{border:1px solid #e0d8f4;border-radius:10px;'
    +   'background:#fbfaff;padding:13px 14px;margin-top:8px}'
    + '.ocp-head{font-size:12.5px;font-weight:800;color:#20223a;margin-bottom:8px}'
    + '.ocp-hint{font-size:12px;color:#6b6d80;line-height:1.7;margin-bottom:8px}'
    + '.ocp-list{max-height:280px;overflow:auto}'
    + '.ocp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;'
    +   'border:1px solid #e6e6ee;border-radius:8px;background:#fff;'
    +   'padding:9px 11px;margin-bottom:6px;cursor:pointer;font-size:12.5px}'
    + '.ocp-row:hover{border-color:#c9bce9;background:#fdfcff}'
    + '.ocp-row input{flex:0 0 auto;margin:0;accent-color:#7C63B0}'
    + '.ocp-k{flex:0 0 auto;padding:2px 8px;border-radius:5px;font-size:10.5px;'
    +   'font-weight:800;color:#5f4aa0;background:#efe9fb}'
    + '.ocp-n{flex:1 1 auto;min-width:0;font-weight:700;color:#20223a;'
    +   'line-height:1.5}'
    + '.ocp-e{flex:0 0 auto;color:#8a8c9e;font-size:11.5px}'
    + '.ocp-v{flex:0 0 auto;color:#5f4aa0;font-size:11.5px;font-weight:700;'
    +   'text-decoration:none;border:1px solid #e0d8f4;border-radius:6px;'
    +   'padding:3px 9px;background:#fff}'
    + '.ocp-v:hover{background:#f4f1fb}'
    + '.ocp-new{background:#f8f8fc}'
    + '.ocp-new .ocp-n{font-weight:600;color:#6b6d80}'
    + '.ocp-none{font-size:12.5px;color:#6b6d80;line-height:1.7;padding:4px 2px}'
    + '.ocp-none.warn{color:#8a6a2a;background:#fffaf2;border:1px solid #f0e0c4;'
    +   'border-radius:7px;padding:10px 12px}'

    + '@media(max-width:600px){'
    +   '.oc-claim-badge{margin-left:6px;font-size:11px;padding:2px 8px}'
    +   '.oc-claim-form{padding:13px 13px}'
    +   '.ocp-e{display:none}'
    + '}';

  function injectCss() {
    try {
      if (document.getElementById(CSS_ID)) return;
      var st = document.createElement('style');
      st.id = CSS_ID; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { /* 꾸밈이 없어도 글자는 나옵니다 */ }
  }
  injectCss();

  /* ── Supabase 갖추기 ──────────────────────────────────────────
     ★ 반드시 싱글턴 — 이미 있으면 그것을 씁니다. createClient 를
       또 부르면 세션 토큰이 질의에 실리지 않아 RLS 가 남처럼 굽니다. */
  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var _sbWait = null;

  function ensureSb() {
    if (window.__ocSb) return Promise.resolve(window.__ocSb);
    if (_sbWait) return _sbWait;
    _sbWait = new Promise(function (done) {
      function make() {
        try {
          if (window.supabase && window.supabase.createClient) {
            if (!window.__ocSb)
              window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
          }
        } catch (e) {}
        done(window.__ocSb || null);
      }
      if (window.supabase && window.supabase.createClient) { make(); return; }
      /* 남(app.js)이 이미 받는 중일 수 있으므로 같은 주소를 씁니다 —
         브라우저가 한 번만 내려받습니다. */
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = make;
      s.onerror = function () { done(null); };
      (document.head || document.documentElement).appendChild(s);
    });
    return _sbWait;
  }

  /* ── 일곱 갈래 ────────────────────────────────────────────────
     ★ 여기가 <b>유일한 목록</b>입니다. 화면에 손으로 다시 적지 마십시오.
     ★ kind 는 <b>표 이름 그대로</b>입니다 — SQL 의 oc_entity_kind 와 같습니다.
     ★ nameCol 이 갈래마다 다릅니다 (학술은 title). 짐작하지 말고 여기만 봅니다. */
  /* ★★ 2026-08-12 · 사람인 갈래와 단체인 갈래의 <b>말을 나눴습니다</b> ★★
     ──────────────────────────────────────────────────────────────
     ★ 무엇이 어색했나 (파트너 지적)
       모든 갈래에 「관계자」를 썼습니다. 공연장·단체·학교·재단에는
       맞는 말이지만 <b>사람에게는 안 맞습니다.</b>
         「이 인물 관계자이신가요?」   ← 미칼라 페트리 본인에게 묻는 말
       신청 서식도 「맡으신 일 · 예: 기획팀장」이라 사람에게는
       물을 것이 아니었습니다.

     ★ 어떻게 나눴나
       갈래마다 who·ask·claimWord·roleLabel·roleHint 를 둡니다.
         사람 갈래(인물·현대음악)  「이 분이 본인이신가요」 / 직함·활동
         단체 갈래(공연장·단체 …)  「이 공연장 관계자이신가요」 / 맡으신 일
       학술은 <b>논문</b>이라 「저자이신가요」가 맞습니다.

     ★ 왜 여기에 두나
       문구를 화면마다 적으면 일곱 곳에 흩어집니다. 갈래 정의가
       이미 한 곳에 모여 있으니 문구도 여기 붙입니다.
       OPUSFINE 에서는 이 표만 갈아 끼우면 됩니다. */
  var KINDS = [
    { kind:'persons',          label:'인물',        nameCol:'name_ko', enCol:'name_en', view:'/db/person-view.html',     hasHidden:true,
      who:'사람', ask:'이 분이 본인이신가요',  claimWord:'본인 인증',
      ownedAsk:'이미 인증된 분이 계십니다 · 다른 분이신가요',
      roleLabel:'직함·활동',   roleHint:'예: 리코더 연주자 · 서울대 교수',
      evidLabel:'확인할 수 있는 곳', evidHint:'누리집·소속 기관 프로필 주소 등' },
    { kind:'orgs',             label:'음악단체',    nameCol:'name_ko', enCol:'name_en', view:'/db/org-view.html',        hasHidden:true  },
    { kind:'venues',           label:'공연장',      nameCol:'name_ko', enCol:'name_en', view:'/db/venue-view.html',      hasHidden:true  },
    { kind:'schools',          label:'음악학교',    nameCol:'name_ko', enCol:'name_en', view:'/db/school-view.html',     hasHidden:true  },
    { kind:'foundations',      label:'기관·재단',   nameCol:'name_ko', enCol:'name_en', view:'/db/foundation-view.html', hasHidden:true  },
    { kind:'modern_composers', label:'현대음악',    nameCol:'name_ko', enCol:'name_en', view:'/db/modern-view.html',     hasHidden:true,
      who:'사람', ask:'이 분이 본인이신가요',  claimWord:'본인 인증',
      ownedAsk:'이미 인증된 분이 계십니다 · 다른 분이신가요',
      roleLabel:'직함·활동',   roleHint:'예: 작곡가 · 한국예술종합학교 교수',
      evidLabel:'확인할 수 있는 곳', evidHint:'누리집·소속 기관 프로필 주소 등' },
    { kind:'academic',         label:'학술',        nameCol:'title',   enCol:null,      view:'/db/academic-view.html',   hasHidden:false,
      who:'글',   ask:'이 글의 저자이신가요',  claimWord:'저자 인증',
      ownedAsk:'이미 인증된 저자가 계십니다 · 다른 분이신가요',
      roleLabel:'맡으신 몫',   roleHint:'예: 제1저자 · 공동저자',
      evidLabel:'확인할 수 있는 곳', evidHint:'논문 초록 주소 · 소속 기관 프로필 등' }
  ];

  /* 회원 갈래별로 「먼저 보여 줄」 갈래 — 단체 회원에게 인물DB 를 앞세우면
     엉뚱해 보입니다. 없으면 일곱 갈래를 다 봅니다. */
  var BY_MEMBER_TYPE = {
    org:      ['orgs','foundations','venues','schools'],
    school:   ['schools','orgs','foundations'],
    industry: ['foundations','orgs','venues','persons'],
    major:    ['persons','modern_composers'],
    general:  ['persons','orgs','venues','schools','foundations','modern_composers']
  };

  function sb() {
    /* ★ 반드시 싱글턴을 씁니다 — createClient 를 또 부르면 세션 토큰이
         질의에 실리지 않아 RLS 가 남의 것처럼 굽니다. */
    return window.__ocSb || null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /* ★ 갈래에 적힌 말을 꺼냅니다. 안 적혀 있으면 단체 쪽 기본값을 씁니다 —
       공연장·단체·학교·재단은 예전 말이 그대로 맞기 때문입니다. */
  function wordOf(kind, key) {
    var k = kindOf(kind) || {};
    var DEF = {
      ask:       '',                      /* 비어 있으면 「이 ○○ 관계자이신가요」로 만듭니다 */
      claimWord: '관계자 인증',
      roleLabel: '맡으신 일',
      roleHint:  '예: 기획팀장',
      evidLabel: '확인할 수 있는 곳',
      evidHint:  '누리집의 담당자 안내 주소 등',
      /* ★ 2026-08-21 · <b>이미 인증된 주인이 있을 때</b> 쓰는 말입니다.
           숨기지 않는 까닭 — 인물이 15,000명이라 <b>동명이인이 드물지
           않습니다.</b> 「김형윤」이 두 분일 수 있고, 뒤에 오신 분이
           자기 항목을 만들 길이 있어야 합니다.
         ★ 다만 <b>이미 주인이 있다는 것은 알려 드립니다.</b>
           모르고 청하면 관리자가 거절할 수밖에 없고, 그때는 이미
           서로 시간을 쓴 뒤입니다. */
      ownedAsk:  '이미 인증된 관계자가 계십니다 · 다른 곳이신가요'
    };
    return k[key] || DEF[key];
  }

  /* ★ 묻는 문장을 만듭니다.
       갈래에 ask 가 적혀 있으면 그 문장을 그대로 씁니다 —
       갈래 이름을 기계로 끼우면 말이 어그러집니다.
         「이 현대음악 본인이신가요?」  ✗
         「이 분이 본인이신가요?」      ✓
         「이 글의 저자이신가요?」      ✓
       적혀 있지 않으면 예전처럼 「이 공연장 관계자이신가요」로 만듭니다. */
  function askOf(kind) {
    var k = kindOf(kind) || {};
    if (k.ask) return k.ask;
    return '이 ' + ((k.label) || '항목') + ' 관계자이신가요';
  }

  function kindOf(kind) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].kind === kind) return KINDS[i];
    return null;
  }

  /* ── 지금 로그인한 회원 ──────────────────────────────────────── */
  var _me = null, _meDone = false;
  async function me() {
    if (_meDone) return _me;
    _meDone = true;
    var c = sb(); if (!c) return null;
    try {
      var u = await c.auth.getUser();
      var uid = u && u.data && u.data.user && u.data.user.id;
      if (!uid) return null;
      var r = await c.from('members')
        .select('id,name,username,member_type,status,email,extra')
        .eq('id', uid).maybeSingle();
      _me = r.data || null;
      return _me;
    } catch (e) { return null; }
  }

  /* ── ① 찾기 ──────────────────────────────────────────────────
     ★ 일곱 갈래를 <b>한꺼번에</b> 물어봅니다 (Promise.all).
       하나씩 기다리면 일곱 번 왕복이라 눈에 띄게 느립니다.
     ★ 이름이 두 글자보다 짧으면 찾지 않습니다 — 「김」 하나로 찾으면
       수천 건이 나와 고르는 뜻이 없어집니다.

     ★ <b>돌려주는 값이 셋</b>입니다. 「못 찾았다」와 「없다」는 다릅니다.
         null  물어보지 못했습니다 (연결이 없거나 다 실패)
         []    물어봤고 <b>정말 없습니다</b>
         [..]  찾았습니다
       예전에는 둘을 함께 [] 로 돌려주어, 연결이 끊긴 동안 화면이
       「등록된 곳이 없습니다」 라고 <b>단정</b>했습니다. 그 말을 믿고
       새로 등록하면 <b>같은 곳이 두 벌</b>이 됩니다 — 막으려던 바로 그 일입니다. */
  async function search(name, opts) {
    opts = opts || {};
    var q = String(name || '').trim();
    if (q.length < 2) return [];
    var c = sb(); if (!c) return null;          /* 물어보지 못했습니다 */

    var order = opts.kinds || null;
    if (!order && opts.memberType) order = BY_MEMBER_TYPE[opts.memberType] || null;

    var list = KINDS.slice();
    if (order) {
      list.sort(function (a, b) {
        var ia = order.indexOf(a.kind), ib = order.indexOf(b.kind);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    }

    var per = opts.per || 5;
    var jobs = list.map(function (k) {
      var cols = ['id', k.nameCol];
      if (k.enCol) cols.push(k.enCol);
      var qq = c.from(k.kind).select(cols.join(','))
                .ilike(k.nameCol, '%' + q + '%')
                .limit(per);
      if (k.hasHidden) qq = qq.or('hidden.is.null,hidden.is.false');
      return qq.then(function (r) {
        if (r.error) return null;               /* 이 갈래는 실패 */
        if (!r.data) return [];
        return r.data.map(function (row) {
          return { kind:k.kind, label:k.label, id:row.id,
                   name:row[k.nameCol] || '', nameEn:(k.enCol ? row[k.enCol] : '') || '',
                   view:k.view };
        });
      }, function () { return null; });
    });

    var got = await Promise.all(jobs);

    /* ★ <b>모두</b> 실패했으면 「없다」고 하지 않습니다.
         한둘만 실패한 것은 나머지 결과로 답합니다 — 갈래 일곱 중
         하나가 늦다고 아무 말도 못 하는 것은 더 불편합니다. */
    var okCount = got.filter(function (g) { return g !== null; }).length;
    if (okCount === 0) return null;

    var out = [];
    got.forEach(function (arr) { if (arr) out = out.concat(arr); });

    /* 이름이 <b>똑같은</b> 것을 앞에 둡니다 — 대개 그것이 찾던 것입니다 */
    out.sort(function (a, b) {
      var ea = (a.name === q) ? 0 : 1, eb = (b.name === q) ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return a.name.length - b.name.length;
    });
    return out;
  }

  /* ── ② 신청 ────────────────────────────────────────────────── */
  async function request(o) {
    var c = sb(); if (!c) return { ok:false, msg:'초기화 중입니다. 잠시 후 다시 시도해 주세요.' };
    var m = await me();
    if (!m) return { ok:false, msg:'로그인이 필요합니다.' };
    if (m.status !== 'approved')
      return { ok:false, msg:'회원 승인 후에 신청하실 수 있습니다. 승인까지 조금만 기다려 주십시오.' };
    var k = kindOf(o.kind);
    if (!k || !o.id) return { ok:false, msg:'어떤 항목인지 고르지 않으셨습니다.' };

    /* 메일 도메인이 그 곳의 것과 같은지 — 관리자가 볼 참고 표시입니다.
       ★ 이것만으로 저절로 승인되지는 않습니다. 도메인은 빌릴 수도 있고
         큰 기관은 부서가 여럿이기 때문입니다. */
    var dom = '';
    try { dom = String(m.email || '').split('@')[1] || ''; } catch (e) {}

    var row = {
      member_id: m.id,
      entity_kind: o.kind,
      entity_id: o.id,
      entity_name: o.name || '',
      role_title: o.role || null,
      note: o.note || null,
      evidence_url: o.evidence || null,
      email_domain: dom || null,
      domain_match: !!o.domainMatch,
      needs_review: (o.kind === 'persons' || o.kind === 'modern_composers' || o.kind === 'academic')
    };

    var r = await c.from('entity_claims').insert(row).select('id').maybeSingle();
    if (r.error) {
      var msg = String(r.error.message || '');
      if (/duplicate|unique/i.test(msg))
        return { ok:false, msg:'이미 신청하신 항목입니다. 마이페이지에서 진행 상태를 보실 수 있습니다.' };
      if (/row-level security|policy/i.test(msg))
        return { ok:false, msg:'지금은 신청하실 수 없습니다. 회원 승인 상태를 확인해 주십시오.' };
      return { ok:false, msg:'신청 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { ok:true, id: r.data && r.data.id };
  }

  /* ── ③ 내 신청 ───────────────────────────────────────────────── */
  async function mine() {
    var c = sb(); if (!c) return [];
    var m = await me(); if (!m) return [];
    var r = await c.from('entity_claims')
      .select('id,entity_kind,entity_id,entity_name,status,role_title,created_at,decided_at,decided_note')
      .eq('member_id', m.id).order('created_at', { ascending:false });
    return (r.data || []).map(function (x) {
      var k = kindOf(x.entity_kind);
      x.label = k ? k.label : x.entity_kind;
      x.view  = k ? (k.view + '?id=' + encodeURIComponent(x.entity_id)) : '#';
      return x;
    });
  }

  async function revoke(claimId) {
    var c = sb(); if (!c) return false;
    var r = await c.rpc('oc_claim_revoke', { claim_id: claimId });
    return !r.error && r.data === true;
  }

  /* ── ④ 상세 화면 인증 표시 ──────────────────────────────────────
     ★ <b>누가</b> 주인인지는 보여 주지 않습니다. 신청서에는 연락처와
       증빙이 들어 있어 남에게 보일 것이 아닙니다. 표시만 답니다. */
  async function badge(kind, id) {
    var c = sb(); if (!c) return null;
    var r = await c.from('entity_claim_badge')
      .select('owner_count,verified_at')
      .eq('entity_kind', kind).eq('entity_id', id).maybeSingle();
    return (r && r.data) ? r.data : null;
  }

  async function mountBadge(el, kind, id) {
    if (!el) return;
    var b = await badge(kind, id);
    if (!b || !b.owner_count) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<span class="oc-claim-badge" title="이 항목이 인증되었습니다">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
             'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M20 6 9 17l-5-5"/></svg>' +
        '공식 인증</span>';
  }

  /* ── ⑤-2 「Linked 청하기」 ────────────────────────────────────
     ★ 2026-08-21 · 파트너 물음 —
       「회원가입 때 Linked 가 기본으로 켜져 있고 손을 안 댔다면,
         인물 상세에도 Linked 표시가 나와야 하는 것 아닌가?」
       맞습니다. 자리만 없었습니다.

     ★ 단추를 <b>새로 만들지 않습니다.</b> 게시판에서 쓰고 있는
       assets/linked-ask.js 를 그대로 씁니다. 그 파일은
         <span class="bv-linked" data-uid="…" data-name="…"></span>
       라는 <b>빈 자리</b>를 찾아 채우고, 화면이 바뀌는 것도 스스로
       지켜봅니다. 우리는 자리만 놓으면 됩니다.
       ▶ 「청할 수 있는가」(안 받겠다 · 차단 · 30일 · 이미 이어짐)는
         모두 그 파일과 oc_link_can_ask 가 판단합니다. 규칙을 여기
         다시 적으면 두 곳이 갈라집니다.

     ★ 주인이 누구인지는 <b>함수에게만</b> 묻습니다 (oc_entity_owner).
       entity_claims 를 열면 연락처·증빙까지 새어 나갑니다.
       함수는 아이디와 표시 이름만 내줍니다. */
  async function mountLinked(afterEl, kind, id) {
    if (!afterEl || !afterEl.parentNode) return;
    var c = sb(); if (!c) return;

    var r;
    try {
      r = await c.rpc('oc_entity_owner', { p_kind: kind, p_id: Number(id) });
    } catch (e) { return; }
    /* 함수가 아직 없으면(SQL 을 안 돌린 상태) 조용히 넘어갑니다 —
       단추가 안 보일 뿐 화면이 깨지지 않아야 합니다. */
    if (!r || r.error || !r.data || !r.data.length) return;

    var seen = {};
    r.data.forEach(function (o) {
      if (!o || !o.member_id || seen[o.member_id]) return;
      seen[o.member_id] = 1;
      var slot = document.createElement('span');
      slot.className = 'bv-linked';
      slot.setAttribute('data-uid', o.member_id);
      slot.setAttribute('data-name', o.member_name || '이 회원');
      /* ★ 배지 <b>옆</b>이 아니라 배지가 든 <b>상자 안</b>에 넣습니다.
           밖에 두면 높이가 달라 서로 어긋납니다. */
      afterEl.appendChild(slot);
    });

    /* linked-ask.js 를 아직 안 실은 화면이면 여기서 싣습니다.
       ★ 깃발은 board.js 가 쓰는 것과 <b>같은 이름</b>이어야 합니다.
         다른 이름을 쓰면 게시판 화면에서 두 번 실려 훑개가 둘이 됩니다. */
    if (!window.__ocLinkedAsk) {
      window.__ocLinkedAsk = true;
      var s = document.createElement('script');
      s.src = '/assets/linked-ask.js';
      s.onerror = function () { /* 못 받아도 화면은 그대로 돕니다 */ };
      (document.head || document.documentElement).appendChild(s);
    }
  }

  /* ── ⑥ 「관계자이신가요?」 단추 ───────────────────────────────
     ★ 상세 화면에 둡니다. DB 를 보러 온 사람이 회원이 되는 <b>되돌아오는 길</b>입니다.
     ★ 이미 이어진 항목이거나 내가 신청해 둔 것이면 보여 주지 않습니다. */
  async function mountAsk(el, kind, id, name) {
    if (!el) return;
    el.innerHTML = '';
    var c = sb(); if (!c) return;

    /* ★ 2026-08-21 · <b>이미 인증된 주인이 있는지</b> 봅니다 (파트너 지적).
         주인이 있는데도 「이 분이 본인이신가요?」가 그대로 떠 있었습니다.
       ★ 감추지는 않습니다 — 동명이인이 자기 항목을 만들 길이 막힙니다.
         대신 <b>이미 주인이 있다는 것을 먼저 알려 드립니다.</b> */
    var bd = await badge(kind, id);
    var owned = !!(bd && bd.owner_count);
    var askWord = owned ? wordOf(kind, 'ownedAsk') : askOf(kind);

    var m = await me();
    if (!m) {
      el.innerHTML =
        '<a class="oc-claim-ask" href="/account/login.html">' +
        esc(askWord) + '? 로그인 후 인증받으실 수 있습니다 &rarr;</a>';
      return;
    }
    if (m.status !== 'approved') return;

    /* 내가 이미 신청했는가 */
    var r = await c.from('entity_claims').select('id,status')
      .eq('member_id', m.id).eq('entity_kind', kind).eq('entity_id', id)
      .in('status', ['pending','approved']).maybeSingle();
    if (r && r.data) {
      el.innerHTML = '<span class="oc-claim-ask done">' +
        (r.data.status === 'approved' ? '내가 인증받은 항목입니다' : '인증 신청이 접수되어 확인 중입니다') +
        '</span>';
      return;
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oc-claim-ask' + (owned ? ' owned' : '');
    btn.innerHTML = esc(askWord) + '? ' + (owned ? '인증 신청' : '인증받기') + ' &rarr;';
    btn.addEventListener('click', function () { openForm(el, kind, id, name); });
    el.appendChild(btn);
  }

  /* 간단한 신청 서식 — 새 화면으로 보내지 않고 그 자리에서 받습니다 */
  function openForm(el, kind, id, name) {
    el.innerHTML =
      '<div class="oc-claim-form">' +
        '<div class="ocf-t">' + esc(name || '') + ' — ' + esc(wordOf(kind, 'claimWord')) + ' 신청</div>' +
        '<label class="ocf-l">' + esc(wordOf(kind, 'roleLabel')) + ' <span class="ocf-o">(선택)</span></label>' +
        '<input class="ocf-i" data-f="role" placeholder="' + esc(wordOf(kind, 'roleHint')) + '">' +
        '<label class="ocf-l">' + esc(wordOf(kind, 'evidLabel')) + ' <span class="ocf-o">(선택)</span></label>' +
        '<input class="ocf-i" data-f="evidence" placeholder="' + esc(wordOf(kind, 'evidHint')) + '">' +
        '<label class="ocf-l">하실 말씀 <span class="ocf-o">(선택)</span></label>' +
        '<textarea class="ocf-i ocf-ta" data-f="note" rows="2"></textarea>' +
        '<div class="ocf-note">신청하시면 관리자가 확인한 뒤 이어 드립니다. ' +
          '인증되면 이 항목을 직접 고치실 수 있고, 화면에 「공식 인증」 표시가 붙습니다.</div>' +
        '<div class="ocf-btns">' +
          '<button type="button" class="ocf-go">신청</button>' +
          '<button type="button" class="ocf-no">취소</button>' +
        '</div>' +
        '<div class="ocf-msg"></div>' +
      '</div>';

    var box = el.querySelector('.oc-claim-form');
    var msg = box.querySelector('.ocf-msg');
    box.querySelector('.ocf-no').addEventListener('click', function () {
      mountAsk(el, kind, id, name);
    });
    box.querySelector('.ocf-go').addEventListener('click', async function () {
      var get = function (f) { var e = box.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ''; };
      msg.textContent = '보내는 중…'; msg.className = 'ocf-msg';
      var r = await request({ kind:kind, id:id, name:name,
                              role:get('role'), evidence:get('evidence'), note:get('note') });
      if (!r.ok) { msg.textContent = r.msg; msg.className = 'ocf-msg bad'; return; }
      el.innerHTML = '<span class="oc-claim-ask done">인증 신청이 접수되었습니다. 확인 후 알려 드리겠습니다.</span>';
    });
  }

  /* ── ⑥ 고르는 상자 ───────────────────────────────────────────
     가입 화면에서 씁니다 — 단체명을 적으면 「이미 있는 곳인가」 보여 줍니다.
     ★ 여기서는 <b>신청하지 않습니다.</b> 가입은 아직 승인 전이라 신청이
       막혀 있습니다(RLS). 고른 것을 적어 두었다가, 승인된 뒤에
       마이페이지에서 잇습니다. */
  function mountPicker(el, opts) {
    if (!el) return;
    opts = opts || {};
    var picked = null;
    var timer = null;

    el.innerHTML =
      '<div class="oc-claim-pick">' +
        '<div class="ocp-head">이미 오퍼스클램에 등록된 곳인지 확인합니다</div>' +
        '<div class="ocp-list"></div>' +
      '</div>';
    var list = el.querySelector('.ocp-list');

    function draw(rows, q) {
      /* ★ null 은 「물어보지 못했다」 입니다 — 「없다」고 말하면 안 됩니다.
           그 말을 믿고 새로 등록하면 같은 곳이 두 벌이 됩니다. */
      if (rows === null) {
        list.innerHTML = '<div class="ocp-none warn">지금 확인할 수 없습니다. ' +
                         '잠시 뒤 다시 봐 주십시오 — 이미 등록된 곳일 수도 있어, ' +
                         '가입 뒤 마이페이지에서 한 번 더 확인해 드립니다.</div>';
        picked = null;
        if (opts.onPick) opts.onPick(null);
        return;
      }
      if (!rows.length) {
        list.innerHTML = '<div class="ocp-none">「' + esc(q) + '」 (으)로 등록된 곳이 없습니다. ' +
                         '새로 만들어 드립니다.</div>';
        picked = null;
        if (opts.onPick) opts.onPick(null);
        return;
      }
      var h = '<div class="ocp-hint">아래에 해당하는 곳이 있으면 골라 주십시오. ' +
              '<b>같은 곳이 두 벌로 들어가는 것</b>을 막습니다.</div>';
      rows.slice(0, 8).forEach(function (r) {
        h += '<label class="ocp-row">' +
               '<input type="radio" name="ocp" value="' + esc(r.kind) + ':' + esc(r.id) + '">' +
               '<span class="ocp-k">' + esc(r.label) + '</span>' +
               '<span class="ocp-n">' + esc(r.name) + '</span>' +
               (r.nameEn ? '<span class="ocp-e">' + esc(r.nameEn) + '</span>' : '') +
               '<a class="ocp-v" href="' + r.view + '?id=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener">보기</a>' +
             '</label>';
      });
      h += '<label class="ocp-row ocp-new">' +
             '<input type="radio" name="ocp" value="">' +
             '<span class="ocp-n">해당하는 곳이 없습니다 — 새로 등록해 주십시오</span>' +
           '</label>';
      list.innerHTML = h;

      list.querySelectorAll('input[name="ocp"]').forEach(function (r) {
        r.addEventListener('change', function () {
          var v = r.value;
          if (!v) { picked = null; }
          else {
            var p = v.split(':');
            var found = rows.filter(function (x) { return x.kind === p[0] && String(x.id) === p[1]; })[0];
            picked = found || null;
          }
          if (opts.onPick) opts.onPick(picked);
        });
      });
    }

    function run(q) {
      if (String(q || '').trim().length < 2) { list.innerHTML = ''; picked = null;
        if (opts.onPick) opts.onPick(null); return; }
      list.innerHTML = '<div class="ocp-none">찾는 중…</div>';
      search(q, { memberType: opts.memberType, per: 4 }).then(function (rows) { draw(rows, q); });
    }

    /* 글자를 칠 때마다 묻지 않습니다 — 멈춘 뒤에 한 번 */
    if (opts.input) {
      opts.input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { run(opts.input.value); }, 420);
      });
      if (opts.input.value) run(opts.input.value);
    }

    return { run: run, picked: function () { return picked; } };
  }

  /* ── ⑦ 상세 화면에 저절로 붙기 ────────────────────────────────
     ★ 화면마다 붙이는 코드를 적지 않습니다. 뷰 화면에 이 한 줄만 두면 됩니다.

         <script src="/assets/claim.js" data-kind="orgs" defer></script>

       report.js 가 data-table 로 하는 것과 같은 방식입니다.
     ★ data-kind 를 <b>짐작하지 않습니다.</b> 화면이 알려 주게 합니다 —
       주소만 보고 갈래를 맞히려 하면 새 화면이 생길 때마다 어긋납니다.

     ★ 이름이 늦게 채워집니다
       뷰 화면은 이름을 자바스크립트로 나중에 넣습니다(.pv-name).
       그래서 <b>이름이 들어올 때까지 기다립니다.</b> 먼저 붙이면
       신청 서식에 빈 이름이 담깁니다.
     ★ 스무 번(약 3초) 기다려도 안 오면 <b>조용히 그만둡니다.</b>
       자료를 못 불러온 화면에 「관계자이신가요?」 를 띄우면
       무엇에 대한 물음인지 알 수 없습니다. */
  function autoMount() {
    var me = MY_SCRIPT || document.currentScript;
    var kind = me && me.getAttribute('data-kind');
    if (!kind || !kindOf(kind)) return;

    var id = null;
    try { id = new URLSearchParams(location.search).get('id'); } catch (e) {}
    if (!id) return;

    function attach(n) {
      n = n || 0;
      var h = document.querySelector('.pv-name');
      var nm = h ? String(h.textContent || '').trim() : '';
      /* 이름 옆에 붙은 원어 이름은 떼고 한국어만 씁니다 */
      var sub = h ? h.querySelector('.pv-name-sub') : null;
      if (sub) nm = nm.replace(String(sub.textContent || '').trim(), '').trim();

      /* ★ 2026-08-21 · 이름만 기다립니다.
           Supabase 는 위에서 <b>스스로 갖추므로</b> 여기서 기다리지
           않습니다. 예전에는 남이 만들어 주기를 3초 기다리다 그냥
           그만두어, 표시가 <b>한 번도 안 나왔습니다.</b>
         ★ 이름은 화면이 자료를 받아 채우므로 조금 걸립니다.
           40번(6초)까지 봅니다 — 느린 회선을 생각한 것입니다. */
      if (!h || !nm) {
        if (n > 40) return;                  /* 조용히 그만둡니다 */
        setTimeout(function () { attach(n + 1); }, 150);
        return;
      }
      if (h.querySelector('.oc-claim-hold')) return;    /* 두 번 붙이지 않습니다 */

      /* ★★ 2026-08-21 · 배지가 <b>붙었다가 지워지고</b> 있었습니다.
           상세 화면은 자료를 받은 뒤 이름을 이렇게 채웁니다 —
             h.textContent = nm;
           textContent 에 값을 넣으면 그 요소의 <b>자식이 전부 지워집니다.</b>
           우리가 먼저 붙여 둔 배지도 함께 날아갑니다.
         ★ 이것이 「아까는 있었는데 지금은 없다」의 까닭입니다.
           우리가 <b>늦게</b> 붙으면 살아남고, <b>먼저</b> 붙으면 지워집니다.
           회선과 캐시에 따라 순서가 바뀌므로 들쭉날쭉했습니다.
         ▶ 붙여 두고 <b>지켜봅니다.</b> 지워지면 다시 넣습니다.
           15초 뒤에는 그만 봅니다 — 그때쯤이면 이름 채우기가 끝났습니다. */
      /* ── 「공식 인증」·「Linked」 자리 ──
         ★ 2026-08-21 · 둘이 <b>서로도, 이름과도 어긋나 있었습니다</b>
           (파트너 지적). 까닭은 둘을 <b>따로</b> 이름 요소에 넣고
           각자 vertical-align 으로 세운 것입니다. 배지 높이(19px)와
           Linked 단추 높이(26px)가 다르므로 따로 세우면 맞을 수가
           없습니다.
         ▶ <b>한 상자에 담아</b> 그 안에서 가운데로 맞추고, 상자
           하나만 이름에 맞춥니다. 몇 개가 붙든 나란해집니다. */
      var bslot = document.createElement('span');
      bslot.className = 'oc-claim-hold';
      h.appendChild(bslot);
      guard(h, bslot);

      /* ② 「관계자이신가요?」 — 단추 줄 아래에 둡니다
           ★ 이쪽은 .pv-name <b>바깥</b>이라 지워지지 않습니다. */
      var acts = document.querySelector('.pv-actions');
      var aslot = document.createElement('div');
      aslot.className = 'oc-claim-slot';
      if (acts && acts.parentNode) acts.parentNode.insertBefore(aslot, acts.nextSibling);
      else if (h.parentNode) h.parentNode.appendChild(aslot);
      else aslot = null;

      ensureSb().then(function (c) {
        if (!c) return;                      /* 못 갖췄으면 화면은 그대로 둡니다 */
        mountBadge(bslot, kind, id);
        mountLinked(bslot, kind, id);
        if (aslot) mountAsk(aslot, kind, id, nm);
      });
    }

    /* 지워지면 다시 넣습니다.
       ★ 이미 들어 있으면 아무것도 하지 않습니다 — 그러지 않으면
         스스로 일으킨 변화를 다시 보고 끝없이 돕니다. */
    function guard(host, slot) {
      if (!window.MutationObserver) return;
      var obs = new MutationObserver(function () {
        if (!host.contains(slot)) host.appendChild(slot);
      });
      obs.observe(host, { childList: true });
      setTimeout(function () { obs.disconnect(); }, 15000);
    }

    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', function () { attach(0); });
    else attach(0);
  }

  /* ── 바깥에 내놓기 ───────────────────────────────────────────── */
  window.ocClaim = {
    KINDS: KINDS,
    kindOf: kindOf,
    /* ★ 2026-08-21 · Supabase 갖추기를 밖으로도 내놓습니다.
         가입 화면·마이페이지에서 ocClaim.search 를 부르기 전에
         await ocClaim.ensureSb() 를 하면 「아직 안 만들어졌다」로
         조용히 실패하는 일을 막습니다. */
    ensureSb: ensureSb,
    /* ★ 2026-08-12 · 갈래별 말투를 밖으로도 내놓습니다.
         ① 시험할 수 있게 하려고 (문구가 갈래마다 맞는지 자동 확인)
         ② 다른 화면(마이페이지 「내 DB 항목」 등)에서도 같은 말을 쓰게 */
    wordOf: wordOf,
    askOf: askOf,
    me: me,
    search: search,
    request: request,
    mine: mine,
    revoke: revoke,
    badge: badge,
    mountBadge: mountBadge,
    mountAsk: mountAsk,
    mountPicker: mountPicker
  };

  autoMount();
})();
