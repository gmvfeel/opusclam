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
  var SCHOOL_TABLE = 'schools';          /* ★ 확인 필요 — 음악학교DB 표 이름 */
  var SCHOOL_NAME_COL = 'name_ko';       /* ★ 확인 필요 — 학교명 칸 */

  var R, cfg = null, C = null, me = null, editId = null, busy = false;

  function el(s, root) { return (root || document).querySelector(s); }
  function els(s, root) { return [].slice.call((root || document).querySelectorAll(s)); }
  function val(s) { var x = el(s); return x ? String(x.value || '').trim() : ''; }
  function setVal(s, v) { var x = el(s); if (x) x.value = (v == null ? '' : v); }
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
  }
  function setChecks(name, arr) {
    var a = arr || [];
    els('input[name="' + name + '"]').forEach(function (x) { x.checked = a.indexOf(x.value) >= 0; });
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

      if (got.length) say('회원정보에서 ' + got.join(' · ') + ' 을 가져왔습니다. 확인하고 고쳐 주십시오.', 'ok');
      else say('회원정보에 가져올 것이 없었습니다. 직접 적어 주십시오.', 'warn');
    } catch (e) {
      say('회원정보를 읽지 못했습니다. 직접 적어 주십시오.', 'warn');
    }
  }

  /* ── 빠진 것 짚기 ─────────────────────────────────────────*/
  function need() {
    var bad = [];
    if (!val('#rwTitle')) bad.push(['#rwTitle', '제목']);
    if (!val('#rwCat1')) bad.push(['#rwCat1', '희망분야']);
    if (!val('#rwR1')) bad.push(['#rwR1', '근무지역']);
    if (!val('#rwName')) bad.push(['#rwName', '이름']);
    if (!val('#rwBy')) bad.push(['#rwBy', '생년월일']);
    if (!radio('rw-gender')) bad.push(['#rwGenderBox', '성별']);
    if (!val('#rwPhone')) bad.push(['#rwPhone', '휴대폰']);
    if (!el('#rwAgree').checked) bad.push(['#rwAgree', '약관 동의']);
    return bad;
  }

  /* ── 담기 ─────────────────────────────────────────────────*/
  function gather() {
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
      addr1: val('#rwAddr1'), addr2: val('#rwAddr2'),
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
    var btn = el('#rwSave');
    if (btn) { btn.disabled = true; btn.textContent = '담는 중…'; }

    try {
      var d = gather();
      var res;
      if (editId) {
        res = await C.from('recruit_talents').update(d).eq('id', editId).select('id').maybeSingle();
      } else {
        d.member_id = me.user.id;
        res = await C.from('recruit_talents').insert(d).select('id').maybeSingle();
      }
      if (res.error) throw res.error;
      var id = (res.data && res.data.id) || editId;
      location.href = cfg.viewPage + '?id=' + encodeURIComponent(id);
    } catch (e) {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '작성완료'; }
      var m = String((e && e.message) || '');
      /* 권한 규칙에 막힌 것과 그 밖의 문제를 갈라 알려 줍니다 —
         「알 수 없는 오류」 는 아무 도움이 되지 않습니다. */
      if (/row-level security|permission|policy/i.test(m)) {
        say('등록 권한이 없습니다. 인재정보는 <b>전공자·일반 회원</b>만 올릴 수 있습니다.', 'warn');
      } else {
        say('담지 못했습니다. 잠시 후 다시 시도해 주십시오.<br>' + esc(m), 'warn');
      }
    }
  }

  /* ── 고칠 때 불러오기 ─────────────────────────────────────*/
  async function loadForEdit(id) {
    try {
      var r = await C.from('recruit_talents').select('*').eq('id', id).maybeSingle();
      if (r.error) throw r.error;
      var o = r.data;
      if (!o) { say('고치실 인재정보를 찾지 못했습니다.', 'warn'); return; }

      editId = o.id;
      var h = el('#rwHead'); if (h) h.textContent = '인재정보 고치기';
      setVal('#rwTitle', o.title);
      setVal('#rwCat1', o.job_cat1);
      if (o.job_cat1) {
        R.fillJobCat2(el('#rwCat2'), o.job_cat1, '희망분야');
        setVal('#rwCat2', o.job_cat2);
      }
      setVal('#rwJobEtc', o.job_etc);
      setVal('#rwPayType', o.pay_type); setVal('#rwPayAmount', o.pay_amount);
      if (el('#rwPayDaily')) el('#rwPayDaily').checked = !!o.pay_daily;
      setVal('#rwR1', o.region1);
      if (o.region1) { R.fillRegion2(el('#rwR2'), o.region1, '2차지역선택'); setVal('#rwR2', o.region2); }
      setChecks('rw-emp', o.emp_types);
      setRadio('rw-status', o.now_status);
      setVal('#rwName', o.name);
      setVal('#rwBy', o.birth_year); setVal('#rwBm', o.birth_month ? pad2(o.birth_month) : '');
      setVal('#rwBd', o.birth_day ? pad2(o.birth_day) : '');
      setRadio('rw-gender', o.gender);
      setVal('#rwPhone', o.phone); setVal('#rwTel', o.tel); setVal('#rwEmail', o.email);
      setVal('#rwAddr1', o.addr1); setVal('#rwAddr2', o.addr2);
      setRadio('rw-vet', o.veteran); setRadio('rw-dis', o.disability);
      setVal('#rwDisGrade', o.disability_grade);
      setRadio('rw-mil', o.military);
      setVal('#rwMilFrom', o.military_from); setVal('#rwMilTo', o.military_to);
      setVal('#rwCareer', o.career); setVal('#rwBody', o.body);
      if (el('#rwOpen')) el('#rwOpen').checked = (o.is_open !== false);
      if (el('#rwAgree')) el('#rwAgree').checked = true;

      var list = o.schools;
      if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = null; } }
      var box = el('#rwSchools');
      if (box && Array.isArray(list) && list.length) {
        box.innerHTML = '';
        list.forEach(addSchool);
      }
      toggleDis();
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

    /* 로그인·권한 미리 보기 */
    var s = await C.auth.getSession();
    var u = s.data && s.data.session && s.data.session.user;
    if (!u) {
      say('인재정보를 올리시려면 먼저 로그인해 주십시오. '
        + '<a class="rw-lk" href="' + LOGIN_PAGE + '?next='
        + encodeURIComponent(location.pathname + location.search) + '">로그인하기</a>', 'warn');
      var f = el('#rwForm'); if (f) f.classList.add('is-locked');
      return;
    }
    var mr = await C.from('members').select('member_type,is_admin').eq('id', u.id).maybeSingle();
    var m = mr.data || {};
    me = { user: u, type: m.member_type || '', admin: !!m.is_admin };
    if (!(m.member_type === 'major' || m.member_type === 'general' || m.is_admin)) {
      say('인재정보는 <b>전공자</b> 또는 <b>일반</b> 회원만 올릴 수 있습니다. '
        + '단체·기업·학교 회원은 <a class="rw-lk" href="/recruit/job-write.html">채용정보</a>를 올려 주십시오.', 'warn');
      var f2 = el('#rwForm'); if (f2) f2.classList.add('is-locked');
      return;
    }

    /* 고치기 */
    var id = new URLSearchParams(location.search).get('id');
    if (id) await loadForEdit(id);

    /* 단추 잇기 */
    var pull = el('#rwPull');
    if (pull) pull.addEventListener('click', pullMe);
    var addBtn = el('#rwAddSchool');
    if (addBtn) addBtn.addEventListener('click', function () { addSchool(); });
    var saveBtn = el('#rwSave');
    if (saveBtn) saveBtn.addEventListener('click', save);
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

  window.OCRecruitWrite = { initTalent: initTalent };
})();
