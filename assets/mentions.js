/* ============================================================
   OPUSCLAM 언급 잇기 — assets/mentions.js
   entity_mentions 표를 읽어 두 방향을 그립니다.

     커뮤니티·정보SPOT 상세  →  「이 글에 나온 것」
     DATABASE 상세          →  「여기가 나온 글」

   ★ 표 하나로 양쪽이 됩니다. 글 쪽으로 찾으면 앞의 것,
     항목 쪽으로 찾으면 뒤의 것입니다.

   ★ 화면에서 이름을 찾지 않습니다. 밤에 도는 훑개
     (scripts/scan-mentions.mjs) 가 미리 적어 둔 것을 읽기만 합니다.
     그래서 상세 화면이 느려지지 않습니다.
   ============================================================ */
(function () {
  'use strict';

  if (window.OCMentions) return;

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H   = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  /* 확신도가 이보다 낮으면 그리지 않습니다.
     ★ 성을 여럿이 쓰는 경우(45)는 누구인지 모르므로 가립니다.
       자료는 남겨 둡니다 — 나중에 사람이 골라 줄 수 있습니다. */
  var MIN_CONF = 70;
  var CAP = 12;                 // 한 묶음에 보일 최대

  /* ── 갈래 짝짓기 ─────────────────────────────────────────────
     ★ account/mypage.html 의 FAV_META 와 <b>같은 모양</b>입니다.
       두 곳이 어긋나면 같은 글이 화면마다 다른 이름으로 불립니다. */
  var SRC_META = {
    hottopic:              { table:'hottopic',            col:'title', path:'/community/hottopic-view.html',            label:'핫토픽' },
    news:                  { table:'news',                col:'title', path:'/community/news-view.html',                label:'뉴스·공지' },
    qna:                   { table:'qna',                 col:'title', path:'/community/qna-view.html',                 label:'지식나눔' },
    gallery:               { table:'gallery',             col:'title', path:'/community/gallery-view.html',             label:'공연사진·영상' },
    modern_music:          { table:'modern_music',        col:'title', path:'/community/modern-view.html',              label:'현대음악' },
    prenatal_music:        { table:'prenatal_music',      col:'title', path:'/community/prenatal-view.html',            label:'태교음악' },
    utility:               { table:'utility',             col:'title', path:'/community/utility-view.html',             label:'유틸리티' },
    admission:             { table:'admission',           col:'title', path:'/community/admission-view.html',           label:'입시요강' },
    admission_community:   { table:'admission_community', col:'title', path:'/community/admission-community-view.html', label:'입시커뮤니티' },
    opusnity:              { table:'opusnity',            col:'title', path:'/community/opusnity-view.html',            label:'오퍼니티' },
    spot:                  { table:'spot',                col:'title', path:'/spot/spot-view.html',                     label:'정보SPOT' }
  };

  var TO_META = {
    person:     { table:'persons',          col:'name_ko', path:'/db/person-view.html',     label:'인물' },
    org:        { table:'orgs',             col:'name_ko', path:'/db/org-view.html',        label:'음악단체' },
    venue:      { table:'venues',           col:'name_ko', path:'/db/venue-view.html',      label:'공연장' },
    school:     { table:'schools',          col:'name_ko', path:'/db/school-view.html',     label:'음악학교' },
    modern:     { table:'modern_composers', col:'name_ko', path:'/db/modern-view.html',     label:'현대음악' },
    foundation: { table:'foundations',      col:'name_ko', path:'/db/foundation-view.html', label:'기관·재단' },
    academic:   { table:'academic',         col:'name_ko', path:'/db/academic-view.html',   label:'학술' },
    /* ★ 2026-08-19 · 작품은 <b>한글 제목</b>을 보여 줍니다.
       훑개가 한글 제목이 있는 작품만 잇기 때문에, 여기서 영문 title 을
       읽으면 「Winterreise」처럼 <b>글에 적힌 말과 다른 이름</b>이 뜹니다. */
    work:       { table:'person_works',     col:'title_ko',path:'/db/work-view.html',       label:'작품' }
  };

  /* 커뮤니티 화면 이름 → 표 이름.
     ★ /db/modern-view 와 /community/modern-view 는 파일 이름이 같습니다.
       그래서 폴더까지 봐야 갈래가 갈립니다. */
  var SRC_OF_FILE = {
    '/community/modern':   'modern_music',
    '/community/prenatal': 'prenatal_music',
    '/spot/spot':          'spot'
  };

  /* ── 도우미 ───────────────────────────────────────────────── */
  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function rest(q) {
    return fetch(SB + '/rest/v1/' + q, { headers: H })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }
  /* 언어 앞머리(/en · /ja)와 `.html` 을 떼어 낸 주소.
     ★ 정규식을 쓰지 않습니다 — 글자 자리만 봅니다. */
  function bareOf(p) {
    var s = (window.ocPath || String)(p);
    if (s.length > 5 && s.slice(-5) === '.html') s = s.slice(0, -5);
    return s;
  }
  /* ★ 주소는 그대로 둡니다 — i18n.js 가 화면 안의 링크를 훑어
       언어 앞머리를 붙여 줍니다(assets/links.js 도 같은 방식입니다).
       여기서 미리 붙이면 두 번 붙어 `/en/en/…` 이 됩니다. */
  function href(path, id) {
    return path + '?id=' + encodeURIComponent(id);
  }

  /* ── 그리기 ───────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ocm-css')) return;
    var css = ''
      + '.ocm-sec{margin-top:40px}'
      + '.ocm-t{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:13px;'
      +   'font-weight:700;color:var(--text-2,#3a3c52);letter-spacing:.02em}'
      + '.ocm-t em{font-style:normal;font-size:11px;font-weight:600;color:var(--text-3,#8a8c9e);'
      +   'background:var(--paper-2,#f2f2f7);border-radius:99px;padding:2px 8px}'
      + '.ocm-list{display:flex;flex-wrap:wrap;gap:8px}'
      + '.ocm-item{display:inline-flex;align-items:center;gap:6px;max-width:100%;'
      +   'padding:7px 12px;border:1px solid var(--line,#e4e4ee);border-radius:99px;'
      +   'background:var(--paper,#fff);color:var(--text-1,#22243a);'
      +   'font-size:12.5px;line-height:1.2;text-decoration:none}'
      + '.ocm-item:hover{border-color:var(--brand,#5b5bd6);color:var(--brand,#5b5bd6)}'
      + '.ocm-item b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.ocm-item i{font-style:normal;font-size:11px;color:var(--text-3,#8a8c9e)}'
      /* 글 목록 쪽은 제목이 길어 알약이 아니라 줄로 둡니다 */
      + '.ocm-rows{display:flex;flex-direction:column;gap:2px}'
      + '.ocm-row{display:flex;align-items:center;gap:8px;padding:9px 2px;'
      +   'border-bottom:1px solid var(--line-2,#f0f0f6);color:var(--text-1,#22243a);'
      +   'font-size:13px;text-decoration:none}'
      + '.ocm-row:hover{color:var(--brand,#5b5bd6)}'
      + '.ocm-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.ocm-row em{flex:0 0 auto;font-style:normal;font-size:11px;color:var(--text-3,#8a8c9e);'
      +   'background:var(--paper-2,#f2f2f7);border-radius:99px;padding:2px 8px}';
    var st = document.createElement('style');
    st.id = 'ocm-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function title(text, n) {
    return '<h3 class="ocm-t">' + esc(text) + '<em>' + n + '</em></h3>';
  }

  /* ── ① 글 상세 → 「이 글에 나온 것」 ───────────────────────── */
  function forDoc(src, id) {
    return rest('entity_mentions?select=to_type,to_id,surface,confidence'
        + '&src_type=eq.' + encodeURIComponent(src)
        + '&src_id=eq.' + encodeURIComponent(id)
        + '&confidence=gte.' + MIN_CONF
        + '&order=confidence.desc&limit=' + (CAP * 2))
      .then(function (rows) {
        if (!rows || !rows.length) return '';

        /* 갈래마다 한 번씩만 이름을 받아옵니다 */
        var need = {};
        rows.forEach(function (r) {
          if (!TO_META[r.to_type]) return;
          (need[r.to_type] = need[r.to_type] || []).push(r.to_id);
        });
        var kinds = Object.keys(need);
        if (!kinds.length) return '';

        return Promise.all(kinds.map(function (k) {
          var m = TO_META[k];
          return rest(m.table + '?select=id,' + m.col
              + '&id=in.(' + need[k].join(',') + ')&limit=' + need[k].length)
            .then(function (rs) { return { k: k, rows: rs || [] }; });
        })).then(function (out) {
          var name = {};
          out.forEach(function (o) {
            name[o.k] = {};
            o.rows.forEach(function (x) { name[o.k][String(x.id)] = x[TO_META[o.k].col]; });
          });

          var html = '', n = 0;
          rows.forEach(function (r) {
            if (n >= CAP) return;
            var m = TO_META[r.to_type];
            if (!m) return;
            var nm = name[r.to_type] && name[r.to_type][String(r.to_id)];
            if (!nm) return;                     // 숨겨졌거나 지워진 항목
            n++;
            html += '<a class="ocm-item" href="' + esc(href(m.path, r.to_id)) + '">'
                 +    '<b>' + esc(nm) + '</b><i>' + esc(m.label) + '</i></a>';
          });
          if (!n) return '';
          return title('이 글에 나온 것', n)
               + '<div class="ocm-list">' + html + '</div>';
        });
      });
  }

  /* ── ② DB 상세 → 「여기가 나온 글」 ────────────────────────── */
  function forEntity(toType, id) {
    return rest('entity_mentions?select=src_type,src_id,confidence'
        + '&to_type=eq.' + encodeURIComponent(toType)
        + '&to_id=eq.' + encodeURIComponent(id)
        + '&confidence=gte.' + MIN_CONF
        + '&order=confidence.desc&limit=' + (CAP * 3))
      .then(function (rows) {
        if (!rows || !rows.length) return '';

        var need = {};
        rows.forEach(function (r) {
          if (!SRC_META[r.src_type]) return;
          (need[r.src_type] = need[r.src_type] || []).push(r.src_id);
        });
        var kinds = Object.keys(need);
        if (!kinds.length) return '';

        return Promise.all(kinds.map(function (k) {
          var m = SRC_META[k];
          return rest(m.table + '?select=id,' + m.col
              + '&id=in.(' + need[k].join(',') + ')&limit=' + need[k].length)
            .then(function (rs) { return { k: k, rows: rs || [] }; });
        })).then(function (out) {
          var name = {};
          out.forEach(function (o) {
            name[o.k] = {};
            o.rows.forEach(function (x) { name[o.k][String(x.id)] = x[SRC_META[o.k].col]; });
          });

          var html = '', n = 0;
          rows.forEach(function (r) {
            if (n >= CAP) return;
            var m = SRC_META[r.src_type];
            if (!m) return;
            var t = name[r.src_type] && name[r.src_type][String(r.src_id)];
            if (!t) return;
            n++;
            html += '<a class="ocm-row" href="' + esc(href(m.path, r.src_id)) + '">'
                 +    '<em>' + esc(m.label) + '</em><span>' + esc(t) + '</span></a>';
          });
          if (!n) return '';
          return title('여기가 나온 글', n)
               + '<div class="ocm-rows">' + html + '</div>';
        });
      });
  }

  /* ── 붙이기 ───────────────────────────────────────────────────
     ★★ 2026-08-19 · <b>왜 아무것도 안 보였나</b> (파트너 지적)
     ─────────────────────────────────────────────────────────────
       커뮤니티·정보SPOT 상세 화면의 본문은 <b>비어 있는 채로</b> 옵니다 —
           &lt;article class="board-view pv"&gt;
             &lt;div class="board-empty"&gt;불러오는 중…&lt;/div&gt;
           &lt;/article&gt;
       그리고 assets/board.js 가 자료를 받아 온 뒤
           box.innerHTML = …
       로 <b>통째로 갈아 끼웁니다.</b>

       우리는 화면이 다 뜨자마자(DOMContentLoaded) 자리를 붙였습니다.
       그래서 board.js 가 나중에 <b>우리 자리를 지워 버렸습니다.</b>
       오류도 안 나고, 조회도 잘 됐고, 자리만 사라졌습니다.

     ★ 어떻게 고쳤나 — <b>지워지면 다시 붙입니다.</b>
       본문이 언제 그려질지 화면마다 다릅니다. 시간을 재서 기다리면
       느린 날에는 또 어긋납니다. 그러니 기다리지 말고
       <b>바뀔 때마다 있는지 보고 없으면 다시</b> 붙입니다.
     ★ 이미 있으면 아무것도 하지 않으므로 끝없이 되풀이되지 않습니다.
     ★ 20초 뒤에는 그만 봅니다 — 그때까지 안 그려졌으면 다른 문제입니다. */
  function mountInto(html) {
    var art = document.querySelector('article.pv');
    if (!art || !html) return;
    if (art.querySelector('.ocm-sec')) return;      /* 이미 있습니다 */

    var sec = document.createElement('section');
    sec.className = 'pv-sec ocm-sec';
    sec.innerHTML = html;

    /* 붙는 자리 — 관계 목록(ocl-sec) 이 있으면 그 앞, 없으면 맨 뒤 */
    var links = art.querySelector('.ocl-sec');
    var contrib = art.querySelector('.pv-contrib');
    if (links) art.insertBefore(sec, links);
    else if (contrib) art.insertBefore(sec, contrib);
    else art.appendChild(sec);
  }

  function keepMounted(html) {
    if (!html) return;
    injectCSS();
    mountInto(html);

    var host = document.querySelector('main') || document.body;
    if (!host || !window.MutationObserver) return;

    var waiting = false;
    var obs = new MutationObserver(function () {
      if (waiting) return;                          /* 몰아서 한 번만 봅니다 */
      waiting = true;
      setTimeout(function () { waiting = false; mountInto(html); }, 80);
    });
    obs.observe(host, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 20000);
  }

  /* ── 시작 ─────────────────────────────────────────────────── */
  function boot() {
    var path = bareOf(location.pathname);
    var file = path.split('/').pop();
    if (file.length <= 5 || file.slice(-5) !== '-view') return;

    var id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) return;

    /* 어느 쪽 화면인가 */
    var isDb = path.indexOf('/db/') === 0;
    var kind, mode;
    if (isDb) {
      kind = file.slice(0, -5);
      if (!TO_META[kind]) return;
      mode = 'entity';
    } else {
      kind = SRC_OF_FILE[path.slice(0, -5)] || file.slice(0, -5);
      if (!SRC_META[kind]) return;
      mode = 'doc';
    }

    /* ★ 자료를 먼저 받아 두고, 붙이는 것은 그다음입니다.
       화면이 아직 안 그려졌어도 조회는 시작할 수 있습니다. */
    var job = (mode === 'entity') ? forEntity(kind, id) : forDoc(kind, id);
    job.then(keepMounted).catch(function () {});
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  window.OCMentions = { boot: boot, SRC_META: SRC_META, TO_META: TO_META };
})();
