/* ============================================================
   OPUSCLAM 리쿠르트 등록 현황 — assets/recruit-stats.js

   무엇을 하나
    · 서버 함수 recruit_stats() 를 <b>한 번</b> 불러
      전체·오늘·이달 건수와 일별·월별 막대를 그립니다

   왜 그림 라이브러리를 쓰지 않나
    막대 몇 개를 그리려고 100KB 넘는 라이브러리를 받아 올 까닭이
    없습니다. 높이를 백분율로 준 <div> 로 충분하고, 그렇게 하면
    화면이 어두운 모드로 바뀔 때도 저절로 따라옵니다.

   쓰는 법 — 화면에 자리표만 두면 됩니다.
     <div id="rsBox" hidden> … </div>
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

  var data = null, mode = 'daily';

  function el(s) { return document.querySelector(s); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function n(v) { return Number(v || 0).toLocaleString(); }

  function drawNums() {
    var map = {
      '#rsJobTotal': data.jobs_total, '#rsTalentTotal': data.talents_total,
      '#rsJobToday': data.jobs_today, '#rsTalentToday': data.talents_today,
      '#rsJobMonth': data.jobs_month, '#rsTalentMonth': data.talents_month,
    };
    Object.keys(map).forEach(function (k) {
      var x = el(k);
      if (x) x.textContent = n(map[k]);
    });
  }

  function drawChart() {
    var box = el('#rsChart');
    if (!box) return;
    var rows = (mode === 'daily' ? data.daily : data.monthly) || [];

    /* 가장 큰 값을 기준으로 높이를 나눕니다.
       모두 0 이면 나눗셈이 깨지므로 1 로 둡니다. */
    var max = 1;
    rows.forEach(function (r) {
      max = Math.max(max, Number(r.jobs || 0), Number(r.talents || 0));
    });

    var sum = rows.reduce(function (a, r) {
      return a + Number(r.jobs || 0) + Number(r.talents || 0);
    }, 0);

    if (!rows.length || !sum) {
      box.innerHTML = '<p class="rs-empty">'
        + (mode === 'daily' ? '최근 2주 동안' : '최근 1년 동안')
        + ' 새로 등록된 정보가 없습니다.</p>';
      return;
    }

    var h = rows.map(function (r) {
      var jb = Number(r.jobs || 0), tb = Number(r.talents || 0);
      var jh = Math.round(jb / max * 100), th = Math.round(tb / max * 100);
      /* 값이 있는데 막대가 안 보이면 「없다」 로 오해합니다 — 최소 3% */
      if (jb > 0 && jh < 3) jh = 3;
      if (tb > 0 && th < 3) th = 3;
      var tip = r.label + ' — 채용 ' + jb + '건 · 인재 ' + tb + '건';
      return '<div class="rs-col" title="' + esc(tip) + '">'
        + '<div class="rs-bars">'
        +   '<span class="rs-bar rs-bar--job" style="height:' + jh + '%"'
        +     (jb ? ' data-v="' + jb + '"' : '') + '></span>'
        +   '<span class="rs-bar rs-bar--talent" style="height:' + th + '%"'
        +     (tb ? ' data-v="' + tb + '"' : '') + '></span>'
        + '</div>'
        + '<em>' + esc(r.label) + '</em>'
        + '</div>';
    }).join('');

    box.innerHTML = '<div class="rs-chart">' + h + '</div>';
  }

  function bindTabs() {
    var wrap = el('#rsTabs');
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]');
      if (!b) return;
      mode = b.getAttribute('data-mode');
      [].forEach.call(wrap.querySelectorAll('[data-mode]'), function (x) {
        x.classList.toggle('on', x === b);
      });
      drawChart();
    });
  }

  async function load() {
    var box = el('#rsBox');
    if (!box) return;
    try {
      var res = await fetch(SB + '/rest/v1/rpc/recruit_stats', {
        method: 'POST', headers: HDR, body: '{}',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var d = await res.json();
      if (typeof d === 'string') d = JSON.parse(d);
      if (!d || typeof d !== 'object') throw new Error('empty');
      data = d;

      drawNums();
      bindTabs();
      drawChart();
      box.hidden = false;      /* 다 그린 뒤에 보입니다 — 빈 칸이 깜빡이지 않게 */
    } catch (e) {
      /* 못 불러오면 이 묶음만 조용히 두고 다른 안내는 그대로 보입니다.
         통계는 있으면 좋은 것이고, 없다고 안내가 못 쓰이는 것은 아닙니다. */
      box.hidden = true;
      var head = el('#rsHead');
      if (head) head.hidden = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
