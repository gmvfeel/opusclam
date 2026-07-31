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
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  var R;                       /* OCRecruit — 분류 자료 */

  var cfg = null, cur = 1, total = 0;
  /* 지금 걸러 보고 있는 조건 */
  var q = {
    /* 고른 직종들 — 「오케스트라|현악파트」 꼴로 담습니다.
       여러 개를 함께 고를 수 있습니다 (현악파트와 관악파트를 같이 보기) */
    jobs: [],
    r1: '', r2: '',
    emp: '무관', days: '', pay: '',
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

    /* 근무형태 — 여러 값을 담은 칸이라 「겹치는 것이 있으면」 으로 봅니다 */
    var emp = q.tab || (q.emp && q.emp !== '무관' ? q.emp : '');
    if (emp) p.push('emp_types=cs.%7B' + encodeURIComponent(emp) + '%7D');

    if (q.days) p.push('work_days=eq.' + encodeURIComponent(q.days));

    if (q.kw) {
      var k = encodeURIComponent('%' + q.kw + '%');
      var cols = (cfg.kind === 'job')
        ? ['title', 'org_name', 'duty', 'body', 'job_etc']
        : ['title', 'career', 'body', 'job_etc'];
      p.push('or=(' + cols.map(function (c) { return c + '.ilike.' + k; }).join(',') + ')');
    }

    p.push('order=' + (q.sort || 'created_at.desc'));
    p.push('limit=' + size);
    p.push('offset=' + from);

    var res = await fetch(SB + '/rest/v1/' + cfg.table + '?' + p.join('&'),
      { headers: Object.assign({ Prefer: 'count=exact' }, HDR) });
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
    R.fillRadios(el('#rcEmp'), R.EMP_SEARCH, 'rc-emp', '무관');

    var go2 = el('#rcGo'), reset = el('#rcReset');
    if (go2) go2.addEventListener('click', function () {
      q.r1 = (el('#rcR1') || {}).value || '';
      q.r2 = (el('#rcR2') || {}).value || '';
      q.days = (el('#rcDays') || {}).value || '';
      q.pay = (el('#rcPay') || {}).value || '';
      q.kw = ((el('#rcKw') || {}).value || '').trim();
      q.emp = document.querySelector('input[name="rc-emp"]:checked');
      q.emp = q.emp ? q.emp.value : '무관';
      go(1);
    });
    if (reset) reset.addEventListener('click', function () {
      q = { jobs: [], r1: '', r2: '', emp: '무관', days: '',
            pay: '', kw: '', tab: q.tab, sort: q.sort };
      /* 셀렉트와 라디오도 처음 상태로 되돌립니다 */
      ['#rcR1', '#rcR2', '#rcDays', '#rcPay', '#rcKw']
        .forEach(function (sel) { var x = el(sel); if (x) x.value = ''; });
      var first = document.querySelector('input[name="rc-emp"]');
      if (first) first.checked = true;
      drawJobTable(); go(1);
    });
  }

  /* ── 탭 ───────────────────────────────────────────────────*/
  function drawTabs() {
    var box = el('#rcTabs');
    if (!box) return;
    var tabs = (cfg.kind === 'job')
      ? [['', '전체채용정보'], ['정규직', '정규직'], ['계약직', '계약직'], ['프리랜서', '프리랜서']]
      : [['', '전체인재정보']].concat(Object.keys(R.JOBS).map(function (c) { return ['cat:' + c, c]; }));

    box.innerHTML = tabs.map(function (t) {
      var on = (q.tab === t[0] || (!q.tab && !t[0])) ? ' on' : '';
      return '<button type="button" class="rc-tab' + on + '" data-tab="' + esc(t[0]) + '">'
        + esc(t[1]) + '</button>';
    }).join('');

    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      var v = b.getAttribute('data-tab');
      /* 인재정보 탭은 직종으로 거릅니다 */
      if (v.indexOf('cat:') === 0) {
        var c1 = v.slice(4);
        q.jobs = R.JOBS[c1] ? R.JOBS[c1].map(function (c2) { return c1 + '|' + c2; }) : [];
        q.tab = v;
      } else {
        q.tab = v;
        if (cfg.kind !== 'job') q.jobs = [];
      }
      drawTabs(); drawJobTable(); go(1);
    });
  }

  /* ── 목록 한 줄 ───────────────────────────────────────────*/
  function jobRow(o, no) {
    var vp = cfg.viewPage + '?id=' + encodeURIComponent(o.id);
    var bits = [];
    bits.push(o.career_any === false ? '경력' : '경력무관');
    bits.push(o.edu_any === false && o.edu ? o.edu : '학력무관');
    bits.push(R.regionLabel(o.region1, o.region2) || '지역협의');
    (o.emp_types || []).slice(0, 2).forEach(function (t) { bits.push(t); });
    var pay = R.payLabel(o.pay_type, o.pay_amount, o.pay_daily);
    if (pay) bits.push(pay);

    var left = R.daysLeft(o.apply_to);
    var when = R.applyLabel(o.apply_from, o.apply_to, o.apply_always, o.apply_until_hired);
    var dday = (left != null && left >= 0 && left <= 7)
      ? '<b class="rc-dday">D-' + left + '</b>' : '';

    return '<div class="rc-row">'
      + '<span class="rc-no">' + (no < 10 ? '0' + no : no) + '</span>'
      + '<a class="rc-org" href="' + vp + '">' + esc(o.org_name || '') + '</a>'
      + '<div class="rc-main">'
      +   '<a class="rc-title" href="' + vp + '">' + esc(o.title || '') + '</a>'
      +   '<div class="rc-cond">' + bits.map(function (b) {
            return '<span>' + esc(b) + '</span>'; }).join('') + '</div>'
      + '</div>'
      + '<div class="rc-when">' + esc(when) + dday + '</div>'
      + '<div class="rc-view"><i>VIEW</i>' + (o.view_count || 0) + '</div>'
      + '</div>';
  }

  function talentRow(o, no) {
    var vp = cfg.viewPage + '?id=' + encodeURIComponent(o.id);
    var who = (o.name_masked || '') + ' [ ' + (o.gender || '-')
            + (o.age ? ' / ' + o.age + '세' : '') + ' ]';
    var d = String(o.created_at || '').slice(2, 10).replace(/-/g, '.');
    return '<div class="rc-row rc-row--talent">'
      + '<span class="rc-who">' + esc(who) + '</span>'
      + '<div class="rc-main">'
      +   '<a class="rc-title" href="' + vp + '">' + esc(o.title || '') + '</a>'
      +   '<div class="rc-cond rc-cond--job">'
      +     '<span>' + esc(R.jobLabel(o.job_cat1, o.job_cat2, o.job_etc) || '희망직종 미정') + '</span>'
      +   '</div>'
      + '</div>'
      + '<div class="rc-when">' + esc(d) + '</div>'
      + '<div class="rc-view"><i>VIEW</i>' + (o.view_count || 0) + '</div>'
      + '</div>';
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

  /* ── 그리기 ───────────────────────────────────────────────*/
  async function go(page) {
    cur = page || 1;
    var list = el('#rcList');
    if (!list) return;
    list.innerHTML = '<div class="rc-loading">불러오는 중…</div>';

    var rows;
    try {
      rows = await fetchRows((cur - 1) * cfg.pageSize, cfg.pageSize);
    } catch (e) {
      list.innerHTML = '<p class="rc-empty">자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
      return;
    }

    var cnt = el('#rcCount');
    if (cnt) {
      var today = new Date().toISOString().slice(0, 10);
      var todayN = (rows || []).filter(function (o) {
        return String(o.created_at || '').slice(0, 10) === today; }).length;
      cnt.innerHTML = '전체 <b>' + total.toLocaleString() + '</b>건'
        + (todayN ? '  <span>[오늘등록 ' + todayN + '건]</span>' : '');
    }

    if (!rows || !rows.length) {
      list.innerHTML = '<p class="rc-empty">'
        + ((q.jobs && q.jobs.length) || q.kw || q.r1
          ? '조건에 맞는 정보가 없습니다. 조건을 바꿔 보시겠습니까?'
          : (cfg.kind === 'job' ? '등록된 채용정보가 아직 없습니다.' : '등록된 인재정보가 아직 없습니다.'))
        + '</p>';
      drawPager();
      return;
    }

    /* 번호는 전체 건수에서 거꾸로 셉니다 (큰 번호가 최신) */
    var base = total - (cur - 1) * cfg.pageSize;
    list.innerHTML = rows.map(function (o, i) {
      return (cfg.kind === 'job') ? jobRow(o, base - i) : talentRow(o, base - i);
    }).join('');

    drawPager();
  }

  /* ── 시작 ─────────────────────────────────────────────────*/
  function init(options) {
    cfg = Object.assign({ kind: 'job', pageSize: 15 }, options || {});
    R = window.OCRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }

    drawJobTable();
    bindJobTable();
    drawSearch();
    drawTabs();

    var sort = el('#rcSort');
    if (sort) {
      R.fill(sort, R.SORTS, null);
      sort.value = q.sort;
      sort.addEventListener('change', function () { q.sort = sort.value; go(1); });
    }

    var kw = el('#rcKw');
    if (kw) kw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { q.kw = kw.value.trim(); go(1); }
    });

    var pager = el('#rcPager');
    if (pager) pager.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]');
      if (!b || b.disabled) return;
      go(Number(b.getAttribute('data-p')));
      var top = el('#rcList');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    go(1);
  }

  window.OCRecruitList = { init: init };
})();
