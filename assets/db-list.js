/* ============================================================
   OPUSCLAM 공용 리스트 엔진 — assets/db-list.js
   ------------------------------------------------------------
   검색 · 페이징 · 로딩씬 · 페이저 · 스티키헤더 · 리스트위치복귀 등
   '모든 리스트 페이지가 똑같이 반복하던 로직'을 여기 한 곳에 둔다.
   각 리스트 페이지는 아래 config(설정)만 넘겨 이 엔진을 재사용한다.

   OCList.init({
     table:        'persons',                 // Supabase 테이블명 (필수)
     pageSize:     30,                         // 페이지당 개수 (기본 30)
     select:       '*',                        // select 절 (기본 '*')
     orderDefault: 'sort_no.desc',            // 기본 정렬
     searchCols:   ['name_ko','name_en'],      // 검색어 ilike 대상 컬럼
     entity:       'persons',                  // 오류 로그 라벨(선택)
     buildFilters: function(sels){ return ''; },     // 셀렉트 → 필터 파라미터 문자열(페이지별)
     buildOrder:   function(sels){ return 'sort_no.desc'; }, // 셀렉트 → 정렬 파라미터(페이지별)
     renderRow:    function(rec, no, ctx){ return '<tr>…</tr>'; } // 행 HTML(페이지별)
   });

   renderRow 에 넘어오는 ctx 도우미: { cur, esc, ava, nd, wikiThumb }
   ------------------------------------------------------------
   ※ 컬럼/필터/정렬이 바뀌어도 이 엔진은 안 건드리고 각 페이지 config만 수정하면 된다.
   ============================================================ */
