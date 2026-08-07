/* ══════════════════════════════════════════════════════════════
   SHOPPING 입점 문의 폼 — assets/shop-apply.js
   2026-08-06

   무엇을 하나
     OCShopApply.form()   입점 문의를 받아 shop_inquiries 에 담습니다.

   ★ 비회원도 보낼 수 있습니다 — 문의하려고 회원가입부터 하라고 하면
     문의가 줄어듭니다. 그래서 로그인을 묻지 않습니다.
     대신 <b>넣기만</b> 됩니다(읽는 것은 관리자만).

   ★ 스팸을 줄이는 두 가지
     ① <b>숨은 칸</b>(허니팟) — 사람 눈에는 안 보이는 칸입니다.
        자동 프로그램은 칸이 있으면 채우고, 사람은 채울 수 없습니다.
        채워져 오면 <b>보낸 척만</b> 하고 저장하지 않습니다
        (「막혔습니다」라고 알려 주면 다음번엔 그 칸을 비워 옵니다).
     ② <b>너무 빠른 제출</b> — 화면을 연 지 3초도 안 되어 보내는 것은
        사람이 아닙니다. 같은 방식으로 조용히 흘립니다.
   ★ 로그인한 회원이면 이름·메일을 <b>미리 채워</b> 둡니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCShopApply) return;

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  function esc(v) { var d = document.createElement('div'); d.textContent = (v == null ? '' : String(v)); return d.innerHTML; }
  function $(id) { return document.getElementById(id); }

  var _sb = null;
  function sb() {
    if (window.__ocSb) return window.__ocSb;
    if (_sb) return _sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    _sb = window.supabase.createClient(SB_URL, SB_KEY);
    window.__ocSb = _sb;
    return _sb;
  }

  var OPENED = Date.now();

  function form() {
    var box = $('saForm');
    if (!box) return;

    /* 로그인해 있으면 이름·메일을 미리 채웁니다 (없으면 그냥 넘어갑니다) */
    var c = sb();
    if (c) {
      c.auth.getUser().then(function (r) {
        var u = r && r.data && r.data.user;
        if (!u) return;
        return c.from('members').select('name,email,phone').eq('id', u.id).maybeSingle()
          .then(function (mr) {
            var m = (mr && mr.data) || {};
            if (m.name  && $('saPerson') && !$('saPerson').value) $('saPerson').value = m.name;
            if (m.email && $('saEmail')  && !$('saEmail').value)  $('saEmail').value  = m.email;
            if (m.phone && $('saPhone')  && !$('saPhone').value)  $('saPhone').value  = m.phone;
          });
      })['catch'](function () {});
    }

    var btn = $('saSend');
    if (btn) btn.addEventListener('click', function () { send(this); });

    /* 글자 수 세기 */
    var msg = $('saMsg'), cnt = $('saMsgN');
    if (msg && cnt) msg.addEventListener('input', function () { cnt.textContent = msg.value.length; });
  }

  function say(kind, html) {
    var e = $('saSay');
    if (e) e.innerHTML = html ? '<div class="sa-say ' + kind + '">' + html + '</div>' : '';
  }

  function send(btn) {
    var v = function (id) { var e = $(id); return e ? String(e.value || '').trim() : ''; };

    var company = v('saCompany'), person = v('saPerson'), email = v('saEmail');
    var phone = v('saPhone'), site = v('saSiteUrl'), cat = v('saCategory'), message = v('saMsg');

    /* ── 꼭 있어야 하는 것 ─────────────────────────────────── */
    if (!company) { say('no', '<b>업체·상호</b>를 적어 주십시오.'); focus('saCompany'); return; }
    if (!person)  { say('no', '<b>담당자 이름</b>을 적어 주십시오.'); focus('saPerson'); return; }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      say('no', '<b>메일 주소</b>를 다시 살펴봐 주십시오. 답을 드릴 곳입니다.');
      focus('saEmail'); return;
    }
    if (!phone && !site) {
      say('no', '<b>연락처</b>나 <b>쇼핑몰 주소</b> 가운데 하나는 적어 주십시오.');
      focus('saPhone'); return;
    }

    /* ── 스팸 걸러내기 ─────────────────────────────────────
       ★ 「막혔습니다」라고 알려 주지 않습니다 — 알려 주면 다음번엔
         그 칸을 비워서 다시 옵니다. <b>보낸 척</b>만 합니다. */
    var trap = $('saTrap');
    var tooFast = (Date.now() - OPENED) < 3000;
    if ((trap && trap.value) || tooFast) {
      done();
      return;
    }

    var c = sb();
    if (!c) { say('no', '연결이 되지 않았습니다. 잠시 뒤 다시 시도해 주십시오.'); return; }

    var old = btn.textContent;
    btn.disabled = true; btn.textContent = '보내는 중…';
    say('', '');

    /* 쇼핑몰 주소에 http 가 없으면 붙여 줍니다 — 링크로 쓸 것이므로 */
    var url = site;
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    c.from('shop_inquiries').insert({
      company: company, person: person, email: email,
      phone: phone || null, site_url: url || null,
      category: cat || null, message: message || null,
      status: 'new'
    }).select('id').then(function (r) {
      /* ★ 몇 줄이 들어갔는지 <b>받아서</b> 확인합니다 —
         줄 보안에 막히면 오류 없이 0줄이 됩니다. */
      if (r.error) throw new Error(r.error.message);
      if (!(r.data || []).length) throw new Error('보내지 못했습니다. 잠시 뒤 다시 시도해 주십시오.');
      done();
    })['catch'](function (e) {
      btn.disabled = false; btn.textContent = old;
      var m = String(e.message || e);
      if (/check|constraint/i.test(m)) m = '적어 주신 내용이 너무 깁니다. 줄여서 다시 보내 주십시오.';
      else if (/row-level|policy/i.test(m)) m = '보내지 못했습니다. 메일로 보내 주시면 확인하겠습니다.';
      say('no', esc(m) + '<br>급하시면 <a href="mailto:cser@wixon.co.kr">cser@wixon.co.kr</a> 로 보내 주십시오.');
    });
  }

  function focus(id) { var e = $(id); if (e) { try { e.focus(); } catch (x) {} } }

  /* 보낸 뒤 — 폼을 감추고 고맙다는 말을 둡니다.
     ★ 폼을 그대로 두면 「보내졌나?」 하고 다시 누르게 됩니다. */
  function done() {
    var wrap = $('saForm');
    if (!wrap) return;
    wrap.innerHTML =
        '<div class="sa-done">'
      +   '<div class="sa-done-i" aria-hidden="true">&#10003;</div>'
      +   '<h3>문의를 받았습니다</h3>'
      +   '<p>적어 주신 메일로 <b>영업일 기준 2~3일 안에</b> 답을 드리겠습니다.<br>'
      +     '초기 입점 혜택과 노출 자리를 함께 안내해 드립니다.</p>'
      +   '<p class="sa-done-sub">답이 늦으면 <a href="mailto:cser@wixon.co.kr">cser@wixon.co.kr</a> 로 '
      +     '다시 알려 주십시오. 메일이 스팸함에 들어가는 일이 있습니다.</p>'
      + '</div>';
    try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  window.OCShopApply = { form: form };
})();
