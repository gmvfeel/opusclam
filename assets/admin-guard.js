/* ══════════════════════════════════════════════════════════════
   관리자 화면 로그인 지킴이 — assets/admin-guard.js
   2026-08-06

   왜 만들었나 (2026-08-06 · 파트너가 겪은 일)
     악보 담기 화면에서 <b>106건이 모두 실패</b>했습니다. 까닭은
     로그인 토큰이 <b>만료</b>된 것이었는데, 화면 오른쪽 위에는
     「슈퍼바이저 · 관리자」가 <b>그대로</b> 남아 있었습니다 —
     처음 한 번 확인한 결과를 그냥 띄워 둔 것이었습니다.

     그래서 파트너 눈에는 로그인된 것처럼 보이는데 서버는
     「누구세요?」 하는 상태였습니다. 게다가 「이미 담긴 것」을 읽는
     조회도 막혀 <b>0건</b>이 왔고, 화면은 「다 새 악보구나」 하고
     판단해 <b>이미 담긴 것까지</b> 다시 담으려 했습니다.

     원인보다 <b>그것을 알 수 없었던 것</b>이 더 문제였습니다.
     관리자 화면은 오래 열어 두고 쓰므로 이 일은 또 일어납니다.

   무엇을 하나
     OCAdminGuard.check(sb)        지금 로그인이 <b>살아 있는지</b> 서버에
                                   물어봅니다. 만료가 가까우면 되살려 봅니다.
     OCAdminGuard.watch(sb, el)    화면 표시를 <b>살아있게</b> 지켜봅니다.
     OCAdminGuard.isAuthLost(msg)  오류가 「로그인 풀림」 때문인지 알아봅니다.
     OCAdminGuard.sane(sb, opt)    <b>읽기가 막혔는지</b> 알아봅니다
                                   (있어야 할 자료가 0건으로 오는 경우)

   ★ 화면을 고치지 않습니다 — 판단만 돌려줍니다. 무엇을 보여 줄지는
     각 화면이 정합니다(화면마다 알릴 자리가 다릅니다).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCAdminGuard) return;

  /* 만료까지 이만큼 남았으면 <b>미리</b> 되살립니다 (2분) —
     담기처럼 오래 걸리는 일 중간에 만료되면 그것도 실패합니다. */
  var SOON_MS = 2 * 60 * 1000;

  /* ── 지금 로그인이 살아 있나 · 관리자인가 ─────────────────────
     돌려주는 것
       { ok:true,  me:{id,name,is_admin} }
       { ok:false, why:'no-session' | 'expired' | 'not-admin' | 'error',
         msg:'사람이 읽을 안내' }
     ★ <b>서버에 물어봅니다</b>(getUser) — 브라우저에 담긴 토큰만 보면
       만료된 것을 「살아 있다」고 착각합니다. */
  function check(sb) {
    if (!sb) return Promise.resolve({ ok: false, why: 'error', msg: '접속 객체가 없습니다.' });

    return sb.auth.getSession().then(function (r) {
      var ses = r && r.data && r.data.session;
      if (!ses) {
        return { ok: false, why: 'no-session',
                 msg: '로그인하지 않았습니다.' };
      }

      /* 만료됐거나 곧 만료되면 되살려 봅니다 */
      var msLeft = (ses.expires_at ? ses.expires_at * 1000 : 0) - Date.now();
      if (msLeft < SOON_MS) {
        return sb.auth.refreshSession().then(function (rr) {
          if (rr.error || !(rr.data && rr.data.session)) {
            return { ok: false, why: 'expired',
                     msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
          }
          return afterSession(sb);
        })['catch'](function () {
          return { ok: false, why: 'expired',
                   msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
        });
      }
      return afterSession(sb);
    })['catch'](function (e) {
      return { ok: false, why: 'error', msg: '로그인 확인에 실패했습니다 — ' + (e.message || e) };
    });
  }

  /* 서버가 나를 누구로 보나 + 관리자인가 */
  function afterSession(sb) {
    return sb.auth.getUser().then(function (u) {
      var user = u && u.data && u.data.user;
      if (u.error || !user) {
        return { ok: false, why: 'expired',
                 msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
      }
      return sb.from('members').select('id,name,is_admin').eq('id', user.id).maybeSingle()
        .then(function (m) {
          /* ★ 여기서 0건이 오는 것도 <b>로그인 풀림</b>입니다 —
             members 는 「내 것만」 읽히므로, 서버가 나를 모르면 0건입니다.
             예전에는 이때 이름만 없는 빈 객체를 만들어 넘어갔습니다. */
          if (m.error || !m.data) {
            return { ok: false, why: 'expired',
                     msg: '로그인이 풀렸습니다. 다시 로그인해 주십시오.' };
          }
          if (m.data.is_admin !== true) {
            return { ok: false, why: 'not-admin', msg: '관리자만 쓸 수 있습니다.' };
          }
          return { ok: true, me: m.data };
        });
    })['catch'](function (e) {
      return { ok: false, why: 'error', msg: '로그인 확인에 실패했습니다 — ' + (e.message || e) };
    });
  }

  /* ── 오류가 「로그인 풀림」 때문인가 ─────────────────────────
     줄 보안에 막히면 서버는 이렇게 말합니다.
       new row violates row-level security policy for table "spot"
     사람에게 이대로 보여 주면 무엇을 해야 할지 알 수 없습니다. */
  function isAuthLost(msg) {
    var m = String(msg || '').toLowerCase();
    return /row-level security|jwt|token|unauthorized|not authenticated|permission denied/.test(m);
  }

  /* ── 읽기가 막혔나 ───────────────────────────────────────────
     ★ 있어야 할 자료가 <b>0건</b>으로 오면 「없다」가 아니라
       「못 읽는다」일 수 있습니다. 그것을 모르고 넘어가면 이미 있는
       것을 또 담게 됩니다(파트너가 겪은 일).
     쓰는 법
       OCAdminGuard.sane(sb, { table:'spot', where:{ section:'악보' }, got: 0 })
         → { ok:true }                     정말 없는 것입니다
         → { ok:false, count:873, msg:… }  ★읽기가 막혀 있습니다★ */
  function sane(sb, opt) {
    opt = opt || {};
    if (opt.got > 0) return Promise.resolve({ ok: true });
    var q = sb.from(opt.table).select('id', { count: 'exact', head: true });
    Object.keys(opt.where || {}).forEach(function (k) { q = q.eq(k, opt.where[k]); });
    return q.then(function (r) {
      if (r.error) {
        return { ok: false, count: null,
                 msg: '자료를 세어 보지 못했습니다 — ' + r.error.message };
      }
      var n = r.count || 0;
      if (n > 0) {
        return { ok: false, count: n,
                 msg: '있어야 할 자료 ' + n + '건이 <b>하나도 읽히지 않았습니다</b>. '
                    + '로그인이 풀렸거나 권한에 막힌 것입니다. '
                    + '이 상태로 담으면 <b>이미 있는 것을 또 담게 됩니다.</b>' };
      }
      return { ok: true, count: 0 };
    })['catch'](function (e) {
      return { ok: false, count: null, msg: '확인 실패 — ' + (e.message || e) };
    });
  }

  /* ── 화면 맨 위 경고 띠 ──────────────────────────────────────
     ★ 왜 띠까지 두나 (2026-08-06 · 파트너 지적)
       처음에는 화면의 「누구로 들어와 있나」 자리만 바꾸었습니다.
       그런데 그 자리는 <b>작은 글씨로 조작 줄에 섞여</b> 있어서,
       파트너가 「그게 어디 있지?」 하고 찾지 못했습니다.
       바뀌어도 못 보면 없는 것과 같습니다.
     ★ 그래서 화면 <b>맨 위에 고정</b>되는 띠를 띄웁니다. 스크롤해도
       따라오고, 되살아나면 스스로 사라집니다.
     ★ 짜임을 여기서 만들어 넣습니다 — 관리자 화면마다 CSS 를 손보게
       하면 붙이기가 번거롭고, 어느 화면은 빠뜨립니다. */
  var BAR_ID = 'ocAuthBar';

  function bar(msg) {
    var el = document.getElementById(BAR_ID);
    if (!msg) { if (el) el.remove(); return; }

    if (!document.getElementById('ocAuthBarCss')) {
      var st = document.createElement('style');
      st.id = 'ocAuthBarCss';
      st.textContent =
          '#' + BAR_ID + '{position:fixed;top:0;left:0;right:0;z-index:99999;'
        + 'padding:13px 18px;background:#8a2f2f;color:#fff;'
        + 'font-size:14px;font-weight:700;line-height:1.6;text-align:center;'
        + 'box-shadow:0 4px 18px rgba(0,0,0,.4);}'
        + '#' + BAR_ID + ' a{color:#ffd9a8;text-decoration:underline;margin-left:10px;}'
        + '#' + BAR_ID + ' .x{position:absolute;right:12px;top:9px;width:30px;height:30px;'
        + 'border:0;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;'
        + 'font-size:15px;line-height:1;cursor:pointer;}'
        + 'body{transition:padding-top .15s ease;}';
      document.head.appendChild(st);
    }

    if (!el) {
      el = document.createElement('div');
      el.id = BAR_ID;
      document.body.appendChild(el);
    }
    el.innerHTML = '★ ' + msg
      + '<a href="/account/login.html?next=' + encodeURIComponent(location.pathname) + '">다시 로그인 &#8594;</a>'
      + '<button type="button" class="x" aria-label="닫기">&#10005;</button>';
    var x = el.querySelector('.x');
    if (x) x.addEventListener('click', function () { el.remove(); });
  }

  /* ── 화면 표시를 살아있게 ────────────────────────────────────
     el     : 「누구로 들어와 있나」를 적는 자리
     opt.on : 살아 있을 때 부를 것 (me 를 받습니다)
     opt.off: 풀렸을 때 부를 것 (msg 를 받습니다)
     ★ 몇 분마다 다시 봅니다. 그리고 <b>탭으로 돌아올 때</b>도 봅니다 —
       오래 다른 일을 하다 돌아오는 그때가 가장 위험합니다.
     ★ 풀리면 <b>화면 맨 위에 띠</b>도 띄웁니다(위 bar 참고). */
  function watch(sb, el, opt) {
    opt = opt || {};
    /* ★ 화면이 <b>직접</b> 불렀다는 표시 — 아래 자동 모드가 비켜섭니다.
       두 번 지켜보면 조회가 두 배가 되고, 띠도 두 번 그려집니다. */
    window.__ocAdminGuardOn = true;
    var every = (opt.everyMin || 5) * 60 * 1000;

    function paint(r) {
      if (el) {
        el.innerHTML = r.ok
          ? '<b>' + esc(r.me.name || '-') + '</b> · 관리자'
          : '★ <b>' + esc(r.msg) + '</b> '
            + '<a href="/account/login.html?next=' + encodeURIComponent(location.pathname)
            + '" style="color:#e08a3c">다시 로그인 &#8594;</a>';
      }
      /* 관리자가 아닌 것(not-admin)은 띠까지 띄우지 않습니다 —
         애초에 들어올 자리가 아니므로 화면 안내로 충분합니다.
         띠는 <b>되던 일이 갑자기 안 되는</b> 경우를 위한 것입니다. */
      if (r.ok) bar(null);
      else if (r.why === 'expired' || r.why === 'no-session') bar(esc(r.msg));

      if (r.ok) { if (opt.on) opt.on(r.me); }
      else { if (opt.off) opt.off(r.msg, r.why); }
    }

    function tick() { check(sb).then(paint); }

    tick();
    setInterval(tick, every);
    /* 다른 탭에 갔다 돌아오면 곧바로 다시 봅니다 */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
    return { refresh: tick };
  }

  function esc(v) {
    var d = document.createElement('div');
    d.textContent = (v == null ? '' : String(v));
    return d.innerHTML;
  }

  window.OCAdminGuard = {
    check: check, watch: watch, isAuthLost: isAuthLost, sane: sane, bar: bar
  };

  /* ══ 스스로 붙습니다 (자동) ═══════════════════════════════════
     ★ 왜 이렇게 하나
       관리자 화면이 열세 개인데 로그인 확인 방식이 <b>제각각</b>이었습니다.
         · 「누구로 들어와 있나」 자리가 있는 화면 넷 (id="who")
         · 자리가 없는 화면 여덟
         · <b>관리자 확인이 아예 없는</b> 화면 셋
       열세 곳을 하나씩 손보면 반드시 몇 곳을 빠뜨립니다. 그래서
       <b>이 파일만 실으면</b> 저절로 지켜보게 만듭니다.
       ▶ 각 화면이 할 일: &lt;script src="/assets/admin-guard.js"&gt; 한 줄

     ★ 단추를 잠그는 것까지 하고 싶으면 화면이 <b>직접</b> watch 를
       부르면 됩니다(악보 담기 화면이 그렇게 합니다). 그때는 자동이
       비켜섭니다 — 두 번 지켜보면 조회가 두 배가 됩니다.

     ★ 접속 객체를 찾는 순서
       ① window.__ocSb — 화면이 이미 만들어 둔 것
       ② 없으면 우리가 만듭니다 — 세션은 브라우저에 담겨 있으므로
         새로 만들어도 <b>같은 로그인</b>을 봅니다.
     ★ /admin/ 밖에서는 아무 일도 하지 않습니다. */
  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  function autoStart() {
    if (window.__ocAdminGuardOn) return;             /* 화면이 직접 부른 경우 */
    /* ★ 언어를 떼고 봅니다 (2026-08-10) — /en/admin/… 으로 들어와도
       「어드민 화면이 아니다」 로 새어 나가면 안 됩니다. */
    if ((window.ocPath || String)(location.pathname).indexOf('/admin/') !== 0) return;

    var n = 0;
    (function tick() {
      /* 접속 객체가 생길 때까지 잠깐 기다립니다 (최대 3초) */
      var c = window.__ocSb;
      if (!c && window.supabase && window.supabase.createClient) {
        try { c = window.supabase.createClient(SB_URL, SB_KEY); } catch (e) {}
      }
      if (!c) {
        if (++n > 60) return;                        /* 못 찾으면 조용히 물러납니다 */
        return setTimeout(tick, 50);
      }
      if (window.__ocAdminGuardOn) return;           /* 그 사이에 화면이 불렀으면 비켜섭니다 */
      window.__ocAdminGuardOn = true;
      watch(c, document.getElementById('who'), { everyMin: 5 });
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart);
  } else {
    autoStart();
  }
})();
