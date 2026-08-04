/* ============================================================
   OPUSCLAM  나만의 메인                assets/my-main.js
   2026-08-04

   ★ 무엇을 하나
     로그인한 회원이 관심분야를 담아 두었으면, 메인의 왼쪽 칸들을
     <b>그 갈래로 갈아 끼웁니다.</b> 나만의 오퍼스클램이 됩니다.

       비로그인 · 안 담은 회원   →  오퍼스클램 메인 (그대로)
       담은 회원               →  담은 갈래로 채워진 메인
       「First Main」          →  원래 메인 보기

   ★ 왜 <b>여섯 개</b>까지만 놓나 (2026-08-04 · 정한 것)
     스물일곱 갈래를 다 담은 회원이 있으면 메인이 스물일곱 칸이 됩니다.
     그러면 스크롤만 길어지고 아무것도 눈에 안 들어옵니다 —
     관심분야를 담은 뜻이 오히려 사라집니다.

     그리고 지금 메인은 아래로 콘서트PR · 무료티켓 · 추천컨텐츠 ·
     쇼핑 · 레슨 · 배너가 있습니다. 왼쪽이 길어지면 그것들이
     <b>아무도 못 보는 자리</b>로 밀립니다(광고 자리이기도 합니다).

     여섯이면 관심분야 관리의 <b>순서가 뜻을 갖습니다</b> —
     「무엇을 위에 둘까」 를 생각하게 되지요.

   ★ 담은 것이 일곱 개 이상이면 맨 아래에 알립니다 —
     가려진 것이 있다는 것을 알 수 있고, 순서를 바꾸러 갈 길도 생깁니다.

   ★ 원래 메인은 <b>지우지 않고 감춥니다.</b>
     「First Main」 을 누르면 되돌려야 하므로, 지우면 다시 만들 수
     없습니다. 감추면 한 번에 되돌아옵니다.

   쓰는 법 — home.html 맨 아래에
     <script src="/assets/interests.js"></script>
     <script src="/assets/my-main.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var MAX = 6;               /* 메인에 놓을 갯수 */
  var ROWS = 4;              /* 한 칸에 보여 줄 줄 수 */
  var KEY_MODE = 'oc-main-mode';   /* 'my' 또는 'first' */

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(v) {
    var d = String(v || '').slice(0, 10).replace(/-/g, '.');
    return d ? d.slice(2) : '';
  }

  /* ── 갈래 하나의 글을 가져옵니다 ───────────────────────────
     ★ 표마다 칸 이름이 다릅니다 —
         spot·커뮤니티   title      제목
         DB              name_ko    이름
         학술·리쿠르트    title      제목
       그래서 갈래마다 nameCol 을 적어 두었습니다(interests.js).

     ★ <b>fetch 로 직접 부릅니다.</b> supabase-js 를 기다리지 않아
       빠르고, 메인은 로그인 없이도 보이는 화면이라 그편이 낫습니다. */
  async function fetchRows(cat) {
    if (!cat.tb) return [];
    var col = cat.nameCol || 'title';
    var sel = 'id,' + col + ',created_at';
    var q = SB_URL + '/rest/v1/' + cat.tb + '?select=' + encodeURIComponent(sel);

    /* 정보SPOT 은 한 표(spot)에 여러 갈래가 있어 section 으로 가릅니다 */
    if (cat.tb === 'spot' && cat.sec) {
      q += '&section=eq.' + encodeURIComponent(cat.sec)
         + '&hidden=is.false';
      /* 악보는 확인을 지난 것만 보여 줍니다 */
      if (cat.key === 'score') q += '&review_status=eq.approved';
      q += '&order=created_at.desc,id.desc';
    } else if (/^(persons|orgs|venues|schools|modern_composers|foundations)$/.test(cat.tb)) {
      /* DB 는 새로 담긴 순서보다 <b>고른 순서</b>가 낫습니다 */
      q += '&order=sort_no.desc.nullslast,id.desc';
    } else if (cat.tb === 'recruit_jobs') {
      q += '&status=eq.open&order=created_at.desc,id.desc';
    } else {
      q += '&hidden=is.false&order=created_at.desc,id.desc';
    }
    q += '&limit=' + ROWS;

    try {
      var r = await fetch(q, { headers: H });
      if (!r.ok) return [];
      var rows = await r.json();
      return (rows || []).map(function (x) {
        return { id: x.id, t: x[col] || '(제목 없음)', d: x.created_at };
      });
    } catch (e) { return []; }
  }

  /* ── 칸 하나를 만듭니다 ─────────────────────────────────────
     ★ 원래 메인의 .col-block 과 <b>같은 짜임</b>으로 만듭니다.
       그래야 스타일을 새로 만들지 않아도 어울립니다. */
  function blockHtml(cat, rows) {
    var lis = rows.length
      ? rows.map(function (x) {
          return '<li><a href="' + esc(cat.view || cat.href)
            + (cat.view ? ('?id=' + encodeURIComponent(x.id)) : '') + '">'
            + esc(x.t) + '</a>'
            + '<span class="dt">' + esc(fmtDate(x.d)) + '</span></li>';
        }).join('')
      : '<li class="oc-my-none"><span>아직 올라온 것이 없습니다</span></li>';

    return '<div class="col-block oc-my-block">'
      + '<div class="sec-head"><div class="t">'
      +   '<span class="en-s">' + esc(cat.en || '') + '</span>'
      +   '<span class="ko">' + esc(cat.label) + '</span>'
      + '</div><a class="more en" href="' + esc(cat.href) + '">VIEW MORE +</a></div>'
      + '<ul class="list" style="margin-top:12px">' + lis + '</ul>'
      + '</div>';
  }

  /* ── 알림 줄 ───────────────────────────────────────────── */
  function moreLine(total) {
    if (total <= MAX) return '';
    return '<div class="oc-my-more">'
      + '담은 것 <b>' + total + '개</b> 가운데 <b>' + MAX + '개</b>를 보고 있습니다'
      + ' <a href="/account/interests.html">순서 바꾸기 →</a>'
      + '</div>';
  }

  /* ── 관심분야를 담지 않은 회원에게 권합니다 ───────────────── */
  function inviteHtml() {
    return '<div class="oc-my-invite">'
      + '<b>관심분야를 담아 보세요.</b>'
      + ' 담아 두시면 이 자리가 <b>그 갈래로 채워집니다</b> — 나만의 오퍼스클램이 됩니다.'
      + ' <a href="/account/interests.html">관심분야 고르기 →</a>'
      + '</div>';
  }

  /* ── 갈아 끼우기 ─────────────────────────────────────────── */
  var origHTML = null;      /* 원래 메인을 담아 둡니다 */
  var boardMain = null;

  function saveOrig() {
    if (origHTML !== null) return;
    boardMain = document.querySelector('.board-main');
    if (boardMain) origHTML = boardMain.innerHTML;
  }
  function showFirst() {
    /* ★ 원래 메인으로 되돌립니다 — 감춘 것을 다시 보이게 하는 것이 아니라
       담아 둔 글자를 그대로 되돌려 놓습니다. 그러면 안에서 돌던 코드가
       다시 필요해질 수 있으므로, 새로 고치는 편이 확실합니다. */
    try { sessionStorage.setItem(KEY_MODE, 'first'); } catch (e) {}
    location.reload();
  }
  function showMy() {
    try { sessionStorage.removeItem(KEY_MODE); } catch (e) {}
    location.reload();
  }

  /* ── 띠 단추 ───────────────────────────────────────────────
     ★ 「지금 무엇을 보고 있나」 와 「바꾸는 길」 을 함께 둡니다.
       모드를 바꿀 수 있다는 것을 모르면 갇힌 느낌이 됩니다. */
  function bar(mode, n) {
    var el = document.createElement('div');
    el.className = 'oc-my-bar' + (mode === 'first' ? ' first' : '');
    el.innerHTML = (mode === 'my')
      ? '<span><b>나의 메인</b> · 관심분야 ' + n + '개로 채웠습니다</span>'
        + '<span class="btns">'
        + '<a href="/account/interests.html">관심분야 관리</a>'
        + '<button type="button" id="ocFirstMain">First Main</button>'
        + '</span>'
      : '<span><b>오퍼스클램 메인</b>을 보고 있습니다</span>'
        + '<span class="btns">'
        + '<button type="button" id="ocMyMain">나의 메인으로</button>'
        + '</span>';
    return el;
  }

  /* ★ 띠는 <b>.wrap 밖</b>에 놓습니다.

     왜 (2026-08-04 · 짜임이 깨져서 알았습니다)
       .board .wrap 은 <b>격자(1fr 350px)</b>입니다. 그 안에 띠를 넣으면
       칸이 하나 밀려서 board-main 이 350px 자리로 갑니다 —
       1400px 화면인데 350px 로 눌려 글자가 세로로 섰습니다.

     그래서 section.board <b>앞</b>에 놓고, 폭은 .wrap 과 같게 맞춥니다. */
  function mountBar(mode, n) {
    var sec = document.querySelector('section.board');
    if (!sec) return;
    var old = document.querySelector('.oc-my-bar');
    if (old) old.remove();
    var el = bar(mode, n);
    var host = document.createElement('div');
    host.className = 'oc-my-bar-host';
    host.appendChild(el);
    sec.parentNode.insertBefore(host, sec);
    var f = document.getElementById('ocFirstMain');
    if (f) f.addEventListener('click', showFirst);
    var m = document.getElementById('ocMyMain');
    if (m) m.addEventListener('click', showMy);
  }

  /* ── 시작 ───────────────────────────────────────────────── */
  async function start() {
    var I = window.OCInterests;
    if (!I) return;

    var me = await I.me();
    if (!me) return;                    /* 로그인 안 함 — 그대로 둡니다 */

    var mine = await I.list(true);
    if (!mine.length) {
      /* 담은 것이 없으면 <b>권하는 줄</b>만 놓습니다. 메인은 그대로 둡니다. */
      var sec0 = document.querySelector('section.board');
      if (sec0 && !document.querySelector('.oc-my-invite')) {
        var d = document.createElement('div');
        d.className = 'oc-my-bar-host';
        d.innerHTML = inviteHtml();
        sec0.parentNode.insertBefore(d, sec0);
      }
      return;
    }

    /* 「First Main」 을 골라 두었으면 원래 메인을 보여 줍니다 */
    var mode = 'my';
    try { if (sessionStorage.getItem(KEY_MODE) === 'first') mode = 'first'; } catch (e) {}
    if (mode === 'first') { mountBar('first', mine.length); return; }

    saveOrig();
    if (!boardMain) return;

    /* 담은 순서대로 앞 여섯 개 */
    var pick = mine.slice(0, MAX).map(function (x) {
      return I.find(x.big, x.key);
    }).filter(function (c) {
      /* 목록을 가져올 수 없는 갈래(SELF PR 등)는 건너뜁니다 */
      return c && c.tb;
    });

    if (!pick.length) return;           /* 담은 것이 다 링크뿐이면 그대로 */

    /* 글을 한꺼번에 가져옵니다 — 하나씩 기다리면 느립니다 */
    var got = await Promise.all(pick.map(fetchRows));

    /* 두 줄기로 나눠 놓습니다 — 원래 메인과 같은 짜임입니다 */
    var half = Math.ceil(pick.length / 2);
    var c1 = '', c2 = '';
    pick.forEach(function (cat, i) {
      var html = blockHtml(cat, got[i] || []);
      if (i < half) c1 += html; else c2 += html;
    });

    boardMain.innerHTML =
        '<div class="col-1">' + c1 + '</div>'
      + '<div class="col-2">' + c2 + '</div>';

    /* 알림 줄과 띠 */
    /* 알림 줄도 격자 밖에 놓습니다 (같은 까닭) */
    var more = moreLine(mine.length);
    if (more) {
      var sec2 = document.querySelector('section.board');
      if (sec2 && !document.querySelector('.oc-my-more')) {
        var dd = document.createElement('div');
        dd.className = 'oc-my-bar-host';
        dd.innerHTML = more;
        sec2.parentNode.insertBefore(dd, sec2.nextSibling);
      }
    }
    mountBar('my', mine.length);
  }

  /* interests.js 가 늦게 실릴 수 있으므로 기다립니다 */
  (function wait(n) {
    if (window.OCInterests) { start(); return; }
    if (n > 40) return;
    setTimeout(function () { wait(n + 1); }, 100);
  })(0);
})();
