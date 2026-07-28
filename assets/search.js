/* ============================================================
   OPUSCLAM 통합검색 엔진 — assets/search.js
   ------------------------------------------------------------
   DB 7종 + 게시판 5종을 한 번에 찾는다.
   섹션이 늘어나면 아래 SECTIONS 배열에 한 줄 추가하면 끝.
   (페이지별 복붙 없음 · 검색 화면은 search.html 하나만 유지)

   OCSearch.render('검색어')  → 결과를 .osr-groups 안에 그려준다
   OCSearch.go('검색어')      → /search.html?q=... 로 이동

   ※ 어떤 섹션이 실패해도(컬럼명이 다르거나 표가 없어도) 그 섹션만
     건너뛰고 나머지는 정상 표시한다. 실패 내역은 콘솔에 남는다.
   ============================================================ */
window.OCSearch = (function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  var PREVIEW = 5;      // 그룹마다 보여줄 개수

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clean(q) {
    return String(q || '').trim().replace(/[(),*]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* 검색어를 굵게 표시 — 이미 esc 를 거친 뒤 감싸므로 안전하다 */
  function hl(s, q) {
    var e = esc(s);
    if (!q) return e;
    var eq = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return e.replace(new RegExp(eq, 'gi'), function (m) { return '<mark>' + m + '</mark>'; }); }
    catch (err) { return e; }
  }
  function join(parts) {
    return parts.filter(function (x) { return x != null && String(x).trim() !== ''; }).join(' · ');
  }
  function ymd(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  }
  function cut(s, n) {
    s = String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ── 검색할 곳 ──
     table   : Supabase 표 이름
     cols    : 검색어를 찾을 컬럼 (ilike)
     sel     : 결과 표시에 필요한 컬럼
     list    : 전체 보기로 갈 리스트 페이지
     view    : 항목을 눌렀을 때 갈 상세 페이지 (없으면 리스트로 이동)
     hidden  : true 면 숨긴 항목을 제외
     line    : 한 줄로 어떻게 보여줄지 */
  var SECTIONS = [
    { key: 'persons', label: '인물', table: 'persons',
      /* 소개문도 검색합니다. 한국어 위키백과에 항목이 없는 인물은
         영문 소개문(description_en)만 있으므로 둘 다 봅니다 */
      cols: ['name_ko', 'name_en', 'school', 'description', 'description_en'], hidden: true,
      sel: 'id,name_ko,name_en,field,life,school,image_url,description,description_en',
      list: '/db/person.html', view: '/db/person-view.html',
      line: function (r) {
        var d = (r.description || r.description_en || '').trim();
        if (/^[|{]/.test(d)) d = '';   /* 위키 틀 코드가 들어온 경우는 쓰지 않습니다 */
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.field, r.life, r.school]), img: r.image_url,
                 d: d ? cut(d, 70) : '' };
      } },

    { key: 'orgs', label: '음악단체', table: 'orgs',
      cols: ['name_ko', 'name_en'], hidden: true,
      sel: 'id,name_ko,name_en,type,location,logo_url',
      list: '/db/org.html', view: '/db/org-view.html',
      line: function (r) {
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.type, r.location]), img: r.logo_url };
      } },

    { key: 'venues', label: '공연장', table: 'venues',
      cols: ['name_ko', 'name_en'], hidden: true,
      sel: 'id,name_ko,name_en,type,location,seats,logo_url',
      list: '/db/venue.html', view: '/db/venue-view.html',
      line: function (r) {
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.type, r.location, r.seats ? r.seats + '석' : '']), img: r.logo_url };
      } },

    { key: 'schools', label: '음악학교', table: 'schools',
      cols: ['name_ko', 'name_en'], hidden: true,
      sel: 'id,name_ko,name_en,category,location,logo_url',
      list: '/db/school.html', view: '/db/school-view.html',
      line: function (r) {
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.category, r.location]), img: r.logo_url };
      } },

    { key: 'modern', label: '현대음악', table: 'modern_composers',
      cols: ['name_ko', 'name_en'], hidden: true,
      sel: 'id,name_ko,name_en,school_style,nationality,life,image_url',
      list: '/db/modern.html', view: '/db/modern-view.html',
      line: function (r) {
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.school_style, r.nationality, r.life]), img: r.image_url };
      } },

    { key: 'foundations', label: '기관 · 재단', table: 'foundations',
      cols: ['name_ko', 'name_en', 'location', 'business', 'field', 'subsidiary'], hidden: true,
      sel: 'id,name_ko,name_en,type,location,founded,business,logo_url',
      list: '/db/foundation.html', view: '/db/foundation-view.html',
      line: function (r) {
        var d = (r.business || '').trim();
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.type, r.location, r.founded]), img: r.logo_url,
                 d: d ? cut(d, 70) : '' };
      } },

    { key: 'academic', label: '학술', table: 'academic',
      /* 초록까지 검색합니다. 논문은 제목만으로 찾기 어렵습니다 */
      cols: ['name_ko', 'name_en', 'author', 'keywords', 'publisher', 'description'], hidden: true,
      sel: 'id,name_ko,name_en,author,pub_year,publisher,field,type,description',
      list: '/db/academic.html', view: '/db/academic-view.html',
      line: function (r) {
        var d = (r.description || '').trim();
        return { t: r.name_ko || r.name_en, en: (r.name_ko && r.name_en) ? r.name_en : '',
                 s: join([r.type, r.author, r.pub_year, r.publisher, r.field]),
                 d: d ? cut(d, 70) : '' };
      } },

    { key: 'hottopic', label: '핫토픽', table: 'hottopic',
      cols: ['title', 'body'],
      sel: 'id,title,body,category,author_name,created_at',
      list: '/community/hottopic.html', view: '/community/hottopic-view.html',
      line: function (r) {
        return { t: r.title, s: join([r.category, r.author_name, ymd(r.created_at)]), d: cut(r.body, 70) };
      } },

    { key: 'gallery', label: '공연사진 · 영상', table: 'gallery',
      cols: ['title', 'body'],
      sel: 'id,title,body,category,author_name,created_at',
      list: '/community/gallery.html', view: '/community/gallery-view.html',
      line: function (r) {
        return { t: r.title, s: join([r.category, r.author_name, ymd(r.created_at)]), d: cut(r.body, 70) };
      } },

    { key: 'admission', label: '입시요강', table: 'admission',
      cols: ['title', 'body', 'keywords'],
      sel: 'id,title,body,category,region,school_name,created_at',
      list: '/community/admission.html', view: '/community/admission-view.html',
      line: function (r) {
        return { t: r.title, s: join([r.region, r.category, r.school_name]), d: cut(r.body, 70) };
      } },

    { key: 'admission_community', label: '입시커뮤니티', table: 'admission_community',
      cols: ['title', 'body'],
      sel: 'id,title,body,category,author_name,created_at',
      list: '/community/admission-community.html', view: '/community/admission-community-view.html',
      line: function (r) {
        return { t: r.title, s: join([r.category, r.author_name, ymd(r.created_at)]), d: cut(r.body, 70) };
      } },

    { key: 'qna', label: '지식나눔', table: 'qna',
      cols: ['title', 'body', 'keywords'],
      sel: 'id,title,body,category,track,author_name,created_at',
      list: '/community/qna.html', view: '/community/qna-view.html',
      line: function (r) {
        var tk = (r.track === '전공별') ? '전공별 정보나눔' : '음악지식 Q&A';
        return { t: r.title, s: join([tk, r.category, r.author_name, ymd(r.created_at)]), d: cut(r.body, 70) };
      } },

    { key: 'news', label: '뉴스 · 공지', table: 'news',
      cols: ['title', 'body'],
      sel: 'id,title,body,category,created_at',
      list: '/community/news.html', view: '/community/news-view.html',
      line: function (r) {
        return { t: r.title, s: join([r.category, ymd(r.created_at)]), d: cut(r.body, 70) };
      } },
  ];

  /* 한 섹션 조회 — 실패하면 null 을 돌려주고 전체는 계속 진행 */
  function ask(sec, q) {
    var t = encodeURIComponent(q);
    var or = sec.cols.map(function (c) { return c + '.ilike.*' + t + '*'; }).join(',');
    var url = SB_URL + '/rest/v1/' + sec.table + '?select=' + sec.sel
            + '&or=(' + or + ')'
            + (sec.hidden ? '&hidden=is.false' : '')
            + '&limit=' + PREVIEW;
    return fetch(url, { headers: Object.assign({ Prefer: 'count=exact' }, HDR) })
      .then(function (r) {
        var total = 0;
        var cr = r.headers.get('content-range');
        if (cr) { var p = cr.split('/')[1]; if (p && p !== '*') total = parseInt(p, 10) || 0; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(function (rows) { return { sec: sec, rows: rows || [], total: total }; });
      })
      .catch(function (e) {
        console.warn('[통합검색] ' + sec.label + '(' + sec.table + ') 건너뜀:', e.message);
        return null;
      });
  }

  function itemHtml(sec, r, q) {
    var v = sec.line(r) || {};
    var href = (sec.view ? sec.view + '?id=' + encodeURIComponent(r.id)
                         : sec.list + '?focus=' + encodeURIComponent(r.id));
    var thumb = v.img
      ? '<span class="osr-thumb"><img src="' + esc(thumbUrl(v.img, 128)) + '" alt="" loading="lazy"></span>'
      : '<span class="osr-thumb osr-thumb-ph">' + esc((v.t || '?').trim().charAt(0)) + '</span>';
    return '<a class="osr-item" href="' + esc(href) + '">'
      + thumb
      + '<span class="osr-body">'
      +   '<span class="osr-t">' + hl(v.t || '(제목 없음)', q)
      +     (v.en ? ' <em>' + hl(v.en, q) + '</em>' : '') + '</span>'
      +   (v.s ? '<span class="osr-s">' + hl(v.s, q) + '</span>' : '')
      +   (v.d ? '<span class="osr-d">' + hl(v.d, q) + '</span>' : '')
      + '</span>'
      + '<span class="osr-go" aria-hidden="true">→</span>'
      + '</a>';
  }

  /* 위키미디어 원본 주소를 작은 이미지로 (db-list.js 와 같은 방식) */
  function thumbUrl(u, w) {
    if (!u) return u;
    u = String(u).replace(/^http:\/\//, 'https://');
    if (u.indexOf('Special:FilePath') >= 0) return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w;
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

  function groupHtml(res, q) {
    var sec = res.sec;
    var more = res.total > res.rows.length
      ? '<a class="osr-more" href="' + esc(sec.list + '?q=' + encodeURIComponent(q)) + '">'
        + '전체 ' + res.total.toLocaleString() + '건 <span>&rsaquo;</span></a>'
      : '';
    return '<section class="osr-group" data-k="' + esc(sec.key) + '">'
      + '<h2 class="osr-h"><span class="osr-label">' + esc(sec.label) + '</span>'
      +   '<b>' + res.total.toLocaleString() + '</b>' + more + '</h2>'
      + '<div class="osr-items">'
      +   res.rows.map(function (r) { return itemHtml(sec, r, q); }).join('')
      + '</div></section>';
  }

  /* 영역 탭 — 결과가 여러 영역에 걸쳐 있을 때 골라 볼 수 있게 */
  function tabsHtml(ok) {
    if (ok.length < 2) return '';
    var t = '<div class="osr-tabs"><button type="button" class="osr-tab on" data-k="">전체</button>';
    ok.forEach(function (r) {
      t += '<button type="button" class="osr-tab" data-k="' + esc(r.sec.key) + '">'
        + esc(r.sec.label) + '<b>' + r.total.toLocaleString() + '</b></button>';
    });
    return t + '</div>';
  }
  function bindTabs() {
    var box = document.querySelector('.osr-tabs');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.osr-tab');
      if (!b) return;
      var k = b.getAttribute('data-k') || '';
      box.querySelectorAll('.osr-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.osr-group').forEach(function (g) {
        g.style.display = (!k || g.getAttribute('data-k') === k) ? '' : 'none';
      });
      var top = document.querySelector('.osr-results');
      if (top && window.scrollTo) window.scrollTo({ top: top.offsetTop - 80, behavior: 'smooth' });
    });
  }

  function skeleton() {
    var one = '<section class="osr-group"><h2 class="osr-h"><span class="osr-skel w6"></span></h2>'
      + '<div class="osr-items">'
      + '<a class="osr-item"><span class="osr-body"><span class="osr-skel w5"></span><span class="osr-skel w3"></span></span></a>'
      + '<a class="osr-item"><span class="osr-body"><span class="osr-skel w4"></span><span class="osr-skel w3"></span></span></a>'
      + '</div></section>';
    return one + one + one;
  }

  /* 결과 그리기 */
  function render(qRaw) {
    var box = document.querySelector('.osr-groups');
    var sum = document.querySelector('.osr-summary');
    var q = clean(qRaw);
    if (!box) return;
    if (!q) {
      box.innerHTML = '<p class="osr-empty">검색어를 입력해 주세요.</p>';
      if (sum) sum.textContent = '';
      return;
    }
    box.innerHTML = skeleton();
    if (sum) sum.innerHTML = '<b>' + esc(q) + '</b> 검색 중…';

    Promise.all(SECTIONS.map(function (s) { return ask(s, q); })).then(function (list) {
      var ok = list.filter(function (x) { return x && x.total > 0; });
      var total = ok.reduce(function (a, b) { return a + b.total; }, 0);
      ok.sort(function (a, b) { return b.total - a.total; });   // 많이 나온 곳부터
      if (sum) {
        sum.innerHTML = '<b>' + esc(q) + '</b> 검색 결과 '
          + '<strong>' + total.toLocaleString() + '</strong>건'
          + (ok.length ? ' · ' + ok.length + '개 영역' : '');
      }
      if (!ok.length) {
        box.innerHTML = '<p class="osr-empty">'
          + '<b>' + esc(q) + '</b> 에 대한 결과가 없습니다.<br>'
          + '<span>다른 낱말로 찾아보시거나, 이름의 일부만 넣어보세요.</span></p>';
        return;
      }
      box.innerHTML = tabsHtml(ok) + ok.map(function (r) { return groupHtml(r, q); }).join('');
      bindTabs();
    });
  }

  function go(qRaw) {
    var q = clean(qRaw);
    if (!q) return;
    location.href = '/search.html?q=' + encodeURIComponent(q);
  }

  /* search.html 에서 자동 시작 */
  function boot() {
    var q = new URLSearchParams(location.search).get('q') || '';
    var inp = document.querySelector('.osr-form input');
    if (inp) inp.value = q;
    render(q);
    var form = document.querySelector('.osr-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = clean(inp ? inp.value : '');
        if (!v) return;
        history.replaceState(null, '', '/search.html?q=' + encodeURIComponent(v));
        render(v);
      });
    }
  }

  return { render: render, go: go, boot: boot, sections: SECTIONS };
})();
