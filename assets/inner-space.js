/* ============================================================
   OPUSCLAM  INNER SPACE            assets/inner-space.js
   2026-08-04

   ★ 무엇인가
     시안의 <b>INNER SPACE</b> 입니다. 로그인한 회원이 「이너스페이스」 를
     누르면 <b>화면 위쪽을 덮는 패널</b>이 열립니다.

       회원 카드 (사진 · 등급 · 포인트)
       바로 가기 (회원정보 · 관심분야 · 내가 올린 것 …)
       MY OC Linked (이어진 사람)
       통계 (활동 분포 · 새 글)
       INNER SPACE CLOSE

   ★ <b>마이페이지를 없애지 않습니다.</b>
     패널은 <b>한눈에 보는 요약</b>이고, 자세한 것은 마이페이지로 갑니다.
     패널에 모든 것을 넣으면 그것이 다시 길어져 뜻이 없어집니다.

   ★ 어느 화면에서든 열립니다.
     시안은 메인에서 열리지만, 게시판을 보다가도 열 수 있으면 편합니다.
     이 파일만 실으면 됩니다.

   ★ 자료는 이미 만든 서버 함수를 씁니다 —
       oc_my_points()  등급 · 활동점수 · 쓸포인트
       oc_my_stats()   활동 분포 · 최근 새 글
       oc_my_links()   이어진 사람 · 받은 요청
     그것들이 없으면 그 칸만 비고, 패널은 그대로 열립니다.

   쓰는 법
     <script src="/assets/inner-space.js"></script>
     또는 어디서든  OCInner.open()
   ============================================================ */
