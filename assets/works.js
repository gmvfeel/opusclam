/* ============================================================
   OPUSCLAM — 작품 · 수상 목록 엔진   assets/works.js

   무엇을 하는가
     person_works · person_awards 를 읽어 인물 상세 화면에 그립니다.

   ★ 왜 별도 파일인가
     뒤에 OPUSFINE(시각예술판)을 같은 구조로 만듭니다. 그때
     「작품 목록」 은 그대로 쓰이는 자산입니다. 화면 안에 적어 두면
     옮길 수 없으니 처음부터 밖으로 냅니다.
     표 이름과 자리만 config 로 받습니다.

   ★ 100곡이 넘는 인물이 있습니다 (아놀드 쿡 124곡 · 하랄트 겐츠머
     113곡 · 예로니마스 카친스카스 105곡). 한 번에 다 펴면 화면이
     끝없이 길어져 아래의 사진·영상·관련인물을 아무도 보지 못합니다.
     그래서 <b>분야별로 묶고, 분야마다 처음 8곡만</b> 보여 준 뒤
     「더 보기」 로 펼칩니다.

   ★ 자료가 없으면 <b>영역을 통째로 감춥니다.</b> 빈 제목만 남으면
     고장으로 보입니다 (이 화면의 다른 영역도 같은 방식입니다).

   쓰는 법
     OCWorks.mount({
       personId : 123,
       worksBox : '#pvWorks',    // 작품을 그릴 자리
       awardsBox: '#pvAwards',   // 수상을 그릴 자리 (없으면 생략)
       scoresBox: '#pvScores',   // 악보를 그릴 자리 (없으면 생략)
       personName: '루트비히 판 베토벤'  // 「더 보기」 링크에 쓸 이름
     });
   ============================================================ */
