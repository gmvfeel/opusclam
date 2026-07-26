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
      return '<a class="hub-navcard" href="' + esc(s.list) + '">'
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

  return { init: init, bindViewToggle: bindViewToggle, esc: esc, thumb: thumb };
})();
