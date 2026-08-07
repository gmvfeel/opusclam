/* ============================================================
   OPUSCLAM 메뉴 메인 페이지 공용 엔진 — assets/hub.js
   ------------------------------------------------------------
   DATABASE · OC커뮤니티 같은 "메뉴별 메인 화면"을 config 로 만든다.
   나중에 정보SPOT · 레슨:ON · 리쿠르트 메인도 같은 엔진으로 만들 수 있고,
   오퍼스파인(미술)에도 그대로 복제된다.

   OCHub.init({
     sources: [ ... ],        // 어떤 표에서 무엇을 가져올지
     counter: '.hub-total',   // 전체 건수를 넣을 곳 (선택)
     cards:   '.hub-cards',   // 영역 카드 (선택)
     latest:  '.hub-latest',  // 새로 등록된 항목 (선택)
     fresh:   '.hub-fresh',   // 새로 보강된 항목 (선택)
     rich:    '.hub-rich',    // 정보가 충실한 항목 (선택)
     n:       12              // 리스트에 보여줄 개수
   });

   source 하나의 모양
     { key, label, table, list, view,
       name:'name_ko', name2:'name_en', desc:'description',
       img:'image_url', meta:['field','life'] }

   ※ 어떤 표가 실패해도 그 표만 건너뛰고 나머지는 정상 표시한다.
   ============================================================ */
