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
     includeHidden: false,                     // true 면 숨김 항목도 표시 (기본 false)
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
  /* ── 건수를 <b>세듯이</b> 올립니다 (2026-08-06 · 파트너 요청) ──
     ★ 왜 — 「전체 1,267개」가 갑자기 나타나면 그냥 적어 둔 글자처럼
       보입니다. 세면서 올라가면 <b>지금 센 것</b>이라는 느낌이 듭니다.
       DB 메인의 전체 건수도 같은 방식입니다(assets/hub.js).
     ★ <b>같은 값이면 아무 일도 하지 않습니다</b> — 쪽을 넘길 때는 총수가
       그대로인데 매번 0 부터 다시 세면 눈이 어지럽습니다.
     ★ 480ms 로 짧게 — 목록은 <b>자주</b> 다시 그려집니다(갈래·검색·정렬).
       메인 화면처럼 900ms 를 쓰면 답답합니다.
     ★ 움직임을 줄이도록 설정한 분에게는 <b>바로</b> 넣습니다. */
  function countUp(el, to) {
    if (!el) return;
    to = Number(to) || 0;
    var fmt = function (n) { return n.toLocaleString(); };

    /* 지금 적힌 값과 같으면 건너뜁니다 */
    var now = parseInt(String(el.textContent || '').replace(/[^\d]/g, ''), 10);
    if (!isNaN(now) && now === to) return;

    var reduce = false;
    try {
      reduce = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (reduce || to === 0) { el.textContent = fmt(to); return; }

    /* 앞선 애니메이션이 돌고 있으면 멈춥니다 — 두 개가 겹치면 숫자가 떱니다 */
    if (el.__cuRaf) { cancelAnimationFrame(el.__cuRaf); el.__cuRaf = 0; }

    var from = (!isNaN(now) ? now : 0), dur = 480, t0 = 0;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) el.__cuRaf = requestAnimationFrame(step);
      else el.__cuRaf = 0;
    }
    el.__cuRaf = requestAnimationFrame(step);
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nd(v) { return (v == null || String(v).trim() === '') ? '<span class="nd">\u2014</span>' : esc(v); }
  function ava(name) { var s = (name || '').trim(); return s ? esc(s.charAt(0)) : '?'; }
  function wikiThumb(u, w) {
    if (!u) return u;
    u = String(u).replace(/^http:\/\//, 'https://');
    // 위키데이터 P18 형식: commons.wikimedia.org/wiki/Special:FilePath/파일명
    // ?width= 를 붙이면 위키미디어가 해당 폭의 썸네일로 넘겨줍니다
    if (u.indexOf('Special:FilePath') >= 0) {
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + (w || 200);
    }
    if (u.indexOf('upload.wikimedia.org') < 0 || u.indexOf('/thumb/') >= 0) return u;
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

    /* ── 뷰에 다녀와도 보던 자리를 지킨다 ──────────────────
       페이지 번호만 넘기면 모자란다.
       '베토벤' 을 찾아 놓고 3쪽에서 한 줄을 눌렀다가 돌아오면,
       검색어가 없으니 전체 목록 3쪽이 열리고 그 줄은 거기에 없다.
       그래서 검색어 · 고른 항목 · 페이지를 한 벌로 담아 둔다.
       주소에 다 실으면 리스트 7개를 모두 고쳐야 하므로
       이 공용 엔진 한 곳에서 sessionStorage 에 맡긴다.
       탭을 닫으면 지워지므로 남지 않는다. */
    var SKEY = 'ocdb-back:' + (cfg.entity || cfg.table);

    function saveSpot(id) {
      try {
        var inp = document.querySelector('.pdb-search input');
        var vals = [];
        document.querySelectorAll('.pdb-selects select').forEach(function (sl) { vals.push(sl.value); });
        sessionStorage.setItem(SKEY, JSON.stringify({
          id: String(id), page: ctx.cur, q: inp ? inp.value : '', sels: vals
        }));
      } catch (e) {}
    }

    function readSpot(id) {
      try {
        var v = JSON.parse(sessionStorage.getItem(SKEY) || 'null');
        if (v && String(v.id) === String(id)) return v;
      } catch (e) {}
      return null;
    }

    /* 줄을 누르는 순간 담아 둔다 (링크를 눌러 뷰로 넘어가기 직전) */
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var el = e.target;
        while (el && el !== tbody && el.nodeName !== 'TR') el = el.parentNode;
        if (el && el.nodeName === 'TR' && el.getAttribute('data-id')) {
          saveSpot(el.getAttribute('data-id'));
        }
      });
    }

    /* 눌렀던 줄로 데려가고 잠깐 표시해 준다.
       한 번 쓰고 지워서, 페이지를 옮길 때 다시 튀지 않게 한다. */
    function focusRow() {
      if (!focusId) return;
      var tb = document.querySelector('.pdb-table tbody');
      if (!tb) return;
      var tr = tb.querySelector('tr[data-id="' + focusId + '"]');
      if (!tr) return;                       // 그 줄이 이 페이지에 없으면 그냥 둔다
      focusId = null;
      tr.classList.add('row-focus');
      try {
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        try { tr.scrollIntoView(); } catch (e2) {}
      }
      /* 표시는 잠깐만 남긴다. 계속 칠해 두면 어느 줄을 보고 있는지 헷갈린다. */
      setTimeout(function () { tr.classList.remove('row-focus'); }, 2600);
    }
    var ncol = document.querySelectorAll('.pdb-table thead th').length || 10;
    var state = { q: '', filters: '', order: cfg.orderDefault || '' };
    var ctx = { cur: 1, esc: esc, ava: ava, nd: nd, wikiThumb: wikiThumb };

    /* ── 찾는 것이 없을 때 보여 줄 자리 ─────────────────────────

       왜 이렇게 하나
         「요청하신 검색 결과가 없습니다」 로 끝내면 그 사람은 그냥 떠납니다.
         그런데 <b>자기 이름을 검색했다가 없는 것을 알게 된 순간</b>은
         등록할 마음이 가장 큰 때입니다. 그때 등록하는 길을 보여 주면
         자료도 늘고, 등록에 자격이 필요하므로 회원가입으로도 이어집니다.

       ★ 두 가지를 조심했습니다.
         ① 「자기 이름을 검색한 사람」 과 「그냥 못 찾은 사람」 을
            구별할 방법이 없습니다. 「본인 정보를 등록하세요」 라고만 하면
            베토벤을 찾던 사람에게 엉뚱합니다.
            그래서 <b>양쪽에 다 자연스러운 문구</b>로 적습니다.
         ② 등록은 <b>자격 회원의 관리자 승인</b>을 거칩니다.
            그것을 숨기고 「등록하세요」 만 크게 보이면, 가입한 뒤에
            실망합니다. 문턱을 먼저 정직하게 적습니다.

       ★ 찾기를 돕는 것도 함께 둡니다.
         없는 것이 아니라 「아직 안 들어온 것」 일 수 있으므로,
         다른 표기로 찾아보도록 권하고 그 DB의 전체 건수를 보여 줍니다. */

    /* DB마다 부르는 이름과 등록 화면 주소 */
    var EMPTY_INFO = {
      persons: { what: '음악인', db: 'person', ask: '찾으시는 분이 목록에 없습니까?',
                 tip: '(같은 사람이 다른 표기로 담겨 있을 수 있습니다)' },
      orgs: { what: '음악단체', db: 'org', ask: '찾으시는 단체가 없습니까?',
              tip: '(「서울시립교향악단」 · 「Seoul Philharmonic」 처럼 표기가 여럿입니다)' },
      venues: { what: '공연장', db: 'venue', ask: '찾으시는 공연장이 없습니까?',
                tip: '(「예술의전당 콘서트홀」 처럼 홀 이름까지 넣거나, 반대로 빼고 찾아보십시오)' },
      schools: { what: '음악학교', db: 'school', ask: '찾으시는 학교가 없습니까?',
                 tip: '(「예술고등학교」 · 「예고」 처럼 줄임말도 해 보십시오)' },
      modern_composers: { what: '현대음악 작곡가', db: 'modern', ask: '찾으시는 작곡가가 없습니까?',
                          tip: '(원어 표기로도 찾아보십시오)' },
      foundations: { what: '기관·재단', db: 'foundation', ask: '찾으시는 기관이 없습니까?',
                     tip: '(재단·협회·음반사·콩쿠르 주최를 함께 담고 있습니다)' },
      academic: { what: '학술 자료', db: 'academic', ask: '찾으시는 자료가 없습니까?',
                  tip: '(제목 전체보다 낱말 하나로 찾는 편이 잘 됩니다)' },
    };

    function emptyHtml() {
      var key = cfg.entity || cfg.table;
      var info = EMPTY_INFO[key] || { what: '자료', db: 'person', ask: '찾으시는 자료가 없습니까?', tip: '' };
      var kw = String(state.q || '').trim();

      /* 등록 화면으로 갈 때 검색한 낱말을 함께 넘깁니다 —
         이름 칸이 미리 채워져 한 걸음이 줄어듭니다. */
      var wr = '/db/write.html?db=' + encodeURIComponent(info.db) + '&mode=new'
             + (kw ? '&name=' + encodeURIComponent(kw) : '');

      var head = kw
        ? '<b>' + esc(kw) + '</b> 로 찾은 결과가 없습니다.'
        : '조건에 맞는 자료가 없습니다.';

      var totalTxt = (total || 0).toLocaleString();

      return ''
        + '<div class="pdb-none">'
        +   '<p class="pdb-none-t">' + head + '</p>'

        /* ── 찾기를 돕습니다 ── */
        +   '<ul class="pdb-none-tip">'
        +     '<li>한글 · 영문 · 원어 표기를 바꿔 찾아보십시오. ' + esc(info.tip) + '</li>'
        +     '<li>이름 전체보다 <b>일부만</b> 넣어 보십시오. 그편이 잘 찾아집니다.</li>'
        /* ★ 세 번째 도움말은 <b>실제로 켜 둔 조건이 있을 때만</b> 보여 줍니다.

           예전에는 「왼쪽 조건을 켜 두셨다면 풀고 다시 찾아보십시오」 였습니다.
           그런데 이 화면에는 왼쪽 조건이 없습니다 — 「국내/외」·「분야」·「정렬」 이
           검색칸 <b>옆</b>에 있습니다. 리쿠르트 목록과 헷갈려 쓴 문구였고,
           읽는 사람이 무엇을 가리키는지 알 수 없었습니다.
           조건을 걸어 두지 않았으면 이 줄을 아예 보여 주지 않습니다. */
        +     (state.filters
              ? '<li>검색칸 옆의 <b>국내/외 · 분야</b> 조건을 함께 걸어 두셨습니다. 그것을 풀고 다시 찾아보십시오.</li>'
              : '')
        +   '</ul>'

        /* ── 등록을 권합니다 ── */
        +   '<div class="pdb-none-cta">'
        +     '<p class="pdb-none-ask">' + esc(info.ask) + '</p>'
        +     '<p class="pdb-none-sub">'
        +       '오퍼스클램의 ' + esc(info.what) + ' 자료는 지금 <b>' + totalTxt + '건</b>입니다. '
        +       '없는 것이 아니라 아직 담기지 않은 것일 수 있습니다.<br>'
        +       '자격을 갖춘 회원은 직접 <b>등록·보강</b>하실 수 있습니다. '
        +       '<span class="pdb-none-note">등록하신 자료는 관리자 확인을 거쳐 반영됩니다.</span>'
        +     '</p>'
        +     '<div class="pdb-none-btns" id="pdbNoneBtns">'
        +       '<a class="pdb-none-btn" href="' + wr + '">' + esc(info.what) + ' 등록·보강하기</a>'
        +       '<a class="pdb-none-btn2" href="mailto:cser@wixon.co.kr'
        +         '?subject=' + encodeURIComponent('[오퍼스클램] 자료 등록 요청')
        +         '&body=' + encodeURIComponent('찾던 것 — ' + (kw || '(검색어 없음)') + '\n\n'
        +           '아래에 알려 주시면 확인해 담겠습니다.\n'
        +           '· 이름(한글/영문) — \n· 무엇인지 — \n· 참고할 수 있는 주소 — \n')
        +       '">메일로 알려 주기</a>'
        +     '</div>'
        +   '</div>'
        + '</div>';
    }

    /* 손님에게는 「회원가입하고 등록하기」 로 바꿔 줍니다.
       ★ 로그인 여부를 확인하는 동안 화면이 비어 보이지 않도록,
         먼저 그려 두고 확인이 끝나면 단추만 고칩니다. */
    function fixEmptyCta() {
      var box = document.getElementById('pdbNoneBtns');
      if (!box) return;
      var link = box.querySelector('.pdb-none-btn');
      if (!link) return;
      var sb = window.__ocSb;
      if (!sb || !sb.auth) return;
      sb.auth.getSession().then(function (r) {
        var on = !!(r && r.data && r.data.session && r.data.session.user);
        if (on) return;                     /* 회원이면 그대로 둡니다 */
        var next = link.getAttribute('href');
        link.textContent = '회원가입하고 등록하기';
        link.setAttribute('href', '/account/join.html?next=' + encodeURIComponent(next));
        var hint = document.createElement('p');
        hint.className = 'pdb-none-who';
        hint.innerHTML = '등록·보강은 <b>전공자 · 음악관계자 · 단체 · 음악학교</b> 회원에게 열려 있습니다. '
          + '가입하실 때 회원 종류를 골라 주십시오.';
        box.parentNode.insertBefore(hint, box);
      }).catch(function () {});
    }

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
      // 숨김 처리된 항목 제외 (관리자가 노이즈로 표시한 데이터)
      // 특별히 포함해야 하는 페이지는 config 에 includeHidden:true 를 주면 됩니다
      if (cfg.includeHidden !== true) u += '&hidden=is.false';
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

    /* ============================================================
       모아둔 사진으로 빈 이미지 칸 채우기
        · entity_photo_main 뷰에서 항목별 대표 사진 한 장을 받아온다
        · 기존 값이 있는 항목은 건드리지 않는다
        · 조회에 실패해도 목록은 정상적으로 그려진다
       ============================================================ */
    function fillPhotos(rows, opt) {
      var col = opt.col || 'image_url';
      /* ★ idCol 을 주면 <b>그 칸에 담긴 번호</b>로 사진을 찾습니다.

         왜 필요한가 — 현대음악DB 는 사진을 따로 모아 두지 않았습니다
         (entity_photos 에 person·org·school·venue 만 있습니다).
         그런데 그 작곡가의 80%가 인물DB 에도 있습니다. 그래서
         person_id 로 이어 두고 <b>인물의 사진</b>을 씁니다.

         쓰는 법 —
           photoFill:{ type:'person', col:'image_url', idCol:'person_id' }
         적지 않으면 예전처럼 자기 id 로 찾습니다. */
      var idCol = opt.idCol || 'id';
      var need = rows.filter(function (r) {
        return r && r[idCol] && !String(r[col] || '').trim();
      }).map(function (r) { return r[idCol]; });
      if (!need.length) return Promise.resolve();

      var url = SB_URL + '/rest/v1/entity_photo_main'
        + '?select=entity_id,src,thumb'
        + '&entity_type=eq.' + encodeURIComponent(opt.type)
        + '&entity_id=in.(' + need.join(',') + ')'
        + '&limit=' + need.length;

      return fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) {
          if (!Array.isArray(list) || !list.length) return;
          var by = {};
          list.forEach(function (x) { by[x.entity_id] = x.thumb || x.src; });
          rows.forEach(function (r) {
            if (!r || !r[idCol]) return;
            if (String(r[col] || '').trim()) return;
            var u = by[r[idCol]];
            /* ★ 목록 그림은 보이는 크기(38px)의 두 배로만 받습니다.
               예전에는 160px 로 받았는데, 그림 한 장이 크면 목록을
               굴릴 때 버벅거렸습니다. 공용 규칙(assets/thumb.js)을
               쓰면 화면 쪽과 어긋나지 않습니다. */
            if (u) {
              r[col] = (window.OCThumb && window.OCThumb.wikiThumb)
                ? window.OCThumb.wikiThumb(u, 76) : wikiThumb(u, 76);
              r._photoFromStore = true;
            }
          });
        })
        .catch(function () { /* 실패해도 목록은 그린다 */ });
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
          var cnt = document.querySelector('.pdb-count b'); if (cnt) countUp(cnt, total || 0);
          if (rows.length === 0) {
            /* ★ 줄에 pdb-norow 표시를 붙입니다.
               표에는 「줄에 마우스를 올리면 짙어지는」 규칙이 있는데,
               빈 결과 자리에도 그것이 걸려 배경이 짙어지고 그 위에서
               단추 글자가 보이지 않았습니다. 이 줄만 빼 줍니다. */
            if (tbody) tbody.innerHTML = '<tr class="pdb-norow"><td colspan="' + ncol + '">' + emptyHtml() + '</td></tr>';
            if (pager) pager.innerHTML = '';
            fixEmptyCta();
          } else {
            /* 이미지 칸이 빈 항목은 모아둔 사진(entity_photos)으로 채운 뒤 그린다.
               cfg.photoFill = { type:'person', col:'image_url' } 형태로 지정하면 동작한다.
               기존 값이 있으면 건드리지 않으므로, 정제된 데이터가 항상 우선된다. */
            var drawRows = function () {
              if (tbody) tbody.innerHTML = rows.map(function (rw, ix) { return cfg.renderRow(rw, off + ix + 1, ctx); }).join('');
              renderPager();
              /* 뷰에서 '리스트로' 눌러 돌아왔을 때 눌렀던 줄로 데려간다.
                 반드시 줄을 그린 다음에 찾아야 한다.
                 2026-07-29 · 이 처리가 drawRows 밖에 있어서, 사진을 채우고 그리는
                 목록(인물·학교·단체·공연장)에서는 아직 줄이 없는 채로 찾다가 실패했다.
                 사진을 안 쓰는 목록(현대음악·기관재단·학술)만 우연히 동작했다. */
              focusRow();
            };
            if (cfg.photoFill && cfg.photoFill.type) {
              fillPhotos(rows, cfg.photoFill).then(drawRows, drawRows);
            } else {
              drawRows();
            }
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

    /* 최초 로드
       통합검색에서 ?q=검색어 로 넘어오면 검색창에 넣고 바로 찾는다 */
    var _sp = parseInt(new URLSearchParams(location.search).get('p'), 10) || 1;
    var _q = new URLSearchParams(location.search).get('q') || '';

    /* ★ 2026-08-09 · 주소로 <고르는 상자>를 미리 골라 주는 기능
       ------------------------------------------------------------
       왜 필요한가
         음악사 연표에서 「인물DB 더 보기」를 누르면 그 시대의 인물만
         보여야 합니다. 그런데 ?q=바로크 로 넘기면 아무것도 안 나옵니다 —
         인물DB 검색은 이름·학교·소개문만 뒤지고 era_name 은 안 보기 때문입니다.

         고르는 상자로는 걸러지는데, 그 상자를 <주소로 미리 고를 길>이
         없었습니다. 그것을 여기서 만듭니다.

       쓰는 법
         ?sel=바로크            첫 상자를 「바로크」로
         ?sel1=관현악           둘째 상자를 「관현악」으로 (0부터 셉니다)
         ?sel=바로크&sel2=작곡   여럿을 함께

       ★ 그 상자에 그 값이 <실제로 있을 때만> 고릅니다.
         없는 값을 넣으면 조용히 지나갑니다 — 빈 목록이 되지 않습니다.
         (연표에서 「근·현대」를 보내는데 인물DB 상자에 그 말이 없다면
          거르지 않고 전체를 보여 주는 편이 낫습니다) */
    (function applyUrlSelects(){
      var sp = new URLSearchParams(location.search);
      var sels = document.querySelectorAll('.pdb-selects select');
      if (!sels.length) return;
      for (var i = 0; i < sels.length; i++) {
        var v = sp.get(i === 0 ? 'sel' : ('sel' + i));
        if (v === null) v = sp.get('sel' + i);
        if (!v) continue;
        var opts = sels[i].options, hit = null;
        for (var k = 0; k < opts.length; k++) {
          if (opts[k].value === v || opts[k].textContent.trim() === v) { hit = opts[k].value; break; }
        }
        if (hit !== null) sels[i].value = hit;
      }
    })();

    /* 뷰에서 '리스트로' 눌러 돌아온 경우 (주소에 focus 가 붙어 있다)
       담아 둔 검색어 · 고른 항목 · 페이지를 되돌린 뒤 그 쪽을 연다. */
    var _spot = focusId ? readSpot(focusId) : null;
    if (_spot) {
      var _si = document.querySelector('.pdb-search input');
      if (_si) _si.value = _spot.q || '';
      var _sels = document.querySelectorAll('.pdb-selects select');
      if (_spot.sels && _spot.sels.length === _sels.length) {
        _sels.forEach(function (sl, i) { sl.value = _spot.sels[i]; });
      }
      readSearch();
      loadPage(_spot.page || _sp);
      return;                    /* 아래 기본 로드는 건너뛴다 */
    }
    if (_q) {
      var _inp = document.querySelector('.pdb-search input');
      if (_inp) _inp.value = _q;
      readSearch();
      loadPage(1);
    } else {
      loadPage(_sp >= 1 ? _sp : 1);
    }
  }

  return { init: init, esc: esc, ava: ava, nd: nd, wikiThumb: wikiThumb };
})();
