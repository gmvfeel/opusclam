/* ══════════════════════════════════════════════════════════════
   레슨:ON 리뷰 엔진 — assets/lesson-review.js
   2026-08-06

   무엇을 하나
     OCLessonReview.mount(box, lesson)   강의정보 화면의 리뷰 영역

   왜 필요한가
     강사 심사를 <b>서류 확인만</b> 으로 하기로 정했습니다(실력은 판정하지
     않습니다). 그러면 실력을 가려 주는 몫은 <b>리뷰</b>가 맡습니다.
     리뷰가 없으면 회원이 강사를 고를 근거가 없습니다.

   ★ 큐레이션에는 리뷰를 <b>두지 않습니다</b>
     남이 공개한 영상입니다. 우리 사이트에서 별점이 낮게 매겨지면
     원작자에게 무례하고, 평가할 대상은 「우리가 고른 안목」이지 그
     영상의 품질이 아닙니다. 화면에서 아예 그리지 않고, 표의 지키개도
     막습니다(두 겹).

   ★ 누가 쓸 수 있나 — 서버(줄 보안)가 정합니다. 화면은 <b>안내를 위해</b>
     한 번 더 봅니다. 화면만 막으면 우회할 수 있고, 서버만 막으면
     「왜 안 되는지」를 알 수 없습니다.
       · 실시간 레슨(1:1·그룹) → 승인된 수강생만
       · 녹화 강의            → 로그인한 회원
       · 자기 강의            → 쓸 수 없습니다(자화자찬 방지)

   ★ 한 사람이 한 강의에 하나 — 이미 썼으면 <b>고치기</b>가 됩니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCLessonReview) return;

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  function esc(v) { var d = document.createElement('div'); d.textContent = (v == null ? '' : String(v)); return d.innerHTML; }

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

  function fmt(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
    } catch (e) { return ''; }
  }

  /* 별 다섯 — 점수만큼 채웁니다. 반 개는 쓰지 않습니다(읽기 쉽게) */
  function stars(n, cls) {
    var v = Math.round(Number(n) || 0);
    var out = '';
    for (var i = 1; i <= 5; i++) out += (i <= v ? '&#9733;' : '&#9734;');
    return '<span class="rv-st ' + (cls || '') + '">' + out + '</span>';
  }

  function styleOnce() {
    if (window.__ocRvCss) return;
    window.__ocRvCss = true;
    var css = ''
      + '.rv-head{display:flex;align-items:flex-end;gap:26px;flex-wrap:wrap;'
      +   'padding-bottom:22px;border-bottom:1px solid var(--ln-line,rgba(255,255,255,.12));}'
      + '.rv-avg{display:flex;align-items:baseline;gap:10px;}'
      + '.rv-avg b{font-size:40px;font-weight:300;line-height:1;color:var(--ln-tx,#f2eff8);'
      +   'font-family:var(--display,inherit);}'
      + '.rv-avg span{font-size:13px;color:var(--ln-tx3,#8a86a0);}'
      + '.rv-st{letter-spacing:2px;color:#e0b34a;font-size:16px;}'
      + '.rv-st.sm{font-size:13px;letter-spacing:1px;}'
      + '.rv-st.pick{font-size:30px;letter-spacing:4px;cursor:pointer;color:#5a5a68;}'
      + '.rv-st.pick i{font-style:normal;cursor:pointer;transition:transform .12s ease;}'
      + '.rv-st.pick i.on{color:#e0b34a;}'
      + '.rv-st.pick i:hover{transform:scale(1.14);}'
      + '.rv-none{padding:26px 0;font-size:13.5px;line-height:1.8;color:var(--ln-tx3,#8a86a0);}'

      + '.rv-list{margin-top:6px;}'
      + '.rv-row{padding:20px 0;border-bottom:1px solid rgba(255,255,255,.07);}'
      + '.rv-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}'
      + '.rv-nm{font-size:13.5px;font-weight:600;color:var(--ln-tx,#f2eff8);}'
      + '.rv-dt{font-size:12px;color:var(--ln-tx3,#8a86a0);margin-left:auto;}'
      + '.rv-bd{margin:9px 0 0;font-size:13.5px;line-height:1.85;color:var(--ln-tx2,#c9c6d6);'
      +   'white-space:pre-wrap;}'
      + '.rv-mine{font-size:11px;font-weight:800;padding:2px 7px;border-radius:3px;'
      +   'background:rgba(162,78,167,.24);color:#e0c3f5;}'
      + '.rv-act{display:flex;gap:12px;margin-top:10px;}'
      + '.rv-act button{background:none;border:0;padding:0;font:inherit;font-size:12px;'
      +   'color:#b79ad6;cursor:pointer;text-decoration:underline;}'
      + '.rv-act button.del{color:#d99;}'

      + '.rv-form{margin-top:22px;padding:20px 22px;border-radius:12px;'
      +   'background:rgba(255,255,255,.035);border:1px solid var(--ln-line,rgba(255,255,255,.12));}'
      + '.rv-form h4{margin:0 0 14px;font-size:14px;font-weight:600;color:var(--ln-tx,#f2eff8);}'
      + '.rv-note{margin:-6px 0 13px;font-size:12.5px;line-height:1.7;color:var(--ln-tx3,#8a86a0);}'
      + '.rv-note b{color:var(--ln-tx2,#c9c6d6);}'
      + '.rv-form textarea{width:100%;min-height:96px;padding:12px 14px;border-radius:8px;'
      +   'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);'
      +   'color:#f2eff8;font:inherit;font-size:13.5px;line-height:1.8;resize:vertical;}'
      + '.rv-form textarea:focus{outline:none;border-color:#a24ea7;}'
      + '.rv-form textarea::placeholder{color:#8a86a0;}'
      + '.rv-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:12px;}'
      + '.rv-cnt{font-size:12px;color:var(--ln-tx3,#8a86a0);margin-left:auto;}'
      + '.rv-say{margin-top:12px;padding:11px 14px;border-radius:8px;font-size:13px;line-height:1.7;}'
      + '.rv-say.ok{background:rgba(120,200,150,.12);border:1px solid rgba(120,200,150,.32);color:#bfe6cd;}'
      + '.rv-say.no{background:rgba(230,120,120,.12);border:1px solid rgba(230,120,120,.32);color:#f0c3c3;}'
      + '.rv-gate{padding:16px 18px;border-radius:10px;font-size:13px;line-height:1.8;'
      +   'background:rgba(255,255,255,.035);border:1px solid var(--ln-line,rgba(255,255,255,.12));'
      +   'color:var(--ln-tx3,#8a86a0);margin-top:22px;}'
      + '.rv-gate a{color:#b79ad6;}'
      + '@media (max-width:640px){.rv-avg b{font-size:32px;}.rv-dt{margin-left:0;width:100%;}}';
    var s = document.createElement('style');
    s.setAttribute('data-oc', 'lesson-review');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ══ 붙이기 ═════════════════════════════════════════════════════
     box    : 그릴 자리(요소)
     lesson : lessons_public 에서 읽어 온 강의 (source·kind·member_id 필요) */
  function mount(box, lesson) {
    if (!box || !lesson) return;

    /* ★ 큐레이션이면 <b>아예 그리지 않습니다</b> */
    if (lesson.source === 'curated') { box.innerHTML = ''; return; }

    styleOnce();
    var ME = null, MINE = null, ROWS = [], pick = 0, editing = false;

    box.innerHTML = '<div class="ln-msg">리뷰를 불러오는 중…</div>';

    waitSb(function (c) {
      if (!c) { box.innerHTML = ''; return; }

      c.auth.getUser().then(function (ur) {
        ME = (ur && ur.data && ur.data.user) || null;
        return load(c);
      })['catch'](function () { box.innerHTML = ''; });
    });

    /* ── 읽기 ────────────────────────────────────────────────
       ★ 이름은 <b>따로</b> 붙입니다 — members 는 「자기 것만」으로
         막혀 있어 리뷰와 한 번에 조인할 수 없습니다. 이름을 못 받으면
         「회원」으로 두고 별점과 내용만 보여 줍니다(빈 화면보다 낫습니다). */
    function load(c) {
      return c.from('lesson_reviews')
        .select('id,member_id,rating,body,created_at,updated_at')
        .eq('lesson_id', lesson.id)
        .order('created_at', { ascending: false })
        .then(function (r) {
          if (r.error) throw new Error(r.error.message);
          ROWS = r.data || [];
          MINE = ME ? (ROWS.filter(function (x) { return x.member_id === ME.id; })[0] || null) : null;
          pick = MINE ? MINE.rating : 0;

          /* 내 이름만 받아 옵니다(내 것은 읽을 수 있습니다) */
          if (ME) {
            return c.from('members').select('name').eq('id', ME.id).maybeSingle()
              .then(function (mr) { draw(c, (mr && mr.data && mr.data.name) || null); });
          }
          draw(c, null);
        })['catch'](function (e) {
          box.innerHTML = '<div class="rv-none">리뷰를 불러오지 못했습니다 — ' + esc(e.message || e) + '</div>';
        });
    }

    /* ── 쓸 수 있나 (안내를 위한 판단 · 서버가 최종 결정) ────── */
    function canWrite() {
      if (!ME) return { ok: false, why: 'login' };
      if (lesson.member_id && lesson.member_id === ME.id) return { ok: false, why: 'own' };
      if (lesson.kind === 'vod') return { ok: true };
      /* 실시간 레슨은 승인된 수강생만 — 신청 기록으로 봅니다 */
      return { ok: 'check' };
    }

    function draw(c, myName) {
      var n = ROWS.length;
      var avg = n ? (ROWS.reduce(function (a, x) { return a + (x.rating || 0); }, 0) / n) : 0;

      var head =
          '<div class="rv-head">'
        +   '<div class="rv-avg"><b>' + (n ? avg.toFixed(1) : '-') + '</b>'
        +     '<span>/ 5.0</span></div>'
        +   '<div>' + stars(avg) + '<div style="font-size:12px;color:var(--ln-tx3);margin-top:5px">'
        +     (n ? n + '개의 리뷰' : '아직 리뷰가 없습니다') + '</div></div>'
        + '</div>';

      var list = n
        ? '<div class="rv-list">' + ROWS.map(function (x) {
            var mine = ME && x.member_id === ME.id;
            return '<div class="rv-row">'
              + '<div class="rv-top">'
              +   stars(x.rating, 'sm')
              +   '<span class="rv-nm">' + esc(mine ? (myName || '나') : '회원') + '</span>'
              +   (mine ? '<span class="rv-mine">내 리뷰</span>' : '')
              +   '<span class="rv-dt">' + fmt(x.created_at)
              +     (x.updated_at && x.updated_at !== x.created_at ? ' (고침)' : '') + '</span>'
              + '</div>'
              + (x.body ? '<p class="rv-bd">' + esc(x.body) + '</p>' : '')
              + (mine
                  ? '<div class="rv-act">'
                    + '<button type="button" data-edit="1">고치기</button>'
                    + '<button type="button" class="del" data-del="' + esc(x.id) + '">지우기</button>'
                    + '</div>'
                  : '')
              + '</div>';
          }).join('') + '</div>'
        : '<div class="rv-none">첫 리뷰를 남겨 주십시오. 다른 회원이 강의를 고르는 데 큰 도움이 됩니다.</div>';

      var cw = canWrite();
      var form = '';

      if (cw.ok === false && cw.why === 'login') {
        form = '<div class="rv-gate">리뷰는 <b>로그인</b> 뒤에 남기실 수 있습니다. '
             + '<a href="/account/login.html?next=' + encodeURIComponent(location.pathname + location.search) + '">로그인 &#8594;</a></div>';
      } else if (cw.ok === false && cw.why === 'own') {
        form = '<div class="rv-gate"><b>내가 올린 강의</b>입니다. 자기 강의에는 리뷰를 남길 수 없습니다.</div>';
      } else {
        /* 쓸 수 있거나(vod) · 확인이 필요한 경우(실시간) */
        form =
            '<div class="rv-form" id="rvForm">'
          +   '<h4>' + (MINE ? '내 리뷰 고치기' : '리뷰 남기기') + '</h4>'
          /* ★ 실시간 레슨은 <b>승인된 수강생만</b> — 미리 알려 줍니다.
             쓴 뒤에 막히면 헛수고가 되고 「고장」으로 보입니다.
             (막는 것은 서버가 합니다. 여기서는 안내만 합니다) */
          +   (cw.ok === 'check' && !MINE
                ? '<p class="rv-note">이 레슨은 <b>승인된 수강생</b>만 리뷰를 남길 수 있습니다.</p>'
                : '')
          +   '<div class="rv-st pick" id="rvPick" role="radiogroup" aria-label="별점">'
          +     [1,2,3,4,5].map(function (i) {
                  return '<i data-v="' + i + '" class="' + (i <= pick ? 'on' : '') + '"'
                       + ' role="radio" aria-checked="' + (i === pick) + '" tabindex="0">'
                       + (i <= pick ? '&#9733;' : '&#9734;') + '</i>';
                }).join('')
          +   '</div>'
          +   '<textarea id="rvBody" maxlength="1000" placeholder="어떤 점이 좋았는지, 어떤 분께 권하고 싶은지 적어 주십시오.">'
          +     esc(MINE ? (MINE.body || '') : '') + '</textarea>'
          +   '<div class="rv-foot">'
          +     '<button type="button" class="ln-btn go" id="rvSave">'
          +       (MINE ? '고쳐서 올리기' : '리뷰 올리기') + '</button>'
          +     '<span class="rv-cnt"><b id="rvN">' + ((MINE && MINE.body) ? MINE.body.length : 0) + '</b> / 1,000</span>'
          +   '</div>'
          +   '<div id="rvSay"></div>'
          + '</div>';
      }

      box.innerHTML = head + list + form;
      bind(c);
    }

    function bind(c) {
      /* 별 고르기 */
      var pk = document.getElementById('rvPick');
      if (pk) {
        [].forEach.call(pk.querySelectorAll('i'), function (el) {
          function set() {
            pick = parseInt(el.getAttribute('data-v'), 10) || 0;
            [].forEach.call(pk.querySelectorAll('i'), function (o) {
              var v = parseInt(o.getAttribute('data-v'), 10);
              o.className = (v <= pick ? 'on' : '');
              o.innerHTML = (v <= pick ? '&#9733;' : '&#9734;');
              o.setAttribute('aria-checked', v === pick);
            });
          }
          el.addEventListener('click', set);
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(); }
          });
        });
      }

      /* 글자 수 */
      var bd = document.getElementById('rvBody'), cnt = document.getElementById('rvN');
      if (bd && cnt) bd.addEventListener('input', function () { cnt.textContent = bd.value.length; });

      /* 올리기 */
      var sv = document.getElementById('rvSave');
      if (sv) sv.addEventListener('click', function () { save(c, this); });

      /* 고치기 — 폼으로 옮겨 줍니다 */
      [].forEach.call(box.querySelectorAll('[data-edit]'), function (b) {
        b.addEventListener('click', function () {
          var f = document.getElementById('rvForm');
          if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
          var t = document.getElementById('rvBody');
          if (t) t.focus();
        });
      });

      /* 지우기 */
      [].forEach.call(box.querySelectorAll('[data-del]'), function (b) {
        b.addEventListener('click', function () {
          if (!confirm('내 리뷰를 지웁니다. 되돌릴 수 없습니다.\n계속하시겠습니까?')) return;
          var id = b.getAttribute('data-del');
          b.disabled = true;
          c.from('lesson_reviews').delete().eq('id', id).select('id').then(function (r) {
            if (r.error || !(r.data || []).length) { b.disabled = false; alert('지우지 못했습니다.'); return; }
            MINE = null; pick = 0;
            load(c);
          });
        });
      });
    }

    function say(kind, html) {
      var e = document.getElementById('rvSay');
      if (e) e.innerHTML = html ? '<div class="rv-say ' + kind + '">' + html + '</div>' : '';
    }

    function save(c, btn) {
      var body = (document.getElementById('rvBody') || {}).value || '';
      if (!pick) { say('no', '<b>별점</b>을 골라 주십시오.'); return; }

      var old = btn.textContent;
      btn.disabled = true; btn.textContent = '올리는 중…';
      say('', '');

      var row = {
        lesson_id: lesson.id,
        member_id: ME.id,
        rating: pick,
        body: body.trim() || null
      };

      /* 이미 쓴 것이 있으면 고치기 */
      var job = MINE
        ? c.from('lesson_reviews').update({ rating: row.rating, body: row.body })
            .eq('id', MINE.id).select('id')
        : c.from('lesson_reviews').insert(row).select('id');

      job.then(function (r) {
        /* ★ 몇 줄이 바뀌었는지 <b>받아서</b> 확인합니다 —
           줄 보안에 막히면 오류 없이 0줄이 됩니다. */
        if (r.error) throw new Error(r.error.message);
        if (!(r.data || []).length) {
          throw new Error(lesson.kind === 'vod'
            ? '올리지 못했습니다. 로그인을 확인해 주십시오.'
            : '이 레슨은 <b>승인된 수강생</b>만 리뷰를 남길 수 있습니다.');
        }
        say('ok', MINE ? '리뷰를 고쳤습니다.' : '리뷰를 올렸습니다. 고맙습니다.');
        setTimeout(function () { load(c); }, 700);
      })['catch'](function (e) {
        btn.disabled = false; btn.textContent = old;
        var m = String(e.message || e);
        /* 서버가 알려 주는 까닭을 회원 말로 바꿔 줍니다 */
        if (/duplicate|unique/i.test(m)) m = '이미 리뷰를 남기셨습니다. 새로 고쳐 주십시오.';
        else if (/curated/i.test(m) || /큐레이션/.test(m)) m = '이 강의에는 리뷰를 남길 수 없습니다.';
        else if (/row-level|policy|violates/i.test(m)) {
          m = (lesson.kind === 'vod')
            ? '리뷰를 남길 수 없습니다. 로그인을 확인해 주십시오.'
            : '이 레슨은 <b>승인된 수강생</b>만 리뷰를 남길 수 있습니다.';
        }
        say('no', m);
      });
    }
  }

  window.OCLessonReview = { mount: mount, stars: stars };
})();
