/* ============================================================
   OPUSCLAM 관계 지도 공용 엔진 (v1)

   무엇을 하는가
     뷰 페이지 아래에 관계망을 그립니다.
     한 사람을 가운데 두고 스승 · 제자 · 학교 · 단체 · 문헌을 이어 보여주고,
     이웃을 누르면 그 사람의 관계가 다시 펼쳐집니다.
     인물 → 학교 → 그 학교 졸업생 → 그 사람의 스승 으로 계속 이어집니다.

   왜 공용 엔진인가
     인물 · 단체 · 학교 · 기관 · 문헌 뷰가 모두 같은 엔진을 씁니다.
     페이지마다 복사해 두면 한쪽만 고쳐져 화면이 서로 달라집니다.
     오퍼스파인(미술)에도 이 파일을 그대로 옮겨 쓸 수 있습니다.

   links.js 와의 관계
     관계 조회 · 표 매핑 · 뷰 주소는 links.js 가 이미 갖고 있습니다.
     그것을 window.OCLinks 로 받아 씁니다. 여기서 다시 만들지 않습니다.
     links.js 가 먼저 실려 있어야 합니다 (뷰 페이지에 이미 있습니다).

   쓰는 법
     뷰 페이지에 이 한 줄만 넣으면 됩니다. 나머지는 스스로 붙습니다.
       <script src="/assets/network.js" defer></script>
     처음에는 접힌 채로 있고, 파트너가 「관계망 펼쳐보기」를 누를 때
     비로소 조회합니다. 모든 방문자에게 자동으로 조회하면 요청이 낭비됩니다.

   바깥에서 부를 수 있는 것
     OCNetwork.boot()                 · 자동 삽입 (스스로 부릅니다)
     OCNetwork.open(type, id, mount)  · 원하는 자리에 직접 그리기
   ============================================================ */

