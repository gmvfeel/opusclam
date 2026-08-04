/* ============================================================
   OPUSCLAM  목록 그림 가볍게 하기        assets/thumb.js

   ★ 왜 필요한가
     음악단체DB·공연장DB 목록을 굴리면 <b>버벅거립니다.</b>
     인물DB 는 매끄러운데 그 둘만 그렇습니다. 까닭이 셋이었습니다 —

       하나. <b>큰 그림을 그대로 받습니다.</b>
             위키미디어 원본은 한 장에 수 MB 인 것이 많습니다.
             목록 한 쪽에 30줄이면 수십 MB 를 받아서, 브라우저가
             그것을 32픽셀로 줄여 그리느라 애를 씁니다.

       둘.  <b>실패하면 원본을 다시 받았습니다.</b>
             onerror 에 「줄인 것이 안 되면 원본을 쓰라」 고 적혀
             있었습니다. 위키미디어 thumb 주소는 규칙이 까다로워
             자주 빗나가므로, 이 되돌림이 생각보다 잦았습니다.
             → 이제 <b>줄이는 서비스</b>로 한 번 더 시도하고,
               그것도 안 되면 <b>글자 한 자</b>로 대신합니다.
               원본은 부르지 않습니다.

       삼.  <b>자리를 미리 잡아 두지 않았습니다.</b>
             그림이 하나씩 도착할 때마다 줄 높이가 다시 셈되어
             화면이 튑니다(reflow). width·height 를 적어 두면
             브라우저가 자리를 미리 비워 둡니다.

   ★ 쓰는 법
       <img ... > 대신
       OCThumb.img(url, { size:32, alt:'', fallback:'베' })
     를 부르면 <b>가벼운 img 태그 글자</b>를 돌려줍니다.

   ★ 어디에 쓰나 — db/person.html · org.html · venue.html · school.html
   ============================================================ */
