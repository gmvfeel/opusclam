/* ============================================================
   OPUSCLAM 리쿠르트 상세 엔진 — assets/recruit-view.js

   무엇을 하나
    · 채용 상세(왼쪽)를 그립니다
    · 조회수를 올립니다 (recruit_job_hit / recruit_talent_hit)
    · 오른쪽 목록에서 제목을 누르면 <b>왼쪽만 바꿔</b> 그립니다
      (화면을 새로 불러오지 않으므로 오른쪽 목록의 자리가 그대로 남습니다)
    · 오른쪽 목록이 화면보다 짧으면 붙어 따라오게 자리를 잡아 줍니다

   왜 목록 엔진(recruit-list.js)과 나누었나
    목록 엔진은 「여러 줄을 걸러 보여 주는 일」 을 하고,
    이 엔진은 「한 건을 자세히 펼치는 일」 을 합니다.
    한 파일에 넣으면 서로 쓰지 않는 코드가 절반씩 섞입니다.

   쓰는 법
     OCRecruitView.init({
       kind: 'job',                   'job' 또는 'talent'
       table: 'recruit_jobs',
       hitFn: 'recruit_job_hit',      조회수 올리는 함수
       listPage: '/recruit/job.html',
     });
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  /* 단체DB 경로 —
     ★ 확인이 필요합니다. 실제 경로가 다르면 이 두 줄만 고치십시오.
       ORG_VIEW · 그 단체의 상세 화면 (org_id 로 바로 갑니다)
       ORG_LIST · 단체DB 목록      (org_id 가 아직 없는 옛 자료는
                                    이름으로 찾아 갑니다) */
  var ORG_VIEW = '/db/group-view.html';
  var ORG_LIST = '/db/group.html';

  var R, cfg = null, cur = null;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(s) { return document.querySelector(s); }
  /* 줄바꿈을 살려 내보냅니다 — 등록한 사람이 나눈 단락을 지키려고 */
  function nl(v) { return esc(v).replace(/\r?\n/g, '<br>'); }
  function has(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim() !== '';
  }

  /* ── 표 한 줄 — 값이 없으면 줄째로 뺍니다 ─────────────────
     빈 줄을 남겨 두면 「등록하지 않은 것」 과 「없다는 뜻」 이
     구별되지 않아 오히려 헷갈립니다. */
  function row(label, valueHtml) {
    if (!has(valueHtml)) return '';
    return '<tr><th>' + esc(label) + '</th><td>' + valueHtml + '</td></tr>';
  }

  /* 값이 없어도 줄을 남기는 표 — 회사·단체 머리칸에 씁니다.
     여기 넷(단체명·분야·웹사이트·주소)은 「등록하지 않았다」 는 것도
     알아야 하는 정보입니다. 지원하기 전에 무엇을 더 물어야 하는지
     알 수 있어야 하기 때문입니다. */
  function rowAlways(label, valueHtml, cls) {
    var v = has(valueHtml) ? valueHtml : '<span class="rv-none">미등록</span>';
    return '<tr><th>' + esc(label) + '</th>'
      + '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td></tr>';
  }

  /* 두 값을 한 줄에 나란히 — 시안의 「오디션여부 · 오디션곡명」 꼴 */
  function row2(l1, v1, l2, v2) {
    if (!has(v1) && !has(v2)) return '';
    return '<tr>'
      + '<th>' + esc(l1) + '</th><td>' + (has(v1) ? v1 : '-') + '</td>'
      + '<th class="th2">' + esc(l2) + '</th><td>' + (has(v2) ? v2 : '-') + '</td>'
      + '</tr>';
  }

  /* ── 걸러진 목록으로 가는 링크 ─────────────────────────────
     오퍼스클램은 모든 것이 서로 이어져야 합니다.
     직종·지역을 누르면 그 조건으로 걸러진 목록으로 갑니다.
     받는 쪽(recruit-list.js)이 주소의 값을 읽어 처음부터 걸러 냅니다. */
  function link(params, text) {
    var qs = Object.keys(params)
      .filter(function (k) { return has(params[k]); })
      .map(function (k) { return k + '=' + encodeURIComponent(params[k]); })
      .join('&');
    if (!qs) return esc(text);
    return '<a class="rv-lk" href="' + cfg.listPage + '?' + qs + '">' + esc(text) + '</a>';
  }

  /* ── 값 다듬기 ────────────────────────────────────────────*/
  function jobCell(o) {
    if (!has(o.job_cat1)) return has(o.job_etc) ? esc(o.job_etc) : '';
    var h = link({ cat1: o.job_cat1 }, o.job_cat1);
    if (has(o.job_cat2)) h += ' <span class="rv-arrow">›</span> ' + link({ cat1: o.job_cat1, cat2: o.job_cat2 }, o.job_cat2);
    if (has(o.job_etc)) h += ' <span class="rv-dim">(' + esc(o.job_etc) + ')</span>';
    return h;
  }
  function regionCell(o) {
    if (!has(o.region1)) return '';
    var h = link({ r1: o.region1 }, o.region1);
    if (has(o.region2)) h += ' <span class="rv-arrow">›</span> ' + link({ r1: o.region1, r2: o.region2 }, o.region2);
    return h;
  }
  function workCell(o) {
    var out = [];
    if (has(o.work_days)) out.push('<span class="rv-k">근무요일</span> ' + esc(o.work_days));
    var t = '';
    if (has(o.work_start) && has(o.work_end)) t = o.work_start + ' - ' + o.work_end;
    else if (has(o.work_start)) t = o.work_start + ' -';
    else if (has(o.work_end)) t = '- ' + o.work_end;
    if (t) out.push('<span class="rv-k">근무시간</span> ' + esc(t));
    return out.join('<br>');
  }
  function qualCell(o) {
    var out = [];
    var edu = o.edu_any ? '학력무관' : o.edu;
    if (has(edu)) out.push('<span class="rv-k">학력</span> ' + esc(edu));
    if (has(o.gender)) out.push('<span class="rv-k">성별</span> ' + esc(o.gender));
    var age = o.age_any ? '무관'
      : (has(o.age_min) && has(o.age_max)) ? (o.age_min + '세 ~ ' + o.age_max + '세')
      : has(o.age_min) ? (o.age_min + '세 이상')
      : has(o.age_max) ? (o.age_max + '세 이하') : '';
    if (has(age)) out.push('<span class="rv-k">나이</span> ' + esc(age));
    return out.join('<br>');
  }
  function payCell(o) {
    var s = R.payLabel(o.pay_type, o.pay_amount, o.pay_daily);
    return has(s) ? esc(s) : '';
  }
  function arrCell(a) {
    return (a && a.length) ? a.map(esc).join(' · ') : '';
  }
  function homeCell(o) {
    if (!has(o.org_home)) return '';
    var u = String(o.org_home).trim();
    var href = /^https?:\/\//i.test(u) ? u : 'http://' + u;
    return '<a class="rv-lk" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">'
      + esc(u) + '</a>';
  }

  /* ── 상세 그리기 ──────────────────────────────────────────*/
  function draw(o) {
    cur = o;
    var box = el('#rvDoc');
    if (!box) return;

    var dday = R.daysLeft(o.apply_to);
    var ddayTag = (dday != null && dday >= 0 && dday <= 7)
      ? ' <b class="rc-dday">D-' + dday + '</b>' : '';
    var closed = (dday != null && dday < 0 && !o.apply_always && !o.apply_until_hired);

    /* ── 머리칸 — 회사·단체 ──
       오퍼스클램의 채용정보는 사업자·단체 회원만 올릴 수 있습니다.
       그러므로 모든 공고에는 반드시 등록된 단체가 하나 있습니다.
       단추는 언제나 「회사 / 단체정보 상세보기」 하나입니다 —
       단체DB의 그 단체 화면으로 갑니다.

       ★ org_id 가 담겨 있으면 그것으로 바로 가고, 아직 이어지지
         않은 옛 자료는 단체DB에서 이름으로 찾아 갑니다. */
    var orgHref = has(o.org_id)
      ? (ORG_VIEW + '?id=' + encodeURIComponent(o.org_id))
      : (ORG_LIST + '?kw=' + encodeURIComponent(o.org_name || ''));

    var head = '<div class="rv-orgbox">'
      + '<table class="rv-tbl rv-tbl--org"><tbody>'
      +   rowAlways('회사 / 단체명', esc(o.org_name || ''), 'rv-orgname')
      +   rowAlways('분야', esc(o.org_field || ''))
      +   rowAlways('웹사이트', homeCell(o))
      +   rowAlways('주소', esc(o.org_addr || ''))
      + '</tbody></table>'
      + '</div>'
      + '<div class="rv-orgfoot">'
      +   '<a class="rv-orglink" href="' + orgHref + '">'
      +   '회사 / 단체정보 상세보기 <span aria-hidden="true">→</span></a>'
      + '</div>';

    /* ── 채용정보 ── */
    var sec1 = ''
      + (has(o.duty)
        ? '<section class="rv-sec"><h2>담당업무</h2><div class="rv-body">' + nl(o.duty) + '</div></section>'
        : '')
      + '<section class="rv-sec"><h2>모집요강 및 응시자격</h2>'
      +   '<table class="rv-tbl rv-tbl--wrap2"><tbody>'
      +     row('모집직종', jobCell(o))
      +     row('고용형태', arrCell(o.emp_types))
      +     row('모집인원', has(o.headcount) ? esc(o.headcount) + ' 명' : '')
      +     row('근무형태', workCell(o))
      +     row('자격요건', qualCell(o))
      +     row2('오디션여부', esc(o.audition || ''), '오디션곡명', esc(o.audition_piece || ''))
      +     row('우대조건', arrCell(o.prefer))
      +   '</tbody></table>'
      + '</section>'
      + '<section class="rv-sec"><h2>근무환경</h2>'
      +   '<table class="rv-tbl"><tbody>'
      +     row('급여', payCell(o))
      +     row('근무지역', regionCell(o))
      +   '</tbody></table>'
      + '</section>'
      + (has(o.body)
        ? '<section class="rv-sec"><h2>상세내용</h2><div class="rv-body rv-body--long">' + nl(o.body) + '</div></section>'
        : '');

    /* ── 접수기간·방법 ── */
    /* 「접수기간 / 방법」 은 바로 위 큰 제목이 이미 말해 주므로
       같은 말을 소제목으로 되풀이하지 않고 표만 둡니다. */
    var sec2 = '<section class="rv-sec">'
      +   '<table class="rv-tbl"><tbody>'
      +     row('접수기간',
            esc(R.applyLabel(o.apply_from, o.apply_to, o.apply_always, o.apply_until_hired)) + ddayTag
            + (closed ? ' <b class="rv-closed">마감</b>' : ''))
      +     row('접수방법', arrCell(o.apply_methods))
      +     row('오디션여부', esc(o.audition || ''))
      +   '</tbody></table>'
      + '</section>'
      + '<section class="rv-sec"><h2>담당자 및 문의처</h2>'
      +   '<table class="rv-tbl"><tbody>'
      +     row('담당자명', esc(o.contact_name || ''))
      +     row('이메일', has(o.contact_email)
            ? '<a class="rv-lk" href="mailto:' + esc(o.contact_email) + '">' + esc(o.contact_email) + '</a>' : '')
      +     row('전화번호', esc(o.contact_phone || ''))
      +     row('FAX', esc(o.contact_fax || ''))
      +   '</tbody></table>'
      + '</section>';

    /* ── 지원하기 — 이메일이 있을 때만 실제로 눌립니다 ──
         누를 수 없는 단추를 눌러 보게 하는 것보다,
         왜 못 누르는지 알려 주는 것이 낫습니다. */
    var applyBtn = has(o.contact_email)
      ? '<a class="rv-btn rv-btn--go" href="mailto:' + esc(o.contact_email)
        + '?subject=' + encodeURIComponent('[오퍼스클램 리쿠르트] ' + (o.title || '') + ' 지원')
        + '">지원하기</a>'
      : '<span class="rv-btn rv-btn--off" title="등록된 이메일이 없습니다. 문의처를 확인해 주십시오.">지원하기</span>';

    box.innerHTML = ''
      + '<h1 class="rv-title">' + esc(o.title || '') + '</h1>'
      + head
      /* 두 묶음을 큰 제목으로 갈라 둡니다.
         앞서는 옮겨 가는 탭 단추를 두었는데, 한 화면에 내용이
         모두 펼쳐져 있으므로 누를 까닭이 없었습니다. */
      + '<h2 class="rv-group">채용상세정보</h2>'
      + sec1
      + '<h2 class="rv-group">접수기간 / 방법</h2>'
      + sec2
      + '<div class="rv-btns">' + applyBtn
      +   '<a class="rv-btn rv-btn--list" href="' + cfg.listPage + '">목록</a></div>'
      /* 자료 출처·문의 — 다른 뷰 화면과 같은 짜임입니다 */
      + '<div class="rv-note">'
      +   '<p>등록된 내용은 채용 주체가 직접 올린 것입니다. 채용 조건과 일정은 바뀔 수 있으니 '
      +   '지원 전에 문의처로 다시 확인해 주십시오.</p>'
      +   '<a class="rv-mail" href="mailto:cser@wixon.co.kr?subject='
      +   encodeURIComponent('[오퍼스클램] 채용정보 문의 — ' + (o.title || ''))
      +   '">메일문의하기</a>'
      + '</div>';

    markCurrent(o.id);
    document.title = (o.title || '채용정보') + ' · 리쿠르트 · OPUSCLAM.COM';
  }

  /* 오른쪽 목록에서 지금 보고 있는 줄을 눈에 띄게 합니다 */
  function markCurrent(id) {
    [].forEach.call(document.querySelectorAll('#rcList tr'), function (tr) {
      var a = tr.querySelector('a[href*="id="]');
      var on = !!(a && a.getAttribute('href').indexOf('id=' + id) >= 0);
      tr.classList.toggle('rc-row-on', on);
    });
  }

  /* ── 한 건 받기 ───────────────────────────────────────────*/
  async function load(id, push) {
    var box = el('#rvDoc');
    if (box) box.innerHTML = '<div class="rv-loading">불러오는 중…</div>';

    try {
      var res = await fetch(SB + '/rest/v1/' + cfg.table
        + '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1', { headers: HDR });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();
      if (!rows || !rows.length) {
        if (box) box.innerHTML = '<div class="rv-empty">찾으시는 정보가 없습니다. '
          + '지워졌거나 주소가 잘못되었을 수 있습니다.<br>'
          + '<a class="rv-lk" href="' + cfg.listPage + '">목록으로 돌아가기</a></div>';
        return;
      }
      draw(rows[0]);
      if (push) {
        history.pushState({ id: id }, '', location.pathname + '?id=' + encodeURIComponent(id));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      bump(id);
    } catch (e) {
      if (box) box.innerHTML = '<div class="rv-empty">자료를 불러오지 못했습니다. '
        + '잠시 후 다시 시도해 주십시오.</div>';
    }
  }

  /* 조회수 — 이미 있는 함수를 부릅니다(recruit_job_hit / recruit_talent_hit).
     실패해도 화면에는 알리지 않습니다. 읽는 일을 방해할 까닭이 없습니다. */
  function bump(id) {
    if (!cfg.hitFn) return;
    fetch(SB + '/rest/v1/rpc/' + cfg.hitFn, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, HDR),
      body: JSON.stringify({ p_id: Number(id) }),
    }).catch(function () {});
  }

  /* ── 오른쪽 목록 — 누르면 왼쪽만 바꿉니다 ────────────────
     화면을 새로 불러오면 목록이 처음 쪽으로 돌아가 버립니다.
     여기서 가로채면 보고 있던 자리가 그대로 남습니다.
     ★ 가로채기가 어긋나면 원래대로 화면을 옮겨 갑니다 (막다른 길 없음) */
  function bindList() {
    var list = el('#rcList');
    if (!list) return;
    list.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="id="]');
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;  /* 새 창으로 열기는 그대로 */
      var m = a.getAttribute('href').match(/[?&]id=(\d+)/);
      if (!m) return;
      e.preventDefault();
      load(m[1], true);
    });
    window.addEventListener('popstate', function () {
      var id = new URLSearchParams(location.search).get('id');
      if (id) load(id, false);
    });
  }

  /* ── 오른쪽 목록이 붙어 따라오는 자리 ─────────────────────
     인재정보의 찾는 칸과 같은 방식입니다 —
     화면에 들어가면 위쪽에, 화면보다 길면 아래쪽 끝이 보이는 자리에. */
  var GAP = 24;
  function measureAside() {
    var box = el('.rv-aside');
    if (!box) return;
    var host = document.querySelector('.rv-layout') || document.body;
    var rcTop = parseFloat(getComputedStyle(host).getPropertyValue('--rc-top')) || 120;
    var h = Math.round(box.getBoundingClientRect().height);
    var room = window.innerHeight - rcTop - GAP;
    var top = (h <= room) ? rcTop : (window.innerHeight - h - GAP);
    document.documentElement.style.setProperty('--rv-aside-top', Math.round(top) + 'px');
  }

  /* ── 시작 ─────────────────────────────────────────────────*/
  function init(options) {
    cfg = Object.assign({ kind: 'job' }, options || {});
    R = window.OCRecruit;
    if (!R) { console.error('assets/recruit.js 를 먼저 불러야 합니다.'); return; }

    var id = new URLSearchParams(location.search).get('id');
    if (!id) {
      var box = el('#rvDoc');
      if (box) box.innerHTML = '<div class="rv-empty">어느 정보를 보시려는지 알 수 없습니다.<br>'
        + '<a class="rv-lk" href="' + cfg.listPage + '">목록으로 돌아가기</a></div>';
      return;
    }

    bindList();
    load(id, false);

    measureAside();
    setTimeout(measureAside, 300);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(measureAside);
      var box2 = el('.rv-aside');
      if (box2) ro.observe(box2);
    }
    window.addEventListener('resize', measureAside);
  }

  window.OCRecruitView = { init: init, markCurrent: markCurrent };
})();