(function () {
  'use strict';
  if (window.OCNetwork) return;                 // 중복 로드 방지

  var L = window.OCLinks || null;

  /* ---------- 설정 ---------- */

  // 종류별 빛깔 · 목록 화면의 강조색(레드)을 인물에 씁니다.
  var COLOR = {
    person:     '#dc2626',
    org:        '#2563eb',
    school:     '#059669',
    academic:   '#7c3aed',
    foundation: '#d97706',
    venue:      '#0891b2',
    modern:     '#db2777'
  };
  var KIND_KO = {
    person: '인물', org: '단체', school: '학교',
    academic: '문헌', foundation: '기관 · 재단',
    venue: '공연장', modern: '현대음악'
  };

  // 관계 이름 · 화면에 간선 설명으로 씁니다.
  var REL_KO = {
    teacher: '스승', student: '제자',
    member_of: '소속', fellow_of: '관련 단체',
    alumnus_of: '출신 학교', subject: '다룬 인물',
    studied_by: '다룬 문헌', author: '저자', wrote: '집필'
  };

  // 한 노드에서 같은 종류로 뻗는 가지 수 상한.
  //   모차르트는 논문이 64편 붙습니다. 다 그리면 화면이 뭉개집니다.
  var CAP_PER_KIND = 6;
  var MAX_NODES    = 90;      // 전체 상한 · 넘으면 더 펼치지 않습니다

  /* ---------- 조회 ---------- */

  // links.js 가 있으면 그것을 쓰고, 없으면 최소한으로 스스로 합니다.
  var SB  = L ? L.SB : 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H   = L ? L.H : { apikey: KEY, Authorization: 'Bearer ' + KEY };

  function rest(q) {
    if (L && L.rest) return L.rest(q);
    return fetch(SB + '/rest/v1/' + q, { headers: H })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }

  var TABLE = (L && L.TABLE) || {
    person: 'persons', org: 'orgs', school: 'schools',
    academic: 'academic', foundation: 'foundations'
  };
  var VIEW = (L && L.VIEW) || {
    person: '/db/person-view.html', org: '/db/org-view.html',
    school: '/db/school-view.html', academic: '/db/academic-view.html',
    foundation: '/db/foundation-view.html'
  };
  var NAMEK = ['name_ko', 'name', 'name_kr', 'title', 'org_name', 'school_name', 'name_en'];

  function pickName(row) {
    if (L && L.pickName) return L.pickName(row);
    for (var i = 0; i < NAMEK.length; i++) {
      var v = row[NAMEK[i]];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }
  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 상태 ---------- */

  var G = {
    nodes: [],      // { key, type, id, name, x, y, vx, vy, deg, fixed, center, loaded }
    edges: [],      // { a, b, rel }
    index: {},      // key -> node
    mount: null,
    svg: null,
    running: false,
    frames: 0,
    trimmed: 0,        // 종류별 상한에 걸려 그리지 못한 수 · 아래 띠에 알립니다

    W: 800,
    H: 460,
    drag: null
  };

  function keyOf(type, id) { return type + ':' + id; }

  function addNode(type, id, name, center) {
    var k = keyOf(type, id);
    if (G.index[k]) return G.index[k];
    if (G.nodes.length >= MAX_NODES) return null;
    // 가운데에서 조금 흩어진 자리에서 시작합니다. 한 점에서 겹쳐 시작하면
    // 반발력이 한 방향으로 튀어 배치가 흔들립니다.
    var ang = Math.random() * Math.PI * 2;
    var rad = center ? 0 : 60 + Math.random() * 90;
    var n = {
      key: k, type: type, id: String(id), name: name || '(이름 없음)',
      x: G.W / 2 + Math.cos(ang) * rad,
      y: G.H / 2 + Math.sin(ang) * rad,
      vx: 0, vy: 0, deg: 0,
      center: !!center,
      // loaded 는 '이웃을 받아왔는가' 입니다. 가운데 점도 처음에는 받아와야 합니다.
      //   여기서 center 를 loaded 로 삼으면 첫 조회를 건너뛰어 아무것도 안 그려집니다.
      loaded: false,
      fixed: !!center            // 가운데 점은 자리를 고정합니다
    };
    G.nodes.push(n);
    G.index[k] = n;
    return n;
  }

  function addEdge(a, b, rel) {
    if (!a || !b || a === b) return;
    var k = a.key < b.key ? a.key + '~' + b.key : b.key + '~' + a.key;
    for (var i = 0; i < G.edges.length; i++) if (G.edges[i].k === k) return;
    G.edges.push({ k: k, a: a, b: b, rel: rel || '' });
    a.deg++; b.deg++;
  }

  /* ---------- 이웃 불러오기 ----------
     entity_links 는 방향이 있습니다. 양쪽을 다 봐야 관계가 빠지지 않습니다.
       내가 from 인 것 · 남이 나를 to 로 가리킨 것
     대상이 우리 DB 에 없으면(to_id 없음) 이름만 있으므로 그리지 않습니다.
     지도에서 누를 수 없는 점을 늘리면 어지럽기만 합니다.
  */
  function loadNeighbors(node) {
    if (node.loaded) return Promise.resolve(false);
    node.loaded = true;

    var fwd = rest('entity_links?select=rel,to_type,to_id&from_type=eq.' + node.type +
                   '&from_id=eq.' + encodeURIComponent(node.id) +
                   '&to_id=not.is.null&limit=300');
    var rev = rest('entity_links?select=rel,from_type,from_id&to_type=eq.' + node.type +
                   '&to_id=eq.' + encodeURIComponent(node.id) + '&limit=300');

    return Promise.all([fwd, rev]).then(function (res) {
      var want = {};      // type -> { id: rel }
      var count = {};     // type -> 담은 수 (종류별 상한)

      function take(type, id, rel) {
        if (!TABLE[type] || id == null) return;
        var k = keyOf(type, id);
        if (G.index[k]) {                       // 이미 있는 점이면 줄만 잇습니다
          addEdge(node, G.index[k], rel);
          return;
        }
        count[type] = count[type] || 0;
        if (count[type] >= CAP_PER_KIND) { G.trimmed++; return; }
        count[type]++;
        want[type] = want[type] || {};
        want[type][id] = rel;
      }

      (res[0] || []).forEach(function (r) { take(r.to_type, r.to_id, r.rel); });
      (res[1] || []).forEach(function (r) {
        // 남이 나를 스승으로 적었으면 나에게는 제자입니다.
        var rel = (r.rel === 'teacher') ? 'student'
                : (r.rel === 'student') ? 'teacher' : r.rel;
        take(r.from_type, r.from_id, rel);
      });

      // 이름을 받아옵니다. 종류마다 한 번씩만 부릅니다.
      var jobs = [];
      Object.keys(want).forEach(function (type) {
        var ids = Object.keys(want[type]);
        if (!ids.length) return;
        var sel = (type === 'academic') ? 'id,name_ko,name_en,pub_year' : 'id,name_ko,name_en';
        jobs.push(
          rest(TABLE[type] + '?select=' + sel + '&id=in.(' + ids.join(',') + ')' +
               '&hidden=is.false&limit=' + ids.length)
            .then(function (rows) {
              (rows || []).forEach(function (row) {
                var n = addNode(type, row.id, pickName(row), false);
                if (n) addEdge(node, n, want[type][row.id]);
              });
            })
        );
      });
      return Promise.all(jobs).then(function () { return true; });
    });
  }

  /* ---------- 배치 ----------
     힘 세 가지로 자리를 잡습니다. 라이브러리를 쓰지 않습니다.
       ① 반발 · 모든 점이 서로 밀어냅니다 (겹치지 않게)
       ② 인장 · 이어진 점끼리 당깁니다 (가까이 모이게)
       ③ 중심 · 가운데로 살짝 당깁니다 (밖으로 흩어지지 않게)
     속도에 감쇠를 주어 흔들림이 가라앉습니다.
  */
  function step() {
    var i, j, a, b, dx, dy, d2, d, f;
    var N = G.nodes.length;
    var REPULSE = 2600;
    var SPRING  = 0.012;
    var REST    = 96;
    var CENTER  = 0.0016;
    var DAMP    = 0.86;

    for (i = 0; i < N; i++) {
      a = G.nodes[i];
      for (j = i + 1; j < N; j++) {
        b = G.nodes[j];
        dx = a.x - b.x; dy = a.y - b.y;
        d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); }
        if (d2 > 90000) continue;               // 멀면 무시 · 계산을 아낍니다
        d = Math.sqrt(d2);
        f = REPULSE / d2;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }

    for (i = 0; i < G.edges.length; i++) {
      a = G.edges[i].a; b = G.edges[i].b;
      dx = b.x - a.x; dy = b.y - a.y;
      d = Math.sqrt(dx * dx + dy * dy) || 1;
      f = (d - REST) * SPRING;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }

    for (i = 0; i < N; i++) {
      a = G.nodes[i];
      a.vx += (G.W / 2 - a.x) * CENTER;
      a.vy += (G.H / 2 - a.y) * CENTER;
      if (a.fixed || (G.drag && G.drag.node === a)) { a.vx = 0; a.vy = 0; continue; }
      a.vx *= DAMP; a.vy *= DAMP;
      a.x += a.vx; a.y += a.vy;
      // 테두리 안에 머물게 합니다
      var m = 26;
      if (a.x < m) { a.x = m; a.vx = 0; }
      if (a.x > G.W - m) { a.x = G.W - m; a.vx = 0; }
      if (a.y < m) { a.y = m; a.vy = 0; }
      if (a.y > G.H - m) { a.y = G.H - m; a.vy = 0; }
    }
  }

  function tick() {
    if (!G.running) return;
    step();
    paintPositions();
    G.frames++;
    // 400 프레임이면 충분히 가라앉습니다. 계속 돌리면 배터리만 먹습니다.
    if (G.frames > 400 && !G.drag) { G.running = false; return; }
    requestAnimationFrame(tick);
  }
  function kick(frames) {
    G.frames = Math.max(0, 400 - (frames || 400));
    if (!G.running) { G.running = true; requestAnimationFrame(tick); }
  }

  /* ---------- 그리기 ---------- */

  function radius(n) {
    if (n.center) return 22;
    return Math.min(17, 10 + Math.min(6, n.deg));
  }

  function buildSVG() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ocn-svg');
    svg.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var gE = document.createElementNS(ns, 'g'); gE.setAttribute('class', 'ocn-edges');
    var gN = document.createElementNS(ns, 'g'); gN.setAttribute('class', 'ocn-nodes');
    svg.appendChild(gE); svg.appendChild(gN);
    G.svg = svg; G.gE = gE; G.gN = gN;
    return svg;
  }

  function paintAll() {
    var ns = 'http://www.w3.org/2000/svg';
    G.gE.textContent = '';
    G.gN.textContent = '';

    G.edges.forEach(function (e) {
      var ln = document.createElementNS(ns, 'line');
      ln.setAttribute('class', 'ocn-edge');
      e.el = ln;
      G.gE.appendChild(ln);
    });

    G.nodes.forEach(function (n) {
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'ocn-node' + (n.center ? ' is-center' : ''));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');

      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('r', radius(n));
      c.setAttribute('fill', COLOR[n.type] || '#64748b');
      g.appendChild(c);

      var t = document.createElementNS(ns, 'text');
      t.setAttribute('class', 'ocn-label');
      t.setAttribute('y', radius(n) + 13);
      t.textContent = n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name;
      g.appendChild(t);

      var ttl = document.createElementNS(ns, 'title');
      ttl.textContent = n.name + ' · ' + (KIND_KO[n.type] || n.type)
                      + (n.loaded ? '' : ' · 눌러서 펼치기');
      g.appendChild(ttl);

      n.el = g;
      bindNode(n, g);
      G.gN.appendChild(g);
    });

    paintPositions();
    updateCounter();
  }

  function paintPositions() {
    var i, e, n;
    for (i = 0; i < G.edges.length; i++) {
      e = G.edges[i];
      if (!e.el) continue;
      e.el.setAttribute('x1', e.a.x); e.el.setAttribute('y1', e.a.y);
      e.el.setAttribute('x2', e.b.x); e.el.setAttribute('y2', e.b.y);
    }
    for (i = 0; i < G.nodes.length; i++) {
      n = G.nodes[i];
      if (n.el) n.el.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')');
    }
  }

  /* ---------- 손질 · 누르기와 끌기 ---------- */

  function svgPoint(evt) {
    var r = G.svg.getBoundingClientRect();
    return {
      x: (evt.clientX - r.left) / r.width * G.W,
      y: (evt.clientY - r.top) / r.height * G.H
    };
  }

  function bindNode(n, g) {
    g.addEventListener('pointerdown', function (evt) {
      evt.preventDefault();
      var p = svgPoint(evt);
      G.drag = { node: n, dx: p.x - n.x, dy: p.y - n.y, moved: 0 };
      g.setPointerCapture && g.setPointerCapture(evt.pointerId);
      kick(120);
    });
    g.addEventListener('pointermove', function (evt) {
      if (!G.drag || G.drag.node !== n) return;
      var p = svgPoint(evt);
      G.drag.moved += Math.abs(p.x - G.drag.dx - n.x) + Math.abs(p.y - G.drag.dy - n.y);
      n.x = p.x - G.drag.dx; n.y = p.y - G.drag.dy;
      paintPositions();
    });
    g.addEventListener('pointerup', function () {
      if (!G.drag || G.drag.node !== n) return;
      var moved = G.drag.moved;
      G.drag = null;
      if (moved < 4) activate(n);              // 끌지 않았으면 누른 것으로 봅니다
      kick(160);
    });
    g.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); activate(n); }
    });
  }

  // 처음 누르면 펼치고, 이미 펼친 점을 다시 누르면 그 항목 페이지로 갑니다.
  function activate(n) {
    if (!n.loaded) {
      setStatus('불러오는 중…');
      loadNeighbors(n).then(function () {
        paintAll(); kick(300); setStatus('');
      }).catch(function () { setStatus('불러오지 못했습니다'); });
      return;
    }
    if (n.center) return;
    var href = (VIEW[n.type] || '') ;
    if (href) location.href = href + '?id=' + encodeURIComponent(n.id);
  }

  function setStatus(msg) {
    if (G.status) G.status.textContent = msg || '';
  }
  function updateCounter() {
    if (!G.counter) return;
    // 잘린 것이 있으면 알립니다. 조용히 감추면 이것이 전부인 줄 알게 됩니다.
    G.counter.textContent = '점 ' + G.nodes.length + ' · 줄 ' + G.edges.length
      + (G.trimmed ? ' · 종류마다 ' + CAP_PER_KIND + '개까지만 그렸습니다(' + G.trimmed + '개 생략)' : '')
      + (G.nodes.length >= MAX_NODES ? ' · 더 펼칠 수 없습니다' : '');
  }

  /* ---------- 스타일 ---------- */

  function injectCSS() {
    if (document.getElementById('ocn-css')) return;
    var css = ''
      + '.ocn-sec{margin-top:18px}'
      + '.ocn-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
      + '.ocn-toggle{appearance:none;border:1px solid #dc2626;background:#fff;color:#dc2626;'
      +   'font:600 13px/1 inherit;padding:9px 14px;border-radius:8px;cursor:pointer}'
      + '.ocn-toggle:hover{background:#dc2626;color:#fff}'
      + '.ocn-note{font-size:12px;color:#6b7280}'
      + '.ocn-wrap{margin-top:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fcfcfd;'
      +   'box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}'
      + '.ocn-svg{display:block;width:100%;height:auto;touch-action:none}'
      + '.ocn-edge{stroke:#cbd5e1;stroke-width:1.2}'
      + '.ocn-node{cursor:pointer}'
      + '.ocn-node circle{stroke:#fff;stroke-width:2;transition:opacity .15s}'
      + '.ocn-node:hover circle{opacity:.75}'
      + '.ocn-node:focus{outline:none}'
      + '.ocn-node:focus circle{stroke:#111827;stroke-width:2.5}'
      + '.ocn-node.is-center circle{stroke-width:3}'
      + '.ocn-label{font-size:11px;fill:#374151;text-anchor:middle;paint-order:stroke;'
      +   'stroke:#fff;stroke-width:3px;stroke-linejoin:round;pointer-events:none;user-select:none}'
      + '.ocn-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;'
      +   'padding:8px 12px;border-top:1px solid #eef0f3;background:#fff;font-size:12px;color:#6b7280}'
      + '.ocn-legend{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
      + '.ocn-lg{display:inline-flex;align-items:center;gap:4px}'
      + '.ocn-dot{width:9px;height:9px;border-radius:50%;display:inline-block}'
      + '@media (max-width:640px){.ocn-label{font-size:12px}}';
    var st = document.createElement('style');
    st.id = 'ocn-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- 열기 ---------- */

  function legendHTML(types) {
    return types.map(function (t) {
      return '<span class="ocn-lg"><i class="ocn-dot" style="background:' + COLOR[t] + '"></i>'
           + esc(KIND_KO[t] || t) + '</span>';
    }).join('');
  }

  function open(type, id, mount) {
    if (!TABLE[type]) return Promise.resolve(false);
    injectCSS();

    G.nodes = []; G.edges = []; G.index = {}; G.frames = 0; G.trimmed = 0;
    G.mount = mount;

    // 가운데 인물 · 이름을 먼저 받아옵니다
    var sel = (type === 'academic') ? 'id,name_ko,name_en,pub_year' : 'id,name_ko,name_en';
    return rest(TABLE[type] + '?select=' + sel + '&id=eq.' + encodeURIComponent(id) + '&limit=1')
      .then(function (rows) {
        var me = (rows || [])[0];
        if (!me) return false;
        var c = addNode(type, id, pickName(me), true);
        return loadNeighbors(c).then(function () {
          if (G.nodes.length < 2) return false;   // 이을 것이 없으면 그리지 않습니다

          var wrap = document.createElement('div');
          wrap.className = 'ocn-wrap';
          wrap.appendChild(buildSVG());

          var bar = document.createElement('div');
          bar.className = 'ocn-bar';
          var kinds = {};
          G.nodes.forEach(function (n) { kinds[n.type] = 1; });
          bar.innerHTML = '<span class="ocn-legend">' + legendHTML(Object.keys(kinds)) + '</span>'
                        + '<span class="ocn-count"></span><span class="ocn-status"></span>';
          wrap.appendChild(bar);

          mount.appendChild(wrap);
          G.counter = bar.querySelector('.ocn-count');
          G.status  = bar.querySelector('.ocn-status');

          paintAll();
          kick(400);
          return true;
        });
      });
  }

  /* ---------- 자동 삽입 ---------- */

  function boot() {
    var file = location.pathname.split('/').pop();
    var m = file.match(/^(.+)-view\.html$/);
    if (!m) return;
    var type = m[1];
    if (!TABLE[type]) return;

    var id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) return;

    var art = document.querySelector('article.pv');
    if (!art) return;

    injectCSS();

    var sec = document.createElement('section');
    sec.className = 'pv-sec ocn-sec';
    sec.innerHTML =
      '<h2 class="pv-h2">관계 지도</h2>' +
      '<div class="ocn-head">' +
        '<button type="button" class="ocn-toggle">관계망 펼쳐보기</button>' +
        '<span class="ocn-note">점을 누르면 그 항목의 관계가 이어서 펼쳐집니다. 끌어서 옮길 수 있습니다.</span>' +
      '</div>';

    // 관계 목록 다음, 제보 · 출처 안내 앞에 둡니다.
    var contrib = art.querySelector('.pv-contrib');
    if (contrib) art.insertBefore(sec, contrib);
    else art.appendChild(sec);

    var btn = sec.querySelector('.ocn-toggle');
    var opened = false;
    btn.addEventListener('click', function () {
      if (opened) {                       // 접기
        var w = sec.querySelector('.ocn-wrap');
        if (w) w.remove();
        G.running = false;
        opened = false;
        btn.textContent = '관계망 펼쳐보기';
        return;
      }
      btn.disabled = true;
      btn.textContent = '불러오는 중…';
      open(type, id, sec).then(function (ok) {
        btn.disabled = false;
        if (!ok) {
          btn.textContent = '이을 관계가 없습니다';
          btn.disabled = true;
          return;
        }
        opened = true;
        btn.textContent = '접기';
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = '다시 시도';
      });
    });
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  window.OCNetwork = { boot: boot, open: open };
})();
