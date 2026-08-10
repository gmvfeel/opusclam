/* i18n 이 없을 때를 위한 폴백 — 언어를 붙이지 못해도 이동은 됩니다 */
if (typeof window.ocGo !== 'function') { window.ocGo = function (u, r) { if (r) location.replace(u); else location.href = u; }; }
/* ============================================================
   OPUSCLAM  Linked 청하기            assets/linked-ask.js
   2026-08-04

   ★ 무엇을 하나
     글 상세에서 <b>글 쓴 사람 옆에</b> 「+ Linked」 를 놓습니다.
     누르면 그 사람에게 인맥을 청합니다.

   ★ 왜 필요한가
     마이페이지에서만 청할 수 있었는데, 그러려면 <b>상대의 아이디를
     알아야</b> 했습니다. 실제로는 글을 읽다가 「이 사람과 이어 두고
     싶다」 가 자연스럽습니다.

   ★ 어디에 놓나 — <b>자리는 board.js 가 만듭니다.</b>
       <span class="bv-linked" data-uid="…" data-name="…"></span>
     이 파일이 그 자리를 찾아 채웁니다. 자리가 없으면 아무 일도 하지
     않으므로, 어느 화면에 실려도 해롭지 않습니다.

   ★ 조심한 것
     · <b>자기 글에는 놓지 않습니다.</b> 자기에게 청할 수 없습니다.
     · 이미 이어졌거나 청해 둔 사이면 <b>그 상태를 보여 줍니다.</b>
     · 로그인하지 않은 사람에게도 <b>보입니다</b> — 누르면 로그인으로
       보내면서 돌아올 곳을 알려 줍니다. 숨기면 이런 기능이 있다는 것을
       아예 모르게 됩니다.

   쓰는 법 — 글 상세 화면에서
     <script src="/assets/linked-ask.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  /* ── Supabase ─────────────────────────────────────────────
     ★ 없으면 스스로 싣습니다 — 화면마다 싣는 것이 다릅니다.
       (오늘 interests.js 에서 같은 일을 겪었습니다) */
  var _libWait = null;
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
    if (_libWait) return _libWait;
    _libWait = new Promise(function (res) {
      var old = document.querySelector('script[data-oc-sblib]');
      if (old) {
        old.addEventListener('load', function () { res(true); });
        old.addEventListener('error', function () { res(false); });
        return;
      }
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      sc.setAttribute('data-oc-sblib', '1');
      sc.onload = function () { res(true); };
      sc.onerror = function () { res(false); };
      document.head.appendChild(sc);
    });
    return _libWait;
  }
  async function sb() {
    if (window.__ocSb) return window.__ocSb;
    var ok = await loadLib();
    if (!ok || !window.supabase || !window.supabase.createClient) return null;
    if (!window.__ocSb)
      window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
    return window.__ocSb;
  }

  var _me = undefined;
  async function me() {
    if (_me !== undefined) return _me;
    var c = await sb();
    if (!c) { _me = null; return _me; }
    try {
      var g = await c.auth.getSession();
      _me = (g && g.data && g.data.session) ? g.data.session.user : null;
    } catch (e) { _me = null; }
    return _me;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 짧은 알림 — alert 은 흐름을 끊습니다 */
  function toast(text) {
    var old = document.querySelector('.oc-lk-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'oc-lk-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('go'); }, 20);
    setTimeout(function () { t.remove(); }, 3000);
  }

  /* ── 자리를 채웁니다 ─────────────────────────────────────── */
  async function mount(slot) {
    if (!slot || slot.getAttribute('data-done')) return;
    slot.setAttribute('data-done', '1');

    var uid = slot.getAttribute('data-uid');
    var nm  = slot.getAttribute('data-name') || '이 회원';
    if (!uid) return;

    var user = await me();

    /* ★ 자기 글에는 놓지 않습니다 */
    if (user && user.id === uid) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oc-lk-btn';
    btn.innerHTML = '<i>+</i>Linked';
    btn.title = nm + '님에게 인맥을 청합니다';
    slot.appendChild(btn);

    /* 이미 이어졌거나 청해 둔 사이인지 봅니다 */
    if (user) {
      try {
        var c = await sb();
        var r = await c.from('member_links')
          .select('id,status,from_id,to_id')
          .or('and(from_id.eq.' + user.id + ',to_id.eq.' + uid + '),'
            + 'and(from_id.eq.' + uid + ',to_id.eq.' + user.id + ')')
          .limit(1);
        var row = (r && r.data && r.data[0]) || null;
        if (row) {
          if (row.status === 'accepted') { paint(btn, 'done'); return; }
          if (row.status === 'pending') {
            /* 내가 청한 것인지, 상대가 청한 것인지 갈라 적습니다 */
            paint(btn, row.from_id === user.id ? 'wait' : 'incoming');
            return;
          }
        }
      } catch (e) { /* 못 봐도 단추는 남깁니다 */ }
    }

    btn.addEventListener('click', function () { ask(btn, uid, nm); });
  }

  function paint(btn, state) {
    btn.disabled = true;
    btn.classList.add('off');
    btn.innerHTML =
        state === 'done'     ? '<i>✓</i>이어짐'
      : state === 'wait'     ? '<i>·</i>청함'
      : state === 'incoming' ? '<i>·</i>요청 받음'
      : btn.innerHTML;
    btn.title =
        state === 'done'     ? '이미 이어진 사이입니다'
      : state === 'wait'     ? '청해 두었습니다 — 상대의 답을 기다립니다'
      : state === 'incoming' ? '이 회원이 청해 두었습니다 — 마이페이지에서 답하실 수 있습니다'
      : btn.title;
  }

  async function ask(btn, uid, nm) {
    var user = await me();
    if (!user) {
      ocGo('/account/login.html?next='
        + encodeURIComponent(location.pathname + location.search));
      return;
    }
    var msg = prompt(nm + '님에게 Linked 를 청합니다.\n'
      + '짧은 인사말을 남기실 수 있습니다. (비워 두셔도 됩니다)\n'
      + '상대만 볼 수 있습니다.', '');
    if (msg === null) return;   /* 취소 */

    btn.disabled = true;
    try {
      var c = await sb();
      var r = await c.rpc('oc_link_ask', { p_to: uid, p_msg: msg });
      var d = (r && r.data) || {};
      if (r.error || d.ok !== true) {
        toast(
          d.why === 'already' ? '이미 이어진 사이입니다.'
        : d.why === 'waiting' ? '이미 청해 두었습니다. 상대의 답을 기다려 주십시오.'
        : d.why === 'self'    ? '자기 자신에게는 청할 수 없습니다.'
        : '청하지 못했습니다. 잠시 뒤에 다시 해 주십시오.');
        if (d.why === 'already') paint(btn, 'done');
        else if (d.why === 'waiting') paint(btn, 'wait');
        else btn.disabled = false;
        return;
      }
      if (d.accepted) { paint(btn, 'done'); toast('상대도 청해 두었기에 바로 이어졌습니다.'); }
      else { paint(btn, 'wait'); toast('청했습니다. 상대가 승낙하면 이어집니다.'); }
    } catch (e) {
      toast('청하지 못했습니다. 잠시 뒤에 다시 해 주십시오.');
      btn.disabled = false;
    }
  }

  /* ── 자리를 찾습니다 ─────────────────────────────────────────
     ★ 글 상세는 <b>뒤늦게 그려집니다</b>(자료를 받아 온 뒤). 그래서
       한 번만 찾으면 놓칩니다. 화면이 바뀌는 것을 지켜봅니다. */
  function scan() {
    var list = document.querySelectorAll('.bv-linked:not([data-done])');
    for (var i = 0; i < list.length; i++) mount(list[i]);
  }

  function start() {
    scan();
    try {
      var mo = new MutationObserver(function () { scan(); });
      mo.observe(document.body, { childList: true, subtree: true });
      /* 오래 지켜보면 무겁습니다 — 20초면 충분합니다 */
      setTimeout(function () { mo.disconnect(); }, 20000);
    } catch (e) {
      /* MutationObserver 를 못 쓰면 몇 번 다시 찾습니다 */
      var n = 0;
      var t = setInterval(function () {
        scan(); n++;
        if (n > 20) clearInterval(t);
      }, 700);
    }
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start);
  else start();
})();
