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
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H   = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  /* 분야를 보여 줄 순서 — 규모가 큰 것부터, 그리고 서로 가까운 것끼리 */
  var ORDER = ['관현악', '교향악', '협주곡', '실내악', '피아노', '독주', '기타',
               '전자음악', '성악', '합창', '오르간·교회음악', '무대', '관악', '영화·방송'];
  var FIRST = 8;          /* 분야마다 처음 몇 곡을 보여 줄지 */

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

  /* ── 작품 한 줄 ──────────────────────────────────────────── */
  function workRow(w) {
    var meta = [];
    if (w.opus)      meta.push(esc(w.opus));
    if (w.year_text) meta.push(esc(w.year_text));
    return ''
      + '<li class="wk-it">'
      +   '<span class="wk-t">' + esc(w.title_ko || w.title) + '</span>'
      +   (w.title_ko && w.title
          ? '<span class="wk-orig">' + esc(w.title) + '</span>' : '')
      +   (meta.length ? '<span class="wk-m">' + meta.join(' · ') + '</span>' : '')
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

    /* 분야별로 묶습니다. 분야가 없는 것은 마지막에 「그 밖」 으로 */
    var bag = {};
    rows.forEach(function (w) {
      var g = w.genre || '그 밖';
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

    box.innerHTML = ''
      + '<p class="wk-sum">모두 <b>' + rows.length + '</b>곡 · '
      +   names.map(function (n) { return esc(n) + ' ' + bag[n].length; }).join(' · ')
      + '</p>'
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
  }

  function drawAwards(box, rows) {
    if (!box) return;
    if (!rows.length) { hideSection(box); return; }
    rows.sort(function (a, b) {
      var ya = a.year == null ? 9999 : a.year;
      var yb = b.year == null ? 9999 : b.year;
      return ya - yb;
    });
    box.innerHTML = '<ul class="wk-aw">' + rows.map(function (a) {
      return '<li>'
        + '<span class="wk-ay">' + esc(a.year_text || a.year || '') + '</span>'
        + '<span class="wk-at">' + esc(a.title_ko || a.title) + '</span>'
        + (a.org ? '<span class="wk-ao">' + esc(a.org) + '</span>' : '')
        + '</li>';
    }).join('') + '</ul>';
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
          + '나머지 ' + rest.length + '건 더 보기</button>'
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
            b.textContent = '나머지 ' + more.querySelectorAll('.sc-it').length + '건 더 보기';
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
        W = await get('person_works?select=title,title_ko,opus,year_text,year_from,'
          + 'year_to,genre,note&person_id=eq.' + encodeURIComponent(pid)
          + '&order=genre.asc,year_from.asc&limit=2000');
      } catch (e) { console.error('작품을 불러오지 못했습니다:', e); }
      try {
        A = await get('person_awards?select=year,year_text,title,title_ko,org'
          + '&person_id=eq.' + encodeURIComponent(pid)
          + '&order=year.asc&limit=500');
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
          S = await get('spot?select=id,title,title_ko,category,score_opus,score_pages,'
            + 'file_url,file_name,score_links(spot_id)&section=eq.' + encodeURIComponent('악보')
            + '&review_status=eq.approved&hidden=is.false'
            + '&person_id=eq.' + encodeURIComponent(pid)
            + '&order=created_at.desc,id.asc&limit=200');
        } catch (e) { console.error('악보를 불러오지 못했습니다:', e); }
      }

      if (wb) drawWorks(wb, W || []);
      drawAwards(ab, A || []);
      if (cfg.scoresBox) {
        (S || []).forEach(function (r) {
          /* PostgREST 는 이어진 표를 배열로 줍니다. 회원이면 한 줄,
             비회원이면 빈 배열입니다. */
          r.has_link = !!(r.score_links && r.score_links.length);
        });
        drawScores(document.querySelector(cfg.scoresBox), S || [], cfg.personName || '');
      }
    }
  };

  window.OCWorks = OCWorks;
})();
