/* ══════════════════════════════════════════════════════════════
   레슨:ON 강의 등록 엔진 — assets/lesson-write.js     2026-08-05

   무엇을 하나
     OCLessonWrite.form()  강의 등록 · 수정 (승인된 인스트럭터)
     OCLessonWrite.mine()  내 강의 목록 (고치기 · 감추기 · 지우기)

   ★ <b>유튜브 주소를 붙이면 알아서 뽑습니다</b>
     회원에게 「영상 ID를 넣으세요」 하면 무엇인지 모릅니다. 주소를
     그대로 붙이면 우리가 뽑습니다. 여러 모양을 다 받습니다 —
       youtu.be/ID · watch?v=ID · /embed/ID · /live/ID · /shorts/ID
     Vimeo 도 같은 방식으로 받습니다(vimeo.com/숫자).

   ★ <b>큐레이션은 값을 받지 않습니다</b>
     남의 공개 영상을 유료로 파는 모양이 되면 안 됩니다. 화면에서
     값 칸을 잠그고, 표에서도 지키개가 0 으로 못박습니다(두 겹).

   ★ 자격은 <b>서버에서</b> 봅니다 — 승인된 인스트럭터만 강의를 낼 수
     있습니다(줄 보안 정책). 화면은 안내를 위해 한 번 더 봅니다.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.OCLessonWrite) return;

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var BUCKET = 'recruit';

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

  /* 갈래 — 고르면 그에 맞는 칸만 보여 줍니다.
     ★ tab 은 <b>고른 갈래에서 저절로</b> 정합니다. 회원이 kind 와 tab 을
       따로 고르게 하면 어긋난 짝(예: 그룹레슨인데 마스터클래스 탭)이
       생깁니다. */
  var KINDS = [
    { v: 'master', kind: 'vod',   tab: 'master', label: '마스터클래스 (녹화)' },
    { v: 'open',   kind: 'vod',   tab: 'open',   label: '공개레슨 (녹화 · 누구나)' },
    { v: 'one',    kind: 'one',   tab: 'one',    label: '1:1 레슨 (실시간)' },
    { v: 'group',  kind: 'group', tab: 'group',  label: '그룹레슨 (실시간 · 정원)' }
  ];

  var STATUSES = [
    { v: 'draft',   label: '준비중 (아무에게도 보이지 않습니다)' },
    { v: 'open',    label: '모집중' },
    { v: 'ongoing', label: '진행중' },
    { v: 'closed',  label: '마감' }
  ];

  function esc(v) { var d = document.createElement('div'); d.textContent = (v == null ? '' : String(v)); return d.innerHTML; }
  function $(id) { return document.getElementById(id); }
  function nf(n) { return (n == null ? '0' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')); }

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

  /* ── 영상 주소에서 무엇인지 뽑아냅니다 ────────────────────────
     ★ 회원은 <b>주소를 그대로</b> 붙입니다. 「ID를 넣으세요」 하면
       무엇을 넣어야 하는지 모릅니다.
     ★ 유튜브 주소는 모양이 여럿입니다 — 다 받습니다. */
  function parseVideo(url) {
    var s = String(url || '').trim();
    if (!s) return null;
    /* 이미 ID 만 넣은 경우 (열한 글자) */
    if (/^[\w-]{11}$/.test(s)) return { provider: 'youtube', id: s };

    var m;
    /* youtu.be/ID */
    m = s.match(/youtu\.be\/([\w-]{11})/);            if (m) return { provider: 'youtube', id: m[1] };
    /* watch?v=ID */
    m = s.match(/[?&]v=([\w-]{11})/);                 if (m) return { provider: 'youtube', id: m[1] };
    /* /embed/ID · /live/ID · /shorts/ID · /v/ID */
    m = s.match(/youtube\.com\/(?:embed|live|shorts|v)\/([\w-]{11})/);
                                                      if (m) return { provider: 'youtube', id: m[1] };
    /* vimeo.com/숫자 (앞에 채널이 붙는 모양도 받습니다) */
    m = s.match(/vimeo\.com\/(?:.*\/)?(\d{6,})/);     if (m) return { provider: 'vimeo', id: m[1] };
    return null;
  }

  /* ── 파일 올리기 (표지 사진) ─────────────────────────────── */
  function shrink(file, max, cb) {
    try {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * s); cv.height = Math.round(h * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { cb(b); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
      img.src = url;
    } catch (e) { cb(null); }
  }
  function safeName(n) { return String(n || 'f').replace(/[^\w.\-]/g, '_').slice(-40); }

  /* ══ ① 등록 · 수정 ═══════════════════════════════════════════ */
  function form(opt) {
    opt = opt || {};
    var gate = $('lwGate'), box = $('lwForm'), btns = $('lwBtns'), sayBox = $('lwSay');
    if (!gate || !box) return;

    var ME = null, INS = null, EDIT = null, coverUrl = '';
    var editId = '';
    try { editId = new URLSearchParams(location.search).get('id') || ''; } catch (e) {}

    function say(kind, t) {
      if (!sayBox) return;
      sayBox.innerHTML = '<div class="ln-say ' + kind + '">' + t + '</div>';
      try { sayBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
    function note(h) { gate.innerHTML = '<div class="ln-none">' + h + '</div>'; }
    function hideForm() {
      box.setAttribute('hidden', ''); box.style.display = 'none';
      if (btns) { btns.setAttribute('hidden', ''); btns.style.display = 'none'; }
    }

    hideForm();

    waitSb(function (c) {
      if (!c) { note('잠시 뒤 다시 시도해 주십시오.'); return; }
      c.auth.getSession().then(function (r) {
        var u = r.data && r.data.session && r.data.session.user;
        if (!u) {
          note('<b>로그인이 필요합니다.</b><br>강의 등록은 <b>승인된 인스트럭터</b>만 하실 수 있습니다.'
            + '<a class="ln-vd" style="margin-top:16px" href="/account/login.html">로그인 &#8594;</a>');
          return;
        }
        Promise.all([
          c.from('members').select('id,name,is_admin').eq('id', u.id).maybeSingle(),
          c.from('lesson_instructors').select('id,name,field,status').eq('member_id', u.id).maybeSingle()
        ]).then(function (rs) {
          ME = rs[0].data || { id: u.id };
          INS = rs[1].data;

          if (!ME.is_admin && (!INS || INS.status !== 'approved')) {
            note('<b>승인된 인스트럭터만 강의를 등록할 수 있습니다.</b><br>'
              + (INS && INS.status === 'pending'
                  ? '지금 심사 중입니다. 승인되면 등록하실 수 있습니다.'
                  : '먼저 인스트럭터 신청을 해 주십시오.')
              + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor-apply.html">'
              + '인스트럭터 신청 &#8594;</a>');
            return;
          }

          build();
          if (editId) load(editId); else ready();
        });
      });
    });

    function ready() {
      gate.innerHTML = '';
      box.removeAttribute('hidden'); box.style.display = '';
      if (btns) { btns.removeAttribute('hidden'); btns.style.display = ''; }
    }

    /* 화면을 만듭니다 — 칸이 많아 HTML 에 다 적으면 읽기 어렵습니다 */
    function build() {
      function optlist(arr, val, lab) {
        return arr.map(function (o) {
          return '<option value="' + esc(o[val]) + '">' + esc(o[lab]) + '</option>';
        }).join('');
      }
      box.innerHTML =
        /* ── 왼쪽 · 기본 ── */
          '<div class="ln-box">'
        +   '<h3 class="ln-box-h">강의 정보</h3>'

        +   fld('갈래', '<select id="lwKind">'
              + KINDS.map(function (k) { return '<option value="' + k.v + '">' + esc(k.label) + '</option>'; }).join('')
              + '</select>',
              '고른 갈래에 따라 <b>아래 칸이 달라집니다.</b> 어느 탭에 놓일지도 저절로 정해집니다.', true)

        +   fld('출처', '<select id="lwSource">'
              + '<option value="own">자체 강의 — 우리 인스트럭터가 만든 것</option>'
              + '<option value="curated">큐레이션 — 공개된 영상을 골라 모은 것</option></select>',
              '큐레이션은 <b>늘 무료</b>이고 <b>출처를 반드시</b> 적어야 합니다. '
              + '남의 공개 영상을 유료로 파는 모양이 되면 안 됩니다.', true)

        +   fld('분야', '<select id="lwField"><option value="">선택</option>'
              + FIELDS.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('') + '</select>')

        +   fld('제목', '<input type="text" id="lwTitle" maxlength="120" placeholder="예: 바흐 무반주 첼로 조곡 해석">', '', true)
        +   fld('부제', '<input type="text" id="lwSub" maxlength="120" placeholder="예: 프레이징과 활 쓰기">',
              '시안처럼 제목 뒤에 붙습니다. 비워도 됩니다.')
        +   fld('소개', '<textarea id="lwSummary" maxlength="800" placeholder="무엇을 어떻게 다루는지 적어 주십시오."></textarea>',
              '<b>큐레이션이라면 이 글이 가장 중요합니다</b> — 「왜 이 영상을 골랐는지」가 우리가 만든 값입니다. '
              + '<span id="lwSumN">0</span> / 800')

        +   fld('상태', '<select id="lwStatus">'
              + STATUSES.map(function (s) { return '<option value="' + s.v + '">' + esc(s.label) + '</option>'; }).join('')
              + '</select>',
              '<b>준비중</b>으로 두면 목록에 나오지 않습니다. 다 채운 뒤 모집중으로 바꾸십시오.')

        +   fld('표지 사진',
              '<div class="ln-pick"><div class="ln-pick-ph" id="lwCover">표지</div>'
              + '<div><button type="button" class="ln-btn" id="lwCoverPick" style="height:34px;padding:0 16px">찾아보기</button>'
              + '<div class="ln-hint">1400픽셀로 줄여 올립니다. 10MB 넘는 파일은 받지 않습니다.<br>'
              + '<b>유튜브 강의는 비워 두셔도 됩니다</b> — 유튜브 표지를 씁니다.</div></div></div>'
              + '<input type="file" id="lwCoverFile" accept="image/*" hidden>')
        + '</div>'

        /* ── 오른쪽 · 영상 · 실시간 · 값 ── */
        + '<div class="ln-box">'
        +   '<h3 class="ln-box-h">영상 · 일정 · 값</h3>'

        +   '<div id="lwVodBox">'
        +     fld('영상 주소',
                '<input type="text" id="lwVideo" placeholder="https://www.youtube.com/watch?v=…">',
                '유튜브·Vimeo <b>주소를 그대로</b> 붙여 넣으십시오. 우리가 알아서 뽑습니다.<br>'
                + '<b>「공유 → 퍼가기」가 있는 영상</b>만 다른 사이트에서 재생됩니다. '
                + '없으면 우리 화면에서 안 나옵니다.')
        +     '<div id="lwVideoOk"></div>'
        +     fld('맛보기 주소',
                '<input type="text" id="lwSample" placeholder="비워도 됩니다">',
                '시안의 CLASS SAMPLE 자리입니다.')
        +     fld('강의길이(분)', '<input type="text" id="lwDur" inputmode="numeric" placeholder="예: 202">',
                '202 를 넣으면 화면에 <b>3hr22min</b> 으로 나옵니다.')
        +   '</div>'

        +   '<div id="lwLiveBox">'
        +     fld('주제', '<input type="text" id="lwTopic" maxlength="80" placeholder="예: 총보독법">')
        +     fld('참여 링크', '<input type="text" id="lwLive" placeholder="https://meet.google.com/…">',
                '<b>승인된 신청자에게만</b> 보입니다. Zoom·Google Meet 링크를 그대로 넣으십시오.<br>'
                + '이미 쓰시는 도구를 그대로 쓰시면 됩니다.')
        +     fld('정원', '<input type="text" id="lwCap" inputmode="numeric" placeholder="예: 6">',
                '그룹레슨만 씁니다. 승인이 정원을 넘으면 <b>서버가 막습니다.</b>')
        +     fld('일정', '<input type="text" id="lwSched" maxlength="120" placeholder="예: 매주 화 20:00 · 한 달간">')
        +     fld('신청 마감', '<div id="lwToBox"></div>',
                '비우면 <b>마감 없이</b> 계속 받습니다.')
        +   '</div>'

        +   '<div id="lwCreditBox">'
        +     fld('출처 이름', '<input type="text" id="lwCredit" maxlength="120" placeholder="예: 베를린 필하모닉 공식 채널">',
                '<b>큐레이션은 반드시</b> 적어야 합니다. 화면에 그대로 보입니다.', true)
        +     fld('출처 주소', '<input type="text" id="lwCreditUrl" placeholder="원본 영상 또는 채널 주소">')
        +   '</div>'

        +   fld('값(원)', '<input type="text" id="lwPrice" inputmode="numeric" placeholder="0 = 무료 · 비우면 구독 포함">',
              '가격 정책이 정해지기 전까지는 <b>0(무료)</b> 이나 비워 두시면 됩니다.')
        + '</div>';

      /* 갈래·출처에 따라 보일 칸을 가립니다 */
      $('lwKind').addEventListener('change', shape);
      $('lwSource').addEventListener('change', shape);
      $('lwSummary').addEventListener('input', function () { $('lwSumN').textContent = String(this.value.length); });

      /* 주소를 넣으면 곧바로 무엇인지 알려 줍니다 */
      $('lwVideo').addEventListener('input', function () {
        var v = parseVideo(this.value);
        var b = $('lwVideoOk');
        if (!this.value.trim()) { b.innerHTML = ''; return; }
        b.innerHTML = v
          ? '<div class="ln-say ok">' + esc(v.provider === 'youtube' ? '유튜브' : 'Vimeo')
            + ' 영상으로 알아봤습니다 · <b>' + esc(v.id) + '</b></div>'
          : '<div class="ln-say no">영상 주소를 알아보지 못했습니다. '
            + '유튜브나 Vimeo 주소를 그대로 붙여 넣어 주십시오.</div>';
      });

      /* 표지 사진 */
      $('lwCoverPick').addEventListener('click', function () { $('lwCoverFile').click(); });
      $('lwCoverFile').addEventListener('change', function () {
        var f = this.files && this.files[0]; if (!f) return;
        /* ★ 표지는 1400px JPEG 로 <b>줄여서</b> 올리므로 원본이 커도
           됩니다(결과는 대개 300KB 안쪽). 다만 아주 큰 사진은 브라우저가
           읽다가 멈추므로 상한을 둡니다.
           ※ 저장통(recruit)은 5MB · 이미지+PDF 로 조여 두었습니다
             (sql/storage-01-limits.sql). 줄인 뒤라 넉넉히 통과합니다. */
        if (f.size > 15 * 1024 * 1024) {
          say('no', '사진이 너무 큽니다 (' + (f.size/1024/1024).toFixed(1) + 'MB · <b>15MB</b>까지). '
                  + '휴대폰에서 크기를 줄여 다시 시도해 주십시오.');
          return;
        }
        if (!/^image\//.test(f.type || '')) {
          say('no', '표지는 <b>이미지</b>만 올릴 수 있습니다 (JPG · PNG).');
          return;
        }
        shrink(f, 1400, function (blob) {
          if (!blob) { say('no', '사진을 읽지 못했습니다.'); return; }
          var path = ME.id + '/lesson_cover_' + Date.now() + '.jpg';
          sb().storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
            .then(function (r) {
              if (r.error) { say('no', '표지를 올리지 못했습니다.'); return; }
              coverUrl = sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
              $('lwCover').innerHTML = '<img src="' + esc(coverUrl) + '" alt="">';
              say('ok', '표지를 올렸습니다.');
            });
        });
      });

      /* 신청 마감 — 브라우저 달력을 쓰지 않고 상자 셋으로
         (생년월일에서 겪은 것과 같은 까닭입니다) */
      if (window.OCBirth) {
        OCBirth.mount($('lwToBox'), '', { cls: '', minAge: -5, oldest: new Date().getFullYear() });
      }

      shape();
    }

    function fld(label, inner, hint, req) {
      return '<div class="ln-fld" data-f="' + esc(label) + '">'
        + '<label>' + esc(label) + (req ? '<span class="req">*</span>' : '') + '</label>'
        + '<div class="ln-fld-b">' + inner
        + (hint ? '<div class="ln-hint">' + hint + '</div>' : '') + '</div></div>';
    }

    /* 고른 갈래·출처에 따라 보일 칸을 가립니다 */
    function shape() {
      var k = $('lwKind').value;
      var live = (k === 'one' || k === 'group');
      var curated = ($('lwSource').value === 'curated');

      $('lwVodBox').style.display  = live ? 'none' : '';
      $('lwLiveBox').style.display = live ? '' : 'none';
      $('lwCreditBox').style.display = curated ? '' : 'none';

      /* 그룹레슨이 아니면 정원 칸을 감춥니다 */
      var cap = $('lwCap').closest('.ln-fld');
      if (cap) cap.style.display = (k === 'group') ? '' : 'none';

      /* ★ 큐레이션은 값을 <b>받지 않습니다</b> — 칸을 잠그고 0 으로 둡니다.
         표에서도 지키개가 0 으로 못박습니다(두 겹으로 막습니다). */
      var pr = $('lwPrice');
      if (curated) { pr.value = '0'; pr.disabled = true; }
      else { pr.disabled = false; }
    }

    /* 고칠 강의를 불러옵니다 */
    function load(id) {
      var c = sb();
      Promise.all([
        c.from('lessons').select('*').eq('id', id).maybeSingle(),
        c.from('lesson_curriculum').select('*').eq('lesson_id', id).order('no', { ascending: true })
      ]).then(function (rs) {
        var o = rs[0].data;
        if (!o) { note('그 강의를 찾을 수 없습니다.'); return; }
        EDIT = o;
        var k = KINDS.filter(function (x) { return x.kind === o.kind && x.tab === o.tab; })[0]
             || KINDS.filter(function (x) { return x.tab === o.tab; })[0] || KINDS[0];
        $('lwKind').value = k.v;
        $('lwSource').value = o.source || 'own';
        $('lwField').value = o.field || '';
        $('lwTitle').value = o.title || '';
        $('lwSub').value = o.subtitle || '';
        $('lwSummary').value = o.summary || '';
        $('lwSumN').textContent = String(($('lwSummary').value || '').length);
        $('lwStatus').value = o.status || 'draft';
        if (o.cover_url) { coverUrl = o.cover_url; $('lwCover').innerHTML = '<img src="' + esc(coverUrl) + '" alt="">'; }
        if (o.video_id) $('lwVideo').value = o.video_id;
        if (o.sample_id) $('lwSample').value = o.sample_id;
        $('lwDur').value = o.duration_min || '';
        $('lwTopic').value = o.topic || '';
        $('lwLive').value = o.live_url || '';
        $('lwCap').value = o.capacity || '';
        $('lwSched').value = o.schedule_text || '';
        if (o.apply_to && window.OCBirth) OCBirth.set($('lwToBox'), String(o.apply_to).slice(0, 10));
        $('lwCredit').value = o.credit || '';
        $('lwCreditUrl').value = o.credit_url || '';
        $('lwPrice').value = (o.price == null ? '' : o.price);
        shape();
        var sv = $('lwSave'); if (sv) sv.textContent = '강의 고치기';
        ready();
      });
    }

    /* 저장 */
    var saveBtn = $('lwSave');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var k = KINDS.filter(function (x) { return x.v === $('lwKind').value; })[0] || KINDS[0];
      var curated = ($('lwSource').value === 'curated');
      var title = ($('lwTitle').value || '').trim();
      if (!title) { say('no', '제목을 적어 주십시오.'); $('lwTitle').focus(); return; }
      if (curated && !($('lwCredit').value || '').trim()) {
        say('no', '큐레이션 강의는 <b>출처 이름</b>을 반드시 적어야 합니다.'); $('lwCredit').focus(); return;
      }

      var vid = parseVideo($('lwVideo').value);
      var smp = parseVideo($('lwSample').value);
      var live = (k.kind === 'one' || k.kind === 'group');

      if (!live && $('lwVideo').value.trim() && !vid) {
        say('no', '영상 주소를 알아보지 못했습니다. 유튜브나 Vimeo 주소를 그대로 붙여 넣어 주십시오.');
        $('lwVideo').focus(); return;
      }

      var to = (window.OCBirth ? OCBirth.get($('lwToBox')) : null);
      var num = function (v) { var n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10); return isNaN(n) ? null : n; };

      var row = {
        member_id:     ME.id,
        instructor_id: INS ? INS.id : null,
        kind:   k.kind,
        tab:    k.tab,
        status: $('lwStatus').value || 'draft',
        source: curated ? 'curated' : 'own',
        field:  $('lwField').value || null,
        title:  title,
        subtitle: ($('lwSub').value || '').trim() || null,
        summary:  ($('lwSummary').value || '').trim() || null,
        cover_url: coverUrl || null,
        video_provider:  live ? 'none' : (vid ? vid.provider : 'none'),
        video_id:        live ? null   : (vid ? vid.id : null),
        sample_provider: live ? 'none' : (smp ? smp.provider : 'none'),
        sample_id:       live ? null   : (smp ? smp.id : null),
        duration_min: live ? null : num($('lwDur').value),
        topic:      live ? (($('lwTopic').value || '').trim() || null) : null,
        live_url:   live ? (($('lwLive').value || '').trim() || null) : null,
        capacity:   (k.kind === 'group') ? num($('lwCap').value) : null,
        schedule_text: live ? (($('lwSched').value || '').trim() || null) : null,
        apply_to:   live && to ? (to + 'T23:59:59+09:00') : null,
        credit:     curated ? ($('lwCredit').value || '').trim() : null,
        credit_url: curated ? (($('lwCreditUrl').value || '').trim() || null) : null,
        price:      curated ? 0 : num($('lwPrice').value)
      };

      var btn = this, old = btn.textContent;
      btn.disabled = true; btn.textContent = '저장하는 중…';
      var c = sb();
      var job = EDIT
        ? c.from('lessons').update(row).eq('id', EDIT.id).select('id')
        : c.from('lessons').insert(row).select('id');

      job.then(function (r) {
        /* ★ 몇 줄이 바뀌었는지 <b>받아서 확인</b>합니다 —
           줄 보안에 막히면 오류 없이 0줄이 됩니다. */
        if (r.error) throw new Error(r.error.message);
        if (!r.data || !r.data.length) {
          say('no', '저장되지 않았습니다. 한 줄도 바뀌지 않았습니다 — '
            + '인스트럭터 승인 상태를 확인해 주십시오.');
          btn.disabled = false; btn.textContent = old; return;
        }
        hideForm();
        btn.textContent = old;
        note('<b>저장했습니다.</b><br>'
          + ($('lwStatus').value === 'draft'
              ? '지금은 <b>준비중</b>이라 목록에 나오지 않습니다. 다 채우신 뒤 상태를 바꾸십시오.'
              : '목록에서 확인하실 수 있습니다.')
          + '<a class="ln-vd" style="margin-top:16px" href="/lesson/my-lessons.html">내 강의 &#8594;</a>');
        if (sayBox) sayBox.innerHTML = '';
        try { gate.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }).catch(function (e) {
        say('no', '저장하지 못했습니다: ' + esc(String(e.message || e).slice(0, 140)));
        btn.disabled = false; btn.textContent = old;
      });
    });
  }

  /* ══ ② 내 강의 ═══════════════════════════════════════════════ */
  function mine(opt) {
    opt = opt || {};
    var box = $(opt.box || 'lwMine');
    if (!box) return;

    waitSb(function (c) {
      if (!c) { box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.</div>'; return; }
      c.auth.getSession().then(function (r) {
        var u = r.data && r.data.session && r.data.session.user;
        if (!u) {
          box.innerHTML = '<div class="ln-none"><b>로그인이 필요합니다.</b>'
            + '<a class="ln-vd" style="margin-top:16px" href="/account/login.html">로그인 &#8594;</a></div>';
          return;
        }
        /* ★ <b>표</b>를 읽습니다(뷰가 아닙니다) — 준비중(draft)도 봐야 하고,
           내 것만 보이게 하는 것은 줄 보안이 지켜 줍니다. */
        c.from('lessons').select('*').eq('member_id', u.id)
          .order('created_at', { ascending: false })
          .then(function (lr) {
            var rows = lr.data || [];
            if (!rows.length) {
              box.innerHTML = '<div class="ln-none"><b>등록한 강의가 없습니다.</b><br>'
                + '첫 강의를 올려 보십시오.'
                + '<a class="ln-vd" style="margin-top:16px" href="/lesson/lesson-write.html">강의 등록 &#8594;</a></div>';
              return;
            }
            /* ★ 실시간 레슨(1:1 · 그룹)에만 신청이 들어옵니다 —
               녹화(마스터클래스 · 공개레슨)는 신청 개념이 없습니다.
               (표 정책 app_insert_mine 도 one · group 만 받습니다)
               그래서 실시간 강의가 하나도 없으면 신청을 <b>세지도</b>
               않습니다. 쓸데없는 물음을 서버에 보내지 않으려는 것입니다. */
            var live = rows.filter(function (o) {
              return o.kind === 'one' || o.kind === 'group';
            });
            if (!live.length) { draw(rows, {}); return; }

            /* 신청을 한 번에 세어 옵니다 — 강의마다 따로 묻지 않습니다.
               ★ 남의 강의 신청은 줄 보안(app_read_owner)이 걸러 줍니다. */
            c.from('lesson_applications')
              .select('lesson_id,status,read_at')
              .in('lesson_id', live.map(function (o) { return o.id; }))
              .then(function (ar) {
                var tally = {};
                (ar.data || []).forEach(function (a) {
                  var t = tally[a.lesson_id] || (tally[a.lesson_id] = { all: 0, pending: 0, approved: 0, unread: 0 });
                  t.all++;
                  if (a.status === 'pending')  t.pending++;
                  if (a.status === 'approved') t.approved++;
                  if (!a.read_at)              t.unread++;
                });
                draw(rows, tally);
              });

            /* ── 목록 그리기 ─────────────────────────────────── */
            function draw(rows, tally) {
              apStyle();
              box.innerHTML = '<ul class="lw-list">' + rows.map(function (o) {
                var st = { draft: '준비중', open: '모집중', ongoing: '진행중', closed: '마감' }[o.status] || o.status;
                var t = tally[o.id];
                var isLive = (o.kind === 'one' || o.kind === 'group');

                /* 신청 배지 — 실시간 레슨에만. 새 신청은 눈에 띄게 */
                var badge = '';
                if (isLive) {
                  badge = t && t.all
                    ? '<button type="button" class="ap-b' + (t.pending ? ' hot' : '') + '"'
                      + ' data-ap="' + esc(o.id) + '"'
                      + ' data-cap="' + esc(o.kind === 'group' ? (o.capacity || 0) : 0) + '">'
                      + '신청 ' + t.all
                      + (t.pending ? ' · <b>대기 ' + t.pending + '</b>' : '')
                      + (o.kind === 'group' && o.capacity
                          ? ' · 승인 ' + t.approved + '/' + o.capacity : '')
                      + '</button>'
                    : '<span class="ap-b off">신청 0</span>';
                }

                return '<li>'
                  + '<span class="st ' + esc(o.status) + '">' + esc(st) + '</span>'
                  + '<span class="tb">' + esc({ master: '마스터클래스', open: '공개레슨', one: '1:1', group: '그룹' }[o.tab] || o.tab) + '</span>'
                  + (o.source === 'curated' ? '<span class="cu">큐레이션</span>' : '')
                  + '<a class="t" href="/lesson/lesson-view.html?id=' + encodeURIComponent(o.id) + '">'
                  +   esc(o.title || '-') + '</a>'
                  + badge
                  + '<a class="ed" href="/lesson/lesson-write.html?id=' + encodeURIComponent(o.id) + '">고치기</a>'
                  + '<div class="ap-box" id="ap_' + esc(o.id) + '" hidden></div>'
                  + '</li>';
              }).join('') + '</ul>';

              Array.prototype.forEach.call(box.querySelectorAll('[data-ap]'), function (b) {
                b.addEventListener('click', function () {
                  toggleAp(c, b.getAttribute('data-ap'), parseInt(b.getAttribute('data-cap'), 10) || 0, b);
                });
              });
            }
          });
      });
    });
  }

  /* ══ ③ 강사에게 온 신청 ══════════════════════════════════════
     ★ 왜 <b>내 강의 안에서</b> 펼치나 — 신청을 보려고 다른 화면으로
       옮겨 다니면 「어느 강의의 신청이었지」를 잊습니다. 강의 줄 바로
       아래에서 펼치면 무엇에 딸린 신청인지 헷갈리지 않습니다.
     ★ 신청자 정보는 <b>서버 함수</b>로 받습니다 —
       members 표는 「자기 것만」으로 막혀 있어 이름조차 못 읽습니다.
       함수가 필요한 칸만 골라 넘기고, <b>연락처는 승인한 신청에만</b>
       실어 줍니다(승인 전에는 브라우저에 오지 않습니다).
     ★ 짜임은 <b>여기서 만들어 넣습니다</b> — lesson.css 는 레슨:ON
       전체가 함께 쓰는 파일이라, 화면 하나 때문에 손대면 다른 데가
       조용히 망가질 수 있습니다. */
  function apStyle() {
    if (window.__ocApCss) return;
    window.__ocApCss = true;
    var css = ''
      + '.ap-b{flex:0 0 auto;padding:3px 10px;border-radius:3px;border:1px solid var(--ln-line);'
      +   'background:none;color:var(--ln-tx2,#c9c6d6);font:inherit;font-size:11px;cursor:pointer;}'
      + '.ap-b:hover{border-color:#a24ea7;color:#e8dcf5;}'
      + '.ap-b.hot{border-color:#a24ea7;background:rgba(162,78,167,.18);color:#efe2f8;}'
      + '.ap-b.hot b{color:#f3c9ff;}'
      + '.ap-b.off{color:var(--ln-tx3,#8a86a0);cursor:default;border-style:dashed;}'
      + '.ap-b.on{background:#a24ea7;border-color:#a24ea7;color:#fff;}'

      /* ★ li 가 flex 라서 100% 를 주어야 <b>다음 줄 전체</b>를 씁니다 */
      + '.ap-box{flex:1 1 100%;margin:12px 0 4px;padding:16px 18px;border-radius:10px;'
      +   'background:rgba(255,255,255,.035);border:1px solid var(--ln-line,rgba(255,255,255,.12));}'
      + '.ap-msg{font-size:12.5px;color:var(--ln-tx3,#8a86a0);line-height:1.7;}'
      + '.ap-warn{margin:0 0 12px;padding:9px 12px;border-radius:7px;font-size:12px;line-height:1.6;'
      +   'background:rgba(230,180,90,.12);border:1px solid rgba(230,180,90,.32);color:#f0dcb0;}'

      + '.ap-row{display:flex;gap:13px;align-items:flex-start;padding:13px 0;'
      +   'border-top:1px solid rgba(255,255,255,.08);}'
      + '.ap-row:first-of-type{border-top:0;padding-top:0;}'
      + '.ap-row.done{opacity:.55;}'
      + '.ap-ph{flex:0 0 44px;width:44px;height:44px;border-radius:50%;overflow:hidden;'
      +   'background:rgba(255,255,255,.07);display:grid;place-items:center;'
      +   'font-size:15px;color:var(--ln-tx3,#8a86a0);}'
      + '.ap-ph img{width:100%;height:100%;object-fit:cover;display:block;}'
      + '.ap-in{flex:1 1 auto;min-width:0;}'
      + '.ap-nm{font-size:13.5px;color:#f2eff8;font-weight:600;}'
      + '.ap-nm .tag{margin-left:7px;padding:2px 7px;border-radius:3px;font-size:10px;font-weight:700;'
      +   'background:rgba(255,255,255,.10);color:var(--ln-tx2,#c9c6d6);vertical-align:1px;}'
      + '.ap-nm .tag.ok{background:#3f7a4f;color:#fff;}'
      + '.ap-nm .tag.no{background:#7a3f3f;color:#fff;}'
      + '.ap-nm .tag.wait{background:#8a3ea0;color:#fff;}'
      + '.ap-meta{margin-top:4px;font-size:12px;color:var(--ln-tx3,#8a86a0);line-height:1.6;}'
      + '.ap-note{margin-top:7px;padding:9px 12px;border-radius:7px;font-size:12.5px;line-height:1.7;'
      +   'background:rgba(255,255,255,.045);color:var(--ln-tx2,#c9c6d6);}'
      + '.ap-ct{margin-top:7px;font-size:12.5px;color:#bfe6cd;}'
      + '.ap-ct a{color:inherit;}'
      + '.ap-act{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;}'
      + '.ap-act button{padding:6px 13px;border-radius:5px;border:1px solid var(--ln-line);'
      +   'background:none;color:var(--ln-tx2,#c9c6d6);font:inherit;font-size:11.5px;cursor:pointer;}'
      + '.ap-act button.go{background:#3f7a4f;border-color:#3f7a4f;color:#fff;}'
      + '.ap-act button.no:hover{border-color:#a55;color:#f0c3c3;}'
      + '.ap-act button:disabled{opacity:.4;cursor:not-allowed;}'
      + '@media (max-width:640px){.ap-row{flex-wrap:wrap;}'
      +   '.ap-act{flex:1 1 100%;flex-direction:row;}}';
    var s = document.createElement('style');
    s.setAttribute('data-oc', 'applicants');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function toggleAp(c, lessonId, capacity, btn) {
    var box = $('ap_' + lessonId);
    if (!box) return;
    var open = !box.hasAttribute('hidden');
    if (open) {
      box.setAttribute('hidden', ''); box.style.display = 'none';
      btn.classList.remove('on');
      return;
    }
    box.removeAttribute('hidden'); box.style.display = '';
    btn.classList.add('on');
    loadAp(c, lessonId, capacity);
  }

  function loadAp(c, lessonId, capacity) {
    var box = $('ap_' + lessonId);
    if (!box) return;
    box.innerHTML = '<div class="ap-msg">신청을 불러오는 중…</div>';

    c.rpc('oc_lesson_applicants', { p_lesson: lessonId }).then(function (r) {
      if (r.error) {
        box.innerHTML = '<div class="ap-msg">불러오지 못했습니다 — ' + esc(r.error.message) + '</div>';
        return;
      }
      var d = r.data || [];
      if (!d.length) { box.innerHTML = '<div class="ap-msg">아직 신청이 없습니다.</div>'; return; }

      /* 그룹레슨은 정원을 넘겨 승인할 수 없습니다 — 미리 알려 줍니다.
         ★ 표에도 지키개가 있어 넘기면 저장이 막히지만, 누른 뒤에 알면
           헛수고입니다. 그래서 화면에서 먼저 셉니다. */
      var okN = d.filter(function (x) { return x.status === 'approved'; }).length;
      var full = (capacity > 0 && okN >= capacity);
      var warn = full
        ? '<div class="ap-warn">정원 <b>' + capacity + '명</b>이 모두 찼습니다('
          + okN + '명 승인). 더 승인하려면 정원을 늘리거나 승인한 사람을 되돌려야 합니다.</div>'
        : '';

      box.innerHTML = warn + d.map(function (x) {
        var tag = { pending: '<span class="tag wait">대기</span>',
                    approved: '<span class="tag ok">승인</span>',
                    rejected: '<span class="tag no">거절</span>',
                    canceled: '<span class="tag">신청 취소</span>' }[x.status]
                 || '<span class="tag">' + esc(x.status) + '</span>';

        var who = { major: '전공회원', general: '일반회원',
                    industry: '업계회원', school: '학교회원' }[x.member_type] || x.member_type;

        var meta = [];
        if (who) meta.push(esc(who));
        if (x.field) meta.push(esc(x.field));
        if (x.school_name) meta.push(esc(x.school_name));
        if (x.org_name) meta.push(esc(x.org_name));
        meta.push(fmt(x.created_at) + ' 신청');

        /* 연락처는 승인한 신청에만 옵니다 (서버가 판정합니다) */
        var ct = '';
        if (x.status === 'approved' && (x.email || x.phone)) {
          ct = '<div class="ap-ct">'
             + (x.email ? '<a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>' : '')
             + (x.email && x.phone ? ' · ' : '')
             + (x.phone ? esc(x.phone) : '')
             + '</div>';
        }

        var act = '';
        if (x.status === 'pending') {
          act = '<div class="ap-act">'
              + '<button type="button" class="go" data-ok="' + esc(x.app_id) + '"'
              + (full ? ' disabled title="정원이 찼습니다"' : '') + '>승인</button>'
              + '<button type="button" class="no" data-no="' + esc(x.app_id) + '">거절</button>'
              + '</div>';
        } else if (x.status === 'approved') {
          act = '<div class="ap-act"><button type="button" class="no" data-back="'
              + esc(x.app_id) + '">승인 취소</button></div>';
        }

        return '<div class="ap-row' + (x.status === 'pending' ? '' : ' done') + '">'
          + '<div class="ap-ph">'
          +   (x.photo_url ? '<img src="' + esc(x.photo_url) + '" alt="">' : '&#9834;')
          + '</div>'
          + '<div class="ap-in">'
          +   '<div class="ap-nm">' + esc(x.name || '(이름 없음)') + tag + '</div>'
          +   '<div class="ap-meta">' + meta.join(' · ') + '</div>'
          +   (x.message ? '<div class="ap-note">' + esc(x.message) + '</div>' : '')
          +   ct
          + '</div>'
          + act
          + '</div>';
      }).join('');

      /* 승인 · 거절 · 되돌리기 */
      function act(sel, next, ask) {
        Array.prototype.forEach.call(box.querySelectorAll('[' + sel + ']'), function (b) {
          b.addEventListener('click', function () {
            if (ask && !confirm(ask)) return;
            var id = b.getAttribute(sel);
            b.disabled = true;
            /* ★ 몇 줄이 바뀌었는지 <b>받아서</b> 봅니다 — 줄 보안이나
               정원 지키개에 막히면 조용히 0줄이 됩니다. */
            c.from('lesson_applications').update({ status: next }).eq('id', id).select('id')
              .then(function (rr) {
                if (rr.error) throw new Error(rr.error.message);
                if (!(rr.data || []).length) throw new Error('바뀌지 않았습니다. 정원이나 권한을 확인해 주십시오.');
                loadAp(c, lessonId, capacity);   /* 연락처를 새로 받으려면 다시 불러야 합니다 */
                mine({ box: 'lwMine' });         /* 배지 숫자도 다시 셉니다 */
              })['catch'](function (e) {
                b.disabled = false;
                alert(e.message || e);
              });
          });
        });
      }
      act('data-ok', 'approved', null);
      act('data-no', 'rejected', '이 신청을 거절합니다. 계속하시겠습니까?');
      act('data-back', 'pending', '승인을 되돌립니다. 신청자에게 보이던 참여 링크가 사라집니다. 계속하시겠습니까?');

      /* ★ <b>본 것으로</b> 표시합니다 — 「안 본 신청」을 세는 데 씁니다.
         아직 안 본 것만 골라서 한 번에 적습니다. */
      var unread = d.filter(function (x) { return !x.read_at; }).map(function (x) { return x.app_id; });
      if (unread.length) {
        c.from('lesson_applications')
          .update({ read_at: new Date().toISOString() })
          .in('id', unread).select('id')
          .then(function () { /* 조용히 — 실패해도 보는 데는 지장이 없습니다 */ });
      }
    });
  }

  function fmt(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    } catch (e) { return ''; }
  }

  window.OCLessonWrite = { form: form, mine: mine, parseVideo: parseVideo, KINDS: KINDS };
})();
