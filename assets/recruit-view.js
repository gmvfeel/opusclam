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
  /* ★ 익명 열쇠만 실어 보내면 서버는 언제나 손님으로 봅니다.
     머리글 만드는 일은 공용 모듈(recruit.js)이 맡습니다. */
  function HDRS(extra) { return R.headers(extra); }

  /* ── 어느 DB의 단체인가 ───────────────────────────────────
     채용정보를 올리는 회원의 성격에 따라 그 단체가 담긴 DB가 다릅니다.
     그래서 공고에 org_db(어느 DB) + org_id(몇 번) 을 짝으로 담습니다.

     ★ 목록 경로는 파트너님이 확인해 주신 것입니다.
       상세 경로는 org-view.html 이 확인되었고, 나머지 셋은 같은
       이름 짓는 버릇(-view 를 붙이는)으로 맞추었습니다.
       다르면 이 표의 view 한 줄만 고치십시오. */
  var ORG_DBS = {
    org:        { label: '음악단체DB',      list: '/db/org.html',        view: '/db/org-view.html' },
    venue:      { label: '공연장DB',        list: '/db/venue.html',      view: '/db/venue-view.html' },
    school:     { label: '음악학교DB',      list: '/db/school.html',     view: '/db/school-view.html' },
    foundation: { label: '관련기관·재단DB', list: '/db/foundation.html', view: '/db/foundation-view.html' },
  };
  /* 어느 DB인지 담겨 있지 않을 때 기댈 곳 — 채용은 음악단체가 가장 많습니다 */
  var ORG_DB_FALLBACK = 'org';

  /* 로그인 화면 경로 —
     ★ 확인이 필요합니다. 실제 경로가 다르면 이 한 줄만 고치십시오. */
  var LOGIN_PAGE = '/account/login.html';

  var R, cfg = null, cur = null;
  /* 보는 사람 확인은 공용 모듈(recruit.js)이 맡습니다 —
     목록 엔진과 같은 규칙으로 판단해야 하므로 한 곳에만 둡니다. */
  function viewer() { return R.viewer(); }

  /* ── 어느 DB의 단체인가 ───────────────────────────────────
     채용정보를 올리는 회원의 성격에 따라 그 단체가 담긴 DB가 다릅니다.
     그래서 공고에 org_db(어느 DB) + org_id(몇 번) 을 짝으로 담습니다.

     ★ 목록 경로는 파트너님이 확인해 주신 것입니다.
       상세 경로는 org-view.html 이 확인되었고, 나머지 셋은 같은
       이름 짓는 버릇(-view 를 붙이는)으로 맞추었습니다.
       다르면 이 표의 view 한 줄만 고치십시오. */
  var ORG_DBS = {
    org:        { label: '음악단체DB',      list: '/db/org.html',        view: '/db/org-view.html' },
    venue:      { label: '공연장DB',        list: '/db/venue.html',      view: '/db/venue-view.html' },
    school:     { label: '음악학교DB',      list: '/db/school.html',     view: '/db/school-view.html' },
    foundation: { label: '관련기관·재단DB', list: '/db/foundation.html', view: '/db/foundation-view.html' },
  };
  /* 어느 DB인지 담겨 있지 않을 때 기댈 곳 — 채용은 음악단체가 가장 많습니다 */
  var ORG_DB_FALLBACK = 'org';

  /* 로그인 화면 경로 —
     ★ 확인이 필요합니다. 실제 경로가 다르면 이 한 줄만 고치십시오. */
  var LOGIN_PAGE = '/account/login.html';

  var R, cfg = null, cur = null;
  var viewerCache = null;      /* 보고 있는 회원 — 한 번만 물어봅니다 */

  /* ── 로그인한 회원 확인 ────────────────────────────────────
     ★ 연락처를 여는 함수(recruit_talent_contact)는 <b>서버가</b>
       권한을 판단합니다. 그러려면 익명 열쇠가 아니라 그 회원의
       세션 토큰으로 불러야 하므로 supabase-js 를 씁니다. */
  function sb() {
    if (!window.__ocSb && window.supabase) {
      window.__ocSb = window.supabase.createClient(SB, KEY);
    }
    return window.__ocSb || null;
  }

  async function viewer() {
    if (viewerCache !== null) return viewerCache;
    var c = sb();
    if (!c) { viewerCache = { user: null }; return viewerCache; }
    try {
      var r = await c.auth.getSession();
      var u = r.data && r.data.session && r.data.session.user;
      if (!u) { viewerCache = { user: null }; return viewerCache; }
      var mr = await c.from('members').select('*').eq('id', u.id).maybeSingle();
      var m = mr.data || {};
      viewerCache = {
        user: u,
        type: m.member_type || '',
        admin: !!m.is_admin,
        /* 연락처를 볼 수 있는 회원 — 채용하는 쪽입니다.
           서버에서도 같은 규칙으로 막고 있으므로, 여기서는
           「눌러 보고 거절당하는」 일을 줄이려고 미리 봅니다. */
        canSee: (R.HIRING.indexOf(m.member_type) >= 0 || !!m.is_admin),
      };
    } catch (e) {
      viewerCache = { user: null };
    }
    return viewerCache;
  }

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

  /* ── 상세 그리기 ──────────────────────────────────────────
     채용과 인재는 담은 것이 아주 달라 그리는 함수를 나눕니다.
     칸·제목·단추·붙어 따라오기는 CSS 로 함께 씁니다. */
  function draw(o) {
    cur = o;
    if (cfg.kind === 'talent') return drawTalent(o);
    return drawJob(o);
  }

  /* 채용 상세의 속 — 상세 화면과 미리보기가 함께 씁니다.
     인재 쪽(talentHtml)과 같은 까닭입니다 — 따로 만들면
     한쪽만 고쳐져 미리보기와 실제가 달라집니다. */
  function jobHtml(o, opt) {
    return drawJob(o, Object.assign({ html: true }, opt || {}));
  }

  function previewJob(o) {
    if (!R) R = window.OCRecruit;
    if (!cfg) cfg = { kind: 'job', listPage: '/recruit/job.html' };
    return drawJob(o || {}, { html: true, preview: true });
  }

  function drawJob(o, opt) {
    opt = opt || {};
    var box = opt.html ? null : el('#rvDoc');
    if (!opt.html && !box) return;

    var dday = R.daysLeft(o.apply_to);
    var ddayTag = (dday != null && dday >= 0 && dday <= 7)
      ? ' <b class="rc-dday">D-' + dday + '</b>' : '';
    var closed = (dday != null && dday < 0 && !o.apply_always && !o.apply_until_hired);

    /* ── 머리칸 — 회사·단체 ──
       오퍼스클램의 채용정보는 사업자·단체 회원만 올릴 수 있습니다.
       그러므로 모든 공고에는 반드시 등록된 단체가 하나 있습니다.

       ★ 가는 곳은 org_db(어느 DB) + org_id(몇 번) 이 정합니다 —
         음악단체·공연장·음악학교·관련기관재단 가운데 하나입니다.
       ★ 번호까지 있으면 그 단체 화면으로 바로 가고, 아직 번호가
         없는 자료는 그 DB의 목록으로 보내고 단체명을 검색어로
         실어 줍니다. 막다른 길은 만들지 않되, 없는 것을 있는 것처럼
         꾸미지도 않습니다.
       ★ 단추에 어느 DB로 가는지 적어 둡니다 — 누르기 전에 어디로
         가는지 알 수 있어야 합니다.

       ☞ 남은 일 — 채용등록 화면(job-write.html)에서 등록 회원이
         자기 단체를 네 DB 가운데서 골라 org_db·org_id 로 담아야
         합니다. 그것이 채용정보와 DB를 잇는 고리입니다. */
    var db = ORG_DBS[o.org_db] || ORG_DBS[ORG_DB_FALLBACK];
    var orgHref = has(o.org_id)
      ? (db.view + '?id=' + encodeURIComponent(o.org_id))
      : (db.list + '?kw=' + encodeURIComponent(o.org_name || ''));

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
      +   '회사 / 단체정보 상세보기'
      +   '<span class="rv-orgdb">' + esc(db.label) + '</span>'
      +   '<span aria-hidden="true">→</span></a>'
      + '</div>';

    /* ── 채용정보 ── */
    var sec1 = ''
      + (has(o.duty)
        ? '<section class="rv-sec"><h2>담당업무</h2><div class="rv-body">' + nl(o.duty) + '</div></section>'
        : '')
      + '<section class="rv-sec"><h2>모집요강 및 응시자격</h2>'
      +   '<table class="rv-tbl"><tbody>'
      +     row('모집직종', jobCell(o))
      +     row('고용형태', arrCell(o.emp_types))
      +     row('모집인원', has(o.headcount) ? esc(o.headcount) + ' 명' : '')
      +     row('근무형태', workCell(o))
      +     row('자격요건', qualCell(o))
      +     row('오디션여부', esc(o.audition || ''))
      /* 오디션곡명은 <b>한 줄을 다 씁니다.</b>
         앞서는 오디션여부와 한 줄에 네 칸으로 두었는데, 그 한 줄
         때문에 표가 4열이 되어 나머지 줄의 오른쪽 두 열이 통째로
         비어 남았습니다. 곡명은 길어지므로 넓은 자리가 맞습니다. */
      +     row('오디션곡명', nl(o.audition_piece || ''))
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

    /* ── 지원하기 ────────────────────────────────────────────

       ★ 예전에는 <b>이메일이 적힌 공고만</b> 눌릴 수 있었습니다.
         그래서 이메일을 안 적은 공고는 지원할 길이 없었습니다.
         이제 오퍼스클램 안에서 지원을 받으므로 <b>모든 공고에</b>
         지원하기가 살아 있습니다.

       ★ 단체가 자체 절차로만 받고 싶을 때는 accept_site 를 끕니다.
         그 경우에만 지원하기 대신 접수방법 안내가 보입니다 —
         길을 막지 않되 기본값은 사이트 지원입니다.

       ★ 마감된 공고는 지원을 받지 않습니다.
         냈는데 아무도 안 보는 것이 가장 나쁜 결과입니다. */
    var siteApply = (o.accept_site !== false);
    var applyBtn;
    if (closed) {
      applyBtn = '<span class="rv-btn rv-btn--off" title="접수가 끝난 공고입니다.">접수 마감</span>';
    } else if (siteApply) {
      /* 눌렀을 때 창을 엽니다. 이미 지원했는지는 아래에서 확인해 글자를 바꿉니다. */
      applyBtn = '<button type="button" class="rv-btn rv-btn--go" id="rvApply">지원하기</button>';
    } else if (has(o.contact_email)) {
      applyBtn = '<a class="rv-btn rv-btn--go" href="mailto:' + esc(o.contact_email)
        + '?subject=' + encodeURIComponent('[오퍼스클램 리쿠르트] ' + (o.title || '') + ' 지원')
        + '">이메일로 지원하기</a>';
    } else {
      applyBtn = '<span class="rv-btn rv-btn--off" title="이 공고는 오퍼스클램 안에서 지원을 받지 않습니다. 접수방법을 확인해 주십시오.">접수방법 확인</span>';
    }

    var out = ''
      + '<h1 class="rv-title">' + esc(o.title || '(제목을 아직 적지 않았습니다)') + '</h1>'
      + head
      /* 두 묶음을 큰 제목으로 갈라 둡니다.
         앞서는 옮겨 가는 탭 단추를 두었는데, 한 화면에 내용이
         모두 펼쳐져 있으므로 누를 까닭이 없었습니다. */
      + '<h2 class="rv-group">채용상세정보</h2>'
      + sec1
      + '<h2 class="rv-group">접수기간 / 방법</h2>'
      + sec2
      ;

    /* 미리보기에는 지원·목록 단추와 문의 안내를 붙이지 않습니다 —
       아직 담기지 않았으므로 지원할 곳도, 돌아갈 목록도 없습니다. */
    if (!opt.preview) {
      out += '<div class="rv-btns">' + applyBtn
        + '<a class="rv-btn rv-btn--list" href="' + cfg.listPage + '">목록</a></div>'
        + '<div class="rv-note">'
        +   '<p>등록된 내용은 채용 주체가 직접 올린 것입니다. 채용 조건과 일정은 바뀔 수 있으니 '
        +   '지원 전에 문의처로 다시 확인해 주십시오.</p>'
        +   '<a class="rv-mail" href="mailto:cser@wixon.co.kr?subject='
        +   encodeURIComponent('[오퍼스클램] 채용정보 문의 — ' + (o.title || ''))
        +   '">메일문의하기</a>'
        + '</div>';
    }

    if (opt.html) return out;

    box.innerHTML = out;
    markCurrent(o.id);
    document.title = (o.title || '채용정보') + ' · 리쿠르트 · OPUSCLAM.COM';
  }

  /* ============================================================
     인재 상세
     ============================================================ */

  /* 음악학교DB 경로 — 출신학교를 눌러 그 학교로 건너갑니다.
     인재 → 출신학교 → 그 학교의 입시요강 → 그 학교 출신 다른 인물
     로 이어지는 고리의 첫 칸입니다. */
  var SCHOOL_VIEW = '/db/school-view.html';
  var SCHOOL_LIST = '/db/school.html';

  /* ── 구직사항 ─────────────────────────────────────────────*/
  function wishBlock(o) {
    return '<section class="rv-sec"><h2>구직사항</h2>'
      + '<table class="rv-tbl"><tbody>'
      +   row('희망분야', jobCell(o))
      +   row('희망급여', payCell(o))
      +   row('근무지역', regionCell(o))
      +   row('근무형태', arrCell(o.emp_types))
      +   row('현재상태', esc(o.now_status || ''))
      + '</tbody></table></section>';
  }

  /* ── 학력사항 / 경력사항 ──────────────────────────────────
     schools 는 학교 하나를 한 덩이로 담은 목록입니다.
       { country, name, school_id, degree, major, from, to }
     school_id 가 있으면 음악학교DB의 그 학교로 이어집니다.
     없으면 이름으로 음악학교DB를 찾아 갑니다 — 막다른 길은 없습니다. */
  function schoolsBlock(o) {
    var list = o.schools;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { list = null; } }
    if (!Array.isArray(list)) list = [];

    var rows = list.map(function (s) {
      s = s || {};
      var nameHtml = esc(s.name || '');
      if (has(s.name)) {
        var href = has(s.school_id)
          ? (SCHOOL_VIEW + '?id=' + encodeURIComponent(s.school_id))
          : (SCHOOL_LIST + '?kw=' + encodeURIComponent(s.name));
        nameHtml = '<a class="rv-lk" href="' + href + '">' + esc(s.name) + '</a>';
      }
      var span = (has(s.from) || has(s.to))
        ? (esc(s.from || '') + ' - ' + esc(s.to || '')) : '';
      return '<tr>'
        + '<td>' + (has(s.country) ? esc(s.country) : '-') + '</td>'
        + '<td class="sc-name">' + (nameHtml || '-') + '</td>'
        + '<td>' + (has(s.degree) ? esc(s.degree) : '-') + '</td>'
        + '<td>' + (has(s.major) ? esc(s.major) : '-') + '</td>'
        + '<td class="sc-when">' + (span || '-') + '</td>'
        + '</tr>';
    }).join('');

    var schoolTbl = rows
      ? '<table class="rv-tbl rv-schools"><thead><tr>'
        + '<th>국가</th><th>학교명</th><th>학위</th><th>학과</th><th>재학기간</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>'
      : '<p class="rv-none">등록된 학력이 없습니다.</p>';

    return '<section class="rv-sec"><h2>학력사항 / 경력사항</h2>'
      + schoolTbl
      + (has(o.career)
        ? '<div class="rv-body rv-career">' + nl(o.career) + '</div>'
        : '')
      + '</section>';
  }

  /* ── 기타정보 ─────────────────────────────────────────────*/
  function etcBlock(o) {
    var dis = o.disability;
    if (has(dis) && has(o.disability_grade)) dis = dis + ' (' + o.disability_grade + ')';
    var mil = o.military;
    if (has(mil) && (has(o.military_from) || has(o.military_to))) {
      mil = mil + ' (' + (o.military_from || '') + ' - ' + (o.military_to || '') + ')';
    }
    var body = row('보훈대상여부', esc(o.veteran || ''))
             + row('장애여부', esc(dis || ''))
             + row('병역사항', esc(mil || ''));
    if (!body) return '';
    return '<section class="rv-sec"><h2>기타정보</h2>'
      + '<table class="rv-tbl"><tbody>' + body + '</tbody></table></section>';
  }

  /* ── 연락처 가림막 ────────────────────────────────────────
     ★ 이 화면은 표가 아니라 <b>뷰</b>(recruit_talents_public)를 읽습니다.
       그 뷰에는 실명·연락처가 아예 담기지 않습니다. 그래서 화면에서
       가리는 것이 아니라 <b>처음부터 오지 않습니다.</b>
       가림막을 벗기는 것은 서버 함수(recruit_talent_contact)뿐이고,
       그 함수가 회원 종류를 보고 판단합니다.

     그러므로 이 가림막은 「잠금장치」 가 아니라 「안내판」 입니다.
     장치는 서버에 있습니다. */
  function maskBlock(v) {
    var msg, btn;
    if (!v.user) {
      msg = '이 인재의 연락처와 이름은 회원만 확인할 수 있습니다.';
      btn = '<a class="rv-btn rv-btn--go rv-btn--sm" href="' + LOGIN_PAGE + '?next='
          + encodeURIComponent(location.pathname + location.search) + '">로그인하고 열람하기</a>';
    } else if (!v.canSee) {
      /* 단추를 두지 않습니다 — 이 회원이 지금 할 수 있는 일이 없습니다.
         눌러도 아무 일이 없는 단추는 없는 것보다 못합니다. */
      msg = '연락처 열람은 <b>음악관계자·단체·기업</b> 또는 <b>음악학교</b> 회원에게 열려 있습니다.';
      btn = '';
    } else {
      msg = '채용을 위해 이 인재의 이름과 연락처를 확인하실 수 있습니다.';
      btn = '<button type="button" class="rv-btn rv-btn--go rv-btn--sm" id="rvReveal">연락처 열람</button>';
    }

    return '<div class="rv-mask" id="rvMask">'
      /* 뒤에 깔리는 것 — 실제 값이 아니라 자리를 알려 주는 모양뿐입니다 */
      + '<div class="rv-mask-back" aria-hidden="true">'
      +   '<div class="rv-mask-photo"></div>'
      +   '<div class="rv-mask-lines">'
      +     '<span></span><span></span><span></span><span></span>'
      +   '</div>'
      + '</div>'
      + '<div class="rv-mask-over">'
      +   '<p>' + msg + '</p>' + btn
      + '</div>'
      + '</div>';
  }

  /* 연락처 이름표 — 함수가 돌려주는 키를 우리 말로 바꿉니다.
     모르는 키가 와도 그냥 건너뜁니다(함수가 바뀌어도 깨지지 않게). */
  var CONTACT_LABELS = {
    name: '이름', gender: '성별', birth_year: '출생년',
    phone: '휴대폰', tel: '전화번호', email: '이메일',
    addr1: '주소', addr2: '상세주소',
  };

  async function reveal(id) {
    var box = el('#rvMask');
    var c = sb();
    if (!box || !c) return;
    box.classList.add('is-loading');

    try {
      var r = await c.rpc('recruit_talent_contact', { p_id: Number(id) });
      if (r.error) throw r.error;
      var d = r.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) {} }
      if (!d || typeof d !== 'object') throw new Error('empty');

      var rows = '';
      Object.keys(CONTACT_LABELS).forEach(function (k) {
        if (!has(d[k])) return;
        var v = (k === 'email')
          ? '<a class="rv-lk" href="mailto:' + esc(d[k]) + '">' + esc(d[k]) + '</a>'
          : (k === 'phone' || k === 'tel')
            ? '<a class="rv-lk" href="tel:' + esc(String(d[k]).replace(/[^0-9+]/g, '')) + '">' + esc(d[k]) + '</a>'
            : esc(d[k]);
        rows += row(CONTACT_LABELS[k], v);
      });
      if (!rows) throw new Error('empty');

      var photo = has(d.photo_url)
        ? '<div class="rv-contact-photo"><img src="' + esc(d.photo_url) + '" alt=""></div>' : '';

      box.classList.remove('is-loading');
      box.outerHTML = '<div class="rv-contact">'
        + photo
        + '<div class="rv-contact-body">'
        +   '<h3>연락처</h3>'
        +   '<table class="rv-tbl"><tbody>' + rows + '</tbody></table>'
        +   '<p class="rv-contact-note">채용 목적 외로 쓰거나 다른 곳에 옮기는 것은 '
        +   '개인정보보호법으로 금지되어 있습니다.</p>'
        + '</div></div>';
    } catch (e) {
      box.classList.remove('is-loading');
      var over = box.querySelector('.rv-mask-over');
      if (over) {
        over.innerHTML = '<p>연락처를 열지 못했습니다. 권한이 없거나 잠시 문제가 생겼을 수 있습니다.</p>'
          + '<a class="rv-btn rv-btn--list rv-btn--sm" href="mailto:cser@wixon.co.kr">문의하기</a>';
      }
    }
  }

  /* ── 인재 상세의 속 — 상세 화면과 미리보기가 <b>함께</b> 씁니다.
       등록 화면에서 미리보기를 따로 만들면, 한쪽만 고쳐져
       「미리보기와 실제가 다른」 일이 반드시 생깁니다.

       preview 일 때 빼는 것 —
         · 연락처 가림막  (아직 담기지 않았으므로 열 것이 없습니다)
         · 목록 단추·문의 안내 (미리보기 창에는 쓸 곳이 없습니다) */
  function talentHtml(o, opt) {
    opt = opt || {};
    var g = String(o.gender || '').replace('남성', '남').replace('여성', '여');
    /* 미리보기에서는 이름을 실제로 가려 보여 줍니다 —
       「남에게 이렇게 보인다」 를 확인하는 것이 미리보기의 뜻입니다. */
    var who = opt.preview ? maskName(o.name) : (o.name_masked || '');
    var age = o.age || (o.birth_year ? (new Date().getFullYear() - Number(o.birth_year) + 1) : '');

    return ''
      + '<h1 class="rv-title">' + esc(o.title || '(제목을 아직 적지 않았습니다)') + '</h1>'
      + '<div class="rv-who">' + esc(who)
      +   '<span>' + esc(g) + (age ? ' / ' + esc(age) + '세' : '') + '</span></div>'
      + (opt.preview ? previewMaskNote(o) : maskBlock(opt.viewer || { user: null }))
      + '<h2 class="rv-group">인재상세정보</h2>'
      + wishBlock(o)
      + schoolsBlock(o)
      + etcBlock(o)
      + (has(o.body)
        ? '<section class="rv-sec"><h2>자기소개서</h2>'
          + '<div class="rv-body rv-body--long">' + nl(o.body) + '</div></section>'
        : '');
  }

  /* 이름 가리기 — 뷰가 하는 것과 같은 꼴(조**)로 보여 줍니다 */
  function maskName(name) {
    var n = String(name || '').trim();
    if (!n) return '';
    if (n.length <= 1) return n;
    return n.charAt(0) + Array(n.length).join('*');
  }

  /* 미리보기의 가림막 자리 —
     ★ 사진을 여기에 보여 줍니다.
       사진은 실제 화면에서는 「연락처 열람」 을 누른 뒤에만 그려지므로,
       미리보기에 그 자리를 두지 않으면 <b>올린 사진을 확인할 곳이
       없습니다.</b> 미리보기는 내가 올린 것을 확인하는 자리이니
       보여 드리고, 남에게는 언제 보이는지 함께 알려 줍니다. */
  function previewMaskNote(o) {
    var photo = has(o && o.photo_url)
      ? '<div class="rv-note-photo"><img src="' + esc(o.photo_url) + '" alt="올리신 사진"></div>'
      : '';
    return '<div class="rv-mask rv-mask--note">'
      + '<div class="rv-note-in">'
      +   photo
      +   '<div class="rv-note-txt">'
      +     '<p>이름 · 연락처' + (photo ? ' · 사진' : '')
      +     ' 은 <b>채용하는 단체·학교 회원이 열람할 때만</b> 보입니다. '
      +     '다른 분들에게는 이 자리가 가려집니다.</p>'
      +     (photo ? '' : '<p class="rv-note-add">사진을 올리시면 뽑는 쪽이 훨씬 잘 봅니다.</p>')
      +   '</div>'
      + '</div></div>';
  }

  async function drawTalent(o) {
    var box = el('#rvDoc');
    if (!box) return;

    var v = await viewer();

    box.innerHTML = talentHtml(o, { viewer: v })
      + '<div class="rv-btns">'
      +   '<a class="rv-btn rv-btn--list" href="' + cfg.listPage + '">목록</a>'
      + '</div>'
      + '<div class="rv-note">'
      +   '<p>등록된 내용은 본인이 직접 올린 것입니다. 이름과 연락처는 '
      +   '채용을 위해 열람한 회원에게만 보이며, 열람 기록이 남습니다.</p>'
      +   '<a class="rv-mail" href="mailto:cser@wixon.co.kr?subject='
      +   encodeURIComponent('[오퍼스클램] 인재정보 문의 — ' + (o.title || ''))
      +   '">메일문의하기</a>'
      + '</div>';

    var b = el('#rvReveal');
    if (b) b.addEventListener('click', function () { reveal(o.id); });

    markCurrent(o.id);
    document.title = (o.title || '인재정보') + ' · 리쿠르트 · OPUSCLAM.COM';
  }

  /* 미리보기 — 등록 화면이 부릅니다. HTML 만 돌려줍니다.
     ★ R(분류 자료)이 필요하므로 부르기 전에 채워 둡니다.
       상세 화면을 거치지 않고 바로 부를 수 있게 하려는 것입니다. */
  function previewTalent(o) {
    if (!R) R = window.OCRecruit;
    if (!cfg) cfg = { kind: 'talent', listPage: '/recruit/talent.html' };
    return talentHtml(o || {}, { preview: true });
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
        + '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1',
        { headers: await HDRS() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();
      if (!rows || !rows.length) {
        /* ★ 인재정보는 「없다」 와 「볼 수 없다」 를 갈라 알려 줍니다.
           채용 회원이 아니면 서버가 줄을 내주지 않으므로 0건이 옵니다.
           그것을 「없습니다」 라고 하면 거짓이 됩니다. */
        if (box) box.innerHTML = await notFoundHtml();
        return;
      }
      draw(rows[0]);
      if (push) {
        history.pushState({ id: id }, '', location.pathname + '?id=' + encodeURIComponent(id));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      bump(id);
      /* ★ 채용 공고면 지원하기 단추를 잇습니다.
         그림을 다 그린 뒤에 해야 단추가 이미 있습니다. */
      if (cfg.kind === 'job') bindApply(rows[0]);
    } catch (e) {
      if (box) box.innerHTML = '<div class="rv-empty">자료를 불러오지 못했습니다. '
        + '잠시 후 다시 시도해 주십시오.</div>';
    }
  }

  async function notFoundHtml() {
    if (cfg.kind === 'talent') {
      var v = await viewer();
      if (!v.canSeeTalents) {
        return '<div class="rv-gate">'
          + '<h2>채용 회원 전용</h2>'
          + (v.user
            ? '<p>인재정보 열람은 <b>음악관계자·단체·기업</b> 또는 <b>음악학교</b> 회원에게 '
              + '열려 있습니다.<br>전공자·일반 회원께는 <b>본인이 등록한 인재정보</b>만 보입니다.</p>'
              + '<a class="rv-btn rv-btn--go" href="/recruit/guide.html">회원 종류 안내</a>'
            : '<p>인재정보는 회원만 볼 수 있습니다.</p>'
              + '<a class="rv-btn rv-btn--go" href="' + LOGIN_PAGE + '?next='
              + encodeURIComponent(location.pathname + location.search) + '">로그인하기</a>')
          + '<a class="rv-btn rv-btn--list" href="' + cfg.listPage + '">목록</a>'
          + '</div>';
      }
    }
    return '<div class="rv-empty">찾으시는 정보가 없습니다. '
      + '지워졌거나 주소가 잘못되었을 수 있습니다.<br>'
      + '<a class="rv-lk" href="' + cfg.listPage + '">목록으로 돌아가기</a></div>';
  }

  /* ── 지원하기 단추 잇기 ──────────────────────────────────
     ★ 이미 지원한 공고면 단추 글자를 「지원함」 으로 바꿉니다.
       눌러 보고 나서 「이미 지원했습니다」 를 보는 것보다,
       <b>누르기 전에 알려 주는</b> 편이 낫습니다.
     ★ 확인하는 동안 단추를 감추지 않습니다 —
       느린 회선에서 단추가 사라졌다 나타나면 불안합니다. */
  async function bindApply(o) {
    var c = sb();

    /* ★ 내가 올린 공고인지를 <b>자료로</b> 판단합니다.

       예전에는 서버 함수(recruit_job_app_count)가 「권한이 있느냐」 로
       답한 것을 그대로 믿었습니다. 그런데 그 함수가 관리자 판단까지
       함께 하고 있어서, 남의 공고인데도 「내 공고」 로 보이는 일이
       생겼습니다 — 일반 회원에게 「받은 지원 0건」 이 뜨고 지원을
       못 하게 된 것이 그 때문입니다.

       공고 자료에 member_id 가 이미 있습니다. 내 아이디와 견주면
       <b>남의 판단을 기다리지 않고</b> 확실히 압니다.
       건수는 그다음에 물어봅니다. */
    var uid = null;
    if (c) {
      try {
        var ses0 = await c.auth.getSession();
        uid = (ses0 && ses0.data && ses0.data.session && ses0.data.session.user)
          ? ses0.data.session.user.id : null;
      } catch (e) {}
    }
    var isMine = !!(uid && o.member_id && String(o.member_id) === String(uid));

    if (c && isMine) {
      try {
        var cr = await c.rpc('recruit_job_app_count', { p_job: Number(o.id) });
        var cd = cr.data;
        if (typeof cd === 'string') cd = JSON.parse(cd);
        if (cd && cd.ok) {
          var mine = document.getElementById('rvApply');
          var box = mine ? mine.parentNode : document.querySelector('.rv-btns');
          if (mine) mine.remove();          /* 내 공고에는 지원하기가 필요 없습니다 */
          if (box) {
            box.insertAdjacentHTML('afterbegin',
              '<a class="rv-btn rv-btn--go" href="/account/mypage.html#raRecv">'
              + '받은 지원 ' + (cd.total || 0) + '건'
              + (cd.unread ? ' <span class="rv-newdot">' + cd.unread + '</span>' : '')
              + '</a>');
          }
          return;                            /* 내 공고이므로 아래 지원 처리는 하지 않습니다 */
        }
      } catch (e) { /* 건수를 못 받아도 아래에서 지원하기를 감춥니다 */ }
      /* ★ 내 공고이면 건수를 못 받았더라도 지원하기는 감춥니다 —
         자기 공고에 지원하려다 오류를 만나는 것보다 낫습니다. */
      var mine2 = document.getElementById('rvApply');
      if (mine2) {
        mine2.textContent = '내가 올린 공고';
        mine2.disabled = true;
        mine2.classList.add('rv-btn--off');
        mine2.title = '내가 올린 공고에는 지원할 수 없습니다. 받은 지원은 마이페이지에서 보실 수 있습니다.';
      }
      return;
    }

    var btn = document.getElementById('rvApply');
    if (!btn) return;                       /* 마감·이메일 지원 공고에는 단추가 없습니다 */
    btn.addEventListener('click', function () { openApply(o); });

    if (!c || !uid) return;                 /* 손님은 눌렀을 때 안내합니다 */
    try {
      var r = await c.rpc('recruit_my_application', { p_job: Number(o.id) });
      var d = r.data;
      if (typeof d === 'string') d = JSON.parse(d);
      if (d && d.applied && d.status !== '지원취소') {
        btn.textContent = '지원함 · ' + (d.status || '접수');
        btn.classList.add('rv-btn--off');
        btn.title = '이미 지원하신 공고입니다. 눌러서 진행 상태를 보실 수 있습니다.';
      }
    } catch (e) { /* 못 물어봐도 지원하기는 그대로 눌립니다 */ }
  }

  /* ══════════════════════════════════════════════════════════
     지원 창

     ★ 무엇을 담는가
       · 내 인재정보 고르기 — 등록해 둔 것이 있으면 붙입니다
       · 파일 하나 — 이력서·포트폴리오·연주 영상 링크 대신 파일
       · 하고 싶은 말
       · <b>개인정보 동의</b>

     ★ 동의를 반드시 받는 까닭
       지원하면 이름·연락처가 그 단체에 넘어갑니다. 인재정보 열람과
       같은 성격이므로, 무엇이 넘어가는지 <b>보여 주고</b> 동의를 받습니다.
       동의 없이 넘기는 것은 옳지 않고, 나중에 문제가 됩니다.

     ★ 이름·연락처는 지원 시점의 값을 베껴 담습니다.
       인재정보를 나중에 고치거나 지워도 단체가 받은 지원서는 남아야
       합니다. 그러지 않으면 단체가 연락할 길을 잃습니다.
     ══════════════════════════════════════════════════════════ */

  var applyState = { job: null, me: null, talents: [], fileUrl: null, fileName: null, busy: false };

  function applyModalHtml() {
    return ''
      + '<div class="ra-dim" id="raDim"></div>'
      + '<div class="ra-win" role="dialog" aria-modal="true" aria-label="지원하기">'
      +   '<div class="ra-head">'
      +     '<b>지원하기</b>'
      +     '<button type="button" class="ra-x" id="raClose" aria-label="닫기">✕</button>'
      +   '</div>'
      +   '<div class="ra-body" id="raBody"></div>'
      +   '<div class="ra-foot">'
      +     '<span class="ra-msg" id="raMsg"></span>'
      +     '<button type="button" class="rv-btn rv-btn--list" id="raCancel">취소</button>'
      +     '<button type="button" class="rv-btn rv-btn--go" id="raSend">지원서 보내기</button>'
      +   '</div>'
      + '</div>';
  }

  function ensureApplyBox() {
    var box = document.getElementById('raWrap');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'raWrap';
    box.className = 'ra-wrap';
    box.hidden = true;
    box.innerHTML = applyModalHtml();
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      if (e.target.id === 'raDim' || e.target.id === 'raClose' || e.target.id === 'raCancel') closeApply();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) closeApply();
    });
    var send = box.querySelector('#raSend');
    if (send) send.addEventListener('click', submitApply);
    return box;
  }

  function closeApply() {
    var box = document.getElementById('raWrap');
    if (box) box.hidden = true;
    document.body.classList.remove('ra-open');
  }

  function raSay(t, kind) {
    var el = document.getElementById('raMsg');
    if (!el) return;
    el.innerHTML = t || '';
    el.className = 'ra-msg' + (kind ? ' ra-msg--' + kind : '');
  }

  /* 내가 등록해 둔 인재정보를 가져옵니다 —
     붙여 두면 단체가 학력·경력을 함께 볼 수 있어 도움이 됩니다. */
  async function myTalents() {
    var c = sb();
    if (!c || !applyState.me) return [];
    try {
      var r = await c.from('recruit_talents')
        .select('id,title,job_cat1,job_cat2,created_at,is_open,hidden')
        .eq('member_id', applyState.me.id)
        .order('created_at', { ascending: false });
      return (r.data || []).filter(function (x) { return !x.hidden; });
    } catch (e) { return []; }
  }

  async function openApply(o) {
    var box = ensureApplyBox();
    box.hidden = false;
    document.body.classList.add('ra-open');
    var body = document.getElementById('raBody');
    body.innerHTML = '<p class="ra-load">준비하는 중…</p>';
    raSay('');

    var c = sb();
    if (!c) { body.innerHTML = '<p class="ra-warn">지금은 지원할 수 없습니다. 잠시 뒤 다시 시도해 주십시오.</p>'; return; }

    /* 로그인 확인 */
    var ses = await c.auth.getSession();
    var u = ses && ses.data && ses.data.session && ses.data.session.user;
    if (!u) {
      body.innerHTML = ''
        + '<div class="ra-gate">'
        +   '<p><b>지원하려면 로그인이 필요합니다.</b></p>'
        +   '<p>지원 내역이 마이페이지에 남고, 단체가 보낸 결과를 받아 보실 수 있습니다.</p>'
        +   '<a class="rv-btn rv-btn--go" href="' + LOGIN_PAGE + '?next='
        +     encodeURIComponent(location.pathname + location.search) + '">로그인하기</a>'
        + '</div>';
      document.getElementById('raSend').hidden = true;
      return;
    }
    applyState.me = u;
    applyState.job = o;
    document.getElementById('raSend').hidden = false;

    /* 이미 지원했는지 */
    var already = null;
    try {
      var mr = await c.rpc('recruit_my_application', { p_job: Number(o.id) });
      already = mr.data || null;
      if (typeof already === 'string') already = JSON.parse(already);
    } catch (e) {}
    if (already && already.applied && already.status !== '지원취소') {
      body.innerHTML = ''
        + '<div class="ra-gate">'
        +   '<p><b>이미 지원하신 공고입니다.</b></p>'
        +   '<p>지원한 때 — ' + esc(String(already.at || '').slice(0, 10))
        +     ' · 진행 상태 — <b>' + esc(already.status || '접수') + '</b></p>'
        +   '<p class="ra-note">한 공고에는 한 번만 지원하실 수 있습니다. '
        +     '고쳐 내고 싶으시면 마이페이지에서 지원을 취소한 뒤 다시 내십시오.</p>'
        +   '<a class="rv-btn rv-btn--list" href="/account/mypage.html">마이페이지로</a>'
        + '</div>';
      document.getElementById('raSend').hidden = true;
      return;
    }

    /* 내 회원 정보와 인재정보를 함께 읽습니다 */
    var m = {};
    try {
      var r = await c.from('members').select('*').eq('id', u.id).maybeSingle();
      m = r.data || {};
    } catch (e) {}
    applyState.talents = await myTalents();

    var org = (o.org_name || '').trim();
    var nm = (m.name || '').trim();
    var ph = (m.phone || '').trim();
    var em = (m.email || u.email || '').trim();

    body.innerHTML = ''
      /* 어디에 지원하는지 다시 보여 줍니다 — 창만 보고 헷갈리지 않게 */
      + '<div class="ra-to">'
      +   '<span class="ra-to-l">지원하는 곳</span>'
      +   '<b>' + esc(org || '(단체명 없음)') + '</b>'
      +   '<span class="ra-to-t">' + esc(o.title || '') + '</span>'
      + '</div>'

      /* 인재정보 붙이기 */
      + '<div class="ra-f">'
      +   '<label>내 인재정보 붙이기</label>'
      +   (applyState.talents.length
        ? '<select id="raTalent">'
          + '<option value="">붙이지 않음</option>'
          + applyState.talents.map(function (t) {
              return '<option value="' + t.id + '">' + esc(t.title || '(제목 없음)')
                + (t.job_cat1 ? ' — ' + esc(t.job_cat1) : '')
                + (t.is_open === false ? ' (목록에 안 보이게 해 둔 것)' : '')
                + '</option>';
            }).join('')
          + '</select>'
          + '<p class="ra-hint">붙이시면 단체가 학력·경력·자기소개를 함께 봅니다. 훨씬 도움이 됩니다.</p>'
        : '<p class="ra-hint ra-hint--none">등록해 둔 인재정보가 없습니다. '
          + '<a href="/recruit/talent-write.html">인재정보를 먼저 올리시면</a> 지원할 때 함께 보낼 수 있습니다. '
          + '없이도 지원은 됩니다.</p>')
      + '</div>'

      /* 연락처 — 고칠 수 있게 둡니다 */
      + '<div class="ra-grid">'
      +   '<div class="ra-f"><label>이름 <em>*</em></label>'
      +     '<input type="text" id="raName" maxlength="40" value="' + esc(nm) + '" placeholder="실명"></div>'
      +   '<div class="ra-f"><label>연락처 <em>*</em></label>'
      +     '<input type="text" id="raPhone" maxlength="30" value="' + esc(ph) + '" placeholder="010-0000-0000"></div>'
      + '</div>'
      + '<div class="ra-f"><label>이메일 <em>*</em></label>'
      +   '<input type="email" id="raEmail" maxlength="120" value="' + esc(em) + '" placeholder="받을 수 있는 이메일"></div>'

      /* 하고 싶은 말 */
      + '<div class="ra-f"><label>하고 싶은 말</label>'
      +   '<textarea id="raMemo" rows="5" maxlength="1500" '
      +     'placeholder="지원하는 까닭, 연주 경험, 가능한 일정 같은 것을 적어 주십시오."></textarea>'
      +   '<p class="ra-hint">길게 쓰지 않으셔도 됩니다. 다만 한두 줄이라도 있으면 훨씬 잘 읽힙니다.</p>'
      + '</div>'

      /* 파일 */
      + '<div class="ra-f"><label>파일 붙이기</label>'
      +   '<div class="ra-file">'
      +     '<button type="button" class="ra-filebtn" id="raFileBtn">파일 선택</button>'
      +     '<span class="ra-filename" id="raFileName">선택한 파일 없음</span>'
      +     '<button type="button" class="ra-filedel" id="raFileDel" hidden>지우기</button>'
      +   '</div>'
      +   '<input type="file" id="raFile" style="display:none">'
      +   '<p class="ra-hint">이력서·포트폴리오·연주 녹음 등 하나를 올리실 수 있습니다. 한 파일 100MB 까지.</p>'
      + '</div>'

      /* 개인정보 동의 — 무엇이 넘어가는지 보여 주고 받습니다 */
      + '<div class="ra-agree">'
      +   '<label class="ra-check">'
      +     '<input type="checkbox" id="raAgree">'
      +     '<span>아래 정보가 <b>' + esc(org || '이 단체') + '</b> 에 전달되는 것에 동의합니다. <em>*</em></span>'
      +   '</label>'
      +   '<ul class="ra-agree-list">'
      +     '<li>이름 · 연락처 · 이메일</li>'
      +     '<li>붙이신 인재정보와 파일, 하고 싶은 말</li>'
      +     '<li>지원한 시각</li>'
      +   '</ul>'
      +   '<p class="ra-note">전달된 정보는 <b>채용 목적으로만</b> 쓰여야 합니다. '
      +     '지원은 마이페이지에서 취소하실 수 있고, 취소하시면 단체 화면에서도 취소로 표시됩니다.</p>'
      + '</div>';

    bindApplyFile();
  }

  /* 파일 올리기 — 게시판과 같은 방식으로, 실패한 까닭을 보여 줍니다 */
  function bindApplyFile() {
    var btn = document.getElementById('raFileBtn');
    var inp = document.getElementById('raFile');
    var nameEl = document.getElementById('raFileName');
    var delBtn = document.getElementById('raFileDel');
    if (!btn || !inp) return;

    applyState.fileUrl = null; applyState.fileName = null;

    btn.addEventListener('click', function () { inp.click(); });
    delBtn.addEventListener('click', function () {
      applyState.fileUrl = null; applyState.fileName = null;
      inp.value = ''; nameEl.textContent = '선택한 파일 없음'; delBtn.hidden = true;
    });

    inp.addEventListener('change', async function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var c = sb();
      if (!c || !applyState.me) return;
      nameEl.textContent = '올리는 중… ' + f.name;

      /* 이름에 확장자가 없으면 종류에서 짐작합니다 (게시판에서 겪은 문제) */
      var mm = String(f.name || '').match(/\.([A-Za-z0-9]{1,8})$/);
      var ext = mm ? mm[1].toLowerCase() : ({
        'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png',
        'audio/mpeg': 'mp3', 'video/mp4': 'mp4',
      }[String(f.type || '')] || 'bin');
      var path = applyState.me.id + '/app_' + Date.now() + '.' + ext;

      try {
        var up = await c.storage.from('recruit').upload(path, f, {
          upsert: false, contentType: f.type || undefined,
        });
        if (up.error) throw up.error;
        applyState.fileUrl = c.storage.from('recruit').getPublicUrl(path).data.publicUrl;
        applyState.fileName = f.name || ('첨부.' + ext);
        nameEl.textContent = applyState.fileName;
        delBtn.hidden = false;
        raSay('');
      } catch (e) {
        var msg = String((e && e.message) || e);
        if (/bucket not found/i.test(msg)) msg = '저장소가 없습니다. 관리자에게 알려 주십시오.';
        else if (/exceeded|too large|size/i.test(msg)) msg = '파일이 너무 큽니다 (100MB 까지)';
        else if (/policy|permission|unauthorized|row-level/i.test(msg)) msg = '올릴 권한이 없습니다. 다시 로그인해 보십시오.';
        nameEl.textContent = '선택한 파일 없음';
        raSay('파일을 올리지 못했습니다 — ' + esc(msg), 'warn');
      }
    });
  }

  async function submitApply() {
    if (applyState.busy) return;
    var o = applyState.job;
    var c = sb();
    if (!o || !c) return;

    var nm = (document.getElementById('raName') || {}).value || '';
    var ph = (document.getElementById('raPhone') || {}).value || '';
    var em = (document.getElementById('raEmail') || {}).value || '';
    var memo = (document.getElementById('raMemo') || {}).value || '';
    var tid = (document.getElementById('raTalent') || {}).value || '';
    var ok = (document.getElementById('raAgree') || {}).checked;

    /* 꼭 채워야 하는 것 — 무엇이 빠졌는지 하나씩 알려 줍니다 */
    if (!String(nm).trim())  { raSay('이름을 적어 주십시오.', 'warn'); return; }
    if (!String(ph).trim())  { raSay('연락처를 적어 주십시오.', 'warn'); return; }
    if (!String(em).trim())  { raSay('이메일을 적어 주십시오.', 'warn'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(em).trim())) {
      raSay('이메일 모양이 맞지 않습니다.', 'warn'); return;
    }
    if (!ok) { raSay('개인정보 전달에 동의해 주셔야 지원할 수 있습니다.', 'warn'); return; }

    applyState.busy = true;
    var send = document.getElementById('raSend');
    if (send) { send.disabled = true; send.textContent = '보내는 중…'; }
    raSay('');

    try {
      var row = {
        job_id: Number(o.id),
        applicant_id: applyState.me.id,
        talent_id: tid ? Number(tid) : null,
        name: String(nm).trim(),
        phone: String(ph).trim(),
        email: String(em).trim(),
        message: String(memo).trim() || null,
        file_url: applyState.fileUrl,
        file_name: applyState.fileName,
      };
      var r = await c.from('recruit_applications').insert([row]);
      if (r.error) throw r.error;

      var body = document.getElementById('raBody');
      body.innerHTML = ''
        + '<div class="ra-done">'
        +   '<p class="ra-done-t">지원서를 보냈습니다.</p>'
        +   '<p>' + esc((o.org_name || '단체').trim()) + ' 에 전달되었습니다. '
        +     '진행 상태는 <b>마이페이지</b>에서 보실 수 있습니다.</p>'
        +   '<p class="ra-note">결과 안내는 단체가 하는 일이므로 시기는 저마다 다릅니다. '
        +     '급하시면 공고의 문의처로 물어보십시오.</p>'
        +   '<a class="rv-btn rv-btn--go" href="/account/mypage.html">마이페이지에서 보기</a>'
        + '</div>';
      if (send) send.hidden = true;
      var cn = document.getElementById('raCancel');
      if (cn) cn.textContent = '닫기';

      /* 화면의 지원하기 단추도 바꿔 둡니다 */
      var ab = document.getElementById('rvApply');
      if (ab) { ab.textContent = '지원함'; ab.disabled = true; ab.classList.add('rv-btn--off'); }
    } catch (e) {
      var msg = String((e && e.message) || e);
      if (/duplicate key|recruit_app_once/i.test(msg)) {
        msg = '이미 지원하신 공고입니다. 마이페이지에서 확인해 주십시오.';
      } else if (/row-level|policy/i.test(msg)) {
        msg = '이 공고는 지금 지원을 받지 않습니다. 접수기간과 접수방법을 확인해 주십시오.';
      }
      raSay('보내지 못했습니다 — ' + esc(msg), 'warn');
      if (send) { send.disabled = false; send.textContent = '지원서 보내기'; }
    }
    applyState.busy = false;
  }

  /* 조회수 — 이미 있는 함수를 부릅니다(recruit_job_hit / recruit_talent_hit).
     실패해도 화면에는 알리지 않습니다. 읽는 일을 방해할 까닭이 없습니다. */
  async function bump(id) {
    if (!cfg.hitFn) return;
    try {
      await fetch(SB + '/rest/v1/rpc/' + cfg.hitFn, {
        method: 'POST',
        headers: await HDRS({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ p_id: Number(id) }),
      });
    } catch (e) { /* 조회수는 못 올려도 읽는 일을 방해하지 않습니다 */ }
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

  window.OCRecruitView = {
    init: init, markCurrent: markCurrent,
    previewTalent: previewTalent, previewJob: previewJob, jobHtml: jobHtml,
  };
})();
