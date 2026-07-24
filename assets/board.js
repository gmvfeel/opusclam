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

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return esc(String(iso).slice(0, 10));
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }
  function nl2br(s) { return esc(s).replace(/\r\n|\r|\n/g, '<br>'); }
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
    var t = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
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
    function tagHtml(rec) { return rec.category ? '<span class="board-tag">' + esc(rec.category) + '</span>' : ''; }
    function featuredHtml(rec, related) {
      var rel = '';
      if (related && related.length) {
        rel = '<div class="board-feat-div"></div><div class="board-feat-rel"><span class="board-rel-label">관련기사</span><ul class="board-rel-list">'
          + related.map(function (r) { return '<li><a href="' + cfg.viewPage + '?id=' + encodeURIComponent(r.id) + '">- ' + esc(r.title || '') + '</a></li>'; }).join('')
          + '</ul></div>';
      }
      return '<div class="board-feat">'
        + '<span class="board-ribbon">HOT</span>'
        + '<a class="board-feat-body" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '">'
        + '<div class="board-feat-title">' + esc(rec.title || '') + ccHtml(rec) + '</div>'
        + '<p class="board-prev board-feat-prev">' + previewText(rec.body, 200) + '</p>'
        + '<div class="board-feat-meta">' + tagHtml(rec) + '<span>' + metaLine(rec) + '</span><span>' + fmtDate(rec.created_at) + '</span></div>'
        + '</a>' + rel
        + '</div>';
    }
    function articleRowHtml(rec, no) {
      return '<a class="board-row" href="' + cfg.viewPage + '?id=' + encodeURIComponent(rec.id) + '">'
        + '<span class="board-row-no">' + (no > 0 && no < 10 ? '0' + no : no) + '</span>'
        + '<span class="board-row-main"><span class="board-row-title">' + esc(rec.title || '') + ccHtml(rec) + '</span>'
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
        var body = o.body ? '<div class="bv-body">' + nl2br(o.body) + '</div>' : '';
        box.innerHTML =
          '<div class="bv-head">'
          + '<h1 class="bv-title">' + esc(o.title || '') + '</h1>'
          + '<div class="bv-meta">' + tag + (srcAu ? '<span>' + srcAu + '</span>' : '')
          + '<span>' + fmtDate(o.created_at) + '</span><span>\uc870\ud68c ' + (o.view_count || 0) + '</span></div>'
          + '</div>'
          + thumb + body + link
          + '<div class="bv-rel"></div>'
          + '<div class="bv-foot"><span class="bv-foot-left"></span>'
          + '<span class="bv-foot-right"><span class="bv-write"></span>'
          + '<a class="bv-list" href="' + cfg.listPage + '">목록</a></span></div>';

        /* 조회수 +1 (best-effort) */
        if (cfg.incrementFn) {
          fetch(SB_URL + '/rest/v1/rpc/' + cfg.incrementFn, {
            method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, HDR),
            body: JSON.stringify({ p_id: isNaN(+id) ? id : +id })
          }).catch(function () {});
        }

        /* 관련기사 (같은 분류 최근글) */
        if (o.category && cfg.viewPage) {
          fetch(SB_URL + '/rest/v1/' + cfg.table + '?select=id,title&category=eq.' + encodeURIComponent(o.category) + '&id=neq.' + encodeURIComponent(o.id) + '&order=created_at.desc&limit=4', { headers: HDR })
            .then(function (r) { return r.json(); })
            .then(function (rel) {
              if (!Array.isArray(rel) || !rel.length) return;
              var relBox = box.querySelector('.bv-rel'); if (!relBox) return;
              relBox.innerHTML = '<span class="board-rel-label">관련기사</span><ul class="board-rel-list">'
                + rel.map(function (r) { return '<li><a href="' + cfg.viewPage + '?id=' + encodeURIComponent(r.id) + '">- ' + esc(r.title || '') + '</a></li>'; }).join('')
                + '</ul>';
              relBox.classList.add('is-on');
            }).catch(function () {});
        }

        /* 글쓰기(로그인 회원) */
        if (cfg.writePage) {
          var wGate = cfg.writeRole === 'member' ? checkMember : checkAdmin;
          wGate().then(function (m) {
            if (!m) return;
            var w = box.querySelector('.bv-write');
            if (w) w.innerHTML = '<a class="bv-write-btn" href="' + cfg.writePage + '">글쓰기</a>';
          });
        }

        /* 수정·삭제 (작성자 본인 또는 관리자) */
        if (cfg.writePage) {
          checkMember().then(function (m) {
            var mine = m && (m.is_admin || m.id === o.author_id || m.user_id === o.author_id || m.uid === o.author_id);
            if (!mine) return;
            var l = box.querySelector('.bv-foot-left'); if (!l) return;
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

  return { list: list, view: view, esc: esc, fmtDate: fmtDate };
})();
