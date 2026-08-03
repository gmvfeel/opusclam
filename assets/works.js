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
       awardsBox: '#pvAwards'    // 수상을 그릴 자리 (없으면 생략)
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

      if (wb) drawWorks(wb, W || []);
      drawAwards(ab, A || []);
    }
  };

  window.OCWorks = OCWorks;
})();