(function () {
  'use strict';

  /* 위키미디어 원본을 <b>줄인 주소</b>로 바꿉니다.
     이미 줄인 것이거나 위키미디어가 아니면 그대로 돌려줍니다. */
  function wikiThumb(u, w) {
    if (!u) return u;
    u = String(u);

    /* ★ http → https 로 올립니다.
       담긴 주소가 http:// 인 것이 많습니다(공연장·단체 1,935줄).
       우리 사이트는 https 이므로 브라우저가 그것을 막거나 한 번 더
       돌려보내 느려집니다. */
    if (u.indexOf('http://') === 0) u = 'https://' + u.slice(7);

    /* ★ Special:FilePath 주소 — <b>이것이 버벅거림의 진짜 까닭이었습니다.</b>

         http://commons.wikimedia.org/wiki/Special:FilePath/Phila%20Academy.JPG

       이 모양은 <b>원본 파일로 넘겨주는</b> 주소입니다. 공연장 사진은
       한 장에 5~15MB 인 것이 흔한데, 목록 서른 줄이면 수백 MB 를
       받는 셈이었습니다.

       다행히 width 를 붙일 수 있습니다(MediaWiki 공식 기능) —
       그러면 알맞게 줄인 그림으로 넘겨줍니다. 5MB 가 5KB 가 됩니다.

       공연장 1,123줄 · 음악단체 812줄이 이 모양입니다. */
    if (u.indexOf('Special:FilePath/') >= 0 || u.indexOf('Special:Redirect/file/') >= 0) {
      if (/[?&]width=/.test(u)) return u;          /* 이미 붙어 있으면 그대로 */
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'width=' + w;
    }

    if (u.indexOf('upload.wikimedia.org') < 0) return u;
    if (u.indexOf('/thumb/') >= 0) {
      /* 이미 thumb 인데 크기가 우리가 원하는 것보다 크면 줄입니다 */
      return u.replace(/\/(\d+)px-/, function (m, n) {
        return (parseInt(n, 10) > w * 2) ? ('/' + w + 'px-') : m;
      });
    }
    var i = u.indexOf('/wikipedia/');
    if (i < 0) return u;
    var parts = u.slice(i + 11).split('/');
    if (parts.length < 4) return u;
    var proj = parts[0], a = parts[1], b = parts[2], fn = parts.slice(3).join('/');
    if (a.length !== 1 || b.length !== 2) return u;
    var t = u.slice(0, i + 11) + proj + '/thumb/' + a + '/' + b + '/' + fn + '/' + w + 'px-' + fn;
    if (fn.toLowerCase().slice(-4) === '.svg') t += '.png';
    return t;
  }

  /* ★ 어떤 주소든 <b>줄여서</b> 받는 길.
     images.weserv.nl 은 무료 이미지 줄이기 서비스입니다.
     위키미디어 thumb 규칙이 빗나가도 여기로 한 번 더 시도합니다. */
  function viaResizer(u, w) {
    if (!u) return '';
    var bare = String(u).replace(/^https?:\/\//, '');
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(bare)
      + '&w=' + w + '&h=' + w + '&fit=cover&output=webp&q=72';
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 목록 한 칸에 들어갈 그림 태그를 만듭니다.
     opt.size      실제로 보이는 크기(픽셀). 기본 32
     opt.fallback  그림이 없거나 못 받았을 때 보여 줄 글자
     opt.round     둥글게 할까 (기본 true) */
  function img(url, opt) {
    opt = opt || {};
    var size = opt.size || 32;
    var fb = esc(opt.fallback || '');
    var round = (opt.round === false) ? '' : 'border-radius:50%;';
    if (!url || !String(url).trim()) {
      return '<i class="oc-th-ini" style="' + round + '">' + fb + '</i>';
    }
    /* ★ 실제 크기의 <b>두 배</b>로 받습니다 — 고해상도 화면에서
       흐리지 않게 하되, 원본보다는 훨씬 작습니다. */
    var w = size * 2;
    var first = wikiThumb(String(url).trim(), w);
    var second = viaResizer(String(url).trim(), w);
    /* ★ onerror 는 <b>줄이는 서비스</b>로만 넘어갑니다.
       원본으로 되돌아가지 않습니다 — 그것이 버벅거림의 큰 까닭이었습니다.
       두 번째도 안 되면 글자로 바꿉니다. */
    return '<img src="' + esc(first) + '"'
      + ' data-alt2="' + esc(second) + '"'
      + ' alt="" loading="lazy" decoding="async"'
      /* ★ 자리를 미리 잡습니다 — 그림이 도착할 때 화면이 튀지 않습니다 */
      + ' width="' + size + '" height="' + size + '"'
      + ' style="width:' + size + 'px;height:' + size + 'px;'
      + 'object-fit:cover;' + round + 'display:block;background:rgba(0,0,0,.04)"'
      + ' onerror="OCThumb.onErr(this)">';
  }

  /* 그림을 못 받았을 때 — 줄이는 서비스로 한 번, 그다음 글자로 */
  function onErr(el) {
    if (!el) return;
    var alt2 = el.getAttribute('data-alt2');
    if (alt2 && el.src !== alt2) {
      el.removeAttribute('data-alt2');
      el.src = alt2;
      return;
    }
    /* 두 번 다 안 되면 그림 자리를 비웁니다 —
       깨진 그림 표시가 남으면 목록이 어수선합니다. */
    el.removeAttribute('onerror');
    el.style.display = 'none';
    var box = el.parentNode;
    if (box && !box.querySelector('.oc-th-ini')) {
      var i = document.createElement('i');
      i.className = 'oc-th-ini';
      i.textContent = (box.getAttribute('data-ini') || '');
      box.appendChild(i);
    }
  }

  window.OCThumb = { img: img, onErr: onErr, wikiThumb: wikiThumb, resize: viaResizer };
})();
