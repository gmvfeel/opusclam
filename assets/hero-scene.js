/* ============================================================
   OPUSCLAM 공용 히어로 배경 — assets/hero-scene.js
   ------------------------------------------------------------
   각 대메뉴의 상단 배경 무늬를 그립니다.
   화면 마크업에 놓인 이름을 보고 그에 맞는 무늬를 그립니다.

     <div class="scene scene-net   on">   DATABASE    별자리 그물
     <div class="scene scene-orbit on">   OC커뮤니티  동심원 링 무리
     <div class="scene scene-spot  on">   정보SPOT    점 격자 위의 지점

   무늬를 새로 늘릴 때 —
     아래 SCENES 에 그리는 함수 하나만 더하고 ORDER 에 이름을 넣으면 됩니다.
     예전에는 「orbit 이면 그리고 끝, 아니면 net」처럼 조건문이 박혀 있어서
     무늬를 늘릴 때마다 조건문이 하나씩 붙었습니다.
     레슨:ON · 리쿠르트 · SHOPPING 무늬도 여기에 더하면 됩니다.

   빛깔은 화면마다 있는 <linearGradient id="dg"> 를 그대로 씁니다.
   어두운 모드에서는 assets/base.css 가 전체를 옅게 낮춥니다.
   해당 요소가 없는 화면에서는 아무 일도 하지 않고 조용히 지나갑니다.
   ============================================================ */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var W = 1280, H = 460;                 /* 마크업의 viewBox 와 같은 값 */

  function el(t) { return document.createElementNS(NS, t); }
  function attr(node, o) {
    for (var k in o) node.setAttribute(k, o[k]);
    return node;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var SCENES = {

    /* ── OC커뮤니티 · 동심원 링 무리 ──
       칸을 나눠 무리를 앉히고, 무리마다 링을 네다섯 겹 두릅니다. */
    orbit: function (g) {
      var cols = 4, rows = 3, cellW = W / cols, cellH = H / rows;
      for (var gy = 0; gy < rows; gy++) {
        for (var gx = 0; gx < cols; gx++) {
          if (Math.random() < 0.15) continue;              /* 가끔 빈 칸 → 자연스럽게 */
          var cx = gx * cellW + cellW * (0.25 + Math.random() * 0.5);
          var cy = gy * cellH + cellH * (0.25 + Math.random() * 0.5);
          var base = 18 + Math.random() * 12;              /* 무리 크기 18~30 */
          var n = 4 + Math.floor(Math.random() * 3);       /* 링 4~6겹 */
          for (var i = 0; i < n; i++) {
            g.appendChild(attr(el('circle'), {
              cx: cx.toFixed(1), cy: cy.toFixed(1),
              r: (base * (i + 1)).toFixed(1),
              fill: 'none', stroke: 'url(#dg)',
              'stroke-width': (1.6 - i * 0.08).toFixed(2),
              opacity: Math.max(0.15, 0.5 - i * 0.07).toFixed(2)
            }));
          }
        }
      }
    },

    /* ── 정보SPOT · 점 격자 위의 지점 ──
       옅은 점 격자를 깔고, 그 위에 크기가 다른 「자리」를 몇 곳 찍습니다.
       국내외 곳곳에 흩어진 일정 정보를 나타냅니다.
       DATABASE(점을 선으로 잇는 그물)와 겹치지 않도록 잇는 선은 두지 않았습니다. */
    spot: function (g) {
      /* ① 점 격자 — 종이 위의 눈금처럼 옅게 */
      var STEP = 60;
      for (var y = STEP / 2; y < H; y += STEP) {
        for (var x = STEP / 2; x < W; x += STEP) {
          g.appendChild(attr(el('circle'), {
            cx: x, cy: y, r: 2.6,
            fill: 'url(#dg)', opacity: 0.22
          }));
        }
      }

      /* ② 지점 — 큰 자리부터 작은 자리까지 섞어 놓습니다.
            크기를 섞어야 한쪽으로 몰려 보이지 않습니다. */
      var sizes = [[13, 29], [11, 25], [9, 21], [7, 16], [6, 14], [5, 12]];
      for (var s = sizes.length - 1; s > 0; s--) {         /* 순서 섞기 */
        var j = Math.floor(Math.random() * (s + 1));
        var t = sizes[s]; sizes[s] = sizes[j]; sizes[j] = t;
      }

      var cols = 3, rows = 2, cw = W / cols, ch = H / rows, k = 0;
      for (var gy2 = 0; gy2 < rows; gy2++) {
        for (var gx2 = 0; gx2 < cols; gx2++) {
          if (Math.random() < 0.12) continue;              /* 가끔 빈 칸 */
          var cx = gx2 * cw + cw * rnd(0.22, 0.78);
          var cy = gy2 * ch + ch * rnd(0.26, 0.74);
          var sz = sizes[k % sizes.length]; k++;
          var inner = sz[0] * rnd(0.9, 1.12);
          var outer = sz[1] * rnd(0.92, 1.1);

          g.appendChild(attr(el('circle'), {               /* 안쪽 원 */
            cx: cx.toFixed(1), cy: cy.toFixed(1), r: inner.toFixed(1),
            fill: 'none', stroke: 'url(#dg)', 'stroke-width': 1.5, opacity: 0.48
          }));
          g.appendChild(attr(el('circle'), {               /* 바깥 원 */
            cx: cx.toFixed(1), cy: cy.toFixed(1), r: outer.toFixed(1),
            fill: 'none', stroke: 'url(#dg)', 'stroke-width': 1.2, opacity: 0.26
          }));
          if (inner > 9) {                                 /* 큰 자리에만 한 겹 더 */
            g.appendChild(attr(el('circle'), {
              cx: cx.toFixed(1), cy: cy.toFixed(1), r: (outer * 1.62).toFixed(1),
              fill: 'none', stroke: 'url(#dg)', 'stroke-width': 1, opacity: 0.13
            }));
          }
          g.appendChild(attr(el('circle'), {               /* 가운데 점 */
            cx: cx.toFixed(1), cy: cy.toFixed(1),
            r: (inner > 9 ? 3.7 : 2.6).toFixed(1),
            fill: 'url(#dg)', opacity: inner > 9 ? 0.58 : 0.42
          }));
        }
      }
    },

    /* ── DATABASE 등 기본 · 별자리 그물 ──
       점을 흩고 가까운 것끼리 잇습니다. 깜빡임은 style.css 가 맡습니다. */
    net: function (g) {
      var NN = 70, maxD = 132, nodes = [];
      for (var i = 0; i < NN; i++) nodes.push({ x: Math.random() * W, y: Math.random() * H });
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxD) {
            var ln = attr(el('line'), {
              x1: nodes[a].x.toFixed(1), y1: nodes[a].y.toFixed(1),
              x2: nodes[b].x.toFixed(1), y2: nodes[b].y.toFixed(1)
            });
            ln.style.animationDuration = (3.2 + Math.random() * 3.2).toFixed(2) + 's';
            ln.style.animationDelay = (-Math.random() * 4.5).toFixed(2) + 's';
            g.appendChild(ln);
          }
        }
      }
      nodes.forEach(function (n) {
        var c = attr(el('circle'), {
          cx: n.x.toFixed(1), cy: n.y.toFixed(1),
          r: (1.1 + Math.random() * 1.7).toFixed(1)
        });
        c.style.animationDuration = (3 + Math.random() * 3).toFixed(2) + 's';
        c.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
        g.appendChild(c);
      });
    }

  };

  /* 찾는 순서 — 화면에 있는 첫 무늬만 그리고 끝냅니다 */
  var ORDER = ['orbit', 'spot', 'net'];

  function draw() {
    for (var i = 0; i < ORDER.length; i++) {
      var name = ORDER[i];
      var g = document.querySelector('.pdb-bg .scene-' + name + ' g');
      if (!g) continue;
      g.innerHTML = '';
      try { SCENES[name](g); } catch (e) {
        if (window.console) console.warn('[히어로 배경] ' + name + ' 건너뜀:', e.message);
      }
      return;
    }
  }

  if (document.readyState !== 'loading') draw();
  else document.addEventListener('DOMContentLoaded', draw);
})();
