/* i18n 이 없을 때를 위한 폴백 — 언어를 붙이지 못해도 이동은 됩니다 */
if (typeof window.ocGo !== 'function') { window.ocGo = function (u, r) { if (r) location.replace(u); else location.href = u; }; }
/* ============================================================
   OPUSCLAM 공용 게시판 엔진 — assets/board.js
   ------------------------------------------------------------
   '목록 + 상세' 를 config 로 재사용. (뉴스/공지가 첫 사용처)
   다른 게시판(핫토픽·입시 등)은 config 만 바꿔 그대로 재사용한다.

   목록:  OCBoard.list({
            table:'news', pageSize:20, viewPage:'news-view.html',
            searchCols:['title','body'],
            categories:[{value:'',label:'전체'},{value:'공지',label:'공지'},{value:'뉴스',label:'뉴스'}],
            pinnedFirst:true
          });
   상세:  OCBoard.view({
            table:'news', listPage:'news.html', writePage:'news-write.html',
            incrementFn:'news_increment_view',
            itemType:'news'   // 관리자 수정/삭제 링크에 사용
          });
   ============================================================ */
window.OCBoard = (function () {
  'use strict';
  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  var THUMB = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M2 21h3V9H2v12zM22 10c0-1.1-.9-2-2-2h-6.3l1-4.6c.02-.1.03-.2.03-.3 0-.4-.17-.8-.44-1.06L13.2 1 7.6 6.6C7.22 7 7 7.5 7 8v10c0 1.1.9 2 2 2h8c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z"/></svg>';

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ★ 회원만 내려받는 첨부파일 ─────────────────────────────────
     악보 게시판은 파일을 <b>회원에게만</b> 줍니다. 저장소를 비공개로
     잠갔으므로, 주소를 그대로 링크하면 동작하지 않습니다.
     assets/score-dl.js 가 로그인을 확인하고 <b>임시 주소</b>를 만들어
     줍니다(5분 뒤 스스로 죽습니다).

     ★ 다른 게시판은 그대로입니다 — memberOnlyFile 이 켜진 게시판에서만
       이 길로 갑니다. 공연정보·관련사이트 등은 예전처럼 바로 링크합니다.

     ★ 판단은 <b>section</b> 으로 합니다. spot-view.html 은 정보SPOT 의
       모든 갈래가 함께 쓰는 화면이라, 설정 한 줄로는 갈라지지 않습니다. */
  function isMemberOnlyFile(cfg, rec){
    if (cfg && cfg.memberOnlyFile === true) return true;
    if (rec && rec.section === '악보') return true;
    return false;
  }
  /* 회원만 내려받는 파일은 <a href> 대신 단추로 그립니다 —
     누른 뒤에 임시 주소를 만들어야 하기 때문입니다. */
  function fileAnchor(cfg, rec, cls, inner){
    if (!rec || !rec.file_url) return '';
    if (isMemberOnlyFile(cfg, rec)){
      return '<a class="' + cls + ' oc-mfile" href="#" role="button"'
        + ' data-mfile="' + esc(rec.file_url) + '"'
        + ' data-mname="' + esc(rec.file_name || '') + '"'
        + ' data-mid="' + esc(rec.id || '') + '"'
        + ' title="회원만 내려받을 수 있습니다">' + inner + '</a>';
    }
    return '<a class="' + cls + '" href="' + esc(rec.file_url) + '"'
      + ' target="_blank" rel="noopener">' + inner + '</a>';
  }
  /* 누르면 score-dl.js 로 넘깁니다. 화면마다 붙이지 않고 문서 하나에
     한 번만 붙입니다(중복 방지). */
  if (!window.__ocMFileBound){
    window.__ocMFileBound = true;
    document.addEventListener('click', function (e) {
      /* 악보의 바깥 링크 — 회원만 */
      var L = e.target && e.target.closest ? e.target.closest('.oc-mlink') : null;
      if (L){
        e.preventDefault();
        if (!window.OCScoreDL){
          alert('내려받기 도구(assets/score-dl.js)를 불러오지 못했습니다.');
          return;
        }
        window.OCScoreDL.openLink(L.getAttribute('data-mlink'));
        return;
      }
      var a = e.target && e.target.closest ? e.target.closest('.oc-mfile') : null;
      if (!a) return;
      e.preventDefault();
      var url = a.getAttribute('data-mfile');
      var nm  = a.getAttribute('data-mname');
      var id  = a.getAttribute('data-mid');
      if (!window.OCScoreDL){
        alert('내려받기 도구(assets/score-dl.js)를 불러오지 못했습니다.');
        return;
      }
      window.OCScoreDL.download(url, nm).then(function (ok) {
        if (ok && id) window.OCScoreDL.countUp(id);
      });
    });
  }

  /* ── 그림을 알맞은 크기로 ────────────────────────────────

     큰 그림을 잘게 줄이면 계단이 생겨 지글거립니다.
     공연 포스터는 폭이 500~800px 인데 목록에서는 80px 로 그리니
     여덟 배 넘게 줄어 특히 눈에 띕니다.
     그래서 「보낼 때부터 알맞은 크기로」 받습니다.

     거치는 곳이 멈추면 그림이 안 보일 수 있으므로
     imgTag() 가 실패하면 원본으로 되돌립니다.
     ────────────────────────────────────────────────────── */
  function rsz(u, w) {
    if (!u || !w) return u || '';
    u = String(u).replace(/^http:\/\//, 'https://');
    if (u.indexOf('images.weserv.nl') >= 0) return u;
    if (u.indexOf('ytimg.com') >= 0 || u.indexOf('youtube.com') >= 0) return u;
    if (u.indexOf('data:') === 0 || u.charAt(0) === '/') return u;   /* 우리 쪽 그림 */
    /* 위키미디어는 그쪽이 줄여 주는 길이 있습니다 */
    if (u.indexOf('Special:FilePath') >= 0) {
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + Math.round(w * 2);
    }
    if (u.indexOf('upload.wikimedia.org') >= 0) return u;
    /* 고해상도 화면에서도 또렷하도록 두 배로 받습니다 */
    var px = Math.round(Math.min(w * 2, 1200));
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(u)
         + '&w=' + px + '&output=webp&q=82&we';
  }

  /* 그림 하나를 만듭니다 — 줄인 것을 먼저 쓰고, 안 되면 원본으로 되돌립니다 */
  /* ★ 이미 받아진 그림의 반짝임을 떼어 줍니다.

     브라우저 곳간(cache)에 있던 그림은 <b>onload 가 불리지 않을 수</b>
     있습니다. 그러면 그림은 보이는데 뒤에서 계속 반짝입니다.
     그려 넣은 뒤 한 번 훑어 complete 인 것을 정리합니다.

     ★ 목록을 그리는 곳마다 부르지 않고, 문서에 한 번만 감시를 붙입니다.
       그러면 새 줄이 들어올 때도 저절로 정리됩니다. */
  function sweepLoaded(root) {
    var box = root || document;
    var list = box.querySelectorAll ? box.querySelectorAll('img.oc-imgload') : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].complete && list[i].naturalWidth > 0) {
        list[i].classList.remove('oc-imgload');
      }
    }
  }
  if (!window.__ocImgSweep) {
    window.__ocImgSweep = true;
    /* 목록이 그려질 때마다 훑습니다 — 자주 부르지 않게 조금 미룹니다 */
    var _t = null;
    var _mo = new MutationObserver(function () {
      if (_t) return;
      _t = setTimeout(function () { _t = null; sweepLoaded(document); }, 120);
    });
    if (document.body) {
      _mo.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        _mo.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  function imgTag(u, w, extra) {
    if (!u) return '';
    var small = rsz(u, w);
    var orig = String(u).replace(/^http:\/\//, 'https://');
    var fb = (small !== orig)
      ? ' data-orig="' + esc(orig) + '"'
        + ' onerror="if(this.dataset.orig&&this.src!==this.dataset.orig){this.src=this.dataset.orig;}'
        + 'else{this.onerror=null;this.classList.remove(\'oc-imgload\');this.style.display=\'none\';}"'
      : ' onerror="this.onerror=null;this.classList.remove(\'oc-imgload\');this.style.display=\'none\'"';
    /* ★ 그림이 들어올 때까지 <b>반짝이는 표시</b>를 둡니다.

       왜 필요한가 — 공연 포스터는 한 장에 수백 KB 이고 목록에 스물넷이
       놓입니다. 그동안 자리가 <b>빈 상자</b>로 남아서 「안 나오는 건가」
       싶습니다. 반짝이면 「오는 중」 임이 보입니다.

       어떻게 — 그림에 oc-imgload 를 달아 두고, 다 받으면 그 표시를
       뗍니다(onload). 못 받아도 뗍니다 — 그러지 않으면 영원히 반짝입니다.
       ★ 이미 브라우저 곳간에 있던 그림은 onload 가 늦게 불릴 수 있어
         complete 를 함께 봅니다. */
    /* ★ extra 에 class 가 들어올 수 있습니다 (피처드 그림 등).
       그때 class 를 <b>따로 두 번</b> 적으면 브라우저가 뒤의 것만 쓰고
       앞의 oc-imgload 를 버립니다 — 그래서 반짝임이 안 보였습니다.
       그러니 <b>합쳐서 한 번</b>만 적습니다. */
    var ex = extra || '';
    var cls = 'oc-imgload';
    var m = ex.match(/\sclass="([^"]*)"/);
    if (m) { cls += ' ' + m[1]; ex = ex.replace(m[0], ''); }
    return '<img src="' + esc(small) + '" alt="" loading="lazy" decoding="async"'
      + ' class="' + cls + '"' + ex + fb
      + ' onload="this.classList.remove(\'oc-imgload\')">';
  }

  /* ── Linked 청하기 파일을 필요할 때만 싣습니다 ─────────────
     ★ 자리(.bv-linked)가 놓이는 화면에서만 싣습니다.
       목록 화면에서는 부르지 않으므로 헛되게 받아 오지 않습니다. */
  function needLinkedAsk() {
    if (window.__ocLinkedAsk) return;
    window.__ocLinkedAsk = true;
    var sc = document.createElement('script');
    sc.src = '/assets/linked-ask.js';
    sc.onerror = function () { /* 못 받아도 화면은 그대로 돕니다 */ };
    document.head.appendChild(sc);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return esc(String(iso).slice(0, 10));
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }
  function nl2br(s) { return esc(s).replace(/\r\n|\r|\n/g, '<br>'); }
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return esc(String(iso).slice(0, 16));
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src;
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function catClass(c) { return c === '공지' ? 'is-notice' : 'is-news'; }

  /* ── 관리자 여부 (auth.js 의 ocAuth 사용, 없으면 false) ── */
  function checkAdmin() {
    return new Promise(function (res) {
      if (!window.ocAuth || !window.ocAuth.myMember) return res(null);
      try {
        window.ocAuth.myMember().then(function (m) { res(m && m.is_admin ? m : null); }).catch(function () { res(null); });
      } catch (e) { res(null); }
    });
  }

  /* ── 로그인 회원 여부 (is_admin 무관, 로그인만 확인) ── */
  function checkMember() {
    return new Promise(function (res) {
      if (!window.ocAuth || !window.ocAuth.myMember) return res(null);
      try {
        window.ocAuth.myMember().then(function (m) { res(m || null); }).catch(function () { res(null); });
      } catch (e) { res(null); }
    });
  }

  /* 본문 미리보기: 줄바꿈·공백 정리 후 잘라내기 (CSS로 2줄 제한) */
  function previewText(s, n) {
    var t = (s == null ? '' : String(s)).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    n = n || 120;
    return esc(t.length > n ? t.slice(0, n) + '\u2026' : t);
  }

  /* 학교 이름을 로고 자리에 들어갈 약칭으로 줄입니다
     '서울대학교 음악대학' → '서울대'   '덕원예술고등학교' → '덕원예고'
     파비콘은 쓰지 않습니다 — 파비콘이 없는 학교는 검색엔진이 기본 지구 아이콘을 주고
     그것이 정상 응답이라 우리 쪽에서 걸러낼 방법이 없습니다 */
  function shortName(nm) {
    var t = String(nm || '').trim();
    if (!t) return '';
    // 학과·단위 이름 제거
    t = t.replace(/\s*(음악대학|음악학부|음악학과|음악과|음악원|음악테크놀로지대학|음악공연예술대학|공연예술대학|예술종합대학|예술체육대학|예술대학|예술학부|예술학과|작곡과|기악과|성악과|관현악과|피아노과|국악과|실용음악과|대학원)\s*$/g, '').trim();
    t = t.replace(/\s+/g, '');
    // 흔한 학교 종류를 약칭으로
    t = t.replace(/예술종합학교$/, '예종')
         .replace(/예술고등학교$/, '예고')
         .replace(/예술대학교$/, '예대')
         .replace(/여자대학교$/, '여대')
         .replace(/여자고등학교$/, '여고')
         .replace(/대학교$/, '대')
         .replace(/고등학교$/, '고')
         .replace(/중학교$/, '중');
    if (t.length > 5) t = t.slice(0, 5);
    return t;
  }
  /* 이름마다 다른 배경색을 만들어 리스트에서 서로 구분되게 합니다 */
  function tintOf(nm) {
    var h = 0, str = String(nm || '');
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',34%,93%)';
  }
  function textLogo(nm) {
    var sn = shortName(nm);
    if (!sn) return '<span class="doc-logo-ph"></span>';
    return '<span class="doc-logo-txt" style="display:flex;align-items:center;justify-content:center;'
      + 'width:100%;height:100%;background:' + tintOf(nm) + ';font-weight:700;letter-spacing:-.02em;'
      + 'font-size:' + (sn.length >= 5 ? '13px' : sn.length === 4 ? '15px' : '17px') + ';'
      + 'line-height:1.2;text-align:center;word-break:keep-all;padding:4px">' + esc(sn) + '</span>';
  }

  /* ============================ 목록 ============================ */
  function list(cfg) {
    var PAGE = cfg.pageSize || 20, cur = 1, total = 0, cat = '', q = '', yr = '', region = '', era = '';
    var sortCol = cfg.defaultSort || 'created_at';
    /* 날짜 탭 — 「진행중·예정 / 지난 / 전체」처럼 오늘을 기준으로 나눕니다.
       cfg.dateTabs 를 주지 않은 게시판에서는 늘 빈 값이라 아무 일도 하지 않습니다. */
    var dtab = (cfg.dateTabs && cfg.dateTabs.def) || '';
    var listEl = document.querySelector('.board-list');
    var pager = document.querySelector('.board-pager');
    if (pager) pager.classList.add('pdb-pager');
    var catsEl = document.querySelector('.board-cats');
    var sortEl = document.querySelector('.board-sort');
    if (sortEl) sortEl.addEventListener('change', function () { sortCol = sortEl.value || 'created_at'; loadPage(1); });

    /* 카테고리 탭 생성 */
    if (catsEl && cfg.categories && cfg.categories.length) {
      catsEl.innerHTML = cfg.categories.map(function (c, i) {
        return '<button type="button" class="board-cat-tab' + (i === 0 ? ' on' : '') + '" data-cat="' + esc(c.value) + '">' + esc(c.label) + '</button>';
      }).join('');
      catsEl.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.board-cat-tab'); if (!b) return;
        cat = b.getAttribute('data-cat') || '';
        catsEl.querySelectorAll('.board-cat-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
        loadPage(1);
      });
    }

    /* 카테고리 드롭다운 생성 (탭 대신 select 를 쓰는 게시판용) */
    var catSel = document.querySelector('.board-catsel');
    if (catSel && cfg.categories && cfg.categories.length) {
      catSel.innerHTML = cfg.categories.map(function (c) {
        return '<option value="' + esc(c.value) + '">' + esc(c.label) + '</option>';
      }).join('');
      catSel.addEventListener('change', function () { cat = catSel.value || ''; loadPage(1); });
    }

    /* ── 날짜 탭 (cfg.dateTabs) ──
       기한이 있는 목록에 씁니다 — 공연정보·콩쿨·페스티벌·지원금처럼
       「이미 지난 것」이 섞여 있으면 목록이 못 쓰게 되는 자리입니다.

       설정 보기
         dateTabs:{
           col:'date_to',                                  // 기준 칸
           def:'upcoming',                                 // 처음에 켜질 탭
           tabs:[{value:'upcoming', label:'진행중·예정', dir:'asc'},
                 {value:'past',     label:'지난 공연',   dir:'desc'},
                 {value:'all',      label:'전체',        dir:'desc'}]
         }

       value 는 셋만 알아봅니다 — 'upcoming'(오늘 이후) · 'past'(오늘 이전) · 'all'(전부).
       dir 은 그 탭에서 쓸 정렬 방향입니다. 예정은 가까운 날부터(asc)가 맞습니다.

       놓을 자리는 화면의 <div class="board-datetabs"></div> 입니다.
       그 칸이 없으면 아무것도 그리지 않습니다(거르기는 그대로 됩니다). */
    var dtEl = document.querySelector('.board-datetabs');
    if (dtEl && cfg.dateTabs && cfg.dateTabs.tabs && cfg.dateTabs.tabs.length) {
      if (!dtab) dtab = cfg.dateTabs.tabs[0].value || '';
      dtEl.innerHTML = cfg.dateTabs.tabs.map(function (c) {
        return '<button type="button" class="board-cat-tab' + (c.value === dtab ? ' on' : '')
             + '" data-dtab="' + esc(c.value) + '">' + esc(c.label) + '</button>';
      }).join('');
      dtEl.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.board-cat-tab'); if (!b) return;
        dtab = b.getAttribute('data-dtab') || '';
        dtEl.querySelectorAll('.board-cat-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
        loadPage(1);
      });
    }

    /* 오늘 날짜 — 서울 기준으로 고정합니다.
       보는 분의 시계가 어느 나라로 맞춰져 있든 같은 결과가 나오게 합니다. */
    function todayKST() {
      return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    }

    /* 정렬 방향 — 기본은 지금까지와 똑같이 내림차순(최신 먼저)입니다.
       ① cfg.sortDir:'asc' 로 게시판 전체를 바꿀 수 있고
       ② 날짜 탭에 dir 이 적혀 있으면 그것이 이깁니다.
       다만 보는 분이 정렬 상자를 직접 골라 다른 칸으로 바꾸면
       탭의 방향은 쓰지 않습니다 — 인기순을 오름차순으로 볼 이유가 없습니다. */
    function sortDir() {
      if (cfg.dateTabs && cfg.defaultSort && sortCol === cfg.defaultSort) {
        var tabs = cfg.dateTabs.tabs || [];
        for (var i = 0; i < tabs.length; i++) {
          if (tabs[i].value === dtab && tabs[i].dir) return tabs[i].dir === 'asc' ? 'asc' : 'desc';
        }
      }
      return cfg.sortDir === 'asc' ? 'asc' : 'desc';
    }

    /* 년도 선택 (자료형 게시판용, cfg.yearFilter) — 제목에 해당 연도 포함으로 필터 */
    var yearSel = document.querySelector('.board-yearsel');
    if (yearSel) {
      if (yearSel.options.length <= 1) {
        var yNow = new Date().getFullYear(), yo = '<option value="">년도선택</option>';
        for (var yy = yNow; yy >= yNow - 12; yy--) yo += '<option value="' + yy + '">' + yy + '년도</option>';
        yearSel.innerHTML = yo;
      }
      yearSel.addEventListener('change', function () { yr = yearSel.value || ''; loadPage(1); });
    }

    /* 지역(국내/해외 등) 필터 (cfg.regions) */
    var regionSel = document.querySelector('.board-regionsel');
    if (regionSel && cfg.regions && cfg.regions.length) {
      regionSel.innerHTML = cfg.regions.map(function (r) { return '<option value="' + esc(r.value) + '">' + esc(r.label || r.value) + '</option>'; }).join('');
      regionSel.addEventListener('change', function () { region = regionSel.value || ''; loadPage(1); });
    }

    /* 시대 필터 (cfg.eras) — 음원·동영상의 「현대음악이전 / 현대음악」에 씁니다.
       쓰지 않는 게시판에는 아무 영향이 없습니다. */
    var eraSel = document.querySelector('.board-erasel');
    if (eraSel && cfg.eras && cfg.eras.length) {
      eraSel.innerHTML = cfg.eras.map(function (r) { return '<option value="' + esc(r.value) + '">' + esc(r.label || r.value) + '</option>'; }).join('');
      eraSel.addEventListener('change', function () { era = eraSel.value || ''; loadPage(1); });
    }

    /* 글자 크기 조절 (인물DB와 동일 단계, .board-list 의 --board-fs 조정) */
    var fsBtns = document.querySelectorAll('.pdb-fontsize .fs-btn');
    if (fsBtns.length && listEl) {
      var fsSizes = [13, 15, 17, 19, 21], fsIdx = 1;
      var fsApply = function () { listEl.style.setProperty('--board-fs', fsSizes[fsIdx] + 'px'); };
      fsBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-fs');
          if (k === 'up') fsIdx = Math.min(fsSizes.length - 1, fsIdx + 1);
          else if (k === 'down') fsIdx = Math.max(0, fsIdx - 1);
          else fsIdx = 1;
          fsApply();
        });
      });
    }

    function buildUrl(off) {
      var u = SB_URL + '/rest/v1/' + cfg.table + '?select=*';
      if (q && cfg.searchCols && cfg.searchCols.length) {
        var t = encodeURIComponent(q);
        u += '&or=(' + cfg.searchCols.map(function (c) { return c + '.ilike.*' + t + '*'; }).join(',') + ')';
      }
      if (cat) u += '&category=eq.' + encodeURIComponent(cat);
      if (yr) u += '&title=ilike.*' + encodeURIComponent(yr) + '*';
      if (region) u += '&region=eq.' + encodeURIComponent(region);
      if (era) u += '&era=eq.' + encodeURIComponent(era);
      /* 날짜 탭 — 오늘을 기준으로 앞뒤를 가릅니다 ('all' 이면 거르지 않습니다) */
      if (cfg.dateTabs && (dtab === 'upcoming' || dtab === 'past')) {
        var _dc = cfg.dateTabs.col || 'date_from';
        u += '&' + _dc + (dtab === 'upcoming' ? '=gte.' : '=lt.') + todayKST();
      }
      /* 페이지가 지정한 고정 조건 (예: 지식나눔의 갈래 → '&track=eq.음악지식')
         쓰지 않는 게시판에는 영향이 없습니다 */
      if (cfg.where) u += cfg.where;
      var _dir = sortDir();
      u += '&order=' + (cfg.pinnedFirst ? 'is_pinned.desc,' + sortCol + '.' + _dir : sortCol + '.' + _dir);
      u += '&limit=' + PAGE + '&offset=' + off;
      return u;
    }

    /* 목록 번호 — 전체 건수를 기준으로 매깁니다(최신 글이 큰 번호).
       뉴스형이 쓰던 방식을 나머지 목록에도 맞췄습니다. */
    function noText(no) {
      var v = Number(no) || 0;
      if (v <= 0) return '';
      return v < 10 ? ('0' + v) : String(v);
    }

    /* 재생시간 — 7:32 · 1:05:20 */
    function mmss(sec) {
      var t = Number(sec) || 0;
      if (!t) return '';
      var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s2 = t % 60;
      return h ? (h + ':' + ('0' + m).slice(-2) + ':' + ('0' + s2).slice(-2))
               : (m + ':' + ('0' + s2).slice(-2));
    }

    /* ── 카드형 목록 ──
       썸네일 왼쪽, 제목·정보 오른쪽. 두 칸으로 놓입니다(CSS).
       음원·동영상처럼 영상이 중심인 목록에 씁니다.
       cardStyle 을 켜지 않은 게시판에는 아무 영향이 없습니다. */
    function cardHtml(rec, no) {
      var vp = cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '&p=' + cur;
      var dur = mmss(rec.duration_sec);
      var img = rec.thumb_url
        ? imgTag(rec.thumb_url, 200)
        : '<i class="bc-noimg">' + esc(String(rec.title || '?').trim().charAt(0)) + '</i>';
      var meta = [];
      /* ★ 게시판마다 목록에 더 보여 줄 것을 정할 수 있게 합니다.
         악보는 <b>작곡가</b>가 없으면 누구 작품인지 알 수 없어서
         목록으로서 쓸모가 크게 떨어집니다.

         쓰는 법 — score.html 의 설정에
           metaFields:[ { col:'score_composer' }, { col:'score_opus' } ]
         적지 않은 게시판은 예전 그대로입니다. */
      (cfg.metaFields || []).forEach(function (mf) {
        var v = rec[mf.col];
        if (v === null || v === undefined || String(v).trim() === '') return;
        meta.push((mf.label ? esc(mf.label) + ' : ' : '') + esc(v));
      });
      if (rec.source || rec.channel_name) meta.push('출처 : ' + esc(rec.source || rec.channel_name));
      if (rec.created_at) meta.push('등록일 : ' + fmtDate(rec.created_at));
      meta.push('VIEW : ' + (rec.view_count || 0));
      /* 한국어 표기가 있으면 그것을 앞세우고 원문을 아래에 둡니다.
         일본어·독일어 제목만 있으면 무엇인지 알기 어렵기 때문입니다.
         koField 를 적지 않은 게시판에는 아무 영향이 없습니다. */
      var ko = cfg.koField ? (rec[cfg.koField] || '') : '';
      var head = ko || rec.title || '';
      var sub = (ko && rec.title && ko !== rec.title) ? rec.title : '';
      return '<a class="board-card" href="' + vp + '">'
        + '<span class="bc-no">' + noText(no) + '</span>'
        + '<span class="bc-th">' + img + (dur ? '<i class="bc-dur">' + dur + '</i>' : '') + '</span>'
        + '<span class="bc-info">'
        +   '<span class="bc-title">'
        +     (rec.category ? '<em class="bc-cat">[ ' + esc(rec.category) + ' ]</em> ' : '')
        +     esc(head) + newHtml(rec) + ccHtml(rec)
        +   '</span>'
        +   (sub ? '<span class="bc-orig">' + esc(sub) + '</span>' : '')
        +   '<span class="bc-meta">' + meta.join('<i>·</i>') + '</span>'
        + '</span>'
        + '</a>';
    }

    function itemHtml(rec, no) {
      if (cfg.renderItem) return cfg.renderItem(rec, { esc: esc, fmtDate: fmtDate });
      var pin = rec.is_pinned ? ' board-item-pin' : '';
      var linkIcon = rec.link_url ? '<span class="board-linkicon" title="외부 링크">\u2197</span>' : '';
      return '<a class="board-item' + pin + '" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '&p=' + cur + '">'
        + '<span class="board-item-no">' + noText(no) + '</span>'
        + '<span class="board-cat ' + catClass(rec.category) + '">' + esc(rec.category || '') + '</span>'
        + '<span class="board-title">' + paidHtml(rec) + esc(rec.title || '') + linkIcon + '</span>'
        + '<span class="board-meta"><span class="board-date">' + fmtDate(rec.created_at) + '</span>'
        + '<span class="board-views">\uc870\ud68c ' + (rec.view_count || 0) + '</span></span>'
        + '</a>';
    }

    /* ── 뉴스형(article) 렌더링 ── */
    function metaLine(rec) {
      var src = rec.source ? esc(rec.source) : '', au = rec.author_name ? esc(rec.author_name) : '';
      return src && au ? src + ' \u00b7 ' + au : (src || au);
    }
    function ccHtml(rec) { var c = rec.comment_count || 0; return c > 0 ? '<span class="board-cc">[' + c + ']</span>' : ''; }
    function newHtml(rec) { if (!cfg.newDays || !rec.created_at) return ''; var d = new Date(rec.created_at); if (isNaN(d)) return ''; return ((Date.now() - d.getTime()) / 86400000) <= cfg.newDays ? '<span class="board-new">NEW</span>' : ''; }
    function tagHtml(rec) { return rec.category ? '<span class="board-tag" data-cat="' + esc(rec.category) + '">' + esc(rec.category) + '</span>' : ''; }
    function featuredHtml(rec, related) {
      var rel = '';
      if (related && related.length) {
        rel = '<div class="board-feat-div"></div><div class="board-feat-rel"><span class="board-rel-label">관련포스트</span><ul class="board-rel-list">'
          + related.map(function (r) { return '<li><a href="' + cfg.viewPage + '?id=' + encodeURIComponent(r.id) + '">- ' + esc(r.title || '') + '</a></li>'; }).join('')
          + '</ul></div>';
      }
      var img = rec.thumb_url ? imgTag(rec.thumb_url, 420, ' class="board-feat-img"') : '';
      var react = cfg.reactions
        ? '<div class="board-feat-react"><span class="rc up">' + THUMB + '<b>' + (rec.like_count || 0) + '</b></span><span class="rc down">' + THUMB + '<b>' + (rec.dislike_count || 0) + '</b></span></div>'
        : '';
      return '<div class="board-feat">'
        + '<span class="board-ribbon">HOT</span>'
        + '<a class="board-feat-body' + (img ? ' has-img' : '') + '" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '&p=' + cur + '">'
        + img
        + '<div class="board-feat-text">'
        + '<div class="board-feat-titlerow"><div class="board-feat-title">' + esc(rec.title || '') + ccHtml(rec) + newHtml(rec) + '</div>' + react + '</div>'
        + '<p class="board-prev board-feat-prev">' + previewText(rec.body, 200) + '</p>'
        + '<div class="board-feat-meta">' + tagHtml(rec) + '<span>' + metaLine(rec) + '</span><span>' + fmtDate(rec.created_at) + '</span></div>'
        + '</div>'
        + '</a>' + rel
        + '</div>';
    }
    function articleRowHtml(rec, no) {
      var th = cfg.rowThumb ? '<span class="board-row-thumb">' + (rec.thumb_url ? imgTag(rec.thumb_url, 120) : '') + '</span>' : '';
      return '<a class="board-row' + (cfg.rowThumb ? ' has-thumb' : '') + '" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '&p=' + cur + '">'
        + '<span class="board-row-no">' + (no > 0 && no < 10 ? '0' + no : no) + '</span>'
        + th
        + '<span class="board-row-main"><span class="board-row-title">' + esc(rec.title || '') + ccHtml(rec) + newHtml(rec) + '</span>'
        + '<span class="board-prev">' + previewText(rec.body, 140) + '</span></span>'
        + '<span class="board-row-right"><span class="board-row-cat">' + tagHtml(rec) + '</span><span class="board-row-meta"><span>' + metaLine(rec) + '</span><span>' + fmtDate(rec.created_at) + '</span></span></span>'
        + '</a>';
    }
    /* 연결된 표(예: schools)에서 로고를 끌어오기 위한 캐시
       cfg.logoFrom = { table:'schools', key:'school_id', col:'logo_url' } */
    /* 연결된 표(예: schools)에서 로고·홈페이지를 끌어옵니다
       cfg.logoFrom = { table:'schools', key:'school_id', col:'logo_url', homeCol:'link_home' }
       홈페이지가 있으면 파비콘을 쓰는데, 학교 파비콘은 대개 로고 그 자체입니다 */
    var extInfo = {};
    function fetchExtLogos(rows) {
      var lf = cfg.logoFrom;
      if (!lf || !rows || !rows.length) return Promise.resolve();
      var ids = [];
      rows.forEach(function (r) {
        var k = r[lf.key];
        if (!k) return;
        if (r.logo_url) return;                    // 글에 로고가 이미 있으면 조회 불필요
                                                   // (사진만 있는 경우에는 로고를 우선하므로 조회합니다)
        if (extInfo[k] !== undefined) return;
        if (ids.indexOf(k) < 0) ids.push(k);
      });
      if (!ids.length) return Promise.resolve();
      var cols = ['id', lf.col].concat(lf.nameCol ? [lf.nameCol] : []).join(',');
      return fetch(SB_URL + '/rest/v1/' + lf.table + '?select=' + cols
                   + '&id=in.(' + ids.join(',') + ')&limit=200', { headers: HDR })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) {
          ids.forEach(function (k) { extInfo[k] = { logo: '', name: '' }; });
          (list || []).forEach(function (x) {
            extInfo[x.id] = { logo: x[lf.col] || '', name: lf.nameCol ? (x[lf.nameCol] || '') : '' };
          });
        })
        .catch(function () { ids.forEach(function (k) { extInfo[k] = { logo: '', name: '' }; }); });
    }

    /* ── 공연 목록 모양 ──────────────────────────────────────
       공연은 「무엇을·언제·어디서」 가 한눈에 보여야 합니다.
       그래서 포스터를 왼쪽에 두고 일시·장소를 라벨과 함께 적습니다.
       시안(04_공연정보)의 모양입니다.
       ────────────────────────────────────────────────────── */
    function conRowHtml(rec, no) {
      var vp = cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '&p=' + cur;
      var head = (cfg.koField && rec[cfg.koField]) ? rec[cfg.koField] : rec.title;

      /* 포스터 — 없으면 이름 첫 글자로 자리를 채웁니다 */
      /* 포스터는 목록에서 작게 그리므로 알맞은 크기로 받습니다 */
      var img = rec.thumb_url
        ? imgTag(rec.thumb_url, 110)
        : '<i class="con-noimg">' + esc(String(head || '?').trim().charAt(0)) + '</i>';

      /* 일시 — 하루면 한 날짜만, 여러 날이면 기간으로 */
      var d = function (v) { return String(v || '').slice(0, 10).replace(/-/g, '.'); };
      var df = d(rec.date_from), dt = d(rec.date_to);
      var when = df;
      if (dt && dt !== df) {
        when += ' ~ ' + (dt.slice(0, 4) === df.slice(0, 4) ? dt.slice(5) : dt);
      }
      if (!when && rec.date_text) when = rec.date_text;

      var lines = '';
      if (when) lines += '<span><b>일시</b>' + esc(when) + '</span>';
      if (rec.venue_name) lines += '<span><b>장소</b>' + esc(rec.venue_name) + '</span>';
      else if (rec.city) lines += '<span><b>장소</b>' + esc(rec.city) + '</span>';
      if (rec.organizer) lines += '<span><b>주최</b>' + esc(rec.organizer) + '</span>';

      return '<div class="con-row">'
        + '<span class="con-no">' + noText(no) + '</span>'
        + '<a class="con-th" href="' + vp + '">' + img + '</a>'
        + '<div class="con-main">'
        +   '<a class="con-title" href="' + vp + '">' + esc(head || '') + newHtml(rec) + '</a>'
        +   (lines ? '<div class="con-meta">' + lines + '</div>' : '')
        + '</div>'
        + '<div class="con-right">'
        +   '<span class="con-date">' + fmtDate(rec.created_at) + '</span>'
        +   '<span class="con-view">VIEW ' + (rec.view_count || 0) + '</span>'
        + '</div>'
        + '</div>';
    }

    /* ★ 유료 등재 배지 ───────────────────────────
       spot.paid_plan 이 들어 있는 공고에 「후원 공고」 같은 표시를 달아 줍니다.
       배지 글자는 요금표(oc_paid_plans.badge_ko)에서 가져옵니다 —
       글자를 바꾸실 때 DB 한 곳만 고치면 되고 배포가 필요 없습니다.
       요금표는 목록당 한 번만 읽습니다(두 줄짜리라 가볍습니다).
       paidBadge 를 켜지 않은 게시판은 조회도 하지 않습니다. */
    var paidMap = null;
    function fetchPaidPlans() {
      if (!cfg.paidBadge || paidMap) return Promise.resolve();
      return fetch(SB_URL + '/rest/v1/oc_paid_plans?select=code,badge_ko', { headers: HDR })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          paidMap = {};
          (rows || []).forEach(function (p) { if (p && p.code) paidMap[p.code] = p.badge_ko || ''; });
        })
        .catch(function () { paidMap = {}; });
    }
    function paidHtml(rec) {
      if (!cfg.paidBadge || !rec || !rec.paid_plan) return '';
      var t = (paidMap && paidMap[rec.paid_plan]) || '후원 공고';
      return '<span class="board-tag board-paid" data-plan="' + esc(rec.paid_plan) + '">' + esc(t) + '</span>';
    }

    function docRowHtml(rec, no) {
      /* 표시 순서
         1) 글의 사진   2) 글의 로고   3) 학교 이름 약칭(색상 배경)   4) 빈 자리
         학교DB의 이미지는 쓰지 않습니다 — 건물 사진·깃발이 섞여 있습니다 */
      var lf = cfg.logoFrom;
      var ei = (lf && rec[lf.key]) ? (extInfo[rec[lf.key]] || null) : null;
      var nameForLogo = (ei && ei.name) || rec.school_name || rec.logo_text || '';
      /* 학교DB 로고는 우리가 직접 올린 것만 씁니다.
         위키데이터에서 온 값에는 건물 사진·깃발이 섞여 있어 신뢰할 수 없습니다. */
      var trusted = (ei && ei.logo && /^\/assets\/logos\//.test(ei.logo)) ? ei.logo : '';
      /* 표시 순서 — 로고를 사진보다 앞에 둡니다
         1) 글의 로고  2) 학교DB 로고  3) 글의 사진  4) 약칭 */
      var LG = 'class="is-logo" loading="lazy" style="object-fit:contain;padding:8px"';
      /* 그림이 안 열릴 때 약칭 배지로 되돌립니다.
         바깥 사이트나 커먼즈 그림은 주소가 바뀌거나 막히는 일이 있어,
         그냥 두면 깨진 그림 아이콘이 그대로 보입니다.
         onerror 에서 감싸개 안쪽을 배지로 바꿔 끼웁니다. */
      var FB = esc(textLogo(nameForLogo)).replace(/"/g, '&quot;');
      var ONERR = ' onerror="this.onerror=null;this.outerHTML=this.getAttribute(\'data-fb\')"'
                + ' data-fb="' + FB + '"';
      var logo = rec.logo_url
        ? '<img ' + LG + ONERR + ' src="' + esc(rec.logo_url) + '" alt="">'
        : (trusted
          ? '<img ' + LG + ONERR + ' src="' + esc(trusted) + '" alt="">'
          : (rec.thumb_url
            ? '<img loading="lazy"' + ONERR + ' src="' + esc(rec.thumb_url) + '" alt="">'
            : textLogo(nameForLogo)));
      var home = rec.link_url ? '<div class="doc-home">관련홈페이지 <a href="' + esc(rec.link_url) + '" target="_blank" rel="noopener">' + esc(rec.link_url) + '</a></div>' : '';
      var dl = fileAnchor(cfg, rec, 'doc-dl', '원문');
      var vp = cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '&p=' + cur;
      var paidTag = paidHtml(rec);
      var badges = (paidTag || rec.region || rec.category)
        ? '<span class="doc-cat">'
          + paidTag
          + (rec.region ? '<span class="board-tag" data-cat="' + esc(rec.region) + '">' + esc(rec.region) + '</span>' : '')
          + (rec.category ? '<span class="board-tag" data-cat="' + esc(rec.category) + '">' + esc(rec.category) + '</span>' : '')
          + '</span>'
        : '';
      return '<div class="doc-row">'
        + '<span class="doc-no">' + noText(no) + '</span>'
        + '<a class="doc-logo" href="' + vp + '">' + logo + '</a>'
        + '<div class="doc-main"><a class="doc-title" href="' + vp + '">' + esc(rec.title || '') + ccHtml(rec) + '</a>'
        + '<p class="doc-desc">' + previewText(rec.body, 120) + '</p>' + home + '</div>'
        + badges
        + '<span class="doc-date">' + fmtDate(rec.created_at) + '</span>'
        + dl
        + '</div>';
    }
    function renderArticles(rows, offset) {
      var feat = null, i, related = [];
      for (i = 0; i < rows.length; i++) { if (rows[i].is_pinned && cur === 1) { feat = rows[i]; break; } }
      if (feat) {
        for (i = 0; i < rows.length && related.length < 3; i++) { if (rows[i] !== feat && rows[i].category === feat.category) related.push(rows[i]); }
        for (i = 0; i < rows.length && related.length < 3; i++) { if (rows[i] !== feat && related.indexOf(rows[i]) < 0) related.push(rows[i]); }
      }
      var out = '';
      for (i = 0; i < rows.length; i++) {
        var rec = rows[i];
        if (rec.is_pinned && cur === 1) out += featuredHtml(rec, related);
        else out += articleRowHtml(rec, total - offset - i);
      }
      return out;
    }

    function skeleton(n) {
      var r = '<div class="board-item board-skel"><span class="board-cat"><span class="sk"></span></span><span class="board-title"><span class="sk"></span></span><span class="board-meta"><span class="sk sk-sm"></span></span></div>';
      var o = ''; for (var i = 0; i < n; i++) o += r; return o;
    }

    function renderPager() {
      if (!pager) return;
      var pages = Math.max(1, Math.ceil(total / PAGE));
      var mob = window.innerWidth <= 520, w = mob ? 2 : 4;
      var start = Math.max(1, cur - (mob ? 1 : 2)), end = Math.min(pages, start + w); start = Math.max(1, end - w);
      var nums = '';
      for (var i = start; i <= end; i++) nums += '<a href="#" data-pg="' + i + '"' + (i === cur ? ' class="on"' : '') + '>' + i + '</a>';
      var hF = cur <= 1 ? ' style="visibility:hidden"' : '', hL = cur >= pages ? ' style="visibility:hidden"' : '';
      var h = '';
      if (!mob) h += '<a class="pg-nav" data-pg="1" href="#"' + hF + '>\u00ab \uba3c\uc55e</a>';
      h += '<a class="pg-nav" data-pg="' + (cur - 1) + '" href="#"' + hF + '>\u2039 \uc774\uc804</a>'
        + '<div class="pg-nums">' + nums + '</div>'
        + '<a class="pg-nav" data-pg="' + (cur + 1) + '" href="#"' + hL + '>\ub2e4\uc74c \u203a</a>';
      if (!mob) h += '<a class="pg-nav" data-pg="' + pages + '" href="#"' + hL + '>\uba3c\ub4a4 \u00bb</a>';
      pager.innerHTML = h;
    }

    /* ── 뷰에 다녀와도 보던 자리를 지킨다 ──────────────────
       목록에서 A 글을 눌러 뷰로 갔다가 '목록' 을 누르면
       A 가 있던 쪽으로 돌아가 그 글을 잠깐 짚어 준다.
       쪽 번호만으로는 모자라다 — 갈래 · 검색어 · 년도를 걸어 두었으면
       그것까지 되돌려야 그 글이 그 쪽에 있다.
       주소에 다 실으면 게시판마다 고쳐야 하므로 이 공용 엔진에서 담아 둔다.
       탭을 닫으면 지워진다. */
    var SKEY = 'ocbd-back:' + cfg.table;
    var focusId = new URLSearchParams(location.search).get('focus');

    function saveSpot(id) {
      try {
        sessionStorage.setItem(SKEY, JSON.stringify({
          id: String(id), page: cur, cat: cat, q: q, yr: yr, region: region, era: era, sort: sortCol, dtab: dtab
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

    /* 글을 누르는 순간 담아 둔다 */
    if (listEl) {
      listEl.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href*="?id="]') : null;
        if (!a) return;
        var m = String(a.getAttribute('href') || '').match(/[?&]id=([^&]+)/);
        if (m) saveSpot(decodeURIComponent(m[1]));
      });
    }

    /* 돌아왔을 때 그 글로 데려간다.
       글을 그린 다음에 찾아야 한다 — 그리기 전에 찾으면 없으므로 실패한다.
       (DB 리스트에서 사진을 채우고 그리는 목록만 이 기능이 안 되던 까닭이 그것이었다) */
    function focusItem() {
      if (!focusId || !listEl) return;
      var a = listEl.querySelector('a[href*="id=' + focusId + '&"], a[href$="id=' + focusId + '"]');
      if (!a) return;
      focusId = null;
      /* 목록 꼴마다 감싸는 상자가 다릅니다.
           카드형 .board-item · 행형 .board-row · 문서형 .doc-row
           기사형 .board-article · 피처드 .board-feat
         상자를 못 찾으면 링크에만 표시가 붙어, 입시요강처럼 문서형인 곳에서는
         로고 그림 한 칸만 밝아져 어색해집니다. (2026-07-29 확인) */
      /* ★ 카드형(.board-card)이 빠져 있었습니다.
         악보·음원영상은 <a class="board-card"> 하나가 곧 한 줄이라
         감싸는 상자가 없습니다. 그래서 표시가 붙지 않았습니다.
         자기 자신에게 붙도록 목록에 더합니다. (2026-08-04 확인) */
      var box = (a.classList && a.classList.contains('board-card')) ? a
              : ((a.closest && a.closest('.board-card, .doc-row, .board-item, .board-row, .board-article, .board-feat, li')) || a);
      box.classList.add('board-focus');
      try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      catch (e) { try { box.scrollIntoView(); } catch (e2) {} }
      /* ★ 표시를 <b>4.5초</b> 두었습니다.
         2.6초는 화면이 부드럽게 굴러가는 동안 절반이 지나가서,
         닿았을 때 이미 옅어져 있었습니다. */
      setTimeout(function () { box.classList.remove('board-focus'); }, 4500);
    }

    function loadPage(pg) {
      if (listEl) listEl.innerHTML = skeleton(6);
      fetch(buildUrl((pg - 1) * PAGE), { headers: Object.assign({ Prefer: 'count=exact' }, HDR) })
        .then(function (r) {
          var crg = r.headers.get('content-range'); if (crg) { var t = crg.split('/')[1]; if (t && t !== '*') total = parseInt(t, 10) || total; }
          if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
        })
        .then(function (rows) {
          if (!Array.isArray(rows)) return;
          cur = pg;
          var cnt = document.querySelector('.board-count b'); if (cnt) cnt.textContent = (total || 0).toLocaleString();
          if (!rows.length) {
            if (listEl) listEl.innerHTML = '<div class="board-empty">아직 등록된 글이 없습니다.</div>';
            if (pager) pager.innerHTML = '';
          } else {
            return Promise.all([fetchExtLogos(rows), fetchPaidPlans()]).then(function () {
              if (listEl) {
                /* 카드형은 두 칸으로 놓이므로 목록 자리에 표시를 달아 둡니다 */
                listEl.classList.toggle('as-cards', !!cfg.cardStyle);
                /* 공연 목록도 두 칸으로 — 목록 폭이 넓어 한 줄에 하나면 비어 보입니다 */
                listEl.classList.toggle('as-concert', !!cfg.concertStyle);
                /* ★★ 2026-08-12 · 글 목록·자료 목록도 두 칸으로 ★★
                   ─────────────────────────────────────────────────
                   ★ 왜
                     목록 한 줄이 화면 폭을 다 쓰는데 담긴 것은 제목과
                     한두 줄 미리보기뿐입니다. 오른쪽이 휑하고, 열 건을
                     보려면 화면을 다섯 번 내려야 했습니다.
                     음원·동영상(as-cards)·공연(as-concert)은 이미
                     두 칸이었으므로 <b>같은 결</b>로 맞춥니다.

                   ★ 어떻게
                     화면마다 고치지 않습니다. 게시판 설정에 twoCol 한 줄을
                     넣으면 여기서 표시를 붙이고 <b>모양은 board.css</b> 가 냅니다.
                     끄고 싶은 게시판은 그 줄만 지우면 됩니다.

                   ★ 고정글(HOT)은 두 칸을 가로질러 한 줄을 다 씁니다
                     css 에서 grid-column:1/-1 로 잡았습니다. 반으로 줄이면
                     큰 사진과 관련포스트가 들어갈 자리가 없습니다. */
                listEl.classList.toggle('as-two', !!cfg.twoCol);
                /* 번호는 전체 건수에서 거꾸로 셉니다 — 최신 글이 가장 큰 번호입니다.
                   다만 오름차순으로 보고 있을 때(예: 「진행중·예정」 공연)는
                   맨 위가 1번이라야 읽힙니다. 방향을 따라갑니다. */
                var off = (pg - 1) * PAGE;
                var numOf = sortDir() === 'asc'
                  ? function (i) { return off + i + 1; }
                  : function (i) { return total - off - i; };
                listEl.innerHTML = cfg.concertStyle
                  ? rows.map(function (r, i) { return conRowHtml(r, numOf(i)); }).join('')
                  : (cfg.cardStyle
                  ? rows.map(function (r, i) { return cardHtml(r, numOf(i)); }).join('')
                  : (cfg.docStyle
                  ? rows.map(function (r, i) { return docRowHtml(r, numOf(i)); }).join('')
                  : (cfg.articleStyle
                  ? renderArticles(rows, off)
                  : rows.map(function (r, i) { return itemHtml(r, numOf(i)); }).join(''))));
              }
              renderPager();
              focusItem();          /* 반드시 그린 뒤에 */
            });
          }
        })
        .catch(function (e) { console.error((cfg.table) + ' 목록 로드 실패:', e); if (listEl) listEl.innerHTML = '<div class="board-empty">목록을 불러오지 못했습니다.</div>'; });
    }

    if (pager) pager.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-pg]'); if (!a) return; e.preventDefault();
      var pg = parseInt(a.getAttribute('data-pg'), 10), pages = Math.max(1, Math.ceil(total / PAGE));
      if (pg >= 1 && pg <= pages && pg !== cur) { loadPage(pg); if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });

    var inp = document.querySelector('.board-search input');
    function doSearch() { q = (inp ? inp.value : '').trim().replace(/[(),*]/g, ' ').replace(/\s+/g, ' ').trim(); loadPage(1); }
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
    var sb = document.querySelector('.board-searchbtn'); if (sb) sb.addEventListener('click', doSearch);

    /* '글쓰기' 버튼 — writeRole:'member'면 로그인 회원 누구나, 아니면 관리자만
       writeLabel 을 주면 버튼 글자를 바꿀 수 있다 (없으면 '글쓰기') */
    if (cfg.writePage) {
      var gate = cfg.writeRole === 'member' ? checkMember : checkAdmin;
      gate().then(function (m) {
        if (!m) return;
        var bar = document.querySelector('.board-actions');
        if (bar) bar.innerHTML = '<a class="board-write" href="' + cfg.writePage + '">'
          + esc(cfg.writeLabel || '\uae00\uc4f0\uae30') + '</a>';
      });
    }

    /* 화제 카드 고정 위치 = 고정 헤더 높이 (기기/상태별 실측) */
    (function () {
      function applyTop() {
        var h = document.querySelector('.site-header') || document.querySelector('header.masthead') || document.querySelector('header');
        if (h && h.offsetHeight) document.documentElement.style.setProperty('--feat-top', h.offsetHeight + 'px');
      }
      applyTop();
      window.addEventListener('load', applyTop);
      window.addEventListener('resize', applyTop);
      setTimeout(applyTop, 300);
      setTimeout(applyTop, 1000);
    })();

    /* 첫 로드
       ① 뷰에서 '목록' 을 눌러 돌아온 경우 (주소에 focus 가 붙어 있다)
       ② 통합검색에서 ?q=검색어 로 넘어온 경우
       ③ 그 밖에는 첫 쪽 */
    (function(){
      var _sp = focusId ? readSpot(focusId) : null;
      if (_sp) {
        cat = _sp.cat || '';  q = _sp.q || '';  yr = _sp.yr || '';
        region = _sp.region || '';  era = _sp.era || '';  sortCol = _sp.sort || sortCol;
        /* 화면의 고르는 것들도 되돌려 목록과 화면이 어긋나지 않게 한다 */
        var _bi = document.querySelector('.board-search input');
        if (_bi) _bi.value = q;
        if (typeof catSel !== 'undefined' && catSel) catSel.value = cat;
        if (typeof yearSel !== 'undefined' && yearSel) yearSel.value = yr;
        if (typeof regionSel !== 'undefined' && regionSel) regionSel.value = region;
        if (typeof eraSel !== 'undefined' && eraSel) eraSel.value = era;
        if (sortEl) sortEl.value = sortCol;
        /* cfg.categories 를 쓰는 게시판에서만 손댑니다.
           날짜 탭은 data-cat 이 없어 여기서 건드리면 모두 켜져 버립니다. */
        if (catsEl && cfg.categories && cfg.categories.length) {
          catsEl.querySelectorAll('.board-cat-tab').forEach(function (x) {
            x.classList.toggle('on', (x.getAttribute('data-cat') || '') === cat);
          });
        }
        if (dtEl && typeof _sp.dtab === 'string') {
          dtab = _sp.dtab;
          dtEl.querySelectorAll('.board-cat-tab').forEach(function (x) {
            x.classList.toggle('on', (x.getAttribute('data-dtab') || '') === dtab);
          });
        }
        loadPage(_sp.page || 1);
        return;
      }

      var _q = new URLSearchParams(location.search).get('q') || '';
      if (!_q) { loadPage(1); return; }
      var _inp = document.querySelector('.board-search input');
      if (_inp) _inp.value = _q;
      q = _q.trim().replace(/[(),*]/g, ' ').replace(/\s+/g, ' ').trim();
      loadPage(1);
    })();
  }

  /* ============================ 상세 ============================ */
  function view(cfg) {
    var box = document.querySelector('.board-view');
    var id = new URLSearchParams(location.search).get('id');
    if (!box) return;
    if (!id) { box.innerHTML = '<div class="board-empty">잘못된 접근입니다.</div>'; return; }

    fetch(SB_URL + '/rest/v1/' + cfg.table + '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1', { headers: HDR })
      .then(function (r) { return r.json(); })
      /* 글에 로고가 없으면 연결된 표(예: schools)에서 끌어옵니다 */
      .then(function (rows) {
        var lf = cfg.logoFrom, o = rows && rows[0];
        if (!lf || !o || o.logo_url || !o[lf.key]) return rows;
        var cols = [lf.col].concat(lf.homeCol ? [lf.homeCol] : []).join(',');
        return fetch(SB_URL + '/rest/v1/' + lf.table + '?select=' + cols
                     + '&id=eq.' + encodeURIComponent(o[lf.key]) + '&limit=1', { headers: HDR })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (list) {
            var x = list && list[0]; if (!x) return rows;
            o._extName = lf.nameCol ? (x[lf.nameCol] || '') : '';
            o._extLogo = x[lf.col] || '';
            return rows;
          })
          .catch(function () { return rows; });
      })
      .then(function (rows) {
        if (!rows || !rows.length) { box.innerHTML = '<div class="board-empty">글을 찾을 수 없습니다.</div>'; return; }
        var o = rows[0];
        document.title = (o.title || '뉴스') + ' · OPUSCLAM';
        var srcAu = [o.source, o.author_name].filter(Boolean).map(esc).join(' · ');

        /* ★ <b>글 쓴 사람에게 Linked 를 청하는 자리</b>입니다.
           (2026-08-04)

           마이페이지에서만 청할 수 있었는데, 그러려면 <b>상대의 아이디를
           알아야</b> 했습니다. 실제로는 글을 읽다가 「이 사람과 이어 두고
           싶다」 가 자연스럽습니다.

           ★ 자리만 만들고, 채우는 일은 assets/linked-ask.js 가 합니다 —
             그 파일이 없어도 이 화면은 그대로 돕니다.
           ★ author_id 가 없는 글(시드 자료)에는 놓지 않습니다. */
        var lkSlot = (o.author_id && o.author_name)
          ? '<span class="bv-linked" data-uid="' + esc(o.author_id)
            + '" data-name="' + esc(o.author_name) + '"></span>'
          : '';
        /* ★ 자리를 놓을 때 <b>채우는 파일도 스스로</b> 싣습니다.
           글 상세 화면 열 곳에 한 줄씩 넣으면 —
             · 배포할 파일이 열 개가 되어 빠뜨리기 쉽고
             · 새 게시판을 만들 때 또 넣어야 합니다
           (오늘 interests.js 에서 같은 것을 겪고 이렇게 바꿨습니다) */
        if (lkSlot) needLinkedAsk();
        var tag = o.category ? '<span class="board-tag">' + esc(o.category) + '</span>' : '';
        var thumb = o.thumb_url ? '<img class="bv-thumb" src="' + esc(o.thumb_url) + '" alt="" loading="lazy">' : '';
        var link = o.link_url ? '<a class="bv-link" href="' + esc(o.link_url) + '" target="_blank" rel="noopener">원문 보기 \u2197</a>' : '';
        /* ★ 악보의 바깥 링크는 <b>회원만</b>입니다.
           주소를 spot.link_url 에 두면 select=* 로 비회원에게도 새어 나가므로
           score_links 표로 옮겼고, 그 표는 회원만 읽습니다.
           여기서는 주소를 적지 않고 <b>단추만</b> 놓습니다 — 누를 때
           score-dl.js 가 회원인지 보고 주소를 받아 옵니다. */
        if (!link && isMemberOnlyFile(cfg, o) && !o.file_url){
          link = '<button type="button" class="bv-link oc-mlink" data-mlink="' + esc(o.id) + '">'
               + 'IMSLP 에서 보기 \u2197 <i>회원</i></button>';
        }
        /* 첨부파일이 있으면 본문 위에 내려받기 줄을 둔다 (자료실 성격 게시판용).
           file_url 컬럼이 없거나 비어 있는 게시판에는 아무 영향이 없다. */
        var dl = fileAnchor(cfg, o, 'bv-docdl',
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>'
          + '<span>' + esc(o.file_name
              || (isMemberOnlyFile(cfg, o) ? '악보 내려받기 (회원)' : '첨부파일 내려받기')) + '</span>');
        /* extraLinks 로 정의한 링크들 — 값이 있는 것만 버튼으로 보여준다 */
        var xlinks = '';
        if (cfg.extraLinks && cfg.extraLinks.length) {
          var xl = cfg.extraLinks.filter(function (x) { return o[x.col]; });
          if (xl.length) {
            xlinks = '<div class="bv-xlinks">' + xl.map(function (x) {
              return '<a class="bv-xlink" href="' + esc(o[x.col]) + '" target="_blank" rel="noopener">'
                + esc(x.label || x.col) + ' \u2197</a>';
            }).join('') + '</div>';
          }
        }
        /* 영상이 있으면 사진 대신 플레이어를 놓습니다.
           videoField 를 적지 않은 게시판에는 아무 영향이 없습니다. */
        /* 영상이 있으면 사진 대신 플레이어를 놓습니다.

           처음에는 유튜브 틀(iframe)을 넣지 않고 사진과 재생 단추만 그립니다.
           단추를 누르면 그 자리에서 유튜브 틀로 바뀌며 곧바로 재생됩니다.
             · 재생 단추가 뚜렷해서 누를 곳이 분명합니다
             · 유튜브 틀은 무거워서, 안 볼 사람에게는 받지 않는 편이 빠릅니다 */
        var player = '';
        if (cfg.videoField && o[cfg.videoField]) {
          var vid = String(o[cfg.videoField]);
          var poster = o.thumb_url || ('https://i.ytimg.com/vi/' + encodeURIComponent(vid) + '/maxresdefault.jpg');
          player = '<figure class="bv-video">'
            + '<button type="button" class="bv-play" data-video="' + esc(vid) + '"'
            + ' aria-label="영상 재생">'
            +   '<img src="' + esc(poster) + '" alt="" loading="lazy"'
            +     ' onerror="this.src=\'https://i.ytimg.com/vi/' + esc(vid) + '/hqdefault.jpg\'">'
            +   '<span class="bv-playbtn" aria-hidden="true">'
            +     '<svg viewBox="0 0 68 48"><path class="bv-playbg" d="M66.5 7.7c-.8-2.9-2.5-5.4-5.4-6.2C55.8 0 34 0 34 0S12.2 0 6.9 1.5C4 2.3 2.3 4.8 1.5 7.7 0 13 0 24 0 24s0 11 1.5 16.3c.8 2.9 2.5 5.4 5.4 6.2C12.2 48 34 48 34 48s21.8 0 27.1-1.5c2.9-.8 4.6-3.3 5.4-6.2C68 35 68 24 68 24s0-11-1.5-16.3z"/><path class="bv-playtri" d="M45 24 27 14v20"/></svg>'
            +   '</span>'
            + '</button>'
            + (o.channel_name ? '<figcaption>' + esc(o.channel_name) + '</figcaption>' : '')
            + '</figure>';
        }
        var body = o.body ? '<div class="bv-body">' + (window.DOMPurify ? window.DOMPurify.sanitize(o.body, { ADD_ATTR: ['target', 'style'] }) : nl2br(o.body)) + '</div>' : '';
        var enhance = '';
        if (cfg.enhance) {
          var _href = cfg.writePage ? (cfg.writePage + '?mode=enhance&db=' + encodeURIComponent(cfg.enhance.db || cfg.table) + '&id=' + encodeURIComponent(o.id)) : (cfg.enhance.url || '#');
          var _mail = esc(cfg.enhance.email || 'cser@wixon.co.kr');
          var _src = cfg.enhance.source || '본 오퍼스클램 데이터는 웹상에 공개된 내용을 취합·수집하여 등록되므로, 잘못된 정보를 포함할 수 있습니다. 잘못된 정보의 수정을 원하시거나 보강할 내용이 있는 경우, 아래 <b>메일문의하기</b> 또는 <b>정보보강</b>을 통해 알려주시면 신속히 반영하겠습니다.';
          enhance = '<section class="pv-contrib">'
            + '<a class="pv-enhance" href="' + _href + '">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
            + '<span><b>' + esc(cfg.enhance.label || '정보보강하기') + '</b><small>' + esc(cfg.enhance.sub || '이 항목의 정보를 수정하거나 내용을 추가할 수 있습니다 · 자격 회원') + '</small></span>'
            + '</a>'
            + '<div class="pv-source"><p class="pv-source-t">' + _src + '</p>'
            + '<a class="pv-mailbtn" href="mailto:' + _mail + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg> 메일문의하기</a>'
            + '</div>'
            + '</section>';
        }
        if (cfg.docView) {
          box.innerHTML =
            '<div class="bv-dochead">'
            + (function(){
                /* 로고 자리 — 그림이 안 열리면 약칭 배지로 되돌립니다 */
                var nm = o._extName || o.school_name || o.logo_text || '';
                var sn = shortName(nm);
                var badge = sn
                  ? '<span class="bv-doclogo bv-doclogo-txt" style="background:' + tintOf(nm)
                    + ';font-weight:700">' + esc(sn) + '</span>'
                  : '';
                var onerr = badge
                  ? (' onerror="this.onerror=null;this.outerHTML=this.getAttribute(\'data-fb\')"'
                     + ' data-fb="' + esc(badge).replace(/"/g, '&quot;') + '"')
                  : ' onerror="this.onerror=null;this.style.display=\'none\'"';
                if (o.logo_url)
                  return '<img class="bv-doclogo"' + onerr + ' src="' + esc(o.logo_url) + '" alt="">';
                if (o._extLogo && /^\/assets\/logos\//.test(o._extLogo))
                  return '<img class="bv-doclogo"' + onerr + ' src="' + esc(o._extLogo) + '" alt="">';
                return badge;
              })()
            + '<div class="bv-dochead-t">'
            + (o.region ? '<span class="board-tag" data-cat="' + esc(o.region) + '">' + esc(o.region) + '</span> ' : '')
            + (o.category ? '<span class="board-tag" data-cat="' + esc(o.category) + '">' + esc(o.category) + '</span>' : '')
            + (function(){
                var ko = cfg.koField ? (o[cfg.koField] || '') : '';
                var head = ko || o.title || '';
                var sub = (ko && o.title && ko !== o.title) ? o.title : '';
                return '<h1 class="bv-title">' + esc(head) + '</h1>'
                  + (sub ? '<p class="bv-origtitle">' + esc(sub) + '</p>' : '');
              })()
            /* ★ 이어진 인물이 있으면 <b>그 사람에게 가는 길</b>을 놓습니다.

               악보를 보다가 「이 작곡가는 누구지?」 할 때 바로 갈 수 있어야
               합니다. 목록 카드는 전체가 링크라 그 안에 또 링크를 넣을 수
               없으므로, 상세 화면에 둡니다.

               인물 상세에는 이미 「악보 자료」 가 있으니, 이것으로
               <b>양쪽이 오갈 수 있게</b> 됩니다.

               쓰는 법 — spot-view.html 설정에
                 personLink:{ idCol:'person_id', nameCol:'score_composer' }
               적지 않은 게시판은 아무 일도 없습니다. */
            + (function(){
                var pl = cfg.personLink;
                if (!pl) return '';
                var pid = o[pl.idCol || 'person_id'];
                if (!pid) return '';
                var nm = o[pl.nameCol || 'score_composer'] || '';
                return '<div class="bv-docperson">'
                  + '<a href="' + esc(pl.base || '/db/person-view.html?id=') + encodeURIComponent(pid) + '">'
                  + (nm ? esc(nm) : '작곡가')
                  + ' <span>· 인물DB 에서 보기 \u2192</span></a></div>';
              })()
            + (o.link_url
                ? '<div class="bv-dochome">관련홈페이지 <a href="' + esc(o.link_url) + '" target="_blank" rel="noopener">' + esc(o.link_url) + '</a></div>'
                /* ★ 악보의 바깥 링크는 <b>회원만</b>입니다.
                   주소를 spot.link_url 에 두면 게시판 엔진이 select=* 로
                   받아오므로 비회원의 응답에도 새어 나갑니다. 그래서
                   score_links 표로 옮겼고, 그 표는 회원만 읽습니다.
                   여기서는 주소를 적지 않고 단추만 놓습니다 — 누를 때
                   score-dl.js 가 회원인지 보고 주소를 받아 옵니다. */
                : (isMemberOnlyFile(cfg, o) && !o.file_url
                    ? '<div class="bv-dochome"><button type="button" class="bv-link oc-mlink"'
                      + ' data-mlink="' + esc(o.id) + '">IMSLP 에서 보기 \u2197 <i>회원</i></button></div>'
                    : ''))
            + (o.school_id ? '<a class="bv-schoollink" href="' + (cfg.schoolViewPath || '/school-view.html') + '?id=' + encodeURIComponent(o.school_id) + '"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5"/></svg><span>이 학교 정보 보기</span></a>' : '')
            + '<div class="bv-meta"><span>' + fmtDate(o.created_at) + '</span><span>\uc870\ud68c ' + (o.view_count || 0) + '</span></div>'
            + '</div></div>'
            + fileAnchor(cfg, o, 'bv-docdl',
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>'
              + '<span>' + esc(o.file_name
                  || (isMemberOnlyFile(cfg, o) ? '악보 내려받기 (회원)' : '첨부파일 보기')) + '</span>')
            + (player || (o.thumb_url
                ? '<figure class="bv-docphoto"><img src="' + esc(o.thumb_url) + '" alt="" loading="lazy"'
                  /* 사진이 안 열리면 사진 자리(설명까지)를 통째로 없앱니다 —
                     깨진 그림과 빈 설명이 남는 것보다 낫습니다 */
                  + ' onerror="this.onerror=null;var f=this.closest(\'figure\');if(f)f.remove()">'
                  + (o.photo_credit ? '<figcaption>' + esc(o.photo_credit) + '</figcaption>' : '')
                  + '</figure>'
                : ''))
            + body
            + enhance
            + '<div class="bv-foot"></div>';
        } else {
        box.innerHTML =
          '<div class="bv-head">'
          + '<h1 class="bv-title">' + esc(o.title || '') + '</h1>'
          + '<div class="bv-meta">' + tag + (srcAu ? '<span>' + srcAu + lkSlot + '</span>' : '')
          + '<span>' + fmtDate(o.created_at) + '</span><span>\uc870\ud68c ' + (o.view_count || 0) + '</span></div>'
          + '</div>'
          + dl + thumb + body + xlinks + link
          + (cfg.votesTable ? '<div class="bv-votes"></div>' : '')
          + '<div class="bv-rel"></div>'
          + '<div class="bv-foot"></div>';
        }

        if (cfg.commentsTable) mountComments(cfg, o.id);
        if (cfg.votesTable) mountVotes(cfg, o);

        /* 글자 크기 조절 (상단 툴바) → 본문 --bv-fs */
        (function () {
          var fsB = document.querySelectorAll('.pdb-fontsize .fs-btn');
          if (!fsB.length) return;
          var szs = [13, 15, 17, 19, 21], fi = 1;
          function ap() { box.style.setProperty('--bv-fs', szs[fi] + 'px'); }
          fsB.forEach(function (b) {
            b.addEventListener('click', function () {
              var k = b.getAttribute('data-fs');
              if (k === 'up') fi = Math.min(szs.length - 1, fi + 1);
              else if (k === 'down') fi = Math.max(0, fi - 1);
              else fi = 1;
              ap();
            });
          });
        })();

        /* ── 사이드탭 자리잡기 ─────────────────────────────────
           (2026-08-05 다시 만듦 · 파트너 지적 두 가지를 함께 풀었습니다)

           ⓐ <b>짧은 글에서 아예 안 보였습니다</b>
              예전 규칙 : 푸터 윗변이 「단추 아래끝 + 20」 보다 위면 <b>감춤</b>.
              단추가 top:500px 이라 아래끝이 약 810px 인데, 짧은 글은
              푸터가 처음부터 그 위에 있어 <b>어느 자리로 스크롤해도</b>
              계속 감춰졌습니다.
              → 이제 감추지 않고 <b>푸터 위로 올라갑니다.</b> 올릴 자리마저
                없을 때만 감춥니다.

           ⓑ <b>이너스페이스를 열면 단추가 패널 위에 떴습니다</b>
              → 패널이 화면을 덮고 있는 동안에는 <b>비켜</b> 있고,
                스크롤해서 <b>글까지 내려오면</b> 나타납니다.
                (「아래 뷰페이지 쪽에 있어야 한다」는 뜻대로)

         ★ 자리를 잴 때는 <b>display 를 건드리지 않습니다</b> —
           display:none 이면 크기가 0 이 되어 셈이 어긋납니다.
           보이고 감추는 것은 opacity·visibility 로만 합니다. */
        (function () {
          var tabs = document.querySelector('.pv-sidetabs');
          if (!tabs) return;
          var BASE = 500;      /* 원래 자리 (board.css 의 top 과 같아야 합니다) */
          var MIN  = 96;       /* 이보다 위로는 올리지 않습니다 (헤더 자리) */

          function show(on) {
            tabs.style.opacity = on ? '1' : '0';
            tabs.style.visibility = on ? 'visible' : 'hidden';
          }

          function upd() {
            /* ⓑ 이너스페이스 패널이 화면을 덮고 있으면 비켜 있습니다 */
            var ins = document.getElementById('ocInnerSpace');
            if (ins) {
              var ib = ins.getBoundingClientRect().bottom;
              if (ib > 140) { show(false); return; }
            }

            /* ⓐ 푸터가 가까우면 그 위로 올라갑니다 */
            tabs.style.top = BASE + 'px';
            var h = tabs.offsetHeight || 0;
            var stop = document.querySelector('.bigban')
                    || document.querySelector('.triple')
                    || document.querySelector('footer')
                    || document.querySelector('#oc-footer');
            if (!stop) {
              var near = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 360);
              show(!near);
              return;
            }
            var st = stop.getBoundingClientRect().top;
            var room = st - 20 - h;          /* 푸터 위에 놓을 수 있는 윗변 */
            if (room >= BASE) { show(true); return; }        /* 원래 자리로 충분 */
            if (room >= MIN)  { tabs.style.top = room + 'px'; show(true); return; }
            show(false);                                      /* 올릴 자리도 없음 */
          }

          window.addEventListener('scroll', upd, { passive: true });
          window.addEventListener('resize', upd);
          upd();
        })();

        /* 재생 단추 — 누르면 그 자리에서 유튜브 틀로 바뀌며 곧바로 재생됩니다 */
        (function () {
          var btn = box.querySelector('.bv-play');
          if (!btn) return;
          btn.addEventListener('click', function () {
            var vid = btn.getAttribute('data-video');
            if (!vid) return;
            var fr = document.createElement('iframe');
            fr.src = 'https://www.youtube.com/embed/' + encodeURIComponent(vid)
                   + '?autoplay=1&rel=0&modestbranding=1';
            fr.title = document.title;
            fr.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen');
            fr.setAttribute('allowfullscreen', '');
            btn.replaceWith(fr);
          });
        })();

        /* 조회수 +1 (best-effort) */
        if (cfg.incrementFn) {
          fetch(SB_URL + '/rest/v1/rpc/' + cfg.incrementFn, {
            method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, HDR),
            body: JSON.stringify({ p_id: isNaN(+id) ? id : +id })
          }).catch(function () {});
        }

        /* 관련포스트 (검색어 우선 → 같은 분류 → 최근글) */
        if (cfg.viewPage && !cfg.docView) {
          var base = SB_URL + '/rest/v1/' + cfg.table + '?select=id,title&id=neq.' + encodeURIComponent(o.id);
          var recentUrl = base + '&order=created_at.desc&limit=4';
          var urls = [];
          var kws = (o.keywords || '').split(',').map(function (s) { return s.replace(/[(),*]/g, ' ').trim(); }).filter(function (s) { return s.length >= 2; }).slice(0, 5);
          if (kws.length) {
            var conds = [];
            kws.forEach(function (t) { var e = encodeURIComponent(t); conds.push('keywords.ilike.*' + e + '*'); conds.push('title.ilike.*' + e + '*'); });
            urls.push(base + '&or=(' + conds.join(',') + ')&order=created_at.desc&limit=4');
          }
          if (o.category) urls.push(base + '&category=eq.' + encodeURIComponent(o.category) + '&order=created_at.desc&limit=4');
          urls.push(recentUrl);
          (function tryNext(i) {
            if (i >= urls.length) return;
            fetch(urls[i], { headers: HDR }).then(function (r) { return r.json(); }).then(function (rel) {
              if (Array.isArray(rel) && rel.length) {
                var relBox = box.querySelector('.bv-rel'); if (!relBox) return;
                relBox.innerHTML = '<span class="board-rel-label">관련포스트</span><ul class="board-rel-list">'
                  + rel.map(function (r) { return '<li><a href="' + cfg.viewPage + '?id=' + encodeURIComponent(r.id) + '">- ' + esc(r.title || '') + '</a></li>'; }).join('')
                  + '</ul>';
                relBox.classList.add('is-on');
              } else { tryNext(i + 1); }
            }).catch(function () { tryNext(i + 1); });
          })(0);
        }

        /* 글쓰기 버튼 → 왼쪽 사이드탭(리스트 아래)으로 노출(로그인 회원) */
        if (cfg.writePage) {
          var wGate = cfg.writeRole === 'member' ? checkMember : checkAdmin;
          wGate().then(function (m) {
            if (!m) return;
            var wt = document.querySelector('.pv-writetab');
            if (wt) { wt.setAttribute('href', cfg.writePage); wt.style.display = ''; }
          });
        }

        /* 수정·삭제 (작성자 본인 또는 관리자) */
        if (cfg.writePage) {
          checkMember().then(function (m) {
            var mine = m && (m.is_admin || m.id === o.author_id || m.user_id === o.author_id || m.uid === o.author_id);
            if (!mine) return;
            var l = box.querySelector('.bv-foot'); if (!l) return;
            l.innerHTML = '<a class="bv-edit" href="' + cfg.writePage + '?id=' + encodeURIComponent(o.id) + '">수정</a>'
              + '<button type="button" class="bv-del">삭제</button>';
            var del = l.querySelector('.bv-del');
            if (del) del.addEventListener('click', function () {
              if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
              del.disabled = true;
              loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2').then(function () {
                if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
                var c = window.__ocSb;
                c.from(cfg.table).delete().eq('id', o.id).then(function (res) {
                  if (res.error) { alert('삭제 실패: ' + res.error.message); del.disabled = false; return; }
                  location.href = cfg.listPage;
                });
              });
            });
          });
        }
      })
      .catch(function (e) { console.error('상세 로드 실패:', e); box.innerHTML = '<div class="board-empty">불러오지 못했습니다.</div>'; });
  }

  /* ============================ 댓글 ============================ */
  function mountComments(cfg, newsId) {
    var wrap = document.querySelector('.bv-comments');
    if (!wrap || !cfg.commentsTable) return;
    var PAGE_C = 5, off = 0, total = 0, loading = false;
    /* 게시판에 따라 '댓글' 대신 '답변' 등으로 부를 수 있다 (기본은 댓글) */
    var CL = cfg.commentLabel || '댓글';
    wrap.innerHTML =
      '<h2 class="bvc-h">' + CL + ' <b class="bvc-count">0</b></h2>'
      + '<div class="bvc-form"><textarea class="bvc-input" rows="2" placeholder="' + CL + '을 남기려면 로그인이 필요합니다." disabled></textarea>'
      + '<button type="button" class="bvc-submit" disabled>' + CL + '등록</button></div>'
      + '<ul class="bvc-list"></ul>'
      + '<div class="bvc-more-wrap"><button type="button" class="bvc-more" style="display:none">더보기</button></div>';
    var listEl = wrap.querySelector('.bvc-list');
    var moreBtn = wrap.querySelector('.bvc-more');
    var input = wrap.querySelector('.bvc-input');
    var submit = wrap.querySelector('.bvc-submit');
    var countEl = wrap.querySelector('.bvc-count');

    function itemHtml(c) {
      return '<li class="bvc-item"><div class="bvc-top"><span class="bvc-name">' + esc(c.author_name || '회원') + '</span>'
        + '<span class="bvc-date">' + fmtDateTime(c.created_at) + '</span></div>'
        + '<div class="bvc-body">' + nl2br(c.body || '') + '</div></li>';
    }
    function load(reset) {
      if (loading) return; loading = true;
      if (reset) { off = 0; listEl.innerHTML = ''; }
      fetch(SB_URL + '/rest/v1/' + cfg.commentsTable + '?select=*&news_id=eq.' + encodeURIComponent(newsId) + '&order=created_at.desc&limit=' + PAGE_C + '&offset=' + off,
        { headers: Object.assign({ Prefer: 'count=exact' }, HDR) })
        .then(function (r) { var crg = r.headers.get('content-range'); if (crg) { var t = crg.split('/')[1]; if (t && t !== '*') total = parseInt(t, 10) || 0; } return r.json(); })
        .then(function (rows) {
          loading = false;
          if (!Array.isArray(rows)) return;
          if (off === 0 && !rows.length) listEl.innerHTML = '<li class="bvc-empty">첫 ' + CL + '을 남겨보세요.</li>';
          else listEl.insertAdjacentHTML('beforeend', rows.map(itemHtml).join(''));
          off += rows.length;
          if (countEl) countEl.textContent = total;
          if (moreBtn) moreBtn.style.display = off < total ? '' : 'none';
        })
        .catch(function () { loading = false; });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });

    /* 로그인 회원이면 입력창 활성화 + 등록 동작 */
    checkMember().then(function (m) {
      if (!m) return;
      var who = m.name || m.nickname || m.display_name || m.username || '회원';
      input.disabled = false; submit.disabled = false;
      input.placeholder = '따뜻한 의견을 남겨주세요.';
      submit.addEventListener('click', function () {
        var text = (input.value || '').trim();
        if (!text) { input.focus(); return; }
        submit.disabled = true;
        loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2').then(function () {
          if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
          var c = window.__ocSb;
          c.auth.getUser().then(function (res) {
            var user = res && res.data && res.data.user;
            if (!user) { alert('로그인이 필요합니다.'); submit.disabled = false; return; }
            c.from(cfg.commentsTable).insert({ news_id: newsId, author_id: user.id, author_name: who, body: text }).then(function (r2) {
              submit.disabled = false;
              if (r2.error) { alert('등록 실패: ' + r2.error.message); return; }
              input.value = ''; load(true);
            });
          });
        });
      });
    });

    load(true);
  }

  /* ============================ 추천/비추천 ============================ */
  function mountVotes(cfg, post) {
    var box = document.querySelector('.bv-votes');
    if (!box) return;
    var like = post.like_count || 0, dislike = post.dislike_count || 0, mine = null;
    var client = null, uid = null, busy = false;

    function render() {
      box.innerHTML =
        '<button type="button" class="bv-vote up' + (mine === 'like' ? ' on' : '') + '" data-v="like">' + THUMB + ' 추천 <b>' + like + '</b></button>'
        + '<button type="button" class="bv-vote down' + (mine === 'dislike' ? ' on' : '') + '" data-v="dislike">' + THUMB + ' 비추천 <b>' + dislike + '</b></button>';
      box.querySelectorAll('.bv-vote').forEach(function (b) { b.addEventListener('click', function () { onVote(b.getAttribute('data-v')); }); });
    }
    function ensureClient() {
      return loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2').then(function () {
        if (!client) { if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY); client = window.__ocSb; }
        return client.auth.getUser().then(function (r) { uid = r && r.data && r.data.user && r.data.user.id; return uid; });
      });
    }
    function refreshCounts() {
      return client.from(cfg.table).select('like_count,dislike_count').eq('id', post.id).single().then(function (r) {
        if (r.data) { like = r.data.like_count || 0; dislike = r.data.dislike_count || 0; }
      });
    }
    function onVote(v) {
      if (busy) return; busy = true;
      ensureClient().then(function (id) {
        if (!id) { busy = false; if (confirm('로그인이 필요한 기능입니다. 로그인 페이지로 이동할까요?')) ocGo('/account/login.html'); return; }
        var op;
        if (mine === v) { op = client.from(cfg.votesTable).delete().eq('post_id', post.id).eq('user_id', id); mine = null; }
        else { op = client.from(cfg.votesTable).upsert({ user_id: id, post_id: post.id, value: v }, { onConflict: 'user_id,post_id' }); mine = v; }
        op.then(function (res) {
          if (res.error) { busy = false; alert('처리 실패: ' + res.error.message); return; }
          refreshCounts().then(function () { busy = false; render(); });
        });
      }).catch(function () { busy = false; });
    }

    render();
    ensureClient().then(function (id) {
      if (!id) return;
      client.from(cfg.votesTable).select('value').eq('post_id', post.id).eq('user_id', id).maybeSingle().then(function (r) {
        if (r.data) { mine = r.data.value; render(); }
      });
    }).catch(function () {});
  }

  return { list: list, view: view, esc: esc, fmtDate: fmtDate };
})();
