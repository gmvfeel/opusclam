/* ============================================================
   OPUSCLAM 리쿠르트 등록 엔진 — assets/recruit-write.js

   무엇을 하나
    · 인재정보 등록·고치기 화면을 움직입니다
    · 분류 풀다운을 채우고, 학교 줄을 늘리고 줄이고
    · 넣기 전에 빠진 것을 짚어 주고, Supabase 에 담습니다

   왜 목록·상세 엔진과 나누었나
    담는 일은 읽는 일과 판이합니다 — 권한 확인, 빠진 것 짚기,
    한 번만 눌리게 막기 같은 것이 모두 여기에만 있습니다.

   쓰는 법
     OCRecruitWrite.initTalent({
       listPage: '/recruit/talent.html',
       viewPage: '/recruit/talent-view.html',
     });

   ★ 권한은 <b>서버가</b> 판단합니다(RLS).
     여기서 미리 보는 것은 「눌러 보고 거절당하는」 일을 줄이려는
     친절이지, 잠금장치가 아닙니다.
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  /* 로그인 화면 경로 — 다르면 이 한 줄만 고치십시오 */
  var LOGIN_PAGE = '/account/login.html';

  /* 음악학교DB — 출신학교를 여기서 골라 school_id 로 담습니다.
     인재 → 출신학교 → 그 학교의 입시요강 으로 이어지는 고리입니다. */
  var SCHOOL_TABLE = 'schools';          /* 확인됨 — 음악학교DB */
  var SCHOOL_NAME_COL = 'name_ko';       /* 확인됨 — 학교명 칸 */

  /* 어느 등록 화면인가 — 'talent'(인재) 또는 'job'(채용).
     ★ 두 화면이 <b>한 엔진</b>을 씁니다. 도우미·미리보기·임시저장·
       주소검색·CSS 가 모두 공용이고, 갈래마다 다른 것(담을 칸,
       꼭 채울 것, 담을 표)만 갈라 둡니다. */
  var MODE = 'talent';
  var TABLE = 'recruit_talents';

  /* 채용공고를 올린 단체가 담긴 DB — 표 이름을 확인해 맞추었습니다.
     네 표 모두 이름칸이 name_ko 로 같습니다. */
  var ORG_DBS = {
    org:        { label: '음악단체DB',      table: 'orgs',        nameCol: 'name_ko' },
    venue:      { label: '공연장DB',        table: 'venues',      nameCol: 'name_ko' },
    school:     { label: '음악학교DB',      table: 'schools',     nameCol: 'name_ko' },
    foundation: { label: '관련기관·재단DB', table: 'foundations', nameCol: 'name_ko' },
  };

  /* 사진 올릴 저장소 — 게시판들과 같은 결로 리쿠르트 몫을 따로 둡니다.
     경로는 「회원번호/talent-시각.jpg」 입니다. 회원 폴더 밑에 두면
     권한 규칙에서 「자기 폴더만」 으로 막기가 쉽습니다. */
  var PHOTO_BUCKET = 'recruit';
  var PHOTO_MAX = 800;        /* 긴 쪽 최대 픽셀 — 원본을 그대로 올리면 무겁습니다 */

  var R, cfg = null, C = null, me = null, editId = null, busy = false;

  function el(s, root) { return (root || document).querySelector(s); }
  function els(s, root) { return [].slice.call((root || document).querySelectorAll(s)); }
  function val(s) { var x = el(s); return x ? String(x.value || '').trim() : ''; }
  /* 값을 코드로 넣을 때는 <b>알림도 함께</b> 보냅니다.
     ★ 브라우저는 사람이 손으로 적을 때만 input 알림을 보냅니다.
       그래서 「내 정보 불러오기」 나 임시저장 되돌리기로 채운 값은
       오른쪽 작성 도우미가 알아채지 못했습니다.
       여기서 한 번 알려 주면, 앞으로 어떤 코드가 값을 넣어도
       도우미가 저절로 따라옵니다. */
  function setVal(s, v) {
    var x = el(s);
    if (!x) return;
    x.value = (v == null ? '' : v);
    x.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function num(v) { var n = parseInt(String(v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function radio(name) {
    var x = el('input[name="' + name + '"]:checked');
    return x ? x.value : '';
  }
  function setRadio(name, v) {
    els('input[name="' + name + '"]').forEach(function (x) { x.checked = (x.value === v); });
    ping();
  }
  function setChecks(name, arr) {
    var a = arr || [];
    els('input[name="' + name + '"]').forEach(function (x) { x.checked = a.indexOf(x.value) >= 0; });
    ping();
  }
  /* 체크·라디오는 값을 바꿔도 알림이 없으므로 직접 알려 줍니다 */
  function ping() {
    var f = el('#rwForm');
    if (f) f.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ── 알림 줄 ──────────────────────────────────────────────
     빠진 것을 알릴 때 창(alert)을 띄우지 않습니다 —
     어느 칸이 문제인지 알 수 없고, 창을 닫으면 사라집니다.
     화면에 남겨 두고 그 칸으로 데려갑니다. */
  function say(msg, kind) {
    var box = el('#rwMsg');
    if (!box) return;
    box.className = 'rw-msg' + (kind ? ' rw-msg--' + kind : '');
    box.innerHTML = msg;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hush() { var box = el('#rwMsg'); if (box) box.hidden = true; }

  /* ── 해와 달 채우기 ───────────────────────────────────────*/
  function years(from, to) {
    var out = [];
    for (var y = to; y >= from; y--) out.push(String(y));
    return out;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function months() {
    var out = [];
    for (var m = 1; m <= 12; m++) out.push(pad2(m));
    return out;
  }
  function days() {
    var out = [];
    for (var d = 1; d <= 31; d++) out.push(pad2(d));
    return out;
  }

  /* ── 학교 줄 ──────────────────────────────────────────────
     한 줄이 학교 하나입니다. 담기는 모양은 —
       { country, name, school_id, degree, major, from, to }
     school_id 는 음악학교DB에서 고른 때만 담깁니다.
     해외 학교처럼 DB에 없는 곳은 이름만 적어도 됩니다 —
     막다른 길을 만들지 않으려고요. */
  var COUNTRIES = ['대한민국', '독일', '오스트리아', '이탈리아', '프랑스', '미국',
                   '러시아', '영국', '스위스', '네덜란드', '벨기에', '폴란드',
                   '체코', '헝가리', '스페인', '일본', '중국', '기타'];
  var DEGREES = ['고등학교', '전문학사', '학사', '석사', '박사', '수료', '연수', '기타'];
  var STATUS  = ['졸업', '재학', '수료', '중퇴'];

  var schoolSeq = 0;

  function schoolRow(s) {
    s = s || {};
    var i = ++schoolSeq;
    var opt = function (list, sel) {
      return list.map(function (x) {
        return '<option value="' + esc(x) + '"' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>';
      }).join('');
    };
    var yl = years(1960, new Date().getFullYear() + 6);

    return '<div class="rw-school" data-row="' + i + '"' +
      ' data-school-id="' + esc(s.school_id == null ? '' : s.school_id) + '">'
      + '<div class="rw-school-grid">'
      +   '<label class="rw-f"><span>국가</span>'
      +     '<select class="sc-country"><option value="">선택</option>' + opt(COUNTRIES, s.country) + '</select></label>'
      +   '<label class="rw-f rw-f--name"><span>학교명</span>'
      +     '<input type="text" class="sc-name" value="' + esc(s.name || '') + '" placeholder="학교명을 적거나 아래에서 찾으십시오">'
      +     '<button type="button" class="rw-find sc-find">음악학교DB에서 찾기</button>'
      +     '<span class="sc-linked"' + (s.school_id ? '' : ' hidden') + '>DB 연결됨</span>'
      +   '</label>'
      +   '<label class="rw-f"><span>학위</span>'
      +     '<select class="sc-degree"><option value="">선택</option>' + opt(DEGREES, s.degree) + '</select></label>'
      +   '<label class="rw-f"><span>학과 · 전공</span>'
      +     '<input type="text" class="sc-major" value="' + esc(s.major || '') + '" placeholder="예 — 바이올린"></label>'
      +   '<label class="rw-f"><span>상태</span>'
      +     '<select class="sc-status"><option value="">선택</option>' + opt(STATUS, s.status) + '</select></label>'
      +   '<label class="rw-f"><span>입학</span>'
      +     '<select class="sc-from"><option value="">년도</option>' + opt(yl, s.from) + '</select></label>'
      +   '<label class="rw-f"><span>졸업</span>'
      +     '<select class="sc-to"><option value="">년도</option>' + opt(yl, s.to) + '</select></label>'
      + '</div>'
      + '<button type="button" class="rw-del sc-del" aria-label="이 학교 지우기">지우기</button>'
      + '<div class="sc-results" hidden></div>'
      + '</div>';
  }

  function addSchool(s) {
    var box = el('#rwSchools');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', schoolRow(s));
  }

  function readSchools() {
    return els('#rwSchools .rw-school').map(function (r) {
      var g = function (c) { var x = el('.' + c, r); return x ? String(x.value || '').trim() : ''; };
      var sid = r.getAttribute('data-school-id');
      var o = {
        country: g('sc-country'), name: g('sc-name'),
        degree: g('sc-degree'), major: g('sc-major'),
        status: g('sc-status'), from: g('sc-from'), to: g('sc-to'),
      };
      if (sid) o.school_id = Number(sid);
      return o;
    }).filter(function (o) {
      /* 아무것도 적지 않은 빈 줄은 담지 않습니다 */
      return o.name || o.degree || o.major || o.from;
    });
  }

  /* 음악학교DB 찾기 — 고르면 이름과 번호를 함께 담습니다 */
  async function findSchool(rowEl) {
    var input = el('.sc-name', rowEl);
    var out = el('.sc-results', rowEl);
    var kw = input ? String(input.value || '').trim() : '';
    if (!out) return;
    if (kw.length < 2) {
      out.hidden = false;
      out.innerHTML = '<p class="sc-hint">학교명을 두 글자 이상 적고 다시 눌러 주십시오.</p>';
      return;
    }
    out.hidden = false;
    out.innerHTML = '<p class="sc-hint">찾는 중…</p>';
    try {
      var r = await C.from(SCHOOL_TABLE)
        .select('id,' + SCHOOL_NAME_COL)
        .ilike(SCHOOL_NAME_COL, '%' + kw + '%')
        .limit(8);
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) {
        out.innerHTML = '<p class="sc-hint">음악학교DB에서 찾지 못했습니다. '
          + '적으신 이름 그대로 담깁니다 — 해외 학교라면 그대로 두셔도 됩니다.</p>';
        return;
      }
      out.innerHTML = rows.map(function (x) {
        return '<button type="button" class="sc-pick" data-id="' + esc(x.id) + '"'
          + ' data-name="' + esc(x[SCHOOL_NAME_COL] || '') + '">'
          + esc(x[SCHOOL_NAME_COL] || '') + '</button>';
      }).join('');
    } catch (e) {
      out.innerHTML = '<p class="sc-hint">음악학교DB를 읽지 못했습니다. '
        + '학교명을 직접 적으셔도 됩니다.</p>';
    }
  }

  /* ── 내 정보 불러오기 ─────────────────────────────────────
     회원가입 때 적은 것을 다시 적게 하지 않으려고요.
     ★ members 표의 칸 이름을 확실히 알 수 없으므로, 있을 만한
       이름을 차례로 살펴 <b>찾은 것만</b> 채웁니다.
       없으면 그냥 두므로 잘못 채워질 일은 없습니다. */
  var PICK = {
    name:  ['name', 'real_name', 'username', 'nickname', 'display_name'],
    phone: ['phone', 'mobile', 'hp', 'cellphone', 'tel_mobile'],
    tel:   ['tel', 'telephone', 'phone2'],
    email: ['email', 'mail'],
    addr1: ['addr1', 'address', 'addr', 'address1'],
    addr2: ['addr2', 'address2', 'addr_detail', 'address_detail'],
  };
  function firstOf(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }
  async function pullMe() {
    if (!me || !me.user) { say('로그인이 필요합니다.', 'warn'); return; }
    try {
      var r = await C.from('members').select('*').eq('id', me.user.id).maybeSingle();
      var m = r.data || {};
      var got = [];
      var name = firstOf(m, PICK.name);
      if (name) { setVal('#rwName', name); got.push('이름'); }
      var ph = firstOf(m, PICK.phone);
      if (ph) { setVal('#rwPhone', ph); got.push('휴대폰'); }
      var tl = firstOf(m, PICK.tel);
      if (tl) { setVal('#rwTel', tl); got.push('전화번호'); }
      var em = firstOf(m, PICK.email) || (me.user.email || '');
      if (em) { setVal('#rwEmail', em); got.push('이메일'); }
      var a1 = firstOf(m, PICK.addr1);
      if (a1) { setVal('#rwAddr1', a1); got.push('주소'); }
      var a2 = firstOf(m, PICK.addr2);
      if (a2) setVal('#rwAddr2', a2);

      drawChecks();
      if (got.length) say('회원정보에서 ' + got.join(' · ') + ' 을 가져왔습니다. 확인하고 고쳐 주십시오.', 'ok');
      else say('회원정보에 가져올 것이 없었습니다. 직접 적어 주십시오.', 'warn');
    } catch (e) {
      say('회원정보를 읽지 못했습니다. 직접 적어 주십시오.', 'warn');
    }
  }

  /* ============================================================
     작성 도우미 — 오른쪽 칸
     ============================================================ */

  /* 꼭 채울 것 — need() 와 <b>같은 목록</b>입니다.
     두 곳에 따로 적으면 한쪽만 고쳐져 「도우미는 다 켜졌는데
     저장하면 빠졌다고 하는」 어긋남이 생깁니다.
     그래서 이 표 하나를 need() 도 함께 씁니다. */
  var MUST = [
    { sel: '#rwTitle',     label: '제목',      ok: function () { return !!val('#rwTitle'); } },
    { sel: '#rwCat1',      label: '희망분야',  ok: function () { return !!val('#rwCat1'); } },
    { sel: '#rwR1',        label: '근무지역',  ok: function () { return !!val('#rwR1'); } },
    { sel: '#rwName',      label: '이름',      ok: function () { return !!val('#rwName'); } },
    { sel: '#rwBy',        label: '생년월일',  ok: function () { return !!val('#rwBy'); } },
    { sel: '#rwGenderBox', label: '성별',      ok: function () { return !!radio('rw-gender'); } },
    { sel: '#rwPhone',     label: '휴대폰',    ok: function () { return !!val('#rwPhone'); } },
    { sel: '#rwAgree',     label: '약관 동의', ok: function () { var x = el('#rwAgree'); return !!(x && x.checked); } },
  ];

  /* ── 채용등록 — 꼭 채울 것 ── */
  var MUST_J = [
    { sel: '#rwTitle',   label: '채용제목',  ok: function () { return !!val('#rwTitle'); } },
    { sel: '#rwOrgName', label: '단체명',    ok: function () { return !!val('#rwOrgName'); } },
    { sel: '#rwCat1',    label: '모집직종',  ok: function () { return !!val('#rwCat1'); } },
    { sel: '#rwR1',      label: '근무지역',  ok: function () { return !!val('#rwR1'); } },
    { sel: '#rwApply',   label: '접수기간',  ok: function () {
        return !!val('#rwApplyTo') || chk('#rwAlways') || chk('#rwUntilHired'); } },
    { sel: '#rwMethods', label: '접수방법',  ok: function () { return R.checked('#rwMethods', 'rw-method').length > 0; } },
    { sel: '#rwCName',   label: '담당자명',  ok: function () { return !!val('#rwCName'); } },
    { sel: '#rwAgree',   label: '약관 동의', ok: function () { return chk('#rwAgree'); } },
  ];

  var SOFT_J = [
    { sel: '#rwDuty',       label: '담당업무',     ok: function () { return !!val('#rwDuty'); } },
    { sel: '#rwHeadcount',  label: '모집인원',     ok: function () { return !!val('#rwHeadcount'); } },
    { sel: '#rwEmp',        label: '근무형태',     ok: function () { return R.checked('#rwEmp', 'rw-emp').length > 0; } },
    { sel: '#rwPayType',    label: '급여사항',     ok: function () { return !!val('#rwPayType'); } },
    { sel: '#rwBody',       label: '상세모집내용', ok: function () { return !!val('#rwBody'); } },
    { sel: '#rwCEmail',     label: '이메일',       ok: function () { return !!val('#rwCEmail'); } },
    { sel: '#rwOrgId',      label: '단체DB 연결',  ok: function () { return !!val('#rwOrgId'); } },
  ];

  /* 권장 — 없어도 담기지만, 있으면 뽑는 쪽이 훨씬 잘 봅니다 */
  var SOFT = [
    { sel: '#rwSchools', label: '학력 한 곳 이상', ok: function () { return readSchools().length > 0; } },
    { sel: '#rwCareer',  label: '경력사항',        ok: function () { return !!val('#rwCareer'); } },
    { sel: '#rwBody',    label: '자기소개서',      ok: function () { return !!val('#rwBody'); } },
    { sel: '#rwPayType', label: '희망급여',        ok: function () { return !!val('#rwPayType'); } },
    { sel: '#rwPhoto',   label: '사진',            ok: function () { return !!val('#rwPhotoUrl'); } },
  ];

  /* 갈래에 맞는 목록을 돌려줍니다 — 도우미와 need() 가 함께 씁니다 */
  function musts() { return MODE === 'job' ? MUST_J : MUST; }
  function softs() { return MODE === 'job' ? SOFT_J : SOFT; }
  function chk(sel) { var x = el(sel); return !!(x && x.checked); }

  function drawChecks() {
    var line = function (it) {
      var on = false;
      try { on = !!it.ok(); } catch (e) { on = false; }
      return '<li class="' + (on ? 'is-on' : '') + '">'
        + '<button type="button" data-go="' + it.sel + '">'
        + '<i aria-hidden="true"></i><span>' + esc(it.label) + '</span></button></li>';
    };

    var M = musts(), S = softs();
    var must = el('#rwCheck');
    if (must) must.innerHTML = M.map(line).join('');
    var soft = el('#rwCheckSoft');
    if (soft) soft.innerHTML = '<li class="rw-check-h">권장</li>' + S.map(line).join('');

    var done = M.filter(function (it) { try { return !!it.ok(); } catch (e) { return false; } }).length;
    var bar = el('#rwProgBar');
    if (bar) bar.style.width = Math.round(done / M.length * 100) + '%';
    var txt = el('#rwProgTxt');
    if (txt) txt.textContent = '꼭 채울 것 ' + done + ' / ' + M.length;
  }

  /* 못 채운 줄을 누르면 그 칸으로 데려갑니다 */
  function bindChecks() {
    ['#rwCheck', '#rwCheckSoft'].forEach(function (id) {
      var box = el(id);
      if (!box) return;
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-go]');
        if (!b) return;
        var t = el(b.getAttribute('data-go'));
        if (!t) return;
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try { t.focus({ preventScroll: true }); } catch (err) {}
      });
    });
  }

  /* ── 내가 등록한 인재정보 ─────────────────────────────────
     여러 개를 둘 수 있으므로(연주용·강사용 따로) 목록으로 보입니다.
     고치러 가는 길과 보러 가는 길을 함께 둡니다. */
  async function drawMine() {
    if (!me || !me.user) return;
    var box = el('#rwMine'), wrap = el('#rwMineBox');
    if (!box || !wrap) return;
    try {
      var r = await C.from(TABLE)
        .select(MODE === 'job' ? 'id,title,hidden,created_at' : 'id,title,is_open,created_at')
        .eq('member_id', me.user.id)
        .order('created_at', { ascending: false })
        .limit(6);
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) { wrap.hidden = true; return; }

      box.innerHTML = rows.map(function (o) {
        var on = String(o.id) === String(editId);
        var d = String(o.created_at || '').slice(2, 10).replace(/-/g, '.');
        return '<div class="rw-mine-row' + (on ? ' is-now' : '') + '">'
          + '<a class="rw-mine-t" href="' + cfg.viewPage + '?id=' + encodeURIComponent(o.id) + '">'
          +   esc(o.title || '(제목 없음)') + '</a>'
          + '<div class="rw-mine-m">'
          +   '<span>' + esc(d) + '</span>'
          +   (o.is_open === false ? '<em class="rw-off">숨김</em>' : '')
          +   (on ? '<em class="rw-now">지금 고치는 중</em>'
                  : '<a href="' + location.pathname + '?id=' + encodeURIComponent(o.id) + '">고치기</a>')
          + '</div></div>';
      }).join('');
      wrap.hidden = false;
    } catch (e) {
      wrap.hidden = true;
    }
  }

  /* ── 오른쪽 칸이 붙는 자리 ────────────────────────────────
     인재정보 목록의 찾는 칸과 같은 방식입니다 —
     화면에 들어가면 위쪽에, 화면보다 길면 아래쪽 끝이 보이는 자리에.
     그러지 않으면 도우미의 아래쪽(작성완료 단추)에 손이 닿지 않습니다. */
  var GAP = 24;
  function measureAside() {
    var box = el('#rwAside');
    if (!box) return;
    var host = el('.rw-layout') || document.body;
    var rcTop = parseFloat(getComputedStyle(host).getPropertyValue('--rc-top')) || 120;
    var h = Math.round(box.getBoundingClientRect().height);
    var room = window.innerHeight - rcTop - GAP;
    var top = (h <= room) ? rcTop : (window.innerHeight - h - GAP);
    document.documentElement.style.setProperty('--rw-aside-top', Math.round(top) + 'px');
  }

  /* ── 사진 올리기 ──────────────────────────────────────────
     ★ 원본을 그대로 올리지 않습니다.
       요즘 휴대폰 사진은 한 장에 4~8MB 입니다. 그대로 올리면
       올리는 사람도 보는 사람도 느려지고 저장소도 빨리 찹니다.
       화면에서 긴 쪽 800px, JPEG 로 줄여 올립니다(대개 100KB 안쪽).

     ★ 실패해도 등록은 됩니다 — 사진은 없어도 되는 것입니다. */
  function shrink(file) {
    return new Promise(function (done, fail) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight;
          var r = Math.min(1, PHOTO_MAX / Math.max(w, h));
          var cw = Math.round(w * r), ch = Math.round(h * r);
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          cv.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            blob ? done(blob) : fail(new Error('canvas'));
          }, 'image/jpeg', 0.85);
        } catch (e) { URL.revokeObjectURL(url); fail(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); fail(new Error('image')); };
      img.src = url;
    });
  }

  function showPhoto(url) {
    var box = el('#rwPhotoBox');
    if (!box) return;
    if (url) {
      box.innerHTML = '<img src="' + esc(url) + '" alt="등록한 사진">'
        + '<button type="button" class="rw-photo-x" id="rwPhotoDel">사진 지우기</button>';
      var d = el('#rwPhotoDel');
      if (d) d.addEventListener('click', function () { setVal('#rwPhotoUrl', ''); showPhoto(''); drawChecks(); });
    } else {
      box.innerHTML = '<span class="rw-photo-none">사진 없음</span>';
    }
  }

  async function uploadPhoto(file) {
    if (!me || !me.user) { say('로그인이 필요합니다.', 'warn'); return; }
    if (!/^image\//.test(file.type)) { say('이미지 파일만 올릴 수 있습니다.', 'warn'); return; }

    var st = el('#rwPhotoState');
    if (st) { st.hidden = false; st.textContent = '사진을 줄여 올리는 중…'; }

    try {
      var blob = await shrink(file);
      var path = me.user.id + '/talent-' + Date.now() + '.jpg';
      var up = await C.storage.from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;

      var pub = C.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      var url = pub && pub.data && pub.data.publicUrl;
      if (!url) throw new Error('url');

      setVal('#rwPhotoUrl', url);
      showPhoto(url);
      drawChecks();
      if (st) st.hidden = true;
    } catch (e) {
      if (st) st.hidden = true;
      var m = String((e && e.message) || '');
      if (/bucket/i.test(m)) {
        say('사진 저장소가 아직 준비되지 않았습니다. 사진 없이도 등록하실 수 있습니다.', 'warn');
      } else {
        say('사진을 올리지 못했습니다. 사진 없이도 등록하실 수 있습니다.<br>' + esc(m), 'warn');
      }
    }
  }

  /* ── 빠진 것 짚기 ─────────────────────────────────────────*/
  function need() {
    return musts().filter(function (it) {
      try { return !it.ok(); } catch (e) { return true; }
    }).map(function (it) { return [it.sel, it.label]; });
  }

  /* ── 담기 ─────────────────────────────────────────────────*/
  function gather() { return MODE === 'job' ? gatherJob() : gatherTalent(); }

  /* 채용공고 — 시안(03_채용등록)의 네 묶음을 그대로 담습니다 */
  function gatherJob() {
    var orgDb = val('#rwOrgDb') || 'org';
    return {
      title: val('#rwTitle'),
      org_name: val('#rwOrgName'),
      /* 어느 DB의 몇 번인가 — 상세 화면의 「단체정보 상세보기」 가 이 짝을 씁니다.
         DB에서 고르지 않았으면 번호가 비고, 그때는 그 DB의 목록으로 갑니다. */
      org_db: orgDb,
      org_id: num(val('#rwOrgId')),
      org_field: val('#rwOrgField'),
      org_home: val('#rwOrgHome'),
      org_addr: [val('#rwOrgZip') ? '(' + val('#rwOrgZip') + ')' : '',
                 val('#rwOrgAddr1'), val('#rwOrgAddr2')]
                .filter(function (x) { return x; }).join(' '),

      job_cat1: val('#rwCat1'), job_cat2: val('#rwCat2'), job_etc: val('#rwJobEtc'),
      region1: val('#rwR1'), region2: val('#rwR2'),
      duty: val('#rwDuty'),
      headcount: num(val('#rwHeadcount')),
      emp_types: R.checked('#rwEmp', 'rw-emp'),
      work_days: val('#rwDays'),
      work_start: val('#rwStart'), work_end: val('#rwEnd'),
      pay_type: val('#rwPayType'), pay_amount: val('#rwPayAmount'),
      pay_daily: chk('#rwPayDaily'),
      audition: radio('rw-aud'),
      /* 여러 곡을 줄바꿈으로 이어 한 칸에 담습니다 */
      audition_piece: (radio('rw-aud') === '있음') ? (readAud().join('\n') || null) : null,

      gender: radio('rw-gender') || '무관',
      age_any: chk('#rwAgeAny'),
      age_min: chk('#rwAgeAny') ? null : num(val('#rwAgeMin')),
      age_max: chk('#rwAgeAny') ? null : num(val('#rwAgeMax')),
      edu_any: chk('#rwEduAny'),
      edu: chk('#rwEduAny') ? null : val('#rwEdu'),
      prefer: R.checked('#rwPrefer', 'rw-prefer'),

      body: val('#rwBody'),
      keywords: val('#rwKeywords'),

      apply_from: val('#rwApplyFrom') || null,
      apply_to: (chk('#rwAlways') || chk('#rwUntilHired')) ? null : (val('#rwApplyTo') || null),
      apply_always: chk('#rwAlways'),
      apply_until_hired: chk('#rwUntilHired'),
      apply_methods: R.checked('#rwMethods', 'rw-method'),
      contact_name: val('#rwCName'),
      contact_email: val('#rwCEmail'),
      contact_phone: val('#rwCPhone'),
      contact_fax: val('#rwCFax'),
    };
  }

  function gatherTalent() {
    var by = num(val('#rwBy'));
    var tel = el('#rwTelSame') && el('#rwTelSame').checked ? val('#rwPhone') : val('#rwTel');

    return {
      title: val('#rwTitle'),
      job_cat1: val('#rwCat1'), job_cat2: val('#rwCat2'), job_etc: val('#rwJobEtc'),
      pay_type: val('#rwPayType'), pay_amount: val('#rwPayAmount'),
      pay_daily: !!(el('#rwPayDaily') && el('#rwPayDaily').checked),
      region1: val('#rwR1'), region2: val('#rwR2'),
      emp_types: R.checked('#rwEmp', 'rw-emp'),
      now_status: radio('rw-status'),
      name: val('#rwName'),
      birth_year: by, birth_month: num(val('#rwBm')), birth_day: num(val('#rwBd')),
      gender: radio('rw-gender'),
      phone: val('#rwPhone'), tel: tel, email: val('#rwEmail'),
      zipcode: val('#rwZip'), addr1: val('#rwAddr1'), addr2: val('#rwAddr2'),
      photo_url: val('#rwPhotoUrl') || null,
      veteran: radio('rw-vet'),
      disability: radio('rw-dis'),
      disability_grade: (radio('rw-dis') === '유') ? val('#rwDisGrade') : null,
      military: radio('rw-mil'),
      military_from: val('#rwMilFrom'), military_to: val('#rwMilTo'),
      schools: readSchools(),
      career: val('#rwCareer'),
      body: val('#rwBody'),
      is_open: !!(el('#rwOpen') && el('#rwOpen').checked),
    };
  }

  async function save() {
    if (busy) return;
    hush();

    var bad = need();
    if (bad.length) {
      say('아래 항목을 채워 주십시오 — <b>' + bad.map(function (b) { return esc(b[1]); }).join(' · ') + '</b>', 'warn');
      var first = el(bad[0][0]);
      if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { first.focus(); } catch (e) {} }
      return;
    }

    busy = true;
    /* 게시 단추는 미리보기 창 안에 있습니다(#rwPublish) */
    var btn = el('#rwPublish');
    if (btn) { btn.disabled = true; btn.textContent = '담는 중…'; }

    try {
      var d = gather();
      var res;
      if (editId) {
        res = await C.from(TABLE).update(d).eq('id', editId).select('id').maybeSingle();
      } else {
        d.member_id = me.user.id;
        res = await C.from(TABLE).insert(d).select('id').maybeSingle();
      }
      if (res.error) throw res.error;
      var id = (res.data && res.data.id) || editId;
      /* 게시했으니 임시저장은 지웁니다 — 남겨 두면 다음에 왔을 때
         「이어서 적기」 가 이미 게시한 내용을 다시 내놓습니다. */
      try {
        await C.from('recruit_drafts').delete()
          .eq('member_id', me.user.id).eq('kind', DRAFT_KIND);
      } catch (e) {}
      location.href = cfg.viewPage + '?id=' + encodeURIComponent(id);
    } catch (e) {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '게시하기'; }
      closePreview();      /* 까닭을 폼에서 읽을 수 있게 창을 닫습니다 */
      var m = String((e && e.message) || '');
      /* 권한 규칙에 막힌 것과 그 밖의 문제를 갈라 알려 줍니다 —
         「알 수 없는 오류」 는 아무 도움이 되지 않습니다. */
      if (/row-level security|permission|policy/i.test(m)) {
        say(MODE === 'job'
          ? '등록 권한이 없습니다. 채용정보는 <b>음악관계자·단체·기업</b> 또는 <b>음악학교</b> 회원만 올릴 수 있습니다.'
          : '등록 권한이 없습니다. 인재정보는 <b>전공자·일반 회원</b>만 올릴 수 있습니다.', 'warn');
      } else {
        say('담지 못했습니다. 잠시 후 다시 시도해 주십시오.<br>' + esc(m), 'warn');
      }
    }
  }

  /* ============================================================
     임시저장 · 미리보기 · 게시
     ============================================================ */

  /* ── 임시저장 ─────────────────────────────────────────────
     ★ 인재정보 표에 담지 않습니다.
       미완성 내용이 그 표에 섞이면 목록·상세·뷰가 모두 그것을
       걸러 내도록 고쳐야 하고, 한 곳만 빠뜨려도 남의 미완성 글이
       목록에 나옵니다. 따로 둔 표(recruit_drafts)에 담습니다.
     회원 한 사람이 갈래마다 하나씩 갖습니다. */
  var DRAFT_KIND = 'talent';   /* initJob 이 'job' 으로 바꿉니다 */

  async function saveDraft(quiet) {
    if (!me || !me.user) { if (!quiet) say('로그인이 필요합니다.', 'warn'); return; }
    try {
      var r = await C.from('recruit_drafts').upsert({
        member_id: me.user.id,
        kind: DRAFT_KIND,
        data: gather(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id,kind' });
      if (r.error) throw r.error;
      if (!quiet) say('임시저장했습니다. 나중에 이 화면에 다시 오시면 이어서 적으실 수 있습니다.', 'ok');
      stampDraft(new Date());
    } catch (e) {
      if (!quiet) say('임시저장하지 못했습니다.<br>' + esc(String((e && e.message) || '')), 'warn');
    }
  }

  function stampDraft(d) {
    var box = el('#rwDraftAt');
    if (!box || !d) return;
    var t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    box.textContent = '임시저장 ' + t;
    box.hidden = false;
  }

  /* 적던 것이 있으면 이어서 적을지 물어봅니다.
     묻지 않고 덮어씌우면 「내가 안 적은 것이 적혀 있는」 놀람이 됩니다. */
  async function offerDraft() {
    if (!me || !me.user || editId) return;      /* 고치는 중이면 묻지 않습니다 */
    try {
      var r = await C.from('recruit_drafts')
        .select('data,updated_at')
        .eq('member_id', me.user.id).eq('kind', DRAFT_KIND).maybeSingle();
      if (r.error || !r.data || !r.data.data) return;
      var d = r.data.data;
      if (!d || !Object.keys(d).length) return;
      var when = String(r.data.updated_at || '').slice(0, 16).replace('T', ' ');

      var bar = el('#rwDraftBar');
      if (!bar) return;
      bar.innerHTML = '<span>적으시던 내용이 있습니다 <em>' + esc(when) + '</em></span>'
        + '<button type="button" id="rwDraftUse">이어서 적기</button>'
        + '<button type="button" id="rwDraftDrop" class="is-plain">버리기</button>';
      bar.hidden = false;

      var use = el('#rwDraftUse');
      if (use) use.addEventListener('click', function () { fillFrom(d); bar.hidden = true; });
      var drop = el('#rwDraftDrop');
      if (drop) drop.addEventListener('click', async function () {
        bar.hidden = true;
        try { await C.from('recruit_drafts').delete().eq('member_id', me.user.id).eq('kind', DRAFT_KIND); } catch (e) {}
      });
    } catch (e) { /* 임시저장이 없으면 그냥 지나갑니다 */ }
  }

  /* 담긴 덩이를 폼에 되돌립니다 — 고치기(loadForEdit)와 같은 일이므로
     한 함수로 묶어 두 곳에서 함께 씁니다. */
  function fillFrom(o) { return MODE === 'job' ? fillFromJob(o) : fillFromTalent(o); }

  function fillFromJob(o) {
    setVal('#rwTitle', o.title);
    setVal('#rwOrgName', o.org_name);
    setVal('#rwOrgDb', o.org_db || 'org');
    setVal('#rwOrgId', o.org_id == null ? '' : o.org_id);
    markOrgLinked(!!o.org_id);
    setVal('#rwOrgField', o.org_field);
    setVal('#rwOrgHome', o.org_home);
    setVal('#rwOrgAddr1', o.org_addr);
    setVal('#rwCat1', o.job_cat1);
    if (o.job_cat1) { R.fillJobCat2(el('#rwCat2'), o.job_cat1, '2차직종선택'); setVal('#rwCat2', o.job_cat2); }
    setVal('#rwJobEtc', o.job_etc);
    setVal('#rwR1', o.region1);
    if (o.region1) { R.fillRegion2(el('#rwR2'), o.region1, '2차지역선택'); setVal('#rwR2', o.region2); }
    setVal('#rwDuty', o.duty);
    setVal('#rwHeadcount', o.headcount);
    setChecks('rw-emp', o.emp_types);
    setVal('#rwDays', o.work_days);
    setVal('#rwStart', o.work_start); setVal('#rwEnd', o.work_end);
    setVal('#rwPayType', o.pay_type); setVal('#rwPayAmount', o.pay_amount);
    if (el('#rwPayDaily')) el('#rwPayDaily').checked = !!o.pay_daily;
    setRadio('rw-aud', o.audition);
    /* 담긴 것을 줄마다 한 곡으로 되돌립니다.
       옛 자료가 「·」 로 이어져 있으면 그것도 갈라 줍니다. */
    var box = el('#rwAudList');
    if (box) {
      box.innerHTML = '';
      String(o.audition_piece || '')
        .split(/\r?\n|\s+·\s+/)
        .map(function (x) { return x.trim(); })
        .filter(function (x) { return x; })
        .forEach(addAud);
    }
    setRadio('rw-gender', o.gender || '무관');
    if (el('#rwAgeAny')) el('#rwAgeAny').checked = (o.age_any !== false);
    setVal('#rwAgeMin', o.age_min); setVal('#rwAgeMax', o.age_max);
    if (el('#rwEduAny')) el('#rwEduAny').checked = (o.edu_any !== false);
    setVal('#rwEdu', o.edu);
    setChecks('rw-prefer', o.prefer);
    setVal('#rwBody', o.body);
    setVal('#rwKeywords', o.keywords);
    setVal('#rwApplyFrom', o.apply_from); setVal('#rwApplyTo', o.apply_to);
    if (el('#rwAlways')) el('#rwAlways').checked = !!o.apply_always;
    if (el('#rwUntilHired')) el('#rwUntilHired').checked = !!o.apply_until_hired;
    setChecks('rw-method', o.apply_methods);
    setVal('#rwCName', o.contact_name); setVal('#rwCEmail', o.contact_email);
    setVal('#rwCPhone', o.contact_phone); setVal('#rwCFax', o.contact_fax);
    toggleJob();
    drawChecks();
  }

  function fillFromTalent(o) {
    setVal('#rwTitle', o.title);
    setVal('#rwCat1', o.job_cat1);
    if (o.job_cat1) { R.fillJobCat2(el('#rwCat2'), o.job_cat1, '희망분야'); setVal('#rwCat2', o.job_cat2); }
    setVal('#rwJobEtc', o.job_etc);
    setVal('#rwPayType', o.pay_type); setVal('#rwPayAmount', o.pay_amount);
    if (el('#rwPayDaily')) el('#rwPayDaily').checked = !!o.pay_daily;
    setVal('#rwR1', o.region1);
    if (o.region1) { R.fillRegion2(el('#rwR2'), o.region1, '2차지역선택'); setVal('#rwR2', o.region2); }
    setChecks('rw-emp', o.emp_types);
    setRadio('rw-status', o.now_status);
    setVal('#rwName', o.name);
    setVal('#rwBy', o.birth_year);
    setVal('#rwBm', o.birth_month ? pad2(o.birth_month) : '');
    setVal('#rwBd', o.birth_day ? pad2(o.birth_day) : '');
    setRadio('rw-gender', o.gender);
    setVal('#rwPhone', o.phone); setVal('#rwTel', o.tel); setVal('#rwEmail', o.email);
    setVal('#rwZip', o.zipcode); setVal('#rwAddr1', o.addr1); setVal('#rwAddr2', o.addr2);
    setVal('#rwPhotoUrl', o.photo_url);
    showPhoto(o.photo_url || '');
    setRadio('rw-vet', o.veteran); setRadio('rw-dis', o.disability);
    setVal('#rwDisGrade', o.disability_grade);
    setRadio('rw-mil', o.military);
    setVal('#rwMilFrom', o.military_from); setVal('#rwMilTo', o.military_to);
    setVal('#rwCareer', o.career); setVal('#rwBody', o.body);
    if (el('#rwOpen')) el('#rwOpen').checked = (o.is_open !== false);

    var list = o.schools;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = null; } }
    var box = el('#rwSchools');
    if (box && Array.isArray(list) && list.length) {
      box.innerHTML = '';
      list.forEach(addSchool);
    }
    toggleDis();
    drawChecks();
  }

  /* ── 미리보기 ─────────────────────────────────────────────
     ★ 상세 화면(recruit-view.js)의 <b>같은 코드</b>로 그립니다.
       미리보기를 따로 만들면 한쪽만 고쳐져 「미리보기와 실제가
       다른」 일이 반드시 생깁니다.

     빠진 것이 있으면 미리보기 대신 그것을 먼저 알려 줍니다 —
     담을 수 없는 것을 보여 주고 게시 단추를 내놓는 것은 거짓입니다. */
  function preview() {
    hush();
    var bad = need();
    if (bad.length) {
      say('아래 항목을 채우신 뒤에 미리보기를 보실 수 있습니다 — <b>'
        + bad.map(function (b) { return esc(b[1]); }).join(' · ') + '</b>', 'warn');
      var first = el(bad[0][0]);
      if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); try { first.focus(); } catch (e) {} }
      return;
    }
    if (!window.OCRecruitView || !window.OCRecruitView.previewTalent) {
      say('미리보기를 열지 못했습니다. 화면을 새로 불러 주십시오.', 'warn');
      return;
    }

    var body = el('#rwPvBody');
    if (body) {
      body.innerHTML = (MODE === 'job')
        ? window.OCRecruitView.previewJob(gather())
        : window.OCRecruitView.previewTalent(gather());
    }
    var wrap = el('#rwPv');
    if (wrap) {
      wrap.hidden = false;
      document.body.classList.add('rw-noscroll');
      var close = el('#rwPvClose');
      if (close) { try { close.focus(); } catch (e) {} }
    }
  }

  function closePreview() {
    var wrap = el('#rwPv');
    if (wrap) wrap.hidden = true;
    document.body.classList.remove('rw-noscroll');
  }

  /* ── 고칠 때 불러오기 ─────────────────────────────────────*/
  async function loadForEdit(id) {
    try {
      var r = await C.from(TABLE).select('*').eq('id', id).maybeSingle();
      if (r.error) throw r.error;
      var o = r.data;
      if (!o) { say('고치실 내용을 찾지 못했습니다.', 'warn'); return; }

      editId = o.id;
      var h = el('#rwHead');
      if (h) h.textContent = (MODE === 'job') ? '채용정보 고치기' : '인재정보 고치기';
      fillFrom(o);
      if (el('#rwAgree')) el('#rwAgree').checked = true;
      drawChecks();
    } catch (e) {
      say('불러오지 못했습니다. 목록에서 다시 시도해 주십시오.', 'warn');
    }
  }

  /* 장애 「무」 를 고르면 급 칸을 잠급니다 —
     쓸 수 없는 칸이 열려 있으면 적어야 하는 줄로 오해합니다 */
  function toggleDis() {
    var on = (radio('rw-dis') === '유');
    var g = el('#rwDisGrade');
    if (g) { g.disabled = !on; if (!on) g.value = ''; }
  }

  /* 적어도 담기지 않을 때 — 폼과 도우미를 함께 잠급니다.
     한쪽만 잠그면 「도우미의 작성완료」 를 눌러 보게 됩니다. */
  function lock() {
    var f = el('#rwForm'); if (f) f.classList.add('is-locked');
    var a = el('#rwAside'); if (a) a.classList.add('is-locked');
  }

  /* ── 시작 ─────────────────────────────────────────────────*/
  async function initTalent(options) {
    cfg = Object.assign({ listPage: '/recruit/talent.html', viewPage: '/recruit/talent-view.html' }, options || {});
    R = window.OCRecruit;
    if (!R || !window.supabase) { console.error('recruit.js · supabase-js 를 먼저 불러야 합니다.'); return; }
    C = window.supabase.createClient(SB, KEY);

    /* 분류 채우기 */
    R.bindPair('#rwCat1', '#rwCat2', 'job', '직종선택', '희망분야');
    R.bindPair('#rwR1', '#rwR2', 'region', '1차지역선택', '2차지역선택');
    R.fill(el('#rwPayType'), R.PAY_TYPES, '급여선택');
    R.fillChecks(el('#rwEmp'), R.EMP_TYPES, 'rw-emp');
    R.fillRadios(el('#rwStatus'), R.NOW_STATUS, 'rw-status', R.NOW_STATUS[1]);
    R.fillRadios(el('#rwGenderBox'), ['남성', '여성'], 'rw-gender', '');
    /* 성별은 <b>고르지 않은 채</b>로 둡니다.
       fillRadios 는 기본값이 없으면 첫 것을 켜는데, 그러면 「남성」 이
       미리 골라져 꼭 채워야 하는 칸을 확인하는 뜻이 사라집니다. */
    els('input[name="rw-gender"]').forEach(function (x) { x.checked = false; });
    R.fillRadios(el('#rwVet'), ['비대상', '대상'], 'rw-vet', '비대상');
    R.fillRadios(el('#rwDis'), ['무', '유'], 'rw-dis', '무');
    R.fillRadios(el('#rwMil'), ['해당없음', '필', '미필', '복무중'], 'rw-mil', '해당없음');
    R.fill(el('#rwDisGrade'), ['1급', '2급', '3급', '4급', '5급', '6급'], '급 선택');
    var thisYear = new Date().getFullYear();
    R.fill(el('#rwBy'), years(1940, thisYear - 10), '년');
    R.fill(el('#rwBm'), months(), '월');
    R.fill(el('#rwBd'), days(), '일');
    R.fill(el('#rwMilFrom'), years(1980, thisYear), '입대년');
    R.fill(el('#rwMilTo'), years(1980, thisYear + 3), '전역년');
    toggleDis();
    addSchool();

    /* 도우미를 먼저 켭니다 — 로그인하지 않은 분에게도 「무엇을 적게
       되는지」 는 보이는 편이 낫습니다. 잠기면 흐려지기만 합니다. */
    drawChecks();
    bindChecks();
    measureAside();

    /* 로그인·권한 미리 보기 */
    var s = await C.auth.getSession();
    var u = s.data && s.data.session && s.data.session.user;
    if (!u) {
      say('인재정보를 올리시려면 먼저 로그인해 주십시오. '
        + '<a class="rw-lk" href="' + LOGIN_PAGE + '?next='
        + encodeURIComponent(location.pathname + location.search) + '">로그인하기</a>', 'warn');
      lock();
      return;
    }
    var mr = await C.from('members').select('member_type,is_admin').eq('id', u.id).maybeSingle();
    var m = mr.data || {};
    me = { user: u, type: m.member_type || '', admin: !!m.is_admin };
    if (!(m.member_type === 'major' || m.member_type === 'general' || m.is_admin)) {
      say('인재정보는 <b>전공자</b> 또는 <b>일반</b> 회원만 올릴 수 있습니다. '
        + '단체·기업·학교 회원은 <a class="rw-lk" href="/recruit/job-write.html">채용정보</a>를 올려 주십시오.', 'warn');
      lock();
      return;
    }

    /* 고치기 */
    var id = new URLSearchParams(location.search).get('id');
    if (id) await loadForEdit(id);

    /* 단추 잇기 */
    var pull = el('#rwPull');
    if (pull) pull.addEventListener('click', pullMe);
    var ph = el('#rwPhoto');
    if (ph) ph.addEventListener('change', function () {
      if (ph.files && ph.files[0]) uploadPhoto(ph.files[0]);
      ph.value = '';     /* 같은 파일을 다시 골라도 듣게 비웁니다 */
    });
    showPhoto(val('#rwPhotoUrl'));
    var addBtn = el('#rwAddSchool');
    if (addBtn) addBtn.addEventListener('click', function () { addSchool(); });
    /* 미리보기 → 그 안에서 「고치기」 또는 「게시하기」 를 고릅니다.
       바로 게시하지 않는 까닭 — 남에게 어떻게 보이는지 한 번 보고
       나서 내놓는 편이 낫고, 특히 이름 가림막이 어떻게 걸리는지
       확인할 자리가 필요합니다. */
    ['#rwPreview', '#rwPreview2'].forEach(function (id) {
      var b = el(id);
      if (b) b.addEventListener('click', preview);
    });
    ['#rwDraft', '#rwDraft2'].forEach(function (id) {
      var b = el(id);
      if (b) b.addEventListener('click', function () { saveDraft(false); });
    });
    var pub = el('#rwPublish');
    if (pub) pub.addEventListener('click', save);
    ['#rwPvClose', '#rwPvEdit', '#rwPvDim'].forEach(function (id) {
      var b = el(id);
      if (b) b.addEventListener('click', closePreview);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePreview();
    });

    /* 작성 도우미 — 무엇이든 적거나 고를 때마다 다시 셉니다.
       한 곳(#rwForm)에서 받아 두면 나중에 칸이 늘어도 그대로 듣습니다. */
    drawChecks();
    bindChecks();
    var form = el('#rwForm');
    if (form) {
      form.addEventListener('input', drawChecks);
      form.addEventListener('change', drawChecks);
      form.addEventListener('click', function (e) {
        /* 학교 지우기·추가는 click 으로 일어나므로 조금 뒤에 셉니다 */
        if (e.target.closest('.sc-del, #rwAddSchool')) setTimeout(drawChecks, 0);
      });
    }
    drawMine();
    offerDraft();

    measureAside();
    setTimeout(measureAside, 300);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measureAside);
      var ab = el('#rwAside');
      if (ab) ro.observe(ab);
    }
    window.addEventListener('resize', measureAside);
    els('input[name="rw-dis"]').forEach(function (x) { x.addEventListener('change', toggleDis); });
    var same = el('#rwTelSame');
    if (same) same.addEventListener('change', function () {
      var t = el('#rwTel'); if (t) t.disabled = same.checked;
    });

    /* 학교 줄 — 늘어나므로 한 곳에서 받습니다 */
    var box = el('#rwSchools');
    if (box) box.addEventListener('click', function (e) {
      var row = e.target.closest('.rw-school');
      if (!row) return;
      if (e.target.closest('.sc-del')) {
        if (els('#rwSchools .rw-school').length <= 1) { addSchool(); }
        row.remove();
        return;
      }
      if (e.target.closest('.sc-find')) { findSchool(row); return; }
      var pick = e.target.closest('.sc-pick');
      if (pick) {
        var nm = el('.sc-name', row);
        if (nm) nm.value = pick.getAttribute('data-name') || '';
        row.setAttribute('data-school-id', pick.getAttribute('data-id') || '');
        var tag = el('.sc-linked', row); if (tag) tag.hidden = false;
        var out = el('.sc-results', row); if (out) { out.hidden = true; out.innerHTML = ''; }
      }
    });
    /* 학교명을 손으로 고치면 DB 연결을 풉니다 —
       고른 학교와 다른 이름이 담기면 이어짐이 거짓이 됩니다 */
    if (box) box.addEventListener('input', function (e) {
      if (!e.target.classList.contains('sc-name')) return;
      var row = e.target.closest('.rw-school');
      if (!row) return;
      row.setAttribute('data-school-id', '');
      var tag = el('.sc-linked', row); if (tag) tag.hidden = true;
    });
  }

  /* ============================================================
     채용등록 — initJob
     ============================================================ */

  /* 단체 찾기 — 네 DB 가운데 고른 곳을 뒤집니다.
     ★ 여기가 네트워킹의 고리입니다.
       고르면 org_db + org_id 가 담기고, 채용 상세의
       「회사 / 단체정보 상세보기」 가 그 단체 화면으로 바로 갑니다.
       고르지 않고 이름만 적어도 등록은 됩니다 — 막다른 길은
       만들지 않되, 고르시도록 권합니다(도우미의 권장 항목). */
  function markOrgLinked(on) {
    var tag = el('#rwOrgLinked');
    if (tag) tag.hidden = !on;
  }

  async function findOrg() {
    var out = el('#rwOrgRes');
    var kw = val('#rwOrgName');
    var key = val('#rwOrgDb') || 'org';
    var db = ORG_DBS[key];
    if (!out || !db) return;
    if (kw.length < 2) {
      out.hidden = false;
      out.innerHTML = '<p class="sc-hint">단체명을 두 글자 이상 적고 다시 눌러 주십시오.</p>';
      return;
    }
    out.hidden = false;
    out.innerHTML = '<p class="sc-hint">' + esc(db.label) + ' 에서 찾는 중…</p>';
    try {
      var r = await C.from(db.table)
        .select('id,' + db.nameCol)
        .ilike(db.nameCol, '%' + kw + '%')
        .limit(8);
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) {
        out.innerHTML = '<p class="sc-hint">' + esc(db.label) + ' 에서 찾지 못했습니다. '
          + '다른 DB를 골라 보시거나, 적으신 이름 그대로 등록하셔도 됩니다.</p>';
        return;
      }
      out.innerHTML = rows.map(function (x) {
        return '<button type="button" class="sc-pick" data-id="' + esc(x.id) + '"'
          + ' data-name="' + esc(x[db.nameCol] || '') + '">'
          + esc(x[db.nameCol] || '') + '</button>';
      }).join('');
    } catch (e) {
      out.innerHTML = '<p class="sc-hint">' + esc(db.label) + ' 을 읽지 못했습니다. '
        + '단체명을 직접 적으셔도 등록됩니다.</p>';
    }
  }

  /* ── 오디션 지정곡 ────────────────────────────────────────
     한 곡이 아닐 때가 많습니다 — 협주곡 한 악장, 무반주 한 곡,
     오케스트라 발췌 몇 개가 함께 지정되는 것이 보통입니다.
     그래서 한 줄에 한 곡씩 늘려 적게 합니다.

     담을 때는 <b>줄바꿈으로 이어</b> 한 칸(audition_piece)에 넣습니다.
     칸을 새로 만들지 않아도 되고, 상세 화면이 줄바꿈을 살려 그리므로
     줄마다 나뉘어 보입니다. */
  function audRow(v) {
    return '<div class="rw-audrow">'
      + '<input type="text" class="aud-p" maxlength="300" value="' + esc(v || '') + '"'
      + ' placeholder="예 — W.A. Mozart 바이올린 협주곡 제4번 제1악장 (카덴차 포함)">'
      + '<button type="button" class="rw-del aud-del" aria-label="이 곡 지우기">지우기</button>'
      + '</div>';
  }

  function addAud(v) {
    var box = el('#rwAudList');
    if (box) box.insertAdjacentHTML('beforeend', audRow(v));
  }

  function readAud() {
    return els('#rwAudList .aud-p')
      .map(function (x) { return String(x.value || '').trim(); })
      .filter(function (x) { return x; });
  }

  /* 「무관」 을 켜면 나이·학력 칸을 잠급니다.
     오디션이 「없음」 이면 곡명 칸도 잠급니다.
     쓸 수 없는 칸이 열려 있으면 적어야 하는 줄로 오해합니다. */
  function toggleJob() {
    var ageAny = chk('#rwAgeAny');
    ['#rwAgeMin', '#rwAgeMax'].forEach(function (id) {
      var x = el(id); if (x) { x.disabled = ageAny; if (ageAny) x.value = ''; }
    });
    var eduAny = chk('#rwEduAny');
    var e = el('#rwEdu'); if (e) { e.disabled = eduAny; if (eduAny) e.value = ''; }

    /* 오디션이 「없음」 이면 곡 칸을 감춥니다 —
       잠그기만 하면 쓸 수 없는 칸이 자리를 차지해 답답합니다. */
    var aud = (radio('rw-aud') === '있음');
    var list = el('#rwAudList'), addb = el('#rwAudAdd');
    if (list) list.hidden = !aud;
    if (addb) addb.hidden = !aud;
    if (aud && list && !els('#rwAudList .rw-audrow').length) addAud('');

    /* 상시모집·채용시까지면 마감일을 잠급니다 — 두 값이 어긋나면
       목록의 마감순 정렬이 뒤죽박죽이 됩니다. */
    var noEnd = chk('#rwAlways') || chk('#rwUntilHired');
    var at = el('#rwApplyTo'); if (at) { at.disabled = noEnd; if (noEnd) at.value = ''; }
  }

  async function initJob(options) {
    cfg = Object.assign({ listPage: '/recruit/job.html', viewPage: '/recruit/job-view.html' }, options || {});
    MODE = 'job';
    TABLE = 'recruit_jobs';
    DRAFT_KIND = 'job';
    R = window.OCRecruit;
    if (!R || !window.supabase) { console.error('recruit.js · supabase-js 를 먼저 불러야 합니다.'); return; }
    C = window.supabase.createClient(SB, KEY);

    /* 분류 채우기 */
    R.bindPair('#rwCat1', '#rwCat2', 'job', '1차직종선택', '2차직종선택');
    R.bindPair('#rwR1', '#rwR2', 'region', '1차지역선택', '2차지역선택');
    R.fill(el('#rwDays'), R.WORK_DAYS, '근무요일선택');
    R.fill(el('#rwStart'), R.HOURS, '근무시작시간');
    R.fill(el('#rwEnd'), R.HOURS, '근무종료시간');
    R.fill(el('#rwPayType'), R.PAY_TYPES, '급여선택');
    R.fill(el('#rwEdu'), R.EDU, '학력선택');
    R.fillChecks(el('#rwEmp'), R.EMP_TYPES, 'rw-emp');
    R.fillChecks(el('#rwPrefer'), R.PREFER, 'rw-prefer');
    R.fillChecks(el('#rwMethods'), R.APPLY_METHOD, 'rw-method');
    R.fillRadios(el('#rwGenderBox'), R.GENDERS, 'rw-gender', '무관');
    R.fillRadios(el('#rwAud'), R.AUDITION, 'rw-aud', R.AUDITION[0]);
    /* 어느 DB의 단체인가 */
    R.fill(el('#rwOrgDb'), Object.keys(ORG_DBS).map(function (k) {
      return { value: k, label: ORG_DBS[k].label };
    }), null);
    /* 접수방법은 이메일이 가장 흔하므로 미리 켜 둡니다 */
    setChecks('rw-method', ['이메일']);
    toggleJob();

    drawChecks();
    bindChecks();
    measureAside();

    /* 로그인·권한 미리 보기 */
    var s2 = await C.auth.getSession();
    var u = s2.data && s2.data.session && s2.data.session.user;
    if (!u) {
      say('채용정보를 올리시려면 먼저 로그인해 주십시오. '
        + '<a class="rw-lk" href="' + LOGIN_PAGE + '?next='
        + encodeURIComponent(location.pathname + location.search) + '">로그인하기</a>', 'warn');
      lock();
      return;
    }
    var mr = await C.from('members').select('member_type,is_admin').eq('id', u.id).maybeSingle();
    var m = mr.data || {};
    me = { user: u, type: m.member_type || '', admin: !!m.is_admin };
    if (!(m.member_type === 'industry' || m.member_type === 'school' || m.is_admin)) {
      say('채용정보는 <b>음악관계자·단체·기업</b> 또는 <b>음악학교</b> 회원만 올릴 수 있습니다. '
        + '전공자·일반 회원은 <a class="rw-lk" href="/recruit/talent-write.html">인재정보</a>를 올려 주십시오.', 'warn');
      lock();
      return;
    }

    var id = new URLSearchParams(location.search).get('id');
    if (id) await loadForEdit(id);

    /* 단추 잇기 — 인재등록과 같은 것을 씁니다 */
    ['#rwPreview', '#rwPreview2'].forEach(function (x) {
      var b = el(x); if (b) b.addEventListener('click', preview);
    });
    ['#rwDraft', '#rwDraft2'].forEach(function (x) {
      var b = el(x); if (b) b.addEventListener('click', function () { saveDraft(false); });
    });
    var pub = el('#rwPublish');
    if (pub) pub.addEventListener('click', save);
    ['#rwPvClose', '#rwPvEdit', '#rwPvDim'].forEach(function (x) {
      var b = el(x); if (b) b.addEventListener('click', closePreview);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePreview(); });

    /* 무관·오디션·상시모집 잠금 */
    ['#rwAgeAny', '#rwEduAny', '#rwAlways', '#rwUntilHired'].forEach(function (x) {
      var b = el(x); if (b) b.addEventListener('change', function () { toggleJob(); drawChecks(); });
    });
    els('input[name="rw-aud"]').forEach(function (x) {
      x.addEventListener('change', function () { toggleJob(); drawChecks(); });
    });

    /* 오디션 곡 늘리고 줄이기 */
    var audAdd = el('#rwAudAdd');
    if (audAdd) audAdd.addEventListener('click', function () { addAud(''); drawChecks(); });
    var audList = el('#rwAudList');
    if (audList) audList.addEventListener('click', function (e) {
      if (!e.target.closest('.aud-del')) return;
      var row = e.target.closest('.rw-audrow');
      if (!row) return;
      /* 마지막 한 줄은 남겨 둡니다 — 곡을 적을 자리가 사라지면 안 됩니다 */
      if (els('#rwAudList .rw-audrow').length <= 1) { addAud(''); }
      row.remove();
      drawChecks();
    });

    /* 단체 찾기 */
    var find = el('#rwOrgFind');
    if (find) find.addEventListener('click', findOrg);
    var res = el('#rwOrgRes');
    if (res) res.addEventListener('click', function (e) {
      var pick = e.target.closest('.sc-pick');
      if (!pick) return;
      setVal('#rwOrgName', pick.getAttribute('data-name') || '');
      setVal('#rwOrgId', pick.getAttribute('data-id') || '');
      markOrgLinked(true);
      res.hidden = true; res.innerHTML = '';
      drawChecks();
    });
    var onm = el('#rwOrgName');
    if (onm) onm.addEventListener('input', function () {
      /* 이름을 손으로 고치면 DB 연결을 풉니다 —
         고른 단체와 다른 이름이 담기면 이어짐이 거짓이 됩니다 */
      setVal('#rwOrgId', '');
      markOrgLinked(false);
    });
    var odb = el('#rwOrgDb');
    if (odb) odb.addEventListener('change', function () {
      setVal('#rwOrgId', ''); markOrgLinked(false);
      var o2 = el('#rwOrgRes'); if (o2) { o2.hidden = true; o2.innerHTML = ''; }
    });

    var form = el('#rwForm');
    if (form) {
      form.addEventListener('input', drawChecks);
      form.addEventListener('change', drawChecks);
    }
    drawMine();
    offerDraft();

    setTimeout(measureAside, 300);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measureAside);
      var ab = el('#rwAside'); if (ab) ro.observe(ab);
    }
    window.addEventListener('resize', measureAside);
  }

  window.OCRecruitWrite = { initTalent: initTalent, initJob: initJob };
})();
