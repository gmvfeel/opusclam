/* ══════════════════════════════════════════════════════════════
   레슨:ON 인스트럭터 엔진 — assets/lesson-instructor.js   2026-08-05

   무엇을 하나
     세 화면을 <b>한 파일</b>이 돌립니다 —
       OCLessonIns.list()   인스트럭터 정보 목록 (시안 06) · 메인의 넷
       OCLessonIns.view()   인스트럭터 상세 (VIEW DETAIL)
       OCLessonIns.apply()  인스트럭터 신청 (시안 07)

   왜 한 파일인가
     세 화면이 <b>같은 표·같은 갈래 목록·같은 사진 처리</b>를 씁니다.
     파일을 셋으로 나누면 활동분야 목록을 세 곳에 적게 되고, 반드시
     한 곳을 빠뜨립니다. (org 를 네 곳에서 빠뜨린 일이 있었습니다)

   ★ 목록·상세는 <b>공개용 뷰</b>를 읽습니다
     lesson_instructors_public — 연락처·생년월일·증명서가 아예 담기지
     않습니다. 화면에서 감추는 방식은 개발자도구로 뚫립니다.

   ★ 저장통은 <b>recruit</b> 를 함께 씁니다 (새로 만들지 않습니다)
     경로는 {내id}/lesson_… — 그 저장통의 권한 규칙이
     「첫 폴더가 내 id」 이므로 그대로 통과합니다.
     (member/{내id}/… 로 했다가 막힌 일이 있었습니다)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.OCLessonIns) return;   /* 두 번 실려도 한 번만 돕니다 */

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var BUCKET = 'recruit';

  /* ── 활동분야 — <b>단 하나의 출처</b> ────────────────────────
     시안 06·07 의 분류선택 목록을 그대로 옮겼습니다.
     분야를 더하거나 이름을 바꿀 때는 <b>이 줄만</b> 고칩니다. */
  var FIELDS = ['STRINGS', 'BRASS', 'WINDS', 'PERCUSSIONS', '작곡/이론', '기타'];

  /* ── 도우미 ─────────────────────────────────────────────── */
  function esc(v) {
    var d = document.createElement('div');
    d.textContent = (v == null ? '' : String(v));
    return d.innerHTML;
  }
  function $(id) { return document.getElementById(id); }

  var _sb = null;
  function sb() {
    /* ★ 접속 객체는 <b>window.__ocSb 하나</b>만 씁니다.
       따로 만들면 로그인 상태가 갈려 줄 보안이 엉뚱하게 걸립니다. */
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
      var c = sb();
      if (c) return cb(c);
      if (++n > 60) return cb(null);      /* 3초쯤 기다리고 포기합니다 */
      setTimeout(tick, 50);
    })();
  }
  function ini(nm) { return String(nm || '?').trim().charAt(0) || '?'; }
  function fieldOf(o) {
    return (o.field === '기타' && o.field_etc) ? o.field_etc : (o.field || '');
  }

  /* 활동분야 고르는 상자 채우기 (목록·신청이 함께 씁니다) */
  function fillFields(sel, withAll) {
    if (!sel) return;
    /* ★ 첫 줄 글자를 시안과 같게 (2026-08-05 · 파트너 지시)
         목록에서는 「분류선택」 — 고르지 않으면 전체가 나옵니다
         신청폼에서는 「선택하세요」 — 반드시 골라야 하는 칸입니다 */
    var h = withAll ? '<option value="">분류선택</option>' : '<option value="">선택하세요</option>';
    FIELDS.forEach(function (f) { h += '<option value="' + esc(f) + '">' + esc(f) + '</option>'; });
    sel.innerHTML = h;
  }

  /* ── 「지금 보는 탭」 표시 ────────────────────────────────
     ★ 예전에는 서브메뉴에 pdb-subnav 를 달아 include.js 가 자동으로
       붙여 주게 했습니다. 그런데 그 이름에 <b>알약 모양·모바일에서
       감추기</b> 같은 짜임이 딸려 와 시안과 어긋났습니다(파트너 지적).
       그래서 이름을 떼고 표시는 <b>여기서</b> 붙입니다.

     ★ 서브메뉴는 include.js 가 <b>문서를 다 읽은 뒤</b> 넣습니다.
       그래서 곧바로 찾으면 없을 수 있어 <b>몇 번 다시 봅니다.</b>
     ★ 아직 없는 다섯 탭은 모두 대문(/lesson/index.html)을 가리킵니다.
       그러면 대문에서 <b>다섯 개가 함께 켜집니다.</b> 그래서 대문에서는
       아무것도 켜지 않습니다 — 「지금 어디」가 헷갈리는 것보다 낫습니다. */
  function markTabs() {
    var n = 0;
    (function tick() {
      var nav = document.querySelector('.ln-tabs');
      if (!nav) {
        if (++n > 40) return;               /* 2초쯤 기다리고 그만둡니다 */
        return setTimeout(tick, 50);
      }
      var here = location.pathname.replace(/\/index\.html$/, '/');
      if (here === '/lesson/' || here === '/lesson/index.html') return;
      [].forEach.call(nav.querySelectorAll('a[href]'), function (a) {
        var h = (a.getAttribute('href') || '').replace(/\/index\.html$/, '/');
        if (h === here) a.classList.add('active');
      });
    })();
  }
  /* 화면이 실리면 곧 한 번 붙입니다 */
  if (document.readyState !== 'loading') markTabs();
  else document.addEventListener('DOMContentLoaded', markTabs);

  /* ══ ① 목록 ══════════════════════════════════════════════════ */
  function list(opt) {
    opt = opt || {};
    var box = $(opt.box);
    if (!box) return;
    var pagerBox = opt.pagerBox ? $(opt.pagerBox) : null;
    var fieldSel = opt.fieldSel ? $(opt.fieldSel) : null;
    var size = opt.limit || opt.pageSize || 10;
    var page = 1, field = '';

    if (fieldSel) {
      fillFields(fieldSel, true);
      fieldSel.addEventListener('change', function () {
        field = fieldSel.value || '';
        page = 1;
        draw();
      });
    }

    function card(o) {
      var f = fieldOf(o);
      return '<article class="ln-ins">'
        + '<div class="ln-ins-l">'
        +   '<div class="ln-ins-ph">'
        +     (o.photo_url
                ? '<img src="' + esc(o.photo_url) + '" alt=""'
                  + ' onerror="this.parentNode.innerHTML=\'<span>' + esc(ini(o.name)) + '</span>\'">'
                : '<span>' + esc(ini(o.name)) + '</span>')
        +   '</div>'
        +   '<div class="ln-ins-role">Instructor</div>'
        +   '<div class="ln-ins-nm">' + esc(o.name || '-') + '</div>'
        +   '<a class="ln-vd" href="/lesson/instructor-view.html?id='
        +     encodeURIComponent(o.id) + '">VIEW DETAIL &#8594;</a>'
        + '</div>'
        + '<div class="ln-ins-r">'
        +   '<div class="ln-ins-k">활동분야</div>'
        +   '<div class="ln-ins-field">- ' + esc(f || '-') + '</div>'
        +   '<div class="ln-ins-k" style="margin-top:15px">Profile</div>'
        +   '<div class="ln-ins-bio">' + esc(o.bio || '') + '</div>'
        + '</div>'
        + '</article>';
    }

    function pager(total) {
      if (!pagerBox) return;
      var last = Math.max(1, Math.ceil(total / size));
      if (last <= 1) { pagerBox.innerHTML = ''; return; }
      var h = '<button type="button" data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>&#8249;</button>';
      /* 다섯 개씩 묶어 보여 줍니다 — 쪽이 많아도 줄이 길어지지 않게 */
      var from = Math.max(1, page - 2), to = Math.min(last, from + 4);
      from = Math.max(1, to - 4);
      for (var i = from; i <= to; i++) {
        h += '<button type="button" data-p="' + i + '"' + (i === page ? ' class="on"' : '') + '>' + i + '</button>';
      }
      h += '<button type="button" data-p="' + (page + 1) + '"' + (page >= last ? ' disabled' : '') + '>&#8250;</button>';
      pagerBox.innerHTML = h;
      pagerBox.querySelectorAll('button[data-p]').forEach(function (b) {
        b.addEventListener('click', function () {
          var p = parseInt(b.getAttribute('data-p'), 10);
          if (!p || p === page) return;
          page = p;
          draw();
          try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
        });
      });
    }

    function draw() {
      box.innerHTML = '<div class="ln-msg">불러오는 중…</div>';
      waitSb(function (c) {
        if (!c) { box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.</div>'; return; }
        var q = c.from('lesson_instructors_public')
          .select('id,name,field,field_etc,photo_url,bio', { count: 'exact' })
          .order('sort_order', { ascending: false })
          .order('created_at', { ascending: false })
          .range((page - 1) * size, page * size - 1);
        if (field) q = q.eq('field', field);

        q.then(function (r) {
          if (r.error) throw new Error(r.error.message);
          var rows = r.data || [];
          if (!rows.length) {
            box.innerHTML = '<div class="ln-none">'
              + (field
                  ? '<b>' + esc(field) + '</b> 분야에 등록된 인스트럭터가 아직 없습니다.'
                  : '<b>등록된 인스트럭터가 아직 없습니다.</b><br>'
                    + '가르치실 분을 모으고 있습니다.')
              + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor-apply.html">'
              + '인스트럭터 신청 &#8594;</a></div>';
            if (pagerBox) pagerBox.innerHTML = '';
            return;
          }
          box.innerHTML = rows.map(card).join('');
          pager(r.count || rows.length);
        }).catch(function (e) {
          box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.<br>'
            + '<span style="font-size:11.5px;color:var(--ln-tx3)">' + esc(String(e.message || e)) + '</span></div>';
        });
      });
    }

    draw();
  }

  /* ══ ② 상세 ══════════════════════════════════════════════════ */
  function view(opt) {
    opt = opt || {};
    var box = $(opt.box);
    if (!box) return;
    var id = '';
    try { id = new URLSearchParams(location.search).get('id') || ''; } catch (e) {}
    if (!id) {
      box.innerHTML = '<div class="ln-none">주소에 누구인지가 없습니다.<br>'
        + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor.html">인스트럭터 목록 &#8594;</a></div>';
      return;
    }

    waitSb(function (c) {
      if (!c) { box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.</div>'; return; }
      c.from('lesson_instructors_public').select('*').eq('id', id).maybeSingle()
        .then(function (r) {
          if (r.error) throw new Error(r.error.message);
          var o = r.data;
          if (!o) {
            box.innerHTML = '<div class="ln-none">찾을 수 없습니다.<br>'
              + '심사 중이거나 공개하지 않은 프로필일 수 있습니다.<br>'
              + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor.html">인스트럭터 목록 &#8594;</a></div>';
            return;
          }
          var school = [o.school_country, o.school_major, o.school_degree]
            .filter(Boolean).join(' · ');
          var media = [];
          try { media = Array.isArray(o.media) ? o.media : JSON.parse(o.media || '[]'); } catch (e) {}

          box.innerHTML =
              '<div class="ln-detail-head">'
            +   '<div class="ln-detail-role">INSTRUCTOR<b>' + esc(o.name || '-') + '</b></div>'
            +   '<h2 class="ln-detail-t">' + esc(fieldOf(o) || '인스트럭터') + '</h2>'
            + '</div>'

            + '<div class="ln-two">'
            /* 왼쪽 — 사진과 이력 */
            +   '<div class="ln-panel">'
            +     '<h3 class="ln-h2" style="margin-top:30px">Profile</h3>'
            +     '<div style="display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap">'
            +       '<div class="ln-ins-ph" style="flex:0 0 auto">'
            +         (o.photo_url
                        ? '<img src="' + esc(o.photo_url) + '" alt=""'
                          + ' onerror="this.parentNode.innerHTML=\'<span>' + esc(ini(o.name)) + '</span>\'">'
                        : '<span>' + esc(ini(o.name)) + '</span>')
            +       '</div>'
            +       '<div class="ln-detail-d" style="flex:1 1 260px;margin-top:0">'
            +         esc(o.bio || '이력사항이 아직 없습니다.') + '</div>'
            +     '</div>'
            +   '</div>'
            /* 오른쪽 — 요약과 활동사진 */
            +   '<div class="ln-panel">'
            +     '<h3 class="ln-h2" style="margin-top:30px">Information</h3>'
            +     '<ul class="ln-list">'
            +       '<li><span class="k">활동분야</span><span class="v">' + esc(fieldOf(o) || '-') + '</span></li>'
            +       '<li><span class="k">출신학교</span><span class="v">' + esc(school || '-') + '</span></li>'
            +       '<li><span class="k">등록</span><span class="v">'
            +         esc(String(o.created_at || '').slice(0, 10).replace(/-/g, '.')) + '</span></li>'
            +     '</ul>'
            +     (media.length
                    ? '<h3 class="ln-h2" style="margin-top:30px">활동사진</h3>'
                      + '<div class="ln-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:0">'
                      + media.slice(0, 8).map(function (m) {
                          if (!m || !m.url) return '';
                          return '<a class="ln-card" href="' + esc(m.url) + '" target="_blank" rel="noopener">'
                            + '<div class="ln-card-ph"><img src="' + esc(m.url) + '" alt=""></div></a>';
                        }).join('')
                      + '</div>'
                    : '')
            +     '<div class="ln-hint" style="margin-top:22px">'
            +       '연락처는 <b>공개하지 않습니다.</b> 레슨이 열리면 신청을 통해 이어집니다.'
            +     '</div>'
            +   '</div>'
            + '</div>';
        })
        .catch(function (e) {
          box.innerHTML = '<div class="ln-none">자료를 불러오지 못했습니다.<br>'
            + '<span style="font-size:11.5px;color:var(--ln-tx3)">' + esc(String(e.message || e)) + '</span></div>';
        });
    });
  }

  /* ══ ③ 신청 ══════════════════════════════════════════════════ */
  function apply() {
    var gate = $('lnGate'), form = $('lnForm'), btns = $('lnBtns'), sayBox = $('lnSay');
    if (!gate || !form) return;

    var ME = null;              /* members 줄 */
    var MINE = null;            /* 이미 낸 신청 */
    var photoUrl = '';          /* 올린 사진 주소 */
    var certUrl = '', certName = '';
    var media = [];             /* [{name,url,size}] */

    function say(kind, text) {
      if (!sayBox) return;
      sayBox.innerHTML = '<div class="ln-say ' + kind + '">' + text + '</div>';
      try { sayBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
    function note(html) { gate.innerHTML = '<div class="ln-none">' + html + '</div>'; }

    fillFields($('fField'), false);

    /* 「기타」를 고르면 직접 적는 칸을 보여 줍니다 */
    $('fField').addEventListener('change', function () {
      var etc = $('fFieldEtc');
      if (this.value === '기타') etc.removeAttribute('hidden');
      else { etc.setAttribute('hidden', ''); etc.value = ''; }
    });

    /* 이력사항 글자 수 */
    $('fBio').addEventListener('input', function () {
      $('fBioN').textContent = String(this.value.length);
    });

    waitSb(function (c) {
      if (!c) { note('잠시 뒤 다시 시도해 주십시오.'); return; }

      c.auth.getSession().then(function (r) {
        var u = r.data && r.data.session && r.data.session.user;
        if (!u) {
          note('<b>로그인이 필요합니다.</b><br>'
            + '인스트럭터 신청은 <b>전공자 회원</b>만 하실 수 있습니다.'
            + '<a class="ln-vd" style="margin-top:16px" href="/account/login.html">로그인 &#8594;</a>');
          return;
        }

        /* 자격과 이미 낸 신청을 <b>서버에서</b> 물어봅니다 */
        c.rpc('oc_lesson_apply_ok').then(function (g) {
          var d = (g && !g.error) ? g.data : null;
          MINE = d && d.mine ? d.mine : null;

          if (MINE) {
            /* 이미 낸 신청이 있습니다 — 상태에 따라 다르게 알려 줍니다 */
            if (MINE.status === 'approved') {
              note('<b>이미 인스트럭터로 승인되셨습니다.</b><br>'
                + '프로필을 고치실 일이 있으면 고객센터로 알려 주십시오.'
                + '<a class="ln-vd" style="margin-top:16px" href="/lesson/instructor-view.html?id='
                + encodeURIComponent(MINE.id) + '">내 프로필 보기 &#8594;</a>');
              return;
            }
            if (MINE.status === 'rejected') {
              note('<b>지난 신청이 반려되었습니다.</b><br>'
                + '까닭을 확인하시려면 고객센터로 알려 주십시오.');
              return;
            }
            note('<b>심사 중입니다.</b><br>'
              + '서류를 확인하고 있습니다. 결과는 마이페이지에서 알려 드립니다.<br>'
              + '아래에서 <b>내용을 고치실 수 있습니다.</b>');
            /* 심사 중에는 고칠 수 있습니다 (줄 보안 정책도 그렇게 두었습니다) */
          } else if (!d || d.ok !== true) {
            var why = d ? d.why : '';
            if (why === 'not_major') {
              note('<b>전공자 회원만 신청하실 수 있습니다.</b><br>'
                + '지금 회원 종류로는 신청이 되지 않습니다.<br>'
                + '전공자로 바꾸시려면 고객센터로 알려 주십시오.'
                + '<a class="ln-vd" style="margin-top:16px" href="/account/mypage.html">마이페이지 &#8594;</a>');
            } else if (why === 'not_approved') {
              note('<b>회원 승인이 끝난 뒤에 신청하실 수 있습니다.</b><br>'
                + '승인 상태는 마이페이지에서 확인하실 수 있습니다.'
                + '<a class="ln-vd" style="margin-top:16px" href="/account/mypage.html">마이페이지 &#8594;</a>');
            } else {
              note('지금은 신청하실 수 없습니다.<br>'
                + '까닭을 알기 어려우면 고객센터로 알려 주십시오.');
            }
            return;
          }

          /* 회원정보를 가져와 <b>저절로 채웁니다</b> —
             시안의 「정보불러오기」 를 손 안 대고 되게 한 것입니다. */
          c.from('members').select('*').eq('id', u.id).maybeSingle().then(function (mr) {
            ME = mr.data || { id: u.id };
            $('fId').value = ME.username || ME.email || u.email || '';
            $('fName').value = ME.name || '';
            $('fPhone').value = ME.phone || '';
            $('fEmail').value = ME.email || u.email || '';
            $('fBirth').value = ME.birth || '';
            $('fMajor').value = [ME.school_name, ME.field].filter(Boolean).join(' · ');
            if (ME.photo_url) {
              photoUrl = ME.photo_url;
              $('fPhoto').innerHTML = '<img src="' + esc(photoUrl) + '" alt="">';
            }

            /* 심사 중인 신청이 있으면 그 내용으로 덮어씁니다 */
            if (MINE) {
              c.from('lesson_instructors').select('*').eq('id', MINE.id).maybeSingle()
                .then(function (ir) {
                  var o = ir.data; if (!o) return;
                  $('fName').value = o.name || '';
                  $('fField').value = o.field || '';
                  if (o.field === '기타') { $('fFieldEtc').removeAttribute('hidden'); $('fFieldEtc').value = o.field_etc || ''; }
                  $('fPhone').value = o.phone || '';
                  $('fEmail').value = o.email || '';
                  $('fCountry').value = o.school_country || '';
                  $('fDegree').value = o.school_degree || '';
                  $('fMajor').value = o.school_major || '';
                  $('fBirth').value = o.birth || '';
                  $('fBio').value = o.bio || '';
                  $('fBioN').textContent = String(($('fBio').value || '').length);
                  if (o.photo_url) { photoUrl = o.photo_url; $('fPhoto').innerHTML = '<img src="' + esc(photoUrl) + '" alt="">'; }
                  if (o.cert_url) { certUrl = o.cert_url; certName = '등록된 증명서'; $('fCertName').value = certName; }
                  try { media = Array.isArray(o.media) ? o.media : JSON.parse(o.media || '[]'); } catch (e) {}
                  drawMedia();
                  $('fSave').textContent = '신청 내용 고치기';
                });
            }

            form.removeAttribute('hidden');
            btns.removeAttribute('hidden');
          });
        });
      });
    });

    /* ── 사진 올리기 (800픽셀로 줄여 올립니다) ─────────────── */
    $('fPhotoPick').addEventListener('click', function () { $('fPhotoFile').click(); });
    $('fPhotoFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { say('no', '10MB 넘는 파일은 받지 않습니다.'); return; }
      shrink(f, 800, function (blob) {
        if (!blob) { say('no', '사진을 읽지 못했습니다.'); return; }
        up(blob, 'lesson_ins_' + Date.now() + '.jpg', function (url) {
          if (!url) { say('no', '사진을 올리지 못했습니다.'); return; }
          photoUrl = url;
          $('fPhoto').innerHTML = '<img src="' + esc(url) + '" alt="">';
          say('ok', '사진을 올렸습니다.');
        });
      });
    });

    /* ── 증명서 ────────────────────────────────────────────── */
    $('fCertPick').addEventListener('click', function () { $('fCertFile').click(); });
    $('fCertFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { say('no', '10MB 넘는 파일은 받지 않습니다.'); return; }
      up(f, 'lesson_cert_' + Date.now() + '_' + safeName(f.name), function (url) {
        if (!url) { say('no', '증명서를 올리지 못했습니다.'); return; }
        certUrl = url; certName = f.name;
        $('fCertName').value = f.name;
        say('ok', '증명서를 올렸습니다.');
      });
    });

    /* ── 활동사진 여러 개 ──────────────────────────────────── */
    $('fMediaPick').addEventListener('click', function () { $('fMediaFile').click(); });
    $('fMediaFile').addEventListener('change', function () {
      var fs = [].slice.call(this.files || []);
      if (!fs.length) return;
      if (media.length + fs.length > 8) { say('no', '최대 여덟 개까지 올릴 수 있습니다.'); return; }
      var left = fs.length;
      fs.forEach(function (f) {
        if (f.size > 10 * 1024 * 1024) {
          say('no', esc(f.name) + ' — 10MB 넘는 파일은 받지 않습니다.');
          if (--left === 0) drawMedia();
          return;
        }
        var done = function (blob) {
          up(blob, 'lesson_m_' + Date.now() + '_' + safeName(f.name), function (url) {
            if (url) media.push({ name: f.name, url: url, size: blob.size });
            if (--left === 0) { drawMedia(); say('ok', '파일을 올렸습니다.'); }
          });
        };
        if (/^image\//.test(f.type)) shrink(f, 1400, function (b) { done(b || f); });
        else done(f);
      });
      this.value = '';
    });

    function drawMedia() {
      var ul = $('fMediaList');
      if (!ul) return;
      if (!media.length) { ul.setAttribute('hidden', ''); ul.innerHTML = ''; return; }
      ul.removeAttribute('hidden');
      ul.innerHTML = media.map(function (m, i) {
        return '<li><span class="nm">' + esc(m.name || '파일') + '</span>'
          + '<span class="sz">' + (Math.round((m.size || 0) / 1024 / 102.4) / 10) + 'MB</span>'
          + '<button type="button" class="del" data-i="' + i + '" aria-label="지우기">&#10005;</button></li>';
      }).join('');
      ul.querySelectorAll('button[data-i]').forEach(function (b) {
        b.addEventListener('click', function () {
          media.splice(parseInt(b.getAttribute('data-i'), 10), 1);
          drawMedia();
        });
      });
    }

    /* ── 저장 ──────────────────────────────────────────────── */
    $('fSave').addEventListener('click', function () {
      var nm = ($('fName').value || '').trim();
      var fd = $('fField').value || '';
      var ph = ($('fPhone').value || '').trim();
      var bio = ($('fBio').value || '').trim();

      if (!nm) { say('no', '이름을 적어 주십시오.'); $('fName').focus(); return; }
      if (!fd) { say('no', '활동분야를 골라 주십시오.'); $('fField').focus(); return; }
      if (fd === '기타' && !($('fFieldEtc').value || '').trim()) {
        say('no', '기타 분야를 적어 주십시오.'); $('fFieldEtc').focus(); return;
      }
      if (!ph) { say('no', '전화번호를 적어 주십시오.'); $('fPhone').focus(); return; }
      if (bio.length < 20) { say('no', '이력사항을 <b>스무 글자 이상</b> 적어 주십시오. 심사에 쓰입니다.'); $('fBio').focus(); return; }
      if (!certUrl) { say('no', '<b>증명서</b>를 올려 주십시오. 학력·경력을 확인해야 승인할 수 있습니다.'); return; }
      if (!$('fAgree').checked) { say('no', '개인정보 수집 및 이용에 동의해 주십시오.'); return; }

      var btn = $('fSave');
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = '보내는 중…';

      var row = {
        member_id: ME.id,
        name: nm,
        field: fd,
        field_etc: fd === '기타' ? ($('fFieldEtc').value || '').trim() : null,
        phone: ph,
        email: ($('fEmail').value || '').trim() || null,
        school_country: ($('fCountry').value || '').trim() || null,
        school_degree: $('fDegree').value || null,
        school_major: ($('fMajor').value || '').trim() || null,
        birth: $('fBirth').value || null,
        photo_url: photoUrl || null,
        bio: bio,
        cert_url: certUrl || null,
        media: media
      };

      var c = sb();
      var job = MINE
        ? c.from('lesson_instructors').update(row).eq('id', MINE.id).select('id')
        : c.from('lesson_instructors').insert(row).select('id');

      job.then(function (r) {
        /* ★ 몇 줄이 바뀌었는지 <b>받아서 확인</b>합니다.
           Supabase 는 줄 보안이 막으면 <b>오류 없이 0줄</b>을 바꿉니다.
           그러면 「보냈습니다」 라고 알려도 실제로는 아무 일이 없습니다.
           (회원정보 수정에서 겪은 함정입니다) */
        if (r.error) throw new Error(r.error.message);
        if (!r.data || !r.data.length) {
          say('no', '보내지지 않았습니다. 한 줄도 저장되지 않았습니다 — '
            + '자격이나 권한 문제일 수 있으니 고객센터로 알려 주십시오.');
          btn.disabled = false; btn.textContent = old;
          return;
        }
        form.setAttribute('hidden', '');
        btns.setAttribute('hidden', '');
        note('<b>신청을 보냈습니다.</b><br>'
          + '서류를 확인한 뒤 알려 드립니다. 진행 상태는 마이페이지에서 보실 수 있습니다.'
          + '<a class="ln-vd" style="margin-top:16px" href="/account/mypage.html">마이페이지 &#8594;</a>');
        if (sayBox) sayBox.innerHTML = '';
      }).catch(function (e) {
        say('no', '보내지 못했습니다: ' + esc(String(e.message || e).slice(0, 120)));
        btn.disabled = false; btn.textContent = old;
      });
    });

    /* ── 파일 올리기 도우미 ────────────────────────────────── */
    function safeName(n) {
      /* 한글·공백·특수문자가 든 이름은 저장통에서 말썽을 냅니다 */
      return String(n || 'file').replace(/[^\w.\-]/g, '_').slice(-40);
    }
    function up(blob, name, cb) {
      var c = sb();
      if (!c || !ME) return cb('');
      /* ★ 경로의 <b>첫 폴더가 내 id</b> 여야 합니다 —
         recruit 저장통의 권한 규칙이 그렇습니다.
         member/{내id}/… 로 했다가 막힌 일이 있었습니다. */
      var path = ME.id + '/' + name;
      c.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
        .then(function (r) {
          if (r.error) { console.error('올리기 실패:', r.error); return cb(''); }
          cb(c.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
        })
        .catch(function () { cb(''); });
    }
    function shrink(file, max, cb) {
      try {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function () {
          var w = img.width, h = img.height;
          var s = Math.min(1, max / Math.max(w, h));
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
  }

  window.OCLessonIns = { list: list, view: view, apply: apply, FIELDS: FIELDS };
})();
