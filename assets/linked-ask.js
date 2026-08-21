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

  /* ══════════════════════════════════════════════════════════════
     ★★ 2026-08-21 · 꾸밈을 <b>이 파일로 옮겼습니다</b>

     여태 .oc-lk-btn 규칙은 assets/board.css 에만 있었습니다. 게시판
     화면은 그 파일을 부르니 괜찮았는데, <b>DB 상세 화면은 부르지
     않습니다.</b> 그래서 인물·단체 상세에 이 단추를 놓으면 맨 글자로만
     보였습니다.

     ▶ 단추를 그리는 곳과 꾸미는 곳을 <b>한 파일에</b> 둡니다.
       board.css 에서는 뺐습니다 — 두 곳에 적으면 언젠가 갈라집니다.
     ★ 값은 board.css 에 있던 것을 <b>그대로</b> 옮겼습니다.
       게시판 화면의 모양이 달라지지 않아야 합니다.
     ══════════════════════════════════════════════════════════════ */
  var CSS_ID = 'oc-lk-css';
  var CSS =
      '.bv-linked{display:inline-flex;vertical-align:middle;margin-left:7px}'
    + '.oc-lk-btn{display:inline-flex;align-items:center;gap:4px;'
    +   'height:26px;padding:0 11px;border-radius:999px;'
    +   'font-family:inherit;font-size:11.5px;font-weight:800;line-height:1;'
    +   'letter-spacing:.01em;color:#fff;'
    +   'background:linear-gradient(135deg,#7a5cc4,#5b4b9e);border:0;'
    +   'box-shadow:0 2px 7px -2px rgba(91,75,158,.55);'
    +   'cursor:pointer;white-space:nowrap;'
    +   'transition:filter .15s ease,box-shadow .15s ease,transform .15s ease}'
    + '.oc-lk-btn:hover{filter:brightness(1.09);'
    +   'box-shadow:0 4px 12px -3px rgba(91,75,158,.6);'
    +   'transform:translateY(-1px)}'
    + '.oc-lk-btn i{font-style:normal;font-size:12.5px;font-weight:800}'
      /* 이미 이어졌거나 청한 사이 — 누를 수 없습니다 */
    + '.oc-lk-btn.off{color:var(--text-3,#8a8ca0);background:rgba(0,0,0,.04);'
    +   'border:1px solid rgba(0,0,0,.10);box-shadow:none;'
    +   'font-weight:700;cursor:default}'
    + '.oc-lk-btn.off:hover{filter:none;transform:none;box-shadow:none;'
    +   'background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.10)}'
    + '@media (max-width:860px){'
    +   '.oc-lk-btn{height:28px;padding:0 12px;font-size:12px}}'
      /* 짧은 알림 */
    + '.oc-lk-toast{position:fixed;left:50%;bottom:34px;'
    +   'transform:translate(-50%,14px);'
    +   'background:rgba(30,26,52,.94);color:#fff;'
    +   'font-size:13px;font-weight:600;line-height:1.5;'
    +   'padding:12px 20px;border-radius:999px;'
    +   'box-shadow:0 10px 30px -10px rgba(20,14,45,.5);'
    +   'opacity:0;transition:opacity .2s ease,transform .2s ease;'
    +   'z-index:9999;pointer-events:none;max-width:86vw;text-align:center}'
    + '.oc-lk-toast.go{opacity:1;transform:translate(-50%,0)}';

  (function injectCss() {
    try {
      if (document.getElementById(CSS_ID)) return;
      var st = document.createElement('style');
      st.id = CSS_ID; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { /* 꾸밈이 없어도 단추는 눌립니다 */ }
  })();

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

    /* ★★ 2026-08-20 — <b>서버에 물어봅니다</b> (oc_link_can_ask)
       ★ 예전에는 member_links 를 직접 읽어 「이어졌나 · 청해 뒀나」 만
         보았습니다. 그것으로는 모자랍니다 —
           · 상대가 「일반 회원의 청하기는 받지 않겠다」 를 골라 둘 수 있고
           · 차단된 사이일 수 있고
           · 얼마 전에 끝난 사이면 30일을 기다려야 합니다
         이 셋은 <b>members 표</b>와 <b>차단 표</b>를 봐야 알 수 있는데,
         두 표 다 자물쇠가 걸려 있어 화면이 읽을 수 없습니다(읽게 열면
         회원 명부가 새어 나갑니다). 그래서 함수가 대신 답합니다.
       ★ 못 받는 까닭을 <b>숨기지 않고 적습니다.</b> 숨기면 「왜 답이
         없지」 하며 또 청하게 됩니다. */
    var needmsg = false;
    try {
      var c0 = await sb();
      var r0 = await c0.rpc('oc_link_can_ask', { p_to: uid });
      var d0 = (r0 && r0.data) || {};
      if (r0 && !r0.error && d0.ok !== true) {
        paint(btn, d0.why, d0);
        return;
      }
      needmsg = (d0.needmsg === true);
    } catch (e) { /* 못 물어봐도 단추는 남깁니다 — 누르면 서버가 막습니다 */ }

    btn.addEventListener('click', function () { ask(btn, uid, nm, needmsg); });
  }

  /* ★ 서버가 주는 까닭(why)을 그대로 받습니다 — 화면과 서버가 같은
     말을 쓰게, 옮겨 적는 표를 여기 한 곳에만 둡니다.
     · done / already  이미 이어짐        · wait / waiting  내가 청해 둠
     · incoming        상대가 청해 둠      · closed          안 받음
     · blocked         차단된 사이         · rejected_recent 30일 기다려야 */
  function paint(btn, state, d) {
    d = d || {};
    btn.disabled = true;
    btn.classList.add('off');
    var face =
        (state === 'done' || state === 'already') ? '<i>✓</i>이어짐'
      : (state === 'wait' || state === 'waiting') ? '<i>·</i>청함'
      : state === 'incoming'        ? '<i>·</i>요청 받음'
      : state === 'closed'          ? '<i>·</i>청하기 닫힘'
      : state === 'blocked'         ? '<i>·</i>차단됨'
      : state === 'rejected_recent' ? '<i>·</i>청하기 닫힘'
      : null;
    if (face === null) { btn.disabled = false; btn.classList.remove('off'); return; }
    btn.innerHTML = face;
    btn.title =
        (state === 'done' || state === 'already') ? '이미 이어진 사이입니다'
      : (state === 'wait' || state === 'waiting') ? '청해 두었습니다 — 상대의 답을 기다립니다'
      : state === 'incoming' ? '이 회원이 청해 두었습니다 — 마이페이지에서 답하실 수 있습니다'
      : state === 'closed'   ? (d.general === true
                                ? '이 회원은 일반 회원의 Linked 청하기를 받지 않습니다'
                                : '이 회원은 지금 Linked 청하기를 받지 않습니다')
      : state === 'blocked'  ? '차단된 사이입니다'
      : state === 'rejected_recent'
                             ? '얼마 전에 끝난 사이입니다 — ' + (d.days || 30)
                               + '일 뒤에 다시 청하실 수 있습니다'
      : btn.title;
  }

  async function ask(btn, uid, nm, needmsg) {
    var user = await me();
    if (!user) {
      ocGo('/account/login.html?next='
        + encodeURIComponent(location.pathname + location.search));
      return;
    }
    /* ★ 일반 회원이 청할 때는 인사말이 <b>필수</b>입니다 (다섯 자 이상).
       가입이 즉시 되므로 계정을 만드는 값이 사실상 0 입니다. 문턱은
       가입이 아니라 청하기에 두어야 합니다. */
    var msg = prompt(nm + '님에게 Linked 를 청합니다.\n'
      + (needmsg
          ? '인사말을 적어 주십시오. (다섯 자 이상)\n'
            + '「어디서 뵈었는지」 를 적으면 승낙받기 쉽습니다.'
          : '짧은 인사말을 남기실 수 있습니다. (비워 두셔도 됩니다)')
      + '\n상대만 볼 수 있습니다.', '');
    if (msg === null) return;   /* 취소 */
    if (needmsg && String(msg).trim().length < 5) {
      toast('인사말을 다섯 자 이상 적어 주십시오.');
      return;
    }

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
        : d.why === 'blocked' ? '차단된 사이입니다. 청할 수 없습니다.'
        : d.why === 'closed'  ? (d.general
                                  ? '이 회원은 일반 회원의 청하기를 받지 않습니다.'
                                  : '이 회원은 지금 청하기를 받지 않습니다.')
        : d.why === 'needmsg' ? '인사말을 ' + (d.min || 5) + '자 이상 적어 주십시오.'
        : d.why === 'msgtoolong' ? '인사말이 너무 깁니다. ' + (d.max || 300) + '자까지 됩니다.'
        : d.why === 'limitday' ? '하루에 청할 수 있는 수(' + (d.max || 3)
                                 + '건)를 넘었습니다. 내일 다시 해 주십시오.'
        : d.why === 'rejected_recent'
                              ? '얼마 전에 끝난 사이입니다. ' + (d.days || 30)
                                + '일 뒤에 다시 청하실 수 있습니다.'
        : '청하지 못했습니다. 잠시 뒤에 다시 해 주십시오.');
        /* 되돌릴 수 없는 까닭이면 단추를 잠가 둡니다 — 다시 눌러도
           같은 말만 나옵니다. */
        if (d.why === 'already' || d.why === 'waiting'
            || d.why === 'closed' || d.why === 'blocked'
            || d.why === 'rejected_recent') paint(btn, d.why, d);
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
