/* ============================================================
   OPUSCLAM 공용 현황 그래프 엔진 — assets/stats-chart.js
   2026-08-13

   ★ 무엇을 하나
     ① OCStats.months(...)  열두 칸 막대 + 흐름선 (월별 분포)
     ② OCStats.compose(...) 한 줄 띠 + 범례 (구성비)
     ③ OCStats.put(...)     큰 숫자 칸 채우기

   ★ 왜 공용인가
     정보SPOT 화면이 이 그림을 <b>자기 안에</b> 갖고 있었습니다. 커뮤니티
     메인도 같은 그림이 필요해졌습니다. 복붙하면 한쪽만 고쳐집니다.
     ★ 짜임(CSS)은 assets/hub.css 의 `.hb-m*` 입니다 — 이 파일을 쓰는
       화면은 hub.css 를 반드시 함께 실어야 합니다.
     ★ 미술 버전(OPUSFINE)에서도 그대로 씁니다.

   ★ 정보SPOT 은 아직 자기 `.sp-m*` 를 씁니다. 이 공용본이 검증된 뒤에
     옮기면 됩니다 — 이름이 달라 함께 있어도 부딪히지 않습니다.
   ============================================================ */
(function (w) {

/* ── 숫자가 섞인 글 (2026-08-15) ──────────────────────────────
   ★ 「전체 206건」처럼 숫자와 글자가 붙은 문장은 사전이 통짜로는
     알아보지 못해, 영어·일본어 화면에서 한국어로 남았습니다.
     OCI18N.n 에 자리표를 넘겨 언어마다 어순을 달리 둡니다.
   ★ i18n.js 가 아직 안 실렸을 때를 대비해 원문에 값만 채웁니다. */
/* 단위 낱말 하나를 사전에 태웁니다 (건 → items · 件)
   ★ stats-chart 는 게시판·인물·공연 등 여러 곳이 함께 쓰는 엔진이라,
     단위가 화면마다 다릅니다(건·명·곳·개). 통짜로 묶지 않고 낱말만
     갈아 끼웁니다 — 사전에 이미 들어 있는 낱말들입니다. */
function unitT(u) {
  try {
    if (window.OCI18N && window.OCI18N.t) return window.OCI18N.t(u);
  } catch (e) {}
  return u;
}

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

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { return (Number(v) || 0).toLocaleString(); }
  function el(x) { return typeof x === 'string' ? document.querySelector(x) : x; }

  /* ── 눈금 값 정하기 ────────────────────────────────────────
     값이 작을 때는 1씩, 클 때는 네 단계로 나눕니다.
     눈금 맨 위를 실제 최대값보다 조금 올려 막대가 천장에 붙지 않게 합니다. */
  function ticksOf(max) {
    if (max <= 0) return { top: 1, ticks: [0, 1] };
    if (max <= 5) {
      var t = [];
      for (var v = 0; v <= max; v++) t.push(v);
      return { top: max, ticks: t };
    }
    var step = Math.ceil(max / 4), top = step * 4, out = [];
    for (var v2 = 0; v2 <= top; v2 += step) out.push(v2);
    return { top: top, ticks: out };
  }

  /* ══ ① 월별 막대 ═════════════════════════════════════════════
     rows  [{ label:'8월', n:541, now:true, key:'2026-08' }, ...]
     opts  { title, note, unit:'건', hue:[r,g,b] 계열, onPick }
       onPick 을 주면 막대를 누를 수 있게 됩니다(누른 row.key 를 넘깁니다).
     ────────────────────────────────────────────────────────── */
  function months(target, rows, opts) {
    var box = el(target);
    if (!box) return;
    rows = rows || [];
    opts = opts || {};
    var unit = opts.unit || '건';
    var pick = typeof opts.onPick === 'function';

    var max = 0;
    rows.forEach(function (r) { var n = Number(r.n) || 0; if (n > max) max = n; });
    var tk = ticksOf(max), top = tk.top;

    var grid = tk.ticks.map(function (t) {
      var pos = top ? (t / top * 100) : 0;
      return '<i class="' + (t === 0 ? 'base' : '') + '" style="bottom:' + pos.toFixed(2) + '%">'
           + '<b>' + t + '</b></i>';
    }).join('');

    var cols = rows.map(function (r) {
      var n = Number(r.n) || 0;
      var h = top ? Math.max(n / top * 100, n > 0 ? 4 : 0) : 0;
      var t = max ? (n / max) : 0;
      /* 값이 클수록 진하게 — 달은 견주는 항목이 아니라 흐름이므로
         빛깔을 여러 개 쓰지 않고 한 계열의 밝기 차이로 그립니다. */
      var l = Math.round(206 - 138 * t);
      var bg = n > 0
        ? 'rgb(' + Math.round(l * 0.42) + ',' + Math.round(l * 0.48) + ',' + l + ')'
        : '';
      var cls = 'hb-mcol' + (n > 0 ? ' has' : '') + (n > 0 && pick ? ' link' : '');
      return '<div class="' + cls + '"'
        + (n > 0 && pick
            ? ' data-k="' + esc(r.key == null ? r.label : r.key) + '" role="button" tabindex="0"'
              + ' aria-label="' + esc(r.label) + ' ' + ocN('{0}{1}', n, unitT(unit)) + '"'
            : '')
        + '>'
        + (n > 0 ? '<span class="hb-tip"><b>' + esc(r.label) + '</b> ' + num(n) + unitT(unit)
                 + (opts.tipNote ? '<em>' + esc(opts.tipNote) + '</em>' : '') + '</span>' : '')
        + (n > 0 ? '<span class="hb-mdot" style="bottom:' + h.toFixed(1) + '%"></span>' : '')
        + '<span class="hb-mbar"'
        + (bg ? ' style="height:' + h.toFixed(1) + '%;background:' + bg + '"' : '') + '>'
        + (n > 0 ? '<span class="hb-mval">' + n + '</span>' : '')
        + '</span></div>';
    }).join('');

    /* 흐름선 — 각 달의 값 지점을 부드럽게 잇습니다.
       좌표는 백분율로 쓰고 preserveAspectRatio 를 none 으로 두어
       칸 폭이 어떻게 바뀌어도 막대와 어긋나지 않습니다. */
    var pts = rows.map(function (r, i) {
      var n = Number(r.n) || 0;
      return { x: (i + 0.5) / Math.max(rows.length, 1) * 100,
               y: 100 - (top ? (n / top * 100) : 0) };
    });
    var line = '';
    pts.forEach(function (p, i) {
      if (i === 0) { line += 'M' + p.x.toFixed(2) + ' ' + p.y.toFixed(2); return; }
      var q = pts[i - 1], mx = (q.x + p.x) / 2;
      line += ' C' + mx.toFixed(2) + ' ' + q.y.toFixed(2)
            + ',' + mx.toFixed(2) + ' ' + p.y.toFixed(2)
            + ',' + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    });
    var lineSvg = pts.length
      ? '<div class="hb-mline"><svg viewBox="0 0 100 100" preserveAspectRatio="none"'
        + ' aria-hidden="true"><path d="' + line + '"/></svg></div>'
      : '';

    var labels = rows.map(function (r) {
      var n = Number(r.n) || 0;
      var cls = (n > 0 ? 'has' : '') + (r.now ? ' now' : '');
      return '<span class="' + cls.trim() + '"' + (r.now ? ' title="이번 달"' : '') + '>'
           + esc(r.label) + '</span>';
    }).join('');

    box.innerHTML =
      (opts.title
        ? '<div class="hb-ptitle"><b>' + esc(opts.title) + '</b>'
          + (opts.note ? '<span>' + esc(opts.note) + '</span>' : '') + '</div>'
        : '')
      + '<div class="hb-mchart">'
      +   '<div class="hb-mcols"><div class="hb-mgrid">' + grid + '</div>'
      +     cols + lineSvg + '</div>'
      +   '<div class="hb-mlabels">' + labels + '</div>'
      + '</div>';

    if (pick) {
      var go = function (ev) {
        var c = ev.target.closest && ev.target.closest('.hb-mcol.link');
        if (!c) return;
        opts.onPick(c.getAttribute('data-k'));
      };
      box.addEventListener('click', go);
      box.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(ev); }
      });
    }
  }

  /* ══ ② 구성비 — 한 줄 띠 + 범례 ══════════════════════════════
     rows   [{ label:'지식나눔', n:178, color:'#7c63b0' }, ...]
     opts   { total, empty:'없을 때 글', fallback:'#8b95a8' }
     ────────────────────────────────────────────────────────── */
  function compose(target, rows, opts) {
    var box = el(target);
    if (!box) return;
    opts = opts || {};
    rows = (rows || []).filter(function (r) { return (Number(r.n) || 0) > 0; });
    if (!rows.length) {
      box.innerHTML = '<p class="bd-empty" style="padding:8px 0">'
        + esc(opts.empty || '자료가 쌓이면 구성비가 표시됩니다.') + '</p>';
      return;
    }
    var fb = opts.fallback || '#8b95a8';
    var sum = Number(opts.total) || rows.reduce(function (a, r) { return a + (Number(r.n) || 0); }, 0);

    var seg = rows.map(function (r) {
      var pct = sum ? (Number(r.n) || 0) / sum * 100 : 0;
      return '<span class="bar-seg" style="width:' + pct.toFixed(2) + '%;background:'
        + (r.color || fb) + '" title="' + esc(r.label) + ' ' + num(r.n) + '"></span>';
    }).join('');
    var leg = rows.map(function (r) {
      var pct = sum ? (Number(r.n) || 0) / sum * 100 : 0;
      return '<span class="bar-leg"><i style="background:' + (r.color || fb) + '"></i>'
        + '<b>' + esc(r.label) + '</b><u>' + num(r.n) + '</u>'
        + '<s>' + pct.toFixed(1) + '%</s></span>';
    }).join('');

    box.innerHTML = '<div class="bar-track">' + seg + '</div>'
                  + '<div class="bar-legs">' + leg + '</div>';
  }

  /* ══ ③ 큰 숫자 칸 ══════════════════════════════════════════ */
  function put(target, v) {
    var e = el(target);
    if (e) e.textContent = num(v);
  }

  /* ══ 뼈대 — 자료가 오기 전 잠깐 ═════════════════════════════ */
  function skeleton(target, title) {
    var box = el(target);
    if (!box) return;
    box.innerHTML = '<div class="hb-ptitle"><b>' + esc(title || '') + '</b>'
      + '<span>불러오는 중…</span></div>'
      + '<div class="bd-loading" style="min-height:150px">'
      + '<span class="hub-skel w7"></span><span class="hub-skel w5"></span>'
      + '<span class="hub-skel w7"></span></div>';
  }

  w.OCStats = { months: months, compose: compose, put: put, skeleton: skeleton,
                esc: esc, num: num };
})(window);
