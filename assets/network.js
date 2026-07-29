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
  // ── 빛깔 ────────────────────────────────────────────────
  //  파트너가 고른 네 가지를 기준으로 짰습니다.
  //    #d93a4c 인물 · #0f9b8e 학교 · #3b6fc4 단체 · #8b95a8 문헌
  //  기관 · 공연장은 고른 네 가지와 부딪히지 않는 자리에서 골랐습니다.
  //  문헌만 회색빛으로 물러섭니다 — 인물이 중심이고 문헌은 곁가지입니다.
  var COLOR = {
    person:     '#d93a4c',
    school:     '#0f9b8e',
    org:        '#3b6fc4',
    academic:   '#8b95a8',
    foundation: '#c08a3e',   // 황토 · 네 가지와 겹치지 않게
    venue:      '#2f8ca8',   // 학교와 단체 사이
    modern:     '#a5568f'
  };

  // 가운데 점을 감싸는 링.
  //   인물 빛깔과 비슷한 빨강을 쓰면 링이 묻혀 보이지 않습니다.
  //   어느 빛깔 위에서도 또렷한 짙은 회청색으로 둡니다.
  var ACCENT = '#475569';

  // 줄 빛깔 · 점 빛깔과 결을 맞춘 중립 회색입니다.
  var EDGE = {
    base:  '#d7dbe1',
    teach: '#bfc6cf',   // 사제 관계 · 또렷하게
    paper: '#e3e6eb',   // 문헌 · 점선으로 옅게
    hot:   '#d93a4c'    // 손을 올렸을 때
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
  // 네모 크기 · 아래 GAP_Y 가 이 값을 쓰므로 반드시 먼저 정해져 있어야 합니다.
  //   (2026-07-29 · 이 순서를 어겨 좌표가 NaN 이 되어 모든 네모가 한 점에 겹쳤습니다)
  var BOX_H   = 30;      // 네모 높이
  var BOX_H_C = 36;      // 가운데 것은 조금 크게
  var BOX_MAX = 178;     // 이보다 길면 이름을 자릅니다
  var BOX_PAD = 13;

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
    maxDepth: 1,       // 가장 깊은 단계 · 단계 사이 간격을 정하는 데 씁니다

    W: 900,
    H: 520,
    baseH: 520,      // 처음 높이 · 점이 많으면 여기서 늘어납니다
    baseW: 900,      // 처음 폭 · 단계가 깊어지면 늘어납니다
    drag: null
  };

  function keyOf(type, id) { return type + ':' + id; }

  // ── 왼쪽에서 오른쪽으로 뻗는 자리 ────────────────────────
  //  가운데 점을 왼쪽에 두고, 한 단계 멀어질수록 오른쪽으로 옮깁니다.
  //  누를 때마다 오른쪽으로 이어져 관계가 어느 쪽으로 뻗는지 눈에 보입니다.
  //  점을 화면 가운데에 모으면 오른쪽이 텅 비어 자리가 낭비됩니다.
  //  (2026-07-29 라흐마니노프 화면에서 오른쪽 절반이 비어 있었습니다)
  function levelX(d, y) {
    // 네모가 가로로 길어졌으므로 단계 사이를 더 벌립니다.
    //   네모 최대 폭 + 줄이 보일 틈 이 최소값입니다.
    var left = 118;
    var gap  = Math.max(BOX_MAX + 42, Math.min(285, (G.W - left - 150) / Math.max(1, G.maxDepth)));
    if (!d) return left;
    var base = left + d * gap;
    // 세로로 멀어질수록 살짝 왼쪽으로 당겨 부채꼴이 되게 합니다.
    //   단계마다 수직선으로 딱 맞추면 도표처럼 딱딱해 보입니다.
    //   가운데에서 퍼져 나가는 결이 생기도록 조금 휘게 했습니다.
    var dy = ((y == null ? G.H / 2 : y) - G.H / 2) / (G.H / 2);   // -1 ~ 1
    return base - Math.min(0.4, dy * dy * 0.4) * gap;
  }
  function noteDepth(d) {
    if (d > G.maxDepth) G.maxDepth = d;
  }

  function addNode(type, id, name, center, depth) {
    var k = keyOf(type, id);
    if (G.index[k]) return G.index[k];
    if (G.nodes.length >= MAX_NODES) return null;
    // 가운데에서 조금 흩어진 자리에서 시작합니다. 한 점에서 겹쳐 시작하면
    // 반발력이 한 방향으로 튀어 배치가 흔들립니다.
    var d = center ? 0 : (depth || 1);
    // 자기 단계 자리 근처에서 시작합니다. 한 점에서 겹쳐 시작하면 배치가 흔들립니다.
    var n = {
      key: k, type: type, id: String(id), name: name || '(이름 없음)',
      depth: d,
      x: levelX(d) + (Math.random() - 0.5) * 30,
      y: G.H / 2 + (Math.random() - 0.5) * G.H * 0.7,
      vx: 0, vy: 0, deg: 0,
      tx: null, ty: null, pinned: false,
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
                var n = addNode(type, row.id, pickName(row), false, node.depth + 1);
                if (n) { noteDepth(n.depth); addEdge(node, n, want[type][row.id]); }
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
  // ── 자리잡기 ────────────────────────────────────────────
  //  힘으로 세로 자리를 정하다가 실패했습니다.
  //    이어진 점끼리 당기는 힘이 밀어내는 힘을 이겨,
  //    모든 점이 가운데 점 높이로 모여 이름표가 서로 얹혔습니다.
  //    (2026-07-29 라흐마니노프 화면 · 점 아홉 개가 한 덩어리로 뭉쳤습니다)
  //
  //  그래서 세로 자리를 나눠 주는 방식으로 바꿨습니다.
  //    한 단계에 점이 k 개면 높이를 k 칸으로 나눠 한 칸씩 줍니다.
  //    겹침이 아예 생길 수 없고, 간격도 고르게 나옵니다.
  //    부모의 높이 순서대로 줄을 세워 줄이 꼬이지 않습니다.
  //  움직임은 목표 자리로 부드럽게 다가가게 해서 딱딱해 보이지 않습니다.

  var GAP_Y = BOX_H + 16;   // 네모 높이 + 위아래 틈

  function parentY(n) {
    // 자기보다 앞 단계에 있는 이웃(부모)의 높이
    for (var i = 0; i < G.edges.length; i++) {
      var e = G.edges[i];
      if (e.a === n && e.b.depth < n.depth) return e.b.y;
      if (e.b === n && e.a.depth < n.depth) return e.a.y;
    }
    return G.H / 2;
  }

  function relayout() {
    var byDepth = {};
    var i, n;
    for (i = 0; i < G.nodes.length; i++) {
      n = G.nodes[i];
      (byDepth[n.depth] = byDepth[n.depth] || []).push(n);
    }

    // 한 단계에 점이 많으면 그림판을 세로로 늘립니다. 모달 안에서 굴려 볼 수 있습니다.
    var most = 1;
    Object.keys(byDepth).forEach(function (d) {
      if (byDepth[d].length > most) most = byDepth[d].length;
    });
    var needH = Math.max(G.baseH, most * GAP_Y + 70);
    // 단계가 깊어지면 가로로도 늘립니다. 모달 안에서 굴려 볼 수 있습니다.
    var needW = Math.max(G.baseW, 118 + (G.maxDepth + 1) * (BOX_MAX + 42) + 60);
    if (needH !== G.H || needW !== G.W) {
      G.H = needH;
      G.W = needW;
      if (G.svg) G.svg.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    }

    Object.keys(byDepth).forEach(function (d) {
      var arr = byDepth[d];
      // 손으로 옮겨 둔 점은 건드리지 않습니다
      var free = arr.filter(function (x) { return !x.pinned; });
      if (!free.length) return;

      free.sort(function (a, b) {
        var pa = parentY(a), pb = parentY(b);
        if (pa !== pb) return pa - pb;
        return a.name < b.name ? -1 : 1;
      });

      var top = BOX_H_C / 2 + 12, bottom = G.H - BOX_H_C / 2 - 12;
      var span = bottom - top;
      var k = free.length;
      for (var j = 0; j < k; j++) {
        var node = free[j];
        node.ty = (k === 1) ? G.H / 2 : top + span * (j + 0.5) / k;
        node.tx = levelX(node.depth, node.ty);
      }
    });

    // 가운데 점은 늘 왼쪽 가운데
    for (i = 0; i < G.nodes.length; i++) {
      if (G.nodes[i].center) {
        G.nodes[i].tx = levelX(0);
        G.nodes[i].ty = G.H / 2;
      }
    }
  }

  function step() {
    var moving = false;
    for (var i = 0; i < G.nodes.length; i++) {
      var n = G.nodes[i];
      if (G.drag && G.drag.node === n) continue;
      if (n.tx == null) { n.tx = n.x; n.ty = n.y; }
      var dx = n.tx - n.x, dy = n.ty - n.y;
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) moving = true;
      n.x += dx * 0.14;
      n.y += dy * 0.14;
    }
    return moving;
  }

  function tick() {
    if (!G.running) return;
    var moving = step();
    paintPositions();
    G.frames++;
    // 목표 자리에 닿으면 곧바로 멈춥니다. 헛돌면 배터리만 먹습니다.
    if ((!moving && !G.drag) || G.frames > 260) {
      G.running = false;
      return;
    }
    requestAnimationFrame(tick);
  }
  function kick() {
    relayout();
    spin();
  }
  // 자리를 다시 나누지 않고 움직임만 이어서 돌립니다.
  //   끌고 있는 동안 자리를 다시 나누면 손 밑에서 그림이 흔들립니다.
  function spin() {
    G.frames = 0;
    if (!G.running) { G.running = true; requestAnimationFrame(tick); }
  }

  /* ---------- 그리기 ---------- */

  // ── 크기 ────────────────────────────────────────────────
  //  동그라미 대신 가로로 긴 둥근 네모를 씁니다.
  //  이름을 네모 안에 담으므로 이름표가 따로 떠다니지 않습니다.
  //    · 이름표끼리 겹치는 일이 원리적으로 없어집니다
  //      (전에는 이름표가 점 밖에 떠 있어 겹치는 것을 골라 감춰야 했습니다)
  //    · 왼쪽에서 오른쪽으로 흐르는 결과도 잘 맞습니다
  //  글자 폭은 재 볼 수 없으므로 한글 · 영문 · 숫자를 나눠 어림합니다.
  function textWidth(t, size) {
    var w = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if (c > 0x1100 && c < 0xD7FF) w += size;          // 한글
      else if (c > 0x3000 && c < 0x9FFF) w += size;      // 한자 · 전각
      else if (c === 32) w += size * 0.28;
      else if (c >= 65 && c <= 90) w += size * 0.66;     // 영문 대문자
      else w += size * 0.53;
    }
    return w;
  }

  function fitText(t, size, max) {
    if (textWidth(t, size) <= max) return t;
    var out = t;
    while (out.length > 2 && textWidth(out + '…', size) > max) out = out.slice(0, -1);
    return out + '…';
  }

  // 자리 계산과 그리기가 같은 값을 쓰도록 한 곳에서 정합니다.
  function boxOf(n) {
    if (n._box) return n._box;
    var h  = n.center ? BOX_H_C : BOX_H;
    var fs = n.center ? 13 : 12;
    var label = fitText(n.name, fs, BOX_MAX - BOX_PAD * 2);
    var w = Math.max(56, Math.min(BOX_MAX, textWidth(label, fs) + BOX_PAD * 2));
    n._box = { w: w, h: h, fs: fs, label: label };
    return n._box;
  }

  // 자리잡기에서 쓰는 반쪽 높이
  function radius(n) { return boxOf(n).h / 2; }

  // 범례에 쓰는 작은 표시 · 화면의 네모와 같은 꼴
  function legendMark() { return 'border-radius:3px;width:11px;height:8px'; }

  function buildSVG() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ocn-svg');
    svg.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // 아주 옅은 그림자 · 동그라미가 배경에서 살짝 떠 보이게 합니다.
    var defs = document.createElementNS(ns, 'defs');
    defs.innerHTML =
      '<filter id="ocn-shadow" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="#0f172a" flood-opacity="0.20"/>' +
      '</filter>';
    svg.appendChild(defs);
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
      // 직선으로 이으면 부챗살처럼 뻣뻣합니다.
      //   왼쪽에서 오른쪽으로 흐르는 결에 맞춰 곡선으로 휘게 합니다.
      //   시작과 끝에서 가로로 빠져나가는 곡선이라 단계 사이 흐름이 눈에 잡힙니다.
      var ln = document.createElementNS(ns, 'path');
      // 사제 관계는 실선으로 또렷하게, 문헌은 점선으로 옅게 둡니다.
      //   모두 같은 줄로 그리면 무엇이 중요한 관계인지 알 수 없습니다.
      var kind = /^(teacher|student)$/.test(e.rel) ? ' is-teach'
               : /^(subject|studied_by|author|wrote)$/.test(e.rel) ? ' is-paper' : '';
      ln.setAttribute('class', 'ocn-edge' + kind);
      e.el = ln;
      G.gE.appendChild(ln);
    });

    G.nodes.forEach(function (n) {
      var box = boxOf(n);
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'ocn-node' + (n.center ? ' is-center' : ''));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');

      // 가운데 것에는 옅은 테두리를 한 겹 더 둘러 표시합니다.
      if (n.center) {
        var ring = document.createElementNS(ns, 'rect');
        ring.setAttribute('class', 'ocn-ring');
        ring.setAttribute('x', -box.w / 2 - 4); ring.setAttribute('y', -box.h / 2 - 4);
        ring.setAttribute('width', box.w + 8);  ring.setAttribute('height', box.h + 8);
        ring.setAttribute('rx', (box.h + 8) / 2.6);
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', ACCENT);
        g.appendChild(ring);
      }

      var r = document.createElementNS(ns, 'rect');
      r.setAttribute('class', 'ocn-mark');
      r.setAttribute('x', -box.w / 2); r.setAttribute('y', -box.h / 2);
      r.setAttribute('width', box.w);  r.setAttribute('height', box.h);
      r.setAttribute('rx', box.h / 2.6);
      r.setAttribute('fill', COLOR[n.type] || '#8b95a8');
      r.setAttribute('filter', 'url(#ocn-shadow)');
      g.appendChild(r);

      var t = document.createElementNS(ns, 'text');
      t.setAttribute('class', 'ocn-label');
      t.setAttribute('y', box.fs * 0.36);          // 네모 안에서 위아래 가운데
      t.setAttribute('font-size', box.fs);
      t.textContent = box.label;
      n.label = t;
      g.appendChild(t);

      // 잘린 이름은 손을 올리면 전체가 보입니다.
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

  // 이름이 네모 안에 들어갔으므로 이름표 겹침을 따로 셀 일이 없습니다.
  function paintPositions() {
    var i, e, n;
    for (i = 0; i < G.edges.length; i++) {
      e = G.edges[i];
      if (!e.el) continue;
      // 왼쪽 점에서 오른쪽 점으로 흐르는 곡선입니다.
      //   가운데를 두 번 꺾어(큐빅) 양끝이 가로로 빠져나가게 합니다.
      //   같은 단계끼리 이어질 때는 가로 차이가 없어 거의 직선으로 보입니다.
      var a = (e.a.x <= e.b.x) ? e.a : e.b;
      var b = (e.a.x <= e.b.x) ? e.b : e.a;
      var mx = (a.x + b.x) / 2;
      if (Math.abs(b.x - a.x) < 24) {
        // 가로로 거의 같은 자리면 옆으로 살짝 부풀려 겹치지 않게 합니다
        var bulge = Math.min(46, Math.abs(b.y - a.y) * 0.34) + 14;
        e.el.setAttribute('d',
          'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) +
          'Q' + (a.x + bulge).toFixed(1) + ',' + ((a.y + b.y) / 2).toFixed(1) +
          ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1));
      } else {
        e.el.setAttribute('d',
          'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) +
          'C' + mx.toFixed(1) + ',' + a.y.toFixed(1) +
          ' ' + mx.toFixed(1) + ',' + b.y.toFixed(1) +
          ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1));
      }
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

  // 점 30개면 어느 줄이 누구와 이어졌는지 눈으로 따라가기 어렵습니다.
  //   손을 올린 점의 줄을 진하게 하고, 이어진 상대의 이름표를 보여 줍니다.
  //   감춰 둔 문헌 제목도 이때 드러납니다.
  function spotlight(n, on) {
    for (var i = 0; i < G.edges.length; i++) {
      var e = G.edges[i];
      if (e.a !== n && e.b !== n) continue;
      if (e.el) e.el.classList.toggle('is-hot', on);
      var other = (e.a === n) ? e.b : e.a;
      if (other.el) other.el.classList.toggle('is-near', on);
    }
  }

  // 끌 때 이어진 점을 함께 밀어 줍니다.
  //   목표 자리로 당기는 힘이 남아 있으므로 고무줄처럼 딸려오다,
  //   손을 놓으면 제자리로 돌아갑니다.
  //   자리는 단계별로 고르게 나눠 두었으니 겹칠 걱정 없이 이 느낌만 얻습니다.
  function tugNeighbors(n, ddx, ddy) {
    for (var i = 0; i < G.edges.length; i++) {
      var e = G.edges[i];
      var m = (e.a === n) ? e.b : (e.b === n) ? e.a : null;
      if (!m) continue;
      m.x += ddx * 0.55;
      m.y += ddy * 0.55;
    }
  }

  function bindNode(n, g) {
    g.addEventListener('mouseenter', function () { spotlight(n, true); });
    g.addEventListener('mouseleave', function () { spotlight(n, false); });
    g.addEventListener('focus', function () { spotlight(n, true); });
    g.addEventListener('blur', function () { spotlight(n, false); });
    g.addEventListener('pointerdown', function (evt) {
      evt.preventDefault();
      var p = svgPoint(evt);
      G.drag = { node: n, dx: p.x - n.x, dy: p.y - n.y, moved: 0 };
      g.setPointerCapture && g.setPointerCapture(evt.pointerId);
      spin();                                  // 자리를 다시 나누지 않습니다
    });
    g.addEventListener('pointermove', function (evt) {
      if (!G.drag || G.drag.node !== n) return;
      var p = svgPoint(evt);
      var nx = p.x - G.drag.dx, ny = p.y - G.drag.dy;
      var ddx = nx - n.x, ddy = ny - n.y;
      G.drag.moved += Math.abs(ddx) + Math.abs(ddy);
      n.x = nx; n.y = ny;
      tugNeighbors(n, ddx, ddy);               // 이어진 점이 딸려옵니다
      spin();                                  // 딸려온 점들이 부드럽게 자리를 찾게
      paintPositions();
    });
    g.addEventListener('pointerup', function () {
      if (!G.drag || G.drag.node !== n) return;
      var moved = G.drag.moved;
      G.drag = null;
      if (moved < 4) { activate(n); return; }  // 끌지 않았으면 누른 것으로 봅니다
      // 손으로 옮긴 자리를 목표로 삼습니다. 그러지 않으면 놓는 순간 제자리로 돌아갑니다.
      n.pinned = true; n.tx = n.x; n.ty = n.y;
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
        paintAll(); kick(); setStatus('');
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
      // 단추 꾸밈은 사이트의 .pv-tool 을 그대로 쓰므로 여기서 정하지 않습니다.
      //   제목(.pv-h) 아래 간격은 다른 섹션 머리(.pv-sechead)와 같은 18px 로 맞춥니다.
      + '.ocn-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:18px}'
      + '.ocn-toggle svg{flex:none}'
      + '.ocn-toggle[disabled]{opacity:.55;cursor:default}'
      + '.ocn-note{font-size:12.5px;color:var(--text-3,#8a9099);line-height:1.5}'
      // 배경에 아주 옅은 결을 줍니다. 순백은 평면으로 보입니다.
      + '.ocn-wrap{margin-top:12px;border:1px solid #e8eaee;border-radius:14px;overflow:hidden;'
      +   'background:radial-gradient(120% 90% at 50% 0%,#fdfdfe 0%,#f6f7f9 100%);'
      +   'box-shadow:0 1px 3px rgba(15,23,42,.05)}'
      + '.ocn-svg{display:block;width:100%;height:auto;touch-action:none}'
      // 줄 · 사제는 또렷하게, 문헌은 점선으로 물러나게
      + '.ocn-edge{fill:none;stroke-linecap:round;stroke:var(--ocn-edge,#d8d5e2);stroke-width:1.1;transition:stroke .12s,stroke-width .12s}'
      + '.ocn-edge.is-teach{stroke:var(--ocn-teach,#bdb4d2);stroke-width:1.5}'
      + '.ocn-edge.is-paper{stroke:var(--ocn-paper,#e0e2e8);stroke-dasharray:3 3}'
      + '.ocn-edge.is-hot{stroke:var(--ocn-hot,#7C63B0);stroke-width:2;opacity:.85}'
      + '.ocn-node{cursor:pointer}'
      + '.ocn-node .ocn-mark{stroke:#fff;stroke-width:1.4;transition:opacity .15s,stroke-width .12s}'
      + '.ocn-node:hover .ocn-mark{opacity:.82}'
      + '.ocn-ring{stroke-width:1.4;opacity:.5}'
      + '.ocn-node:focus{outline:none}'
      + '.ocn-node:focus .ocn-mark{stroke:#334155;stroke-width:2.2}'
      + '.ocn-node.is-center .ocn-mark{stroke-width:1.8}'
      // 이름은 네모 안에 흰 글자로 놓습니다. 밖에 떠 있지 않으니 테두리가 필요 없습니다.
      + '.ocn-label{font-weight:600;fill:#fff;text-anchor:middle;letter-spacing:-.01em;'
      +   'pointer-events:none;user-select:none}'
      // 손을 올린 것과 이어진 네모는 흰 테두리로 살짝 도드라지게
      + '.ocn-node.is-near .ocn-mark{stroke-width:2.6}'
      + '.ocn-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;'
      +   'padding:9px 14px;border-top:1px solid #eef0f3;background:rgba(255,255,255,.72);'
      +   'font-size:11.5px;color:#8a9099}'
      + '.ocn-legend{display:flex;align-items:center;gap:11px;flex-wrap:wrap}'
      + '.ocn-lg{display:inline-flex;align-items:center;gap:5px;color:#6b7280}'
      + '.ocn-dot{width:9px;height:9px;display:inline-block}'
      // ── 모달 ──
      + 'html.ocn-lock{overflow:hidden}'
      + '.ocn-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;'
      +   'justify-content:center;padding:24px;background:rgba(15,23,42,.42);'
      +   'backdrop-filter:blur(2px);animation:ocn-fade .16s ease-out}'
      + '@keyframes ocn-fade{from{opacity:0}to{opacity:1}}'
      + '.ocn-modal{width:min(1320px,96vw);max-height:92vh;display:flex;flex-direction:column;'
      +   'background:#fff;border-radius:16px;overflow:hidden;'
      +   'box-shadow:0 24px 60px rgba(15,23,42,.28)}'
      + '.ocn-mhead{display:flex;align-items:center;gap:12px;padding:14px 18px;'
      +   'border-bottom:1px solid #eef0f3;flex-wrap:wrap}'
      + '.ocn-mtitle{font-size:15px;color:#1f2937;letter-spacing:-.01em}'
      + '.ocn-msub{flex:1;min-width:120px;font-size:12px;color:#8a9099}'
      + '.ocn-close{appearance:none;border:1px solid #e5e7eb;background:#fff;color:#6b7280;'
      +   'width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1}'
      + '.ocn-close:hover{background:#f3f4f6;color:#111827}'
      + '.ocn-mbody{flex:1;min-height:0;overflow:auto;padding:8px 12px 12px}'
      + '.ocn-mbody .ocn-wrap{margin-top:4px;border:0;box-shadow:none;border-radius:10px}'
      + '.ocn-loading{padding:64px 0;text-align:center;color:#8a9099;font-size:13px}'
      + '@media (max-width:640px){.ocn-label{font-size:11.5px;stroke-width:3.6px}'
      +   '.ocn-bar{font-size:11px;gap:10px}'
      +   '.ocn-ov{padding:10px}.ocn-modal{width:100%;max-height:96vh}'
      +   '.ocn-msub{display:none}}';
    var st = document.createElement('style');
    st.id = 'ocn-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- 열기 ---------- */

  function legendHTML(types) {
    return types.map(function (t) {
      return '<span class="ocn-lg"><i class="ocn-dot" style="background:' + COLOR[t] + ';'
           + legendMark(t) + '"></i>' + esc(KIND_KO[t] || t) + '</span>';
    }).join('');
  }

  function open(type, id, mount, opt) {
    if (!TABLE[type]) return Promise.resolve(false);
    injectCSS();

    opt = opt || {};
    G.nodes = []; G.edges = []; G.index = {}; G.frames = 0; G.trimmed = 0; G.maxDepth = 1;
    G.mount = mount;
    // 모달은 화면을 넓게 쓰므로 그림판도 크게 잡습니다.
    G.W = opt.wide ? 1280 : 900;
    G.H = opt.wide ? 660  : 520;
    G.baseH = G.H;
    G.baseW = G.W;

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
          G.kinds = kinds;
          bar.innerHTML = '<span class="ocn-legend">' + legendHTML(Object.keys(kinds)) + '</span>'
                        + '<span class="ocn-count"></span><span class="ocn-status"></span>'
                        ;
          wrap.appendChild(bar);

          mount.appendChild(wrap);
          G.wrap    = wrap;
          G.counter = bar.querySelector('.ocn-count');
          G.status  = bar.querySelector('.ocn-status');
          G.legend  = bar.querySelector('.ocn-legend');
          // 줄 빛깔은 CSS 변수로 넘깁니다
          wrap.style.setProperty('--ocn-edge',  EDGE.base);
          wrap.style.setProperty('--ocn-teach', EDGE.teach);
          wrap.style.setProperty('--ocn-paper', EDGE.paper);
          wrap.style.setProperty('--ocn-hot',   EDGE.hot);

          paintAll();
          kick();
          return true;
        });
      });
  }

  /* ---------- 모달 ----------
     좁은 자리에 그리면 점 서른 개가 뭉칩니다.
     넓은 창을 띄워 보여 주고, 닫으면 페이지는 그대로 남습니다.
  */

  function openModal(type, id, title) {
    injectCSS();

    var ov = document.createElement('div');
    ov.className = 'ocn-ov';
    ov.innerHTML =
      '<div class="ocn-modal" role="dialog" aria-modal="true" aria-label="관계 지도">' +
        '<div class="ocn-mhead">' +
          '<b class="ocn-mtitle">관계 지도</b>' +
          '<span class="ocn-msub"></span>' +
          '<button type="button" class="ocn-close" aria-label="닫기">✕</button>' +
        '</div>' +
        '<div class="ocn-mbody"><div class="ocn-loading">불러오는 중…</div></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('ocn-lock');

    var body = ov.querySelector('.ocn-mbody');
    var sub  = ov.querySelector('.ocn-msub');
    sub.textContent = (title ? title + ' · ' : '')
      + '점을 누르면 오른쪽으로 이어서 펼쳐집니다 · 끌어서 옮길 수 있습니다';

    function close() {
      G.running = false;
      document.documentElement.classList.remove('ocn-lock');
      document.removeEventListener('keydown', onKey);
      ov.remove();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    ov.querySelector('.ocn-close').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
    ov.querySelector('.ocn-close').focus();

    return open(type, id, body, { wide: true }).then(function (ok) {
      var l = body.querySelector('.ocn-loading');
      if (l) l.remove();
      if (!ok) body.innerHTML = '<div class="ocn-loading">이을 관계가 없습니다.</div>';
      return ok;
    }).catch(function () {
      var l = body.querySelector('.ocn-loading');
      if (l) l.textContent = '불러오지 못했습니다.';
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
    // 제목과 단추는 사이트에 이미 있는 것을 그대로 씁니다.
    //   .pv-h    · 왼쪽에 보라 세로선이 붙는 섹션 제목 (다른 섹션과 같은 꼴)
    //   .pv-tool · 즐겨찾기 · 킵 · 공유에 쓰는 표준 단추
    //   여기서 따로 꾸미면 옆 섹션과 어긋나고, 사이트 단추 모양이 바뀔 때 혼자 남습니다.
    sec.innerHTML =
      '<h2 class="pv-h">관계 지도 <span class="pv-h-en">Network</span></h2>' +
      '<div class="ocn-head">' +
        '<button type="button" class="pv-tool ocn-toggle">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
            '<circle cx="3.2" cy="8" r="2.1" fill="currentColor"/>' +
            '<circle cx="12.8" cy="3.6" r="1.7" fill="currentColor"/>' +
            '<circle cx="12.8" cy="12.4" r="1.7" fill="currentColor"/>' +
            '<path d="M4.9 7.1 11.2 4.2M4.9 8.9 11.2 11.8" stroke="currentColor" stroke-width="1.1"/>' +
          '</svg>' +
          '관계망 크게 보기' +
        '</button>' +
        '<span class="ocn-note">사사관계 · 출신 학교 · 소속 단체 · 관련 문헌을 한 그림으로 봅니다.</span>' +
      '</div>';

    // 관계 목록 다음, 제보 · 출처 안내 앞에 둡니다.
    var contrib = art.querySelector('.pv-contrib');
    if (contrib) art.insertBefore(sec, contrib);
    else art.appendChild(sec);

    // 페이지에 붙는 것은 안내와 단추뿐입니다. 그림은 모달에서 그립니다.
    var btn = sec.querySelector('.ocn-toggle');
    var title = (document.querySelector('.pv-title, .pv h1, h1') || {}).textContent || '';
    title = String(title).trim().split('\n')[0].slice(0, 40);

    btn.addEventListener('click', function () {
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = '불러오는 중…';
      openModal(type, id, title).then(function () {
        btn.disabled = false;
        btn.textContent = old;
      });
    });
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  window.OCNetwork = { boot: boot, open: open, openModal: openModal };
})();
