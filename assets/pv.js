/* i18n 이 없을 때를 위한 폴백 — 언어를 붙이지 못해도 이동은 됩니다 */
if (typeof window.ocGo !== 'function') { window.ocGo = function (u, r) { if (r) location.replace(u); else location.href = u; }; }
/* ============================================================
   OPUSCLAM 공용 뷰(상세) 버튼 로직  — assets/pv.js
   담당: 리스트 위치 복귀 · 즐겨찾기/킵(토글) · 공유 · 저장(PDF/이미지)
   이 한 파일만 고치면 모든 뷰페이지(person/org/venue/… -view.html)에 반영됩니다.
   ※ 뷰별 데이터 로드 스크립트(?id 로드)는 DB마다 달라 각 페이지에 그대로 둠.
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.setAttribute('style', 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:rgba(20,22,34,.94);color:#fff;padding:11px 20px;border-radius:10px;font-size:13px;z-index:9999;opacity:0;transition:opacity .2s;box-shadow:0 8px 24px -8px rgba(0,0,0,.5)');
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 250); }, 1800);
    return el;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  ready(function () {

    /* ── 1) 리스트 위치 복귀 ──────────────────────────────────
       상세를 보다가 「리스트」 를 누르면 <b>보던 그 글 자리로</b>
       돌아가게 합니다. 목록 첫 쪽으로 튕기면 다시 찾아 들어가야 해서
       번거롭습니다.

       ★ 예전에는 DB 화면(인물DB 등)에서만 되었습니다. 세 가지가
         게시판과 어긋났기 때문입니다 —

         하나. <b>쪽 번호</b>
               DB 는 주소에 ?p=2 를 담습니다. 게시판(board.js)은 주소에
               담지 않고 <b>sessionStorage</b> 에 넣어 둡니다.
               그래서 ?p= 가 없으면 그냥 되돌아 나갔습니다.
               → 이제 저장된 것도 함께 봅니다.

         둘.  <b>목록 파일 이름</b>
               person-view.html → person.html 로 바꾸면 맞았지만,
               정보SPOT 은 <b>spot-view.html 하나로 여러 갈래</b>를
               보여 주므로 spot.html 이라는 파일이 없습니다.
               → 화면에 이미 놓인 링크의 주소를 <b>그대로 쓰고</b>
                 물음표만 덧붙입니다.

         삼.  <b>절대 경로</b>
               a[href="person.html"] 로 정확히 찾았는데, 게시판은
               href 가 /spot/index.html 처럼 절대 경로입니다.
               → 링크를 <b>class 로</b> 고릅니다(.pv-listtab · .pv-tolist-m).

       ★ 이 파일 하나를 고치면 모든 상세 화면에 함께 듣습니다 —
         커뮤니티 9곳 · 정보SPOT · DB 7곳이 모두 pv.js 를 싣고 있습니다. */
    (function () {
      var q = new URLSearchParams(location.search);
      var id = q.get('id');
      var p  = q.get('p');

      /* 게시판은 쪽 번호를 sessionStorage 에 담습니다.
         board.js 의 열쇠 모양을 그대로 읽습니다 — 그쪽이 이미
         갈래·검색말·정렬까지 담아 두므로, 우리는 <b>있는지만</b>
         확인하면 됩니다(되돌리는 일은 board.js 가 합니다). */
      /* board.js 는 <b>ocbd-back:표이름</b> 으로 담습니다. 표 이름이
         화면마다 다르므로(spot · news · qna …) 열쇠를 <b>앞머리로</b>
         찾습니다. 그 안의 id 가 지금 보고 있는 글과 같으면
         「되돌릴 자리가 있다」 는 뜻입니다. */
      var saved = false;
      if (!p && id) {
        try {
          for (var k = 0; k < sessionStorage.length; k++) {
            var kk = sessionStorage.key(k);
            if (!kk || kk.indexOf('ocbd-back:') !== 0) continue;
            var oo = JSON.parse(sessionStorage.getItem(kk) || 'null');
            if (oo && String(oo.id) === String(id)) { saved = true; break; }
          }
        } catch (e) {}
      }
      if (!p && !saved) return;      /* 되돌릴 자리를 모르면 그대로 둡니다 */
      if (!id) return;

      /* ★ 화면에 놓인 목록 링크의 주소를 <b>그대로 쓰고</b> 덧붙입니다.
         파일 이름을 짐작하지 않으므로 spot-view.html 처럼 갈래가 여러
         개인 화면에서도 어긋나지 않습니다. */
      var sels = ['.pv-listtab', '.pv-tolist-m', '.pv-tolist', '.bv-tolist'];
      var seen = [];
      sels.forEach(function (sel) {
        document.querySelectorAll('a' + sel).forEach(function (a) {
          if (seen.indexOf(a) >= 0) return;
          seen.push(a);
          var href = a.getAttribute('href') || '';
          if (!href || href.charAt(0) === '#') return;
          if (href.indexOf('focus=') >= 0) return;      /* 이미 붙었으면 그대로 */
          var join = href.indexOf('?') >= 0 ? '&' : '?';
          a.setAttribute('href', href + join
            + (p ? 'p=' + encodeURIComponent(p) + '&' : '')
            + 'focus=' + encodeURIComponent(id));
        });
      });

      /* 예전 방식(파일 이름으로 찾기)도 남겨 둡니다 —
         DB 화면 가운데 class 를 안 쓴 곳이 있을 수 있습니다. */
      if (p) {
        var file = location.pathname.split('/').pop();
    /* ★★ 2026-08-19 · cleanUrls 가 `.html` 을 없앱니다 —
         `/db/person-view.html` → `/db/person-view`
         정규식을 쓰지 않고 글자 자리만 봅니다. */
        if (file.length > 5 && file.slice(-5) === '.html') file = file.slice(0, -5);
        var list = (file.length > 5 && file.slice(-5) === '-view')
                   ? file.slice(0, -5) + '.html' : file;
        if (list !== file) {
          document.querySelectorAll('a[href="' + list + '"]').forEach(function (a) {
            if (seen.indexOf(a) >= 0) return;
            a.setAttribute('href', list + '?p=' + encodeURIComponent(p)
              + '&focus=' + encodeURIComponent(id));
          });
        }
      }
    })();

    /* ── 2) 즐겨찾기 · 킵 (로그인 회원 · Supabase 저장) ── */
    (function () {
      var toggles = document.querySelectorAll('.pv-tool[data-toggle]');
      if (!toggles.length) return;
      var q = new URLSearchParams(location.search);
      var itemId = q.get('id');
      /* ★ 갈래는 <b>화면 파일 이름</b>으로 정합니다 (person-view.html → person).
       ★ 딱 하나 <b>겹치는 것</b>이 있어 바로잡습니다 (2026-08-05) —
           /db/modern-view.html        현대음악DB
           /community/modern-view.html 현대음악 게시판
         둘 다 modern 이 되어 마이페이지 즐겨찾기에서 <b>구별할 수
         없었습니다.</b> 게시판 쪽만 표 이름과 같게 modern_music 으로
         둡니다. (받는 쪽은 account/mypage.html 의 FAV_META) */
    var TYPE_FIX = { '/community/modern-view': 'modern_music' };
    /* ★ 언어를 떼고 견줍니다 — /en/community/modern-view 도 같은 화면입니다 */
    var _p = (window.ocPath || String)(location.pathname);
    /* ★★ 2026-08-19 · <b>cleanUrls 가 `.html` 을 없앱니다.</b>
         그대로 두면 갈래가 `person-view` 로 저장되어, 마이페이지
         즐겨찾기에서 <b>아무것도 안 보이게 됩니다.</b>
         `.html` 을 떼고 `-view` 도 뗀 것이 갈래입니다. */
    if (_p.length > 5 && _p.slice(-5) === '.html') _p = _p.slice(0, -5);
    var _f = _p.split('/').pop();
    var itemType = TYPE_FIX[_p]
      || ((_f.length > 5 && _f.slice(-5) === '-view') ? _f.slice(0, -5) : _f);
      var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
      var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
      var client = null;

      function kindOf(b) { return /킵/.test(b.textContent) ? 'keep' : 'favorite'; }
      function hasSession() {
        try { return Object.keys(localStorage).some(function (k) { return /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k); }); }
        catch (e) { return false; }
      }
      function needSupabase() { return (window.supabase && window.supabase.createClient) ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'); }
      /* 접속 객체는 화면 전체에 하나만 (window.__ocSb) */
      function getClient() { if (!client) { if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY); client = window.__ocSb; } return client; }
      function askLogin() { if (confirm('로그인이 필요한 기능입니다. 로그인 페이지로 이동할까요?')) ocGo('/account/login.html'); }

      // 클릭 → 저장/해제
      toggles.forEach(function (b) {
        b.addEventListener('click', function () {
          if (!itemId) return;
          if (!hasSession()) { askLogin(); return; }
          var kind = kindOf(b);
          var wasPressed = b.getAttribute('aria-pressed') === 'true';
          b.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');  // 낙관적 토글
          b.disabled = true;
          needSupabase()
            .then(function () {
              var c = getClient();
              return c.auth.getUser().then(function (u) {
                var uid = u && u.data && u.data.user && u.data.user.id;
                if (!uid) throw new Error('no-session');
                if (wasPressed) return c.from('member_favorites').delete().eq('item_type', itemType).eq('item_id', String(itemId)).eq('kind', kind);
                return c.from('member_favorites').insert({ item_type: itemType, item_id: String(itemId), kind: kind });
              });
            })
            .then(function (res) {
              if (res && res.error) throw res.error;
              toast(kind === 'favorite' ? (wasPressed ? '즐겨찾기에서 뺐습니다' : '즐겨찾기에 추가했습니다')
                                        : (wasPressed ? '킵에서 뺐습니다' : '킵에 저장했습니다'));
            })
            .catch(function (e) {
              b.setAttribute('aria-pressed', wasPressed ? 'true' : 'false');  // 롤백
              if (e && e.message === 'no-session') askLogin();
              else toast('처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
            })
            .finally(function () { b.disabled = false; });
        });
      });

      // 로드 시 → 로그인 상태면 저장된 상태 표시
      if (itemId && hasSession()) {
        needSupabase()
          .then(function () { return getClient().from('member_favorites').select('kind').eq('item_type', itemType).eq('item_id', String(itemId)); })
          .then(function (res) {
            if (!res || res.error || !res.data) return;
            var kinds = res.data.map(function (r) { return r.kind; });
            toggles.forEach(function (b) { if (kinds.indexOf(kindOf(b)) >= 0) b.setAttribute('aria-pressed', 'true'); });
          })
          .catch(function () {});
      }
    })();

    /* ── 3) 공유 ── */
    var shareBtn = document.querySelector('[data-share]');
    if (shareBtn) shareBtn.addEventListener('click', function () {
      var url = location.href, title = (document.title || 'OPUSCLAM').trim();
      function copyFallback(text) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text; ta.setAttribute('style', 'position:fixed;opacity:0;left:0;top:0');
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand('copy'); ta.remove();
          toast('링크가 복사되었습니다');
        } catch (e) { window.prompt('링크를 복사하세요:', text); }
      }
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('링크가 복사되었습니다'); }, function () { copyFallback(url); });
        return;
      }
      copyFallback(url);
    });

    /* ── 4) 저장 (PDF=인쇄 / 이미지=html2canvas) ── */
    var saveBtn = document.querySelector('[data-save]');
    if (saveBtn) {
      var target = document.querySelector('article.pv');
      var menu = null, h2c = false;
      function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener('click', onDoc, true); } }
      function onDoc(e) { if (menu && !menu.contains(e.target) && e.target !== saveBtn) closeMenu(); }
      function savePDF() { window.print(); }
      function saveIMG() {
        if (!target) { toast('저장할 내용을 찾지 못했습니다'); return; }
        var t1 = toast('이미지를 만드는 중…');
        (h2c ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'))
          .then(function () { h2c = true; return html2canvas(target, { useCORS: true, backgroundColor: '#ffffff', scale: 2 }); })
          .then(function (canvas) {
            if (t1) t1.remove();
            canvas.toBlob(function (blob) {
              var nm = (document.title || 'opusclam').replace(/[^\w가-힣\-]+/g, '_').slice(0, 40) || 'opusclam';
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob); a.download = nm + '.png';
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
            });
          })
          .catch(function () { if (t1) t1.remove(); toast('이미지 저장에 실패했어요. PDF로 저장해 주세요.'); });
      }
      function openMenu() {
        if (menu) { closeMenu(); return; }
        menu = document.createElement('div');
        menu.className = 'oc-save-menu';
        menu.setAttribute('style', 'position:absolute;z-index:9998;background:var(--paper,#fff);border:1px solid var(--line-2,#e2e2e2);border-radius:10px;box-shadow:0 12px 30px -10px rgba(0,0,0,.3);padding:5px;min-width:150px');
        [['pdf', 'PDF로 저장'], ['img', '이미지로 저장']].forEach(function (o) {
          var it = document.createElement('button');
          it.type = 'button'; it.textContent = o[1];
          it.setAttribute('style', 'display:block;width:100%;text-align:left;background:none;border:0;padding:9px 12px;font-size:13px;color:var(--text,#222);cursor:pointer;border-radius:7px;font-family:inherit');
          it.addEventListener('click', function () { closeMenu(); if (o[0] === 'pdf') savePDF(); else saveIMG(); });
          menu.appendChild(it);
        });
        document.body.appendChild(menu);
        var r = saveBtn.getBoundingClientRect();
        menu.style.left = (window.scrollX + r.left) + 'px';
        menu.style.top = (window.scrollY + r.bottom + 6) + 'px';
        setTimeout(function () { document.addEventListener('click', onDoc, true); }, 0);
      }
      saveBtn.addEventListener('click', function (e) { e.stopPropagation(); openMenu(); });
    }

  });

  /* ★★ 2026-08-19 · 언급 잇기(assets/mentions.js) 를 <b>여기서</b> 싣습니다
     ─────────────────────────────────────────────────────────────
     ★ 왜 화면 파일에 넣지 않았나
       상세 화면이 <b>스무 개</b>입니다. 스무 개를 고쳐 올리면
       그만큼 실수할 자리가 늘어납니다. 특히 이름에 이음표(-)가 있는
       파일은 올릴 때 이음표가 떨어져 나가는 일이 있었습니다.
     ★ pv.js 는 <b>그 스무 곳에 이미 다 실려 있습니다.</b>
       그러니 여기 한 곳에서 부르면 스무 곳이 함께 됩니다.
     ★ 두 번 싣지 않도록 이미 있는지 봅니다. */
  (function loadMentions() {
    if (window.OCMentions) return;
    if (document.querySelector('script[data-oc="mentions"]')) return;
    var s = document.createElement('script');
    s.src = '/assets/mentions.js';
    s.defer = true;
    s.setAttribute('data-oc', 'mentions');
    (document.head || document.documentElement).appendChild(s);
  })();
})();
