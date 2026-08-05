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

  /* ★ <b>아홉</b>까지 놓습니다 (2026-08-04 · 처음에는 여섯이었습니다)
     원래 칸이 아홉이라 다 갈아 끼울 수 있고, 담은 만큼 보여 드리는
     편이 관심분야의 뜻에 맞습니다. */
  var MAX = 9;

  /* ★ 한 칸에 <b>일곱 줄</b>을 보여 줍니다 (처음에는 넷이었습니다)
     원래 칸에는 대표 카드(사진+설명)가 있어 키가 큽니다. 제 칸이 목록
     넷뿐이라 <b>왼쪽이 짧아져 빈 자리가 생겼습니다.</b>

     ★ 대표 카드를 만들지 않고 <b>목록을 늘리는</b> 쪽을 골랐습니다 —
       표마다 사진 칸이 달라(thumb_url·image_url·logo_url) 복잡해지고,
       리쿠르트에서는 제목이 짧을 때 「빈 상자만 커 보인다」 고 그 카드를
       없앤 적이 있습니다. 관심분야는 <b>많이 훑는 것</b>이 값입니다. */
  var ROWS = 7;

  /* ★ <b>여유분을 더 가져옵니다</b> (2026-08-04 · 파트너 지적)
     갈래마다 글 수와 키가 달라 두 줄기(왼쪽·오른쪽)가 어긋납니다.
     그래서 처음부터 넉넉히 받아 두고, 화면에 그린 뒤 <b>짧은 줄기의
     칸에 숨겨 둔 줄을 하나씩 켜서</b> 키를 맞춥니다.
     통신은 한 번뿐이므로 무겁지 않습니다. */
  var ROWS_MAX = 14;

  /* ★ 키를 맞출 때 <b>여기까지</b> 줄일 수 있습니다.
     처음에는 ROWS(7) 아래로 안 줄였는데, 그러면 짧은 쪽에 켤 줄이 없을 때
     빈 자리가 그대로 남았습니다(「셋만 담음」 에서 181px).
     넷은 원래 메인의 기본 줄 수이므로 초라하지 않습니다. */
  var ROWS_MIN = 4;
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
      /* ★ 여기도 「숨긴 것만 빼기」 로 둡니다 (위와 같은 까닭) */
      q += '&section=eq.' + encodeURIComponent(cat.sec)
         + '&hidden=not.is.true';
      /* 악보는 확인을 지난 것만 보여 줍니다 */
      if (cat.key === 'score') q += '&review_status=eq.approved';
      q += '&order=created_at.desc,id.desc';
    } else if (/^(persons|orgs|venues|schools|modern_composers|foundations)$/.test(cat.tb)) {
      /* DB 는 새로 담긴 순서보다 <b>고른 순서</b>가 낫습니다 */
      q += '&order=sort_no.desc.nullslast,id.desc';
    } else if (cat.tb === 'recruit_jobs') {
      q += '&status=eq.open&order=created_at.desc,id.desc';
    } else {
      /* ★ <b>hidden 이 null 인 것도 보여 줍니다.</b>

         왜 (2026-08-04 · 지식나눔·공연사진이 비어 보여서 알았습니다)
           예전에는 &hidden=is.false 만 두었습니다. 그런데 SQL 에서
           <b>null 은 false 와 같지 않습니다.</b> 그래서 「숨기지 않았다」 는
           뜻으로 null 이 담긴 글이 <b>모두 걸러졌습니다.</b>

           게시판마다 사정이 달랐습니다 — hottopic 은 false 로 채워져
           있어서 나왔고, qna·gallery 는 null 이라 하나도 안 나왔습니다.

         ★ 「숨긴 것만 빼자」 가 우리 뜻이므로 <b>hidden 이 참인 것만</b>
           걸러 냅니다. 그러면 null 이든 false 든 다 보입니다.
         ★ hidden 칸이 아예 없는 표(utility 등)에서는 이 조건을 쓰면
           통째로 실패하므로, 그런 표는 아래에서 따로 다룹니다. */
      /* ★ <b>커뮤니티 게시판에는 hidden 칸이 없습니다.</b>
         (2026-08-04 · 확인 SQL 로 알았습니다 — 아홉 곳 모두 없습니다)

         제가 「있을 것」 이라 짐작해서 조건을 걸었더니, 없는 칸이라
           column ... does not exist
         오류로 <b>아홉 게시판이 통째로 비어</b> 보였습니다.

         실제 게시판 목록(assets/board.js)도 hidden 을 쓰지 않습니다 —
         커뮤니티에 숨기기 기능이 애초에 없습니다.

         ★ 그러니 커뮤니티는 <b>조건을 걸지 않습니다.</b>
           나중에 숨기기를 넣게 되면 그때 이 자리에 더하면 됩니다. */
      if (cat.big === 'community' || cat.noHidden) {
        q += '&order=created_at.desc,id.desc';
      } else {
        q += '&hidden=not.is.true&order=created_at.desc,id.desc';
      }
    }
    q += '&limit=' + ROWS_MAX;

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
    /* ★ ROWS 줄까지 보이고, 남은 것은 <b>숨겨 둡니다.</b>
       뒤에 키를 맞출 때 하나씩 켭니다(oc-my-more-row). */
    var lis = rows.length
      ? rows.map(function (x, i) {
          return '<li' + (i >= ROWS ? ' class="oc-my-hid"' : '') + '>'
            + '<a href="' + esc(cat.view || cat.href)
            + (cat.view ? ('?id=' + encodeURIComponent(x.id)) : '') + '">'
            + esc(x.t) + '</a>'
            + '<span class="dt">' + esc(fmtDate(x.d)) + '</span></li>';
        }).join('')
      : '<li class="oc-my-none"><span>아직 올라온 것이 없습니다</span></li>';

    /* ★ <b>내 관심분야임을 표시합니다.</b>
       (2026-08-04 · 파트너 제안)

       표시가 없으면 「어느 것이 내가 고른 것인지」 알 수 없습니다.
       원래 칸과 섞여 있으니 더 그렇습니다.

     ★ <b>조용하게</b> 둡니다 — 제목 옆에 작은 별 하나입니다.
       크게 두면 아홉 칸 가운데 몇 개가 도드라져 짜임이 어수선해집니다.
       그리고 목록 글자를 가려서는 안 됩니다.
     ★ title 을 붙여 마우스를 올리면 뜻이 나옵니다. */
    return '<div class="col-block oc-my-block">'
      + '<div class="sec-head"><div class="t">'
      +   '<span class="en-s">' + esc(cat.en || '') + '</span>'
      +   '<span class="ko">' + esc(cat.label) + '</span>'
      +   '<span class="oc-my-tag" title="내 관심분야로 담아 두신 갈래입니다">'
      +     '<i>★</i>내 관심분야</span>'
      + '</div><a class="more en" href="' + esc(cat.href) + '">VIEW MORE +</a></div>'
      + '<ul class="list" style="margin-top:12px">' + lis + '</ul>'
      + '</div>';
  }

  /* ── 알림 줄 ───────────────────────────────────────────── */
  function moreLine(total) {
    if (total <= MAX) return '';
    return '<div class="oc-my-more">'
      + '담은 것 <b>' + total + '개</b> 가운데 <b>앞 ' + MAX + '개</b>를 놓았습니다'
      + ' · 나머지는 <b>순서를 올리면</b> 나옵니다'
      + ' <a href="/account/interests.html">순서 바꾸기 →</a>'
      + '</div>';
  }

  /* ── 두 줄기 키 맞추기 ─────────────────────────────────────
     ★ 왜 필요한가 (2026-08-04 · 파트너 지적)
       왼쪽·오른쪽 줄기의 칸들이 키가 달라서, 한쪽이 먼저 끝나면
       <b>아래에 빈 자리</b>가 생깁니다. 갈래마다 글 수도 다르고,
       원래 칸에는 대표 카드가 있어 더 큽니다.

     ★ <b>짧은 쪽의 내 칸에 숨겨 둔 줄을 하나씩 켭니다.</b>
       미리 넉넉히 받아 두었으므로 통신이 늘지 않습니다.
     ★ 원래 칸은 건드리지 않습니다 — 그쪽 짜임을 흐트리면 안 됩니다.
     ★ 40번까지만 손봅니다 — 켤 줄이 없으면 그대로 둡니다. 완벽하게
       맞추는 것보다 <b>눈에 거슬리지 않을 만큼</b>이면 됩니다. */
  function balanceColumns() {
    var c1 = document.querySelector('.board-main .col-1');
    var c2 = document.querySelector('.board-main .col-2');
    if (!c1 || !c2) return;

    /* 좁은 화면에서는 두 줄기가 <b>위아래로</b> 놓이므로 맞출 것이 없습니다 */
    if ((window.innerWidth || 0) <= 980) return;

    /* ★ <b>내용의 끝 위치</b>를 잽니다.
       col-1·col-2 는 격자 칸이라 <b>늘 같은 키</b>로 늘어납니다 —
       그것을 재면 언제나 차이가 0 으로 나와 아무것도 못 맞춥니다.
       마지막 칸의 아래 끝을 재야 실제로 어디까지 채워졌는지 알 수 있습니다. */
    function endOf(col) {
      var bs = col.querySelectorAll('.col-block');
      if (!bs.length) return 0;
      return bs[bs.length - 1].getBoundingClientRect().bottom;
    }

    /* ★ <b>양쪽으로</b> 맞춥니다.
       짧은 쪽에 켤 줄이 없을 때도 있습니다 — 그 갈래에 글이 몇 건뿐이면
       숨겨 둘 것이 애초에 없습니다. 그때는 <b>긴 쪽을 줄입니다.</b>
       (2026-08-04 · 「셋만 담음」 에서 181px 가 남아 알았습니다)

     ★ ROWS(7줄) 아래로는 줄이지 않습니다 — 너무 적으면 칸이 초라해집니다. */
    function lastMineBlock(col) {
      var bs = col.querySelectorAll('.oc-my-block');
      return bs.length ? bs[bs.length - 1] : null;
    }

    for (var step = 0; step < 60; step++) {
      var d = endOf(c1) - endOf(c2);
      if (Math.abs(d) < 40) break;                 /* 40px 안이면 눈에 안 띕니다 */
      var short = (d > 0) ? c2 : c1;
      var tall  = (d > 0) ? c1 : c2;

      /* ① 짧은 쪽에 숨은 줄이 있으면 켭니다 */
      var hid = short.querySelector('.oc-my-block .oc-my-hid');
      if (hid) { hid.classList.remove('oc-my-hid'); continue; }

      /* ② 없으면 긴 쪽의 <b>마지막 내 칸</b>에서 줄을 되감춥니다 */
      var blk = lastMineBlock(tall);
      if (!blk) break;
      var vis = blk.querySelectorAll('.list > li:not(.oc-my-hid):not(.oc-my-none)');
      if (vis.length <= ROWS_MIN) break;           /* 넷 아래로는 줄이지 않습니다 */
      vis[vis.length - 1].classList.add('oc-my-hid');
    }
  }

  /* 창 크기가 바뀌면 다시 맞춥니다 — 폭에 따라 줄바꿈이 달라집니다 */
  (function watchResize(){
    var t = null;
    window.addEventListener('resize', function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; balanceColumns(); }, 250);
    });
  })();

  /* 알림 줄 놓기 — 격자 밖에 둡니다(.wrap 이 격자라 안에 넣으면 밀립니다) */
  function addMoreLine(total) {
    var more = moreLine(total);
    if (!more) return;
    var sec = document.querySelector('section.board');
    if (!sec || document.querySelector('.oc-my-more')) return;
    var dd = document.createElement('div');
    dd.className = 'oc-my-bar-host';
    dd.innerHTML = more;
    sec.parentNode.insertBefore(dd, sec.nextSibling);
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
  /* ── 상단 띠를 <b>없앴습니다</b> (2026-08-05 · 파트너 지시) ──────────
     예전에는 메인 위에 띠를 놓아
       「나의 메인 · 관심분야 3개를 앞자리에 놓았습니다  [관심분야 관리][First Main]」
       「오퍼스클램 메인을 보고 있습니다  [나의 메인으로]」
     를 보여 주었습니다. 그 내용은 <b>이너스페이스</b>로 옮겼습니다 —
       · 회원정보 카드 아래 「나의 메인 · 관심분야 N개…」 줄
       · 맨 위 [First Main] 단추
     띠가 하나 더 있으면 메인 짜임이 어수선하고, 이 정보는 「내 것」이라
     이너스페이스가 제자리입니다.

     ★ <b>만들지 않습니다</b> — CSS 로 감추면 언제든 되살아납니다.
     ★ 함께 없앤 것 : bar() · mountBar() · showFirst() · showMy()
       (모드 바꾸기는 이너스페이스가 맡습니다)
     ★ home.html 의 .oc-my-bar 스타일은 그대로 두었습니다 —
       .oc-my-bar-host 는 아래 addMoreLine() 이 아직 씁니다. */

  /* ── 시작 ───────────────────────────────────────────────── */
  async function start() {
    var I = window.OCInterests;
    if (!I) return;

    var me = await I.me();
    if (!me) return;                    /* 로그인 안 함 — 그대로 둡니다 */

    var mine = await I.list(true);
    if (!mine.length) {
      /* 담은 것이 없으면 <b>권하는 줄</b>만 놓습니다. 메인은 그대로 둡니다. */
      /* ★ 권유 줄도 놓지 않습니다 — 이너스페이스에서 권합니다. */
      return;
    }

    /* 「First Main」 을 골라 두었으면 원래 메인을 보여 줍니다 */
    var mode = 'my';
    try { if (sessionStorage.getItem(KEY_MODE) === 'first') mode = 'first'; } catch (e) {}
    if (mode === 'first') return;   /* ★ 띠를 놓지 않습니다 — 이너스페이스가 알려 줍니다 */

    saveOrig();
    if (!boardMain) return;

    /* ★ <b>원래 칸을 하나씩 갈아 끼웁니다.</b>

       왜 이렇게 바꿨나 (2026-08-04 · 파트너 제안)
         예전에는 담은 것<b>만</b> 놓았습니다. 그래서 담은 것이 한두 개면
         화면이 <b>텅 비어</b> 보였습니다.

         이제는 원래 아홉 칸을 그대로 두고, 담은 갈래가 <b>앞에서부터
         하나씩</b> 갈아 끼웁니다 —
           담은 것 0개  →  원래 아홉 칸 그대로
           담은 것 1개  →  첫 칸만 바뀌고 여덟 칸은 그대로
           담은 것 6개  →  여섯 칸 바뀌고 세 칸은 그대로

         빈 자리가 안 생기고, <b>담지 않은 갈래도 계속 보여</b>
         우연한 발견이 있습니다. 광고 자리도 저절로 남습니다.

       ★ 끼우는 순서는 <b>왼쪽 위부터 지그재그</b>입니다 —
         col-1 첫 칸 → col-2 첫 칸 → col-1 둘째 → col-2 둘째 …
         사람은 왼쪽 위부터 보므로, 담은 순서가 그 순서와 맞아야 합니다.

       ★ <b>이미 원래 칸에 있는 갈래는 건드리지 않습니다.</b>
         「핫토픽」 을 담았는데 원래 칸에도 핫토픽이 있으면 두 번 나옵니다.
         그 자리는 그대로 두고 다음 자리에 끼웁니다. */

    /* ① 원래 칸들을 모으고, 각자 어느 갈래인지 알아냅니다.
       VIEW MORE 링크의 주소로 찾습니다 — 그것이 그 게시판 주소입니다. */
    var slots = [];
    ['.col-1', '.col-2'].forEach(function (sel, ci) {
      var col = boardMain.querySelector(sel);
      if (!col) return;
      [].slice.call(col.querySelectorAll('.col-block')).forEach(function (el, ri) {
        var a2 = el.querySelector('.sec-head .more');
        var href = a2 ? (a2.getAttribute('href') || '') : '';
        var cat = null;
        for (var k = 0; k < (I.CATS || []).length; k++) {
          if (I.CATS[k].href === href) { cat = I.CATS[k]; break; }
        }
        slots.push({ el: el, col: ci, row: ri, cat: cat });
      });
    });
    if (!slots.length) return;

    /* ② 지그재그로 늘어놓습니다 — col-1[0] · col-2[0] · col-1[1] · col-2[1] … */
    var order = slots.slice().sort(function (a2, b2) {
      if (a2.row !== b2.row) return a2.row - b2.row;
      return a2.col - b2.col;
    });

    /* ③ 담은 갈래 — 앞 여섯 개, 목록을 가져올 수 있는 것만 */
    var want = mine.slice(0, MAX).map(function (x) {
      return I.find(x.big, x.key);
    }).filter(function (c) { return c && c.tb; });
    if (!want.length) return;

    /* ④ 이미 그 갈래가 놓인 자리는 <b>그대로 둡니다</b> */
    var already = {};
    order.forEach(function (sl) {
      if (sl.cat) already[sl.cat.big + '|' + sl.cat.key] = sl;
    });

    /* ★ <b>광고 아래 고정 자리</b>에 있는 갈래도 끼우지 않습니다.
       (2026-08-04 · 파트너 지적)

       광고 아래에는 리쿠르트·유틸리티·입시요강이 <b>따로</b> 있습니다
       (section.lower). 그것은 board-main 밖이라 제 코드가 못 봅니다.
       그래서 「유틸리티」 를 담으면 <b>위에도 아래에도</b> 나왔습니다.

       ★ 화면 어디든 그 게시판 링크가 이미 있으면 끼우지 않습니다 —
         같은 것을 두 번 보여 줄 값이 없습니다. */
    var fixed = {};
    (I.CATS || []).forEach(function (c) {
      if (!c.href) return;
      /* board-main 밖에서 그 주소를 쓰는 칸이 있나 */
      var out = document.querySelectorAll('a.more[href="' + c.href + '"]');
      for (var i2 = 0; i2 < out.length; i2++) {
        if (!boardMain.contains(out[i2])) { fixed[c.big + '|' + c.key] = true; break; }
      }
    });

    var todo = want.filter(function (c) {
      return !already[c.big + '|' + c.key] && !fixed[c.big + '|' + c.key];
    });

    /* ★ <b>이미 원래 칸에 있는 갈래에도 표시를 붙입니다.</b>
       (2026-08-04 · 파트너 지적)

       「각 분야별 악보」 를 담았는데 원래 칸에도 그것이 있어서, 제 코드가
       「이미 있으니 건드리지 않는다」 고 판단했습니다. 내용은 맞지만
       <b>표시가 없어</b> 회원 입장에서는 「담았는데 표시가 없네?」 가 됩니다.

       ★ 내용은 그대로 두고 <b>표시만</b> 붙입니다 — 원래 칸에는 대표
         사진이 있는 경우가 많은데, 그것을 지우면 오히려 심심해집니다. */
    want.forEach(function (c) {
      var sl = already[c.big + '|' + c.key];
      if (!sl || !sl.el) return;
      var t = sl.el.querySelector('.sec-head .t');
      if (!t || t.querySelector('.oc-my-tag')) return;
      var tag = document.createElement('span');
      tag.className = 'oc-my-tag';
      tag.title = '내 관심분야로 담아 두신 갈래입니다';
      tag.innerHTML = '<i>&#9733;</i>내 관심분야';
      t.appendChild(tag);
    });

    /* 고정 자리(리쿠르트·유틸리티)에도 담은 것이 있으면 표시합니다 —
       지금은 목록에서 뺐으므로 걸릴 일이 없지만, 뒤에 되살릴 때를
       대비해 둡니다. */
    want.forEach(function (c) {
      if (!fixed[c.big + '|' + c.key] || !c.href) return;
      var links = document.querySelectorAll('a.more[href="' + c.href + '"]');
      for (var i3 = 0; i3 < links.length; i3++) {
        if (boardMain.contains(links[i3])) continue;
        var head = links[i3].parentNode;
        var t2 = head && head.querySelector('.t');
        if (!t2 || t2.querySelector('.oc-my-tag')) continue;
        var tag2 = document.createElement('span');
        tag2.className = 'oc-my-tag';
        tag2.title = '내 관심분야로 담아 두신 갈래입니다';
        tag2.innerHTML = '<i>&#9733;</i>내 관심분야';
        t2.appendChild(tag2);
      }
    });

    /* ⑤ 갈아 끼울 자리 — <b>담은 갈래가 아닌</b> 칸을 앞에서부터 */
    var free = order.filter(function (sl) {
      return !sl.cat || !want.some(function (c) {
        return c.big === sl.cat.big && c.key === sl.cat.key;
      });
    });

    var pairs = [];
    for (var i = 0; i < todo.length && i < free.length; i++) {
      pairs.push({ slot: free[i], cat: todo[i] });
    }
    /* ★ 갈아 끼울 것이 없어도 <b>띠와 표시는 남겨야</b> 합니다 —
       담은 것이 다 원래 칸에 있는 경우입니다. */
    if (!pairs.length) { addMoreLine(mine.length); return; }

    /* ⑥ 글을 한꺼번에 가져옵니다 — 하나씩 기다리면 느립니다 */
    var got = await Promise.all(pairs.map(function (p2) { return fetchRows(p2.cat); }));

    /* ⑦ 갈아 끼웁니다. <b>그 칸만</b> 바꾸므로 광고·나머지 칸은 그대로 남습니다. */
    pairs.forEach(function (p2, i) {
      var box = document.createElement('div');
      box.innerHTML = blockHtml(p2.cat, got[i] || []);
      var node = box.firstChild;
      if (node && p2.slot.el.parentNode) {
        p2.slot.el.parentNode.replaceChild(node, p2.slot.el);
      }
    });

    /* 알림 줄과 띠 */
    /* 알림 줄도 이너스페이스로 옮깁니다 */
    /* ★ 띠를 없앴습니다 (2026-08-04 · 파트너 지시)
       「나의 메인 · 관심분야 3개를 …」 띠는 <b>INNER SPACE 로 옮깁니다.</b>
       메인 위에 띠가 하나 더 있으면 짜임이 어수선하고, 그 기능(관심분야
       관리 · First Main)은 이너스페이스 안에 있는 편이 자연스럽습니다. */
    /* 알림 줄도 이너스페이스로 옮깁니다 */
    balanceColumns();
  }

  /* interests.js 가 늦게 실릴 수 있으므로 기다립니다 */
  (function wait(n) {
    if (window.OCInterests) { start(); return; }
    if (n > 40) return;
    setTimeout(function () { wait(n + 1); }, 100);
  })(0);
})();
