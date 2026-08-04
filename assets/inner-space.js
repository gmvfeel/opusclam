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

  /* ★ 스타일도 <b>스스로</b> 싣습니다.
     화면마다 <link> 를 넣으면 빠뜨리기 쉽고, 패널을 안 여는 화면에서는
     헛되게 받아 옵니다. 처음 열 때 한 번만 싣습니다. */
  function needCss() {
    if (document.getElementById('oc-inner-css')) return;
    var l = document.createElement('link');
    l.id = 'oc-inner-css';
    l.rel = 'stylesheet';
    l.href = '/assets/inner-space.css';
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
      +     '<span class="ins-title">INNER SPACE <em>(MY SPACE)</em></span>'
      +     '<span class="ins-top-btns">'
      +       '<a class="ins-tb" href="/home.html?first=1">First Main</a>'
      +       '<a class="ins-tb" href="/account/profile.html">회원정보 수정</a>'
      +     '</span>'
      +   '</div>'

      +   '<div class="ins-grid">'
      /* ① 회원 카드 */
      +     '<div class="ins-card ins-me" id="insMe">'
      +       '<div class="ins-msg">불러오는 중…</div>'
      +     '</div>'
      /* ② 바로 가기 */
      +     '<div class="ins-card ins-menu" id="insMenu"></div>'
      /* ③ 활동 분포 */
      +     '<div class="ins-card" id="insPie">'
      +       '<h4>내 활동 분포</h4><div class="ins-msg">불러오는 중…</div>'
      +     '</div>'
      /* ④ 관심분야 새 글 */
      +     '<div class="ins-card" id="insFresh">'
      +       '<h4>관심분야 새 글 <em>최근 7일</em></h4><div class="ins-msg">불러오는 중…</div>'
      +     '</div>'
      /* ⑤ MY OC Linked */
      +     '<div class="ins-card ins-linked" id="insLinked">'
      +       '<h4>MY OC Linked</h4><div class="ins-msg">불러오는 중…</div>'
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
    var rows = [
      { t:'회원정보 수정',   h:'/account/profile.html' },
      { t:'관심분야 관리',   h:'/account/interests.html' },
      { t:'등급 · 포인트',   h:'/account/mypage.html#lvHead' },
      { t:'내가 올린 것',    h:'/account/mypage.html#myHead' },
      { t:'활동 통계',      h:'/account/mypage.html#stHead' },
      { t:'Linked · 인맥',  h:'/account/mypage.html#lkHead', n:recv },
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
      + '</ul>';
  }

  /* ── 활동 분포 (도넛) ───────────────────────────────────── */
  function drawPie(st) {
    var box = document.getElementById('insPie');
    if (!box) return;
    var items = (st && st.mine) || [];
    var total = (st && st.posts) || 0;
    if (!items.length) {
      box.innerHTML = '<h4>내 활동 분포</h4>'
        + '<div class="ins-none">아직 올리신 글이 없습니다</div>';
      return;
    }
    var R = 40, W = 17, C = 2 * Math.PI * R, off = 0;
    var segs = items.map(function (x, i) {
      var len = C * (total ? x.n / total : 0);
      var el = '<circle cx="52" cy="52" r="' + R + '" fill="none"'
        + ' stroke="' + COLORS[i % COLORS.length] + '" stroke-width="' + W + '"'
        + ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"'
        + ' stroke-dashoffset="' + (-off).toFixed(2) + '"'
        + ' transform="rotate(-90 52 52)"></circle>';
      off += len;
      return el;
    }).join('');

    box.innerHTML = '<h4>내 활동 분포</h4>'
      + '<div class="ins-pie">'
      +   '<svg width="104" height="104" viewBox="0 0 104 104" role="img"'
      +     ' aria-label="갈래별 내 글 분포">'
      +     '<circle cx="52" cy="52" r="' + R + '" fill="none"'
      +       ' stroke="rgba(255,255,255,.14)" stroke-width="' + W + '"></circle>'
      +     segs
      +     '<text x="52" y="50" text-anchor="middle" font-size="18" font-weight="800"'
      +       ' fill="#fff" font-family="inherit">' + total + '</text>'
      +     '<text x="52" y="65" text-anchor="middle" font-size="8.5"'
      +       ' fill="rgba(255,255,255,.6)" font-family="inherit">올린 글</text>'
      +   '</svg>'
      +   '<div class="ins-legend">'
      +     items.slice(0, 6).map(function (x, i) {
            var pc = total ? Math.round(x.n / total * 100) : 0;
            return '<div class="row">'
              + '<span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>'
              + '<span class="nm">' + esc(x.cat) + '</span>'
              + '<span class="pc">' + pc + '%</span>'
              + '</div>';
          }).join('')
      +   '</div>'
      + '</div>';
  }

  /* ── 관심분야 새 글 (막대) ───────────────────────────────── */
  async function drawFresh(st) {
    var box = document.getElementById('insFresh');
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
      box.innerHTML = '<h4>관심분야 새 글 <em>최근 7일</em></h4>'
        + '<div class="ins-none">최근 7일간 새 글이 없습니다</div>';
      return;
    }
    var max = 1;
    show.forEach(function (x) { if (x.n > max) max = x.n; });

    box.innerHTML = '<h4>관심분야 새 글 <em>최근 7일</em></h4>'
      + (pick.length ? '' : '<div class="ins-hint">관심분야를 담으시면 그것만 보여 드립니다</div>')
      + '<div class="ins-bars">'
      + show.map(function (x) {
          var w = Math.max(4, Math.round(x.n / max * 100));
          return '<div class="ins-bar">'
            + '<span class="nm">' + esc(x.cat) + '</span>'
            + '<span class="tr"><i style="width:' + w + '%"></i></span>'
            + '<span class="n">' + nf(x.n) + '</span>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  /* ── MY OC Linked ───────────────────────────────────────── */
  function drawLinked(links) {
    var box = document.getElementById('insLinked');
    if (!box) return;
    var lk = (links && links.linked) || [];
    var rc = (links && links.received) || [];

    box.innerHTML = '<h4>MY OC Linked'
      + (rc.length ? ' <b class="ins-badge">요청 ' + rc.length + '</b>' : '') + '</h4>'
      + (lk.length
          ? '<div class="ins-faces">'
            + lk.slice(0, 8).map(function (x) {
                var ini = (x.name || '?').trim().charAt(0) || '?';
                return '<span class="ins-face" title="' + esc(x.name || '')
                  + ((x.field ? ' · ' + x.field : '')) + '">'
                  + (x.photo
                      ? '<img src="' + esc(x.photo) + '" alt=""'
                        + ' onerror="this.parentNode.innerHTML=\'' + esc(ini) + '\'">'
                      : esc(ini))
                  + '</span>';
              }).join('')
            + (lk.length > 8 ? '<span class="ins-face more">+' + (lk.length - 8) + '</span>' : '')
            + '</div>'
            + '<a class="ins-more" href="/account/mypage.html#lkHead">모두 보기 &#8594;</a>'
          : '<div class="ins-none">아직 이어진 사람이 없습니다<br>'
            + '<a class="ins-more" href="/account/mypage.html#lkHead">Linked 청하기 &#8594;</a></div>');
  }

  /* ── 열기 ───────────────────────────────────────────────── */
  async function open() {
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

    opened = true;
    needCss();
    var el = document.createElement('div');
    el.className = 'ins-panel';
    el.id = 'ocInnerSpace';
    el.innerHTML = shell();
    document.body.appendChild(el);
    /* ★ 뒤 화면이 굴러가지 않게 막습니다 — 패널을 보는 동안은 그것에
       집중하는 편이 낫습니다. */
    document.documentElement.classList.add('ins-lock');
    setTimeout(function () { el.classList.add('on'); }, 20);

    document.getElementById('insClose').addEventListener('click', close);
    el.addEventListener('click', function (e) {
      if (e.target === el) close();   /* 바깥을 누르면 닫습니다 */
    });
    document.addEventListener('keydown', onEsc);

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
    drawFresh(st);
    drawLinked(links);
  }

  function onEsc(e) { if (e.key === 'Escape') close(); }

  function close() {
    var el = document.getElementById('ocInnerSpace');
    if (!el) { opened = false; return; }
    el.classList.remove('on');
    document.documentElement.classList.remove('ins-lock');
    document.removeEventListener('keydown', onEsc);
    setTimeout(function () { el.remove(); opened = false; }, 260);
  }

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
    if (new URLSearchParams(location.search).get('inner') === '1') {
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