(function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  var TYPE = { industry:'음악관계자', org:'단체·기업', school:'음악학교',
               major:'전공자', general:'일반' };
  var COLORS = ['#7a5cc4','#e0a83c','#5b9bd5','#6fcf8f','#e08585',
                '#9b8ec4','#c8a04a','#7fb8a8','#b07fa8','#8a95c4'];

  var opened = false;

  /* ── 이너스페이스를 쓰지 않는 화면 ─────────────────────────────
     ★ <b>마이페이지</b>는 이너스페이스의 「자세한 판」입니다. 같은 것을
       두 곳에 두면 어수선하고, 마이페이지 위에 패널을 얹으면 헤더가
       아래로 밀려 <b>GNB 가 사라집니다.</b> 그래서 아예 만들지 않습니다.
     ★ 규칙을 <b>이 목록 한 곳</b>에만 둡니다. 다른 화면을 빼려면
       여기에 주소를 더하면 됩니다. */
  var SKIP = ['/account/mypage.html'];

  /* ── 패널이 <b>자리를 대신할</b> 메인 구역 ─────────────────────
     ★ 왜 (2026-08-05 · 파트너 지시)
       패널이 메인비주얼(section.hero) <b>하나만</b> 대신했습니다. 그래서
       그 아래 두 구역 —
         section.triple  ALLIANCE WXN 검은 띠 (엘파그·엘피스탁·현대음악DB…)
         section.quick   보라 아이콘 줄 (리쿠르트·콩쿨정보·공연정보…)
       이 <b>아래로 밀려</b> 내려갔습니다. 파트너님이 바라시는 모습은
       패널이 그 세 구역이 차지하던 <b>세로 자리를 통째로 채우는</b> 것입니다.

     ★ 없는 구역은 건너뜁니다 — 다른 화면에서도 안전합니다.
     ★ 구역을 더하거나 빼려면 <b>이 목록만</b> 고치면 됩니다. */
  var TAKEOVER = ['section.hero', 'section.triple', 'section.quick'];
  function skipHere() {
    var pth = location.pathname;
    for (var i = 0; i < SKIP.length; i++) if (pth === SKIP[i]) return true;
    return false;
  }

  /* ★ 스타일도 <b>스스로</b> 싣습니다.
     화면마다 <link> 를 넣으면 빠뜨리기 쉽고, 패널을 안 여는 화면에서는
     헛되게 받아 옵니다. 처음 열 때 한 번만 싣습니다. */
  function needCss() {
    if (document.getElementById('oc-inner-css')) return;
    var l = document.createElement('link');
    l.id = 'oc-inner-css';
    l.rel = 'stylesheet';
    /* ★ CSS 도 캐시를 무력화합니다 — 날마다 한 번은 새로 받습니다 */
    l.href = '/assets/inner-space.css?v='
      + new Date().toISOString().slice(0,10).replace(/-/g,'');
    document.head.appendChild(l);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function nf(n) { return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /* ── Supabase ───────────────────────────────────────────── */
  var _libWait = null;
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
    if (_libWait) return _libWait;
    _libWait = new Promise(function (res) {
      var old = document.querySelector('script[data-oc-sblib]');
      if (old) {
        old.addEventListener('load', function () { res(true); });
        old.addEventListener('error', function () { res(false); });
        return;
      }
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      sc.setAttribute('data-oc-sblib', '1');
      sc.onload = function () { res(true); };
      sc.onerror = function () { res(false); };
      document.head.appendChild(sc);
    });
    return _libWait;
  }
  async function sb() {
    if (window.__ocSb) return window.__ocSb;
    var ok = await loadLib();
    if (!ok || !window.supabase || !window.supabase.createClient) return null;
    if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
    return window.__ocSb;
  }

  /* ── 패널 짜임 ───────────────────────────────────────────── */
  function shell() {
    return ''
      + '<div class="ins-wrap">'
      +   '<div class="ins-top">'
      +     '<span class="ins-title">INNER SPACE (MY SPACE)</span>'
      +     '<span class="ins-top-btns">'
      +       '<button type="button" class="ins-tb" id="insFirst">First Main</button>'
      +       '<a class="ins-tb solid" href="/account/profile.html">회원정보 수정</a>'
      +     '</span>'
      +   '</div>'

      +   '<div class="ins-grid">'
      /* ①② 첫째 줄기 — <b>한 묶음</b>으로 둡니다 (2026-08-05 · 파트너 지적)
             따로 두면 격자의 <b>줄 키</b>가 옆 칸(회원정보 메뉴)에 맞춰지고,
             회원 카드는 그보다 짧아서 그 아래로 <b>큰 빈 자리</b>가 생깁니다.
             영상 카드가 그만큼 내려가 사이가 벌어졌습니다.
             넷째 줄기(.ins-right)가 이미 쓰던 방식과 같습니다. */
      +     '<div class="ins-left">'
      +       '<div class="ins-card ins-me" id="insMe">'
      +         '<div class="ins-msg">불러오는 중…</div></div>'
      +       '<div class="ins-card ins-vid" id="insVid"></div>'
      +     '</div>'
      /* ③④ 둘째 줄기 — 같은 까닭으로 한 묶음 */
      +     '<div class="ins-mid">'
      +       '<div class="ins-card ins-menu" id="insMenu"></div>'
      +       '<div class="ins-card ins-linked" id="insLinked">'
      +         '<h4>MY OC Linked</h4><div class="ins-msg">불러오는 중…</div></div>'
      +     '</div>'
      /* ⑤ 내 관심분야 통계 */
      +     '<div class="ins-card ins-pie-card" id="insPie">'
      +       '<h4>내 관심분야 통계</h4><div class="ins-msg">불러오는 중…</div></div>'
      /* ⑥⑦ 넷째 줄기 — <b>한 묶음</b>으로 둡니다.
             따로 두면 왼쪽 카드 키에 따라 사이가 크게 벌어집니다. */
      +     '<div class="ins-right">'
      +       '<div class="ins-card" id="insBars">'
      +         '<h4>상위 관심컨텐츠 Update 현황 <em>최근 7일</em></h4>'
      +         '<div class="ins-msg">불러오는 중…</div></div>'
      +       '<div class="ins-card" id="insHits">'
      +         '<h4>내 컨텐츠 조회수</h4><div class="ins-msg">불러오는 중…</div></div>'
      +     '</div>'
      +   '</div>'

      +   '<div class="ins-close-row">'
      +     '<button type="button" class="ins-close" id="insClose">'
      +       'INNER SPACE CLOSE <i>&#10005;</i></button>'
      +   '</div>'
      + '</div>';
  }

  /* ── 회원 카드 ───────────────────────────────────────────── */
  function drawMe(m, pt) {
    var box = document.getElementById('insMe');
    if (!box) return;
    var ini = ((m && m.name) || '?').trim().charAt(0) || '?';
    var lvl = (pt && pt.label) || '';
    var act = (pt && pt.act) || 0;
    var use = (pt && pt.use) || 0;
    var nx  = (pt && pt.next) || null;
    var pct = 100;
    if (nx && nx.need) pct = Math.max(3, Math.min(100, Math.round(act / nx.need * 100)));

    box.innerHTML =
        '<div class="ins-ph">'
      +   (m && m.photo_url
            ? '<img src="' + esc(m.photo_url) + '" alt=""'
              + ' onerror="this.parentNode.innerHTML=\'<span>' + esc(ini) + '</span>\'">'
            : '<span>' + esc(ini) + '</span>')
      +   '<a class="ins-ph-edit" href="/account/profile.html" title="회원정보 수정">&#9998;</a>'
      + '</div>'
      + '<div class="ins-nm">' + esc((m && m.name) || '회원') + '</div>'
      + '<div class="ins-sub">'
      +   esc(TYPE[m && m.member_type] || (m && m.member_type) || '')
      +   ((m && m.field) ? ' · ' + esc(m.field) : '')
      + '</div>'
      + (lvl
          ? '<div class="ins-lv">'
            + '<div class="ins-lv-row"><span>회원레벨</span><b>' + esc(lvl) + '</b></div>'
            + '<div class="ins-lv-row"><span>활동점수</span><b>' + nf(act) + '</b></div>'
            + '<div class="ins-lv-row"><span>OC POINT</span><b>' + nf(use) + '</b></div>'
            + '<div class="ins-lv-bar"><i style="width:' + pct + '%"></i></div>'
            + (nx
                ? '<div class="ins-lv-next">' + esc(nx.label) + ' 까지 '
                  + nf(Math.max(0, nx.need - act)) + '점</div>'
                : '<div class="ins-lv-next">가장 높은 등급입니다</div>')
            + '</div>'
          : '');
  }

  /* ── 바로 가기 ───────────────────────────────────────────── */
  function drawMenu(m, links) {
    var box = document.getElementById('insMenu');
    if (!box) return;
    var recv = (links && links.received) ? links.received.length : 0;
    var hiring = ['industry','org','school'].indexOf(m && m.member_type) >= 0;

    /* ★ 회원 종류에 따라 다르게 보여 줍니다 — 기업 회원에게 「내 인재정보」 는
       없고, 일반 회원에게 「받은 지원」 은 없습니다. */
    /* ★ 시안의 메뉴 순서를 따릅니다 —
         POINT · 업데이트 한 컨텐츠 관리 · 받은/보낸 Linked …
       ★ 커뮤니티(내 커뮤니티 관리 · Inner Circle 생성)는 <b>넣지 않습니다</b>
         — 파트너와 「나중에」 로 정한 것입니다.
       ★ 「구매내역 / 수강내역」 도 아직 없습니다(쇼핑·레슨:ON 뒤에). */
    var rows = [
      { t:'POINT · 등급',            h:'/account/mypage.html#lvHead' },
      { t:'업데이트 한 컨텐츠 관리',   h:'/account/mypage.html#myHead' },
      { t:'받은 Linked / 보낸 Linked', h:'/account/mypage.html#lkHead', n:recv },
      { t:'활동 통계',               h:'/account/mypage.html#stHead' },
      { t:'관심분야 관리',            h:'/account/interests.html' },
      { t:'회원정보 수정',            h:'/account/profile.html' },
      hiring
        ? { t:'받은 지원',   h:'/account/mypage.html' }
        : { t:'내 지원 내역', h:'/account/mypage.html' },
      { t:'즐겨찾기 · 킵',  h:'/account/mypage.html' }
    ];

    box.innerHTML = '<h4>회원정보</h4>'
      + '<ul class="ins-menu-list">'
      + rows.map(function (r) {
          return '<li><a href="' + esc(r.h) + '">' + esc(r.t)
            + (r.n ? '<i>' + r.n + '</i>' : '') + '</a></li>';
        }).join('')
      + '</ul>'
      /* ★ <b>나의 메인 상태</b>를 여기에 적습니다 (2026-08-04 · 파트너 지시)
         메인 위에 있던 띠 —
           「나의 메인 · 관심분야 3개를 앞자리에 놓았습니다」
         를 없애고 그 내용을 이너스페이스로 옮겼습니다. 띠가 하나 더 있으면
         짜임이 어수선하고, 이 정보는 <b>내 것</b>이라 여기가 맞습니다. */
      + '<div class="ins-mainline" id="insMainLine"></div>';

    drawMainLine();
  }

  /* ── 활동 분포 (도넛) ───────────────────────────────────── */
  /* ── 나의 메인 상태 ─────────────────────────────────────────
     ★ 메인 위에 있던 띠를 없애고 그 내용을 여기로 옮겼습니다.
       담은 갯수와 「First Main 으로 보는 중」 여부를 알려 줍니다. */
  async function drawMainLine() {
    var box = document.getElementById('insMainLine');
    if (!box) return;
    var n = 0;
    try {
      var I = window.OCInterests;
      if (I) n = (await I.list()).length;
    } catch (e) {}

    var first = false;
    /* ★ 'my' 가 아니면 모두 오퍼스클램 메인입니다 (2026-08-05 뒤집음) */
    try { first = sessionStorage.getItem('oc-main-mode') !== 'my'; } catch (e) {}

    if (!n) {
      box.innerHTML = '<b>나의 메인</b>이 아직 꾸며지지 않았습니다 · '
        + '<a href="/account/interests.html">관심분야 담기 &#8594;</a>';
      return;
    }
    box.innerHTML = first
      ? '<b>오퍼스클램 메인</b>을 보고 있습니다 · '
        + '<a href="#" id="insToMy">나의 메인으로 &#8594;</a>'
      : '<b>나의 메인</b> · 관심분야 <b>' + n + '개</b>를 앞자리에 놓았습니다 · '
        + '<a href="/account/interests.html">순서 바꾸기 &#8594;</a>';

    var toMy = document.getElementById('insToMy');
    if (toMy) toMy.addEventListener('click', function (e) {
      e.preventDefault();
      try { sessionStorage.setItem('oc-main-mode', 'my'); } catch (e2) {}
      location.href = '/home.html';
    });
  }

  /* ── 내 관심분야 통계 (도넛) ─────────────────────────────
     ★ 시안의 「내 관심분야 통계」 자리입니다.
       <b>담아 두신 갈래가 각각 얼마나 큰가</b> 를 보여 줍니다 —
       그 갈래에 쌓인 자료 수의 비율입니다.
       (2026-08-04 · 처음에는 「내가 쓴 글의 분포」 로 만들었는데, 그것은
        「내 활동 분포」 이고 <b>관심분야 통계가 아니었습니다.</b>) */
  function drawPie(st) {
    var box = document.getElementById('insPie');
    if (!box) return;
    box.innerHTML = '<h4>내 관심분야 통계</h4><div class="ins-msg">불러오는 중…</div>';

    /* 담은 갈래를 읽습니다 — 순서까지 그대로 씁니다 */
    (async function () {
      var mine = [];
      try {
        var I = window.OCInterests;
        var c0 = await sb();
        if (I && c0) {
          var list = await I.list();

          /* ★ 갈래마다 <b>직접</b> 셉니다 (2026-08-04)

             처음에는 서버가 돌려준 값을 <b>이름으로 짝지었는데</b> 어긋났습니다 —
               · 정보SPOT 은 한 표(spot)에 일곱 갈래가 들어 있어, 「각 분야별
                 악보」 를 담아도 「정보SPOT」 과 이름이 달라 0 이 됐습니다
               · 「공연사진 / 영상」(관심분야) 과 「공연사진」(서버) 처럼
                 이름이 조금씩 다른 것도 있었습니다

             ★ interests.js 에 <b>표 이름(tb)과 갈래(sec)</b>가 이미 있으므로
               그것으로 셉니다. head:true 로 <b>갯수만</b> 받아 가볍습니다.
             ★ 담은 것이 많아도 아홉 개까지이므로 질의가 크게 늘지 않습니다. */
          var picked = [];
          list.forEach(function (x) {
            var c = I.find(x.big, x.key);
            if (c && c.tb) picked.push(c);
          });

          var counts = await Promise.all(picked.map(async function (c) {
            try {
              var q = c0.from(c.tb).select('id', { count: 'exact', head: true });
              if (c.tb === 'spot' && c.sec) q = q.eq('section', c.sec);
              if (c.tb === 'recruit_jobs') q = q.eq('status', 'open');
              var r = await q;
              return (r && typeof r.count === 'number') ? r.count : 0;
            } catch (e) { return 0; }
          }));

          picked.forEach(function (c, i) {
            mine.push({ cat: c.label, n: counts[i] || 0, href: c.href });
          });
        }
      } catch (e) {}

      /* 담은 것이 없으면 권합니다 */
      if (!mine.length) {
        box.innerHTML = '<h4>내 관심분야 통계</h4>'
          + '<div class="ins-none">아직 관심분야를 담지 않으셨습니다<br>'
          + '담아 두시면 <b>나의 메인</b>이 그 갈래로 채워집니다<br>'
          + '<a class="ins-more" href="/account/interests.html">관심분야 고르기 &#8594;</a></div>';
        return;
      }

      var total = 0;
      mine.forEach(function (x) { total += x.n; });

      /* 자료가 아직 없는 갈래만 담으셨을 수도 있습니다 */
      if (!total) {
        box.innerHTML = '<h4>내 관심분야 통계 <em>' + mine.length + '개</em></h4>'
          + '<div class="ins-legend">'
          + mine.map(function (x, i) {
              return '<div class="row">'
                + '<span class="pc" style="color:' + COLORS[i % COLORS.length] + '">·</span>'
                + '<span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>'
                + '<span class="nm">' + esc(x.cat) + '</span></div>';
            }).join('')
          + '</div>'
          + '<div class="ins-hint" style="margin:12px 0 0">담으신 갈래에 아직 자료가 없습니다</div>';
        return;
      }

      /* 큰 것부터 — 작은 조각이 앞에 오면 읽기 어렵습니다 */
      mine.sort(function (a, b) { return b.n - a.n; });

      var R = 44, W = 40, C = 2 * Math.PI * R, off = 0;
      var segs = mine.map(function (x, i) {
        var len = C * (x.n / total);
        var el = '<circle cx="66" cy="66" r="' + R + '" fill="none"'
          + ' stroke="' + COLORS[i % COLORS.length] + '" stroke-width="' + W + '"'
          + ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"'
          + ' stroke-dashoffset="' + (-off).toFixed(2) + '"'
          + ' transform="rotate(-90 66 66)"><title>' + esc(x.cat) + ' · '
          + nf(x.n) + '건</title></circle>';
        off += len;
        return el;
      }).join('');

      box.innerHTML = '<h4>내 관심분야 통계 <em>담은 것 ' + mine.length + '개</em></h4>'
        + '<div class="ins-pie-wrap">'
        +   '<svg width="132" height="132" viewBox="0 0 132 132" role="img"'
        +     ' aria-label="담은 갈래별 자료 비율">' + segs + '</svg>'
        +   '<div class="ins-legend">'
        +     mine.slice(0, 8).map(function (x, i) {
              var pc = Math.round(x.n / total * 100);
              return '<div class="row">'
                + '<span class="pc" style="color:' + COLORS[i % COLORS.length] + '">'
                +   (pc || '<1') + '%</span>'
                + '<span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>'
                + '<span class="nm" title="' + esc(x.cat) + ' · ' + nf(x.n) + '건">'
                +   esc(x.cat) + '</span>'
                + '</div>';
            }).join('')
        +   '</div>'
        + '</div>';
    })();
  }

  /* ── 상위 관심컨텐츠 Update 현황 (세로 막대) ────────────────
     ★ 시안의 그 자리입니다 — 담은 갈래에 최근 7일간 새 글이 얼마나
       올라왔나. 세로 막대로 그립니다(시안과 같게). */
  async function drawBars(st) {
    var box = document.getElementById('insBars');
    if (!box) return;
    var fresh = ((st && st.fresh) || []).filter(function (x) { return (x.n || 0) > 0; });

    /* 담은 갈래만 골라 보여 줍니다 */
    var want = {};
    try {
      var I = window.OCInterests;
      if (I) {
        (await I.list()).forEach(function (x) {
          var c = I.find(x.big, x.key);
          if (c) want[c.label] = true;
        });
      }
    } catch (e) {}
    var pick = fresh.filter(function (x) { return want[x.cat]; });
    var show = (pick.length ? pick : fresh)
      .slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 5);

    if (!show.length) {
      box.innerHTML = '<h4>상위 관심컨텐츠 Update 현황 <em>최근 7일</em></h4>'
        + '<div class="ins-none">최근 7일간 새 글이 없습니다</div>';
      return;
    }
    var max = 1;
    show.forEach(function (x) { if (x.n > max) max = x.n; });

    box.innerHTML = '<h4>상위 관심컨텐츠 Update 현황 <em>최근 7일</em></h4>'
      + (pick.length ? '' : '<div class="ins-hint">관심분야를 담으시면 그것만 보여 드립니다</div>')
      + '<div class="ins-vbars">'
      +   show.map(function (x) {
            var h = Math.max(6, Math.round(x.n / max * 88));
            return '<div class="ins-vbar">'
              + '<div class="n">' + nf(x.n) + '</div>'
              + '<div class="col" style="height:' + h + 'px"></div>'
              + '</div>';
          }).join('')
      + '</div>'
      + '<div class="ins-vlabels">'
      +   show.map(function (x) {
            return '<span title="' + esc(x.cat) + '">' + esc(x.cat) + '</span>';
          }).join('')
      + '</div>';
  }

  /* ── 내 컨텐츠 조회수 (꺾은선) ──────────────────────────────
     ★ 시안은 「일별」 이었지만 <b>글별</b>로 그립니다.
       일별로 보려면 날마다 조회수를 적어 두어야 하는데(그것이 열람 기록),
       실은 「어느 글이 많이 읽혔나」 가 회원에게 더 쓸모 있습니다. */
  function drawHits(st) {
    var box = document.getElementById('insHits');
    if (!box) return;
    var tops = ((st && st.tops) || []).slice(0, 8);
    if (!tops.length) {
      box.innerHTML = '<h4>내 컨텐츠 조회수</h4>'
        + '<div class="ins-none">아직 읽힌 기록이 없습니다</div>';
      return;
    }
    /* 조회수가 적은 것부터 왼쪽에 두어 <b>오르는 모양</b>으로 보이게 합니다 */
    var pts = tops.slice().reverse();
    var W = 320, H = 110, PAD = 14;
    var max = 1;
    pts.forEach(function (x) { if ((x.v || 0) > max) max = x.v; });

    var step = pts.length > 1 ? (W - PAD * 2) / (pts.length - 1) : 0;
    var xy = pts.map(function (x, i) {
      var px = PAD + step * i;
      var py = H - PAD - ((x.v || 0) / max) * (H - PAD * 2);
      return [px, py];
    });
    var line = xy.map(function (p2, i) {
      return (i ? 'L' : 'M') + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }).join(' ');
    var area = line + ' L' + xy[xy.length - 1][0].toFixed(1) + ' ' + (H - PAD)
      + ' L' + xy[0][0].toFixed(1) + ' ' + (H - PAD) + ' Z';

    box.innerHTML = '<h4>내 컨텐츠 조회수 <em>많이 읽힌 순</em></h4>'
      + '<svg class="ins-line" viewBox="0 0 ' + W + ' ' + H + '" role="img"'
      +   ' aria-label="내 글 조회수">'
      +   '<defs><linearGradient id="insLnG" x1="0" y1="0" x2="0" y2="1">'
      +     '<stop offset="0%" stop-color="#8a63a8" stop-opacity=".26"/>'
      +     '<stop offset="100%" stop-color="#8a63a8" stop-opacity="0"/>'
      +   '</linearGradient></defs>'
      +   '<line x1="' + PAD + '" y1="' + (H - PAD) + '" x2="' + (W - PAD)
      +     '" y2="' + (H - PAD) + '" stroke="#e6e6ee" stroke-width="1"/>'
      +   '<path d="' + area + '" fill="url(#insLnG)"/>'
      +   '<path d="' + line + '" fill="none" stroke="#8a63a8" stroke-width="2"'
      +     ' stroke-linejoin="round" stroke-linecap="round"/>'
      +   xy.map(function (p2, i) {
            return '<circle cx="' + p2[0].toFixed(1) + '" cy="' + p2[1].toFixed(1)
              + '" r="3" fill="#fff" stroke="#8a63a8" stroke-width="2"><title>'
              + esc((pts[i].t || '') + ' · ' + nf(pts[i].v) + '회') + '</title></circle>';
          }).join('')
      + '</svg>'
      + '<div class="ins-line-x">'
      +   '<span>' + nf(pts[0].v) + '회</span>'
      +   '<span>가장 많이 · ' + nf(pts[pts.length - 1].v) + '회</span>'
      + '</div>';
  }

  /* ── MY OC Linked ───────────────────────────────────────────
     ★ 시안의 그 자리입니다 — 이어진 사람 얼굴을 늘어놓습니다.
       (앞서 갈아 끼울 때 이 함수가 사라져 「불러오는 중」 에서 멈췄습니다) */
  function drawLinked(links) {
    var box = document.getElementById('insLinked');
    if (!box) return;
    var lk = (links && links.linked) || [];
    var rc = (links && links.received) || [];

    box.innerHTML = '<h4>MY OC Linked'
      + (rc.length ? ' <b class="ins-badge">요청 ' + rc.length + '</b>' : '') + '</h4>'
      + (lk.length
          ? '<div class="ins-faces">'
            + lk.slice(0, 7).map(function (x) {
                var ini = (x.name || '?').trim().charAt(0) || '?';
                return '<span class="ins-face" title="' + esc(x.name || '')
                  + (x.field ? ' · ' + esc(x.field) : '') + '">'
                  + (x.photo
                      ? '<img src="' + esc(x.photo) + '" alt="">'
                      : esc(ini))
                  + '</span>';
              }).join('')
            + '<a class="ins-face more" href="/account/mypage.html#lkHead">'
            +   (lk.length > 7 ? '+' + (lk.length - 7) : '&#8250;') + '</a>'
            + '</div>'
          : '<div class="ins-none">아직 이어진 사람이 없습니다<br>'
            + '<a class="ins-more" href="/account/mypage.html#lkHead">Linked 청하기 &#8594;</a></div>');
  }

  /* ── 영상 카드 ─────────────────────────────────────────────
     ★ 시안에 있던 자리입니다. 「음원 / 동영상」 의 최신 것을 하나 놓습니다.
       못 가져오면 그 게시판으로 가는 길만 놓습니다 — 빈 상자보다 낫습니다. */
  async function drawVid() {
    var box = document.getElementById('insVid');
    if (!box) return;
    var fallback = '<a href="/spot/media.html">'
      + '<span class="play"><i>&#9654;</i></span>'
      + '<span class="cap">음원 / 동영상 보기</span></a>';
    try {
      var c = await sb();
      if (!c) { box.innerHTML = fallback; return; }
      /* ★ <b>숨긴 자료를 걸러 냅니다</b> (2026-08-05)
         정보SPOT 목록(spot/media.html)은 숨긴 것을 빼고 보여 주는데
         여기에는 그 조건이 없어, 숨긴 자료가 이 카드에 뜰 수 있었습니다.
         ★ is.false 가 아니라 <b>not.is.true</b> 를 씁니다 —
           hidden 이 비어 있는(null) 자료를 놓치지 않습니다. */
      var r = await c.from('spot')
        .select('id,title,thumb_url')
        .eq('section', '음원영상')
        .not('hidden', 'is', true)
        .order('created_at', { ascending: false })
        .limit(1);
      var row = (r && r.data && r.data[0]) || null;
      if (!row) { box.innerHTML = fallback; return; }
      box.innerHTML = '<a href="/spot/spot-view.html?id=' + encodeURIComponent(row.id) + '">'
        + (row.thumb_url
            ? '<img src="' + esc(row.thumb_url) + '" alt="" loading="lazy">' : '')
        + '<span class="play"><i>&#9654;</i></span>'
        + '<span class="cap">' + esc(row.title || '음원 / 동영상') + '</span></a>';
    } catch (e) { box.innerHTML = fallback; }
  }

  /* ── 열기 ─
  /* ── 열기 ───────────────────────────────────────────────── */
  async function open() {
    if (skipHere()) return;   /* ★ 마이페이지 등에서는 열지 않습니다 */
    if (opened) return;
    var c = await sb();
    if (!c) return;
    var g = await c.auth.getSession();
    var sess = g && g.data && g.data.session;
    if (!sess) {
      location.href = '/account/login.html?next='
        + encodeURIComponent(location.pathname + location.search);
      return;
    }

    /* ★ 이너스페이스를 열면 <b>아래 메인도 「나의 메인」</b>이 됩니다
       (2026-08-05 · 파트너 지시)

       이너스페이스는 「내 자리」입니다. 그 아래로 이어지는 메인도 담아
       두신 관심분야로 채워져 있어야 짝이 맞습니다.
       그런데 [First Main] 을 한 번 누르면 sessionStorage 에 'first' 가
       남아, 그 뒤로는 계속 <b>원래 메인</b>이 보였습니다.
       그것을 여기서 풀어 줍니다.

     ★ 메인의 내용은 my-main.js 가 <b>화면을 그릴 때 한 번</b> 정합니다.
       이미 원래 메인으로 그려져 있으면 다시 불러야 바뀝니다. 그래서
       ?inner=1 을 붙여 다시 열리게 합니다 (패널도 저절로 열립니다).

     ★ 2026-08-05 뒤집음 — 기본이 <b>오퍼스클램 메인</b>이 되었습니다.
       그래서 「지우기」가 아니라 <b>'my' 를 넣는 것</b>이 이너스페이스의
       일입니다. 로그인만으로는 메인이 바뀌지 않고, <b>이너스페이스를
       누른 때에만</b> 바뀝니다. */
    var mainMine = false;
    try { mainMine = sessionStorage.getItem('oc-main-mode') === 'my'; } catch (e0) {}
    if (!mainMine) {
      try { sessionStorage.setItem('oc-main-mode', 'my'); } catch (e0) {}
      /* .board-main 이 있으면 메인 화면입니다 — 다시 그려야 바뀝니다 */
      if (document.querySelector('.board-main')) {
        location.href = location.pathname + '?inner=1';
        return;
      }
    }

    opened = true;
    needCss();

    /* ★ <b>문서 흐름 안에</b> 놓습니다 (2026-08-04 · 파트너 지시)

       앞서 position:fixed 로 화면을 덮고 뒤 스크롤을 막았습니다. 그런데
       시안은 <b>메인비주얼 자리에 얹히고 그 아래로 메인이 이어지는</b>
       모습입니다 — 스크롤하면 나의 메인 내용이 보여야 합니다.

     ★ 그래서 헤더 <b>다음</b>에 끼워 넣습니다. 그러면 아래 내용이
       밀려나고, 보통처럼 스크롤됩니다.
     ★ 메인이면 메인비주얼(section.hero)을 <b>감춥니다</b> — 시안처럼
       그 자리를 대신하는 것입니다. 다른 화면에는 그것이 없으니 그대로
       맨 위에 놓입니다. */
    var el = document.createElement('div');
    el.className = 'ins-panel';
    el.id = 'ocInnerSpace';
    el.innerHTML = shell();

    var hero = document.querySelector('section.hero');
    if (hero) {
      /* ★ 대신할 구역들을 모읍니다 (메인비주얼 + 그 아래 두 띠) */
      var takeover = [];
      TAKEOVER.forEach(function (sel) {
        var x = document.querySelector(sel);
        if (x) takeover.push(x);
      });

      /* ★ <b>감추기 전에 키를 잽니다</b> — 감춘 뒤에는 0 이 됩니다.
         이 합계만큼 패널을 늘려 <b>같은 자리를 꽉 채웁니다.</b> */
      var tall = 0;
      takeover.forEach(function (x) { tall += x.offsetHeight; });

      takeover.forEach(function (x) {
        x.setAttribute('data-ins-hid', '1');
        x.style.display = 'none';
      });

      /* 화면보다 짧아지지 않게 한 번 더 살핍니다 */
      if (tall < 520) tall = 520;
      el.style.minHeight = tall + 'px';

      hero.parentNode.insertBefore(el, hero);
    } else {
      /* 헤더 다음에 놓습니다 — 헤더를 못 찾으면 맨 앞에 */
      /* ★ <b>.gnb</b> 를 더했습니다 (2026-08-05)
         회원 화면 공용 헤더(partials/header-auth.html)의 맨 바깥이
         &lt;div class="gnb"&gt; 입니다. 그것을 못 찾아 패널이 <b>헤더보다
         위에</b> 놓였고, 그래서 헤더가 화면 밖으로 밀려났습니다. */
      var hd = document.querySelector('.site-header, #siteHeader, .gnb, header');
      if (hd && hd.parentNode) hd.parentNode.insertBefore(el, hd.nextSibling);
      else document.body.insertBefore(el, document.body.firstChild);
    }

    /* ★ 위 여백을 <b>헤더를 재어</b> 잡습니다 (2026-08-05)

       앞서 CSS 에 116px 로 못박아 두었습니다. 그런데 헤더가 화면에
       붙어(fixed) 있는 화면과 <b>보통처럼 흐르는</b> 화면이 섞여 있어,
       흐르는 화면에서는 116px 이 <b>까닭 없는 빈 띠</b>가 됩니다.
       그래서 실제로 재어 정합니다 — 붙어 있으면 그 높이만큼, 아니면 조금만. */
    var hdr = document.querySelector('.site-header, #siteHeader, .gnb, header');
    var pad = 26;
    if (hdr) {
      var ps = '';
      try { ps = getComputedStyle(hdr).position; } catch (e2) {}
      if (ps === 'fixed' || ps === 'sticky') pad = hdr.offsetHeight + 22;
    }
    el.style.setProperty('--ins-pad-top', pad + 'px');

    document.documentElement.classList.add('ins-open');
    setTimeout(function () { el.classList.add('on'); }, 20);
    /* 패널이 보이게 맨 위로 올립니다 — 스크롤 중이었을 수 있습니다 */
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }

    document.getElementById('insClose').addEventListener('click', close);
    document.addEventListener('keydown', onEsc);

    /* First Main — 원래 메인을 보여 줍니다 (나의 메인 대신) */
    var fm = document.getElementById('insFirst');
    if (fm) fm.addEventListener('click', function () {
      /* ★ 표시를 <b>지웁니다</b> — 표시가 없으면 오퍼스클램 메인입니다
         (2026-08-05 뒤집음. 예전에는 'first' 를 넣었습니다) */
      try { sessionStorage.removeItem('oc-main-mode'); } catch (e) {}
      location.href = '/home.html';
    });

    /* 자료를 한꺼번에 받아 옵니다 — 하나씩 기다리면 느립니다 */
    var m = null, pt = null, st = null, links = null;
    try {
      var got = await Promise.all([
        c.from('members').select('*').eq('id', sess.user.id).single(),
        c.rpc('oc_my_points'),
        c.rpc('oc_my_stats'),
        c.rpc('oc_my_links')
      ]);
      m     = (got[0] && got[0].data) || null;
      pt    = (got[1] && got[1].data) || null;
      st    = (got[2] && got[2].data) || null;
      links = (got[3] && got[3].data) || null;
    } catch (e) { /* 일부가 없어도 나머지는 그립니다 */ }

    drawMe(m, pt);
    drawMenu(m, links);
    drawPie(st);
    drawBars(st);
    drawHits(st);
    drawLinked(links);
    drawVid();
  }

  function onEsc(e) { if (e.key === 'Escape') close(); }

  function close() {
    var el = document.getElementById('ocInnerSpace');
    if (!el) { opened = false; return; }
    el.classList.remove('on');
    document.documentElement.classList.remove('ins-open');
    document.removeEventListener('keydown', onEsc);

    /* ★ 주소에 남은 <b>?inner=1</b> 을 지웁니다 (2026-08-05)
       패널을 열 때 붙인 것입니다. 닫은 뒤에도 남아 있으면, 새로 고쳤을 때
       패널이 <b>저절로 다시 열려</b> 놀라게 됩니다.
       화면을 다시 불러오지 않고 주소만 바꿉니다(replaceState). */
    try {
      if (/[?&]inner=1/.test(location.search) && history.replaceState) {
        var q = location.search.replace(/([?&])inner=1&?/, '$1').replace(/[?&]$/, '');
        history.replaceState(null, '', location.pathname + q + location.hash);
      }
    } catch (e4) {}
    setTimeout(function () {
      el.remove();
      /* ★ 감췄던 구역을 <b>모두</b> 되돌립니다 (2026-08-05)
         예전에는 querySelector 로 <b>첫 하나만</b> 되돌렸습니다. 이제
         세 구역을 감추므로 querySelectorAll 로 전부 살려야 합니다. */
      [].forEach.call(document.querySelectorAll('[data-ins-hid]'), function (x) {
        x.style.display = '';
        x.removeAttribute('data-ins-hid');
      });

      /* ★ 되살린 뒤 <b>다시 재게</b> 알립니다 (2026-08-05)
         section.triple 의 굴러가는 글자는 폭(scrollWidth)을 재어 움직입니다.
         감춰져 있는 동안 폭이 0 이라, 그때 창 크기가 바뀌면 0 으로 재어
         멈출 수 있습니다. 되살린 다음 resize 를 한 번 알려 다시 재게 합니다. */
      try { window.dispatchEvent(new Event('resize')); } catch (e3) {}
      opened = false;
    }, 300);
  }

  /* ── 여는 길 ─
  /* ── 여는 길 ─────────────────────────────────────────────
     ★ data-oc-inner 를 가진 것을 누르면 열립니다.
       헤더의 「이너스페이스」 가 그것입니다.
     ★ 주소에 ?inner=1 이 있으면 저절로 엽니다 — 다른 화면에서
       「이너스페이스로」 를 눌러 올 수 있게 합니다. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-oc-inner]');
    if (!t) return;
    e.preventDefault();
    open();
  });

  try {
    if (!skipHere() && new URLSearchParams(location.search).get('inner') === '1') {
      setTimeout(open, 400);
    }
  } catch (e) {}

  window.OCInner = { open: open, close: close };

  /* ── 헤더에 「이너스페이스」 가 없으면 스스로 놓습니다 ─────────
     ★ 왜 필요한가 (2026-08-04 · 마이페이지에서 안 나와 알았습니다)

       헤더를 그리는 길이 <b>두 갈래</b>입니다 —
         assets/app.js   메인·게시판 (.hdr-auth 링크를 갈아 끼움)
         assets/auth.js  회원 화면 (.authlink 를 채움)
       그 위에 partials 를 <b>나중에</b> 끼우는 화면도 있어서, 어느 한
       곳에 넣으면 다른 쪽에서 빠집니다.

     ★ 그래서 이 파일이 <b>스스로</b> 살펴 놓습니다. 이미 있으면
       아무 일도 하지 않으므로 두 번 생기지 않습니다.
     ★ 로그아웃 링크 <b>앞</b>에 놓습니다 — 「내 것」 끼리 모여 있게요. */
  function selfMount() {
    if (skipHere()) {
      /* ★ 다른 파일이 벌써 놓았을 수 있어 <b>걷어냅니다.</b> */
      [].forEach.call(document.querySelectorAll('[data-oc-inner]'), function (x) {
        if (x.parentNode) x.parentNode.removeChild(x);
      });
      return true;   /* 더 살펴보지 않습니다 */
    }
    if (document.querySelector('[data-oc-inner]')) return true;

    /* 로그아웃 링크를 찾습니다 — 그것이 있으면 로그인한 화면입니다 */
    var outs = [].slice.call(document.querySelectorAll('a')).filter(function (a) {
      var t = (a.textContent || '').replace(/\s/g, '');
      return t === '로그아웃';
    });
    if (!outs.length) return false;

    outs.forEach(function (a) {
      if (!a.parentNode) return;
      if (a.parentNode.querySelector('[data-oc-inner]')) return;
      var b = document.createElement('a');
      /* ★ 옆에 있는 링크의 <b>결(class)을 그대로 물려받습니다</b> (2026-08-05)
         헤더는 화면마다 제 색 규칙이 있습니다(예: .link-txt).
         결이 없으면 <b>바탕과 같은 색</b>이 되어 글자가 안 보입니다. */
      b.className = a.className;
      b.href = '#';
      b.setAttribute('data-oc-inner', '1');
      b.textContent = '이너스페이스';
      a.parentNode.insertBefore(b, a);
      a.parentNode.insertBefore(document.createTextNode(' '), a);
    });
    return true;
  }

  /* ★ 헤더는 <b>뒤늦게</b> 그려집니다(로그인 확인 뒤). 그래서 한 번만
     보면 놓칩니다. 0.6초마다 최대 10번 살펴보고, 놓으면 그칩니다. */
  (function watchHeader() {
    if (selfMount()) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (selfMount() || n > 10) clearInterval(t);
    }, 600);
  })();
})();
