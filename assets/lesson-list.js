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
      where: { tab: 'master' },
      /* ★ 이 탭만 <b>추천 한 편</b>을 크게 보여 줍니다 (2026-08-06)
         목록만 늘어놓으면 어디서 시작할지 막막합니다. 눈에 들어오는
         하나가 있으면 바로 눌러 보게 됩니다.
         ▶ 다른 탭에도 켜려면 그 탭에 featured: true 를 더하십시오. */
      featured: true
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

  /* ── 분야 (여덟 갈래) ──────────────────────────────────────────
     ★ 이 목록은 <b>네 파일이 함께</b> 씁니다 — 하나만 고치면 어긋납니다.
         assets/lesson-curate.js      큐레이션 등록
         assets/lesson-instructor.js  인스트럭터 신청 · 목록 분류
         assets/lesson-list.js        강의 목록 분류
         assets/lesson-write.js       강의 등록
     ★ 2026-08-06 — PIANO · VOCAL 을 더했습니다.
       마스터클래스 영상은 <b>피아노가 가장 많고</b>, 성악도 적지 않은데
       처음 목록(시안)은 오케스트라 악기만 담고 있어 둘 다 「기타」로
       들어갔습니다. 그러면 회원이 분야로 찾을 수 없고, 피아노·성악
       전공 강사가 <b>자기 분야를 고를 수 없습니다</b>.
     ★ 값을 바꿀 때는 표의 CHECK 제약도 함께 봐야 합니다
       (sql/lesson-fields-01.sql 참고). */
  var FIELDS = ['PIANO', 'STRINGS', 'BRASS', 'WINDS', 'PERCUSSIONS', 'VOCAL', '작곡/이론', '기타'];

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
  function srcOf(provider, id, autoplay) {
    if (!provider || provider === 'none' || !id) return '';
    if (provider === 'youtube') {
      return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id)
           + '?rel=0&modestbranding=1&playsinline=1' + (autoplay ? '&autoplay=1' : '');
    }
    if (provider === 'vimeo') {
      return 'https://player.vimeo.com/video/' + encodeURIComponent(id)
           + (autoplay ? '?autoplay=1' : '');
    }
    return '';
  }
  function embed(provider, id) {
    var src = srcOf(provider, id, false);
    if (!src) return '';
    return '<div class="ln-embed"><iframe src="' + esc(src) + '"'
      + ' title="강의 영상" loading="lazy" allowfullscreen'
      + ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"'
      + ' referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  }

  /* ── 크게 보기 (라이트박스) ─────────────────────────────────
     ★ 왜 이렇게 하나 — 마스터클래스는 <b>30분이 넘습니다</b>.
       글 사이에 낀 작은 창으로는 끝까지 보지 않습니다. 눌렀을 때
       화면을 가득 덮어 주면 그때부터 「본다」가 됩니다.
     ★ 처음에는 <b>표지만</b> 둡니다 — 유튜브 틀을 미리 부르지 않으니
       페이지가 가볍고, 재생을 누른 사람에게만 불러옵니다.
     ★ 짜임은 <b>여기서 만들어 넣습니다</b>(styleOnce) — lesson.css 는
       레슨:ON 전체가 함께 쓰는 파일이라, 화면 하나 때문에 공용 파일에
       손대면 다른 화면이 조용히 망가질 수 있습니다(전에 겪었습니다).
     ★ 닫을 때 <b>틀을 지웁니다</b> — 남겨 두면 소리가 계속 납니다. */
  function styleOnce() {
    if (window.__ocLbCss) return;
    window.__ocLbCss = true;
    var css = ''
      + '.oc-lbtn{display:block;width:100%;padding:0;border:0;background:none;'
      +   'font:inherit;color:inherit;cursor:pointer;text-align:left;}'
      /* ★ .ln-video 는 「영상 준비 중」 자리표시로 만들어진 짜임이라
         표지를 흐리게(opacity .5) 깔고 비율이 16/10 입니다. 여기서는
         <b>실제로 볼 영상의 표지</b>이므로 더 선명하게, 영상과 같은
         16/9 로 맞춥니다. ※ .oc-lbtn 안쪽만 바꿉니다 — .ln-video 자체를
         건드리면 「준비 중」 자리들이 함께 달라집니다. */
      + '.oc-lbtn .ln-video{aspect-ratio:16/9;}'
      + '.oc-lbtn .ln-video img{opacity:.74;transition:opacity .18s ease, transform .3s ease;}'
      + '.oc-lbtn:hover .ln-video img{opacity:.9;transform:scale(1.02);}'
      + '.oc-lbtn .ln-play{transition:transform .18s ease, opacity .18s ease;'
      +   'background:rgba(0,0,0,.35);}'
      + '.oc-lbtn:hover .ln-play{transform:scale(1.12);background:rgba(0,0,0,.5);}'
      + '.oc-lbtn .ln-video-note{font-size:12px;letter-spacing:.02em;}'
      + '.oc-lbtn:focus-visible{outline:2px solid #a24ea7;outline-offset:3px;border-radius:10px;}'

      + '.oc-lb{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;'
      +   'justify-content:center;padding:22px;background:rgba(6,6,10,.94);'
      +   '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'
      +   'opacity:0;transition:opacity .2s ease;}'
      + '.oc-lb.on{opacity:1;}'
      + '.oc-lb-in{width:min(1400px,94vw);'
      +   'max-width:calc((100vh - 160px) * 1.7778);'
      +   'transform:scale(.96);transition:transform .22s ease;}'
      + '@supports (height:100dvh){.oc-lb-in{max-width:calc((100dvh - 160px) * 1.7778);}}'
      + '.oc-lb.on .oc-lb-in{transform:scale(1);}'
      + '.oc-lb-frame{width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;'
      +   'overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6);}'
      + '.oc-lb-frame iframe{width:100%;height:100%;border:0;display:block;}'
      + '.oc-lb-cap{margin-top:14px;color:#d6d2e2;font-size:14px;line-height:1.6;}'
      + '.oc-lb-cap b{color:#fff;font-weight:600;}'
      + '.oc-lb-cap a{color:#c4a9e6;}'
      + '.oc-lb-x{position:absolute;top:16px;right:18px;width:44px;height:44px;'
      +   'border:0;border-radius:50%;background:rgba(255,255,255,.10);color:#fff;'
      +   'font-size:20px;line-height:1;cursor:pointer;}'
      + '.oc-lb-x:hover{background:rgba(255,255,255,.20);}'
      + '@media (max-width:760px){.oc-lb{padding:12px;}'
      +   '.oc-lb-in{width:100%;max-width:none;}.oc-lb-x{top:8px;right:10px;}}'

      /* 큐레이션 강의의 「About this Video」 칸 */
      + '.oc-cv dl{display:grid;grid-template-columns:auto 1fr;gap:10px 18px;margin:0;}'
      + '.oc-cv dt{color:var(--ln-tx3,#8a86a0);font-size:12.5px;letter-spacing:.04em;'
      +   'text-transform:uppercase;white-space:nowrap;}'
      + '.oc-cv dd{margin:0;font-size:14px;line-height:1.6;}'
      + '.oc-cv dd b{font-weight:600;}'
      + '.oc-cv dd a{color:#b79ad6;text-decoration:underline;font-size:13px;margin-left:4px;}'
      + '.oc-cv-note{margin:20px 0 0;padding-top:18px;'
      +   'border-top:1px solid var(--ln-line,rgba(255,255,255,.12));'
      +   'font-size:13px;line-height:1.85;color:var(--ln-tx3,#8a86a0);}'
      + '.oc-cv-note b{color:var(--ln-tx2,#c9c6d6);font-weight:600;}'

      /* ── 추천 한 편 (목록 맨 위) ─────────────────────────────
         넓은 화면에서는 왼쪽 표지 · 오른쪽 글, 좁은 화면에서는 위아래.
         ▶ 표지 크기를 바꾸려면 grid-template-columns 의 첫 값(1.35fr)을
           키우거나 줄이십시오. */
      + '.oc-ft-wrap{margin:30px 0 44px;}'
      /* ★ 비었을 때는 <b>여백까지</b> 없앱니다 — 2페이지로 넘어가거나
         분야를 고르면 추천이 사라지는데, 여백만 남으면 목록이 이유
         없이 아래로 밀려 어색합니다. */
      + '.oc-ft-wrap:empty{margin:0;}'
      + '.oc-ft{display:grid;grid-template-columns:1.35fr 1fr;gap:32px;align-items:center;'
      +   'padding:26px;border-radius:14px;'
      +   'background:linear-gradient(120deg,rgba(162,78,167,.10),rgba(70,79,142,.10) 70%,transparent);'
      +   'border:1px solid var(--ln-line,rgba(255,255,255,.12));}'
      + '.oc-ft-ph{min-width:0;}'
      /* 추천의 재생 단추는 목록 카드보다 <b>크게</b> — 눈에 먼저 들어와야 합니다 */
      + '.oc-ft-ph .ln-play{width:78px;height:78px;font-size:26px;}'
      + '.oc-ft-ph .ln-video{border-radius:10px;}'
      + '.oc-ft-tx{min-width:0;}'
      + '.oc-ft-lb{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;'
      +   'letter-spacing:.2em;color:#c9a4e8;}'
      + '.oc-ft-lb .cu{padding:2px 8px;border-radius:3px;letter-spacing:.02em;font-size:10px;'
      +   'background:rgba(120,170,230,.18);color:#a8cdf0;}'
      + '.oc-ft-t{margin:12px 0 0;font-family:var(--display,inherit);font-weight:300;'
      +   'font-size:clamp(21px,2.1vw,30px);line-height:1.32;color:var(--ln-tx,#f2eff8);}'
      + '.oc-ft-by{margin-top:10px;font-size:11.5px;letter-spacing:.1em;'
      +   'color:var(--ln-tx3,#8a86a0);}'
      + '.oc-ft-by b{color:var(--ln-tx2,#c9c6d6);letter-spacing:0;font-weight:600;}'
      + '.oc-ft-d{margin:12px 0 0;font-size:13.5px;line-height:1.8;color:var(--ln-tx2,#c9c6d6);'
      +   'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}'
      + '.oc-ft-act{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:22px;}'
      + '.oc-ft-go{height:44px;padding:0 24px;border:0;border-radius:5px;cursor:pointer;'
      +   'font:inherit;font-size:13.5px;font-weight:700;color:#fff;'
      +   'background:linear-gradient(90deg,#a24ea7,#7c4f9d);}'
      + '.oc-ft-go:hover{filter:brightness(1.12);}'
      + '.oc-ft-more{font-size:12.5px;color:#b79ad6;text-decoration:none;}'
      + '.oc-ft-more:hover{text-decoration:underline;}'
      + '@media (max-width:860px){'
      +   '.oc-ft{grid-template-columns:1fr;gap:20px;padding:18px;}'
      +   '.oc-ft-wrap{margin:22px 0 32px;}'
      +   '.oc-ft-ph .ln-play{width:62px;height:62px;font-size:21px;}}';
    var s = document.createElement('style');
    s.setAttribute('data-oc', 'lightbox');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* 표지 + 재생 버튼 — 누르면 라이트박스가 열립니다 */
  function poster(o) {
    if (!srcOf(o.video_provider, o.video_id, false)) return '';
    var t = thumbOf(o);
    return '<button type="button" class="oc-lbtn" data-lb="1"'
      +   ' data-p="' + esc(o.video_provider) + '" data-i="' + esc(o.video_id) + '"'
      +   ' data-t="' + esc(o.title || '') + '"'
      +   ' data-c="' + esc(o.source === 'curated' ? (o.credit || '') : (o.instructor_name || '')) + '"'
      +   ' data-u="' + esc(o.credit_url || '') + '"'
      +   ' aria-label="영상을 크게 보기">'
      +   '<span class="ln-video">'
      +     (t ? '<img src="' + esc(t) + '" alt="">' : '')
      +     '<span class="ln-play" aria-hidden="true">&#9658;</span>'
      +     '<span class="ln-video-note">눌러서 크게 보기</span>'
      +   '</span>'
      + '</button>';
  }

  function openLb(d) {
    styleOnce();
    var src = srcOf(d.p, d.i, true);
    if (!src) return;

    var lb = document.createElement('div');
    lb.className = 'oc-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
        '<button type="button" class="oc-lb-x" aria-label="닫기">&#10005;</button>'
      + '<div class="oc-lb-in">'
      +   '<div class="oc-lb-frame"><iframe src="' + esc(src) + '" title="' + esc(d.t || '강의 영상') + '"'
      +     ' allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"'
      +     ' referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'
      +   '<div class="oc-lb-cap"><b>' + esc(d.t || '') + '</b>'
      +     (d.c ? ' · ' + esc(d.c) : '')
      +     (d.u ? ' · <a href="' + esc(d.u) + '" target="_blank" rel="noopener">원본 보기 &#8599;</a>' : '')
      +   '</div>'
      + '</div>';

    /* 뒤 화면이 따라 움직이지 않게 잠급니다 — 자리는 기억해 둡니다 */
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var prevOv = document.body.style.overflow;
    document.body.appendChild(lb);
    document.body.style.overflow = 'hidden';
    /* 한 틱 뒤에 켜야 어울림(transition)이 걸립니다 */
    setTimeout(function () { lb.classList.add('on'); }, 10);

    function close() {
      document.removeEventListener('keydown', onKey);
      lb.classList.remove('on');
      /* ★ 틀을 먼저 지워야 소리가 곧바로 멈춥니다 */
      var f = lb.querySelector('iframe'); if (f) f.setAttribute('src', '');
      setTimeout(function () {
        if (lb.parentNode) lb.parentNode.removeChild(lb);
        document.body.style.overflow = prevOv || '';
        window.scrollTo(0, y);
      }, 200);
    }
    function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) close(); }

    lb.querySelector('.oc-lb-x').addEventListener('click', close);
    lb.addEventListener('click', function (e) {
      /* 바탕을 누르면 닫습니다 — 안쪽(영상·설명)은 그대로 둡니다 */
      if (!e.target.closest('.oc-lb-in')) close();
    });
    document.addEventListener('keydown', onKey);
    setTimeout(function () { lb.querySelector('.oc-lb-x').focus(); }, 240);
  }

  /* 표지 단추에 손잡이 걸기 — 렌더가 끝난 뒤에 한 번 부릅니다 */
  function bindLb(root) {
    if (!root) return;
    /* ★ 짜임을 <b>여기서</b> 넣습니다 — openLb(누른 뒤)에서만 넣으면
       첫 클릭 전까지 표지 효과와 「About this Video」 칸 모양이
       들어가지 않습니다. 그리기가 끝난 이 자리가 맞습니다. */
    styleOnce();
    Array.prototype.forEach.call(root.querySelectorAll('[data-lb="1"]'), function (b) {
      if (b.__lb) return; b.__lb = true;
      b.addEventListener('click', function () {
        openLb({
          p: b.getAttribute('data-p'), i: b.getAttribute('data-i'),
          t: b.getAttribute('data-t'), c: b.getAttribute('data-c'),
          u: b.getAttribute('data-u')
        });
      });
    });
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
    /* ★ 한 화면에 몇 개를 보일지 — <b>스무 개</b>가 기본입니다.
       카드가 넓은 화면에서 네 줄로 놓이므로 20 이면 다섯 칸이 꽉 찹니다.
       ※ 목록 다섯 화면(master · open · live · one · group)이 각자
         pageSize 를 넘깁니다 — <b>바꿀 때는 여섯 곳을 함께</b> 고쳐야
         탭마다 개수가 달라지는 일이 없습니다. */
    var size = opt.pageSize || 20;
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

    /* ══ 추천 한 편 ═══════════════════════════════════════════
       ★ 무엇을 추천으로 뽑나 — <b>목록의 첫 자리와 같은 규칙</b>입니다
           sort_order 큰 것 → 그다음 최근 등록
         그래서 파트너가 아무것도 하지 않아도 <b>가장 최근에 올린 것</b>이
         저절로 추천됩니다. 특정 영상을 고정하고 싶으시면 그 강의의
         sort_order 를 1 이상으로 올리십시오(큐레이션 화면·SQL 어느 쪽이든).
       ★ 영상이 있는 것만 추천합니다 — 눌러서 바로 보는 자리이므로
         실시간 레슨이나 영상 없는 강의가 오면 헛클릭이 됩니다.
       ★ <b>분야를 고르거나 2페이지로 넘어가면 감춥니다</b> —
         걸러 보는 중인 사람에게 걸러지지 않은 추천을 계속 들이대면
         방해가 되고, 2페이지에서 같은 것이 또 보이면 지루합니다.
       ★ 재생은 <b>이미 만들어 둔 라이트박스</b>를 그대로 씁니다
         (poster + bindLb) — 같은 것을 두 번 만들지 않습니다. */
    var featBox = null;
    function feature() {
      /* 자리 만들기 — 목록 바로 앞에 둡니다(화면 HTML 은 손대지 않습니다) */
      if (!featBox) {
        if (!cfg.featured || !box.parentNode) return;
        featBox = document.createElement('div');
        featBox.className = 'oc-ft-wrap';
        box.parentNode.insertBefore(featBox, box);
      }
      /* 걸러 보는 중이거나 2페이지면 감춥니다 */
      if (field || page > 1) { featBox.innerHTML = ''; return; }

      waitSb(function (c) {
        if (!c) return;
        var q = c.from('lessons_public').select('*')
          .not('video_id', 'is', null)
          .order('sort_order', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);
        Object.keys(cfg.where).forEach(function (k) { q = q.eq(k, cfg.where[k]); });

        q.then(function (r) {
          var o = (r.data || [])[0];
          if (r.error || !o) { featBox.innerHTML = ''; return; }
          styleOnce();

          var curated = (o.source === 'curated');
          var by = curated ? (o.credit || '') : (o.instructor_name || '');

          featBox.innerHTML =
              '<section class="oc-ft">'
            +   '<div class="oc-ft-ph">' + poster(o) + '</div>'
            +   '<div class="oc-ft-tx">'
            +     '<div class="oc-ft-lb">FEATURED'
            +       (curated ? '<span class="cu">큐레이션</span>' : '') + '</div>'
            +     '<h3 class="oc-ft-t">' + esc(o.title || '-') + '</h3>'
            +     (by ? '<div class="oc-ft-by">' + (curated ? 'SOURCE' : 'INSTRUCTOR')
                      + ' &middot; <b>' + esc(by) + '</b></div>' : '')
            +     (o.summary ? '<p class="oc-ft-d">' + esc(o.summary) + '</p>' : '')
            +     '<div class="oc-ft-act">'
            +       '<button type="button" class="oc-ft-go" data-lb="1"'
            +         ' data-p="' + esc(o.video_provider) + '" data-i="' + esc(o.video_id) + '"'
            +         ' data-t="' + esc(o.title || '') + '"'
            +         ' data-c="' + esc(by) + '"'
            +         ' data-u="' + esc(o.credit_url || '') + '">&#9658; 지금 보기</button>'
            +       '<a class="oc-ft-more" href="/lesson/lesson-view.html?id='
            +         encodeURIComponent(o.id) + '">강의정보 &#8594;</a>'
            +     '</div>'
            +   '</div>'
            + '</section>';

          bindLb(featBox);   /* 표지와 「지금 보기」 둘 다 라이트박스로 */
        });
      });
    }

    function draw() {
      feature();
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

        /* ★ 큐레이션은 <b>강사가 없습니다</b> — 남이 공개한 영상을 골라
           모은 것이므로 instructor_id 가 비어 있습니다. 그 자리에
           「-」를 찍으면 정보가 빠진 것처럼 보이고, 아무 강사 이름을
           끌어다 놓으면 「그 사람이 만든 강의」로 거짓이 됩니다.
           그래서 <b>채널 이름(출처)</b>을 밝히고 머리글도 SOURCE 로
           바꿉니다 — 모아온 것임이 화면에서 정직하게 드러납니다. */
        var curated = (o.source === 'curated');
        var byRole  = curated && !o.instructor_name ? 'SOURCE' : 'INSTRUCTOR';
        var byName  = o.instructor_name || (curated ? (o.credit || '출처 미표기') : '-');

        /* 머리 — 시안: INSTRUCTOR 이름 / 제목 / 소개 */
        var head =
            '<div class="ln-detail-head">'
          +   '<div class="ln-detail-role">' + byRole + '<b>' + esc(byName) + '</b></div>'
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
          +   '<span class="v">' + (byRole === 'SOURCE' ? 'Source' : 'Instructor') + ' : ' + esc(byName)
          +     (o.duration_min ? '<i>강의길이: ' + esc(dur(o.duration_min)) + '</i>' : '') + '</span>'
          + '</div>';

        /* ★ 큐레이션에는 <b>회차라는 것이 없습니다</b> — 우리 강사가 짠
           강의가 아니라, 한 편으로 완결된 공개 영상을 골라 온 것입니다.
           그런데도 「회차가 아직 등록되지 않았습니다」를 띄우면 회원 눈에
           <b>준비가 덜 된 강의</b>처럼 보입니다. 그래서 그 자리에 이 영상에
           실제로 있는 것을 담고, 출처를 한 번 더 밝힙니다.
           ※ 큐레이션인데 회차가 들어 있으면(드물지만) 회차를 보여 줍니다. */
        var curPanel = (o.source === 'curated' && !cur.length);

        var planTitle = curPanel
          ? 'About this Video'
          : ((o.tab === 'master') ? 'MasterClass plan' : 'Lesson plan');

        var plan;
        if (curPanel) {
          var rows = '';
          rows += '<dt>출처</dt><dd><b>' + esc(o.credit || '출처 미표기') + '</b>'
                + (o.credit_url
                    ? ' <a href="' + esc(o.credit_url) + '" target="_blank" rel="noopener">원본 &#8599;</a>'
                    : '') + '</dd>';
          if (o.field)        rows += '<dt>분야</dt><dd>' + esc(o.field) + '</dd>';
          if (o.duration_min) rows += '<dt>재생시간</dt><dd>' + esc(dur(o.duration_min)) + '</dd>';
          rows += '<dt>수강료</dt><dd>무료</dd>';
          rows += '<dt>구성</dt><dd>한 편으로 완결된 마스터클래스</dd>';

          plan = '<div class="oc-cv"><dl>' + rows + '</dl>'
            + '<p class="oc-cv-note">'
            + '오퍼스클램은 이 영상을 <b>골라서 소개</b>합니다. 유튜브가 공식으로 열어 둔 방식으로 '
            + '보여 드리므로 <b>조회수는 원작자에게</b> 갑니다. 좋으셨다면 원본 채널도 찾아가 보십시오.'
            + '</p></div>';
        } else {
          plan = cur.length
            ? '<ul class="ln-plan">' + cur.map(function (x) {
                return '<li><span class="no">CLASS ' + ('0' + (x.no || 1)).slice(-2) + '</span>'
                  + '<span class="t">' + esc(x.title || '') + '</span>'
                  + '<span class="go">VIEW DETAIL &#8594;</span></li>';
              }).join('') + '</ul>'
            : '<div class="ln-none" style="margin-top:0">회차가 아직 등록되지 않았습니다.</div>';
        }

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
          +   (poster(o)
                /* ★ 영상이 있으면 <b>표지와 재생 단추</b>를 둡니다 —
                   누르면 화면을 가득 덮으며 크게 재생됩니다(openLb). */
                ? poster(o)
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

        /* ★ 표지 단추에 손잡이를 겁니다 — innerHTML 로 그린 뒤라야
           요소가 실제로 생겨 있습니다. 이 줄을 빼면 눌러도 아무 일이
           일어나지 않습니다(조용한 고장이라 찾기 어렵습니다). */
        bindLb(box);

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
