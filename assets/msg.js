/* ════════════════════════════════════════════════════════════════
   OPUSCLAM · 쪽지            assets/msg.js
   2026-08-20
   ────────────────────────────────────────────────────────────────

   ★ 무엇을 하나
     이어진(Linked) 회원과 <b>쪽지를 주고받습니다.</b>
     마이페이지 「쪽지」 탭에 실립니다.

   ★ 왜 필요한가 (파트너 물음 · 2026-08-20)
       「링크드 신청은 할 수 있어서 이어진 사람은 있지만,
        이어진 사람과 할 수 있는 게 지금은 아무것도 없어.」
     이어 두는 것 자체가 목적이 될 수는 없습니다. 이어졌으면
     <b>말을 걸 수 있어야</b> 합니다.

   ★ 이어진 사이에만 보낼 수 있습니다
     이것이 스팸을 막는 <b>유일한</b> 장치입니다. 서버(oc_msg_send)가
     막으므로 화면을 뜯어도 뚫리지 않습니다. 화면은 <b>왜 못 보내는지</b>
     를 사람 말로 알려 주는 일만 합니다.

   ★ 짝이 되는 SQL : sql/msg-02-B-apply.sql
       oc_msg_rooms()            사람별 마지막 쪽지 · 안 읽은 수
       oc_msg_thread(상대,수,전) 주고받은 것
       oc_msg_send(상대,글)      보내기
       oc_msg_read(상대)         읽음으로
       oc_msg_unread()           안 읽은 수 (배지)
       oc_msg_hide(번호)         내 쪽에서만 지우기
       oc_block_add / oc_block_del / oc_my_blocks

   ★ 쓰는 법
       <script src="/assets/msg.js" defer></script>
       화면에 <div id="msgBody"></div> 를 두면 됩니다.
         OCMsg.init()             탭을 열 때
         OCMsg.open(아이디, 이름)  그 사람과의 대화를 곧바로 열기
         OCMsg.badge()            안 읽은 수만 다시 세기

   ★ 조심한 것
     · 접속 객체를 <b>새로 만들지 않습니다</b>(window.__ocSb).
       여러 개면 토큰이 안 실려 RLS 가 빈 결과를 줍니다.
     · 안 읽은 수는 <b>탭을 열지 않아도</b> 보입니다. 안 그러면
       쪽지가 와 있는 줄을 모릅니다.
     · 새로 온 것 다시 보기는 <b>이 탭을 보고 있을 때만</b> 합니다.
       안 보는 화면에서 45초마다 물어보는 것은 낭비입니다.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  var MAX  = 2000;                       /* 서버와 같은 값 (member_messages) */
  var TICK = 45000;                      /* 새 쪽지 다시 보기 */

  var TYPE = { industry:'음악관계자', org:'단체·기업', school:'음악학교',
               major:'전공자', general:'일반' };

  /* 서버가 주는 까닭을 사람 말로 — 서버와 화면이 같은 말을 쓰게
     여기 한 곳에만 적습니다. */
  function say(d) {
    var w = (d && d.why) || 'error';
    if (w === 'login')      return '로그인이 필요합니다.';
    if (w === 'self')       return '자기 자신에게는 보낼 수 없습니다.';
    if (w === 'notfound')   return '그 회원을 찾을 수 없습니다.';
    if (w === 'blocked')    return '차단된 사이입니다. 쪽지를 주고받을 수 없습니다.';
    if (w === 'notlinked')  return '이어진 사이에만 쪽지를 보낼 수 있습니다.';
    if (w === 'empty')      return '내용을 적어 주십시오.';
    if (w === 'toolong')    return '너무 깁니다. ' + (d.max || MAX) + '자까지 됩니다.';
    if (w === 'limitday')   return '하루에 보낼 수 있는 수(' + (d.max || 100)
                                 + '통)를 넘었습니다. 내일 다시 해 주십시오.';
    if (w === 'limitburst') return '한 사람에게 잠깐 사이 너무 많이 보내셨습니다.'
                                 + ' 한 시간 뒤에 다시 해 주십시오.';
    return '처리하지 못했습니다. 잠시 뒤에 다시 해 주십시오.';
  }

  /* ── 접속 ─────────────────────────────────────────────────── */
  var _wait = null;
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
    if (_wait) return _wait;
    _wait = new Promise(function (res) {
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
    return _wait;
  }
  async function sb() {
    if (window.__ocSb) return window.__ocSb;
    var ok = await loadLib();
    if (!ok || !window.supabase || !window.supabase.createClient) return null;
    if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
    return window.__ocSb;
  }
  async function call(fn, args) {
    var c = await sb();
    if (!c) return { error: true };
    try {
      var r = await c.rpc(fn, args || {});
      if (r.error) return { error: true, msg: r.error.message };
      return { data: r.data };
    } catch (e) { return { error: true, msg: String(e && e.message || e) }; }
  }

  /* ── 잔손 ─────────────────────────────────────────────────── */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* 줄 바꿈을 살립니다 — 쪽지는 여러 줄로 쓰는 것이 자연스럽습니다 */
  function body(v) { return esc(v).replace(/\n/g, '<br>'); }

  function when(x) {
    if (!x) return '';
    try {
      var d = new Date(x), n = new Date();
      var two = function (v) { return ('0' + v).slice(-2); };
      var hm = two(d.getHours()) + ':' + two(d.getMinutes());
      if (d.toDateString() === n.toDateString()) return hm;
      var y = new Date(n.getTime() - 86400000);
      if (d.toDateString() === y.toDateString()) return '어제 ' + hm;
      if (d.getFullYear() === n.getFullYear())
        return (d.getMonth() + 1) + '.' + d.getDate();
      return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
    } catch (e) { return ''; }
  }

  function photo(x) {
    var ini = String((x && x.name) || '?').trim().charAt(0) || '?';
    return '<div class="ms-ph">'
      + (x && x.photo
          ? '<img src="' + esc(x.photo) + '" alt=""'
            + ' onerror="this.parentNode.innerHTML=\'<span>' + esc(ini) + '</span>\'">'
          : '<span>' + esc(ini) + '</span>')
      + '</div>';
  }

  /* ── 모양 ─────────────────────────────────────────────────────
     ★ 파일 하나로 두려고 여기서 붓습니다. 색은 사이트가 쓰는
       변하는 값(var)을 그대로 쓰되, 없을 때를 대비해 뒷값을 둡니다. */
  function css() {
    if (document.getElementById('ocMsgCss')) return;
    var s = document.createElement('style');
    s.id = 'ocMsgCss';
    s.textContent = [
      '.ms-wrap{font-size:13.5px}',
      '.ms-msg{display:none;font-size:13px;line-height:1.7;padding:11px 14px;',
      ' border-radius:9px;margin-bottom:14px}',
      '.ms-msg.on{display:block}',
      '.ms-msg.ok{background:rgba(111,207,143,.10);border:1px solid rgba(111,207,143,.4);color:#2f7f4f}',
      '.ms-msg.no{background:rgba(224,133,133,.10);border:1px solid rgba(224,133,133,.4);color:#a34a4a}',

      /* 사람 목록 */
      '.ms-room{display:flex;align-items:center;gap:12px;padding:13px 14px;',
      ' border:1px solid var(--line,#e6e6ee);border-radius:11px;margin-bottom:9px;',
      ' cursor:pointer;background:var(--paper,#fff);transition:border-color .15s}',
      '.ms-room:hover{border-color:var(--violet-2,#5b4b9e)}',
      '.ms-room.new{background:var(--paper-2,#faf9fd)}',
      '.ms-ph{flex:0 0 auto;width:42px;height:42px;border-radius:50%;overflow:hidden;',
      ' background:var(--paper-2,#f2f0f7);display:flex;align-items:center;',
      ' justify-content:center;font-weight:800;color:var(--text-3,#8b87a0)}',
      '.ms-ph img{width:100%;height:100%;object-fit:cover}',
      '.ms-who{flex:1 1 auto;min-width:0}',
      '.ms-who .nm{font-weight:700;display:flex;align-items:center;gap:6px}',
      '.ms-who .nm em{font-style:normal;font-size:11px;font-weight:700;padding:2px 6px;',
      ' border-radius:5px;background:var(--paper-2,#f2f0f7);color:var(--text-3,#8b87a0)}',
      '.ms-who .last{font-size:12.5px;color:var(--text-3,#8b87a0);margin-top:3px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.ms-side{flex:0 0 auto;text-align:right;font-size:11.5px;color:var(--text-3,#8b87a0)}',
      '.ms-n{display:inline-block;min-width:19px;height:19px;line-height:19px;',
      ' padding:0 5px;border-radius:99px;background:#d0503f;color:#fff;',
      ' font-size:11px;font-weight:800;text-align:center;margin-top:5px}',
      '.ms-none{padding:26px 10px;text-align:center;font-size:13px;line-height:1.9;',
      ' color:var(--text-3,#8b87a0)}',

      /* 대화 */
      '.ms-top{display:flex;align-items:center;gap:10px;padding-bottom:13px;',
      ' margin-bottom:15px;border-bottom:1px solid var(--line,#e6e6ee)}',
      '.ms-back{flex:0 0 auto;height:32px;padding:0 11px;border-radius:8px;cursor:pointer;',
      ' border:1px solid var(--line,#e6e6ee);background:var(--paper,#fff);font-size:12.5px}',
      '.ms-back:hover{border-color:var(--violet-2,#5b4b9e);color:var(--violet-2,#5b4b9e)}',
      '.ms-top .ms-who .nm{font-size:14.5px}',
      '.ms-more{flex:0 0 auto;height:32px;padding:0 11px;border-radius:8px;cursor:pointer;',
      ' border:1px solid var(--line,#e6e6ee);background:var(--paper,#fff);font-size:12.5px}',
      '.ms-more:hover{border-color:#e08585;color:#e08585}',

      '.ms-list{max-height:52vh;overflow-y:auto;padding:2px 2px 6px}',
      '.ms-day{text-align:center;font-size:11.5px;color:var(--text-3,#8b87a0);margin:14px 0 10px}',
      '.ms-b{display:flex;margin-bottom:9px}',
      '.ms-b.me{justify-content:flex-end}',
      '.ms-bb{max-width:74%;padding:10px 13px;border-radius:13px;line-height:1.65;',
      ' font-size:13.5px;word-break:break-word;position:relative}',
      '.ms-b.you .ms-bb{background:var(--paper-2,#f2f0f7);border-bottom-left-radius:4px}',
      '.ms-b.me .ms-bb{background:var(--ink,#2b2740);color:#fff;border-bottom-right-radius:4px}',
      '.ms-t{font-size:10.5px;color:var(--text-3,#8b87a0);margin:0 7px;align-self:flex-end;',
      ' flex:0 0 auto;white-space:nowrap}',
      '.ms-x{position:absolute;top:-7px;right:-7px;width:19px;height:19px;border-radius:50%;',
      ' border:1px solid var(--line,#e6e6ee);background:var(--paper,#fff);color:var(--text-3,#8b87a0);',
      ' font-size:11px;line-height:1;cursor:pointer;display:none;padding:0}',
      '.ms-b:hover .ms-x{display:block}',

      '.ms-write{margin-top:14px;border:1px solid var(--line,#e6e6ee);border-radius:11px;',
      ' padding:10px 12px;background:var(--paper,#fff)}',
      '.ms-write textarea{width:100%;border:0;outline:0;resize:vertical;min-height:62px;',
      ' font:inherit;font-size:13.5px;line-height:1.65;background:transparent;color:inherit}',
      '.ms-wf{display:flex;align-items:center;justify-content:space-between;gap:10px;',
      ' margin-top:7px}',
      '.ms-cnt{font-size:11.5px;color:var(--text-3,#8b87a0)}',
      '.ms-go{height:34px;padding:0 16px;border-radius:8px;cursor:pointer;border:0;',
      ' background:var(--ink,#2b2740);color:#fff;font-weight:700;font-size:12.5px}',
      '.ms-go:hover{filter:brightness(1.14)}',
      '.ms-go[disabled]{opacity:.45;cursor:default;filter:none}',
      '.ms-shut{margin-top:14px;padding:14px;border-radius:11px;text-align:center;',
      ' font-size:12.5px;line-height:1.8;background:var(--paper-2,#faf9fd);',
      ' border:1px solid var(--line,#e6e6ee);color:var(--text-3,#8b87a0)}',
      '@media (max-width:700px){.ms-bb{max-width:84%}.ms-list{max-height:46vh}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── 지금 무엇을 보고 있나 ─────────────────────────────────── */
  var view = 'rooms';        /* rooms | thread */
  var cur  = null;           /* 대화 상대 { uid, name } */
  var timer = null;

  function el() { return document.getElementById('msgBody'); }

  function note(kind, text) {
    var m = document.getElementById('msgSay');
    if (!m) return;
    m.className = 'ms-msg on ' + kind;
    m.innerHTML = text;
    if (kind === 'ok') setTimeout(function () { m.className = 'ms-msg'; }, 3600);
  }

  /* ── 안 읽은 수 배지 ───────────────────────────────────────────
     ★ 탭을 열지 않아도 보여야 합니다. 마이페이지가 화면을 그릴 때
       한 번 부르고, 쪽지를 읽거나 보낼 때마다 다시 셉니다. */
  async function badge() {
    var r = await call('oc_msg_unread');
    var n = (r.data && r.data.n) || 0;
    var dots = document.querySelectorAll('[data-msg-badge]');
    for (var i = 0; i < dots.length; i++) {
      dots[i].textContent = n > 99 ? '99+' : String(n);
      dots[i].style.display = n > 0 ? '' : 'none';
    }
    return n;
  }

  /* ══════════════════════════════════════════════════════════════
     사람 목록
     ══════════════════════════════════════════════════════════════ */
  async function rooms() {
    var box = el();
    if (!box) return;
    view = 'rooms'; cur = null;

    var r = await call('oc_msg_rooms');
    if (r.error || !r.data || r.data.ok !== true) {
      box.innerHTML = '<div class="ms-wrap"><div class="ms-msg on no">'
        + '쪽지를 불러오지 못했습니다. 새로 고쳐 보십시오.</div></div>';
      return;
    }
    var list = r.data.rooms || [];

    box.innerHTML = '<div class="ms-wrap">'
      + '<div class="ms-msg" id="msgSay"></div>'
      + (list.length
          ? list.map(function (x) {
              return '<div class="ms-room' + (x.unread ? ' new' : '') + '"'
                + ' data-open="' + esc(x.uid) + '" data-name="' + esc(x.name || '') + '">'
                + photo(x)
                + '<div class="ms-who"><div class="nm">' + esc(x.name || '(이름 없음)')
                +   '<em>' + esc(TYPE[x.type] || x.type || '') + '</em>'
                +   (x.linked ? '' : '<em>이어짐 끊김</em>') + '</div>'
                + '<div class="last">' + (x.mine ? '나 : ' : '') + esc(x.last || '') + '</div></div>'
                + '<div class="ms-side">' + esc(when(x.at))
                + (x.unread ? '<br><span class="ms-n">' + x.unread + '</span>' : '')
                + '</div></div>';
            }).join('')
          : '<div class="ms-none">아직 주고받은 쪽지가 없습니다.<br>'
            + '<b>Linked 탭</b>에서 이어진 사람의 <b>「쪽지」</b> 를 누르면 시작됩니다.</div>')
      + '</div>';
    bind(box);
  }

  /* ══════════════════════════════════════════════════════════════
     한 사람과의 대화
     ══════════════════════════════════════════════════════════════ */
  async function thread(uid, name) {
    var box = el();
    if (!box) return;
    view = 'thread'; cur = { uid: uid, name: name || '' };

    var r = await call('oc_msg_thread', { p_with: uid });
    if (r.error || !r.data || r.data.ok !== true) {
      note('no', '대화를 불러오지 못했습니다.');
      return rooms();
    }
    var d = r.data, who = d.who || {}, msgs = d.msgs || [];
    cur.name = who.name || name || '';

    /* 날짜가 바뀌는 자리에 날짜를 한 줄 넣습니다 — 없으면 언제 것인지
       알 수 없습니다. */
    var last = '';
    var bubbles = msgs.map(function (m) {
      var day = '';
      try {
        var t = new Date(m.at).toDateString();
        if (t !== last) {
          last = t;
          var dd = new Date(m.at);
          day = '<div class="ms-day">' + dd.getFullYear() + '년 '
              + (dd.getMonth() + 1) + '월 ' + dd.getDate() + '일</div>';
        }
      } catch (e) {}
      return day
        + '<div class="ms-b ' + (m.mine ? 'me' : 'you') + '">'
        + (m.mine ? '<span class="ms-t">' + esc(when(m.at)) + '</span>' : '')
        + '<div class="ms-bb">' + body(m.body)
        +   '<button class="ms-x" data-hide="' + m.id + '" title="내 쪽에서만 지웁니다">×</button>'
        + '</div>'
        + (m.mine ? '' : '<span class="ms-t">' + esc(when(m.at)) + '</span>')
        + '</div>';
    }).join('');

    var canWrite = (d.linked === true) && (d.blocked !== true);

    box.innerHTML = '<div class="ms-wrap">'
      + '<div class="ms-msg" id="msgSay"></div>'
      + '<div class="ms-top">'
      +   '<button type="button" class="ms-back" data-back="1">← 목록</button>'
      +   photo(who)
      +   '<div class="ms-who"><div class="nm">' + esc(who.name || '(이름 없음)')
      +     '<em>' + esc(TYPE[who.type] || who.type || '') + '</em></div>'
      +     '<div class="last">' + esc([who.field, who.school].filter(Boolean).join(' · '))
      +     '</div></div>'
      +   '<button type="button" class="ms-more" data-report="' + esc(uid) + '">신고</button>'
      +   '<button type="button" class="ms-more" data-block="' + esc(uid) + '">차단</button>'
      + '</div>'
      + '<div class="ms-list" id="msgList">'
      +   (bubbles || '<div class="ms-none">아직 주고받은 것이 없습니다.<br>'
                     + '먼저 인사를 건네 보십시오.</div>')
      + '</div>'
      + (canWrite
          ? '<div class="ms-write">'
            + '<textarea id="msgTa" maxlength="' + MAX + '"'
            +   ' placeholder="쪽지를 적으십시오. (Ctrl+Enter 로 보내기)"></textarea>'
            + '<div class="ms-wf"><span class="ms-cnt"><b id="msgN">0</b> / ' + MAX + '자</span>'
            + '<button type="button" class="ms-go" id="msgGo">보내기</button></div>'
            + '</div>'
          : '<div class="ms-shut">'
            + (d.blocked
                ? '차단된 사이입니다. 쪽지를 주고받을 수 없습니다.<br>'
                  + '차단을 푸시려면 <b>마이페이지 → 차단한 회원</b> 에서 하실 수 있습니다.'
                : '이어짐이 끊겼습니다. <b>지난 쪽지는 남아 있지만</b> 새로 보낼 수는 없습니다.<br>'
                  + '다시 이어지면 그때부터 보낼 수 있습니다.')
            + '</div>')
      + '</div>';

    var lst = document.getElementById('msgList');
    if (lst) lst.scrollTop = lst.scrollHeight;   /* 맨 아래(가장 새것)부터 */
    bind(box);

    /* 읽음으로 표시 — 그린 뒤에 합니다. 먼저 하면 안 읽은 표시가
       화면에 한 번도 안 보이고 사라집니다. */
    if (msgs.some(function (m) { return !m.mine && !m.read; })) {
      await call('oc_msg_read', { p_with: uid });
      badge();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     누르는 것들
     ★ 한 번만 매답니다 — 다시 그릴 때마다 매면 한 번 누른 것이
       두 번 · 세 번 처리됩니다.
     ══════════════════════════════════════════════════════════════ */
  function bind(box) {
    var ta = document.getElementById('msgTa');
    var n  = document.getElementById('msgN');
    if (ta && n) {
      ta.addEventListener('input', function () { n.textContent = ta.value.length; });
      ta.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); }
      });
    }

    if (box.dataset.bound) return;
    box.dataset.bound = '1';

    box.addEventListener('click', async function (e) {
      var t = e.target;
      var room = t.closest && t.closest('[data-open]');
      var btn  = t.closest && t.closest('button');

      if (btn && btn.id === 'msgGo') { send(); return; }

      if (btn && btn.getAttribute('data-back')) { rooms(); return; }

      if (btn && btn.getAttribute('data-hide')) {
        e.stopPropagation();
        if (!confirm('이 쪽지를 내 목록에서만 지웁니다.\n\n'
          + '상대의 것은 그대로 남습니다. 진행할까요?')) return;
        var rh = await call('oc_msg_hide', { p_id: Number(btn.getAttribute('data-hide')) });
        if (rh.error || !rh.data || rh.data.ok !== true) return note('no', '지우지 못했습니다.');
        if (cur) thread(cur.uid, cur.name);
        return;
      }

      if (btn && btn.getAttribute('data-block')) {
        var uid = btn.getAttribute('data-block');
        if (!confirm('이 회원을 차단합니다.\n\n'
          + '· 이어짐이 끊어집니다\n'
          + '· 서로 쪽지를 주고받을 수 없습니다\n'
          + '· 상대는 30일 동안 다시 Linked 를 청할 수 없습니다\n\n'
          + '진행할까요?')) return;
        var rb = await call('oc_block_add', { p_uid: uid });
        if (rb.error || !rb.data || rb.data.ok !== true) return note('no', '차단하지 못했습니다.');
        await rooms();
        note('ok', '차단했습니다. 이어짐도 함께 끊었습니다.');
        return;
      }

      if (btn && btn.getAttribute('data-report')) {
        report(btn.getAttribute('data-report'));
        return;
      }

      if (room) {
        thread(room.getAttribute('data-open'), room.getAttribute('data-name'));
        return;
      }
    });
  }

  async function send() {
    var ta = document.getElementById('msgTa');
    var go = document.getElementById('msgGo');
    if (!ta || !cur) return;
    var txt = String(ta.value || '').trim();
    if (!txt) { note('no', '내용을 적어 주십시오.'); ta.focus(); return; }

    if (go) go.disabled = true;
    var r = await call('oc_msg_send', { p_to: cur.uid, p_body: txt });
    if (go) go.disabled = false;

    var d = (r && r.data) || {};
    if (r.error || d.ok !== true) { note('no', say(d)); return; }

    ta.value = '';
    var n = document.getElementById('msgN');
    if (n) n.textContent = '0';
    await thread(cur.uid, cur.name);
  }

  /* ── 신고 ─────────────────────────────────────────────────────
     ★ 이미 있는 oc_report_add 를 씁니다 — 관리자 화면
       (admin/reports.html)이 그 표를 보고 있으므로 새로 만들면
       파트너가 볼 곳이 두 군데가 됩니다.
     ★ p_kind 는 <b>'other'</b> 로 보냅니다. 그 함수가 어떤 값을
       받아 주는지 아직 확인하지 못했고, 'other' 는 확실히 있는
       값입니다. 고른 까닭은 글 맨 앞에 함께 적습니다. */
  async function report(uid) {
    var why = prompt('무엇이 문제인지 골라 번호를 적어 주십시오.\n\n'
      + '1. 광고 · 스팸\n'
      + '2. 괴롭힘 · 욕설\n'
      + '3. 사기 의심\n'
      + '4. 그 밖\n', '2');
    if (why === null) return;
    var label = ({ '1':'광고·스팸', '2':'괴롭힘·욕설', '3':'사기 의심' })[String(why).trim()]
                || '그 밖';

    var txt = prompt('어떤 일이 있었는지 적어 주십시오. (다섯 자 이상)\n'
      + '관리자만 봅니다.', '');
    if (txt === null) return;
    txt = String(txt).trim();
    if (txt.length < 5) return note('no', '다섯 글자 이상 적어 주십시오.');

    var r = await call('oc_report_add', {
      p_table: 'member_messages',
      p_id   : null,
      p_title: '쪽지 신고 · ' + ((cur && cur.name) || ''),
      p_url  : location.href.slice(0, 500),
      p_kind : 'other',
      p_body : '[' + label + '] 상대 : ' + uid + '\n' + txt
    });
    if (r.error) {
      note('no', '신고를 접수하지 못했습니다. <b>고객센터</b>로 알려 주십시오.'
        + '<br><span style="font-size:11.5px">' + esc(r.msg || '') + '</span>');
      return;
    }
    note('ok', '신고했습니다. 관리자가 확인합니다. 차단도 함께 하시려면'
      + ' 위의 <b>차단</b> 을 누르십시오.');
  }

  /* ── 새로 온 것 다시 보기 ─────────────────────────────────────
     ★ 이 탭을 보고 있을 때만입니다. 다른 탭이거나 창이 가려져 있으면
       묻지 않습니다 — 안 보는 화면을 45초마다 새로 받을 까닭이 없습니다. */
  function tick() {
    if (timer) return;
    timer = setInterval(function () {
      var box = el();
      if (!box || document.visibilityState !== 'visible') return;
      var pane = box.closest && box.closest('.mp-pane');
      if (pane && !pane.classList.contains('on')) { badge(); return; }
      if (view === 'thread' && cur) thread(cur.uid, cur.name);
      else if (view === 'rooms') rooms();
    }, TICK);
  }

  /* ── 밖으로 ───────────────────────────────────────────────── */
  window.OCMsg = {
    init: function () { css(); rooms(); badge(); tick(); },
    open: function (uid, name) { css(); thread(uid, name); badge(); tick(); },
    badge: badge
  };
})();
