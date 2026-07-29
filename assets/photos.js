/* ============================================================
   OPUSCLAM 상세 페이지 사진 — assets/photos.js

   무엇을 하나
    · entity_photos 에 모아둔 사진을 상세 페이지에 넣습니다
      ① 상단 대표 사진 (.pv-portrait)
      ② 사진 갤러리 (제목에 「사진」이 들어간 섹션의 .pv-track)
    · 기존 이미지(image_url · logo_url)가 있으면 그것을 그대로 둡니다
      → 정제된 데이터가 항상 우선됩니다

   쓰는 법 — 각 상세 페이지에서 자료를 불러온 뒤 한 줄 부르면 됩니다
     <script src="/assets/photos.js" defer></script>

     OCPhotos.mount({
       type: 'venue',          // person / school / venue / org / foundation
       id: REC.id,
       existing: REC.logo_url, // 기존 이미지 (있으면 대표 사진을 바꾸지 않음)
       name: REC.name_ko
     });

   · 사진이 없으면 아무것도 하지 않습니다 (빈 자리가 그대로 남습니다)
   · 조회에 실패해도 화면은 그대로입니다
   ============================================================ */

(function () {
  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 화면에 쓸 이미지 주소를 고릅니다.

     수집할 때 커먼즈가 알려준 축소 주소(thumb, 대개 1280px)를 저장해 두었습니다.
     그 주소는 확실히 열립니다 — 목록 페이지에서 이미 그대로 쓰고 있습니다.
     그래서 여기서도 저장된 주소를 그대로 씁니다. 폭을 바꾸려고 주소를 손대면
     드물게 열리지 않는 경우가 생깁니다.

     저장된 축소 주소가 없을 때만 원본에서 축소 주소를 만듭니다. */
  function pick(row) {
    var u = String((row && (row.thumb || row.src)) || '').replace(/^http:\/\//, 'https://');
    if (!u) return '';
    if (u.indexOf('/thumb/') >= 0) return u;           /* 이미 축소 주소 — 그대로 */
    if (u.indexOf('Special:FilePath') >= 0) {
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=800';
    }
    if (u.indexOf('upload.wikimedia.org') < 0) return u;
    /* 원본 주소에서 축소 주소를 만든다 */
    var i = u.indexOf('/wikipedia/');
    if (i < 0) return u;
    var parts = u.slice(i + 11).split('/');
    if (parts.length < 4) return u;
    var proj = parts[0], a = parts[1], b = parts[2], fn = parts.slice(3).join('/');
    if (a.length !== 1 || b.length !== 2) return u;
    var t = u.slice(0, i + 11) + proj + '/thumb/' + a + '/' + b + '/' + fn + '/800px-' + fn;
    if (fn.toLowerCase().slice(-4) === '.svg') t += '.png';
    return t;
  }

  /* 제목에 「사진」이 들어간 섹션을 찾습니다 */
  function findPhotoSection() {
    var found = null;
    document.querySelectorAll('.pv-sec').forEach(function (s) {
      if (found) return;
      var h = s.querySelector('.pv-h');
      if (h && h.textContent.indexOf('사진') >= 0) found = s;
    });
    return found;
  }

  /* 대표 사진 넣기 */
  function setPortrait(row, name) {
    var box = document.querySelector('.pv-portrait');
    if (!box || !row) return;
    box.innerHTML = '';
    box.style.overflow = 'hidden';
    var im = document.createElement('img');
    var big = row.src || row.thumb || '';
    im.src = pick(row);
    im.alt = name || '';
    im.loading = 'lazy';
    im.style.cssText = 'width:100%;height:100%;object-fit:cover';
    /* 축소 주소가 열리지 않으면 원본으로 한 번 되돌립니다 */
    im.onerror = function () {
      if (this.dataset.fallback) return;
      this.dataset.fallback = '1';
      if (big && big !== this.src) this.src = big;
    };
    box.appendChild(im);
  }

  /* 갤러리 채우기 */
  function setGallery(rows, name) {
    var sec = findPhotoSection();
    if (!sec) return;
    var track = sec.querySelector('.pv-track');
    if (!track || !rows.length) return;

    track.innerHTML = rows.map(function (r) {
      var href = r.page_url || '#';
      var t = esc(r.caption || r.file_name || '');
      var small = pick(r);
      var big = r.src || r.thumb || '';
      /* 축소 주소가 열리지 않으면 원본으로 한 번 되돌립니다 */
      var onerr = 'if(!this.dataset.fb){this.dataset.fb=1;this.src=this.dataset.big;}';
      return '<a class="pv-tile" href="' + esc(href) + '" target="_blank" rel="noopener"'
        + ' title="' + t + '" style="padding:0;overflow:hidden">'
        + '<img src="' + esc(small) + '" data-big="' + esc(big) + '"'
        + ' onerror="' + onerr + '" alt="" loading="lazy"'
        + ' style="width:100%;height:100%;object-fit:cover"></a>';
    }).join('');

    sec.style.display = '';

    /* 출처 표기 — 라이선스와 저작자를 함께 적습니다 */
    if (!sec.querySelector('.pv-imgsrc')) {
      var lic = [];
      rows.forEach(function (r) {
        if (r.license && lic.indexOf(r.license) < 0) lic.push(r.license);
      });
      var p = document.createElement('p');
      p.className = 'pv-imgsrc';
      p.style.cssText = 'margin-top:10px;font-size:.78em;color:var(--text-3);line-height:1.6';
      p.innerHTML = '사진 출처 · <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener"'
        + ' style="color:inherit;text-decoration:underline">위키미디어 커먼즈</a>'
        + (lic.length ? ' · ' + esc(lic.slice(0, 3).join(', ')) : '')
        + ' — 각 사진을 누르면 원본 페이지에서 저작자와 이용 조건을 보실 수 있습니다.';
      sec.appendChild(p);
    }
  }

  window.OCPhotos = {
    mount: function (opt) {
      opt = opt || {};
      if (!opt.type || !opt.id) return;

      var url = SB_URL + '/rest/v1/entity_photos'
        + '?select=src,thumb,file_name,page_url,license,author,caption,kind,sort_no,is_primary'
        + '&entity_type=eq.' + encodeURIComponent(opt.type)
        + '&entity_id=eq.' + encodeURIComponent(opt.id)
        + '&hidden=eq.false'
        + '&order=is_primary.desc,sort_no.asc,id.asc'
        + '&limit=12';

      fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          if (!Array.isArray(rows) || !rows.length) return;

          /* 대표 사진 — 기존 이미지가 없을 때만 넣습니다 */
          if (!String(opt.existing || '').trim()) {
            /* 로고보다 사진을 먼저 씁니다 */
            var main = rows.filter(function (r) { return r.kind !== 'logo'; })[0] || rows[0];
            setPortrait(main, opt.name);
          }

          /* 갤러리 — 로고는 제외하고 사진만 */
          var photos = rows.filter(function (r) { return r.kind !== 'logo'; });
          if (photos.length) setGallery(photos, opt.name);
        })
        .catch(function () { /* 실패해도 화면은 그대로 둡니다 */ });
    },
  };
})();