(function () {

/* ── 숫자가 섞인 글 (2026-08-15) ──────────────────────────────
   ★ 「전체 206건」처럼 숫자와 글자가 붙은 문장은 사전이 통짜로는
     알아보지 못해, 영어·일본어 화면에서 한국어로 남았습니다.
     OCI18N.n 에 자리표를 넘겨 언어마다 어순을 달리 둡니다.
   ★ i18n.js 가 아직 안 실렸을 때를 대비해 원문에 값만 채웁니다. */
function ocN(tpl) {
  var vals = [].slice.call(arguments, 1);
  try {
    if (window.OCI18N && window.OCI18N.n) return window.OCI18N.n.apply(null, arguments);
  } catch (e) {}
  return String(tpl).replace(/\{(n|\d+)\}/g, function (m, k) {
    var v = (k === 'n') ? vals[0] : vals[Number(k)];
    return (v === undefined || v === null) ? m : String(v);
  });
}
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H   = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  /* 분야를 보여 줄 순서 — 규모가 큰 것부터, 그리고 서로 가까운 것끼리 */
  var ORDER = ['관현악', '교향악', '협주곡', '실내악', '건반', '피아노', '독주', '기타',
               '전자음악', '성악', '합창', '오르간·교회음악', '무대 · 오페라', '무대',
               '관악', '영화·방송'];
  var FIRST = 8;          /* 분야마다 처음 몇 곡을 보여 줄지 */

  /* ★ 2026-08-08 분야 값이 두 가지 말로 섞여 있습니다 ──────────
     · 기존 wixon 자료 1,022개 → 한국어 (관현악 · 교향악 …)
     · Open Opus 로 채운 것    → 영어  (Orchestral · Keyboard …)

     한국어 화면에 영어 제목이 그대로 뜨고 있었습니다. 그리고 위
     ORDER 는 한국어라서 영어 분야는 모두 순서 뒤로 밀렸습니다.

     ★ 값을 고치지 않고 <b>보일 때만</b> 옮깁니다. 표의 값을 손대면
       work.html 의 필터(실제 값으로 채우는 oc_work_facets)와
       어긋납니다. 화면에서만 한국어로 보이면 됩니다.
     ★ 이 표는 db/work-view.html 의 GKO 와 같은 값이어야 합니다.
       한쪽만 고치면 두 화면의 분야 이름이 달라집니다. */
  var GKO = {
    Orchestral: '관현악',
    Keyboard  : '건반',
    Chamber   : '실내악',
    Stage     : '무대 · 오페라',
    Vocal     : '성악'
  };
  function genreKo(g) {
    if (!g) return '';
    g = String(g).trim();
    return GKO[g] || g;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function hideSection(el) {
    if (!el) return;
    /* ★ 이 화면의 영역은 .pv-sec 과 .pv-block 두 가지입니다.
       하나만 찾으면 어떤 화면에서는 감춰지지 않습니다. */
    var sec = el.closest('.pv-sec, .pv-block');
    if (sec) sec.style.display = 'none';
    else el.innerHTML = '';
  }

  async function get(q) {
    var r = await fetch(SB + '/rest/v1/' + q, { headers: H });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ── 나눠 받기 ───────────────────────────────────────────────
     ★ PostgREST 는 <b>한 번에 200개까지만</b> 줍니다. limit=2000 을
       줘도 200개만 옵니다. 그래서 바흐(1,000곡 넘음) 상세에서
       <b>작품이 200곡만 보이고 있었습니다.</b> 화면에는 「전체
       목록」 이라 적혀 있어 사실과 달랐습니다.

     ★ 끝냄 조건을 <b>0개일 때만</b> 으로 둡니다.
       「받은 수 &lt; 요청한 수」 로 하면 200개를 받은 첫 바퀴에서
       바로 멈춥니다(2026-08-07 에 이 실수를 두 번 했습니다).
     ★ offset 은 <b>실제로 받은 수만큼</b> 넘깁니다.

     guard 30 바퀴 = 6,000곡까지. 가장 많은 바흐가 1,000곡대이므로
     넉넉합니다. 끝없이 도는 것을 막는 안전장치입니다. */
  var PAGE = 200;
  async function getAll(base) {
    var out = [], off = 0, guard = 0;
    while (guard++ < 30) {
      var rows = await get(base + '&limit=' + PAGE + '&offset=' + off);
      if (!rows || !rows.length) break;      /* 0개일 때만 끝냅니다 */
      out = out.concat(rows);
      off += rows.length;                    /* 실제로 받은 수만큼 */
    }
    return out;
  }

  /* ── 작품 한 줄 ──────────────────────────────────────────────
     ★ 2026-08-08 <b>제목을 작품DB 상세로 가는 문</b>으로 바꿨습니다.
       그 전에는 글자만 있어서 눌러도 아무 일이 없었습니다. 어제
       db/work-view.html 을 만들었는데 <b>인물DB 쪽에는 들어가는 길이
       없었습니다.</b> 이제 인물 → 작품 → IMSLP 악보로 이어집니다.

     ★ 왜 줄 전체가 아니라 <b>제목만</b> 링크인가
       .wk-it 은 &lt;li&gt; 에 붙은 flex 짜임입니다. 줄 전체를 &lt;a&gt; 로
       바꾸면 &lt;ul&gt; 의 자식이 &lt;li&gt; 가 아니게 되어 규칙에 어긋나고,
       기존 CSS 를 손대야 합니다. 제목만 링크로 하면 <b>짜임을 하나도
       건드리지 않습니다.</b>

     ★ id 가 없으면 글자로 남깁니다 — 링크가 깨진 곳으로 가는 것보다
       눌리지 않는 편이 낫습니다. */
  function workRow(w) {
    var meta = [];
    /* ★ 형식을 맨 앞에 둡니다 — 「소나타」 「오페라」 처럼 무엇인지
       알려주는 말이 작품번호보다 먼저 눈에 들어와야 합니다. */
    if (w.form_ko)   meta.push(esc(w.form_ko));
    if (w.opus)      meta.push(esc(w.opus));
    if (w.year_text) meta.push(esc(w.year_text));

    var t = esc(w.title_ko || w.title);
    var title = w.id
      ? '<a class="wk-t" href="/db/work-view.html?id='
        + encodeURIComponent(w.id) + '">' + t + '</a>'
      : '<span class="wk-t">' + t + '</span>';

    /* IMSLP 번호가 있으면 악보로 바로 갑니다. 위키데이터 P839 값이
       그대로 IMSLP 문서 이름입니다 — 검색을 거치지 않습니다. */
    var sc = w.imslp_ref
      ? '<a class="wk-sc" href="https://imslp.org/wiki/'
        + encodeURIComponent(w.imslp_ref)
        + '" target="_blank" rel="noopener">악보</a>'
      : '';

    /* ★ 찾기에 쓸 글자를 줄에 심어 둡니다.
       1,266곡이 한 묶음에 있는 작곡가가 있어(헨델) 눈으로는 찾을
       수 없습니다. 서버에 다시 묻지 않고 이 글자로 걸러냅니다. */
    var s = [w.title_ko, w.title, w.opus, w.form_ko, w.note]
      .filter(Boolean).join(' ').toLowerCase();

    return ''
      + '<li class="wk-it" data-s="' + esc(s) + '">'
      +   title
      +   (w.title_ko && w.title
          ? '<span class="wk-orig">' + esc(w.title) + '</span>' : '')
      +   (meta.length ? '<span class="wk-m">' + meta.join(' · ') + '</span>' : '')
      +   sc
      +   (w.note ? '<span class="wk-n">' + esc(w.note) + '</span>' : '')
      + '</li>';
  }

  /* ── 분야 묶음 ──────────────────────────────────────────── */
  function group(name, list) {
    var head = list.slice(0, FIRST);
    var rest = list.slice(FIRST);
    return ''
      + '<div class="wk-g" data-g="' + esc(name) + '">'
      +   '<div class="wk-ghead">'
      +     '<b>' + esc(name) + '</b>'
      +     '<span class="wk-cnt">' + list.length + '</span>'
      +   '</div>'
      +   '<ul class="wk-list">' + head.map(workRow).join('') + '</ul>'
      +   (rest.length
          ? '<ul class="wk-list wk-more" hidden>' + rest.map(workRow).join('') + '</ul>'
            + '<button type="button" class="wk-btn" data-more>'
            + '나머지 ' + rest.length + '곡 더 보기</button>'
          : '')
      + '</div>';
  }

  function drawWorks(box, rows) {
    if (!rows.length) { hideSection(box); return; }

    /* 분야별로 묶습니다. 분야가 없는 것은 마지막에 「그 밖」 으로

       ★ 묶기 전에 <b>한국어로 옮겨서</b> 묶습니다. 한 작곡가에게
         Orchestral 과 관현악이 함께 있을 수 있습니다(기존 자료 +
         Open Opus). 값대로 묶으면 <b>「관현악」 묶음이 두 개</b>
         나옵니다. data-g 는 아무 곳에서도 읽지 않으므로 안전합니다.

       ★ 2026-08-08 편성이 없으면 <b>형식</b>으로 묶습니다.
         편성이 비어 있는 작품이 69% 입니다(Open Opus 가 널리 알려진
         작곡가 백 명 남짓만 다루기 때문입니다). 그대로 두면 헨델이
         「그 밖 1,266곡」 한 덩어리가 됩니다.
         형식이라도 있으면 「오페라」 「판본」 으로 갈라집니다.
         ※ 다만 형식도 31% 만 얻어지므로 이것으로 다 풀리지는
           않습니다. 그래서 아래에 <b>찾기</b>를 함께 둡니다. */
    var bag = {};
    rows.forEach(function (w) {
      var g = genreKo(w.genre)
           || (w.form_ko ? String(w.form_ko).trim() : '')
           || '그 밖';
      (bag[g] = bag[g] || []).push(w);
    });

    var names = Object.keys(bag).sort(function (a, b) {
      var ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      if (ia < 0) ia = 90; if (ib < 0) ib = 90;
      if (a === '그 밖') ia = 99;
      if (b === '그 밖') ib = 99;
      if (ia !== ib) return ia - ib;
      return bag[b].length - bag[a].length;
    });

    /* 분야 안에서는 연도 순 — 연도가 없는 것은 뒤로 */
    names.forEach(function (n) {
      bag[n].sort(function (a, b) {
        var ya = a.year_from == null ? 9999 : a.year_from;
        var yb = b.year_from == null ? 9999 : b.year_from;
        if (ya !== yb) return ya - yb;
        return String(a.title).localeCompare(String(b.title));
      });
    });

    /* ★ 찾기 상자 — 곡이 많은 작곡가에게만 붙입니다.
       헨델 1,370곡 · 바흐 884곡 · 모차르트 852곡. 눈으로는 찾을
       수 없습니다. 서버에 다시 묻지 않고 이미 받은 것을 걸러내므로
       비용이 들지 않고 곧바로 반응합니다. */
    var withFind = rows.length > 30;

    box.innerHTML = ''
      + '<p class="wk-sum">모두 <b>' + rows.length + '</b>곡 · '
      +   names.map(function (n) { return esc(n) + ' ' + bag[n].length; }).join(' · ')
      + '</p>'
      + (withFind
        ? '<div class="wk-find">'
          + '<input type="search" class="wk-fi" placeholder="곡 이름 · 작품번호 · 형식으로 찾기"'
          + ' aria-label="이 작곡가의 작품 안에서 찾기">'
          + '<span class="wk-fc" hidden></span>'
          + '</div>'
        : '')
      + names.map(function (n) { return group(n, bag[n]); }).join('');

    /* 「더 보기」 — 한 번만 붙입니다 */
    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-more]');
        if (!b) return;
        var g = b.closest('.wk-g');
        var more = g && g.querySelector('.wk-more');
        if (!more) return;
        if (more.hidden) { more.hidden = false; b.textContent = '접기'; }
        else {
          more.hidden = true;
          b.textContent = '나머지 ' + more.querySelectorAll('.wk-it').length + '곡 더 보기';
        }
      });
    }

    if (withFind) bindFind(box);
  }

  /* ── 작품 안에서 찾기 ─────────────────────────────────────
     ★ 서버에 다시 묻지 않습니다. 이미 받은 줄에 심어 둔
       data-s 글자로 걸러냅니다.
     ★ 찾는 동안에는 <b>접힌 것을 펴야</b> 합니다. 그러지 않으면
       접힌 자리에 있는 결과가 보이지 않아 「없다」 고 오해합니다.
       찾기를 지우면 원래대로 접습니다.
     ★ 사이 시간을 둡니다(120ms) — 1,300곡을 글자마다 훑으면
       입력이 뻑뻑해집니다. */
  function bindFind(box) {
    var inp = box.querySelector('.wk-fi');
    var cnt = box.querySelector('.wk-fc');
    if (!inp) return;
    var timer = null;

    function run() {
      var q = String(inp.value || '').trim().toLowerCase();
      var groups = box.querySelectorAll('.wk-g');
      var hitAll = 0;

      groups.forEach(function (g) {
        var shown = 0;
        g.querySelectorAll('.wk-it').forEach(function (li) {
          var hit = !q || (li.getAttribute('data-s') || '').indexOf(q) >= 0;
          li.style.display = hit ? '' : 'none';
          if (hit) shown += 1;
        });

        var more = g.querySelector('.wk-more');
        var btn  = g.querySelector('[data-more]');
        if (more) {
          if (q) { more.hidden = false; if (btn) btn.style.display = 'none'; }
          else {
            more.hidden = true;
            if (btn) {
              btn.style.display = '';
              btn.textContent = '나머지 ' + more.querySelectorAll('.wk-it').length + '곡 더 보기';
            }
          }
        }

        var head = g.querySelector('.wk-cnt');
        if (head && q) head.textContent = shown;
        else if (head) head.textContent = g.querySelectorAll('.wk-it').length;

        g.style.display = shown ? '' : 'none';
        hitAll += shown;
      });

      if (cnt) {
        if (q) { cnt.hidden = false; cnt.textContent = hitAll + '곡'; }
        else { cnt.hidden = true; cnt.textContent = ''; }
      }
    }

    inp.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 120);
    });
  }

  /* ★ 수상 갈래를 보여줄 순서 — 콩쿠르가 맨 앞입니다.
       연주자에게 <b>콩쿠르 입상이 가장 중요한 이력</b>이고,
       훈장·명예칭호는 뒤에 오는 것이 자연스럽습니다.
     ★ 값은 oc_award_kinds 표의 kind 와 같아야 합니다. */
  var AW_ORDER = ['competition', 'prize', 'order', 'fellowship', 'honorary', 'other'];
  var AW_KO = {
    competition: '콩쿠르',
    prize      : '수상',
    order      : '훈장 · 기사단',
    fellowship : '회원 · 펠로십',
    honorary   : '명예직 · 칭호',
    other      : '그 밖'
  };

  function drawAwards(box, rows) {
    if (!box) return;
    if (!rows.length) { hideSection(box); return; }

    /* ★ 2026-08-08 갈래별로 묶습니다.
         한 인물에게 훈장 · 공로상 · 콩쿠르가 뒤섞여 수십 줄이 되면
         무엇이 중요한 이력인지 알 수 없습니다.
       ★ 갈래가 없는 것(사람이 손으로 적은 옛 자료)은 「그 밖」 으로
         갑니다 — 버리지 않습니다. */
    var bag = {};
    rows.forEach(function (a) {
      var k = String(a.kind || 'other').trim() || 'other';
      if (AW_ORDER.indexOf(k) < 0) k = 'other';
      (bag[k] = bag[k] || []).push(a);
    });

    /* 갈래 안에서는 연도 순 — 연도가 없는 것은 뒤로 */
    Object.keys(bag).forEach(function (k) {
      bag[k].sort(function (a, b) {
        var ya = a.year == null ? 9999 : a.year;
        var yb = b.year == null ? 9999 : b.year;
        if (ya !== yb) return ya - yb;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
    });

    var out = [];
    AW_ORDER.forEach(function (k) {
      var list = bag[k];
      if (!list || !list.length) return;
      /* 갈래가 하나뿐이면 제목을 붙이지 않습니다 — 군더더기입니다 */
      var only = Object.keys(bag).length === 1;
      if (!only) {
        out.push('<div class="wk-awh"><b>' + esc(AW_KO[k] || k) + '</b>'
               + '<span class="wk-cnt">' + list.length + '</span></div>');
      }
      out.push('<ul class="wk-aw">' + list.map(function (a) {
        /* ★ 한국어 이름이 있으면 그것을, 없으면 영문 그대로.
             지어내지 않습니다. */
        var t = a.title_ko || a.title;
        return '<li>'
          + '<span class="wk-ay">' + esc(a.year_text || a.year || '') + '</span>'
          + '<span class="wk-at">' + esc(t) + '</span>'
          + (a.org ? '<span class="wk-ao">' + esc(a.org) + '</span>' : '')
          + '</li>';
      }).join('') + '</ul>');
    });
    box.innerHTML = out.join('');
  }

  /* ── 이 작곡가의 악보 ─────────────────────────────────────
     ★ 왜 인물 상세에 놓는가
       악보 게시판(정보SPOT)에 담을 때 person_id 를 함께 넣어 두었습니다.
       그래서 「베토벤」 을 보다가 <b>그 자리에서</b> 악보로 갈 수 있습니다.
       사람은 작곡가를 먼저 떠올리고 악보를 찾습니다 — 게시판을 따로
       찾아 들어가 이름으로 검색하는 것보다 훨씬 자연스럽습니다.

     ★ 승인된 것만 보여 줍니다 (review_status='approved').
     ★ 파일이 있는 것은 <b>회원만</b> 내려받습니다 — score-dl.js 가
       로그인을 확인하고 임시 주소를 만듭니다.
       IMSLP 링크만 있는 것은 누구나 갈 수 있습니다. */
  function scoreRow(r) {
    var meta = [];
    if (r.score_opus)  meta.push(esc(r.score_opus));
    if (r.category)    meta.push(esc(r.category));
    if (r.score_pages) meta.push(esc(r.score_pages) + '쪽');

    /* 내려받기 · 보기 단추 — 우리 파일이면 회원만, IMSLP 면 바로 */
    var act = '';
    if (r.file_url) {
      act = '<button type="button" class="sc-dl" data-url="' + esc(r.file_url) + '"'
          + ' data-name="' + esc(r.file_name || '') + '" data-id="' + esc(r.id) + '">'
          + '내려받기 <i>회원</i></button>';
    } else if (r.has_link) {
      /* ★ 주소를 여기 적지 않습니다 — 적으면 비회원에게도 보입니다.
         누를 때 score-dl.js 가 회원인지 보고 주소를 받아 옵니다. */
      act = '<button type="button" class="sc-out" data-link="' + esc(r.id) + '">'
          + 'IMSLP 에서 보기 <i>회원</i></button>';
    }
    var vp = '/spot/spot-view.html?id=' + encodeURIComponent(r.id);
    return ''
      + '<li class="sc-it">'
      +   '<a class="sc-t" href="' + vp + '">' + esc(r.title_ko || r.title) + '</a>'
      +   (r.title_ko && r.title && r.title_ko !== r.title
          ? '<span class="sc-orig">' + esc(r.title) + '</span>' : '')
      +   (meta.length ? '<span class="sc-m">' + meta.join(' · ') + '</span>' : '')
      +   (act ? '<span class="sc-a">' + act + '</span>' : '')
      + '</li>';
  }

  function drawScores(box, rows, name) {
    if (!rows.length) { hideSection(box); return; }
    /* 편성별로 묶지 않습니다 — 인물 상세의 악보는 대개 몇 건에서 수십 건이라
       그냥 늘어놓는 편이 읽기 좋습니다. 많으면 접어 둡니다. */
    var FIRST = 6;
    var head = rows.slice(0, FIRST);
    var rest = rows.slice(FIRST);
    box.innerHTML = ''
      + '<p class="wk-sum">모두 <b>' + rows.length + '</b>건'
      +   (name ? ' · <a class="sc-more" href="/spot/score.html?q='
            + encodeURIComponent(name) + '">악보 게시판에서 더 보기 →</a>' : '')
      + '</p>'
      + '<ul class="sc-list">' + head.map(scoreRow).join('') + '</ul>'
      + (rest.length
        ? '<ul class="sc-list sc-more-list" hidden>' + rest.map(scoreRow).join('') + '</ul>'
          + '<button type="button" class="wk-btn" data-scmore>'
          + ocN('나머지 {n}건 더 보기', rest.length) + '</button>'
        : '');

    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        /* 더 보기 */
        var b = e.target.closest('[data-scmore]');
        if (b) {
          var more = box.querySelector('.sc-more-list');
          if (!more) return;
          if (more.hidden) { more.hidden = false; b.textContent = '접기'; }
          else {
            more.hidden = true;
            b.textContent = ocN('나머지 {n}건 더 보기', more.querySelectorAll('.sc-it').length);
          }
          return;
        }
        /* 바깥 링크 — 회원만 */
        var L = e.target.closest('.sc-out');
        if (L) {
          e.preventDefault();
          if (!window.OCScoreDL) {
            alert('내려받기 도구(assets/score-dl.js)를 불러오지 못했습니다.');
            return;
          }
          window.OCScoreDL.openLink(L.getAttribute('data-link'));
          return;
        }
        /* 내려받기 — 회원만 */
        var d = e.target.closest('.sc-dl');
        if (d) {
          e.preventDefault();
          if (!window.OCScoreDL) {
            alert('내려받기 도구(assets/score-dl.js)를 불러오지 못했습니다.');
            return;
          }
          var url = d.getAttribute('data-url');
          var nm  = d.getAttribute('data-name');
          var id  = d.getAttribute('data-id');
          window.OCScoreDL.download(url, nm).then(function (ok) {
            if (ok && id) window.OCScoreDL.countUp(id);
          });
        }
      });
    }
  }

  var OCWorks = {
    mount: async function (cfg) {
      cfg = cfg || {};
      var wb = document.querySelector(cfg.worksBox || '#pvWorks');
      var ab = cfg.awardsBox ? document.querySelector(cfg.awardsBox) : null;
      var pid = cfg.personId;
      if (!pid) { hideSection(wb); hideSection(ab); return; }

      /* 작품과 수상을 함께 물어봅니다. 한쪽이 실패해도 다른 쪽은 그립니다 */
      var W = [], A = [];
      try {
        /* ★ 2026-08-08 바뀐 곳 세 가지
             ① id · imslp_ref 를 함께 받습니다 — 제목을 작품DB 상세로
                가는 링크로 만들고, 악보로 바로 가는 단추를 붙이려면
                이 두 칸이 있어야 합니다
             ② hidden=not.is.true — 어제 person_works 에 hidden 칸을
                넣었는데 이 파일은 그것을 몰랐습니다. 어드민에서 감춘
                작품이 인물 상세에는 그대로 보이고 있었습니다.
                (is.false 로 쓰면 null 을 놓칩니다. 이 표는 not null
                 default false 라 지금은 같지만, 규칙을 지킵니다)
             ③ limit 을 빼고 나눠 받습니다 — 200개 상한 때문입니다 */
        W = await getAll('person_works?select=id,title,title_ko,opus,year_text,'
          + 'year_from,year_to,genre,note,imslp_ref,form_ko&person_id=eq.'
          + encodeURIComponent(pid)
          + '&hidden=not.is.true'
          + '&order=genre.asc,year_from.asc,id.asc');
      } catch (e) { console.error('작품을 불러오지 못했습니다:', e); }
      try {
        /* ★ 2026-08-08 바뀐 곳
             ① kind · kind_ko 를 함께 받습니다 — 훈장 · 콩쿠르 · 공로상을
                갈라 보여주기 위해서입니다
             ② hidden 을 걸러냅니다 — 어색한 한국어 라벨(「최하위
                훈작사」 같은 것)을 감출 수 있게 칸을 두었습니다
             ③ 나눠 받습니다 — 수상이 200줄을 넘는 인물이 있습니다.
                쇼스타코비치는 스탈린상만 여섯 번입니다.
                ★ order 에 id 를 넣어 바퀴마다 순서가 흔들리지 않게 합니다 */
        A = await getAll('person_awards?select=year,year_text,title,title_ko,'
          + 'org,kind,kind_ko&person_id=eq.' + encodeURIComponent(pid)
          + '&hidden=not.is.true'
          + '&order=year.asc,id.asc');
      } catch (e) { console.error('수상을 불러오지 못했습니다:', e); }

      /* 이 작곡가의 악보 — 정보SPOT 의 악보 게시판에서 가져옵니다.
         ★ 승인된 것 · 숨기지 않은 것만. 그리고 정렬에 id 를 붙입니다 —
           created_at 이 같은 줄이 있으면 순서가 흔들립니다. */
      var S = [];
      if (cfg.scoresBox) {
        try {
          /* ★ link_url 은 묻지 않습니다 — 악보 링크는 score_links 표로
             옮겼고, 그 표는 회원만 읽습니다. 여기서는 <b>링크가 있는지</b>만
             score_links 를 세어 확인합니다(비회원은 0으로 나옵니다). */
          /* ★ 2026-08-08 limit=200 은 <b>상한과 똑같은 수</b>였습니다.
             그래서 악보가 200개를 넘는 작곡가는 <b>조용히 잘려</b>
             있었는데, 잘린 것인지 원래 그만큼인지 알 수 없었습니다.
             나눠 받기로 바꿉니다. order 에 id 가 붙어 있어 바퀴마다
             순서가 흔들리지 않습니다. */
          S = await getAll('spot?select=id,title,title_ko,category,score_opus,score_pages,'
            + 'file_url,file_name,score_links(spot_id)&section=eq.' + encodeURIComponent('악보')
            + '&review_status=eq.approved&hidden=is.false'
            + '&person_id=eq.' + encodeURIComponent(pid)
            + '&order=created_at.desc,id.asc');
        } catch (e) { console.error('악보를 불러오지 못했습니다:', e); }
      }

      if (wb) drawWorks(wb, W || []);
      drawAwards(ab, A || []);
      if (cfg.scoresBox) {
        (S || []).forEach(function (r) {
          /* ★ PostgREST 는 이어진 표를 <b>관계에 따라 다른 모양</b>으로 줍니다.
             score_links.spot_id 가 기본키라 <b>1:1</b> 이므로 배열이 아니라
             <b>객체 하나</b>(또는 null)가 옵니다.
             배열로만 보면 회원인데도 링크 단추가 나오지 않습니다.
             비회원에게는 정책 때문에 아무것도 오지 않습니다. */
          var L = r.score_links;
          r.has_link = Array.isArray(L) ? L.length > 0 : !!L;
        });
        drawScores(document.querySelector(cfg.scoresBox), S || [], cfg.personName || '');
      }
    }
  };

  window.OCWorks = OCWorks;
})();