window.OCList = (function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  /* ── 공통 도우미 (renderRow 에서 ctx 로 사용 가능) ── */
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nd(v) { return (v == null || String(v).trim() === '') ? '<span class="nd">\u2014</span>' : esc(v); }
  function ava(name) { var s = (name || '').trim(); return s ? esc(s.charAt(0)) : '?'; }
  function wikiThumb(u, w) {
    if (!u || u.indexOf('upload.wikimedia.org') < 0 || u.indexOf('/thumb/') >= 0) return u;
    var i = u.indexOf('/wikipedia/'); if (i < 0) return u;
    var parts = u.slice(i + 11).split('/');
    if (parts.length < 4) return u;
    var proj = parts[0], a = parts[1], b = parts[2], fn = parts.slice(3).join('/');
    if (a.length !== 1 || b.length !== 2) return u;
    var t = u.slice(0, i + 11) + proj + '/thumb/' + a + '/' + b + '/' + fn + '/' + w + 'px-' + fn;
    if (fn.toLowerCase().slice(-4) === '.svg') t += '.png';
    return t;
  }

  function init(cfg) {
    var PAGE = cfg.pageSize || 30, cur = 1, total = 0;
    var SELECT = cfg.select || '*';
    var tbody = document.querySelector('.pdb-table tbody');
    var pager = document.querySelector('.pdb-pager');
    var focusId = new URLSearchParams(location.search).get('focus');
    var ncol = document.querySelectorAll('.pdb-table thead th').length || 10;
    var state = { q: '', filters: '', order: cfg.orderDefault || '' };
    var ctx = { cur: 1, esc: esc, ava: ava, nd: nd, wikiThumb: wikiThumb };

    /* 로딩 스켈레톤 (표 헤더 구조를 읽어 자동 생성) */
    function skeletonRows(n) {
      var ths = document.querySelectorAll('.pdb-table thead th');
      var cells = '';
      ths.forEach(function (th) {
        var isAva = /c-ava/.test(th.className || '');
        cells += '<td class="' + (th.className || '') + '"><span class="pdb-skel' + (isAva ? ' ava' : '') + '"></span></td>';
      });
      var r = '<tr class="pdb-skelrow">' + cells + '</tr>', out = '';
      for (var i = 0; i < n; i++) out += r;
      return out;
    }

    function readSearch() {
      var inp = document.querySelector('.pdb-search input');
      state.q = (inp ? inp.value : '').trim().replace(/[(),*]/g, ' ').replace(/\s+/g, ' ').trim();
      var sels = document.querySelectorAll('.pdb-selects select');
      state.filters = (cfg.buildFilters ? cfg.buildFilters(sels) : '') || '';
      state.order = (cfg.buildOrder ? cfg.buildOrder(sels) : cfg.orderDefault) || cfg.orderDefault || '';
    }

    function buildUrl(off) {
      var u = SB_URL + '/rest/v1/' + cfg.table + '?select=' + SELECT;
      if (state.q && cfg.searchCols && cfg.searchCols.length) {
        var t = encodeURIComponent(state.q);
        u += '&or=(' + cfg.searchCols.map(function (c) { return c + '.ilike.*' + t + '*'; }).join(',') + ')';
      }
      u += state.filters;
      if (state.order) u += '&order=' + state.order;
      u += '&limit=' + PAGE + '&offset=' + off;
      return u;
    }

    function doSearch() { readSearch(); loadPage(1); }

    function renderPager() {
      if (!pager) return;
      var pages = Math.max(1, Math.ceil(total / PAGE));
      var mob = window.innerWidth <= 520;
      var w = mob ? 2 : 4;
      var start = Math.max(1, cur - (mob ? 1 : 2)), end = Math.min(pages, start + w); start = Math.max(1, end - w);
      var nums = '';
      for (var i = start; i <= end; i++) { nums += '<a href="#" data-pg="' + i + '"' + (i === cur ? ' class="on"' : '') + '>' + i + '</a>'; }
      var hidF = (cur <= 1 ? ' style="visibility:hidden"' : ''), hidL = (cur >= pages ? ' style="visibility:hidden"' : '');
      var html = '';
      if (!mob) html += '<a class="pg-nav" data-pg="1" href="#"' + hidF + '>\u00ab \uba3c\uc55e</a>';
      html += '<a class="pg-nav" data-pg="' + (cur - 1) + '" href="#"' + hidF + '>\u2039 \uc774\uc804</a>'
        + '<div class="pg-nums">' + nums + '</div>'
        + '<a class="pg-nav" data-pg="' + (cur + 1) + '" href="#"' + hidL + '>\ub2e4\uc74c \u203a</a>';
      if (!mob) html += '<a class="pg-nav" data-pg="' + pages + '" href="#"' + hidL + '>\uba3c\ub4a4 \u00bb</a>';
      pager.innerHTML = html;
    }

    function loadPage(pg) {
      var off = (pg - 1) * PAGE;
      if (tbody) tbody.innerHTML = skeletonRows(10);
      var hh = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'count=exact' };
      fetch(buildUrl(off), { headers: hh })
        .then(function (r) {
          var crg = r.headers.get('content-range'); if (crg) { var t = crg.split('/')[1]; if (t && t !== '*') total = parseInt(t, 10) || total; }
          if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
        })
        .then(function (rows) {
          if (!Array.isArray(rows)) return;
          cur = pg; ctx.cur = cur;
          var cnt = document.querySelector('.pdb-count b'); if (cnt) cnt.textContent = (total || 0).toLocaleString();
          if (rows.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="' + ncol + '" class="pdb-empty">요청하신 검색 결과가 없습니다.</td></tr>';
            if (pager) pager.innerHTML = '';
          } else {
            if (tbody) tbody.innerHTML = rows.map(function (rw, ix) { return cfg.renderRow(rw, off + ix + 1, ctx); }).join('');
            renderPager();
            if (focusId && tbody) { var _fr = tbody.querySelector('tr[data-id="' + focusId + '"]'); if (_fr) { _fr.classList.add('row-focus'); try { _fr.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} } focusId = null; }
          }
        })
        .catch(function (e) { console.error((cfg.entity || cfg.table) + ' 로드 실패:', e); });
    }

    /* 페이저 클릭 */
    if (pager) {
      pager.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[data-pg]'); if (!a) return; e.preventDefault();
        var pg = parseInt(a.getAttribute('data-pg'), 10);
        var pages = Math.max(1, Math.ceil(total / PAGE));
        if (pg >= 1 && pg <= pages && pg !== cur) { loadPage(pg); if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' }); }
      });
    }

    /* 검색 배선: Enter · 검색버튼 · 돋보기 아이콘 · 셀렉트 변경 */
    (function () {
      var inp = document.querySelector('.pdb-search input');
      if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
      var sbtn = document.querySelector('.pdb-searchbtn'); if (sbtn) sbtn.addEventListener('click', doSearch);
      var sic = document.querySelector('.pdb-search svg'); if (sic) { sic.style.cursor = 'pointer'; sic.addEventListener('click', doSearch); }
      document.querySelectorAll('.pdb-selects select').forEach(function (sel) { sel.addEventListener('change', doSearch); });
    })();

    /* 스티키 헤더 top 보정 */
    function setStickyTop() {
      var h = document.querySelector('.site-header'); var t = h ? Math.round(h.getBoundingClientRect().height) : 64;
      document.querySelectorAll('.pdb-table thead th').forEach(function (th) { th.style.top = t + 'px'; });
    }
    setStickyTop();
    window.addEventListener('resize', setStickyTop);
    window.addEventListener('resize', function () { if (total) renderPager(); });

    /* 최초 로드: ?p 페이지부터 */
    var _sp = parseInt(new URLSearchParams(location.search).get('p'), 10) || 1;
    loadPage(_sp >= 1 ? _sp : 1);
  }

  return { init: init, esc: esc, ava: ava, nd: nd, wikiThumb: wikiThumb };
})();
