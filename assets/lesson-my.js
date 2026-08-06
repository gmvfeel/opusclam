/* ══════════════════════════════════════════════════════════════
   마이페이지 「내 레슨」 — assets/lesson-my.js
   2026-08-06

   무엇을 하나
     OCLessonMy.init()   회원이 <b>신청한</b> 레슨과 진행 상태

   왜 필요한가
     강사 쪽은 「내 강의」에서 신청을 보고 승인할 수 있게 되었지만,
     <b>신청한 회원은 자기가 무엇을 신청했는지 볼 곳이 없었습니다.</b>
     신청은 되는데 확인할 데가 없으면 「접수가 된 건가?」 하고 다시
     신청하거나 문의가 옵니다. 흐름의 반쪽을 메웁니다.

   ★ 짜임은 마이페이지 것을 <b>그대로 씁니다</b> (mp-card · mp-msg 등)
     따로 만들면 같은 화면 안에서 결이 어긋납니다.

   ★ 강의 정보는 <b>따로</b> 불러 붙입니다
     lessons_public 은 뷰라서 신청 표와 관계(외래키)로 이어지지
     않습니다. 그래서 한 번에 조인할 수 없고, 신청을 먼저 읽고
     강의를 한 번 더 읽어 맞춥니다(조회는 두 번으로 끝납니다).

   ★ 준비중(draft)으로 되돌린 강의는 뷰에서 빠집니다
     그때는 「강의가 내려갔습니다」로 알려 줍니다 — 빈 줄로 두면
     회원이 자기 신청이 사라진 줄 압니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCLessonMy) return;

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
  function waitSb(cb) {
    var n = 0;
    (function tick() {
      var c = sb(); if (c) return cb(c);
      if (++n > 60) return cb(null);
      setTimeout(tick, 50);
    })();
  }

  var KIND = { one: '1:1 레슨', group: '그룹레슨', vod: '녹화 강의' };
  var TAB  = { master: '마스터클래스', open: '공개레슨', one: '1:1 레슨', group: '그룹레슨' };
  var ST   = {
    pending:  { t: '승인 대기', c: 'wait' },
    approved: { t: '승인',      c: 'ok' },
    rejected: { t: '거절',      c: 'no' },
    canceled: { t: '신청 취소',  c: 'off' }
  };

  function fmt(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
    } catch (e) { return ''; }
  }

  /* 이 탭만 쓰는 짜임 — 마이페이지 CSS 는 건드리지 않습니다 */
  function styleOnce() {
    if (window.__ocMlCss) return;
    window.__ocMlCss = true;
    var css = ''
      + '.ml-row{display:flex;gap:14px;align-items:flex-start;padding:16px 0;'
      +   'border-top:1px solid var(--line,rgba(255,255,255,.10));}'
      + '.ml-row:first-child{border-top:0;padding-top:0;}'
      + '.ml-row.off{opacity:.6;}'
      + '.ml-th{flex:0 0 108px;aspect-ratio:16/9;border-radius:7px;overflow:hidden;'
      +   'background:rgba(128,128,150,.14);}'
      + '.ml-th img{width:100%;height:100%;object-fit:cover;display:block;}'
      + '.ml-in{flex:1 1 auto;min-width:0;}'
      + '.ml-t{font-size:14px;font-weight:600;line-height:1.5;text-decoration:none;'
      +   'color:var(--tx,inherit);}'
      + '.ml-t:hover{text-decoration:underline;}'
      + '.ml-meta{margin-top:5px;font-size:12px;line-height:1.6;color:var(--tx3,#8a86a0);}'
      + '.ml-st{display:inline-block;margin-right:8px;padding:2px 8px;border-radius:3px;'
      +   'font-size:10.5px;font-weight:800;vertical-align:1px;}'
      + '.ml-st.wait{background:#8a3ea0;color:#fff;}'
      + '.ml-st.ok{background:#3f7a4f;color:#fff;}'
      + '.ml-st.no{background:#7a3f3f;color:#fff;}'
      + '.ml-st.off{background:rgba(128,128,150,.28);color:var(--tx2,#c9c6d6);}'
      + '.ml-msg2{margin-top:8px;padding:9px 12px;border-radius:6px;font-size:12.5px;'
      +   'line-height:1.7;background:rgba(128,128,150,.10);color:var(--tx2,#c9c6d6);}'
      + '.ml-act{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;align-items:stretch;}'
      + '.ml-act button, .ml-act a{padding:7px 14px;border-radius:5px;cursor:pointer;'
      +   'font:inherit;font-size:11.5px;text-align:center;text-decoration:none;'
      +   'border:1px solid var(--line,rgba(255,255,255,.16));'
      +   'background:none;color:var(--tx2,#c9c6d6);}'
      + '.ml-act .go{background:#3f7a4f;border-color:#3f7a4f;color:#fff;font-weight:700;}'
      + '.ml-act button:disabled{opacity:.45;cursor:not-allowed;}'
      + '.ml-gone{font-size:12.5px;color:var(--tx3,#8a86a0);}'
      + '@media (max-width:640px){.ml-row{flex-wrap:wrap;}'
      +   '.ml-th{flex:0 0 84px;}.ml-act{flex:1 1 100%;flex-direction:row;}}';
    var s = document.createElement('style');
    s.setAttribute('data-oc', 'my-lessons');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init(opt) {
    opt = opt || {};
    var box = $(opt.box || 'mlApplied');
    if (!box) return;
    styleOnce();
    load(box);
  }

  function load(box) {
    box.innerHTML = '<div class="mp-msg">불러오는 중…</div>';

    waitSb(function (c) {
      if (!c) { box.innerHTML = '<div class="mp-msg">자료를 불러오지 못했습니다.</div>'; return; }

      c.auth.getUser().then(function (ur) {
        var u = ur && ur.data && ur.data.user;
        if (!u) { box.innerHTML = '<div class="mp-msg">로그인이 필요합니다.</div>'; return; }

        /* ① 내 신청 — 줄 보안(app_read_mine)이 내 것만 넘겨 줍니다 */
        return c.from('lesson_applications')
          .select('id,lesson_id,status,message,created_at')
          .order('created_at', { ascending: false })
          .then(function (ar) {
            if (ar.error) throw new Error(ar.error.message);
            var apps = ar.data || [];
            if (!apps.length) {
              box.innerHTML = '<div class="mp-msg">아직 신청한 레슨이 없습니다.<br>'
                + '<a href="/lesson/index.html" style="text-decoration:underline">레슨:ON 둘러보기 &#8594;</a></div>';
              return;
            }

            /* ② 강의 정보 — 뷰라서 관계 조인이 안 되므로 따로 읽습니다 */
            var ids = apps.map(function (a) { return a.lesson_id; });
            return c.from('lessons_public')
              .select('id,title,tab,kind,status,cover_url,video_provider,video_id,'
                    + 'schedule_text,start_at,capacity,applied,instructor_name,source,credit,field')
              .in('id', ids)
              .then(function (lr) {
                var map = {};
                (lr.data || []).forEach(function (l) { map[l.id] = l; });
                draw(c, box, apps, map);
              });
          });
      })['catch'](function (e) {
        box.innerHTML = '<div class="mp-msg">불러오지 못했습니다 — ' + esc(e.message || e) + '</div>';
      });
    });
  }

  function draw(c, box, apps, map) {
    box.innerHTML = apps.map(function (a) {
      var l = map[a.lesson_id];
      var s = ST[a.status] || { t: a.status, c: 'off' };
      var dim = (a.status === 'canceled' || a.status === 'rejected');

      /* 강의가 내려간 경우 — 빈 줄로 두면 신청이 사라진 줄 압니다 */
      if (!l) {
        return '<div class="ml-row off">'
          + '<div class="ml-th"></div>'
          + '<div class="ml-in">'
          +   '<div class="ml-t">강의가 내려갔습니다</div>'
          +   '<div class="ml-meta"><span class="ml-st ' + s.c + '">' + esc(s.t) + '</span>'
          +     fmt(a.created_at) + ' 신청</div>'
          +   '<div class="ml-gone">인스트럭터가 강의를 준비중으로 되돌렸거나 감춘 상태입니다. '
          +     '신청 기록은 그대로 남아 있습니다.</div>'
          + '</div></div>';
      }

      var thumb = l.cover_url
        || (l.video_provider === 'youtube' && l.video_id
              ? 'https://i.ytimg.com/vi/' + encodeURIComponent(l.video_id) + '/hqdefault.jpg' : '');

      var meta = [];
      meta.push(TAB[l.tab] || l.tab);
      if (l.field) meta.push(esc(l.field));
      if (l.source === 'curated' && l.credit) meta.push(esc(l.credit));
      else if (l.instructor_name) meta.push(esc(l.instructor_name));
      if (l.kind === 'group' && l.capacity) meta.push('참여 ' + (l.applied || 0) + '/' + l.capacity);
      if (l.schedule_text) meta.push(esc(l.schedule_text));

      /* 할 수 있는 일 —
           승인   → 참여 링크 받기
           대기   → 신청 취소
           그 밖  → 강의만 보기 */
      var act = '';
      if (a.status === 'approved') {
        act = '<button type="button" class="go" data-live="' + esc(l.id) + '">참여 링크 받기</button>';
      } else if (a.status === 'pending') {
        act = '<button type="button" data-cancel="' + esc(a.id) + '">신청 취소</button>';
      }
      act += '<a href="/lesson/lesson-view.html?id=' + encodeURIComponent(l.id) + '">강의정보</a>';

      return '<div class="ml-row' + (dim ? ' off' : '') + '" id="mlr_' + esc(a.id) + '">'
        + '<div class="ml-th">' + (thumb ? '<img src="' + esc(thumb) + '" alt="">' : '') + '</div>'
        + '<div class="ml-in">'
        +   '<a class="ml-t" href="/lesson/lesson-view.html?id=' + encodeURIComponent(l.id) + '">'
        +     esc(l.title || '-') + '</a>'
        +   '<div class="ml-meta"><span class="ml-st ' + s.c + '">' + esc(s.t) + '</span>'
        +     meta.join(' · ') + ' · ' + fmt(a.created_at) + ' 신청</div>'
        +   (a.message ? '<div class="ml-msg2">' + esc(a.message) + '</div>' : '')
        + '</div>'
        + '<div class="ml-act">' + act + '</div>'
        + '</div>';
    }).join('');

    /* ── 참여 링크 받기 ─────────────────────────────────────
       ★ 링크는 <b>서버 함수로만</b> 받습니다 — 강의 표에 들어 있지만
         뷰에서 빼 두었으므로, 승인되지 않은 사람에게는 넘어가지
         않습니다. */
    Array.prototype.forEach.call(box.querySelectorAll('[data-live]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-live');
        b.disabled = true; b.textContent = '받는 중…';
        c.rpc('oc_lesson_live_url', { p_lesson: id }).then(function (rr) {
          var url = (rr && !rr.error) ? rr.data : null;
          if (!url) {
            b.disabled = false; b.textContent = '참여 링크 받기';
            alert('참여 링크가 아직 등록되지 않았습니다. 인스트럭터에게 문의해 주십시오.');
            return;
          }
          b.outerHTML = '<a class="go" href="' + esc(url) + '" target="_blank" rel="noopener">참여하기 &#8599;</a>';
        });
      });
    });

    /* ── 신청 취소 ──────────────────────────────────────── */
    Array.prototype.forEach.call(box.querySelectorAll('[data-cancel]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('이 신청을 취소합니다. 계속하시겠습니까?')) return;
        var id = b.getAttribute('data-cancel');
        b.disabled = true;
        /* ★ 몇 줄이 바뀌었는지 <b>받아서</b> 봅니다 —
           줄 보안에 막히면 오류 없이 0줄이 됩니다. */
        c.from('lesson_applications').update({ status: 'canceled' }).eq('id', id).select('id')
          .then(function (rr) {
            if (rr.error || !(rr.data || []).length) {
              b.disabled = false;
              alert('취소하지 못했습니다. 잠시 뒤 다시 시도해 주십시오.');
              return;
            }
            load(box);
          });
      });
    });
  }

  window.OCLessonMy = { init: init };
})();
