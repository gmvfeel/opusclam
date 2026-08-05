/* ══════════════════════════════════════════════════════════════
   레슨:ON 강의 엔진 — assets/lesson-list.js          2026-08-05

   무엇을 하나
     OCLesson.list()   다섯 탭의 강의 목록 (설정만 다릅니다)
     OCLesson.view()   강의정보 (시안 01_1 계열) + 신청
     OCLesson.write()  강의 등록·수정 (승인된 인스트럭터)

   ★ <b>왜 한 엔진인가</b>
     시안의 다섯 탭은 짜임이 거의 같습니다 —
       마스터클래스 · 공개레슨 · 진행중 레슨 · 1:1레슨 · 그룹레슨
     화면을 다섯 번 만들면 하나를 고칠 때 <b>네 곳을 빠뜨립니다.</b>
     (org 를 네 곳에서 빠뜨린 일이 있었습니다)
     그래서 화면은 설정만 갖고, 그리는 일은 여기서 합니다.

   ★ 목록·상세는 <b>공개용 뷰</b>(lessons_public)를 읽습니다 —
     실시간 링크(live_url)가 아예 담기지 않습니다.
     링크는 신청이 승인된 뒤 oc_lesson_live_url() 로만 받습니다.

   ★ 정원(참여인원)은 <b>뷰가 세어 줍니다</b>(applied).
     화면이 강의마다 따로 세면 목록 한 판에 조회가 수십 번 늘어납니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCLesson) return;

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var BUCKET = 'recruit';

  /* ── 탭 설정 — <b>단 하나의 출처</b> ──────────────────────────
     화면은 이 이름만 넘깁니다. 무엇을 어떻게 걸러 보여 줄지는 여기서
     정합니다. 탭을 더하거나 조건을 바꿀 때 <b>이 표만</b> 고칩니다. */
  var TABS = {
    master: {
      label: '마스터클래스', en: 'Master Class',
      lead: '세계적인 아티스트의 마스터클래스를 무제한으로 수강하세요.',
      where: { tab: 'master' }
    },
    open: {
      label: '공개레슨', en: 'Open Lesson',
      lead: '누구나 볼 수 있는 공개 레슨입니다.',
      where: { tab: 'open' }
    },
    live: {
      /* ★ 「진행중 레슨」은 <b>갈래가 아니라 상태</b>입니다 —
         탭으로 걸러내지 않고 status 로 걸러냅니다. */
      label: '진행중 레슨', en: 'Lesson in Progress',
      lead: '지금 진행되고 있는 레슨입니다.',
      where: { status: 'ongoing' }
    },
    one: {
      label: '분야별 1:1레슨', en: 'One on One Lesson',
      lead: '인스트럭터와 일대일로 배웁니다.',
      where: { kind: 'one' }
    },
    group: {
      label: '분야별 그룹레슨', en: 'Group Lesson',
      lead: '같은 주제를 여러 사람이 함께 배웁니다.',
      where: { kind: 'group' }
    }
  };

  var FIELDS = ['STRINGS', 'BRASS', 'WINDS', 'PERCUSSIONS', '작곡/이론', '기타'];

  var STATUS_LABEL = { open: '모집중', ongoing: '진행중', closed: '마감', draft: '준비중' };

  /* ── 도우미 ─────────────────────────────────────────────── */
  function esc(v) { var d = document.createElement('div'); d.textContent = (v == null ? '' : String(v)); return d.innerHTML; }
  function $(id) { return document.getElementById(id); }
  function nf(n) { return (n == null ? '0' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')); }

  var _sb = null;
  function sb() {
    if (window.__ocSb) return window.__ocSb;
    if (_sb) return _sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    _sb = window.supabase.createClient(SB_URL, SB_KEY);
    window.__ocSb = _sb;
    return _sb;
  }
  function waitSb(cb) {
    var n = 0;
    (function tick() {
      var c = sb();
      if (c) return cb(c);
      if (++n > 60) return cb(null);
      setTimeout(tick, 50);
    })();
  }
  function md(v) {
    if (!v) return '';
    try {
      var d = new Date(v);
      return String(d.getFullYear()).slice(2) + '.'
        + ('0' + (d.getMonth() + 1)).slice(-2) + '.'
        + ('0' + d.getDate()).slice(-2);
    } catch (e) { return ''; }
  }
  function dur(m) {
    if (!m) return '';
    var h = Math.floor(m / 60), mm = m % 60;
    return (h ? h + 'hr' : '') + (mm ? mm + 'min' : '');
  }
  /* 일정 글자 — 적어 둔 것이 있으면 그것을, 없으면 날짜로 만듭니다 */
  function sched(o) {
    if (o.schedule_text) return o.schedule_text;
    if (o.start_at && o.end_at) return md(o.start_at) + ' - ' + md(o.end_at);
    if (o.start_at) return md(o.start_at) + ' 부터';
    return '';
  }

  /* ── 영상 재생틀 ───────────────────────────────────────────
     ★ <b>공식 임베드만</b> 씁니다. 그것이 유튜브·Vimeo 가 스스로 열어 둔
       길이고, 조회수도 원작자에게 갑니다. 영상을 내려받아 우리 저장통에
       올리는 일은 하지 않습니다.
     ★ 유튜브는 <b>youtube-nocookie</b> 를 씁니다 — 보는 사람 쪽에
       쿠키를 덜 남기는 주소입니다(개인정보처리방침과 결이 맞습니다).
     ★ 「공유 → 퍼가기」가 없는 영상은 여기서 재생되지 않습니다.
       그때 <b>원본으로 가는 길</b>을 함께 두어야 헛걸음이 되지 않습니다.
     ★ loading="lazy" — 화면에 들어올 때 불러옵니다. 목록이 무거워지지
       않게 하려는 것입니다. */
  function embed(provider, id) {
    if (!provider || provider === 'none' || !id) return '';
    var src = '';
    if (provider === 'youtube') {
      src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?rel=0&modestbranding=1';
    } else if (provider === 'vimeo') {
      src = 'https://player.vimeo.com/video/' + encodeURIComponent(id);
    } else return '';
    return '<div class="ln-embed"><iframe src="' + esc(src) + '"'
      + ' title="강의 영상" loading="lazy" allowfullscreen'
      + ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"'
      + ' referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  }
  /* 유튜브 표지 — 표지 사진을 안 올렸을 때 씁니다 (값 0원) */
  function thumbOf(o) {
    if (o.cover_url) return o.cover_url;
    if (o.video_provider === 'youtube' && o.video_id)
      return 'https://i.ytimg.com/vi/' + encodeURIComponent(o.video_id) + '/hqdefault.jpg';
    return '';
  }

  /* 「지금 보는 탭」 표시 — 서브메뉴는 include.js 가 나중에 넣습니다 */
  function markTabs() {
    var n = 0;
    (function tick() {
      var nav = document.querySelector('.ln-tabs');
      if (!nav) { if (++n > 40) return; return setTimeout(tick, 50); }
      var here = location.pathname;
      [].forEach.call(nav.querySelectorAll('a[href]'), function (a) {
        if ((a.getAttribute('href') || '') === here) a.classList.add('active');
      });
    })();
  }
  if (document.readyState !== 'loading') markTabs();
  else document.addEventListener('DOMContentLoaded', markTabs);

  /* ══ ① 목록 ══════════════════════════════════════════════════ */
  function list(opt) {
    opt = opt || {};
    var cfg = TABS[opt.tab] || TABS.master;
    var box = $(opt.box || 'lnList');
    if (!box) return;
    var pagerBox = $(opt.pagerBox || 'lnPager');
    var fieldSel = $(opt.fieldSel || 'lnField');
    var size = opt.pageSize || 8;
    var page = 1, field = '';

    /* 머리글 — 탭 설정에서 가져옵니다 (화면에 적지 않습니다) */
    var eb = $('lnEyebrow'), h1 = $('lnH1'), lead = $('lnLead');
    if (eb) eb.textContent = cfg.en;
    if (h1) h1.textContent = cfg.label;
    if (lead) lead.textContent = cfg.lead;
    try { document.title = cfg.label + ' · 레슨 : ON · OPUSCLAM.COM'; } catch (e) {}

    if (fieldSel) {
      var h = '<option value="">분류선택</option>';
      FIELDS.forEach(function (f) { h += '<option value="' + esc(f) + '">' + esc(f) + '</option>'; });
      fieldSel.innerHTML = h;
      fieldSel.addEventListener('change', function () { field = this.value || ''; page = 1; draw(); });
    }

    /* 카드 한 장
       ★ 그룹레슨은 시안대로 <b>아래 칸</b>이 붙습니다 —
         주제 · 참여인원 3/6 · 일정 · 신청 단추. */
    function card(o) {
      var isGroup = (o.kind === 'group');
      var full = (o.capacity && o.applied >= o.capacity);
      var closed = (o.status === 'closed') || full;

      var badges = '';
      if (o.status === 'ongoing') badges += '<span class="ln-badge">진행중</span>';
      else if (o.status === 'open') badges += '<span class="ln-badge">모집중</span>';
      if (closed) badges += '<span class="ln-badge done">마감</span>';
      /* ★ 큐레이션은 <b>표시해 둡니다</b> — 회원이 「오퍼스클램이 만든 것」과
         「골라 모은 것」을 구별할 수 있어야 합니다. 이것을 감추면
         나중에 신뢰를 잃습니다. */
      if (o.source === 'curated') badges += '<span class="ln-badge cur">큐레이션</span>';

      var body =
          '<a class="ln-card-a" href="/lesson/lesson-view.html?id=' + encodeURIComponent(o.id) + '">'
        +   '<div class="ln-card-ph">'
        +     (badges ? '<span class="ln-badges">' + badges + '</span>' : '')
        +     (thumbOf(o) ? '<img src="' + esc(thumbOf(o)) + '" alt="">' : '')
        +   '</div>'
        +   '<div class="ln-card-body">'
        +     '<div class="ln-card-cat">' + esc(o.field || cfg.en) + '</div>'
        +     '<div class="ln-card-t">' + esc(o.title || '-') + '</div>'
        +     '<div class="ln-card-d">' + esc(o.summary || '') + '</div>'
        +     '<span class="ln-pill">CLASS INFORMATION &#8594;</span>'
        +   '</div>'
        + '</a>';

      if (!isGroup) return '<article class="ln-card">' + body + '</article>';

      return '<article class="ln-card">' + body
        + '<div class="ln-card-foot">'
        +   (o.topic ? '<div class="ln-gk">그룹레슨주제 : <b>' + esc(o.topic) + '</b></div>' : '')
        +   '<dl class="ln-gd">'
        +     '<dt>참여인원</dt><dd>' + nf(o.applied) + ' / <b>' + nf(o.capacity || 0) + '</b></dd>'
        +     (sched(o) ? '<dt>일정</dt><dd>' + esc(sched(o)) + '</dd>' : '')
        +   '</dl>'
        +   (closed
              ? '<span class="ln-gbtn off">그룹레슨신청 마감</span>'
              : '<a class="ln-gbtn" href="/lesson/lesson-view.html?id='
                + encodeURIComponent(o.id) + '#apply">그룹레슨신청</a>')
        + '</div>'
        + '</article>';
    }

    function pager(total) {
      if (!pagerBox) return;
      var last = Math.max(1, Math.ceil(total / size));
      if (last <= 1) { pagerBox.innerHTML = ''; return; }
      var h = '<button type="button" data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>&#8249;</button>';
      var from = Math.max(1, page - 2), to = Math.min(last, from + 4);
      from = Math.max(1, to - 4);
      for (var i = from; i <= to; i++) {
        h += '<button type="button" data-p="' + i + '"' + (i === page ? ' class="on"' : '') + '>' + i + '</button>';
      }
      h += '<button type="button" data-p="' + (page + 1) + '"' + (page >= last ? ' disabled' : '') + '>&#8250;</button>';
      pagerBox.innerHTML = h;
      pagerBox.querySelectorAll('button[data-p]').forEach(function (b) {
        b.addEventListener('click', function () {
          var p = parseInt(b.getAttribute('data-p'), 10);
          if (!p || p === page) return;
          page = p; draw();
          try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
        });
      });
    }

    function draw() {
      box.innerHTML = '<div class="ln-msg">불러오는 중…</div>';
      waitSb(function (c) {
        if (!c) { box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.</div>'; return; }
        var q = c.from('lessons_public').select('*', { count: 'exact' })
          .order('sort_order', { ascending: false })
          .order('created_at', { ascending: false })
          .range((page - 1) * size, page * size - 1);

        /* 탭 설정의 조건을 그대로 붙입니다 */
        Object.keys(cfg.where).forEach(function (k) { q = q.eq(k, cfg.where[k]); });
        if (field) q = q.eq('field', field);

        q.then(function (r) {
          if (r.error) throw new Error(r.error.message);
          var rows = r.data || [];
          if (!rows.length) {
            box.innerHTML = '<div class="ln-none">'
              + (field ? '<b>' + esc(field) + '</b> 분야에 ' : '')
              + '<b>등록된 강의가 아직 없습니다.</b><br>'
              + '가르치실 분을 모으고 있습니다.'
              + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor-apply.html">'
              + '인스트럭터 신청 &#8594;</a></div>';
            if (pagerBox) pagerBox.innerHTML = '';
            return;
          }
          box.innerHTML = rows.map(card).join('');
          pager(r.count || rows.length);
        }).catch(function (e) {
          box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.<br>'
            + '<span style="font-size:11.5px;color:var(--ln-tx3)">' + esc(String(e.message || e)) + '</span></div>';
        });
      });
    }
    draw();
  }

  /* ══ ② 강의정보 ══════════════════════════════════════════════ */
  function view(opt) {
    opt = opt || {};
    var box = $(opt.box || 'lnView');
    if (!box) return;
    var id = '';
    try { id = new URLSearchParams(location.search).get('id') || ''; } catch (e) {}
    if (!id) {
      box.innerHTML = '<div class="ln-none">주소에 어느 강의인지가 없습니다.'
        + '<a class="ln-vd" style="margin-top:16px" href="/lesson/master.html">강의 목록 &#8594;</a></div>';
      return;
    }

    waitSb(function (c) {
      if (!c) { box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.</div>'; return; }
      Promise.all([
        c.from('lessons_public').select('*').eq('id', id).maybeSingle(),
        c.from('lesson_curriculum').select('*').eq('lesson_id', id).order('no', { ascending: true }),
        c.auth.getSession()
      ]).then(function (rs) {
        var o = rs[0].data;
        var cur = (rs[1].data) || [];
        var me = rs[2].data && rs[2].data.session && rs[2].data.session.user;
        if (!o) {
          box.innerHTML = '<div class="ln-none">찾을 수 없습니다.<br>'
            + '준비 중이거나 공개하지 않은 강의일 수 있습니다.'
            + '<a class="ln-vd" style="margin-top:16px" href="/lesson/master.html">강의 목록 &#8594;</a></div>';
          return;
        }
        try { document.title = (o.title || '강의') + ' · 레슨 : ON · OPUSCLAM.COM'; } catch (e) {}

        var live = (o.kind === 'one' || o.kind === 'group');
        var full = (o.capacity && o.applied >= o.capacity);
        var canApply = live && (o.status === 'open' || o.status === 'ongoing') && !full
                       && (!o.apply_to || new Date(o.apply_to) > new Date());

        /* 머리 — 시안: INSTRUCTOR 이름 / 제목 / 소개 */
        var head =
            '<div class="ln-detail-head">'
          +   '<div class="ln-detail-role">INSTRUCTOR<b>' + esc(o.instructor_name || '-') + '</b></div>'
          +   '<h2 class="ln-detail-t">' + esc(o.title || '-')
          +     (o.subtitle ? ', ' + esc(o.subtitle) : '') + '</h2>'
          +   (o.summary ? '<div class="ln-detail-d">' + esc(o.summary) + '</div>' : '')
          + '</div>';

        /* About this Class — 왼쪽 영상 자리 / 오른쪽 맛보기 바 + plan */
        /* ★ 큐레이션이면 <b>출처를 또렷하게</b> 보여 줍니다.
           작게 숨기면 「우리가 만든 것」처럼 보입니다. 그러면 안 됩니다. */
        var creditBar = (o.source === 'curated')
          ? '<div class="ln-credit">'
            + '<span class="k">큐레이션</span>'
            + '<span class="v">이 영상은 <b>' + esc(o.credit || '원작자')
            + '</b> 가 공개한 것입니다. 오퍼스클램은 <b>골라서 소개</b>합니다.'
            + (o.credit_url
                ? ' <a href="' + esc(o.credit_url) + '" target="_blank" rel="noopener">원본 보기 &#8599;</a>'
                : '')
            + '</span></div>'
          : '';

        var sampleBar =
            '<div class="ln-sample">'
          +   '<span class="k">&#9656; CLASS SAMPLE</span>'
          +   '<span class="v">Instructor : ' + esc(o.instructor_name || '-')
          +     (o.duration_min ? '<i>강의길이: ' + esc(dur(o.duration_min)) + '</i>' : '') + '</span>'
          + '</div>';

        var planTitle = (o.tab === 'master') ? 'MasterClass plan' : 'Lesson plan';
        var plan = cur.length
          ? '<ul class="ln-plan">' + cur.map(function (x) {
              return '<li><span class="no">CLASS ' + ('0' + (x.no || 1)).slice(-2) + '</span>'
                + '<span class="t">' + esc(x.title || '') + '</span>'
                + '<span class="go">VIEW DETAIL &#8594;</span></li>';
            }).join('') + '</ul>'
          : '<div class="ln-none" style="margin-top:0">회차가 아직 등록되지 않았습니다.</div>';

        /* 실시간 레슨 안내 — 정원·일정·신청 */
        var liveBox = '';
        if (live) {
          liveBox =
              '<div class="ln-apply" id="apply">'
            +   '<h3 class="ln-h2">' + (o.kind === 'group' ? '그룹레슨 신청' : '1:1 레슨 신청') + '</h3>'
            +   '<ul class="ln-list">'
            +     (o.topic ? '<li><span class="k">주제</span><span class="v">' + esc(o.topic) + '</span></li>' : '')
            +     (o.kind === 'group'
                    ? '<li><span class="k">참여인원</span><span class="v">' + nf(o.applied)
                      + ' / <b>' + nf(o.capacity || 0) + '</b></span></li>' : '')
            +     (sched(o) ? '<li><span class="k">일정</span><span class="v">' + esc(sched(o)) + '</span></li>' : '')
            +     (o.apply_to ? '<li><span class="k">신청 마감</span><span class="v">'
                      + esc(md(o.apply_to)) + '</span></li>' : '')
            +     '<li><span class="k">상태</span><span class="v">'
            +       esc(STATUS_LABEL[o.status] || o.status) + (full ? ' · 정원 찼습니다' : '') + '</span></li>'
            +   '</ul>'
            +   '<div id="lnApplyBox"></div>'
            + '</div>';
        }

        box.innerHTML = head
          + '<section class="ln-sec">' + creditBar + '<h3 class="ln-h2">About this Class</h3>'
          + '<div class="ln-about">'
          +   (embed(o.video_provider, o.video_id)
                /* 영상이 있으면 <b>그대로 재생</b>합니다 */
                ? embed(o.video_provider, o.video_id)
                /* 없으면 자리만 두고 준비 중이라고 알립니다 */
                : '<div class="ln-video">'
                  + (thumbOf(o) ? '<img src="' + esc(thumbOf(o)) + '" alt="">' : '')
                  + '<span class="ln-play" aria-hidden="true">&#9658;</span>'
                  + '<span class="ln-video-note">'
                  + (live ? '실시간 레슨입니다' : '영상은 준비 중입니다') + '</span>'
                  + '</div>')
          +   '<div class="ln-panel">' + sampleBar
          +     '<h3 class="ln-h2" style="margin-top:26px">' + planTitle + '</h3>' + plan
          +   '</div>'
          + '</div>'
          + liveBox
          + '</section>';

        if (live) drawApply(o, me);
        drawOthers(o);
      }).catch(function (e) {
        box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.<br>'
          + '<span style="font-size:11.5px;color:var(--ln-tx3)">' + esc(String(e.message || e)) + '</span></div>';
      });
    });

    /* ── 신청 칸 ─────────────────────────────────────────────
       ★ 상태 네 가지를 <b>구별해서</b> 알려 줍니다 —
         로그인 안 함 / 이미 신청함 / 신청할 수 있음 / 신청할 수 없음
         「안 됩니다」 만 뜨면 무엇을 해야 할지 알 수 없습니다. */
    function drawApply(o, me) {
      var box2 = $('lnApplyBox');
      if (!box2) return;
      var c = sb();
      var full = (o.capacity && o.applied >= o.capacity);
      var openNow = (o.status === 'open' || o.status === 'ongoing')
                    && (!o.apply_to || new Date(o.apply_to) > new Date());

      if (!me) {
        box2.innerHTML = '<div class="ln-say wait">신청은 <b>로그인</b> 뒤에 하실 수 있습니다.</div>'
          + '<a class="ln-btn go" style="margin-top:14px" href="/account/login.html">로그인 &#8594;</a>';
        return;
      }

      c.from('lesson_applications').select('id,status,created_at')
        .eq('lesson_id', o.id).eq('member_id', me.id).maybeSingle()
        .then(function (r) {
          var a = r.data;
          if (a && a.status !== 'canceled') {
            var msg = {
              pending:  '<b>신청하셨습니다.</b> 인스트럭터가 확인하면 알려 드립니다.',
              approved: '<b>승인되었습니다.</b> 아래에서 참여 링크를 받으실 수 있습니다.',
              rejected: '이번에는 <b>어렵다는 답</b>을 받았습니다.'
            }[a.status] || '신청 상태: ' + esc(a.status);
            box2.innerHTML = '<div class="ln-say ' + (a.status === 'approved' ? 'ok' : 'wait') + '">' + msg + '</div>'
              + (a.status === 'approved'
                  ? '<button type="button" class="ln-btn go" id="lnLive" style="margin-top:14px">참여 링크 받기</button>'
                  : '')
              + (a.status === 'pending'
                  ? '<button type="button" class="ln-btn" id="lnCancel" style="margin-top:14px">신청 취소</button>'
                  : '');

            var lb = $('lnLive');
            if (lb) lb.addEventListener('click', function () {
              lb.disabled = true; lb.textContent = '받는 중…';
              c.rpc('oc_lesson_live_url', { p_lesson: o.id }).then(function (rr) {
                var url = (rr && !rr.error) ? rr.data : null;
                if (!url) {
                  box2.insertAdjacentHTML('beforeend',
                    '<div class="ln-say no">참여 링크가 아직 등록되지 않았습니다. 인스트럭터에게 문의해 주십시오.</div>');
                  lb.disabled = false; lb.textContent = '참여 링크 받기';
                  return;
                }
                lb.outerHTML = '<a class="ln-btn go" href="' + esc(url) + '" target="_blank" rel="noopener"'
                  + ' style="margin-top:14px">참여하기 &#8599;</a>';
              });
            });

            var cb = $('lnCancel');
            if (cb) cb.addEventListener('click', function () {
              if (!confirm('신청을 취소하시겠습니까?')) return;
              cb.disabled = true; cb.textContent = '취소하는 중…';
              c.from('lesson_applications').update({ status: 'canceled' }).eq('id', a.id).select('id')
                .then(function (ur) {
                  if (ur.error || !ur.data || !ur.data.length) {
                    box2.insertAdjacentHTML('beforeend',
                      '<div class="ln-say no">취소되지 않았습니다. 고객센터로 알려 주십시오.</div>');
                    cb.disabled = false; cb.textContent = '신청 취소';
                    return;
                  }
                  location.reload();
                });
            });
            return;
          }

          if (!openNow || full) {
            box2.innerHTML = '<div class="ln-say wait">'
              + (full ? '<b>정원이 찼습니다.</b> 다음 기수를 기다려 주십시오.'
                      : '<b>지금은 신청을 받지 않습니다.</b>')
              + '</div>';
            return;
          }

          box2.innerHTML =
              '<div class="ln-fld" style="margin-top:16px">'
            +   '<label for="lnMsg">남기실 말</label>'
            +   '<div class="ln-fld-b">'
            +     '<textarea id="lnMsg" maxlength="500" style="min-height:96px"'
            +       ' placeholder="배우고 싶은 것, 지금 수준, 가능한 시간을 적어 주시면 좋습니다."></textarea>'
            +     '<div class="ln-hint">인스트럭터에게 <b>그대로 전달</b>됩니다.</div>'
            +   '</div>'
            + '</div>'
            + '<button type="button" class="ln-btn go" id="lnApply">'
            +   (o.kind === 'group' ? '그룹레슨 신청' : '1:1 레슨 신청') + '</button>';

          $('lnApply').addEventListener('click', function () {
            var btn = this, old = btn.textContent;
            btn.disabled = true; btn.textContent = '보내는 중…';
            c.from('lesson_applications').insert({
              lesson_id: o.id,
              member_id: me.id,
              message: ($('lnMsg').value || '').trim() || null
            }).select('id').then(function (ir) {
              /* ★ 몇 줄이 들어갔는지 <b>받아서 확인</b>합니다 —
                 줄 보안에 막히면 오류 없이 0줄이 됩니다. */
              if (ir.error) throw new Error(ir.error.message);
              if (!ir.data || !ir.data.length) {
                box2.innerHTML = '<div class="ln-say no">신청되지 않았습니다. 한 줄도 저장되지 않았습니다 — '
                  + '회원 승인 상태나 모집 기간을 확인해 주십시오.</div>';
                return;
              }
              box2.innerHTML = '<div class="ln-say ok"><b>신청했습니다.</b> '
                + '인스트럭터가 확인하면 알려 드립니다. 진행 상태는 마이페이지에서 보실 수 있습니다.</div>'
                + '<a class="ln-btn" style="margin-top:14px" href="/account/mypage.html">마이페이지 &#8594;</a>';
            }).catch(function (e) {
              box2.innerHTML = '<div class="ln-say no">신청하지 못했습니다: '
                + esc(String(e.message || e).slice(0, 120)) + '</div>';
              btn.disabled = false; btn.textContent = old;
            });
          });
        });
    }

    /* ── Other Classes ───────────────────────────────────────
       같은 탭의 다른 강의 넷. 지금 보는 것은 뺍니다. */
    function drawOthers(o) {
      var box3 = $('lnOthers');
      if (!box3) return;
      var c = sb();
      c.from('lessons_public').select('*')
        .eq('tab', o.tab).neq('id', o.id)
        .order('created_at', { ascending: false }).limit(4)
        .then(function (r) {
          var rows = (r.data) || [];
          if (!rows.length) { box3.closest('.ln-sec').style.display = 'none'; return; }
          box3.innerHTML = rows.map(function (x) {
            return '<article class="ln-card">'
              + '<a class="ln-card-a" href="/lesson/lesson-view.html?id=' + encodeURIComponent(x.id) + '">'
              +   '<div class="ln-card-ph">'
              +     (thumbOf(x) ? '<img src="' + esc(thumbOf(x)) + '" alt="">' : '') + '</div>'
              +   '<div class="ln-card-body">'
              +     '<div class="ln-card-cat">' + esc(x.field || '') + '</div>'
              +     '<div class="ln-card-t">' + esc(x.title || '-') + '</div>'
              +     '<div class="ln-card-d">' + esc(x.summary || '') + '</div>'
              +   '</div></a></article>';
          }).join('');
        });
    }
  }

  /* ══ ③ 대문의 최근 강의 ══════════════════════════════════════
     ★ 탭을 가리지 않고 <b>모두</b>에서 최근 것을 뽑습니다.
       대문은 「무엇이 있는지」 보여 주는 자리이므로 갈래를 나누지 않습니다. */
  function home(opt) {
    opt = opt || {};
    var box = $(opt.box || 'lnHomeList');
    if (!box) return;
    waitSb(function (c) {
      if (!c) { box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.</div>'; return; }
      c.from('lessons_public').select('*')
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(opt.limit || 4)
        .then(function (r) {
          var rows = (r.data) || [];
          if (!rows.length) {
            box.innerHTML = '<div class="ln-none" style="grid-column:1/-1">'
              + '<b>강의는 준비 중입니다.</b><br>'
              + '마스터클래스 · 공개레슨 · 1:1레슨 · 그룹레슨이 차례로 열립니다.<br>'
              + '먼저 가르치실 분을 모으고 있습니다 —'
              + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor-apply.html">'
              + '인스트럭터 신청 &#8594;</a></div>';
            return;
          }
          box.innerHTML = rows.map(function (o) {
            return '<article class="ln-card">'
              + '<a class="ln-card-a" href="/lesson/lesson-view.html?id=' + encodeURIComponent(o.id) + '">'
              +   '<div class="ln-card-ph">'
              +     (o.source === 'curated' ? '<span class="ln-badges"><span class="ln-badge cur">큐레이션</span></span>' : '')
              +     (thumbOf(o) ? '<img src="' + esc(thumbOf(o)) + '" alt="">' : '') + '</div>'
              +   '<div class="ln-card-body">'
              +     '<div class="ln-card-cat">' + esc(o.field || '') + '</div>'
              +     '<div class="ln-card-t">' + esc(o.title || '-') + '</div>'
              +     '<div class="ln-card-d">' + esc(o.summary || '') + '</div>'
              +     '<span class="ln-pill">CLASS INFORMATION &#8594;</span>'
              +   '</div></a></article>';
          }).join('');
        });
    });
  }

  window.OCLesson = { list: list, view: view, home: home, TABS: TABS, FIELDS: FIELDS };
})();
