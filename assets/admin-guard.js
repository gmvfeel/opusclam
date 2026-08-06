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

  /* ── 화면 표시를 살아있게 ────────────────────────────────────
     el     : 「누구로 들어와 있나」를 적는 자리
     opt.on : 살아 있을 때 부를 것 (me 를 받습니다)
     opt.off: 풀렸을 때 부를 것 (msg 를 받습니다)
     ★ 몇 분마다 다시 봅니다. 그리고 <b>탭으로 돌아올 때</b>도 봅니다 —
       오래 다른 일을 하다 돌아오는 그때가 가장 위험합니다. */
  function watch(sb, el, opt) {
    opt = opt || {};
    var every = (opt.everyMin || 5) * 60 * 1000;

    function paint(r) {
      if (el) {
        el.innerHTML = r.ok
          ? '<b>' + esc(r.me.name || '-') + '</b> · 관리자'
          : '★ <b>' + esc(r.msg) + '</b> '
            + '<a href="/account/login.html?next=' + encodeURIComponent(location.pathname)
            + '" style="color:#e08a3c">다시 로그인 &#8594;</a>';
      }
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
    check: check, watch: watch, isAuthLost: isAuthLost, sane: sane
  };
})();
