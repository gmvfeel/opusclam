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

    /* ── 1) 리스트 위치 복귀 ──
       뷰 URL(?id=&p=)을 읽어, '리스트로' 링크를 list.html?p=N&focus=ID 로 재작성.
       리스트 파일명은 뷰 파일명에서 자동 계산 (org-view.html → org.html). */
    (function () {
      var q = new URLSearchParams(location.search);
      var id = q.get('id'), p = q.get('p');
      if (!p) return;
      var file = location.pathname.split('/').pop();
      var list = file.replace('-view.html', '.html');
      document.querySelectorAll('a[href="' + list + '"]').forEach(function (a) {
        a.setAttribute('href', list + '?p=' + encodeURIComponent(p) + (id ? '&focus=' + encodeURIComponent(id) : ''));
      });
    })();

    /* ── 2) 즐겨찾기 · 킵 (로그인 회원 · Supabase 저장) ── */
    (function () {
      var toggles = document.querySelectorAll('.pv-tool[data-toggle]');
      if (!toggles.length) return;
      var q = new URLSearchParams(location.search);
      var itemId = q.get('id');
      var itemType = location.pathname.split('/').pop().replace('-view.html', '');
      var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
      var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
      var client = null;

      function kindOf(b) { return /킵/.test(b.textContent) ? 'keep' : 'favorite'; }
      function hasSession() {
        try { return Object.keys(localStorage).some(function (k) { return /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k); }); }
        catch (e) { return false; }
      }
      function needSupabase() { return (window.supabase && window.supabase.createClient) ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'); }
      function getClient() { if (!client) client = window.supabase.createClient(SB_URL, SB_KEY); return client; }
      function askLogin() { if (confirm('로그인이 필요한 기능입니다. 로그인 페이지로 이동할까요?')) location.href = '/account/login.html'; }

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
})();
