/* ════════════════════════════════════════════════════════════════
   OPUSCLAM — 「이 항목이 저(저희)입니다」 잇기 공용 엔진
   2026-08-11
   ────────────────────────────────────────────────────────────────

   ★ 무엇을 푸는가 (파트너 물음 · 2026-08-11)
     기관·재단DB 에 크레디아를 이미 담아 두었는데, 크레디아 관계자가
     단체 회원으로 가입하면 <b>같은 크레디아가 두 벌</b>이 됩니다.
     인물 15,250명 · 단체 · 공연장 · 학교 — 일곱 갈래 모두 그렇습니다.

   ★ 어떻게 푸는가
     이미 있는 항목을 지우지도 새로 만들지도 않습니다.
     <b>「이게 저희입니다」 주장 → 관리자 확인 → 잇기</b> 입니다.

   ★ 왜 파일 하나로 두는가 — <b>세 곳에서 같은 일을 합니다</b>
       ① 가입 화면      단체명을 적으면 「이미 있는 곳인가」 알려 줍니다
       ② 상세 화면      「이 곳 관계자이신가요? 인증받기」
       ③ 마이페이지     내가 신청한 것 · 이어진 항목 관리
     화면마다 따로 적으면 규칙이 갈라집니다. 여기만 고치면 셋 다 바뀝니다.
     ★ OPUSFINE 에도 KINDS 만 갈아 끼우면 그대로 씁니다.

   ★ 쓰는 법
     <script src="/assets/claim.js"></script>
       ocClaim.search('크레디아')                 → 일곱 갈래에서 찾기
       ocClaim.mountPicker(el, {name, onPick})    → 고르는 상자 그리기
       ocClaim.request({kind,id,name,...})        → 잇기 신청
       ocClaim.mine()                             → 내 신청 목록
       ocClaim.mountBadge(el, kind, id)           → 상세 화면 인증 표시
       ocClaim.mountAsk(el, kind, id, name)       → 「관계자이신가요?」 단추

   ★ 짝이 되는 스키마: sql/claim-01-B-apply.sql
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 일곱 갈래 ────────────────────────────────────────────────
     ★ 여기가 <b>유일한 목록</b>입니다. 화면에 손으로 다시 적지 마십시오.
     ★ kind 는 <b>표 이름 그대로</b>입니다 — SQL 의 oc_entity_kind 와 같습니다.
     ★ nameCol 이 갈래마다 다릅니다 (학술은 title). 짐작하지 말고 여기만 봅니다. */
  var KINDS = [
    { kind:'persons',          label:'인물',        nameCol:'name_ko', enCol:'name_en', view:'/db/person-view.html',     hasHidden:true  },
    { kind:'orgs',             label:'음악단체',    nameCol:'name_ko', enCol:'name_en', view:'/db/org-view.html',        hasHidden:true  },
    { kind:'venues',           label:'공연장',      nameCol:'name_ko', enCol:'name_en', view:'/db/venue-view.html',      hasHidden:true  },
    { kind:'schools',          label:'음악학교',    nameCol:'name_ko', enCol:'name_en', view:'/db/school-view.html',     hasHidden:true  },
    { kind:'foundations',      label:'기관·재단',   nameCol:'name_ko', enCol:'name_en', view:'/db/foundation-view.html', hasHidden:true  },
    { kind:'modern_composers', label:'현대음악',    nameCol:'name_ko', enCol:'name_en', view:'/db/modern-view.html',     hasHidden:true  },
    { kind:'academic',         label:'학술',        nameCol:'title',   enCol:null,      view:'/db/academic-view.html',   hasHidden:false }
  ];

  /* 회원 갈래별로 「먼저 보여 줄」 갈래 — 단체 회원에게 인물DB 를 앞세우면
     엉뚱해 보입니다. 없으면 일곱 갈래를 다 봅니다. */
  var BY_MEMBER_TYPE = {
    org:      ['orgs','foundations','venues','schools'],
    school:   ['schools','orgs','foundations'],
    industry: ['foundations','orgs','venues','persons'],
    major:    ['persons','modern_composers'],
    general:  ['persons','orgs','venues','schools','foundations','modern_composers']
  };

  function sb() {
    /* ★ 반드시 싱글턴을 씁니다 — createClient 를 또 부르면 세션 토큰이
         질의에 실리지 않아 RLS 가 남의 것처럼 굽니다. */
    return window.__ocSb || null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function kindOf(kind) {
    for (var i = 0; i < KINDS.length; i++) if (KINDS[i].kind === kind) return KINDS[i];
    return null;
  }

  /* ── 지금 로그인한 회원 ──────────────────────────────────────── */
  var _me = null, _meDone = false;
  async function me() {
    if (_meDone) return _me;
    _meDone = true;
    var c = sb(); if (!c) return null;
    try {
      var u = await c.auth.getUser();
      var uid = u && u.data && u.data.user && u.data.user.id;
      if (!uid) return null;
      var r = await c.from('members')
        .select('id,name,username,member_type,status,email,extra')
        .eq('id', uid).maybeSingle();
      _me = r.data || null;
      return _me;
    } catch (e) { return null; }
  }

  /* ── ① 찾기 ──────────────────────────────────────────────────
     ★ 일곱 갈래를 <b>한꺼번에</b> 물어봅니다 (Promise.all).
       하나씩 기다리면 일곱 번 왕복이라 눈에 띄게 느립니다.
     ★ 이름이 두 글자보다 짧으면 찾지 않습니다 — 「김」 하나로 찾으면
       수천 건이 나와 고르는 뜻이 없어집니다.

     ★ <b>돌려주는 값이 셋</b>입니다. 「못 찾았다」와 「없다」는 다릅니다.
         null  물어보지 못했습니다 (연결이 없거나 다 실패)
         []    물어봤고 <b>정말 없습니다</b>
         [..]  찾았습니다
       예전에는 둘을 함께 [] 로 돌려주어, 연결이 끊긴 동안 화면이
       「등록된 곳이 없습니다」 라고 <b>단정</b>했습니다. 그 말을 믿고
       새로 등록하면 <b>같은 곳이 두 벌</b>이 됩니다 — 막으려던 바로 그 일입니다. */
  async function search(name, opts) {
    opts = opts || {};
    var q = String(name || '').trim();
    if (q.length < 2) return [];
    var c = sb(); if (!c) return null;          /* 물어보지 못했습니다 */

    var order = opts.kinds || null;
    if (!order && opts.memberType) order = BY_MEMBER_TYPE[opts.memberType] || null;

    var list = KINDS.slice();
    if (order) {
      list.sort(function (a, b) {
        var ia = order.indexOf(a.kind), ib = order.indexOf(b.kind);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    }

    var per = opts.per || 5;
    var jobs = list.map(function (k) {
      var cols = ['id', k.nameCol];
      if (k.enCol) cols.push(k.enCol);
      var qq = c.from(k.kind).select(cols.join(','))
                .ilike(k.nameCol, '%' + q + '%')
                .limit(per);
      if (k.hasHidden) qq = qq.or('hidden.is.null,hidden.is.false');
      return qq.then(function (r) {
        if (r.error) return null;               /* 이 갈래는 실패 */
        if (!r.data) return [];
        return r.data.map(function (row) {
          return { kind:k.kind, label:k.label, id:row.id,
                   name:row[k.nameCol] || '', nameEn:(k.enCol ? row[k.enCol] : '') || '',
                   view:k.view };
        });
      }, function () { return null; });
    });

    var got = await Promise.all(jobs);

    /* ★ <b>모두</b> 실패했으면 「없다」고 하지 않습니다.
         한둘만 실패한 것은 나머지 결과로 답합니다 — 갈래 일곱 중
         하나가 늦다고 아무 말도 못 하는 것은 더 불편합니다. */
    var okCount = got.filter(function (g) { return g !== null; }).length;
    if (okCount === 0) return null;

    var out = [];
    got.forEach(function (arr) { if (arr) out = out.concat(arr); });

    /* 이름이 <b>똑같은</b> 것을 앞에 둡니다 — 대개 그것이 찾던 것입니다 */
    out.sort(function (a, b) {
      var ea = (a.name === q) ? 0 : 1, eb = (b.name === q) ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return a.name.length - b.name.length;
    });
    return out;
  }

  /* ── ② 신청 ────────────────────────────────────────────────── */
  async function request(o) {
    var c = sb(); if (!c) return { ok:false, msg:'초기화 중입니다. 잠시 후 다시 시도해 주세요.' };
    var m = await me();
    if (!m) return { ok:false, msg:'로그인이 필요합니다.' };
    if (m.status !== 'approved')
      return { ok:false, msg:'회원 승인 후에 신청하실 수 있습니다. 승인까지 조금만 기다려 주십시오.' };
    var k = kindOf(o.kind);
    if (!k || !o.id) return { ok:false, msg:'어떤 항목인지 고르지 않으셨습니다.' };

    /* 메일 도메인이 그 곳의 것과 같은지 — 관리자가 볼 참고 표시입니다.
       ★ 이것만으로 저절로 승인되지는 않습니다. 도메인은 빌릴 수도 있고
         큰 기관은 부서가 여럿이기 때문입니다. */
    var dom = '';
    try { dom = String(m.email || '').split('@')[1] || ''; } catch (e) {}

    var row = {
      member_id: m.id,
      entity_kind: o.kind,
      entity_id: o.id,
      entity_name: o.name || '',
      role_title: o.role || null,
      note: o.note || null,
      evidence_url: o.evidence || null,
      email_domain: dom || null,
      domain_match: !!o.domainMatch,
      needs_review: (o.kind === 'persons' || o.kind === 'modern_composers' || o.kind === 'academic')
    };

    var r = await c.from('entity_claims').insert(row).select('id').maybeSingle();
    if (r.error) {
      var msg = String(r.error.message || '');
      if (/duplicate|unique/i.test(msg))
        return { ok:false, msg:'이미 신청하신 항목입니다. 마이페이지에서 진행 상태를 보실 수 있습니다.' };
      if (/row-level security|policy/i.test(msg))
        return { ok:false, msg:'지금은 신청하실 수 없습니다. 회원 승인 상태를 확인해 주십시오.' };
      return { ok:false, msg:'신청 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { ok:true, id: r.data && r.data.id };
  }

  /* ── ③ 내 신청 ───────────────────────────────────────────────── */
  async function mine() {
    var c = sb(); if (!c) return [];
    var m = await me(); if (!m) return [];
    var r = await c.from('entity_claims')
      .select('id,entity_kind,entity_id,entity_name,status,role_title,created_at,decided_at,decided_note')
      .eq('member_id', m.id).order('created_at', { ascending:false });
    return (r.data || []).map(function (x) {
      var k = kindOf(x.entity_kind);
      x.label = k ? k.label : x.entity_kind;
      x.view  = k ? (k.view + '?id=' + encodeURIComponent(x.entity_id)) : '#';
      return x;
    });
  }

  async function revoke(claimId) {
    var c = sb(); if (!c) return false;
    var r = await c.rpc('oc_claim_revoke', { claim_id: claimId });
    return !r.error && r.data === true;
  }

  /* ── ④ 상세 화면 인증 표시 ──────────────────────────────────────
     ★ <b>누가</b> 주인인지는 보여 주지 않습니다. 신청서에는 연락처와
       증빙이 들어 있어 남에게 보일 것이 아닙니다. 표시만 답니다. */
  async function badge(kind, id) {
    var c = sb(); if (!c) return null;
    var r = await c.from('entity_claim_badge')
      .select('owner_count,verified_at')
      .eq('entity_kind', kind).eq('entity_id', id).maybeSingle();
    return (r && r.data) ? r.data : null;
  }

  async function mountBadge(el, kind, id) {
    if (!el) return;
    var b = await badge(kind, id);
    if (!b || !b.owner_count) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<span class="oc-claim-badge" title="이 항목의 관계자가 인증되었습니다">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
             'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M20 6 9 17l-5-5"/></svg>' +
        '공식 인증</span>';
  }

  /* ── ⑤ 「관계자이신가요?」 단추 ───────────────────────────────
     ★ 상세 화면에 둡니다. DB 를 보러 온 사람이 회원이 되는 <b>되돌아오는 길</b>입니다.
     ★ 이미 이어진 항목이거나 내가 신청해 둔 것이면 보여 주지 않습니다. */
  async function mountAsk(el, kind, id, name) {
    if (!el) return;
    el.innerHTML = '';
    var c = sb(); if (!c) return;

    var m = await me();
    if (!m) {
      el.innerHTML =
        '<a class="oc-claim-ask" href="/account/login.html">' +
        '이 ' + esc((kindOf(kind) || {}).label || '항목') + ' 관계자이신가요? 로그인 후 인증받으실 수 있습니다 &rarr;</a>';
      return;
    }
    if (m.status !== 'approved') return;

    /* 내가 이미 신청했는가 */
    var r = await c.from('entity_claims').select('id,status')
      .eq('member_id', m.id).eq('entity_kind', kind).eq('entity_id', id)
      .in('status', ['pending','approved']).maybeSingle();
    if (r && r.data) {
      el.innerHTML = '<span class="oc-claim-ask done">' +
        (r.data.status === 'approved' ? '내가 인증받은 항목입니다' : '인증 신청이 접수되어 확인 중입니다') +
        '</span>';
      return;
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oc-claim-ask';
    btn.innerHTML = '이 ' + esc((kindOf(kind) || {}).label || '항목') + ' 관계자이신가요? 인증받기 &rarr;';
    btn.addEventListener('click', function () { openForm(el, kind, id, name); });
    el.appendChild(btn);
  }

  /* 간단한 신청 서식 — 새 화면으로 보내지 않고 그 자리에서 받습니다 */
  function openForm(el, kind, id, name) {
    el.innerHTML =
      '<div class="oc-claim-form">' +
        '<div class="ocf-t">' + esc(name || '') + ' — 관계자 인증 신청</div>' +
        '<label class="ocf-l">맡으신 일 <span class="ocf-o">(선택)</span></label>' +
        '<input class="ocf-i" data-f="role" placeholder="예: 기획팀장">' +
        '<label class="ocf-l">확인할 수 있는 곳 <span class="ocf-o">(선택)</span></label>' +
        '<input class="ocf-i" data-f="evidence" placeholder="누리집의 담당자 안내 주소 등">' +
        '<label class="ocf-l">하실 말씀 <span class="ocf-o">(선택)</span></label>' +
        '<textarea class="ocf-i ocf-ta" data-f="note" rows="2"></textarea>' +
        '<div class="ocf-note">신청하시면 관리자가 확인한 뒤 이어 드립니다. ' +
          '인증되면 이 항목을 직접 고치실 수 있고, 화면에 「공식 인증」 표시가 붙습니다.</div>' +
        '<div class="ocf-btns">' +
          '<button type="button" class="ocf-go">신청</button>' +
          '<button type="button" class="ocf-no">취소</button>' +
        '</div>' +
        '<div class="ocf-msg"></div>' +
      '</div>';

    var box = el.querySelector('.oc-claim-form');
    var msg = box.querySelector('.ocf-msg');
    box.querySelector('.ocf-no').addEventListener('click', function () {
      mountAsk(el, kind, id, name);
    });
    box.querySelector('.ocf-go').addEventListener('click', async function () {
      var get = function (f) { var e = box.querySelector('[data-f="' + f + '"]'); return e ? e.value.trim() : ''; };
      msg.textContent = '보내는 중…'; msg.className = 'ocf-msg';
      var r = await request({ kind:kind, id:id, name:name,
                              role:get('role'), evidence:get('evidence'), note:get('note') });
      if (!r.ok) { msg.textContent = r.msg; msg.className = 'ocf-msg bad'; return; }
      el.innerHTML = '<span class="oc-claim-ask done">인증 신청이 접수되었습니다. 확인 후 알려 드리겠습니다.</span>';
    });
  }

  /* ── ⑥ 고르는 상자 ───────────────────────────────────────────
     가입 화면에서 씁니다 — 단체명을 적으면 「이미 있는 곳인가」 보여 줍니다.
     ★ 여기서는 <b>신청하지 않습니다.</b> 가입은 아직 승인 전이라 신청이
       막혀 있습니다(RLS). 고른 것을 적어 두었다가, 승인된 뒤에
       마이페이지에서 잇습니다. */
  function mountPicker(el, opts) {
    if (!el) return;
    opts = opts || {};
    var picked = null;
    var timer = null;

    el.innerHTML =
      '<div class="oc-claim-pick">' +
        '<div class="ocp-head">이미 오퍼스클램에 등록된 곳인지 확인합니다</div>' +
        '<div class="ocp-list"></div>' +
      '</div>';
    var list = el.querySelector('.ocp-list');

    function draw(rows, q) {
      /* ★ null 은 「물어보지 못했다」 입니다 — 「없다」고 말하면 안 됩니다.
           그 말을 믿고 새로 등록하면 같은 곳이 두 벌이 됩니다. */
      if (rows === null) {
        list.innerHTML = '<div class="ocp-none warn">지금 확인할 수 없습니다. ' +
                         '잠시 뒤 다시 봐 주십시오 — 이미 등록된 곳일 수도 있어, ' +
                         '가입 뒤 마이페이지에서 한 번 더 확인해 드립니다.</div>';
        picked = null;
        if (opts.onPick) opts.onPick(null);
        return;
      }
      if (!rows.length) {
        list.innerHTML = '<div class="ocp-none">「' + esc(q) + '」 (으)로 등록된 곳이 없습니다. ' +
                         '새로 만들어 드립니다.</div>';
        picked = null;
        if (opts.onPick) opts.onPick(null);
        return;
      }
      var h = '<div class="ocp-hint">아래에 해당하는 곳이 있으면 골라 주십시오. ' +
              '<b>같은 곳이 두 벌로 들어가는 것</b>을 막습니다.</div>';
      rows.slice(0, 8).forEach(function (r) {
        h += '<label class="ocp-row">' +
               '<input type="radio" name="ocp" value="' + esc(r.kind) + ':' + esc(r.id) + '">' +
               '<span class="ocp-k">' + esc(r.label) + '</span>' +
               '<span class="ocp-n">' + esc(r.name) + '</span>' +
               (r.nameEn ? '<span class="ocp-e">' + esc(r.nameEn) + '</span>' : '') +
               '<a class="ocp-v" href="' + r.view + '?id=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener">보기</a>' +
             '</label>';
      });
      h += '<label class="ocp-row ocp-new">' +
             '<input type="radio" name="ocp" value="">' +
             '<span class="ocp-n">해당하는 곳이 없습니다 — 새로 등록해 주십시오</span>' +
           '</label>';
      list.innerHTML = h;

      list.querySelectorAll('input[name="ocp"]').forEach(function (r) {
        r.addEventListener('change', function () {
          var v = r.value;
          if (!v) { picked = null; }
          else {
            var p = v.split(':');
            var found = rows.filter(function (x) { return x.kind === p[0] && String(x.id) === p[1]; })[0];
            picked = found || null;
          }
          if (opts.onPick) opts.onPick(picked);
        });
      });
    }

    function run(q) {
      if (String(q || '').trim().length < 2) { list.innerHTML = ''; picked = null;
        if (opts.onPick) opts.onPick(null); return; }
      list.innerHTML = '<div class="ocp-none">찾는 중…</div>';
      search(q, { memberType: opts.memberType, per: 4 }).then(function (rows) { draw(rows, q); });
    }

    /* 글자를 칠 때마다 묻지 않습니다 — 멈춘 뒤에 한 번 */
    if (opts.input) {
      opts.input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { run(opts.input.value); }, 420);
      });
      if (opts.input.value) run(opts.input.value);
    }

    return { run: run, picked: function () { return picked; } };
  }

  /* ── 바깥에 내놓기 ───────────────────────────────────────────── */
  window.ocClaim = {
    KINDS: KINDS,
    kindOf: kindOf,
    me: me,
    search: search,
    request: request,
    mine: mine,
    revoke: revoke,
    badge: badge,
    mountBadge: mountBadge,
    mountAsk: mountAsk,
    mountPicker: mountPicker
  };
})();