window.OCHub = (function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function txt(s, n) {
    s = String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (s && /^[|{]/.test(s)) return '';          // 위키 틀 코드는 소개문으로 보지 않는다
    return (n && s.length > n) ? s.slice(0, n) + '…' : s;
  }
  function ymd(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  }
  function join(a) { return a.filter(function (x) { return x != null && String(x).trim() !== ''; }).join(' · '); }

  /* 위키미디어 원본을 작은 이미지로 */
  /* ── 그림을 알맞은 크기로 ────────────────────────────────

     큰 그림을 화면에서 잘게 줄이면 계단이 생겨 지글거립니다.
     KOPIS 공연 포스터는 폭이 500~800px 인데 목록에서는 80px 로 그리니
     여덟 배 넘게 줄어들어 특히 눈에 띕니다.

     그래서 「보낼 때부터 알맞은 크기로」 받습니다.
       · 위키미디어  — 그쪽이 줄여 주는 길이 있어 그것을 씁니다 (값 0원)
       · 유튜브      — 이미 여러 크기를 주므로 그대로 씁니다
       · 그 밖        — 무료 그림 줄이는 곳(images.weserv.nl)을 거칩니다

     거치는 곳이 멈추면 그림이 안 보일 수 있으므로,
     그림을 그리는 쪽에서 실패하면 원본으로 되돌리게 해 두었습니다.
     ────────────────────────────────────────────────────── */
  function thumb(u, w) {
    if (!u) return '';
    u = String(u).replace(/^http:\/\//, 'https://');

    /* 위키미디어 — 그쪽 방식으로 줄입니다 */
    if (u.indexOf('Special:FilePath') >= 0) return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w;
    if (u.indexOf('upload.wikimedia.org') >= 0 && u.indexOf('/thumb/') < 0) {
      var i = u.indexOf('/wikipedia/');
      if (i >= 0) {
        var p = u.slice(i + 11).split('/');
        if (p.length >= 4) {
          var proj = p[0], a = p[1], b = p[2], fn = p.slice(3).join('/');
          if (a.length === 1 && b.length === 2) {
            var t = u.slice(0, i + 11) + proj + '/thumb/' + a + '/' + b + '/' + fn + '/' + w + 'px-' + fn;
            if (fn.toLowerCase().slice(-4) === '.svg') t += '.png';
            return t;
          }
        }
      }
      return u;
    }
    return resize(u, w);
  }

  /* 그림 줄이는 곳을 거칩니다 — 값이 들지 않고 열쇠도 필요 없습니다 */
  function resize(u, w) {
    if (!u || !w) return u || '';
    u = String(u).replace(/^http:\/\//, 'https://');
    /* 이미 거친 것, 위키미디어 축소본, 유튜브 썸네일은 그대로 */
    if (u.indexOf('images.weserv.nl') >= 0) return u;
    if (u.indexOf('/thumb/') >= 0 && u.indexOf('wikimedia') >= 0) return u;
    if (u.indexOf('ytimg.com') >= 0 || u.indexOf('youtube.com') >= 0) return u;
    if (u.indexOf('data:') === 0 || u.charAt(0) === '/') return u;   /* 우리 쪽 그림 */
    /* 고해상도 화면에서도 또렷하도록 두 배로 받습니다 */
    var px = Math.round(Math.min(w * 2, 1200));
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(u)
         + '&w=' + px + '&output=webp&q=82&we';
  }

  /* 표 하나 조회 — 실패하면 null */
  function ask(src, opt) {
    var cols = ['id', src.name];
    if (src.name2) cols.push(src.name2);
    if (src.desc) cols.push(src.desc);
    if (src.img) cols.push(src.img);
    (src.meta || []).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
    if (opt.order) cols.push(opt.order.split('.')[0]);
    var sel = cols.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(',');

    var url = SB_URL + '/rest/v1/' + src.table + '?select=' + sel
            + (src.noHidden ? '' : '&hidden=is.false')
            + (opt.filter || '')
            + (opt.order ? '&order=' + opt.order : '')
            + '&limit=' + (opt.n || 12);
    return fetch(url, { headers: Object.assign({ Prefer: 'count=exact' }, HDR) })
      .then(function (r) {
        var total = 0, cr = r.headers.get('content-range');
        if (cr) { var q = cr.split('/')[1]; if (q && q !== '*') total = parseInt(q, 10) || 0; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(function (rows) { return { src: src, rows: rows || [], total: total }; });
      })
      .catch(function (e) {
        console.warn('[메인] ' + src.label + '(' + src.table + ') 건너뜀:', e.message);
        return null;
      });
  }

  /* 한 항목을 공통 모양으로 */
  function norm(src, r, dateCol) {
    return {
      key: src.key, label: src.label,
      href: (src.view ? src.view + '?id=' + encodeURIComponent(r.id) : src.list),
      name: r[src.name] || (src.name2 ? r[src.name2] : '') || '(이름 없음)',
      name2: (r[src.name] && src.name2 && r[src.name2] !== r[src.name]) ? r[src.name2] : '',
      /* 넉넉히 담는다. 리스트에서는 CSS 가 폭에 맞춰 자르고(…),
         카드에서는 두 줄까지 보여준다. 짧게 자르면 오른쪽이 비어 보인다. */
      desc: src.desc ? txt(r[src.desc], 220) : '',
      meta: join((src.meta || []).map(function (c) { return r[c]; })),
      img: src.img ? thumb(r[src.img], 128) : '',
      date: ymd(r[dateCol])
    };
  }

  /* ── 화면 조각 ── */
  function rowHtml(it) {
    return '<a class="hub-row" href="' + esc(it.href) + '">'
      + '<span class="hub-badge hub-' + esc(it.key) + '">' + esc(it.label) + '</span>'
      + (it.img
          ? '<span class="hub-th"><img src="' + esc(it.img) + '" alt="" loading="lazy"></span>'
          : '<span class="hub-th hub-th-ph">' + esc(it.name.trim().charAt(0)) + '</span>')
      + '<span class="hub-info">'
      +   '<span class="hub-name">' + esc(it.name)
      +     (it.name2 ? ' <em>' + esc(it.name2) + '</em>' : '') + '</span>'
      +   '<span class="hub-sub">' + esc(it.desc || it.meta) + '</span>'
      + '</span>'
      + '<span class="hub-date">' + esc(it.date) + '</span>'
      + '<span class="hub-view">VIEW <b>+</b></span>'
      + '</a>';
  }
  function cardHtml(it) {
    return '<a class="hub-card" href="' + esc(it.href) + '">'
      + (it.img
          ? '<span class="hub-cardimg"><img src="' + esc(it.img) + '" alt="" loading="lazy"></span>'
          /* 사진이 없을 때 — 어두운 바탕에 오퍼스클램 로고를 옅게 얹습니다.
             예전에는 「NO IMAGE」 라는 글자를 보여 주었습니다. */
          : '<span class="hub-cardimg hub-cardimg-ph">'
            + '<img src="/assets/logo.png" alt="OPUSCLAM" loading="lazy">'
            + '</span>')
      + '<span class="hub-cardbody">'
      +   '<span class="hub-badge hub-' + esc(it.key) + '">' + esc(it.label) + '</span>'
      +   '<span class="hub-name">' + esc(it.name) + '</span>'
      +   '<span class="hub-sub">' + esc(it.desc || it.meta) + '</span>'
      +   '<span class="hub-cardfoot">' + esc(it.date) + '<b>VIEW +</b></span>'
      + '</span></a>';
  }
  function skelRows(n) {
    var one = '<div class="hub-row hub-skelrow">'
      + '<span class="hub-skel w2"></span><span class="hub-th"></span>'
      + '<span class="hub-info"><span class="hub-skel w5"></span><span class="hub-skel w7"></span></span></div>';
    var s = ''; for (var i = 0; i < n; i++) s += one; return s;
  }
  function skelCards(n) {
    var one = '<div class="hub-card hub-skelcard"><span class="hub-cardimg"></span>'
      + '<span class="hub-cardbody"><span class="hub-skel w4"></span><span class="hub-skel w7"></span></span></div>';
    var s = ''; for (var i = 0; i < n; i++) s += one; return s;
  }

  /* ── 게시판 자리표 (2026-08-06 · 파트너 요청) ────────────────
     ★ 왜 만들었나
       정보SPOT 메인의 「공연정보」는 포스터 넉 장이 들어가는 자리인데,
       기다리는 동안 <b>짧은 회색 막대 두 개</b>만 보였습니다. 그래서
       화면이 비어 보이고, 자료가 오는 순간 <b>갑자기 늘어났습니다.</b>
     ★ 실제 카드와 <b>같은 클래스</b>(bd-card · bd-cardimg · bd-cardbody)를
       씁니다. 그러면 포스터 비율(3/4)이나 칸 간격을 여기서 다시 적지
       않아도 <b>저절로 맞습니다.</b> 자리가 바뀌지 않으니 자료가 와도
       화면이 튀지 않습니다.
     ★ 갈래마다 모양이 다릅니다 — 포스터는 카드, 목록은 줄. */
  function skelBoard(kind, n) {
    n = n || 4;
    var one;
    if (kind === 'cards') {
      one = '<span class="bd-card bd-skelc" aria-hidden="true">'
          +   '<span class="bd-cardimg"><span class="hub-skel full"></span></span>'
          +   '<span class="bd-cardbody">'
          +     '<span class="hub-skel w2"></span>'
          +     '<span class="hub-skel w7"></span>'
          +     '<span class="hub-skel w4"></span>'
          +   '</span>'
          + '</span>';
    } else if (kind === 'feature') {
      one = '<div class="bd-skelf" aria-hidden="true">'
          +   '<span class="hub-skel w3"></span>'
          +   '<span class="hub-skel w8"></span>'
          +   '<span class="hub-skel w6"></span>'
          + '</div>';
      n = 1;
    } else {
      one = '<div class="bd-loading" aria-hidden="true">'
          +   '<span class="hub-skel w5"></span><span class="hub-skel w7"></span>'
          + '</div>';
      n = Math.min(n, 5);
    }
    var out = '';
    for (var i = 0; i < n; i++) out += one;
    return out;
  }

  /* ── 영역 카드 (7개 DB 등) ── */
  function drawCards(box, sources) {
    box.innerHTML = sources.map(function (s) {
      /* 카드마다 그 영역의 색을 쓴다 (구성 스택바·배지와 같은 색) */
      var col = DB_COLOR[s.key] || '#8b95a8';
      return '<a class="hub-navcard" href="' + esc(s.list) + '" style="--c:' + col + '">'
        + '<span class="hub-navlabel">' + esc(s.label) + '</span>'
        + '<span class="hub-navcount"><b data-k="' + esc(s.key) + '">—</b><i>건</i></span>'
        + '</a>';
    }).join('');
  }

  function init(cfg) {
    var srcs = cfg.sources || [];
    var N = cfg.n || 12;

    var cardsBox = cfg.cards ? document.querySelector(cfg.cards) : null;
    var latestBox = cfg.latest ? document.querySelector(cfg.latest) : null;
    var freshBox = cfg.fresh ? document.querySelector(cfg.fresh) : null;
    var richBox = cfg.rich ? document.querySelector(cfg.rich) : null;
    var totalEl = cfg.counter ? document.querySelector(cfg.counter) : null;

    if (cardsBox) drawCards(cardsBox, srcs);
    if (latestBox) latestBox.innerHTML = skelRows(6);
    if (freshBox) freshBox.innerHTML = skelCards(4);
    if (richBox) richBox.innerHTML = skelCards(4);

    /* ① 건수 — 카드와 전체 카운터 */
    Promise.all(srcs.map(function (s) {
      return ask(s, { n: 1, order: null });
    })).then(function (list) {
      var total = 0;
      list.forEach(function (r) {
        if (!r) return;
        total += r.total;
        if (cardsBox) {
          var el = cardsBox.querySelector('[data-k="' + r.src.key + '"]');
          if (el) el.textContent = r.total.toLocaleString();
        }
      });
      /* ★ 전체 건수를 <b>바로 올리지 않고 담아 둘</b> 수 있습니다 (2026-08-06)
         무엇이 문제였나 — 이 숫자는 표 일곱 개를 세는 것이라 <b>빨리</b>
         끝나는데, 아래 「데이터 성장 추이」는 30일 집계라 <b>한참</b>
         걸립니다. 그래서 숫자만 다 올라간 채 아래가 비어 있어
         「멈춘 것」처럼 보였습니다(파트너 지적).
         ▶ counterHold: true 를 주면 값만 담아 두고, 성장 추이가 끝날 때
           OCHub.releaseCounter() 로 터뜨립니다.
         ★ 성장 추이가 <b>실패해도</b> 숫자는 나옵니다 — 값은 이미 여기서
           구해 두었고, 터뜨리는 일만 미루는 것입니다. */
      if (totalEl) {
        if (cfg.counterHold) totalEl.setAttribute('data-oc-total', String(total));
        else countUp(totalEl, total);
      }
    });

    /* ② 새로 등록된 항목 — 여러 표를 합쳐 최신순 */
    if (latestBox) {
      Promise.all(srcs.map(function (s) {
        return ask(s, { n: N, order: 'created_at.desc.nullslast' });
      })).then(function (list) {
        var items = [];
        list.forEach(function (r) {
          if (!r) return;
          r.rows.forEach(function (row) {
            var it = norm(r.src, row, 'created_at');
            it._t = row.created_at ? new Date(row.created_at).getTime() : 0;
            items.push(it);
          });
        });
        items.sort(function (a, b) { return b._t - a._t; });
        var top = items.slice(0, N);
        latestBox.innerHTML = top.length
          ? top.map(rowHtml).join('')
          : '<p class="hub-empty">아직 등록된 항목이 없습니다.</p>';
      });
    }

    /* ③ 새로 보강된 항목 — updated_at 이 채워진 것부터
          아직 기록이 없으면 ④ 충실한 항목으로 대신 보여준다 */
    if (freshBox) {
      Promise.all(srcs.map(function (s) {
        return ask(s, { n: 8, order: 'updated_at.desc.nullslast', filter: '&updated_at=not.is.null' });
      })).then(function (list) {
        var items = [];
        list.forEach(function (r) {
          if (!r) return;
          r.rows.forEach(function (row) {
            if (!row.updated_at) return;
            var it = norm(r.src, row, 'updated_at');
            it._t = new Date(row.updated_at).getTime();
            items.push(it);
          });
        });
        items.sort(function (a, b) { return b._t - a._t; });
        var top = items.slice(0, cfg.freshN || 8);
        if (top.length) { freshBox.innerHTML = top.map(cardHtml).join(''); return; }
        /* 기록이 아직 없을 때 — 충실한 항목으로 대체 */
        fillRich(freshBox, srcs, cfg.freshN || 8, true);
      });
    }

    /* ④ 정보가 충실한 항목 */
    if (richBox) fillRich(richBox, srcs, cfg.richN || 8, false);
  }

  function fillRich(box, srcs, n, note) {
    Promise.all(srcs.map(function (s) {
      return ask(s, { n: 6, order: 'sort_no.desc.nullslast' });
    })).then(function (list) {
      var items = [];
      list.forEach(function (r) {
        if (!r) return;
        r.rows.forEach(function (row) {
          var it = norm(r.src, row, 'created_at');
          if (!it.img && !it.desc) return;         // 사진도 소개도 없으면 카드로 부적합
          items.push(it);
        });
      });
      /* 표별로 골고루 섞는다 (한 표가 화면을 다 차지하지 않게) */
      var byKey = {};
      items.forEach(function (it) { (byKey[it.key] = byKey[it.key] || []).push(it); });
      var keys = Object.keys(byKey), out = [], i = 0;
      while (out.length < n && keys.length) {
        var k = keys[i % keys.length];
        if (byKey[k].length) out.push(byKey[k].shift());
        else { keys.splice(i % keys.length, 1); continue; }
        i++;
      }
      box.innerHTML = out.length
        ? out.map(cardHtml).join('')
          + (note ? '<p class="hub-note">보강 기록이 쌓이면 최근 보강된 항목이 표시됩니다.</p>' : '')
        : '<p class="hub-empty">표시할 항목이 없습니다.</p>';
    });
  }

  /* 숫자가 올라가는 카운터 */
  function countUp(el, to) {
    var dur = 900, t0 = 0;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── 담아 둔 전체 건수를 터뜨립니다 ─────────────────────────
     counterHold 로 미뤄 둔 숫자를 올립니다. 아직 값이 없으면(건수 조회가
     덜 끝났으면) 조금 기다렸다 다시 봅니다 — 최대 6초.
     ★ 두 번 불러도 한 번만 올라갑니다. */
  function releaseCounter(sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el || el.__ocReleased) return;
    var n = 0;
    (function wait() {
      var v = el.getAttribute('data-oc-total');
      if (v != null && v !== '') {
        el.__ocReleased = true;
        el.removeAttribute('data-oc-total');
        countUp(el, Number(v) || 0);
        return;
      }
      if (++n > 60) return;              /* 6초까지 기다립니다 */
      setTimeout(wait, 100);
    })();
  }

  /* 리스트 ↔ 카드 보기 전환 (버튼이 있을 때만) */
  function bindViewToggle(sel, box) {
    var wrap = document.querySelector(sel);
    var target = document.querySelector(box);
    if (!wrap || !target) return;
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-view]');
      if (!b) return;
      var v = b.getAttribute('data-view');
      wrap.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('on', x === b); });
      target.classList.toggle('as-grid', v === 'grid');
    });
  }


  /* ============================================================
     게시판 조각 — 커뮤니티 메인처럼 "게시판을 여러 모양으로" 보여줄 때
     OCHub.board({ el, table, kind, n, view, label, order, filter, skip })
       kind : 'cards'   사진 카드 (Concert PR 처럼)
              'rows'    한 줄 목록
              'feature' 큰 피처 1건
              'compact' 날짜 + 제목만 (좁은 칸용)
     ============================================================ */
  function bTxt(s, n) {
    s = String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return (n && s.length > n) ? s.slice(0, n) + '…' : s;
  }
  function bHref(cfg, r) {
    return cfg.view ? cfg.view + '?id=' + encodeURIComponent(r.id) : (cfg.list || '#');
  }
  /* 어느 칸의 날짜를 보여 줄지 — 적지 않으면 올린 날(created_at)
     정보SPOT 처럼 「여는 날·마감일」이 중요한 곳에서 dateCol 로 바꿉니다.
       OCHub.board({ ..., dateCol:'deadline' })
     쓰지 않는 화면에는 아무 영향이 없습니다. */
  function bDate(cfg, r) {
    /* dateCol 을 적었으면 그 칸만 봅니다.
       그 칸이 비어 있으면 날짜를 비웁니다 — 올린 날로 대신하면
       마감일도 개최일도 없는 항목이 모두 「오늘」로 보여 잘못 읽힙니다. */
    if (cfg.dateCol) {
      var v = ymd(r[cfg.dateCol]);
      /* dateFallback 을 켜면 그 칸이 비었을 때 올린 날로 대신합니다.
         목록 오른쪽이 뻥 비어 보이는 것을 막고 싶을 때 씁니다. */
      if (!v && cfg.dateFallback) return ymd(r.created_at);
      return v;
    }
    return ymd(r.created_at);
  }
  function askBoard(cfg) {
    var cols = cfg.cols || 'id,category,title,body,thumb_url,author_name,created_at';
    var url = SB_URL + '/rest/v1/' + cfg.table + '?select=' + cols
            + (cfg.filter || '')
            + '&order=' + (cfg.order || 'created_at.desc.nullslast')
            + '&limit=' + ((cfg.n || 4) + (cfg.skip || 0));
    return fetch(url, { headers: Object.assign({ Prefer: 'count=exact' }, HDR) })
      .then(function (r) {
        var total = 0, cr = r.headers.get('content-range');
        if (cr) { var q = cr.split('/')[1]; if (q && q !== '*') total = parseInt(q, 10) || 0; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(function (rows) {
          return { rows: (rows || []).slice(cfg.skip || 0), total: total };
        });
      })
      .catch(function (e) {
        console.warn('[게시판] ' + (cfg.label || cfg.table) + ' 건너뜀:', e.message);
        return null;
      });
  }

  /* 재생시간 — 7:32 · 1:05:20 */
  function durText(sec) {
    var t = Number(sec) || 0;
    if (!t) return '';
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s2 = t % 60;
    return h ? (h + ':' + ('0' + m).slice(-2) + ':' + ('0' + s2).slice(-2))
             : (m + ':' + ('0' + s2).slice(-2));
  }

  function bCard(cfg, r) {
    var img = r.thumb_url || r.logo_url || '';
    /* 영상이면 재생시간 배지와 재생 표시를 얹습니다.
       음원·동영상 목록에 쓰이며, 그 칸이 없는 게시판에는 아무 영향이 없습니다. */
    var dur = durText(r.duration_sec);
    var isVideo = !!r.video_id;
    /* 한국어 표기가 있으면 그것을 앞세웁니다 (일본어·독일어 제목 때문입니다) */
    var head = (cfg.koField && r[cfg.koField]) ? r[cfg.koField] : r.title;
    return '<a class="bd-card' + (isVideo ? ' is-video' : '') + '" href="' + esc(bHref(cfg, r)) + '">'
      + (img
          ? '<span class="bd-cardimg"><img src="' + esc(thumb(img, 480)) + '" alt="" loading="lazy">'
            + (dur ? '<i class="bd-dur">' + dur + '</i>' : '')
            + (isVideo ? '<i class="bd-playmark" aria-hidden="true">&#9654;</i>' : '')
            + '</span>'
          : '<span class="bd-cardimg bd-noimg"><i>' + esc((head || '?').trim().charAt(0)) + '</i></span>')
      + '<span class="bd-cardbody">'
      +   (r.category ? '<span class="bd-cat">' + esc(r.category) + '</span>' : '')
      +   '<span class="bd-title">' + esc(bTxt(head, 46)) + '</span>'
      /* 밑줄 — 기본은 본문 앞부분이지만, cfg.cardSub 를 주면 그것으로 바꿉니다.
         공연 카드에는 본문보다 「기간 · 공연장」 이 훨씬 쓸모 있습니다. */
      +   '<span class="bd-desc">'
      +     esc(cfg.cardSub ? cfg.cardSub(r) : bTxt(r.body, 74))
      +   '</span>'
      + '</span></a>';
  }
  function bRow(cfg, r) {
    var img = r.thumb_url || '';
    return '<a class="bd-row" href="' + esc(bHref(cfg, r)) + '">'
      + (img ? '<span class="bd-rowimg"><img src="' + esc(thumb(img, 240)) + '" alt="" loading="lazy"></span>' : '')
      + '<span class="bd-rowbody">'
      +   '<span class="bd-title">' + esc(bTxt(r.title, 60)) + '</span>'
      +   '<span class="bd-desc">' + esc(bTxt(r.body, 130)) + '</span>'
      +   '<span class="bd-meta">' + esc(join([r.category, r.author_name, bDate(cfg, r)])) + '</span>'
      + '</span>'
      + '<span class="bd-go">VIEW DETAIL <b>&rarr;</b></span>'
      + '</a>';
  }
  function bFeature(cfg, r) {
    var img = r.thumb_url || '';
    return '<a class="bd-feat" href="' + esc(bHref(cfg, r)) + '">'
      + (img ? '<span class="bd-featimg"><img src="' + esc(thumb(img, 640)) + '" alt="" loading="lazy"></span>' : '')
      + '<span class="bd-featbody">'
      +   '<span class="bd-featcat">' + esc(cfg.badge || r.category || 'HOT TOPIC') + '</span>'
      +   '<span class="bd-feattitle">' + esc(bTxt(r.title, 70)) + '</span>'
      +   '<span class="bd-featdesc">' + esc(bTxt(r.body, 210)) + '</span>'
      +   '<span class="bd-meta">' + esc(join([r.author_name, bDate(cfg, r)])) + '</span>'
      + '</span>'
      + '<span class="bd-featgo">VIEW DETAIL <b>&rarr;</b></span>'
      + '</a>';
  }
  /* 좁은 칸용 한 줄 목록.
     번호 → 제목 → 날짜 순서입니다. 제목이 먼저 눈에 들어와야 하고,
     제목 칸이 남은 폭을 다 차지하므로 날짜는 오른쪽 끝에 붙습니다. */
  function bCompact(cfg, r, i) {
    var no = ('0' + ((i || 0) + 1)).slice(-2);
    var dt = bDate(cfg, r);
    /* 제목 아래 한 줄 설명.
       제목만 두면 가운데가 비어 보이고, 무엇에 관한 항목인지 목록에서 알기 어렵습니다.
       설명이 없는 게시판에서는 이 줄이 아예 생기지 않으므로 예전과 같아 보입니다. */
    /* 넉넉히 잘라 넘기고, 실제로 몇 자까지 보일지는 CSS 가 칸 폭에 맞춰 정합니다.
       여기서 짧게 자르면 넓은 화면에서 오른쪽이 비어 보입니다. */
    var desc = bTxt(r.body, cfg.descLen || 90);
    return '<a class="bd-line" href="' + esc(bHref(cfg, r)) + '">'
      + '<span class="bd-no">' + no + '</span>'
      + '<span class="bd-lbody">'
      +   '<span class="bd-linetitle">' + esc(bTxt(r.title, 58))
      +     (r.comment_count ? ' <span class="bd-cc">[' + r.comment_count + ']</span>' : '')
      +   '</span>'
      +   (desc ? '<span class="bd-linedesc">' + esc(desc) + '</span>' : '')
      + '</span>'
      + bTags(cfg, r, dt)
      + '</a>';
  }

  /* 목록 오른쪽에 구분 배지와 날짜를 놓습니다.
       cfg.badges = ['region','category'] 처럼 어느 칸을 배지로 보일지 적습니다.
     배지를 적지 않은 게시판은 예전처럼 날짜만 나옵니다. */
  function bTags(cfg, r, dt) {
    var cols = cfg.badges || [];
    var tags = '';
    for (var k = 0; k < cols.length; k++) {
      var v = r[cols[k]];
      if (v) tags += '<i class="bd-tag" data-t="' + esc(v) + '">' + esc(v) + '</i>';
    }
    if (!tags && !dt) return '';
    /* 배지가 없으면 예전처럼 날짜만 놓습니다 —
       배지를 쓰지 않는 게시판의 모습이 달라지지 않게 하기 위해서입니다. */
    if (!tags) return '<span class="bd-date">' + esc(dt) + '</span>';
    return '<span class="bd-lmeta">'
      + tags
      + (dt ? '<span class="bd-date">' + esc(dt) + '</span>' : '')
      + '</span>';
  }
  var RENDER = { cards: bCard, rows: bRow, feature: bFeature, compact: bCompact };

  function board(cfg) {
    var box = document.querySelector(cfg.el);
    if (!box) return;
    /* ★ 갈래에 맞는 자리표를 먼저 놓습니다 — 예전에는 갈래와 상관없이
       짧은 막대 두 개만 두어, 포스터 자리가 비어 보였습니다. */
    box.innerHTML = skelBoard(cfg.kind, cfg.skelN || 4);
    askBoard(cfg).then(function (res) {
      if (!res || !res.rows.length) {
        box.innerHTML = '<p class="bd-empty">' + esc(cfg.emptyText || '아직 등록된 글이 없습니다.') + '</p>';
        return;
      }
      var fn = RENDER[cfg.kind] || bRow;
      box.innerHTML = res.rows.map(function (r, i) { return fn(cfg, r, i); }).join('');
      if (cfg.countEl) {
        var c = document.querySelector(cfg.countEl);
        if (c) c.textContent = res.total.toLocaleString();
      }
    });
  }

  /* 탭으로 여러 게시판을 번갈아 보여준다 */
  function boardTabs(cfg) {
    var tabsBox = document.querySelector(cfg.tabsEl);
    var listBox = document.querySelector(cfg.listEl);
    if (!tabsBox || !listBox) return;
    var cache = {};
    tabsBox.innerHTML = cfg.tabs.map(function (t, i) {
      return '<button type="button" class="bd-tab' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">'
        + esc(t.label) + '</button>';
    }).join('');
    function show(i) {
      var t = cfg.tabs[i];
      tabsBox.querySelectorAll('.bd-tab').forEach(function (b, k) { b.classList.toggle('on', k === i); });
      if (cache[i]) { listBox.innerHTML = cache[i]; return; }
      listBox.innerHTML = '<div class="bd-loading"><span class="hub-skel w5"></span><span class="hub-skel w7"></span></div>';
      askBoard({ table: t.table, view: t.view, list: t.list, label: t.label,
                 n: cfg.n || 3, cols: t.cols, filter: t.filter, order: t.order })
        .then(function (res) {
          var fn = RENDER[cfg.kind || 'rows'];
          /* 탭 하나하나에도 목록 설정을 넘깁니다.
             예전에 dateCol 을 넘기지 않아 탭 목록만 올린 날이 나오던 일이 있었습니다.
             그 뒤로 설정을 더할 때마다 이 줄에 함께 적어야 합니다. */
          var one = {
            view: t.view, list: t.list,
            dateCol: t.dateCol || cfg.dateCol,
            dateFallback: t.dateFallback !== undefined ? t.dateFallback : cfg.dateFallback,
            badges: t.badges || cfg.badges,
            koField: t.koField || cfg.koField,
            descLen: t.descLen || cfg.descLen
          };
          var html = (!res || !res.rows.length)
            ? '<p class="bd-empty">아직 등록된 글이 없습니다.</p>'
            : res.rows.map(function (r, i) { return fn(one, r, i); }).join('');
          cache[i] = html; listBox.innerHTML = html;
        });
    }
    tabsBox.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.bd-tab');
      if (!b) return;
      show(parseInt(b.getAttribute('data-i'), 10) || 0);
    });
    show(0);
  }

  /* 항목 하나를 골라 보여준다 (이달의 음악학교 등) */
  function one(cfg) {
    var box = document.querySelector(cfg.el);
    if (!box) return;
    var url = SB_URL + '/rest/v1/' + cfg.table + '?select=' + (cfg.cols || '*')
            + (cfg.filter || '') + '&order=' + (cfg.order || 'sort_no.desc.nullslast') + '&limit=' + (cfg.pool || 12);
    fetch(url, { headers: HDR })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows || !rows.length) { box.innerHTML = '<p class="bd-empty">표시할 항목이 없습니다.</p>'; return; }
        var r = rows[Math.floor(Math.random() * rows.length)];   // 후보 중 하나
        box.innerHTML = cfg.render ? cfg.render(r, { esc: esc, thumb: thumb, txt: bTxt }) : '';
      })
      .catch(function (e) {
        console.warn('[한 항목] ' + cfg.table + ' 건너뜀:', e.message);
        box.innerHTML = '';
      });
  }

  /* ============================================================
     지식나눔 상단 — 오늘 현황 · 분류 탭 · Best Q&A
     OCQna.top({ track, today:'#el', cats:'#el', best:'#el', catSel:'.board-catsel' })
     분류 탭을 누르면 board.js 의 분류 선택값을 바꿔 목록이 걸러진다
     (공용 엔진을 건드리지 않는 방식)
     ============================================================ */
  /* 분류 <select> 의 각 항목 뒤에 건수를 붙인다.
     원래 이름은 data-oc-base 에 보관하므로 여러 번 불려도 중복되지 않는다.
     항목이 아직 없으면(게시판 엔진이 늦게 만들면) 잠시 기다렸다 다시 시도한다 */
  function paintCatCount(sel, d, tries) {
    var cs = document.querySelector(sel);
    if (!cs || !cs.options.length) {
      if ((tries || 0) < 25) {
        setTimeout(function () { paintCatCount(sel, d, (tries || 0) + 1); }, 60);
      }
      return;
    }
    var byK = {};
    (d.cats || []).forEach(function (x) { byK[x.k] = x.n; });
    Array.prototype.forEach.call(cs.options, function (o) {
      var base = o.getAttribute('data-oc-base');
      if (base == null) { base = o.textContent; o.setAttribute('data-oc-base', base); }
      var n = o.value ? byK[o.value] : d.total;
      o.textContent = base + (n == null ? '' : ' (' + n.toLocaleString() + ')');
    });
  }

  function qnaTop(cfg) {
    var url = SB_URL + '/rest/v1/rpc/qna_stats'
            + (cfg.track ? '?p_track=' + encodeURIComponent(cfg.track) : '');
    var todayEl = cfg.today ? document.querySelector(cfg.today) : null;
    var catsEl  = cfg.cats  ? document.querySelector(cfg.cats)  : null;
    var bestEl  = cfg.best  ? document.querySelector(cfg.best)  : null;

    if (catsEl) catsEl.innerHTML = '<div class="qn-catskel"></div>';
    if (bestEl) bestEl.innerHTML = '<div class="bd-loading">'
      + '<span class="hub-skel w5"></span><span class="hub-skel w7"></span></div>';

    fetch(url, { headers: HDR })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) throw new Error('현황을 받지 못했습니다');

        /* 오늘의 새질문 · 답변 */
        if (todayEl) {
          todayEl.innerHTML =
            '<span class="qn-today"><i>오늘의 새질문</i><b>' + (d.today_q || 0).toLocaleString() + '</b></span>'
          + '<span class="qn-today"><i>오늘의 답변</i><b>' + (d.today_a || 0).toLocaleString() + '</b></span>';
        }

        /* 분류 탭 — 전체보기 + 분류별 건수 */
        if (catsEl) {
          var list = (d.cats || []).slice();
          var html = '<button type="button" class="qn-cat on" data-cat="">'
            + '전체보기 <b>(' + (d.total || 0).toLocaleString() + ')</b></button>';
          /* 페이지가 정해준 순서를 따르고, 없는 분류는 0 으로 보여준다 */
          var order = cfg.order || list.map(function (x) { return x.k; });
          var byK = {}; list.forEach(function (x) { byK[x.k] = x.n; });
          order.forEach(function (k) {
            html += '<button type="button" class="qn-cat" data-cat="' + esc(k) + '">'
              + esc(k) + ' <b>(' + (byK[k] || 0).toLocaleString() + ')</b></button>';
          });
          catsEl.innerHTML = html;

          catsEl.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.qn-cat');
            if (!b) return;
            catsEl.querySelectorAll('.qn-cat').forEach(function (x) { x.classList.toggle('on', x === b); });
            var sel = document.querySelector(cfg.catSel || '.board-catsel');
            if (sel) {
              sel.value = b.getAttribute('data-cat') || '';
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }

        /* 분류 드롭다운에 건수 붙이기 (격자를 쓰지 않는 페이지용)
           게시판 엔진이 option 을 만드는 시점과 순서가 어긋나도 되도록 잠시 기다린다 */
        if (cfg.catCount) paintCatCount(cfg.catCount, d, 0);

        /* Best Q&A — 좋아요 많은 질문과 첫 답변 */
        if (bestEl) {
          var best = d.best || [];
          if (!best.length) {
            bestEl.innerHTML = '<p class="bd-empty">아직 답변이 달린 질문이 없습니다.</p>';
            return;
          }
          var view = cfg.viewPage || 'qna-view.html';
          bestEl.innerHTML = '<div class="qn-bestwrap">'
            + '<div class="qn-besthead"><span class="qn-bestttl">Best Q&amp;A</span>'
            +   '<span class="qn-bestnav">'
            +     '<button type="button" class="qn-arw" data-best="prev" aria-label="이전">&#8249;</button>'
            +     '<button type="button" class="qn-arw" data-best="next" aria-label="다음">&#8250;</button>'
            +   '</span></div>'
            + '<div class="qn-besttrack">'
            +   best.map(function (b) {
                  return '<article class="qn-best">'
                    + '<a class="qn-q" href="' + esc(view + '?id=' + encodeURIComponent(b.id)) + '">'
                    +   '<span class="qn-mark">Q</span>'
                    +   '<span class="qn-qtitle">' + esc(bTxt(b.title, 80)) + '</span>'
                    +   '<span class="qn-who">' + esc(mask(b.author)) + '</span>'
                    + '</a>'
                    + '<div class="qn-a">'
                    +   '<span class="qn-mark qn-mark-a">A</span>'
                    +   '<span class="qn-atext">' + esc(bTxt(b.answer, 300)) + '</span>'
                    +   '<span class="qn-who">' + esc(mask(b.answer_by)) + '</span>'
                    + '</div>'
                    + '<div class="qn-bestfoot">'
                    +   (b.category ? '<span class="qn-bcat">' + esc(b.category) + '</span>' : '')
                    +   '<span class="qn-bnum">답변 ' + (b.answers || 0) + '</span>'
                    +   '<span class="qn-bnum">공감 ' + (b.likes || 0) + '</span>'
                    + '</div></article>';
                }).join('')
            + '</div></div>';

          /* 좌우 넘기기 */
          var track = bestEl.querySelector('.qn-besttrack');
          bestEl.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('[data-best]');
            if (!b || !track) return;
            var w = track.clientWidth || 600;
            track.scrollBy({ left: (b.getAttribute('data-best') === 'next' ? 1 : -1) * w, behavior: 'smooth' });
          });
        }
      })
      .catch(function (e) {
        console.warn('[지식나눔] 현황 건너뜀:', e.message);
        if (catsEl) catsEl.innerHTML = '';
        if (bestEl) bestEl.innerHTML = '';
      });
  }

  /* 이름 일부 가리기 (eunju**** 처럼) */
  function mask(nm) {
    var v = String(nm == null ? '' : nm).trim();
    if (!v) return '회원';
    if (v.length <= 2) return v + '***';
    return v.slice(0, Math.min(5, v.length - 1)) + '****';
  }

  /* 가로로 넘기는 캐러셀 (Concert PR 처럼) */
  /* 가로로 넘겨 보는 칸 — 화살표로 넘기고, 원하면 저절로 넘어가게 합니다.

     OCHub.bindCarousel('#wrap', '#track')                단추로만
     OCHub.bindCarousel('#wrap', '#track', { auto: 5000 })  다섯 초마다 저절로

     저절로 넘기기는 부르는 곳에서 켜야 합니다 —
     커뮤니티 메인에서도 이 함수를 쓰므로 기본으로 켜면
     요청하지 않은 곳까지 움직이게 됩니다. */
  function bindCarousel(wrapSel, trackSel, opts) {
    opts = opts || {};
    var wrap = document.querySelector(wrapSel), track = document.querySelector(trackSel);
    if (!wrap || !track) return;

    function cardW() {
      var card = track.querySelector(':scope > *');
      return card ? card.getBoundingClientRect().width + 14 : 280;
    }

    /* 어디로 갈지 「몇 번째 카드」 로 세어 그 자리로 옮깁니다.

       처음에는 scrollBy 로 조금씩 밀었는데 저절로 넘기기가 듣지 않았습니다.
       이 칸에는 scroll-snap 이 걸려 있어, 밀어 놓아도 스냅이 가까운 자리로
       되돌리기 때문입니다. 그래서 갈 자리를 정해 그곳으로 옮깁니다. */
    function maxLeft() { return Math.max(0, track.scrollWidth - track.clientWidth - 2); }
    function goTo(px) {
      var to = Math.max(0, Math.min(px, maxLeft()));
      track.scrollTo({ left: to, behavior: 'smooth' });
    }
    function step(dir, n) {
      goTo(track.scrollLeft + dir * cardW() * (n || 2));
    }

    var timer = null;
    function tick() {
      var max = maxLeft();
      if (max <= 4) return;                       /* 넘칠 만큼 없으면 가만히 */
      /* 끝에 거의 닿았으면 처음으로 — 한 바퀴 돌게 됩니다 */
      if (track.scrollLeft >= max - 4) goTo(0);
      else goTo(track.scrollLeft + cardW());      /* 저절로 넘길 때는 한 장씩 */
    }
    function play() {
      if (!opts.auto || timer) return;
      timer = setInterval(tick, opts.auto);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function rewind() { stop(); play(); }         /* 손으로 넘기면 시계를 다시 */

    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-car]');
      if (!b) return;
      step(b.getAttribute('data-car') === 'next' ? 1 : -1);
      rewind();
    });

    if (opts.auto) {
      play();
      /* 보고 있는 중에 넘어가면 성가시므로 마우스를 올리면 멈춥니다 */
      wrap.addEventListener('mouseenter', stop);
      wrap.addEventListener('mouseleave', play);
      /* 손가락으로 밀 때도 잠시 멈춥니다 */
      track.addEventListener('touchstart', stop, { passive: true });
      track.addEventListener('touchend', rewind, { passive: true });
      /* 다른 창을 보고 있을 때는 돌리지 않습니다 (쓸데없이 움직이지 않게) */
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else play();
      });
    }
  }


  /* ============================================================
     묶음 바꿔 보여주기 — 세로로 놓인 목록을 몇 개씩 나눠 차례로

     OCHub.rotateBox('#latestBox', { per: 4, every: 5000 })

     왜 가로로 밀지 않는가
       DATABASE 메인의 두 칸은 세로로 놓인 목록·격자입니다.
       가로로 미는 것은 맞지 않고, 한 줄씩 위로 올리면 읽는 중에 글이 움직여
       읽기 어렵습니다. 그래서 <b>몇 개씩 묶어 통째로 바꿉니다</b> —
       바뀌는 순간만 살짝 겹치고, 읽는 동안은 가만히 있습니다.

     칸이 나중에 채워지는 것을 지켜봅니다 — 자료를 받아 그리기 때문입니다.
     ============================================================ */
  function rotateBox(sel, opts) {
    opts = opts || {};
    var box = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!box) return;
    var per = opts.per || 4;
    var every = opts.every || 5000;

    var timer = null, at = 0, pages = 1, kids = [], dots = null;

    function build() {
      kids = [].slice.call(box.children).filter(function (k) {
        return k.nodeType === 1 && !k.classList.contains('hub-rdots');
      });
      pages = Math.ceil(kids.length / per);

      /* 나눌 만큼 없으면 아무것도 하지 않습니다 */
      if (kids.length <= per) {
        stop();
        kids.forEach(function (k) { k.style.display = ''; });
        if (dots) { dots.remove(); dots = null; }
        return false;
      }

      /* 몇 묶음인지 알 수 있게 점을 놓습니다 */
      if (!dots) {
        dots = document.createElement('div');
        dots.className = 'hub-rdots';
        box.parentNode.insertBefore(dots, box.nextSibling);
      }
      dots.innerHTML = '';
      for (var p = 0; p < pages; p++) {
        (function (p) {
          var d = document.createElement('i');
          d.setAttribute('role', 'button');
          d.setAttribute('aria-label', (p + 1) + '번째 묶음 보기');
          /* 누르는 순간 넘깁니다 — click 을 기다리면 늦고,
             pointerdown 에서 preventDefault 를 부르면 아예 오지 않습니다 */
          d.addEventListener('pointerdown', function (ev) {
            ev.stopPropagation();
            show(p); rewind();
          });
          dots.appendChild(d);
        })(p);
      }
      if (at >= pages) at = 0;
      show(at);
      return true;
    }

    function show(p) {
      at = p;
      kids.forEach(function (k, i) {
        var mine = Math.floor(i / per) === p;
        if (mine) {
          k.style.display = '';
          /* 바뀌는 순간만 살짝 나타나게 */
          k.style.animation = 'none';
          void k.offsetWidth;
          k.style.animation = 'hubFade .34s ease';
        } else {
          k.style.display = 'none';
        }
      });
      if (dots) {
        [].forEach.call(dots.children, function (d, k) {
          d.className = (k === p) ? 'on' : '';
        });
      }
    }

    function tick() { if (pages > 1) show((at + 1) % pages); }
    function play() { if (timer || pages <= 1) return; timer = setInterval(tick, every); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function rewind() { stop(); play(); }

    if (build()) play();

    /* 읽는 중에 바뀌지 않게 */
    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', play);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else play();
    });

    /* 칸이 채워지거나 보기 방식이 바뀌면 다시 나눕니다 */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var was = timer;
        stop();
        if (build() && was !== null) play(); else if (build()) play();
      }).observe(box, { childList: true });
    }
  }

  /* ============================================================
     성장 그래프 — 차트 라이브러리 없이 SVG 로 직접 그린다
     OCHub.stats({ curve:'#el', bars:'#el', total:'#el', week:'#el', upd:'#el', days:30 })
     ============================================================ */
  var DB_LABEL = { persons:'인물', orgs:'음악단체', venues:'공연장', schools:'음악학교',
                   modern:'현대음악', foundations:'기관재단', academic:'학술' };
  /* DB 종류별 빛깔 · 위 팔레트와 같은 결로 맞췄습니다.
     구성비 막대와 성장 곡선에서 함께 쓰입니다. */
  var DB_COLOR = { persons:'#3b6fc4', academic:'#8b95a8', schools:'#0f9b8e',
                   orgs:'#c08a3e',   venues:'#5a7fa8',  foundations:'#7c63b0',
                   modern:'#d93a4c' };

  /* 누적 성장 곡선
     · 컨테이너 실제 폭(W)을 받아 그린다 (고정 폭으로 그려 늘리면 눌린다)
     · 자료가 없는 앞 구간은 잘라낸다 (빈 왼쪽이 길면 그래프가 초라해 보인다)
     · 마우스를 올리면 그 날짜의 값을 보여주므로 좌표 정보도 함께 돌려준다 */
  function trimSeries(series) {
    if (!series || !series.length) return [];
    var i = 0;
    while (i < series.length && !(series[i].c > 0)) i++;      // 누적이 0인 앞 구간
    if (i >= series.length) return series.slice();
    if (i > 0) i--;                                          // 0에서 올라오는 모양을 위해 한 칸 남김
    var out = series.slice(i);
    return out.length >= 2 ? out : series.slice(-2);
  }

  function curveSvg(series, W, H) {
    if (!series || series.length < 2) return null;
    W = Math.max(W || 720, 320); H = H || 240;
    var PL = 10, PR = 10, PT = 18, PB = 28;
    var iw = W - PL - PR, ih = H - PT - PB;
    var max = 0;
    series.forEach(function (p) { if (p.c > max) max = p.c; });
    if (!max) max = 1;
    var x = function (i) { return PL + (iw * i / (series.length - 1)); };
    var y = function (v) { return PT + ih - (ih * v / max); };

    var line = series.map(function (p, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.c).toFixed(1);
    }).join(' ');

    var grid = '';
    [0.5, 1].forEach(function (r) {
      var gy = y(max * r);
      grid += '<line x1="' + PL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + gy.toFixed(1) + '"'
        + ' stroke="currentColor" stroke-opacity=".13" stroke-dasharray="3 4"/>'
        + '<text x="' + (PL + 2) + '" y="' + (gy - 6).toFixed(1) + '" font-size="10.5" fill="currentColor"'
        + ' fill-opacity=".42">' + Math.round(max * r).toLocaleString() + '</text>';
    });

    var ticks = '';
    [0, Math.floor((series.length - 1) / 2), series.length - 1].forEach(function (i, k) {
      var ta = k === 0 ? 'start' : (k === 2 ? 'end' : 'middle');
      ticks += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 9) + '" font-size="10.5"'
        + ' text-anchor="' + ta + '" fill="currentColor" fill-opacity=".45">' + esc(series[i].d) + '</text>';
    });

    var lastX = x(series.length - 1), lastY = y(series[series.length - 1].c);

    var svg = '<svg class="cv" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"'
      + ' role="img" aria-label="누적 등록 추이">'
      + grid
      + '<path d="' + line + '" fill="none" stroke="' + C_MAIN + '" stroke-width="2.4"'
      +   ' stroke-linejoin="round" stroke-linecap="round"/>'
      + '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="9" fill="' + C_HI + '" fill-opacity=".22"/>'
      + '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="4.4" fill="' + C_HI + '"/>'
      + ticks
      /* 마우스를 따라다니는 안내선과 점 (처음엔 숨김) */
      + '<g class="cv-hover" opacity="0">'
      +   '<line class="cv-vline" x1="0" y1="' + PT + '" x2="0" y2="' + (PT + ih) + '"'
      +     ' stroke="' + C_HI + '" stroke-opacity=".55" stroke-width="1" stroke-dasharray="3 3"/>'
      +   '<circle class="cv-dot" cx="0" cy="0" r="4.6" fill="' + ACCENT + '"/>'
      +   '<circle class="cv-dot2" cx="0" cy="0" r="9" fill="' + ACCENT + '" fill-opacity=".18"/>'
      + '</g>'
      /* 마우스를 받는 투명 판 */
      + '<rect class="cv-catch" x="' + PL + '" y="' + PT + '" width="' + iw + '" height="' + ih + '"'
      +   ' fill="transparent"/>'
      + '</svg>';

    return { svg: svg, geom: { PL: PL, PT: PT, iw: iw, ih: ih, max: max, n: series.length, W: W, H: H } };
  }

  /* 곡선에 날짜별 값 표시 붙이기 */
  function bindCurveHover(box, series, g) {
    var svg = box.querySelector('svg.cv');
    var tip = box.querySelector('.cv-tip');
    if (!svg || !tip) return;
    var hov = svg.querySelector('.cv-hover');
    var vl = svg.querySelector('.cv-vline');
    var d1 = svg.querySelector('.cv-dot');
    var d2 = svg.querySelector('.cv-dot2');
    var catcher = svg.querySelector('.cv-catch');
    if (!catcher) return;

    var step = g.iw / Math.max(g.n - 1, 1);
    function show(clientX) {
      var r = svg.getBoundingClientRect();
      var sx = (clientX - r.left) * (g.W / r.width);          // 화면 좌표 → 그림 좌표
      var i = Math.round((sx - g.PL) / step);
      i = Math.max(0, Math.min(g.n - 1, i));
      var p = series[i];
      var px = g.PL + step * i;
      var py = g.PT + g.ih - (g.ih * p.c / g.max);
      vl.setAttribute('x1', px.toFixed(1)); vl.setAttribute('x2', px.toFixed(1));
      d1.setAttribute('cx', px.toFixed(1)); d1.setAttribute('cy', py.toFixed(1));
      d2.setAttribute('cx', px.toFixed(1)); d2.setAttribute('cy', py.toFixed(1));
      hov.setAttribute('opacity', '1');

      tip.innerHTML = '<b>' + esc(p.d) + '</b>'
        + '<span>누적 <u>' + (p.c || 0).toLocaleString() + '</u></span>'
        + '<span>신규 <u>' + (p.n || 0).toLocaleString() + '</u></span>'
        + (p.u ? '<span>보강 <u>' + p.u.toLocaleString() + '</u></span>' : '');
      tip.hidden = false;
      /* 화면 밖으로 나가지 않게 좌우 보정 */
      var ratio = r.width / g.W;
      var left = px * ratio;
      var tw = tip.offsetWidth || 120;
      if (left + tw + 14 > r.width) left = left - tw - 14; else left = left + 14;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = Math.max(4, py * ratio - 10) + 'px';
    }
    function hide() { hov.setAttribute('opacity', '0'); tip.hidden = true; }

    catcher.addEventListener('mousemove', function (e) { show(e.clientX); });
    catcher.addEventListener('mouseleave', hide);
    catcher.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) show(e.touches[0].clientX);
    }, { passive: true });
    catcher.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) show(e.touches[0].clientX);
    }, { passive: true });
    catcher.addEventListener('touchend', hide);
  }

  /* 구성 비율 — 가로 스택 바 + 범례 */
  /* 구성비 막대.
     값이 비어 있는 항목이 하나라도 섞이면 t.n.toLocaleString() 이 터졌고,
     그 오류가 위에서 잡혀 곡선까지 함께 사라졌습니다. (2026-07-29)
     그래서 숫자를 반드시 수로 바꿔 쓰고, 이름이 없는 항목은 건너뜁니다. */
  function barsHtml(totals, total) {
    if (!totals || !totals.length) return '';
    var list = totals.filter(function (t) { return t && t.t != null; }).map(function (t) {
      return { t: t.t, n: Number(t.n) || 0 };
    });
    if (!list.length) return '';
    var sum = Number(total) || list.reduce(function (a, t) { return a + t.n; }, 0);
    var seg = list.map(function (t) {
      var pct = sum ? (t.n / sum * 100) : 0;
      return '<span class="bar-seg" style="width:' + pct.toFixed(2) + '%;background:'
        + (DB_COLOR[t.t] || '#8b95a8') + '" title="' + esc(DB_LABEL[t.t] || t.t) + ' ' + t.n.toLocaleString() + '"></span>';
    }).join('');
    var leg = list.map(function (t) {
      var pct = sum ? (t.n / sum * 100) : 0;
      return '<span class="bar-leg">'
        + '<i style="background:' + (DB_COLOR[t.t] || '#8b95a8') + '"></i>'
        + '<b>' + esc(DB_LABEL[t.t] || t.t) + '</b>'
        + '<u>' + t.n.toLocaleString() + '</u>'
        + '<s>' + pct.toFixed(1) + '%</s></span>';
    }).join('');
    return '<div class="bar-track">' + seg + '</div><div class="bar-legs">' + leg + '</div>';
  }

  /* ============================================================
     분석 그래프 — 세로막대 · 도넛 · 가로막대 · 완성도바
     OCHub.insight({ era:'#el', field:'#el', nation:'#el', links:'#el', fill:'#el' })
     ============================================================ */
  var REL_LABEL = { teacher:'사사 (스승)', student:'제자', alumnus_of:'출신 학교',
                    fellow_of:'학회 · 아카데미', member_of:'소속 단체' };
  /* ── 그래프 색 ──
     검정 계열 농담은 한눈에 답답해 보이므로 밝은 색을 쓴다.
     · 시간 순서(시대·좌석) : 차가운 색 → 따뜻한 색 으로 흐른다
     · 분야                 : 분야마다 정해진 색 (도넛과 누적막대가 같은 색)
     · 순위(국적·스승 등)   : 한 색의 농담, 1위만 진하게
     색을 한 번에 바꾸려면 아래 값만 고치면 된다. */
  /* ★ 색이 마음에 들지 않으면 이 아래 값만 바꾸면 모든 그래프에 반영됩니다 */
  /* ── 빛깔 ──────────────────────────────────────────────
     전에는 무지개처럼 일곱 색을 늘어놓아 가볍게 보였습니다.
     관계 지도에서 고른 네 색을 기준으로 다시 짰습니다.
       #3b6fc4 남색 · #d93a4c 적색 · #0f9b8e 청록 · #8b95a8 슬레이트
     사이트 전체가 한 결로 보이게 하려는 것입니다.

     시대 막대는 범주가 아니라 시간의 흐름입니다.
     그래서 색을 바꾸지 않고 한 계열에서 옅은 데서 진한 데로 갑니다.
     중세가 가장 옅고 현대가 가장 진해, 흐름이 눈에 그대로 들어옵니다. */
  var C_MAIN = '#3b6fc4';                 // 순위 막대 · 성장 곡선
  var C_HI   = '#c08a3e';                 // 1위 · 현재 지점 · 부족한 항목 (황토)

  /* 시대 · 세기 등 순서가 있는 구간 · 남색 한 계열의 명도 차이 */
  var SEQ = ['#c3cfe2','#a6b7d5','#8a9fc7','#6d86b7','#5370a6','#3f5a91','#2e4677'];

  /* 분야 · 범주이므로 색으로 가릅니다. 채도를 눌러 서로 부딪히지 않게 했습니다.
     가장 많은 '작곡' 에 기본 남색을 주고 나머지를 곁에 둡니다. */
  var FIELD_C = { '작곡':'#3b6fc4', '성악':'#d93a4c', '연주':'#0f9b8e',
                  '지휘':'#c08a3e', '음악학':'#8b95a8', '음악교육':'#7c63b0',
                  '편곡':'#5a7fa8', '평론':'#a8656f' };
  /* 순서를 색으로 (구간 수에 맞춰 골라 쓴다) */
  function seq(i, n) {
    if (n <= 1) return SEQ[3];
    var k = Math.round(i / (n - 1) * (SEQ.length - 1));
    return SEQ[Math.max(0, Math.min(SEQ.length - 1, k))];
  }
  /* 순위 농담 — 1위가 진하고 아래로 갈수록 옅어진다 */
  function rankColor(i, n) {
    var t = (n <= 1) ? 0 : i / (n - 1);
    var a = (0.92 - t * 0.55).toFixed(2);
    return 'rgba(79,123,232,' + a + ')';
  }
  var ACCENT = C_HI;
  function alpha(i, n, dark) {            // 예전 이름 유지 (누적막대에서 씀)
    var t = (n <= 1) ? 0 : i / (n - 1);
    return +(dark ? (0.88 - t * 0.58) : (0.30 + t * 0.58)).toFixed(2);
  }

  /* 세로 막대 — 시대별처럼 순서가 의미 있는 자료 */
  function vBarsSvg(data, W, H) {
    if (!data || !data.length) return '';
    W = Math.max(W || 720, 320); H = H || 240;
    var PL = 8, PR = 8, PT = 22, PB = 34;
    var iw = W - PL - PR, ih = H - PT - PB;
    var max = 0; data.forEach(function (d) { if (d.n > max) max = d.n; });
    if (!max) max = 1;
    var gap = Math.min(14, iw / data.length * 0.28);
    var bw = (iw - gap * (data.length - 1)) / data.length;
    var out = '';
    data.forEach(function (d, i) {
      var h = Math.max(ih * d.n / max, 2);
      var x = PL + i * (bw + gap), y = PT + ih - h;
      var col = seq(i, data.length);
      var paint = ' fill="' + col + '"';
      var lab = ' fill="' + col + '" font-weight="800"';
      out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '"'
        + ' height="' + h.toFixed(1) + '" rx="' + Math.min(5, bw / 3).toFixed(1) + '"' + paint + '/>'
        + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" font-size="11"'
        + ' font-weight="800" text-anchor="middle"' + lab + '>' + d.n.toLocaleString() + '</text>'
        + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 11) + '" font-size="11"'
        + ' text-anchor="middle" fill="currentColor" fill-opacity=".62">' + esc(d.k) + '</text>';
    });
    return '<svg class="cv" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="구간별 분포">'
      + '<line x1="' + PL + '" y1="' + (PT + ih) + '" x2="' + (W - PR) + '" y2="' + (PT + ih) + '"'
      + ' stroke="currentColor" stroke-opacity=".14"/>' + out + '</svg>';
  }

  /* 도넛 — 구성 비율 */
  function donutHtml(data, colorOf, unit) {
    if (!data || !data.length) return '';
    var total = data.reduce(function (a, b) { return a + b.n; }, 0) || 1;
    var R = 62, r = 40, cx = 74, cy = 74, acc = 0;
    var segs = '';
    data.forEach(function (d, di) {
      var a0 = acc / total * Math.PI * 2 - Math.PI / 2;
      acc += d.n;
      var a1 = acc / total * Math.PI * 2 - Math.PI / 2;
      var big = (a1 - a0) > Math.PI ? 1 : 0;
      var p = function (ang, rad) {
        return [(cx + Math.cos(ang) * rad).toFixed(2), (cy + Math.sin(ang) * rad).toFixed(2)].join(' ');
      };
      var c = colorOf(d.k, di);
      var paint = (typeof c === 'number')
        ? ' fill="currentColor" fill-opacity="' + c + '"'
        : ' fill="' + c + '"';
      segs += '<path d="M' + p(a0, R) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + p(a1, R)
        + ' L' + p(a1, r) + ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + p(a0, r) + ' Z"'
        + paint + '/>';
    });
    var legs = data.map(function (d, di) {
      var c = colorOf(d.k, di);
      var sw = (typeof c === 'number')
        ? 'background:currentColor;opacity:' + c
        : 'background:' + c;
      return '<span class="dn-leg"><i style="' + sw + '"></i>'
        + '<b>' + esc(d.k) + '</b><u>' + d.n.toLocaleString() + '</u>'
        + '<s>' + (d.n / total * 100).toFixed(1) + '%</s></span>';
    }).join('');
    return '<div class="dn-wrap">'
      + '<svg class="dn" viewBox="0 0 148 148" role="img" aria-label="구성 비율">' + segs
      +   '<text x="74" y="70" text-anchor="middle" font-size="20" font-weight="900"'
      +     ' fill="currentColor">' + total.toLocaleString() + '</text>'
      +   '<text x="74" y="87" text-anchor="middle" font-size="10.5"'
      +     ' fill="currentColor" fill-opacity=".5">' + esc(unit || '') + '</text>'
      + '</svg>'
      + '<div class="dn-legs">' + legs + '</div></div>';
  }

  /* 가로 막대 — 순위 자료 */
  function hBarsHtml(data, opt) {
    if (!data || !data.length) return '';
    opt = opt || {};
    var max = 0; data.forEach(function (d) { if (d.n > max) max = d.n; });
    if (!max) max = 1;
    var kw = opt.kw ? ' style="width:' + opt.kw + 'px"' : '';
    return '<div class="hbz">' + data.map(function (d, i) {
      var pct = d.n / max * 100;
      var label = opt.label ? (opt.label[d.k] || d.k) : d.k;
      var c = opt.colorOf ? opt.colorOf(d.k, i) : alpha(i, data.length, true);
      var paint = (typeof c === 'number')
        ? 'background:currentColor;opacity:' + c
        : 'background:' + c;
      var body = '<span class="hbz-k"' + kw + ' title="' + esc(label) + '">' + esc(label) + '</span>'
        + '<span class="hbz-bar"><i style="width:' + pct.toFixed(1) + '%;' + paint + '"></i></span>'
        + '<span class="hbz-n">' + d.n.toLocaleString() + (opt.unit || '') + '</span>';
      /* 항목을 누르면 그 인물·학교 페이지로 갈 수 있게 */
      var href = opt.hrefOf ? opt.hrefOf(d) : '';
      return href
        ? '<a class="hbz-row is-link" href="' + esc(href) + '">' + body + '</a>'
        : '<div class="hbz-row">' + body + '</div>';
    }).join('') + '</div>';
  }

  /* 비율 누적 막대 — 구간마다 구성이 어떻게 바뀌는지 본다
     절대값으로 그리면 19·20세기가 압도해 앞 세기가 보이지 않으므로 100% 로 정규화한다 */
  function stackSvg(rows, keys, W, H) {
    if (!rows || !rows.length) return null;
    W = Math.max(W || 720, 320); H = H || 250;
    var PL = 10, PR = 10, PT = 16, PB = 30;
    var iw = W - PL - PR, ih = H - PT - PB;

    /* 구간별로 모으기 */
    var byC = {}, order = [];
    rows.forEach(function (r) {
      if (!byC[r.c]) { byC[r.c] = { c: r.c, total: 0, v: {} }; order.push(r.c); }
      byC[r.c].v[r.f] = (byC[r.c].v[r.f] || 0) + r.n;
      byC[r.c].total += r.n;
    });
    order.sort(function (a, b) { return a - b; });
    var n = order.length;
    var gap = Math.min(16, iw / n * 0.3);
    var bw = (iw - gap * (n - 1)) / n;

    var out = '', labels = '';
    order.forEach(function (c, i) {
      var g = byC[c], x = PL + i * (bw + gap), acc = 0;
      keys.forEach(function (k, ki) {
        var v = g.v[k] || 0;
        if (!v) return;
        var hh = ih * v / g.total;
        var yy = PT + ih - acc - hh;
        acc += hh;
        var col = FIELD_C[k] || '#8b95a8';
        out += '<rect x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '"'
          + ' height="' + Math.max(hh, 0.6).toFixed(1) + '"'
          + ' fill="' + col + '" stroke="var(--paper,#fff)" stroke-width=".8">'
          + '<title>' + esc(c + '세기 · ' + k + ' ' + v.toLocaleString() + '명 ('
          + (v / g.total * 100).toFixed(1) + '%)') + '</title></rect>';
      });
      labels += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 11) + '" font-size="10.5"'
        + ' text-anchor="middle" fill="currentColor" fill-opacity=".5">' + c + 'C</text>'
        + '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (PT - 4) + '" font-size="10"'
        + ' text-anchor="middle" fill="currentColor" fill-opacity=".38">'
        + g.total.toLocaleString() + '</text>';
    });

    var legs = keys.map(function (k) {
      return '<span class="st-leg"><i style="background:' + (FIELD_C[k] || '#8b95a8') + '"></i>'
        + esc(k) + '</span>';
    }).join('');

    return { svg: '<svg class="cv" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"'
      + ' role="img" aria-label="구간별 구성 변화">' + out + labels + '</svg>',
      legend: '<div class="st-legs">' + legs + '</div>' };
  }

  /* 완성도 — 비율 진행바 */
  function fillHtml(f) {
    if (!f || !f.total) return '';
    var rows = [
      { k: '생몰 연도',     n: f.life },
      { k: '사진',          n: f.photo },
      { k: '출신 학교',     n: f.school },
      { k: '한국어 소개문', n: f.intro }
    ];
    /* 가장 부족한 항목만 황토로 짚어 줍니다.
       전에는 85% 넘으면 초록 · 60% 넘으면 파랑 · 그 아래는 연파랑으로 나눴는데,
       색이 넷이나 되어 무엇이 중요한지 흐려졌습니다.
       막대 길이가 이미 비율을 말해 주므로 색까지 나눌 까닭이 없습니다.
       하나만 다르게 두면 '어디를 채워야 하는지' 가 한눈에 들어옵니다. */
    var lowest = rows.reduce(function (a, b) { return b.n < a.n ? b : a; }, rows[0]);
    rows.forEach(function (r) {
      r.c = (r === lowest) ? C_HI : C_MAIN;
    });
    return '<div class="fl">' + rows.map(function (r) {
      var pct = r.n / f.total * 100;
      return '<div class="fl-row">'
        + '<span class="fl-k">' + esc(r.k) + '</span>'
        + '<span class="fl-bar"><i style="width:' + pct.toFixed(1) + '%;'
        +   ((typeof r.c === 'number') ? 'background:currentColor;opacity:' + r.c : 'background:' + r.c)
        +   '"></i></span>'
        + '<span class="fl-n">' + pct.toFixed(0) + '<em>%</em></span>'
        + '</div>';
    }).join('')
    + '<p class="fl-note">인물 ' + f.total.toLocaleString() + '명 기준 · 자동수집과 회원 보강으로 채워집니다</p></div>';
  }

  function insight(cfg) {
    /* 그리는 동안 빈 칸이 크게 남지 않도록 자리를 표시한다 */
    var SLOTS = ['era','century','field','fill','teachers','alma','nation','links','seats'];
    SLOTS.forEach(function (k) {
      if (!cfg[k]) return;
      var el = document.querySelector(cfg[k]);
      if (el) el.innerHTML = '<div class="ins-load">'
        + '<span class="hub-skel w5"></span><span class="hub-skel w7"></span></div>';
    });

    fetch(SB_URL + '/rest/v1/rpc/db_insight', { headers: HDR })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 160));
          });
        }
        return r.json();
      })
      .then(function (d) {
        if (!d) throw new Error('분석 자료를 받지 못했습니다');

        /* 시대별 — 세로 막대 (폭에 맞춰 다시 그린다) */
        var eb = cfg.era ? document.querySelector(cfg.era) : null;
        if (eb && (d.era || []).length) {
          var paintEra = function () {
            var cs = window.getComputedStyle(eb);
            var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            var w = Math.max(Math.round(eb.clientWidth - pad), 320);
            eb.innerHTML = vBarsSvg(d.era, w, w < 560 ? 200 : 240);
          };
          paintEra();
          var t1; window.addEventListener('resize', function () {
            clearTimeout(t1); t1 = setTimeout(paintEra, 160);
          });
        }

        /* 분야별 — 도넛 (상위 6개만, 잡항목 제외) */
        var fb = cfg.field ? document.querySelector(cfg.field) : null;
        if (fb) {
          var top = (d.field || []).filter(function (x) { return x.k.indexOf(',') < 0; }).slice(0, 6);
          fb.innerHTML = donutHtml(top, function (k) {
            return FIELD_C[k] || '#8b95a8';        // 세기별 누적막대와 같은 색
          }, '명');
        }

        /* 국적 상위 10 — 가로 막대 (순위에 따라 색이 옅어진다) */
        var nb = cfg.nation ? document.querySelector(cfg.nation) : null;
        if (nb) {
          var nn = (d.nation || []).length;
          nb.innerHTML = hBarsHtml(d.nation || [], {
            colorOf: function (k, i) { return i === 0 ? C_HI : rankColor(i, nn); }
          });
        }

        /* 네트워크 연결 — 가로 막대 + 합계 */
        var lb = cfg.links ? document.querySelector(cfg.links) : null;
        if (lb) {
          var ln = (d.links || []).length;
          lb.innerHTML = hBarsHtml(d.links || [], {
            label: REL_LABEL,
            colorOf: function (k, i) { return i === 0 ? C_HI : rankColor(i, ln); }
          });
          var lt = cfg.linksTotal ? document.querySelector(cfg.linksTotal) : null;
          if (lt) countUp(lt, d.links_total || 0);
        }

        /* 정보 완성도 */
        var xb = cfg.fill ? document.querySelector(cfg.fill) : null;
        if (xb) xb.innerHTML = fillHtml(d.fill);

        /* ① 제자가 많은 스승 — 이름을 누르면 그 인물 페이지로 */
        var tb = cfg.teachers ? document.querySelector(cfg.teachers) : null;
        if (tb) {
          var tn = (d.teachers || []).length;
          tb.innerHTML = hBarsHtml(d.teachers || [], {
            kw: 132, unit: '명',
            colorOf: function (k, i) { return i === 0 ? C_HI : rankColor(i, tn); },
            hrefOf: function (x) { return x.id ? '/db/person-view.html?id=' + encodeURIComponent(x.id) : ''; }
          });
        }

        /* ② 동문이 많은 학교 */
        var ab = cfg.alma ? document.querySelector(cfg.alma) : null;
        if (ab) {
          var an = (d.alma || []).length;
          ab.innerHTML = hBarsHtml(d.alma || [], {
            kw: 176, unit: '명',
            colorOf: function (k, i) { return i === 0 ? C_HI : rankColor(i, an); },
            hrefOf: function (x) { return x.id ? '/db/school-view.html?id=' + encodeURIComponent(x.id) : ''; }
          });
        }

        /* ③ 세기 × 분야 — 비율 누적 막대 */
        var cb = cfg.century ? document.querySelector(cfg.century) : null;
        if (cb && (d.century || []).length) {
          var KEYS = ['작곡', '성악', '연주', '지휘', '음악학', '음악교육'];
          var paintC = function () {
            var cs = window.getComputedStyle(cb);
            var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            var w = Math.max(Math.round(cb.clientWidth - pad), 320);
            var r = stackSvg(d.century, KEYS, w, w < 560 ? 210 : 250);
            cb.innerHTML = r ? (r.svg + r.legend) : '';
          };
          paintC();
          var t2; window.addEventListener('resize', function () {
            clearTimeout(t2); t2 = setTimeout(paintC, 160);
          });
        }

        /* ④ 공연장 좌석 규모 — 좌석 정보가 있는 곳만 */
        var sb2 = cfg.seats ? document.querySelector(cfg.seats) : null;
        if (sb2) {
          var all = d.seats || [];
          var known = all.filter(function (x) { return x.k !== '미기재'; });
          var unknown = all.filter(function (x) { return x.k === '미기재'; })[0];
          var sum = known.reduce(function (a, b) { return a + b.n; }, 0);
          var paintS = function () {
            var cs = window.getComputedStyle(sb2);
            var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            var w = Math.max(Math.round(sb2.clientWidth - pad), 320);
            sb2.innerHTML = vBarsSvg(known, w, w < 560 ? 190 : 220)
              + '<p class="st-note">좌석 정보가 있는 ' + sum.toLocaleString() + '곳 기준'
              + (unknown ? ' · 미기재 ' + unknown.n.toLocaleString() + '곳은 제외' : '') + '</p>';
          };
          paintS();
          var t3; window.addEventListener('resize', function () {
            clearTimeout(t3); t3 = setTimeout(paintS, 160);
          });
        }
      })
      .catch(function (e) {
        console.warn('[분석 그래프] 실패:', e.message);
        var msg = '<p class="ins-err">분석 자료를 불러오지 못했습니다.<br>'
          + '<span>' + esc(e.message) + '</span></p>';
        [cfg.era, cfg.century, cfg.field, cfg.fill, cfg.teachers,
         cfg.alma, cfg.nation, cfg.links, cfg.seats].forEach(function (sel, i) {
          if (!sel) return;
          var el = document.querySelector(sel);
          if (el) el.innerHTML = (i === 0) ? msg : '';
        });
      });
  }

  /* ── 성장 추이 ─────────────────────────────────────────────
     db_stats 를 한 번 불러 곡선 · 구성비 · 숫자를 모두 채웁니다.

     2026-07-29 · 그래프가 빈 채로 남는 일이 잦다는 보고를 받고 고쳤습니다.
       전에는 요청이 실패하면 console.warn 만 남기고 그대로 비웠습니다.
       보는 사람은 아직 불러오는 중인지 실패한 것인지 알 수 없고,
       새로 고치는 것 말고는 방법이 없었습니다.
     고친 것 세 가지
       ① 불러오는 동안 자리를 잡아 둔다 (뼈대 표시)
       ② 실패하면 두 번까지 다시 시도한다 (0.8초 · 2.4초 뒤)
       ③ 그래도 안 되면 까닭과 '다시 불러오기' 단추를 보여 준다
     집계 함수가 무거워 시간이 걸리는 것이라면 다시 시도만으로 대개 살아납니다. */

  /* 불러오는 동안 세 자리를 함께 채웁니다.
       곡선 · 구성비 막대 · 요약 숫자
     한 곳만 표시하면 나머지가 비어 있어 무엇을 기다리는지 알기 어렵습니다. */
  function statsSkeleton(cv, bs, nums) {
    if (cv) {
      cv.innerHTML = '<div class="hb-load" aria-live="polite">'
        + '<div class="hb-load-bar"></div><div class="hb-load-bar"></div>'
        + '<div class="hb-load-bar"></div><div class="hb-load-bar"></div>'
        + '<div class="hb-load-bar"></div><div class="hb-load-bar"></div>'
        + '<span class="hb-load-txt">최근 30일 기록을 세는 중…</span></div>';
    }
    if (bs) {
      bs.innerHTML = '<div class="hb-load-bars" aria-hidden="true">'
        + '<i></i><i></i><i></i></div>';
    }
    (nums || []).forEach(function (sel) {
      if (!sel) return;
      var el = document.querySelector(sel);
      if (el) el.innerHTML = '<span class="hb-num-load"></span>';
    });
  }

  function statsFail(el, onRetry) {
    if (!el) return;
    el.innerHTML = '<div class="hb-fail">'
      + '<p class="hb-fail-txt">성장 추이를 불러오지 못했습니다.</p>'
      + '<button type="button" class="hb-fail-btn">다시 불러오기</button></div>';
    var b = el.querySelector('.hb-fail-btn');
    if (b && onRetry) b.addEventListener('click', onRetry);
  }

  function statsCss() {
    if (document.getElementById('hb-stats-css')) return;
    var st = document.createElement('style');
    st.id = 'hb-stats-css';
    st.textContent = ''
      // 부모(.hb-curve)가 display:flex 이므로 폭을 주지 않으면 찌그러집니다.
      //   2026-07-29 · 로딩 표시를 넣었는데 눈에 띄지 않던 까닭이 이것이었습니다.
      + '.hb-load{flex:1 1 100%;width:100%;box-sizing:border-box;'
      +   'display:flex;align-items:flex-end;gap:10px;height:212px;padding:22px 6px 26px;position:relative}'
      + '.hb-load-bar{flex:1;border-radius:6px 6px 0 0;'
      +   'background:linear-gradient(180deg,rgba(124,99,176,.16),rgba(124,99,176,.05));'
      +   'animation:hbpulse 1.25s ease-in-out infinite}'
      + '.hb-load-bar:nth-child(1){height:42%;animation-delay:0s}'
      + '.hb-load-bar:nth-child(2){height:64%;animation-delay:.14s}'
      + '.hb-load-bar:nth-child(3){height:52%;animation-delay:.28s}'
      + '.hb-load-bar:nth-child(4){height:78%;animation-delay:.42s}'
      + '@keyframes hbpulse{0%,100%{opacity:.45}50%{opacity:1}}'
      + '.hb-load-txt{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
      +   'font-size:12.5px;color:#9aa0aa;white-space:nowrap}'
      // 구성비 막대 자리
      + '.hb-load-bars{display:flex;flex-direction:column;gap:10px;padding:4px 0}'
      + '.hb-load-bars i{display:block;height:14px;border-radius:7px;'
      +   'background:linear-gradient(90deg,rgba(59,111,196,.14),rgba(59,111,196,.06));'
      +   'animation:hbpulse 1.25s ease-in-out infinite}'
      + '.hb-load-bars i:nth-child(2){width:72%;animation-delay:.12s}'
      + '.hb-load-bars i:nth-child(3){width:48%;animation-delay:.24s}'
      // 숫자 자리 · 옅은 막대가 깜빡입니다
      + '.hb-num-load{display:inline-block;width:2.6em;height:.72em;border-radius:4px;vertical-align:-.06em;'
      +   'background:rgba(59,111,196,.16);animation:hbpulse 1.25s ease-in-out infinite}'
      + '.hb-fail{flex:1 1 100%;width:100%;box-sizing:border-box;'
      +   'display:flex;flex-direction:column;align-items:center;justify-content:center;'
      +   'gap:12px;min-height:212px;text-align:center}'
      + '.hb-fail-txt{margin:0;font-size:13px;color:#8a9099}'
      + '.hb-fail-btn{appearance:none;border:1px solid #d9dce2;background:#fff;color:#4b5563;'
      +   'font:600 12.5px/1 inherit;padding:9px 16px;border-radius:8px;cursor:pointer}'
      + '.hb-fail-btn:hover{border-color:#9ca3af;color:#111827}'

      /* ── 전체 건수 아래 진행 라인 (2026-08-06 · 파트너 요청) ──────
         숫자만 먼저 끝나면 아래가 비어 있는 동안 「멈춘 것」처럼 보입니다.
         그래서 성장 추이를 불러오는 <b>동안</b> 숫자 아래에 선이 흐르고,
         다 되면 <b>가득 채운 뒤</b> 조용히 사라집니다.
         ★ 이 선은 「아직 세고 있습니다」를 말해 줍니다 — 얼마나 남았는지는
           알 수 없으므로(집계가 한 번에 옵니다) 좌우로 흐르게 둡니다. */
      + '.hb-bar{display:block;position:relative;height:3px;margin-top:10px;border-radius:2px;'
      +   'background:rgba(140,150,170,.18);overflow:hidden;opacity:0;'
      +   'transition:opacity .3s ease}'
      + '.hb-bar.on{opacity:1}'
      + '.hb-bar i{position:absolute;inset:0 auto 0 0;width:40%;border-radius:2px;'
      +   'background:linear-gradient(90deg,rgba(59,111,196,0),#3b6fc4,rgba(59,111,196,0));'
      +   'animation:hbbar 1.15s ease-in-out infinite}'
      + '.hb-bar.done i{animation:none;width:100%;'
      +   'background:linear-gradient(90deg,#3b6fc4,#7c4f9d);'
      +   'transition:width .5s cubic-bezier(.22,1,.36,1)}'
      + '.hb-bar.fail i{animation:none;width:100%;background:#c98b8b}'
      + '@keyframes hbbar{0%{left:-40%}100%{left:100%}}'
      + '@media (prefers-reduced-motion:reduce){.hb-bar i{animation:none;width:100%}}';
    document.head.appendChild(st);
  }

  function stats(cfg) {
    statsCss();
    var cv = cfg.curve ? document.querySelector(cfg.curve) : null;
    var bs = cfg.bars  ? document.querySelector(cfg.bars)  : null;
    /* ★ 진행 라인 (2026-08-06) — 있으면 씁니다. 없으면 아무 일도 없습니다.
       이 집계는 30일 치를 세므로 시간이 걸립니다. 그동안 「세고 있다」는
       것을 알려 주지 않으면 화면이 멈춘 것처럼 보입니다. */
    var bar = cfg.bar ? document.querySelector(cfg.bar) : null;
    var tries = 0;
    var closed = false;

    /* 끝났을 때 — 라인을 채우고 감추고, 담아 둔 숫자를 터뜨립니다.
       ★ 성공이든 실패든 <b>한 번은 반드시</b> 부릅니다. 안 부르면 숫자가
         영원히 0 으로 남습니다. */
    function done(okFlag) {
      if (closed) return;
      closed = true;
      if (bar) {
        bar.classList.remove('on');
        bar.classList.add(okFlag ? 'done' : 'fail');
        bar.classList.add('on');
        setTimeout(function () { bar.classList.remove('on'); }, okFlag ? 900 : 1600);
      }
      if (cfg.counter) releaseCounter(cfg.counter);
      if (typeof cfg.onDone === 'function') { try { cfg.onDone(okFlag); } catch (e) {} }
    }

    function run() {
      statsSkeleton(cv, bs, [cfg.week, cfg.today, cfg.upd]);
      if (bar) { bar.classList.remove('done', 'fail'); bar.classList.add('on'); }

      var url = SB_URL + '/rest/v1/rpc/db_stats?p_days=' + (cfg.days || 30);
      fetch(url, { headers: HDR })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (d) {
          if (!d) throw new Error('빈 응답');

          /* 셋을 따로 감쌉니다.
             한 덩어리로 두면 구성비 하나가 터져도 곡선까지 사라집니다.
             실제로 그것이 그래프가 빈 채로 남던 까닭이었습니다. */
          function put(sel, v, up) {
            if (!sel) return;
            var el = document.querySelector(sel);
            if (!el) return;
            if (v == null) { el.textContent = '—'; return; }   /* 값이 없으면 대시를 남깁니다 */
            /* textContent 를 넣으면 로딩 막대(span)는 지워집니다 */
            if (up) countUp(el, Number(v) || 0);
            else el.textContent = (Number(v) || 0).toLocaleString();
          }
          try {
            put(cfg.total, d.total, true);
            put(cfg.week,  d.week_new);
            put(cfg.upd,   d.week_upd);
            put(cfg.today, d.today_new);
          } catch (e1) { console.warn('[성장 그래프] 숫자 표시 건너뜀:', e1.message); }

          if (cv) try {
            var ser = trimSeries(d.series || []);      /* 자료가 없는 앞 구간 제거 */
            var draw = function () {
              var cs = window.getComputedStyle(cv);
              var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
              var w = Math.max(Math.round(cv.clientWidth - pad), 360);
              var r = curveSvg(ser, w, cfg.height || 240);
              if (!r) {
                /* 그릴 자료가 모자란 경우 · 빈 화면으로 두지 않고 까닭을 적습니다 */
                cv.innerHTML = '<div class="hb-fail"><p class="hb-fail-txt">'
                  + '아직 그릴 만큼 기록이 쌓이지 않았습니다.</p></div>';
                return;
              }
              cv.innerHTML = r.svg + '<div class="cv-tip" hidden></div>';
              bindCurveHover(cv, ser, r.geom);
            };
            draw();
            if (!cv._hbResize) {
              cv._hbResize = true;
              var tm;
              window.addEventListener('resize', function () {
                clearTimeout(tm); tm = setTimeout(draw, 160);
              });
            }
          } catch (e2) {
            console.warn('[성장 그래프] 곡선 건너뜀:', e2.message);
            statsFail(cv, function () { tries = 0; run(); });
          }
          if (bs) try {
            bs.innerHTML = barsHtml(d.totals || [], d.total || 0);
          } catch (e3) {
            console.warn('[성장 그래프] 구성비 건너뜀:', e3.message);
            bs.innerHTML = '';
          }
          done(true);          /* 곡선·구성비를 다 그린 뒤 숫자를 올립니다 */
        })
        .catch(function (e) {
          tries++;
          console.warn('[성장 그래프] ' + tries + '차 실패:', e.message);
          if (tries < 3) {
            /* 집계가 무거워 시간이 걸린 것일 수 있으니 조금 기다렸다 다시 부릅니다 */
            setTimeout(run, tries === 1 ? 800 : 2400);
            return;
          }
          statsFail(cv, function () { tries = 0; closed = false; run(); });
          if (bs) bs.innerHTML = '';
          [cfg.week, cfg.today, cfg.upd].forEach(function (sel) {
            if (!sel) return;
            var el = document.querySelector(sel);
            if (el) el.textContent = '—';
          });
          /* ★ 실패해도 <b>숫자는 올립니다</b> — 값은 이미 구해 두었고,
             그래프가 안 되는 것과 건수를 못 보는 것은 다른 일입니다. */
          done(false);
        });
    }

    run();
  }

  return { init: init, bindViewToggle: bindViewToggle, esc: esc, thumb: thumb,
           board: board, boardTabs: boardTabs, one: one,
           bindCarousel: bindCarousel, rotateBox: rotateBox, resize: resize,
           stats: stats, insight: insight, qnaTop: qnaTop,
           releaseCounter: releaseCounter };
})();
