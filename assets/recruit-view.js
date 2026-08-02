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

    /* ── 지원하기 — 이메일이 있을 때만 실제로 눌립니다 ──
         누를 수 없는 단추를 눌러 보게 하는 것보다,
         왜 못 누르는지 알려 주는 것이 낫습니다. */
    var applyBtn = has(o.contact_email)
      ? '<a class="rv-btn rv-btn--go" href="mailto:' + esc(o.contact_email)
        + '?subject=' + encodeURIComponent('[오퍼스클램 리쿠르트] ' + (o.title || '') + ' 지원')
        + '">지원하기</a>'
      : '<span class="rv-btn rv-btn--off" title="등록된 이메일이 없습니다. 문의처를 확인해 주십시오.">지원하기</span>';

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
