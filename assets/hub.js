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
  function thumb(u, w) {
    if (!u) return '';
    u = String(u).replace(/^http:\/\//, 'https://');
    if (u.indexOf('Special:FilePath') >= 0) return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w;
    if (u.indexOf('upload.wikimedia.org') < 0 || u.indexOf('/thumb/') >= 0) return u;
    var i = u.indexOf('/wikipedia/'); if (i < 0) return u;
    var p = u.slice(i + 11).split('/');
    if (p.length < 4) return u;
    var proj = p[0], a = p[1], b = p[2], fn = p.slice(3).join('/');
    if (a.length !== 1 || b.length !== 2) return u;
    var t = u.slice(0, i + 11) + proj + '/thumb/' + a + '/' + b + '/' + fn + '/' + w + 'px-' + fn;
    if (fn.toLowerCase().slice(-4) === '.svg') t += '.png';
    return t;
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
          : '<span class="hub-cardimg hub-cardimg-ph">NO IMAGE</span>')
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

  /* ── 영역 카드 (7개 DB 등) ── */
  function drawCards(box, sources) {
    box.innerHTML = sources.map(function (s) {
      /* 카드마다 그 영역의 색을 쓴다 (구성 스택바·배지와 같은 색) */
      var col = DB_COLOR[s.key] || '#7C63B0';
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
      if (totalEl) countUp(totalEl, total);
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

  function bCard(cfg, r) {
    var img = r.thumb_url || r.logo_url || '';
    return '<a class="bd-card" href="' + esc(bHref(cfg, r)) + '">'
      + (img
          ? '<span class="bd-cardimg"><img src="' + esc(thumb(img, 480)) + '" alt="" loading="lazy"></span>'
          : '<span class="bd-cardimg bd-noimg"><i>' + esc((r.title || '?').trim().charAt(0)) + '</i></span>')
      + '<span class="bd-cardbody">'
      +   (r.category ? '<span class="bd-cat">' + esc(r.category) + '</span>' : '')
      +   '<span class="bd-title">' + esc(bTxt(r.title, 46)) + '</span>'
      +   '<span class="bd-desc">' + esc(bTxt(r.body, 74)) + '</span>'
      + '</span></a>';
  }
  function bRow(cfg, r) {
    var img = r.thumb_url || '';
    return '<a class="bd-row" href="' + esc(bHref(cfg, r)) + '">'
      + (img ? '<span class="bd-rowimg"><img src="' + esc(thumb(img, 240)) + '" alt="" loading="lazy"></span>' : '')
      + '<span class="bd-rowbody">'
      +   '<span class="bd-title">' + esc(bTxt(r.title, 60)) + '</span>'
      +   '<span class="bd-desc">' + esc(bTxt(r.body, 130)) + '</span>'
      +   '<span class="bd-meta">' + esc(join([r.category, r.author_name, ymd(r.created_at)])) + '</span>'
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
      +   '<span class="bd-meta">' + esc(join([r.author_name, ymd(r.created_at)])) + '</span>'
      + '</span>'
      + '<span class="bd-featgo">VIEW DETAIL <b>&rarr;</b></span>'
      + '</a>';
  }
  function bCompact(cfg, r) {
    return '<a class="bd-line" href="' + esc(bHref(cfg, r)) + '">'
      + '<span class="bd-date">' + esc(ymd(r.created_at)) + '</span>'
      + '<span class="bd-linetitle">' + esc(bTxt(r.title, 58)) + '</span>'
      + (r.comment_count ? '<span class="bd-cc">[' + r.comment_count + ']</span>' : '')
      + '</a>';
  }
  var RENDER = { cards: bCard, rows: bRow, feature: bFeature, compact: bCompact };

  function board(cfg) {
    var box = document.querySelector(cfg.el);
    if (!box) return;
    box.innerHTML = '<div class="bd-loading"><span class="hub-skel w5"></span><span class="hub-skel w7"></span></div>';
    askBoard(cfg).then(function (res) {
      if (!res || !res.rows.length) {
        box.innerHTML = '<p class="bd-empty">' + esc(cfg.emptyText || '아직 등록된 글이 없습니다.') + '</p>';
        return;
      }
      var fn = RENDER[cfg.kind] || bRow;
      box.innerHTML = res.rows.map(function (r) { return fn(cfg, r); }).join('');
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
          var html = (!res || !res.rows.length)
            ? '<p class="bd-empty">아직 등록된 글이 없습니다.</p>'
            : res.rows.map(function (r) { return fn({ view: t.view, list: t.list }, r); }).join('');
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
  function bindCarousel(wrapSel, trackSel) {
    var wrap = document.querySelector(wrapSel), track = document.querySelector(trackSel);
    if (!wrap || !track) return;
    function step(dir) {
      var card = track.querySelector(':scope > *');
      var w = card ? card.getBoundingClientRect().width + 14 : 280;
      track.scrollBy({ left: dir * w * 2, behavior: 'smooth' });
    }
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-car]');
      if (!b) return;
      step(b.getAttribute('data-car') === 'next' ? 1 : -1);
    });
  }


  /* ============================================================
     성장 그래프 — 차트 라이브러리 없이 SVG 로 직접 그린다
     OCHub.stats({ curve:'#el', bars:'#el', total:'#el', week:'#el', upd:'#el', days:30 })
     ============================================================ */
  var DB_LABEL = { persons:'인물', orgs:'음악단체', venues:'공연장', schools:'음악학교',
                   modern:'현대음악', foundations:'기관재단', academic:'학술' };
  var DB_COLOR = { persons:'#7C63B0', orgs:'#C9A94E', venues:'#3B82F6', schools:'#10B981',
                   modern:'#EC4899', foundations:'#64748B', academic:'#DC2626' };

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
  function barsHtml(totals, total) {
    if (!totals || !totals.length) return '';
    var seg = totals.map(function (t) {
      var pct = total ? (t.n / total * 100) : 0;
      return '<span class="bar-seg" style="width:' + pct.toFixed(2) + '%;background:'
        + (DB_COLOR[t.t] || '#999') + '" title="' + esc(DB_LABEL[t.t] || t.t) + ' ' + t.n.toLocaleString() + '"></span>';
    }).join('');
    var leg = totals.map(function (t) {
      var pct = total ? (t.n / total * 100) : 0;
      return '<span class="bar-leg">'
        + '<i style="background:' + (DB_COLOR[t.t] || '#999') + '"></i>'
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
  var C_MAIN = '#4F7BE8';                 // 순위 막대 · 성장 곡선 (파랑)
  var C_HI   = '#F2A63B';                 // 1위 · 현재 지점 · 부족한 항목 (주황)
  var SEQ = ['#8FA9D8','#5B9BD5','#3FB6C6','#37C4A0','#7CC94A','#E8B93C','#EE8A4C'];
  var FIELD_C = { '작곡':'#5B7CE8', '성악':'#E8709A', '연주':'#3FB0D9',
                  '지휘':'#E8A93C', '음악학':'#37BFA0', '음악교육':'#8FC94A',
                  '편곡':'#7A6FD8', '평론':'#E8756B' };
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
        var col = FIELD_C[k] || '#9AA3B5';
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
      return '<span class="st-leg"><i style="background:' + (FIELD_C[k] || '#9AA3B5') + '"></i>'
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
    /* 가장 부족한 항목을 금색으로 — 어디를 채워야 하는지 바로 보인다 */
    var lowest = rows.reduce(function (a, b) { return b.n < a.n ? b : a; }, rows[0]);
    /* 많이 채워진 항목은 초록 · 보통은 파랑 · 가장 부족한 항목은 주황으로 눈에 띄게 */
    rows.forEach(function (r) {
      var pr = r.n / f.total;
      r.c = (r === lowest) ? C_HI
          : pr > .85 ? '#37BFA0'
          : pr > .6  ? '#4F7BE8'
          :            '#8FA9D8';
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
            return FIELD_C[k] || '#9AA3B5';        // 세기별 누적막대와 같은 색
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

  function stats(cfg) {
    var url = SB_URL + '/rest/v1/rpc/db_stats?p_days=' + (cfg.days || 30);
    fetch(url, { headers: HDR })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) throw new Error('통계를 받지 못했습니다');
        function put(sel, v, up) {
          if (!sel) return;
          var el = document.querySelector(sel);
          if (!el) return;
          if (up) countUp(el, v); else el.textContent = (v || 0).toLocaleString();
        }
        put(cfg.total, d.total, true);
        put(cfg.week, d.week_new);
        put(cfg.upd, d.week_upd);
        put(cfg.today, d.today_new);
        var cv = cfg.curve ? document.querySelector(cfg.curve) : null;
        if (cv) {
          var ser = trimSeries(d.series || []);      /* 자료가 없는 앞 구간 제거 */
          var draw = function () {
            var cs = window.getComputedStyle(cv);
            var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            var w = Math.max(Math.round(cv.clientWidth - pad), 360);
            var r = curveSvg(ser, w, cfg.height || 240);
            if (!r) { cv.innerHTML = ''; return; }
            cv.innerHTML = r.svg + '<div class="cv-tip" hidden></div>';
            bindCurveHover(cv, ser, r.geom);
          };
          draw();
          var tm;
          window.addEventListener('resize', function () {
            clearTimeout(tm); tm = setTimeout(draw, 160);
          });
        }
        var bs = cfg.bars ? document.querySelector(cfg.bars) : null;
        if (bs) bs.innerHTML = barsHtml(d.totals || [], d.total || 0);
      })
      .catch(function (e) {
        console.warn('[성장 그래프] 건너뜀:', e.message);
        [cfg.curve, cfg.bars].forEach(function (sel) {
          if (!sel) return;
          var el = document.querySelector(sel);
          if (el) el.innerHTML = '';
        });
      });
  }

  return { init: init, bindViewToggle: bindViewToggle, esc: esc, thumb: thumb,
           board: board, boardTabs: boardTabs, one: one, bindCarousel: bindCarousel,
           stats: stats, insight: insight, qnaTop: qnaTop };
})();
