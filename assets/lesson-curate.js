/* ══════════════════════════════════════════════════════════════
   레슨:ON 큐레이션 일괄 등록 엔진 — assets/lesson-curate.js
   2026-08-06

   무엇을 하나
     OCLessonCurate.page()   관리자만 · 유튜브 주소를 여러 줄 붙여
                             마스터클래스 탭에 한꺼번에 등록

   왜 강의 등록 화면과 따로 만드나
     lesson-write.html 은 「승인된 인스트럭터가 <b>자기</b> 강의를
     내는」 화면입니다. 큐레이션은 성격이 다릅니다 —
       · 강사가 없습니다 (instructor_id = null)
       · 남이 공개한 영상이라 <b>출처가 반드시</b> 있어야 합니다
       · 한 번에 여러 개를 넣습니다
     인스트럭터 화면에 억지로 태우면 「그 강사가 만든 강의」로
     보이게 되어 정직하지 않습니다. 그래서 길을 따로 냅니다.

   ★ 제목·채널이름을 <b>손으로 치지 않습니다</b>
     유튜브 oEmbed(공개 정보 · 열쇠도 값도 필요 없음)에서 가져옵니다.
     혹시 막히면 제목 칸을 비워 두고 파트너가 적으시면 됩니다 —
     표지는 주소만 있으면 늘 나옵니다.

   ★ 등록 전에 <b>여기서 재생해 봅니다</b>
     임베드를 막아 둔 영상은 우리 사이트에서 재생되지 않습니다.
     올린 뒤에 알면 지우러 다시 와야 하므로, 각 줄에서 미리 봅니다.

   ★ 값은 늘 0 입니다
     화면에서 아예 받지 않고, 표의 지키개도 0 으로 못박습니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCLessonCurate) return;

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  /* ── 분야 (여덟 갈래) ──────────────────────────────────────────
     ★ 이 목록은 <b>네 파일이 함께</b> 씁니다 — 하나만 고치면 어긋납니다.
         assets/lesson-curate.js      큐레이션 등록
         assets/lesson-instructor.js  인스트럭터 신청 · 목록 분류
         assets/lesson-list.js        강의 목록 분류
         assets/lesson-write.js       강의 등록
     ★ 2026-08-06 — PIANO · VOCAL 을 더했습니다.
       마스터클래스 영상은 <b>피아노가 가장 많고</b>, 성악도 적지 않은데
       처음 목록(시안)은 오케스트라 악기만 담고 있어 둘 다 「기타」로
       들어갔습니다. 그러면 회원이 분야로 찾을 수 없고, 피아노·성악
       전공 강사가 <b>자기 분야를 고를 수 없습니다</b>.
     ★ 값을 바꿀 때는 표의 CHECK 제약도 함께 봐야 합니다
       (sql/lesson-fields-01.sql 참고). */
  var FIELDS = ['PIANO', 'STRINGS', 'BRASS', 'WINDS', 'PERCUSSIONS', 'VOCAL', '작곡/이론', '기타'];

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

  /* ── 주소에서 유튜브 ID 뽑기 ─────────────────────────────────
     lesson-write.js 와 같은 규칙입니다. 모양이 여럿이라 다 받습니다. */
  function ytId(url) {
    var s = String(url || '').trim();
    if (!s) return null;
    if (/^[\w-]{11}$/.test(s)) return s;              /* ID 만 넣은 경우 */
    var m;
    m = s.match(/youtu\.be\/([\w-]{11})/);            if (m) return m[1];
    m = s.match(/[?&]v=([\w-]{11})/);                 if (m) return m[1];
    m = s.match(/youtube\.com\/(?:embed|live|shorts|v)\/([\w-]{11})/);
                                                      if (m) return m[1];
    return null;
  }
  function thumb(id) { return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg'; }
  function watch(id) { return 'https://www.youtube.com/watch?v=' + encodeURIComponent(id); }

  /* ── 유튜브에서 제목·채널이름 가져오기 ───────────────────────
     oEmbed 는 열쇠(API key)가 필요 없는 공개 창구입니다.
     막히면 null 을 돌려주고 화면에서 직접 적게 합니다. */
  function oembed(id, cb) {
    var url = 'https://www.youtube.com/oembed?url='
            + encodeURIComponent(watch(id)) + '&format=json';
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; cb(null); } }, 7000);
    try {
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error('oembed ' + r.status);
        return r.json();
      }).then(function (j) {
        if (done) return; done = true; clearTimeout(t);
        cb({ title: j.title || '', author: j.author_name || '' });
      })['catch'](function () {
        if (done) return; done = true; clearTimeout(t);
        cb(null);
      });
    } catch (e) { if (!done) { done = true; clearTimeout(t); cb(null); } }
  }

  /* ══ 화면 ════════════════════════════════════════════════════ */
  function page() {
    var gate = $('cuGate'), box = $('cuBox');
    if (!gate || !box) return;

    var ME = null;
    var ROWS = [];        /* 불러온 줄들 */
    var HAVE = {};        /* 이미 등록된 video_id */

    function say(el, kind, html) {
      var e = $(el); if (!e) return;
      e.innerHTML = html ? '<div class="cu-say ' + kind + '">' + html + '</div>' : '';
    }
    function show(el, on) {
      var e = (typeof el === 'string') ? $(el) : el;
      if (!e) return;
      if (on) { e.removeAttribute('hidden'); e.style.display = ''; }
      else    { e.setAttribute('hidden', ''); e.style.display = 'none'; }
    }

    /* ── 문 지키기 — 관리자만 ─────────────────────────────────── */
    waitSb(function (c) {
      if (!c) { gate.innerHTML = '<div class="cu-say no">연결이 되지 않았습니다. 새로 고쳐 주십시오.</div>'; return; }

      c.auth.getUser().then(function (r) {
        var u = r && r.data && r.data.user;
        if (!u) {
          gate.innerHTML = '<div class="cu-say no">이 화면은 <b>관리자</b>만 쓸 수 있습니다. '
            + '<a href="/account/login.html?next=' + encodeURIComponent(location.pathname) + '">로그인</a> 해 주십시오.</div>';
          return;
        }
        return c.from('members').select('id,name,email,is_admin').eq('id', u.id).maybeSingle()
          .then(function (mr) {
            var m = mr && mr.data;
            if (!m || m.is_admin !== true) {
              gate.innerHTML = '<div class="cu-say no">이 화면은 <b>관리자</b>만 쓸 수 있습니다.</div>';
              return;
            }
            ME = m;
            gate.innerHTML = '<div class="cu-say ok"><b>' + esc(m.name || m.email) + '</b> 님 · 관리자로 들어오셨습니다.</div>';
            show(box, true);
            bind(c);
            loadHave(c);
            loadList(c);
          });
      })['catch'](function (e) {
        gate.innerHTML = '<div class="cu-say no">확인에 실패했습니다 — ' + esc(e.message || e) + '</div>';
      });
    });

    /* ── 이미 등록된 영상 ID 모으기 (같은 영상 두 번 막기) ────── */
    function loadHave(c) {
      c.from('lessons').select('video_id').eq('video_provider', 'youtube')
        .then(function (r) {
          HAVE = {};
          (r.data || []).forEach(function (x) { if (x.video_id) HAVE[x.video_id] = true; });
        });
    }

    /* ══ ① 주소 불러오기 ═══════════════════════════════════════ */
    function bind(c) {
      $('cuLoad').addEventListener('click', function () {
        var raw = ($('cuPaste').value || '').split(/[\r\n,]+/);
        var ids = [], dup = 0, bad = 0, already = 0;

        raw.forEach(function (line) {
          var s = String(line || '').trim();
          if (!s) return;
          var id = ytId(s);
          if (!id) { bad++; return; }
          if (HAVE[id]) { already++; return; }
          if (ids.indexOf(id) >= 0) { dup++; return; }
          if (ROWS.some(function (r) { return r.id === id; })) { dup++; return; }
          ids.push(id);
        });

        var msg = [];
        if (ids.length) msg.push('<b>' + ids.length + '개</b>를 불러옵니다.');
        if (already) msg.push(already + '개는 <b>이미 등록</b>되어 있어 건너뜁니다.');
        if (dup) msg.push(dup + '개는 <b>같은 영상</b>이라 건너뜁니다.');
        if (bad) msg.push(bad + '줄은 <b>유튜브 주소로 보이지 않아</b> 건너뜁니다.');
        say('cuSay', ids.length ? 'ok' : 'no', msg.join(' '));

        if (!ids.length) return;
        $('cuPaste').value = '';

        /* 한 줄씩 차례로 — 한꺼번에 부르면 유튜브가 막습니다 */
        var i = 0;
        (function next() {
          if (i >= ids.length) { render(); return; }
          var id = ids[i++];
          ROWS.push({ id: id, title: '', credit: '', field: '', on: true, loading: true });
          render();
          oembed(id, function (info) {
            var row = ROWS.filter(function (r) { return r.id === id; })[0];
            if (row) {
              row.loading = false;
              if (info) { row.title = info.title; row.credit = info.author; }
            }
            render();
            setTimeout(next, 180);
          });
        })();
      });

      $('cuSave').addEventListener('click', function () { save(c, this); });
    }

    /* ══ ② 표 그리기 ═══════════════════════════════════════════ */
    function render() {
      var wrap = $('cuRows');
      if (!ROWS.length) {
        wrap.innerHTML = '<p class="cu-empty">위 칸에 유튜브 주소를 붙이고 <b>불러오기</b>를 누르십시오.</p>';
        show('cuFoot', false);
        return;
      }
      show('cuFoot', true);

      wrap.innerHTML = ROWS.map(function (r, n) {
        var fopt = '<option value="">분야 고르기</option>'
          + FIELDS.map(function (f) {
              return '<option value="' + esc(f) + '"' + (r.field === f ? ' selected' : '') + '>' + esc(f) + '</option>';
            }).join('');

        return '<div class="cu-row' + (r.on ? '' : ' off') + '" data-n="' + n + '">'
          +   '<label class="cu-chk"><input type="checkbox" data-a="on"' + (r.on ? ' checked' : '') + '><span></span></label>'
          +   '<div class="cu-th"><img src="' + esc(thumb(r.id)) + '" alt=""></div>'
          +   '<div class="cu-f">'
          +     '<input type="text" data-a="title" placeholder="'
          +        (r.loading ? '유튜브에서 제목을 가져오는 중…' : '제목 — 직접 적어 주십시오')
          +        '" value="' + esc(r.title) + '">'
          +     '<div class="cu-f2">'
          +       '<input type="text" data-a="credit" placeholder="채널 이름 (출처 · 반드시)" value="' + esc(r.credit) + '">'
          +       '<select data-a="field">' + fopt + '</select>'
          +     '</div>'
          +     '<div class="cu-links">'
          +       '<button type="button" class="cu-mini" data-a="play">▶ 여기서 재생해 보기</button>'
          +       '<a class="cu-mini" href="' + esc(watch(r.id)) + '" target="_blank" rel="noopener">유튜브에서 보기 &#8599;</a>'
          +       '<button type="button" class="cu-mini del" data-a="del">이 줄 지우기</button>'
          +       '<span class="cu-id">' + esc(r.id) + '</span>'
          +     '</div>'
          +     (r.play
                  ? '<div class="cu-play"><iframe src="https://www.youtube-nocookie.com/embed/'
                    + encodeURIComponent(r.id) + '" title="미리보기" allowfullscreen '
                    + 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" '
                    + 'referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>'
                    + '<p class="cu-hint">검은 화면에 「다른 웹사이트에서 재생 중지」가 나오면 '
                    + '<b>그 영상이 임베드를 막아 둔 것</b>입니다. 이 줄은 지우고 다른 영상을 쓰십시오.</p></div>'
                  : '')
          +   '</div>'
          + '</div>';
      }).join('');

      /* 각 줄의 손잡이 걸기 */
      Array.prototype.forEach.call(wrap.querySelectorAll('.cu-row'), function (el) {
        var n = parseInt(el.getAttribute('data-n'), 10);
        var r = ROWS[n]; if (!r) return;

        el.querySelector('[data-a="on"]').addEventListener('change', function () {
          r.on = this.checked; el.className = 'cu-row' + (r.on ? '' : ' off');
        });
        el.querySelector('[data-a="title"]').addEventListener('input', function () { r.title = this.value; });
        el.querySelector('[data-a="credit"]').addEventListener('input', function () { r.credit = this.value; });
        el.querySelector('[data-a="field"]').addEventListener('change', function () { r.field = this.value; });
        el.querySelector('[data-a="play"]').addEventListener('click', function () { r.play = !r.play; render(); });
        el.querySelector('[data-a="del"]').addEventListener('click', function () {
          ROWS.splice(n, 1); render();
        });
      });

      var on = ROWS.filter(function (r) { return r.on; }).length;
      $('cuCount').textContent = on;
    }

    /* ══ ③ 한꺼번에 등록 ═══════════════════════════════════════ */
    function save(c, btn) {
      var picked = ROWS.filter(function (r) { return r.on; });
      if (!picked.length) { say('cuSay2', 'no', '등록할 줄을 골라 주십시오.'); return; }

      /* 지키개가 출처 없는 큐레이션을 막습니다 — 미리 걸러 안내합니다 */
      var noCredit = picked.filter(function (r) { return !String(r.credit || '').trim(); });
      if (noCredit.length) {
        say('cuSay2', 'no', '<b>채널 이름(출처)</b>이 빈 줄이 ' + noCredit.length + '개 있습니다. '
          + '남의 영상을 출처 없이 올릴 수는 없습니다 — 채워 주십시오.');
        return;
      }
      var noTitle = picked.filter(function (r) { return !String(r.title || '').trim(); });
      if (noTitle.length) {
        say('cuSay2', 'no', '<b>제목</b>이 빈 줄이 ' + noTitle.length + '개 있습니다.');
        return;
      }

      var status = $('cuStatus').value || 'open';
      var rows = picked.map(function (r) {
        return {
          member_id:       ME.id,        /* 넣은 사람 = 관리자 (정책이 요구합니다) */
          instructor_id:   null,         /* 강사 없음 — 모아온 영상입니다 */
          kind:            'vod',
          tab:             'master',
          status:          status,
          source:          'curated',    /* 지키개가 값을 0 으로 못박습니다 */
          field:           r.field || null,
          title:           String(r.title).trim(),
          cover_url:       null,         /* 비워 두면 유튜브 표지를 씁니다 */
          video_provider:  'youtube',
          video_id:        r.id,
          sample_provider: 'none',
          credit:          String(r.credit).trim(),
          credit_url:      watch(r.id),
          price:           0,
          is_public:       true,
          sort_order:      0
        };
      });

      var old = btn.textContent;
      btn.disabled = true; btn.textContent = '등록하는 중…';
      say('cuSay2', '', '');

      c.from('lessons').insert(rows).select('id').then(function (r) {
        /* ★ 몇 줄이 들어갔는지 <b>받아서</b> 확인합니다 —
           줄 보안에 막히면 오류 없이 0줄이 됩니다. */
        if (r.error) throw new Error(r.error.message);
        var n = (r.data || []).length;
        if (!n) throw new Error('한 줄도 들어가지 않았습니다. 관리자 권한을 확인해 주십시오.');

        ROWS = ROWS.filter(function (x) { return !x.on; });
        render();
        loadHave(c); loadList(c);
        say('cuSay2', 'ok', '<b>' + n + '개</b>를 등록했습니다. '
          + '<a href="/lesson/master.html">마스터클래스 목록에서 보기 &#8594;</a>');
      })['catch'](function (e) {
        say('cuSay2', 'no', '등록하지 못했습니다 — ' + esc(e.message || e));
      }).then(function () {
        btn.disabled = false; btn.textContent = old;
      });
    }

    /* ══ ④ 이미 올린 큐레이션 목록 ═════════════════════════════ */
    function loadList(c) {
      var wrap = $('cuList'); if (!wrap) return;
      wrap.innerHTML = '<p class="cu-empty">불러오는 중…</p>';

      c.from('lessons')
        .select('id,title,credit,video_id,status,hidden,field,sort_order,created_at')
        .eq('source', 'curated')
        .order('sort_order', { ascending: false })
        .order('created_at', { ascending: false })
        .then(function (r) {
          if (r.error) { wrap.innerHTML = '<div class="cu-say no">' + esc(r.error.message) + '</div>'; return; }
          var d = r.data || [];
          if (!d.length) { wrap.innerHTML = '<p class="cu-empty">아직 올린 큐레이션 강의가 없습니다.</p>'; return; }

          /* ★ <b>추천</b>은 sort_order 가 가장 큰 하나입니다 —
             마스터클래스 목록 맨 위 큰 자리에 걸립니다.
             모두 0 이면 「가장 최근에 올린 것」이 저절로 추천됩니다.
             ▶ 별을 누르면 그 강의만 1 로 올리고 나머지는 0 으로 내립니다.
               여러 개가 1 이면 어느 것이 추천인지 알 수 없게 됩니다. */
          var top = d.filter(function (x) { return (x.sort_order || 0) > 0; })[0];

          wrap.innerHTML = '<div class="cu-lh"><b>' + d.length + '개</b> 올라가 있습니다'
            + ' &middot; <span style="color:#c9a4e8">★</span> 을 누르면 '
            + '<b>마스터클래스 맨 위 추천</b>으로 올라갑니다'
            + (top ? '' : ' (지금은 가장 최근에 올린 것이 추천됩니다)') + '</div>'
            + d.map(function (o) {
                var st = (o.status === 'open') ? '모집중' : (o.status === 'draft' ? '준비중' : o.status);
                var isTop = top && String(top.id) === String(o.id);
                return '<div class="cu-item' + (o.hidden ? ' off' : '') + '" data-id="' + esc(o.id) + '">'
                  + '<div class="cu-ith"><img src="' + esc(thumb(o.video_id)) + '" alt=""></div>'
                  + '<div class="cu-itx">'
                  +   '<a href="/lesson/lesson-view.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.title) + '</a>'
                  +   '<span class="cu-meta">' + esc(o.credit || '-')
                  +     ' · ' + esc(o.field || '분야없음') + ' · ' + esc(st)
                  +     (o.hidden ? ' · <b>감춤</b>' : '')
                  +     (isTop ? ' · <b style="color:#c9a4e8">추천</b>' : '') + '</span>'
                  + '</div>'
                  + '<div class="cu-iact">'
                  +   '<button type="button" class="cu-star' + (isTop ? ' on' : '') + '"'
                  +     ' data-a="top" title="' + (isTop ? '추천 해제' : '추천으로 올리기') + '"'
                  +     ' aria-label="' + (isTop ? '추천 해제' : '추천으로 올리기') + '">'
                  +     (isTop ? '&#9733;' : '&#9734;') + '</button>'
                  +   '<button type="button" class="cu-mini" data-a="hide">' + (o.hidden ? '다시 보이기' : '감추기') + '</button>'
                  +   '<button type="button" class="cu-mini del" data-a="rm">지우기</button>'
                  + '</div>'
                  + '</div>';
              }).join('');

          Array.prototype.forEach.call(wrap.querySelectorAll('.cu-item'), function (el) {
            var id = el.getAttribute('data-id');
            var o = d.filter(function (x) { return String(x.id) === String(id); })[0];

            /* ── 추천으로 올리기 · 해제 ─────────────────────────
               ★ 먼저 <b>모두 0 으로 내리고</b> 이것만 1 로 올립니다.
                 여러 개가 1 이면 「어느 것이 추천인지」 알 수 없습니다.
               ★ 감춰 둔 강의는 추천할 수 없습니다 — 목록에 안 보이는
                 것이 맨 위 큰 자리에 걸리면 회원이 눌러도 헛걸음입니다. */
            el.querySelector('[data-a="top"]').addEventListener('click', function () {
              var b = this;
              var isTop = b.classList.contains('on');
              if (!isTop && o.hidden) {
                alert('감춰 둔 강의는 추천할 수 없습니다.\n먼저 「다시 보이기」로 올려 주십시오.');
                return;
              }
              if (!isTop && o.status === 'draft') {
                alert('준비중인 강의는 목록에 보이지 않아 추천할 수 없습니다.\n상태를 모집중으로 바꿔 주십시오.');
                return;
              }
              b.disabled = true;

              /* 지금 추천인 것들을 먼저 0 으로 */
              var others = d.filter(function (x) { return (x.sort_order || 0) > 0; })
                            .map(function (x) { return x.id; });
              var step1 = others.length
                ? c.from('lessons').update({ sort_order: 0 }).in('id', others).select('id')
                : Promise.resolve({ data: [] });

              step1.then(function () {
                if (isTop) return { data: [1] };   /* 해제면 여기서 끝 */
                return c.from('lessons').update({ sort_order: 1 }).eq('id', id).select('id');
              }).then(function (rr) {
                /* ★ 몇 줄이 바뀌었는지 <b>받아서</b> 확인합니다 —
                   권한에 막히면 오류 없이 0줄이 됩니다. */
                if (rr && rr.error) throw new Error(rr.error.message);
                if (!isTop && !(rr.data || []).length) throw new Error('바뀌지 않았습니다.');
                loadList(c);
              })['catch'](function (e) {
                b.disabled = false;
                alert('바꾸지 못했습니다 — ' + (e.message || e));
              });
            });

            el.querySelector('[data-a="hide"]').addEventListener('click', function () {
              var b = this; b.disabled = true;
              c.from('lessons').update({ hidden: !o.hidden }).eq('id', id).select('id')
                .then(function (rr) {
                  if (rr.error || !(rr.data || []).length) { b.disabled = false; alert('바꾸지 못했습니다.'); return; }
                  loadList(c);
                });
            });

            el.querySelector('[data-a="rm"]').addEventListener('click', function () {
              if (!confirm('「' + (o.title || '') + '」\n\n이 강의를 지웁니다. 되돌릴 수 없습니다.')) return;
              var b = this; b.disabled = true;
              c.from('lessons').delete().eq('id', id).select('id')
                .then(function (rr) {
                  if (rr.error || !(rr.data || []).length) { b.disabled = false; alert('지우지 못했습니다.'); return; }
                  loadHave(c); loadList(c);
                });
            });
          });
        });
    }
  }

  window.OCLessonCurate = { page: page, ytId: ytId };
})();
