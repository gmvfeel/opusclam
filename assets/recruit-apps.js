/* ============================================================
   OPUSCLAM 리쿠르트 지원 내역 — assets/recruit-apps.js

   무엇을 하나
     마이페이지에 두 묶음을 그립니다.
       · 받은지원  단체·학교가 자기 공고에 온 지원을 봅니다
       · 내지원    지원한 사람이 진행 상황을 봅니다

   ★ 하나의 파일로 둔 까닭
     두 화면은 「지원 한 건을 보여 준다」 는 점이 같습니다.
     따로 만들면 나중에 상태 이름 하나를 고칠 때 두 곳을 손봐야 하고,
     한쪽만 고쳐지는 일이 생깁니다.

   ★ 회원 종류에 따라 보이는 것이 다릅니다
     단체·기업·학교  → 받은지원 (자기 공고에 온 것)
     전공자·일반     → 내지원
     관리자         → 둘 다
     어느 쪽도 없으면 그 묶음을 아예 감춥니다 — 빈 칸을 보여 주는 것보다
     낫습니다.

   ★ 이름·연락처는 지원 시점의 값입니다 (표에 베껴 담아 두었습니다).
     지원자가 인재정보를 고치거나 지워도 단체가 연락할 길이 남습니다.

   쓰는 법
     <div id="raRecv"></div>   받은지원이 들어갈 자리
     <div id="raSent"></div>   내지원이 들어갈 자리
     <script src="/assets/recruit-apps.js"></script>
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  /* ★ 접속 객체는 화면 전체에 하나만 씁니다 (window.__ocSb).
     여러 개 만들면 세션 토큰이 질의에 안 실리는 일이 생깁니다 —
     채용등록이 잠겼던 것이 그 문제였습니다. */
  function sb() {
    if (!window.__ocSb && window.supabase && window.supabase.createClient) {
      window.__ocSb = window.supabase.createClient(SB, KEY);
    }
    return window.__ocSb || null;
  }

  function el(s) { return document.querySelector(s); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* ★ 시각은 recruit.js 의 공용 함수를 씁니다 — 한 곳에서만 정합니다.
     (마이페이지에도 assets/recruit.js 가 함께 실립니다)

     예전에는 ISO 문자열을 그대로 잘라 썼습니다(s.slice(11,16)).
     그러면 UTC 값이 나와 한국 시간과 9시간 어긋납니다 —
     오전 11시 11분에 낸 지원이 「02:11」 로 보였습니다.
     날짜도 새벽(한국 시간 0~9시)에는 하루 밀렸습니다. */
  function fmt(d) {
    var R = window.OCRecruit;
    return R && R.stampShort ? R.stampShort(d) : '';
  }
  function fmtFull(d) {
    var R = window.OCRecruit;
    return R && R.stampFull ? R.stampFull(d) : '';
  }

  /* 진행 상태 — 한 곳에서 정합니다 */
  var STATUS = ['접수', '검토중', '서류합격', '불합격', '최종합격'];
  var STATUS_CLS = {
    '접수': 'new', '검토중': 'ing', '서류합격': 'ok',
    '불합격': 'no', '최종합격': 'ok2', '지원취소': 'cancel',
  };

  /* ── 지원 한 건 (단체가 보는 모양) ────────────────────────*/
  function recvItem(a) {
    var j = a.recruit_jobs || {};
    var unread = !a.read_at;
    return ''
      + '<li class="ra-it' + (unread ? ' ra-it--new' : '') + '" data-id="' + esc(a.id) + '">'
      +   '<div class="ra-it-top">'
      +     '<div class="ra-it-who">'
      +       (unread ? '<span class="ra-dot" title="아직 열어 보지 않았습니다"></span>' : '')
      +       '<b>' + esc(a.name || '(이름 없음)') + '</b>'
      +       '<span class="ra-st ra-st--' + (STATUS_CLS[a.status] || 'new') + '">' + esc(a.status) + '</span>'
      +     '</div>'
      +     '<span class="ra-it-date">' + esc(fmt(a.created_at)) + '</span>'
      +   '</div>'
      +   '<a class="ra-it-job" href="/recruit/job-view.html?id=' + esc(a.job_id) + '">'
      +     esc(j.title || '(공고를 찾을 수 없습니다)') + '</a>'
      +   '<div class="ra-it-more" hidden></div>'
      + '</li>';
  }

  /* ── 지원 한 건 (지원자가 보는 모양) ──────────────────────*/
  function sentItem(a) {
    var j = a.recruit_jobs || {};
    return ''
      + '<li class="ra-it" data-id="' + esc(a.id) + '">'
      +   '<div class="ra-it-top">'
      +     '<div class="ra-it-who">'
      +       '<b>' + esc(j.org_name || '(단체명 없음)') + '</b>'
      +       '<span class="ra-st ra-st--' + (STATUS_CLS[a.status] || 'new') + '">' + esc(a.status) + '</span>'
      +     '</div>'
      +     '<span class="ra-it-date">' + esc(fmt(a.created_at)) + '</span>'
      +   '</div>'
      +   '<a class="ra-it-job" href="/recruit/job-view.html?id=' + esc(a.job_id) + '">'
      +     esc(j.title || '(공고가 지워졌습니다)') + '</a>'
      +   '<div class="ra-it-more" hidden></div>'
      + '</li>';
  }

  /* ── 펼쳤을 때 보이는 속내용 ──────────────────────────────*/
  function detailHtml(a, forOrg) {
    var out = '';

    if (forOrg) {
      out += '<dl class="ra-dl">'
        +   '<dt>연락처</dt><dd>' + esc(a.phone || '—')
        +     (a.phone ? ' <a class="ra-mini" href="tel:' + esc(a.phone) + '">전화</a>' : '') + '</dd>'
        +   '<dt>이메일</dt><dd>' + esc(a.email || '—')
        +     (a.email ? ' <a class="ra-mini" href="mailto:' + esc(a.email) + '">메일</a>' : '') + '</dd>'
        +   '<dt>지원한 때</dt><dd>' + esc(fmtFull(a.created_at)) + '</dd>'
        + '</dl>';
    } else {
      out += '<dl class="ra-dl">'
        +   '<dt>낸 이름</dt><dd>' + esc(a.name || '—') + '</dd>'
        +   '<dt>낸 연락처</dt><dd>' + esc(a.phone || '—') + ' · ' + esc(a.email || '—') + '</dd>'
        +   '<dt>지원한 때</dt><dd>' + esc(fmtFull(a.created_at)) + '</dd>'
        +   (a.status_at ? '<dt>상태 바뀐 때</dt><dd>' + esc(fmtFull(a.status_at)) + '</dd>' : '')
        + '</dl>';
    }

    if (a.talent_id) {
      out += '<p class="ra-row"><span class="ra-row-l">붙인 인재정보</span>'
        + '<a class="ra-mini" href="/recruit/talent-view.html?id=' + esc(a.talent_id) + '">열어 보기</a></p>';
    }
    if (a.file_url) {
      out += '<p class="ra-row"><span class="ra-row-l">붙인 파일</span>'
        + '<a class="ra-mini" href="' + esc(a.file_url) + '" target="_blank" rel="noopener noreferrer">'
        + esc(a.file_name || '내려받기') + '</a></p>';
    }
    if (a.message) {
      out += '<div class="ra-memo"><span class="ra-row-l">하고 싶은 말</span>'
        + '<p>' + esc(a.message).replace(/\n/g, '<br>') + '</p></div>';
    }

    if (forOrg) {
      /* 상태 바꾸기 · 단체 메모 */
      out += '<div class="ra-ctl">'
        +   '<label>진행 상태</label>'
        +   '<select class="ra-sel" data-id="' + esc(a.id) + '">'
        +     STATUS.map(function (st) {
              return '<option' + (st === a.status ? ' selected' : '') + '>' + esc(st) + '</option>';
            }).join('')
        +   '</select>'
        +   '<span class="ra-ctl-msg"></span>'
        + '</div>'
        + '<div class="ra-ctl ra-ctl--memo">'
        +   '<label>메모 <span class="ra-only">지원자에게는 보이지 않습니다</span></label>'
        +   '<textarea class="ra-memo-in" rows="2" data-id="' + esc(a.id) + '" '
        +     'placeholder="면접 일정, 참고할 점 등">' + esc(a.org_memo || '') + '</textarea>'
        +   '<button type="button" class="ra-mini-btn" data-memo="' + esc(a.id) + '">메모 저장</button>'
        + '</div>'
        /* ★ 숨기기 — <b>지우는 것이 아닙니다.</b>
           지원서는 지원자의 자료입니다. 업체가 지우면 지원자의
           「내 지원 내역」 에서 기록이 말없이 사라져, 나중에 다툼이
           생기면 양쪽 다 근거가 없습니다.
           그래서 <b>업체의 목록에서만</b> 감추고 되돌릴 수 있게 합니다. */
        + '<div class="ra-ctl">'
        +   (a.org_hidden
            ? '<button type="button" class="ra-mini-btn" data-unhide="' + esc(a.id) + '">다시 보이기</button>'
              + '<span class="ra-ctl-msg">지금은 목록에서 감춰져 있습니다.</span>'
            : '<button type="button" class="ra-mini-btn ra-hide-btn" data-hide="' + esc(a.id) + '">목록에서 숨기기</button>'
              + '<span class="ra-ctl-msg">지원자에게는 그대로 남습니다. 언제든 되돌릴 수 있습니다.</span>')
        + '</div>';
    } else if (a.status !== '지원취소' && a.status !== '최종합격') {
      out += '<div class="ra-ctl">'
        +   '<button type="button" class="ra-mini-btn ra-cancel" data-cancel="' + esc(a.id) + '">지원 취소</button>'
        +   '<span class="ra-ctl-msg">취소하시면 단체 화면에도 취소로 표시됩니다.</span>'
        + '</div>';
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════
     받은지원
     ══════════════════════════════════════════════════════════ */
  async function drawRecv(box, me) {
    var c = sb();
    box.innerHTML = '<div class="mp-msg">불러오는 중…</div>';

    var rows = [];
    try {
      /* 내 공고에 온 것만 옵니다 — 권한 규칙이 서버에서 걸러 줍니다.
         공고 제목을 함께 받아 목록에 보여 줍니다. */
      var r = await c.from('recruit_applications')
        .select('*,recruit_jobs!inner(id,title,org_name,member_id)')
        .eq('recruit_jobs.member_id', me.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (r.error) throw r.error;
      rows = r.data || [];
    } catch (e) {
      console.error('받은지원 불러오기 실패:', e);
      box.innerHTML = '<div class="mp-msg">받은 지원을 불러오지 못했습니다.<br>'
        + '<span style="font-size:12px;color:#888">' + esc(String(e.message || e)) + '</span></div>';
      return;
    }

    /* ★ 숨긴 것을 갈라 놓습니다.
       업체가 지운 것이 아니므로 자료는 그대로 있고, 목록에서만 빠집니다.
       되돌릴 수 있게 「숨긴 지원」 묶음을 아래에 따로 둡니다. */
    var live = rows.filter(function (a) { return !a.org_hidden; });
    var hid  = rows.filter(function (a) { return !!a.org_hidden; });

    /* 다시 그릴 수 있게 해 둡니다 — 숨기거나 되돌린 뒤에 부릅니다 */
    box.__reload = function () { drawRecv(box, me); };

    if (!live.length && !hid.length) {
      box.innerHTML = '<div class="mp-msg">아직 받은 지원이 없습니다.<br><br>'
        + '<a class="mp-btn ghost" href="/recruit/job.html">내 공고 보기</a> '
        + '<a class="mp-btn primary" href="/recruit/job-write.html">채용정보 올리기</a></div>';
      return;
    }

    var unread = live.filter(function (a) { return !a.read_at && a.status !== '지원취소'; }).length;
    box.innerHTML = ''
      + '<div class="ra-sum">'
      +   '<span>모두 <b>' + live.length + '</b>건</span>'
      +   (unread ? '<span class="ra-sum-new">아직 안 본 것 <b>' + unread + '</b>건</span>' : '')
      + '</div>'
      + (live.length
        ? '<ul class="ra-list">' + live.map(recvItem).join('') + '</ul>'
        : '<div class="mp-msg">보이는 지원이 없습니다. 아래에서 숨긴 지원을 펼쳐 보십시오.</div>')
      + (hid.length
        ? '<div class="ra-hid">'
          + '<button type="button" class="ra-hid-tog" data-hidtog>'
          +   '숨긴 지원 <b>' + hid.length + '</b>건 보기'
          + '</button>'
          + '<ul class="ra-list ra-list--hid" hidden>' + hid.map(recvItem).join('') + '</ul>'
          + '</div>'
        : '');

    bindList(box, rows, true);
  }

  /* ══════════════════════════════════════════════════════════
     내지원
     ══════════════════════════════════════════════════════════ */
  async function drawSent(box, me) {
    var c = sb();
    box.innerHTML = '<div class="mp-msg">불러오는 중…</div>';

    var rows = [];
    try {
      var r = await c.from('recruit_applications')
        .select('*,recruit_jobs(id,title,org_name)')
        .eq('applicant_id', me.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (r.error) throw r.error;
      rows = r.data || [];
    } catch (e) {
      console.error('내지원 불러오기 실패:', e);
      box.innerHTML = '<div class="mp-msg">지원 내역을 불러오지 못했습니다.<br>'
        + '<span style="font-size:12px;color:#888">' + esc(String(e.message || e)) + '</span></div>';
      return;
    }

    if (!rows.length) {
      box.innerHTML = '<div class="mp-msg">아직 지원한 곳이 없습니다.<br><br>'
        + '<a class="mp-btn primary" href="/recruit/job.html">채용정보 보러 가기</a></div>';
      return;
    }

    var live = rows.filter(function (a) { return a.status === '접수' || a.status === '검토중'; }).length;
    box.innerHTML = ''
      + '<div class="ra-sum">'
      +   '<span>모두 <b>' + rows.length + '</b>건</span>'
      +   (live ? '<span>진행 중 <b>' + live + '</b>건</span>' : '')
      + '</div>'
      + '<ul class="ra-list">' + rows.map(sentItem).join('') + '</ul>';

    bindList(box, rows, false);
  }

  /* ══════════════════════════════════════════════════════════
     목록 잇기 — 펼치기 · 상태 바꾸기 · 메모 · 취소
     ══════════════════════════════════════════════════════════ */
  function bindList(box, rows, forOrg) {
    /* ★ 처리기는 box 에 <b>한 번만</b> 붙입니다.

       box.innerHTML 을 다시 채우면 안의 요소는 새로 만들어지지만,
       box <b>자신</b>에 붙여 둔 처리기는 그대로 남습니다.
       숨기기·되돌리기 뒤에 목록을 다시 그리므로, 막지 않으면 처리기가
       겹쳐 붙어 한 번 누른 것이 두 번·세 번 실행됩니다.

       그래서 자료는 box 에 얹어 두고, 처리기는 그것을 꺼내 씁니다. */
    box.__rows = rows;
    box.__forOrg = forOrg;
    if (box.__bound) return;
    box.__bound = true;

    function cur() { return box.__rows || []; }
    function byIdOf(id) {
      var r = cur();
      for (var i = 0; i < r.length; i++) {
        if (String(r[i].id) === String(id)) return r[i];
      }
      return null;
    }

    /* 펼치기 — 제목이나 이름을 누르면 속내용이 열립니다.
       ★ 단체가 처음 열 때 「읽었다」 로 표시합니다. 그래야 안 본 것을
         빨간 숫자로 알려 줄 수 있습니다. */
    box.addEventListener('click', async function (e) {
      /* 링크·입력칸을 누른 것은 펼치기가 아닙니다 */
      if (e.target.closest('a, select, textarea, button')) return;
      var li = e.target.closest('.ra-it');
      if (!li) return;
      var id = li.getAttribute('data-id');
      var a = byIdOf(id);
      if (!a) return;
      var more = li.querySelector('.ra-it-more');
      if (!more) return;

      if (more.hidden) {
        if (!more.innerHTML) more.innerHTML = detailHtml(a, box.__forOrg);
        more.hidden = false;
        li.classList.add('ra-it--open');
        if (box.__forOrg && !a.read_at) {
          try {
            var c = sb();
            await c.from('recruit_applications').update({ read_at: new Date().toISOString() }).eq('id', a.id);
            a.read_at = new Date().toISOString();
            li.classList.remove('ra-it--new');
            var dot = li.querySelector('.ra-dot');
            if (dot) dot.remove();
            refreshUnread(box, cur());
          } catch (err) { /* 표시를 못 남겨도 보는 데는 지장이 없습니다 */ }
        }
      } else {
        more.hidden = true;
        li.classList.remove('ra-it--open');
      }
    });

    /* 상태 바꾸기 */
    box.addEventListener('change', async function (e) {
      var sel = e.target.closest('.ra-sel');
      if (!sel) return;
      var id = sel.getAttribute('data-id');
      var msg = sel.parentNode.querySelector('.ra-ctl-msg');
      var val = sel.value;
      sel.disabled = true;
      if (msg) { msg.textContent = '바꾸는 중…'; msg.className = 'ra-ctl-msg'; }
      try {
        var c = sb();
        var r = await c.from('recruit_applications').update({ status: val }).eq('id', id);
        if (r.error) throw r.error;
        var _hit = byIdOf(id); if (_hit) _hit.status = val;
        /* 목록의 상태 표시도 함께 바꿉니다 */
        var li = box.querySelector('.ra-it[data-id="' + id + '"]');
        var st = li && li.querySelector('.ra-st');
        if (st) {
          st.textContent = val;
          st.className = 'ra-st ra-st--' + (STATUS_CLS[val] || 'new');
        }
        if (msg) { msg.textContent = '바꿨습니다.'; msg.className = 'ra-ctl-msg ra-ctl-msg--ok'; }
      } catch (err) {
        if (msg) { msg.textContent = '바꾸지 못했습니다 — ' + String(err.message || err).slice(0, 60);
                   msg.className = 'ra-ctl-msg ra-ctl-msg--warn'; }
      }
      sel.disabled = false;
    });

    /* 메모 저장 · 지원 취소 · 숨기기 · 되돌리기 · 숨긴 묶음 펼치기 */
    box.addEventListener('click', async function (e) {
      /* ── 숨긴 묶음 펼치기·접기 ─────────────────────────── */
      var tg = e.target.closest('[data-hidtog]');
      if (tg) {
        var ul = box.querySelector('.ra-list--hid');
        if (ul) {
          var willShow = ul.hidden;
          ul.hidden = !willShow;
          tg.innerHTML = (willShow ? '숨긴 지원 접기' : '숨긴 지원 <b>'
            + ul.querySelectorAll('.ra-it').length + '</b>건 보기');
        }
        return;
      }

      /* ── 숨기기 · 되돌리기 ─────────────────────────────── */
      var hb = e.target.closest('[data-hide],[data-unhide]');
      if (hb) {
        var toHide = hb.hasAttribute('data-hide');
        var hid2 = hb.getAttribute(toHide ? 'data-hide' : 'data-unhide');
        var hmsg = hb.parentNode.querySelector('.ra-ctl-msg');
        hb.disabled = true;
        hb.textContent = toHide ? '숨기는 중…' : '되돌리는 중…';
        try {
          var c3 = sb();
          var r3 = await c3.from('recruit_applications')
            .update({ org_hidden: toHide }).eq('id', hid2);
          if (r3.error) throw r3.error;
          /* 목록을 다시 그립니다 — 항목을 손으로 옮기는 것보다 확실합니다 */
          if (typeof box.__reload === 'function') { box.__reload(); return; }
          hb.textContent = toHide ? '목록에서 숨기기' : '다시 보이기';
          hb.disabled = false;
        } catch (err) {
          hb.disabled = false;
          hb.textContent = toHide ? '목록에서 숨기기' : '다시 보이기';
          if (hmsg) {
            hmsg.textContent = '하지 못했습니다 — ' + String(err.message || err).slice(0, 60);
            hmsg.className = 'ra-ctl-msg ra-ctl-msg--warn';
          }
        }
        return;
      }

      var mb = e.target.closest('[data-memo]');
      if (mb) {
        var id = mb.getAttribute('data-memo');
        var ta = box.querySelector('.ra-memo-in[data-id="' + id + '"]');
        var msg = mb.parentNode.querySelector('.ra-ctl-msg');
        mb.disabled = true; mb.textContent = '저장 중…';
        try {
          var c = sb();
          var r = await c.from('recruit_applications').update({ org_memo: ta ? ta.value : '' }).eq('id', id);
          if (r.error) throw r.error;
          mb.textContent = '저장했습니다';
          setTimeout(function () { mb.textContent = '메모 저장'; mb.disabled = false; }, 1600);
        } catch (err) {
          mb.textContent = '메모 저장'; mb.disabled = false;
          alert('메모를 저장하지 못했습니다.\n' + String(err.message || err));
        }
        return;
      }

      var cb = e.target.closest('[data-cancel]');
      if (cb) {
        var cid = cb.getAttribute('data-cancel');
        /* ★ 되돌릴 수 없는 일이므로 한 번 물어봅니다 */
        if (!confirm('이 지원을 취소하시겠습니까?\n\n취소하면 단체 화면에도 취소로 표시되고,\n같은 공고에 다시 지원하려면 새로 내셔야 합니다.')) return;
        cb.disabled = true; cb.textContent = '취소하는 중…';
        try {
          var c2 = sb();
          var r2 = await c2.from('recruit_applications').update({ status: '지원취소' }).eq('id', cid);
          if (r2.error) throw r2.error;
          var li2 = box.querySelector('.ra-it[data-id="' + cid + '"]');
          var st2 = li2 && li2.querySelector('.ra-st');
          if (st2) { st2.textContent = '지원취소'; st2.className = 'ra-st ra-st--cancel'; }
          cb.remove();
        } catch (err) {
          cb.disabled = false; cb.textContent = '지원 취소';
          alert('취소하지 못했습니다.\n' + String(err.message || err));
        }
      }
    });
  }

  function refreshUnread(box, rows) {
    /* ★ 숨긴 것은 빼고 셉니다 — 위의 「모두 ○건」 과 같은 잣대여야
       합니다. 다르면 목록에 없는 건이 「안 본 것」 으로 남아
       빨간 숫자가 사라지지 않습니다. */
    var n = rows.filter(function (a) {
      return !a.read_at && a.status !== '지원취소' && !a.org_hidden;
    }).length;
    var el2 = box.querySelector('.ra-sum-new');
    if (!el2) return;
    if (!n) el2.remove();
    else el2.innerHTML = '아직 안 본 것 <b>' + n + '</b>건';
  }

  /* ══════════════════════════════════════════════════════════
     시작
     ══════════════════════════════════════════════════════════ */
  async function init() {
    var recvBox = el('#raRecv');
    var sentBox = el('#raSent');
    if (!recvBox && !sentBox) return;

    var c = sb();
    if (!c) return;

    var ses = await c.auth.getSession();
    var u = ses && ses.data && ses.data.session && ses.data.session.user;
    if (!u) {
      /* 로그인하지 않았으면 두 묶음을 감춥니다 —
         마이페이지 자체가 로그인 안내를 이미 보여 줍니다. */
      hide(recvBox); hide(sentBox);
      return;
    }

    /* 회원 종류를 봅니다.
       ★ select('*') 로 읽습니다 — 칸 이름을 적으면 그 칸이 없을 때
         질의 전체가 오류가 나 「자격 없음」 으로 잘못 읽힙니다. */
    var m = {};
    try {
      var r = await c.from('members').select('*').eq('id', u.id).maybeSingle();
      m = r.data || {};
    } catch (e) {}
    /* ★ 회원 종류 목록을 여기 적지 않습니다 — recruit.js 의 roleOf() 가 압니다.
       예전에 이 자리에 손으로 적어 두었습니다. 목록을 여러 곳에 적으면
       반드시 한 곳을 빠뜨립니다(org 를 네 곳에서 빠뜨렸습니다).

       ★ 승인을 묻지 않는 판정(…Type)을 씁니다.
         이곳은 <b>자기 자료를 보는 곳</b>이므로, 심사 중이거나 반려된
         회원도 이미 주고받은 지원은 볼 수 있어야 합니다. */
    var role = (window.OCRecruit && window.OCRecruit.roleOf)
      ? window.OCRecruit.roleOf(m)
      : { hiringType: false, individualType: false };
    var hiring = !!role.hiringType;     /* 받은 지원 — 공고를 올리는 쪽 */
    var seeker = !!role.individualType; /* 내 지원 — 지원하는 쪽(전공자·일반) */

    if (recvBox) { if (hiring) drawRecv(recvBox, u); else hide(recvBox); }
    if (sentBox) { if (seeker) drawSent(sentBox, u); else hide(sentBox); }
  }

  /* 그 묶음의 제목까지 함께 감춥니다 — 제목만 남으면 고장처럼 보입니다 */
  function hide(box) {
    if (!box) return;
    box.hidden = true;
    var h = box.previousElementSibling;
    if (h && h.classList && h.classList.contains('mp-head')) h.hidden = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
