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

    var go2 = el('#rcGo'), reset = el('#rcReset');
    if (go2) go2.addEventListener('click', function () {
      q.r1 = (el('#rcR1') || {}).value || '';
      q.r2 = (el('#rcR2') || {}).value || '';
      q.days = (el('#rcDays') || {}).value || '';
      q.pay = (el('#rcPay') || {}).value || '';
      go(1);
    });
    if (reset) reset.addEventListener('click', function () {
      q = { jobs: [], r1: '', r2: '', emp: '무관', days: '',
            pay: '', kw: q.kw, tab: q.tab, sort: q.sort };
      ['#rcR1', '#rcR2', '#rcDays', '#rcPay']
        .forEach(function (sel) { var x = el(sel); if (x) x.value = ''; });
      drawJobTable(); go(1);
    });
  }

  /* ── 도구줄 — 검색창 · 구분 · 정렬 · 글자크기 ────────────
     다른 게시판(인물DB 등)과 같은 짜임입니다. */
  function drawToolbar() {
    /* 구분 — 채용은 근무형태로, 인재는 직종 대분류로 */
    var sel = el('#rcEmpSel');
    if (sel) {
      var items = (cfg.kind === 'job')
        ? [{ value: '', label: '구분선택' }].concat(
            R.EMP_SEARCH.filter(function (t) { return t !== '무관'; })
                        .map(function (t) { return { value: t, label: t }; }))
        : [{ value: '', label: '구분선택' }].concat(
            Object.keys(R.JOBS).map(function (c) { return { value: 'cat:' + c, label: c }; }));
      items.splice(1, 0, { value: '', label: cfg.kind === 'job' ? '전체' : '전체' });
      R.fill(sel, items, null);
      sel.addEventListener('change', function () {
        var v = sel.value;
        if (v.indexOf('cat:') === 0) {
          var c1 = v.slice(4);
          q.jobs = R.JOBS[c1] ? R.JOBS[c1].map(function (c2) { return c1 + '|' + c2; }) : [];
          q.tab = '';
          drawJobTable();
        } else {
          q.tab = v;
        }
        go(1);
      });
    }

    /* 정렬 */
    var sort = el('#rcSort');
    if (sort) {
      R.fill(sort, R.SORTS, null);
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

  /* ── 목록 한 줄 ───────────────────────────────────────────*/
  /* 표 한 줄 — 다른 게시판(인물DB 등)과 같은 짜임입니다.
     No · 업체/단체명 · 채용제목 · 채용기간 · 조회수 */
  function jobRow(o, no) {
    var vp = cfg.viewPage + '?id=' + encodeURIComponent(o.id);

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
      + '<td class="c-org"><a href="' + vp + '">' + esc(o.org_name || '') + '</a></td>'
      + '<td class="c-title">'
      +   '<a href="' + vp + '">' + esc(o.title || '') + '</a>'
      +   (bits.length ? '<span class="rc-sub">' + bits.map(esc).join(' · ') + '</span>' : '')
      + '</td>'
      + '<td class="c-when">' + when + '</td>'
      + '<td class="c-hit">' + (o.view_count || 0) + '</td>'
      + '</tr>';
  }

  function talentRow(o, no) {
    var vp = cfg.viewPage + '?id=' + encodeURIComponent(o.id);
    var who = (o.name_masked || '') + ' [' + (o.gender || '-')
            + (o.age ? ' / ' + o.age + '세' : '') + ']';
    var d = String(o.created_at || '').slice(2, 10).replace(/-/g, '.');
    var bits = [];
    var jl = R.jobLabel(o.job_cat1, o.job_cat2, o.job_etc);
    if (jl) bits.push(jl);
    var reg = R.regionLabel(o.region1, o.region2);
    if (reg) bits.push(reg);
    if (o.now_status) bits.push(o.now_status);

    return '<tr>'
      + '<td class="c-no">' + no + '</td>'
      + '<td class="c-org">' + esc(who) + '</td>'
      + '<td class="c-title">'
      +   '<a href="' + vp + '">' + esc(o.title || '') + '</a>'
      +   (bits.length ? '<span class="rc-sub">' + bits.map(esc).join(' · ') + '</span>' : '')
      + '</td>'
      + '<td class="c-when">' + esc(d) + '</td>'
      + '<td class="c-hit">' + (o.view_count || 0) + '</td>'
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

  /* ── 그리기 ───────────────────────────────────────────────*/
  async function go(page) {
    cur = page || 1;
    var list = el('#rcList');
    if (!list) return;
    var span = 5;   /* 표 칸 수 */
    list.innerHTML = '<tr><td colspan="' + span + '" class="rc-loading">불러오는 중…</td></tr>';

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
      var today = new Date().toISOString().slice(0, 10);
      var todayN = (rows || []).filter(function (o) {
        return String(o.created_at || '').slice(0, 10) === today; }).length;
      cnt.innerHTML = '전체 <b>' + total.toLocaleString() + '</b>건'
        + (todayN ? '  <span>[오늘등록 ' + todayN + '건]</span>' : '');
    }

    if (!rows || !rows.length) {
      list.innerHTML = '<tr><td colspan="' + span + '" class="rc-empty">'
        + ((q.jobs && q.jobs.length) || q.kw || q.r1
          ? '조건에 맞는 정보가 없습니다. 조건을 바꿔 보시겠습니까?'
          : (cfg.kind === 'job' ? '등록된 채용정보가 아직 없습니다.' : '등록된 인재정보가 아직 없습니다.'))
        + '</td></tr>';
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
    drawToolbar();

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
