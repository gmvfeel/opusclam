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

  /* ============================ 목록 ============================ */
  function list(cfg) {
    var PAGE = cfg.pageSize || 20, cur = 1, total = 0, cat = '', q = '';
    var sortCol = cfg.defaultSort || 'created_at';
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
      u += '&order=' + (cfg.pinnedFirst ? 'is_pinned.desc,' + sortCol + '.desc' : sortCol + '.desc');
      u += '&limit=' + PAGE + '&offset=' + off;
      return u;
    }

    function itemHtml(rec) {
      if (cfg.renderItem) return cfg.renderItem(rec, { esc: esc, fmtDate: fmtDate });
      var pin = rec.is_pinned ? ' board-item-pin' : '';
      var linkIcon = rec.link_url ? '<span class="board-linkicon" title="외부 링크">\u2197</span>' : '';
      return '<a class="board-item' + pin + '" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '">'
        + '<span class="board-cat ' + catClass(rec.category) + '">' + esc(rec.category || '') + '</span>'
        + '<span class="board-title">' + esc(rec.title || '') + linkIcon + '</span>'
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
        rel = '<div class="board-feat-div"></div><div class="board-feat-rel"><span class="board-rel-label">관련기사</span><ul class="board-rel-list">'
          + related.map(function (r) { return '<li><a href="' + cfg.viewPage + '?id=' + encodeURIComponent(r.id) + '">- ' + esc(r.title || '') + '</a></li>'; }).join('')
          + '</ul></div>';
      }
      var img = rec.thumb_url ? '<img class="board-feat-img" src="' + esc(rec.thumb_url) + '" alt="" loading="lazy">' : '';
      var react = cfg.reactions
        ? '<div class="board-feat-react"><span class="rc up">' + THUMB + '<b>' + (rec.like_count || 0) + '</b></span><span class="rc down">' + THUMB + '<b>' + (rec.dislike_count || 0) + '</b></span></div>'
        : '';
      return '<div class="board-feat">'
        + '<span class="board-ribbon">HOT</span>'
        + '<a class="board-feat-body' + (img ? ' has-img' : '') + '" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '">'
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
      var th = cfg.rowThumb ? '<span class="board-row-thumb">' + (rec.thumb_url ? '<img src="' + esc(rec.thumb_url) + '" alt="" loading="lazy">' : '') + '</span>' : '';
      return '<a class="board-row' + (cfg.rowThumb ? ' has-thumb' : '') + '" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '">'
        + '<span class="board-row-no">' + (no > 0 && no < 10 ? '0' + no : no) + '</span>'
        + th
        + '<span class="board-row-main"><span class="board-row-title">' + esc(rec.title || '') + ccHtml(rec) + newHtml(rec) + '</span>'
        + '<span class="board-prev">' + previewText(rec.body, 140) + '</span></span>'
        + '<span class="board-row-right">' + tagHtml(rec) + '<span>' + metaLine(rec) + '</span><span>' + fmtDate(rec.created_at) + '</span></span>'
        + '</a>';
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
            if (listEl) listEl.innerHTML = cfg.articleStyle ? renderArticles(rows, (pg - 1) * PAGE) : rows.map(itemHtml).join('');
            renderPager();
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

    /* '글쓰기' 버튼 — writeRole:'member'면 로그인 회원 누구나, 아니면 관리자만 */
    if (cfg.writePage) {
      var gate = cfg.writeRole === 'member' ? checkMember : checkAdmin;
      gate().then(function (m) {
        if (!m) return;
        var bar = document.querySelector('.board-actions');
        if (bar) bar.innerHTML = '<a class="board-write" href="' + cfg.writePage + '">\uae00\uc4f0\uae30</a>';
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

    loadPage(1);
  }

  /* ============================ 상세 ============================ */
  function view(cfg) {
    var box = document.querySelector('.board-view');
    var id = new URLSearchParams(location.search).get('id');
    if (!box) return;
    if (!id) { box.innerHTML = '<div class="board-empty">잘못된 접근입니다.</div>'; return; }

    fetch(SB_URL + '/rest/v1/' + cfg.table + '?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1', { headers: HDR })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!rows || !rows.length) { box.innerHTML = '<div class="board-empty">글을 찾을 수 없습니다.</div>'; return; }
        var o = rows[0];
        document.title = (o.title || '뉴스') + ' · OPUSCLAM';
        var srcAu = [o.source, o.author_name].filter(Boolean).map(esc).join(' · ');
        var tag = o.category ? '<span class="board-tag">' + esc(o.category) + '</span>' : '';
        var thumb = o.thumb_url ? '<img class="bv-thumb" src="' + esc(o.thumb_url) + '" alt="" loading="lazy">' : '';
        var link = o.link_url ? '<a class="bv-link" href="' + esc(o.link_url) + '" target="_blank" rel="noopener">원문 보기 \u2197</a>' : '';
        var body = o.body ? '<div class="bv-body">' + (window.DOMPurify ? window.DOMPurify.sanitize(o.body, { ADD_ATTR: ['target', 'style'] }) : nl2br(o.body)) + '</div>' : '';
        box.innerHTML =
          '<div class="bv-head">'
          + '<h1 class="bv-title">' + esc(o.title || '') + '</h1>'
          + '<div class="bv-meta">' + tag + (srcAu ? '<span>' + srcAu + '</span>' : '')
          + '<span>' + fmtDate(o.created_at) + '</span><span>\uc870\ud68c ' + (o.view_count || 0) + '</span></div>'
          + '</div>'
          + thumb + body + link
          + (cfg.votesTable ? '<div class="bv-votes"></div>' : '')
          + '<div class="bv-rel"></div>'
          + '<div class="bv-foot"></div>';

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

        /* 사이드탭: 하단(빅배너/푸터) 겹침 방지 → 근처 오면 숨김 (인물DB와 동일) */
        (function () {
          var tabs = document.querySelector('.pv-sidetabs');
          if (!tabs) return;
          function upd() {
            var stop = document.querySelector('.bigban') || document.querySelector('.triple') || document.querySelector('footer') || document.querySelector('#oc-footer');
            var hide;
            if (stop) hide = stop.getBoundingClientRect().top < tabs.getBoundingClientRect().bottom + 20;
            else hide = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 360);
            tabs.style.opacity = hide ? '0' : '1';
            tabs.style.visibility = hide ? 'hidden' : 'visible';
          }
          window.addEventListener('scroll', upd, { passive: true });
          window.addEventListener('resize', upd);
          upd();
        })();

        /* 조회수 +1 (best-effort) */
        if (cfg.incrementFn) {
          fetch(SB_URL + '/rest/v1/rpc/' + cfg.incrementFn, {
            method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, HDR),
            body: JSON.stringify({ p_id: isNaN(+id) ? id : +id })
          }).catch(function () {});
        }

        /* 관련기사 (검색어 우선 → 같은 분류 → 최근글) */
        if (cfg.viewPage) {
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
                relBox.innerHTML = '<span class="board-rel-label">관련기사</span><ul class="board-rel-list">'
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
                var c = window.supabase.createClient(SB_URL, SB_KEY);
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
    wrap.innerHTML =
      '<h2 class="bvc-h">댓글 <b class="bvc-count">0</b></h2>'
      + '<div class="bvc-form"><textarea class="bvc-input" rows="2" placeholder="댓글을 남기려면 로그인이 필요합니다." disabled></textarea>'
      + '<button type="button" class="bvc-submit" disabled>댓글등록</button></div>'
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
          if (off === 0 && !rows.length) listEl.innerHTML = '<li class="bvc-empty">첫 댓글을 남겨보세요.</li>';
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
          var c = window.supabase.createClient(SB_URL, SB_KEY);
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
        if (!client) client = window.supabase.createClient(SB_URL, SB_KEY);
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
        if (!id) { busy = false; if (confirm('로그인이 필요한 기능입니다. 로그인 페이지로 이동할까요?')) location.href = '/account/login.html'; return; }
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
