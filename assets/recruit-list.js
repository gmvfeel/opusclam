/* ============================================================
   OPUSCLAM 리쿠르트 목록 엔진 — assets/recruit-list.js

   무엇을 하나
    · 직종구분 표 · 상세검색 · 탭 · 목록 · 페이지 넘김을 그립니다
    · 채용정보와 인재정보가 <b>같은 엔진</b>을 씁니다 (설정만 다릅니다)

   왜 게시판 엔진(board.js)을 쓰지 않나
    리쿠르트는 게시판과 짜임이 다릅니다.
      · 직종을 두 겹으로 가려 봅니다 (오케스트라 › 현악파트)
      · 지역·근무형태·급여·성별을 함께 걸러 봅니다
      · 목록 한 줄에 조건이 여러 개 붙습니다 (경력·학력·지역·형태·급여)
    게시판 엔진에 억지로 얹으면 양쪽이 다 복잡해지므로 따로 두었습니다.

   쓰는 법
     OCRecruitList.init({
       kind: 'job',                    'job'(채용) 또는 'talent'(인재)
       table: 'recruit_jobs',          인재는 'recruit_talents_public'
       viewPage: '/recruit/job-view.html',
       writePage: '/recruit/job-write.html',
       pageSize: 15,
     });
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var R;                       /* OCRecruit — 분류 자료 · 보는 사람 확인 */

  /* ★ 익명 열쇠만 실어 보내면 서버는 언제나 손님으로 봅니다.
     인재정보 뷰는 「채용 회원과 본인」 에게만 줄을 내주므로,
     로그인한 분의 토큰을 실어야 제 것이 보입니다.
     머리글 만드는 일은 공용 모듈(recruit.js)이 맡습니다. */
  function HDRS(extra) { return R.headers(extra); }

  var cfg = null, cur = 1, total = 0;
  /* 지금 걸러 보고 있는 조건 */
  var q = {
    /* 고른 직종들 — 「오케스트라|현악파트」 꼴로 담습니다.
       여러 개를 함께 고를 수 있습니다 (현악파트와 관악파트를 같이 보기) */
    jobs: [],
    r1: '', r2: '',
    /* 고른 근무형태들 — 여러 개를 함께 고를 수 있습니다 */
    emps: [], days: '', pay: '',
    /* 성별 — 인재정보 화면에만 있습니다. 빈 값이 「전체」 입니다.
       화면에 성별 칸이 없으면 이 값은 끝까지 빈 채로 남습니다. */
    gender: '',
    kw: '', tab: '', sort: 'created_at.desc',
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(sel) { return document.querySelector(sel); }

  /* ── 자료 받기 ────────────────────────────────────────────*/
  async function fetchRows(from, size) {
    var p = ['select=*'];

    if (cfg.kind === 'job') p.push('hidden=is.false');

    /* 고른 직종 — 여러 개면 「이 가운데 하나라도」 로 묶습니다.
       대분류만 고른 것과 소분류까지 고른 것이 섞일 수 있어
       각각을 and 로 묶고 그것들을 or 로 잇습니다. */
    if (q.jobs && q.jobs.length) {
      var terms = q.jobs.map(function (v) {
        var a = v.split('|');
        return a[1]
          ? 'and(job_cat1.eq.' + encodeURIComponent(a[0]) + ',job_cat2.eq.' + encodeURIComponent(a[1]) + ')'
          : 'job_cat1.eq.' + encodeURIComponent(a[0]);
      });
      p.push(terms.length === 1 && terms[0].indexOf('and(') !== 0
        ? terms[0].replace('.eq.', '=eq.')
        : 'or=(' + terms.join(',') + ')');
    }
    if (q.r1)   p.push('region1=eq.' + encodeURIComponent(q.r1));
    if (q.r2)   p.push('region2=eq.' + encodeURIComponent(q.r2));

    /* 근무형태 — 여러 값을 담은 칸입니다.
       고른 것 가운데 <b>하나라도 겹치면</b> 보여 줍니다(ov = overlap).
       「정규직 또는 계약직」 처럼 넓게 찾을 수 있습니다. */
    if (q.emps && q.emps.length) {
      p.push('emp_types=ov.%7B' + q.emps.map(encodeURIComponent).join(',') + '%7D');
    }

    if (q.days) p.push('work_days=eq.' + encodeURIComponent(q.days));

    /* 성별 — 인재정보에만 있는 칸입니다 */
    if (q.gender) p.push('gender=eq.' + encodeURIComponent(q.gender));

    if (q.kw) {
      var k = encodeURIComponent('%' + q.kw + '%');
      var cols = (cfg.kind === 'job')
        ? ['title', 'org_name', 'duty', 'body', 'job_etc', 'keywords']
        : ['title', 'career', 'body', 'job_etc'];
      p.push('or=(' + cols.map(function (c) { return c + '.ilike.' + k; }).join(',') + ')');
    }

    p.push('order=' + (q.sort || 'created_at.desc'));
    p.push('limit=' + size);
    p.push('offset=' + from);

    var res = await fetch(SB + '/rest/v1/' + cfg.table + '?' + p.join('&'),
      { headers: await HDRS({ Prefer: 'count=exact' }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    /* 전체 건수는 머리글에 실려 옵니다 */
    var cr = res.headers.get('content-range') || '';
    var m = cr.match(/\/(\d+)$/);
    if (m) total = Number(m[1]);

    return await res.json();
  }

  /* ── 직종구분 표 ──────────────────────────────────────────*/
  /* 직종구분 — 체크 상자로 고릅니다.
     여러 개를 함께 고를 수 있습니다. 대분류 이름을 누르면 그 줄이 통째로
     켜지거나 꺼집니다. */
  function drawJobTable() {
    var box = el('#rcJobs');
    if (!box) return;
    var html = '';
    Object.keys(R.JOBS).forEach(function (c1, ri) {
      var mine = R.JOBS[c1].map(function (c2) { return c1 + '|' + c2; });
      var allOn = mine.every(function (v) { return q.jobs.indexOf(v) >= 0; });
      html += '<div class="rc-jobrow">'
        + '<button type="button" class="rc-job1' + (allOn ? ' on' : '') + '"'
        + ' data-all="' + esc(c1) + '" title="' + esc(c1) + ' 전체 고르기/풀기">'
        + esc(c1) + '</button>'
        + '<div class="rc-job2">';
      R.JOBS[c1].forEach(function (c2, i) {
        var v = c1 + '|' + c2;
        var on = q.jobs.indexOf(v) >= 0;
        var id = 'rcjob-' + ri + '-' + i;
        html += '<label class="rc-jobck" for="' + id + '">'
          + '<input type="checkbox" id="' + id + '" value="' + esc(v) + '"'
          + (on ? ' checked' : '') + '>'
          + '<span>' + esc(c2) + '</span></label>';
      });
      html += '</div></div>';
    });
    box.innerHTML = html;
    syncCat();
  }

  /* ── 직종별 풀다운 ────────────────────────────────────────
     왼쪽 직종구분 체크 상자와 <b>같은 상태(q.jobs)를 함께 씁니다.</b>
     따로 두면 두 곳에 서로 다른 값이 걸려 어느 쪽이 이겼는지
     알 수 없게 됩니다. 그래서 풀다운은 「대분류를 한 번에 고르는
     빠른 길」 로만 두고, 고른 결과는 언제나 왼쪽에 그대로 비칩니다.

     고른 것들이 한 대분류에만 들어 있으면 그 대분류를 가리키고,
     여러 대분류가 섞이면 「전체」 로 돌립니다(왼쪽이 더 정밀하므로). */
  function syncCat() {
    var sel = el('#rcCat');
    if (!sel) return;
    var cats = {};
    (q.jobs || []).forEach(function (v) { cats[v.split('|')[0]] = 1; });
    var keys = Object.keys(cats);
    sel.value = (keys.length === 1) ? keys[0] : '';
  }

  function bindCat() {
    var sel = el('#rcCat');
    if (!sel) return;
    R.fill(sel, Object.keys(R.JOBS), '전체');
    sel.value = '';
    sel.addEventListener('change', function () {
      var c1 = sel.value;
      if (!c1) {
        q.jobs = [];
      } else {
        /* 그 대분류의 소분류를 통째로 켭니다 — 다른 대분류는 풉니다.
           풀다운은 「이 갈래만 보겠다」 는 뜻이기 때문입니다. */
        q.jobs = (R.JOBS[c1] || []).map(function (c2) { return c1 + '|' + c2; });
      }
      drawJobTable();
      go(1);
    });
  }

  function bindJobTable() {
    var box = el('#rcJobs');
    if (!box) return;

    /* 체크 상자를 누를 때 */
    box.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.type !== 'checkbox') return;
      var v = cb.value;
      var at = q.jobs.indexOf(v);
      if (cb.checked && at < 0) q.jobs.push(v);
      if (!cb.checked && at >= 0) q.jobs.splice(at, 1);
      drawJobTable();
      go(1);
    });

    /* 대분류 이름을 누르면 그 줄을 통째로 켜거나 끕니다 */
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-all]');
      if (!b) return;
      var c1 = b.getAttribute('data-all');
      var mine = R.JOBS[c1].map(function (c2) { return c1 + '|' + c2; });
      var allOn = mine.every(function (v) { return q.jobs.indexOf(v) >= 0; });
      if (allOn) {
        q.jobs = q.jobs.filter(function (v) { return mine.indexOf(v) < 0; });
      } else {
        mine.forEach(function (v) { if (q.jobs.indexOf(v) < 0) q.jobs.push(v); });
      }
      drawJobTable();
      go(1);
    });
  }

  /* ── 상세검색 ─────────────────────────────────────────────*/
  function drawSearch() {
    var box = el('#rcSearch');
    if (!box) return;

    R.bindPair('#rcR1', '#rcR2', 'region');
    R.fill(el('#rcDays'), R.WORK_DAYS, '근무요일선택');
    R.fill(el('#rcPay'), R.PAY_BANDS.map(function (b) {
      return { value: b.label, label: b.label };
    }), null);
    /* 근무형태 — 「무관」 은 뺍니다. 아무것도 고르지 않은 것이 곧 무관입니다. */
    R.fillChecks(el('#rcEmp'),
      R.EMP_SEARCH.filter(function (t) { return t !== '무관'; }), 'rc-emp');

    var go2 = el('#rcGo'), reset = el('#rcReset');
    if (go2) go2.addEventListener('click', function () {
      q.r1 = (el('#rcR1') || {}).value || '';
      q.r2 = (el('#rcR2') || {}).value || '';
      q.days = (el('#rcDays') || {}).value || '';
      q.pay = (el('#rcPay') || {}).value || '';
      q.emps = R.checked('#rcEmp', 'rc-emp');
      q.gender = readGender();
      go(1);
    });
    if (reset) reset.addEventListener('click', function () {
      q = { jobs: [], r1: '', r2: '', emps: [], days: '',
            pay: '', gender: '', kw: q.kw, tab: q.tab, sort: q.sort };
      ['#rcR1', '#rcR2', '#rcDays', '#rcPay']
        .forEach(function (sel) { var x = el(sel); if (x) x.value = ''; });
      [].forEach.call(document.querySelectorAll('input[name="rc-emp"]'),
        function (x) { x.checked = false; });
      /* 성별은 「전체」(빈 값)로 되돌립니다 */
      var g0 = document.querySelector('input[name="rc-gender"][value=""]');
      if (g0) g0.checked = true;
      drawJobTable(); go(1);
    });
  }

  /* 성별 — 화면에 그 칸이 없으면(채용정보) 언제나 빈 값입니다 */
  function readGender() {
    var g = document.querySelector('input[name="rc-gender"]:checked');
    return g ? (g.value || '') : '';
  }

  /* ── 도구줄 — 검색창 · 구분 · 정렬 · 글자크기 ────────────
     다른 게시판(인물DB 등)과 같은 짜임입니다. */
  function drawToolbar() {
    /* 정렬 */
    var sort = el('#rcSort');
    if (sort) {
      /* 「마감순」 은 접수마감일(apply_to)로 줄을 세웁니다.
         그 칸은 채용정보에만 있으므로, 인재정보에서는 뺍니다 —
         두면 고르는 순간 서버가 「없는 칸」 이라며 400 을 돌려줍니다. */
      var sorts = R.SORTS.filter(function (s) {
        if (cfg.kind === 'job') return true;
        var v = String((s && s.value != null) ? s.value : s);
        return v.indexOf('apply_') < 0;
      });
      R.fill(sort, sorts, null);
      sort.value = q.sort;
      sort.addEventListener('change', function () { q.sort = sort.value; go(1); });
    }

    /* 검색 */
    var kw = el('#rcKw'), btn = el('#rcSearchBtn');
    function doSearch() { q.kw = (kw ? kw.value : '').trim(); go(1); }
    if (btn) btn.addEventListener('click', doSearch);
    if (kw) kw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    });

    /* 글자크기 — 다른 게시판과 같은 방식으로 --tbl-fs 를 조절합니다 */
    var STEPS = [12.5, 13.5, 14.5, 15.5, 16.5];
    var at = 1;
    function applyFs() {
      var wrap = el('.pdb-tablewrap');
      if (wrap) wrap.style.setProperty('--tbl-fs', STEPS[at] + 'px');
      try { localStorage.setItem('oc-rc-fs', String(at)); } catch (e) {}
    }
    try {
      var saved = localStorage.getItem('oc-rc-fs');
      if (saved != null && STEPS[Number(saved)]) at = Number(saved);
    } catch (e) {}
    applyFs();
    [].forEach.call(document.querySelectorAll('.pdb-fontsize [data-fs]'), function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-fs');
        if (d === 'up') at = Math.min(STEPS.length - 1, at + 1);
        else if (d === 'down') at = Math.max(0, at - 1);
        else at = 1;
        applyFs();
      });
    });
  }

  /* ── 상세로 가는 이름 ─────────────────────────────────────
     ★ <b>예시 자료(is_sample)는 눌러도 열리지 않습니다.</b>
       화면이 비어 보이지 않게 예시를 두었지만, 눌러 들어가면
       속이 빈 상세가 나오기 때문입니다.
     ★ 링크 자리에 <span> 을 놓습니다 — <a> 에 막는 손질을 얹으면
       주소가 상태막대에 뜨고 새 창으로 열 수도 있습니다.
     ★ 진짜 글에는 표시가 붙지 않으므로 <b>그대로 열립니다.</b>
       등록 화면이 이 칸을 건드리지 않아 기본값(거짓) 그대로입니다.
     ★ 세 목록(채용·인재·간추린 목록)이 모두 이것을 씁니다 —
       한 곳만 고치면 세 곳에 다 걸립니다. */
  function nameLink(o, txt, cls) {
    var t = esc(txt || '');
    var c = cls ? ' class="' + cls + '"' : '';
    if (o && o.is_sample) return '<span class="rc-sample"' + (cls ? ' data-c="' + cls + '"' : '') + '>' + t + '</span>';
    return '<a' + c + ' href="' + cfg.viewPage + '?id=' + encodeURIComponent(o.id) + '">' + t + '</a>';
  }

  /* ── 목록 한 줄 ───────────────────────────────────────────*/
  /* 표 한 줄 — 다른 게시판(인물DB 등)과 같은 짜임입니다.
     No · 업체/단체명 · 채용제목 · 채용기간 · 조회수 */
  function jobRow(o, no) {

    /* 접수기간 — 두 줄로 나누어 좁은 칸에도 온전히 보이게 합니다 */
    var lines = R.applyLines(o.apply_from, o.apply_to, o.apply_always, o.apply_until_hired);
    var left = R.daysLeft(o.apply_to);
    /* 마감이 이레 안쪽이면 눈에 띄게 알려 줍니다 */
    var dday = (left != null && left >= 0 && left <= 7)
      ? ' <b class="rc-dday">D-' + left + '</b>' : '';
    var when = '<span class="rc-when-1">' + esc(lines.top) + '</span>'
      + (lines.bottom ? '<span class="rc-when-2">' + esc(lines.bottom) + dday + '</span>'
                      : (dday ? '<span class="rc-when-2">' + dday + '</span>' : ''));

    /* 제목 아래 조건 — 근무형태와 지역만 짧게 (표가 빽빽해지지 않게) */
    var bits = [];
    (o.emp_types || []).slice(0, 2).forEach(function (t) { bits.push(t); });
    var reg = R.regionLabel(o.region1, o.region2);
    if (reg) bits.push(reg);
    var pay = R.payLabel(o.pay_type, o.pay_amount, o.pay_daily);
    if (pay) bits.push(pay);

    return '<tr>'
      + '<td class="c-no">' + no + '</td>'
      + '<td class="c-org">' + nameLink(o, o.org_name) + '</td>'
      + '<td class="c-title">'
      +   nameLink(o, o.title)
      +   (bits.length ? '<span class="rc-sub">' + bits.map(esc).join(' · ') + '</span>' : '')
      + '</td>'
      + '<td class="c-when">' + when + '</td>'
      + '<td class="c-hit">' + (o.view_count || 0) + '</td>'
      + '</tr>';
  }

  function talentRow(o, no) {
    /* 성별은 DB에 「남성·여성」 으로 담기지만 목록에서는 한 자로 줄입니다 —
       한 줄에 이름·성별·나이가 함께 들어가 자리가 좁습니다. */
    var g = String(o.gender || '').replace('남성', '남').replace('여성', '여');
    var who = (o.name_masked || '') + ' [' + (g || '-')
            + (o.age ? ' / ' + o.age + '세' : '') + ']';
    var d = String(o.created_at || '').slice(2, 10).replace(/-/g, '.');
    var bits = [];
    var jl = R.jobLabel(o.job_cat1, o.job_cat2, o.job_etc);
    if (jl) bits.push(jl);
    var reg = R.regionLabel(o.region1, o.region2);
    if (reg) bits.push(reg);
    /* 현재상태는 「구직중 (구직희망)」 처럼 길어 괄호 앞만 씁니다 */
    if (o.now_status) bits.push(String(o.now_status).split(' (')[0]);

    return '<tr>'
      + '<td class="c-no">' + no + '</td>'
      + '<td class="c-org">' + esc(who) + '</td>'
      + '<td class="c-title">'
      +   nameLink(o, o.title)
      +   (bits.length ? '<span class="rc-sub">' + bits.map(esc).join(' · ') + '</span>' : '')
      + '</td>'
      + '<td class="c-when">' + esc(d) + '</td>'
      + '<td class="c-hit">' + (o.view_count || 0) + '</td>'
      + '</tr>';
  }

  /* ── 간추린 한 줄 — 상세 화면 오른쪽의 좁은 목록 ──────────
     460px 남짓한 자리에는 다섯 칸이 들어가지 않습니다.
     제목을 살리고 업체명·지역을 아래 작은 줄로 접어 넣습니다.
     조회수는 뺍니다 — 좁은 자리에서 값보다 자리를 더 먹습니다.
     번호는 남깁니다. 몇 번째 것을 보고 있는지 알 수 있어야
     목록과 상세를 오가며 자리를 잃지 않습니다. */
  function miniRow(o, no) {
    var sub = [];
    if (cfg.kind === 'job') {
      if (o.org_name) sub.push(o.org_name);
    } else {
      var g = String(o.gender || '').replace('남성', '남').replace('여성', '여');
      var who = (o.name_masked || '') + (g ? ' ' + g : '') + (o.age ? '/' + o.age : '');
      if (who.trim()) sub.push(who);
    }
    var reg = R.regionLabel(o.region1, o.region2);
    if (reg) sub.push(reg);

    var when = '';
    if (cfg.kind === 'job') {
      var left = R.daysLeft(o.apply_to);
      if (o.apply_always) when = '상시';
      else if (o.apply_until_hired) when = '채용시';
      else if (left != null && left < 0) when = '<span class="rc-mini-end">마감</span>';
      else if (left != null && left <= 7) when = '<b class="rc-dday">D-' + left + '</b>';
      else when = esc(String(o.apply_to || '').slice(5).replace('-', '.'));
    } else {
      when = esc(String(o.created_at || '').slice(5, 10).replace('-', '.'));
    }

    return '<tr>'
      + '<td class="c-no">' + no + '</td>'
      + '<td class="c-title">'
      +   nameLink(o, o.title)
      +   (sub.length ? '<span class="rc-sub">' + sub.map(esc).join(' · ') + '</span>' : '')
      + '</td>'
      + '<td class="c-when">' + when + '</td>'
      + '</tr>';
  }

  /* ── 페이지 넘김 ──────────────────────────────────────────*/
  function drawPager() {
    var box = el('#rcPager');
    if (!box) return;
    var pages = Math.max(1, Math.ceil(total / cfg.pageSize));
    if (pages <= 1) { box.innerHTML = ''; return; }
    var from = Math.max(1, cur - 2), to = Math.min(pages, from + 4);
    from = Math.max(1, to - 4);
    var h = '<button type="button" class="rc-pg" data-p="' + Math.max(1, cur - 1) + '"'
          + (cur === 1 ? ' disabled' : '') + '>‹</button>';
    for (var p = from; p <= to; p++) {
      h += '<button type="button" class="rc-pg' + (p === cur ? ' on' : '') + '" data-p="' + p + '">'
         + p + '</button>';
    }
    h += '<button type="button" class="rc-pg" data-p="' + Math.min(pages, cur + 1) + '"'
       + (cur === pages ? ' disabled' : '') + '>›</button>';
    box.innerHTML = h;
  }

  /* ── 볼 수 있는 사람인지 ──────────────────────────────────
     인재정보는 <b>채용하는 회원과 본인</b>만 봅니다.
     막는 것은 서버(뷰)이고, 여기서는 <b>까닭을 알려 주는 일</b>만
     합니다. 그러지 않으면 「0건」 만 보여 고장으로 오해합니다. */
  async function gateTalent(span) {
    var list = el('#rcList');
    if (cfg.kind !== 'talent') return true;
    var v = await R.viewer();
    if (v.canSeeTalents) return true;

    var msg, act;
    if (!v.user) {
      msg = '인재정보는 회원만 볼 수 있습니다.';
      act = '<a class="rc-gate-btn" href="/account/login.html?next='
          + encodeURIComponent(location.pathname + location.search) + '">로그인하기</a>';
    } else {
      /* ★ 「회원 종류가 아니라서」 와 「승인을 기다려서」 를 갈라 알려 줍니다.
         단체 회원이 「단체 회원에게 열려 있습니다」 를 읽으면
         자기 회원 종류를 의심하게 됩니다. */
      var g = R.gateMsg(v.role || R.roleOf(null), 'hiring');
      msg = (g.why === 'type' ? '인재정보 열람은 ' : '') + g.msg
          + (g.why === 'type'
            ? '<br>전공자·일반 회원께는 <b>본인이 등록한 인재정보</b>만 보입니다.'
            : '')
          + (g.note ? '<br><span style="font-size:12px;color:#888">' + g.note + '</span>' : '');
      act = '<a class="rc-gate-btn" href="/recruit/guide.html">회원 종류 안내</a>';
    }
    if (list) {
      list.innerHTML = '<tr><td colspan="' + span + '" class="rc-gate">'
        + '<p>' + msg + '</p>' + act + '</td></tr>';
    }
    var cnt = el('#rcCount');
    if (cnt) cnt.innerHTML = '채용 회원 전용';
    var pager = el('#rcPager');
    if (pager) pager.innerHTML = '';
    return false;
  }

  /* ── 목록 자리 되돌리기 ────────────────────────────────────
     상세를 보다가 「목록」 을 누르면 <b>보던 그 공고 자리로</b>
     돌아가게 합니다. 첫 쪽으로 튕기면 다시 찾아 들어가야 합니다.

     ★ board.js 와 <b>같은 방식</b>으로 둡니다 — 열쇠 모양도 같게
       맞춰(ocbd-back:…) assets/pv.js 가 함께 알아보게 합니다.
       그래야 상세 화면에서 링크에 focus 를 붙여 줍니다. */
  var SKEY = 'ocbd-back:recruit-' + (function () {
    try { return (cfg && cfg.kind) || 'job'; } catch (e) { return 'job'; }
  })();

  function saveSpot(id) {
    try {
      sessionStorage.setItem('ocbd-back:recruit-' + ((cfg && cfg.kind) || 'job'),
        JSON.stringify({ id: String(id), page: cur }));
    } catch (e) {}
  }
  function readSpot(id) {
    try {
      var v = JSON.parse(sessionStorage.getItem(
        'ocbd-back:recruit-' + ((cfg && cfg.kind) || 'job')) || 'null');
      if (v && String(v.id) === String(id)) return v;
    } catch (e) {}
    return null;
  }

  /* 공고를 누르는 순간 어느 쪽에 있었는지 담아 둡니다 */
  function bindSaveSpot() {
    var list = el('#rcList');
    if (!list || list.dataset.spotBound) return;
    list.dataset.spotBound = '1';
    list.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="?id="]') : null;
      if (!a) return;
      var m = (a.getAttribute('href') || '').match(/[?&]id=([^&]+)/);
      if (m) saveSpot(decodeURIComponent(m[1]));
    });
  }

  /* 돌아왔을 때 그 자리를 알려 줍니다 */
  function focusItem(focusId) {
    if (!focusId) return;
    var list = el('#rcList');
    if (!list) return;
    var a = list.querySelector('a[href*="id=' + focusId + '&"], a[href$="id=' + focusId + '"]');
    if (!a) return;
    /* 표 구조이므로 줄(tr)에 표시를 붙입니다 */
    var box = (a.closest && a.closest('tr')) || a;
    box.classList.add('board-focus');
    try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { try { box.scrollIntoView(); } catch (e2) {} }
    setTimeout(function () { box.classList.remove('board-focus'); }, 4500);
  }

  /* ── 그리기 ───────────────────────────────────────────────*/
  async function go(page) {
    cur = page || 1;
    var list = el('#rcList');
    if (!list) return;
    var span = cfg.mini ? 3 : 5;   /* 표 칸 수 */
    list.innerHTML = '<tr><td colspan="' + span + '" class="rc-loading">불러오는 중…</td></tr>';

    if (!(await gateTalent(span))) return;

    var rows;
    try {
      rows = await fetchRows((cur - 1) * cfg.pageSize, cfg.pageSize);
    } catch (e) {
      list.innerHTML = '<tr><td colspan="' + span + '" class="rc-empty">'
        + '자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</td></tr>';
      return;
    }

    var cnt = el('#rcCount');
    if (cnt) {
      /* ★ 「오늘」 은 보는 분이 있는 곳의 오늘입니다.
         예전에는 new Date().toISOString().slice(0,10) 으로 <b>UTC 의 오늘</b>과
         견주었습니다. 그러면 한국 시간 0시~9시에 올린 것이 「어제」 로 세어져
         오전에는 오늘등록 건수가 실제보다 적게 나왔습니다. */
      var todayN = (rows || []).filter(function (o) {
        return R.isToday(o.created_at); }).length;
      cnt.innerHTML = '전체 <b>' + total.toLocaleString() + '</b>건'
        + (todayN ? '  <span>[오늘등록 ' + todayN + '건]</span>' : '');
    }

    if (!rows || !rows.length) {
      list.innerHTML = '<tr><td colspan="' + span + '" class="rc-empty">'
        + ((q.jobs && q.jobs.length) || (q.emps && q.emps.length) || q.kw || q.r1
          ? '조건에 맞는 정보가 없습니다. 조건을 바꿔 보시겠습니까?'
          : (cfg.kind === 'job' ? '등록된 채용정보가 아직 없습니다.' : '등록된 인재정보가 아직 없습니다.'))
        + '</td></tr>';
      drawPager();
      return;
    }

    /* 번호는 전체 건수에서 거꾸로 셉니다 (큰 번호가 최신) */
    var base = total - (cur - 1) * cfg.pageSize;
    list.innerHTML = rows.map(function (o, i) {
      if (cfg.mini) return miniRow(o, base - i);
      return (cfg.kind === 'job') ? jobRow(o, base - i) : talentRow(o, base - i);
    }).join('');

    /* 상세 화면에서는 지금 보고 있는 줄을 다시 표시해 줍니다 —
       쪽을 넘기면 줄이 새로 그려지므로 표시가 지워지기 때문입니다. */
    if (window.OCRecruitView && window.OCRecruitView.markCurrent) {
      var nowId = new URLSearchParams(location.search).get('id');
      if (nowId) window.OCRecruitView.markCurrent(nowId);
    }

    /* ★ 줄을 누를 때 어느 쪽이었는지 담아 둡니다 (한 번만 이어 붙습니다) */
    bindSaveSpot();

    /* ★ 상세에서 돌아왔으면 그 자리를 알려 줍니다.
       반드시 <b>그린 뒤에</b> 불러야 합니다 — 줄이 없으면 못 찾습니다. */
    (function () {
      var f = new URLSearchParams(location.search).get('focus');
      if (f) focusItem(f);
    })();

    drawPager();
  }

  /* ★ 상세에서 돌아왔을 때 <b>그 쪽으로</b> 엽니다.
     주소에 focus 가 있으면 담아 둔 쪽 번호를 꺼냅니다. 이것이 없으면
     표시할 줄이 첫 쪽에 없어 아무 일도 일어나지 않습니다. */
  function startPage() {
    var f = new URLSearchParams(location.search).get('focus');
    if (!f) return 1;
    var sp = readSpot(f);
    return (sp && sp.page) ? sp.page : 1;
  }

  /* ── 붙어 따라오기 높이 재기 ──────────────────────────────
     도구줄·건수줄이 화면에 붙어 따라오면, 표 머리는 그 아래에 붙어야
     합니다. 그런데 그 높이는 화면 폭에 따라 달라지므로 CSS 에 숫자를
     박아 둘 수 없습니다. 그래서 재어서 CSS 변수에 넣습니다.

     ★ 표 머리(thead th)의 sticky 는 감싼 곳에 overflow 가 걸리면
       듣지 않습니다. .pdb-tablewrap 은 좁은 화면에서만 overflow-x 가
       걸리므로, 그 폭에서는 붙어 따라오기를 끕니다(recruit.css). */
  function measureSticky() {
    var head = el('.rc-sticky');
    if (!head) return;
    var h = Math.round(head.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--rc-sticky-h', h + 'px');
  }

  /* ── 왼쪽 찾는 칸이 붙는 자리 재기 ────────────────────────
     찾는 칸은 화면보다 긴 때가 많습니다. 그때 위쪽(--rc-top)에
     못박아 두면 아래쪽 「선택조건으로 검색」 단추가 화면 밖으로
     밀려나 <b>영영 손이 닿지 않습니다.</b>

     그래서 키를 재어
       · 화면에 들어가면 → 위쪽 --rc-top 에 붙입니다
       · 화면보다 길면  → 아래쪽 끝이 보이는 자리에 붙입니다
                          (붙는 값이 음수가 되어, 목록을 내리면
                           찾는 칸이 조금 올라간 뒤 그 자리에 섭니다)

     ★ 재는 값은 --rc-side-top 하나뿐입니다. recruit.css 의
       .rc-finder 가 그 값을 씁니다. 두 곳을 고칠 일이 없습니다. */
  var GAP = 24;                     /* 화면 아래쪽에 남기는 여백 */
  function measureSide() {
    var box = el('.rc-finder');
    if (!box) return;
    var css = getComputedStyle(document.querySelector('.rc-layout') || document.body);
    var rcTop = parseFloat(css.getPropertyValue('--rc-top')) || 120;
    var h = Math.round(box.getBoundingClientRect().height);
    var room = window.innerHeight - rcTop - GAP;
    var top = (h <= room) ? rcTop : (window.innerHeight - h - GAP);
    document.documentElement.style.setProperty('--rc-side-top', Math.round(top) + 'px');
  }

  /* ── 주소에 실린 조건 읽기 ────────────────────────────────
     오퍼스클램은 모든 것이 서로 이어져야 합니다.
     상세 화면에서 「오케스트라 › 현악파트」 를 누르면
       /recruit/job.html?cat1=오케스트라&cat2=현악파트
     로 옵니다. 여기서 그 값을 읽어 처음부터 걸러 놓습니다.

     ★ 아는 값만 받습니다. 주소에 엉뚱한 값이 실려 와도
       분류에 없으면 그냥 무시합니다(빈 목록이 나오지 않게). */
  function seedFromUrl() {
    var p = new URLSearchParams(location.search);
    var c1 = p.get('cat1'), c2 = p.get('cat2');
    if (c1 && R.JOBS[c1]) {
      q.jobs = (c2 && R.JOBS[c1].indexOf(c2) >= 0)
        ? [c1 + '|' + c2]
        : R.JOBS[c1].map(function (x) { return c1 + '|' + x; });
    }
    var r1 = p.get('r1'), r2 = p.get('r2');
    if (r1 && R.REGIONS[r1]) {
      q.r1 = r1;
      if (r2 && (R.REGIONS[r1] || []).indexOf(r2) >= 0) q.r2 = r2;
    }
    var kw = p.get('kw');
    if (kw) q.kw = kw;
  }

  /* 읽은 조건을 화면의 칸에도 비춰 줍니다 —
     걸러져 있는데 칸이 비어 있으면 「왜 이것만 나오나」 하고 헤맵니다. */
  function reflectUrl() {
    var r1 = el('#rcR1'), r2 = el('#rcR2'), kw = el('#rcKw');
    if (r1 && q.r1) {
      r1.value = q.r1;
      /* 2차 지역 목록은 1차가 바뀔 때 채워집니다(R.bindPair) */
      r1.dispatchEvent(new Event('change'));
      if (r2 && q.r2) r2.value = q.r2;
    }
    if (kw && q.kw) kw.value = q.kw;
  }

  /* ── 시작 ─────────────────────────────────────────────────*/
  function init(options) {
    cfg = Object.assign({ kind: 'job', pageSize: 15 }, options || {});
    R = window.OCRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }

    seedFromUrl();
    bindCat();
    drawJobTable();
    bindJobTable();
    drawSearch();
    drawToolbar();
    reflectUrl();

    var pager = el('#rcPager');
    if (pager) pager.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]');
      if (!b || b.disabled) return;
      go(Number(b.getAttribute('data-p')));
      var top = el('#rcList');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    go(startPage());   /* ★ 상세에서 돌아왔으면 그 쪽으로 엽니다 */

    /* 높이를 재어 표 머리가 도구줄 아래에 붙게 합니다.
       글꼴이 늦게 오면 높이가 바뀌므로 조금 뒤에 한 번 더 잽니다. */
    function measureAll() { measureSticky(); measureSide(); }
    measureAll();
    setTimeout(measureAll, 300);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measureAll);
      var head = el('.rc-sticky');
      if (head) ro.observe(head);
      var side = el('.rc-finder');
      if (side) ro.observe(side);
      /* 창 높이가 바뀌면 붙는 자리도 달라집니다 —
         ResizeObserver 는 창 높이를 보지 못하므로 따로 듣습니다. */
      window.addEventListener('resize', measureSide);
    } else {
      window.addEventListener('resize', measureAll);
    }
  }

  window.OCRecruitList = { init: init };
})();
