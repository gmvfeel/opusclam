/* ============================================================
   OPUSCLAM 유료 등재 신청 — assets/paid-apply.js
   ------------------------------------------------------------
   콩쿠르 공고를 목록 맨 위에 올려 드리는 유료 자리의 신청 화면입니다.

   ★ 요금표를 화면에 적지 않았습니다.
     가격 · 일수 · 혜택 문구는 모두 DB(oc_paid_plans)에서 읽어 그립니다.
     가격을 바꾸실 때 이 파일도, 화면도 고칠 필요가 없습니다.
     SQL 한 줄이면 됩니다.

        update oc_paid_plans set price = 44000 where code = 'basic';

   ★ 로그인하지 않아도 신청할 수 있습니다.
     콩쿠르 주최측에 회원가입부터 시키면 신청이 끊깁니다.
     신고 통로(report.js)와 같은 판단입니다.

   ★ 연락처는 spot 에 넣지 않습니다.
     게시판 엔진이 spot 을 select=* 로 읽어서 비회원에게도 다 보입니다.
     신청 내용은 oc_paid_apps 에만 들어가고 관리자만 읽습니다.
   ============================================================ */
window.OCPaid = (function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var HDR = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function won(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('ko-KR') + '원';
  }
  function $(id) { return document.getElementById(id); }

  /* ── 로그인 토큰 찾기 ─────────────────────────────────────
     supabase-js 가 localStorage 에 넣어 둔 것을 읽습니다.
     ★ 없어도 됩니다 — 손님으로 신청할 수 있습니다. */
  var REF = 'ptdxzxkgddvkusamkiol';
  function token() {
    try {
      var raw = localStorage.getItem('sb-' + REF + '-auth-token');
      if (!raw) return null;
      var j = JSON.parse(raw);
      return (j && j.access_token) ? j.access_token : null;
    } catch (e) { return null; }
  }

  /* ★ PostgREST 는 한 번에 200줄까지만 줍니다.
     콩쿨은 지금 39건이지만 늘어날 것이므로 처음부터 나눠 받습니다.
     끝냄은 「0줄이 왔을 때」이고, offset 은 「실제로 받은 수」만큼 늘립니다.
     받은 수가 요청보다 적을 때 끝내면 첫 쪽에서 멈춰 버립니다. */
  function getAll(path) {
    var out = [], off = 0, LIM = 200;
    function step() {
      return fetch(SB_URL + '/rest/v1/' + path + '&limit=' + LIM + '&offset=' + off, { headers: HDR })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          if (!Array.isArray(rows) || rows.length === 0) return out;
          out = out.concat(rows);
          off += rows.length;
          if (rows.length < LIM) return out;
          return step();
        });
    }
    return step();
  }

  /* ── 요금 카드 ───────────────────────────────────────── */
  function planCard(p, i) {
    var perks = (p.perks || '').split('·').map(function (t) { return t.trim(); })
                  .filter(Boolean);
    return '<label class="pf-plan' + (i === 0 ? ' on' : '') + '" data-code="' + esc(p.code) + '">'
      + '<input type="radio" name="pfPlan" value="' + esc(p.code) + '"' + (i === 0 ? ' checked' : '') + '>'
      + '<span class="pf-plan-head">'
      +   '<b class="pf-plan-name">' + esc(p.name_ko) + '</b>'
      +   '<span class="pf-plan-badge board-tag board-paid" data-plan="' + esc(p.code) + '">'
      +     esc(p.badge_ko || '') + '</span>'
      + '</span>'
      + '<span class="pf-plan-price">' + won(p.price) + '</span>'
      + '<span class="pf-plan-days">' + (p.days || 0) + '일 게재</span>'
      + '<ul class="pf-plan-perks">'
      +   perks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('')
      + '</ul>'
      + '</label>';
  }

  function loadPlans(box) {
    if (!box) return Promise.resolve();
    return fetch(SB_URL + '/rest/v1/oc_paid_plans?select=*&active=is.true&order=sort_order.asc', { headers: HDR })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (!rows || !rows.length) {
          box.innerHTML = '<p class="pf-empty">요금표를 불러오지 못했습니다. 아래 메일로 문의해 주십시오.</p>';
          return;
        }
        box.innerHTML = rows.map(planCard).join('');
        box.addEventListener('change', function () {
          Array.prototype.forEach.call(box.querySelectorAll('.pf-plan'), function (el) {
            var r = el.querySelector('input');
            el.classList.toggle('on', !!(r && r.checked));
          });
        });
      })
      .catch(function () {
        box.innerHTML = '<p class="pf-empty">요금표를 불러오지 못했습니다.</p>';
      });
  }

  /* ── 이미 올라와 있는 공고 고르기 ────────────────────── */
  function loadSpots(sel) {
    if (!sel) return Promise.resolve();
    var path = 'spot?select=id,title,organizer'
             + '&section=eq.' + encodeURIComponent('콩쿨')
             + '&hidden=not.is.true'
             + '&order=title.asc,id.asc';
    return getAll(path).then(function (rows) {
      var opts = '<option value="">아직 올리지 않았습니다 (새로 등재를 원합니다)</option>';
      (rows || []).forEach(function (r) {
        var t = r.title || '';
        if (r.organizer) t += ' · ' + r.organizer;
        opts += '<option value="' + esc(r.id) + '">' + esc(t) + '</option>';
      });
      sel.innerHTML = opts;
    }).catch(function () {
      sel.innerHTML = '<option value="">공고 목록을 불러오지 못했습니다</option>';
    });
  }

  /* ── 보내기 ──────────────────────────────────────────── */
  function submit(btn, msg) {
    var planEl = document.querySelector('input[name="pfPlan"]:checked');
    var body = {
      p: {
        plan_code: planEl ? planEl.value : '',
        spot_id:   ($('pfSpot')  || {}).value || '',
        title:     (($('pfTitle') || {}).value || '').trim(),
        applicant: (($('pfWho')   || {}).value || '').trim(),
        org_name:  (($('pfOrg')   || {}).value || '').trim(),
        email:     (($('pfMail')  || {}).value || '').trim(),
        phone:     (($('pfTel')   || {}).value || '').trim(),
        biz_no:    (($('pfBiz')   || {}).value || '').trim(),
        memo:      (($('pfMemo')  || {}).value || '').trim()
      }
    };

    /* 고른 공고가 있으면 대회 이름을 자동으로 채워 줍니다 */
    if (body.p.spot_id && !body.p.title) {
      var s = $('pfSpot');
      if (s && s.selectedIndex > 0) body.p.title = s.options[s.selectedIndex].text;
    }

    function say(t, ok) {
      if (!msg) return;
      msg.textContent = t;
      msg.className = 'pf-msg' + (ok ? ' ok' : ' err');
    }

    if (!body.p.plan_code) { say('요금제를 골라 주십시오.', false); return; }
    if (!body.p.title || body.p.title.length < 2) { say('대회 이름을 적어 주십시오.', false); return; }
    if (!body.p.applicant || body.p.applicant.length < 2) { say('담당자 이름을 적어 주십시오.', false); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.p.email)) { say('이메일 주소를 다시 확인해 주십시오.', false); return; }

    if (btn) { btn.disabled = true; btn.textContent = '보내는 중…'; }
    say('보내는 중입니다…', true);

    /* 로그인한 분이면 그 자격으로 보냅니다 (누가 신청했는지 남습니다).
       로그인하지 않았으면 공개 열쇠로 보냅니다 — 그래도 접수됩니다.
       ★ 토큰 읽는 방식은 assets/report.js 에서 검증된 것을 그대로 씁니다. */
    var h = Object.assign({ 'Content-Type': 'application/json' }, HDR);
    var tk = token();
    if (tk) h.Authorization = 'Bearer ' + tk;

    fetch(SB_URL + '/rest/v1/rpc/oc_paid_apply', {
      method: 'POST', headers: h, body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.text().then(function (t) {
          if (!r.ok) {
            var m = t;
            try { m = (JSON.parse(t).message) || t; } catch (e) {}
            throw new Error(m);
          }
          return t;
        });
      })
      .then(function () {
        var form = $('pfForm');
        if (form) {
          form.innerHTML = '<div class="pf-done">'
            + '<b>신청이 접수되었습니다.</b>'
            + '<p>입금 안내를 적어 주신 메일로 보내 드립니다. 보통 1~2일 안에 회신드립니다.</p>'
            + '<p class="pf-done-s">메일이 보이지 않으면 스팸함도 살펴봐 주십시오.</p>'
            + '</div>';
        }
        say('', true);
      })
      .catch(function (e) {
        say(String(e.message || e), false);
        if (btn) { btn.disabled = false; btn.textContent = '신청 보내기'; }
      });
  }

  return {
    form: function () {
      loadPlans($('pfPlans'));
      loadSpots($('pfSpot'));

      /* 공고를 고르면 대회 이름 칸을 채우고 잠급니다 (오타 방지) */
      var sel = $('pfSpot'), tt = $('pfTitle');
      if (sel && tt) {
        sel.addEventListener('change', function () {
          if (sel.value && sel.selectedIndex > 0) {
            tt.value = sel.options[sel.selectedIndex].text.split(' · ')[0];
            tt.readOnly = true;
          } else {
            tt.readOnly = false;
          }
        });
      }

      var btn = $('pfSend'), msg = $('pfMsg');
      if (btn) btn.addEventListener('click', function () { submit(btn, msg); });
    }
  };
})();
