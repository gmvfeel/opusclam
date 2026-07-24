/* ============================================================
   OPUSCLAM 공용 히어로 배경 — assets/hero-scene.js
   DB페이지(.pdb-bg)와 동일한 '촘촘·작은 별자리(scene-net)' 배경을
   .pdb-bg .scene-net g 안에 그린다. DB·게시판 등 어느 페이지든
   해당 요소가 있으면 자동으로 그려주고, 없으면 조용히 건너뛴다.
   (DB 인라인 스크립트와 동일한 로직을 공용화 — 페이지별 복붙 제거)
   ============================================================ */
(function () {
  function draw() {
    var NS = 'http://www.w3.org/2000/svg';
    function el(t) { return document.createElementNS(NS, t); }

    /* 커뮤니티(뉴스 등) 히어로: 동심원 링(scene-orbit) — 정적·우아 */
    var gR = document.querySelector('.pdb-bg .scene-orbit g');
    if (gR) {
      gR.innerHTML = '';
      var centers = [
        { x: 140, y: 110, base: 24, n: 5 },
        { x: 360, y: 300, base: 28, n: 6 },
        { x: 560, y: 130, base: 22, n: 5 },
        { x: 760, y: 340, base: 26, n: 5 },
        { x: 960, y: 150, base: 24, n: 6 },
        { x: 1140, y: 300, base: 26, n: 5 },
        { x: 280, y: 430, base: 22, n: 4 },
        { x: 1130, y: 65, base: 22, n: 5 },
        { x: 640, y: 430, base: 24, n: 4 },
        { x: 1030, y: 430, base: 22, n: 4 },
        { x: 70, y: 310, base: 20, n: 4 }
      ];
      centers.forEach(function (c) {
        for (var i = 0; i < c.n; i++) {
          var cir = el('circle');
          cir.setAttribute('cx', c.x); cir.setAttribute('cy', c.y);
          cir.setAttribute('r', c.base * (i + 1));
          cir.setAttribute('fill', 'none');
          cir.setAttribute('stroke', 'url(#dg)');
          cir.setAttribute('stroke-width', (1.2 - i * 0.07).toFixed(2));
          cir.setAttribute('opacity', Math.max(0.1, 0.4 - i * 0.055).toFixed(2));
          gR.appendChild(cir);
        }
      });
      return;
    }

    /* DB 등 기본 히어로: 촘촘한 별자리(scene-net) */
    var g = document.querySelector('.pdb-bg .scene-net g');
    if (!g) return;
    g.innerHTML = '';
    var W = 1280, H = 460, NN = 70, maxD = 132;
    var nodes = [];
    for (var i = 0; i < NN; i++) nodes.push({ x: Math.random() * W, y: Math.random() * H });
    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxD) {
          var ln = el('line');
          ln.setAttribute('x1', nodes[a].x.toFixed(1)); ln.setAttribute('y1', nodes[a].y.toFixed(1));
          ln.setAttribute('x2', nodes[b].x.toFixed(1)); ln.setAttribute('y2', nodes[b].y.toFixed(1));
          ln.style.animationDuration = (3.2 + Math.random() * 3.2).toFixed(2) + 's';
          ln.style.animationDelay = (-Math.random() * 4.5).toFixed(2) + 's';
          g.appendChild(ln);
        }
      }
    }
    nodes.forEach(function (n) {
      var c = el('circle');
      c.setAttribute('cx', n.x.toFixed(1)); c.setAttribute('cy', n.y.toFixed(1));
      c.setAttribute('r', (1.1 + Math.random() * 1.7).toFixed(1));
      c.style.animationDuration = (3 + Math.random() * 3).toFixed(2) + 's';
      c.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
      g.appendChild(c);
    });
  }
  if (document.readyState !== 'loading') draw();
  else document.addEventListener('DOMContentLoaded', draw);
})();
