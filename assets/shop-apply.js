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

  /* ══ 첨부 (2026-08-06 · 파트너 요청) ═══════════════════════════
     ★ 저장통 설정과 <b>짝을 맞춰야 합니다</b> —
       shop 저장통은 5MB · 이미지+PDF 로 조여 두었습니다
       (sql/shop-inquiry-04-files.sql). 화면이 더 너그러우면 고른 뒤에
       서버가 거부해서 까닭을 알 수 없습니다.
     ★ 사진은 <b>1400px 로 줄여</b> 올립니다 — 요즘 휴대폰 사진은 8MB 가
       예사인데 그대로 받으면 용량이 빨리 찹니다. 줄이면 대개 300KB 안쪽이
       되므로, 원본은 15MB 까지 받아 줍니다(줄일 것이므로).
     ★ PDF 는 줄일 수 없어 5MB 로 막습니다.
     ★ 고른 파일은 <b>보내기를 누를 때</b> 한꺼번에 올립니다 — 미리 올리면
       보내지 않은 파일이 저장통에 쌓입니다. */
  var MAX_FILES   = 3;
  var MAX_DOC     = 5 * 1024 * 1024;    /* 줄일 수 없는 것 — 저장통과 같게 */
  var MAX_IMG_SRC = 15 * 1024 * 1024;   /* 사진 원본 — 줄여 올리므로 넉넉히 */
  var IMG_MAX_PX  = 1400;
  var OK_TYPES    = /^image\/(jpeg|png|webp|gif)$|^application\/pdf$/;

  var PICKED = [];   /* [{ file, blob, name, size, isImg, preview }] */

  function fmtSize(n) {
    if (!n) return '0B';
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + 'KB';
    return (n / 1024 / 1024).toFixed(1) + 'MB';
  }

  /* 사진을 줄입니다 — 못 줄이면 원본을 그대로 씁니다(그림이 이상한 경우) */
  function shrink(file, maxPx, cb) {
    try {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        try {
          var w = im.naturalWidth, h = im.naturalHeight;
          var r = Math.min(1, maxPx / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * r)), ch = Math.max(1, Math.round(h * r));
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(im, 0, 0, cw, ch);
          cv.toBlob(function (b) {
            /* ★ 원본 주소를 되돌린 뒤 <b>그 주소를 미리보기로 넘기면</b>
               이미 없는 것을 가리켜 그림이 깨집니다(ERR_FILE_NOT_FOUND).
               실제로 그렇게 만들었다가 콘솔에서 잡았습니다.
               ▶ 미리보기는 <b>줄인 그림</b>으로 새로 만듭니다 — 깨지지 않고
                 메모리도 원본보다 훨씬 적게 씁니다. */
            URL.revokeObjectURL(url);
            var out = b || file;
            var pv = null;
            try { pv = URL.createObjectURL(out); } catch (e2) {}
            cb(out, pv);
          }, 'image/jpeg', 0.86);
        } catch (e) { URL.revokeObjectURL(url); cb(file, null); }
      };
      im.onerror = function () {
        /* 줄이지 못하면 원본을 쓰고, 미리보기도 원본으로 새로 만듭니다 */
        URL.revokeObjectURL(url);
        var pv = null;
        try { pv = URL.createObjectURL(file); } catch (e2) {}
        cb(file, pv);
      };
      im.src = url;
    } catch (e) { cb(file, null); }
  }

  /* 파일 이름을 저장통에 쓸 수 있게 다듬습니다 —
     한글·빈칸·특수문자가 든 이름은 주소로 만들 때 말썽입니다. */
  function safeName(name) {
    var m = String(name || '').match(/\.([A-Za-z0-9]{1,8})$/);
    var ext = m ? m[1].toLowerCase() : 'bin';
    return Math.random().toString(36).slice(2, 8) + '_'
         + Date.now().toString(36) + '.' + ext;
  }

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

    /* ── 첨부 손잡이 ─────────────────────────────────────── */
    var pick = $('saPick'), inp = $('saFile'), drop = $('saDrop');
    if (pick && inp) {
      pick.addEventListener('click', function () { inp.click(); });
      inp.addEventListener('change', function () {
        addFiles(inp.files);
        inp.value = '';   /* 같은 파일을 다시 고를 수 있게 비웁니다 */
      });
    }
    /* 끌어다 놓기 — 되면 편하고, 안 되어도 「파일 고르기」가 있습니다 */
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault(); drop.classList.add('over');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault(); drop.classList.remove('over');
        });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }

    var btn = $('saSend');
    if (btn) btn.addEventListener('click', function () { send(this); });

    /* 글자 수 세기 */
    var msg = $('saMsg'), cnt = $('saMsgN');
    if (msg && cnt) msg.addEventListener('input', function () { cnt.textContent = msg.value.length; });
  }

  /* ── 고른 파일을 목록에 담습니다 ──────────────────────────
     ★ 여기서 <b>걸러 냅니다</b> — 종류·크기·개수. 서버가 최종 결정이지만
       고르는 순간 알려 주는 편이 낫습니다(올리다가 거부되면 헛수고). */
  function addFiles(list) {
    if (!list || !list.length) return;
    var arr = [].slice.call(list);
    var msgs = [];

    (function next(i) {
      if (i >= arr.length) {
        drawFiles();
        if (msgs.length) say('no', msgs.join('<br>'));
        else say('', '');
        return;
      }
      var f = arr[i];

      if (PICKED.length >= MAX_FILES) {
        msgs.push('첨부는 <b>' + MAX_FILES + '개</b>까지입니다. '
                + '「' + esc(f.name) + '」 이후는 넣지 않았습니다.');
        return next(arr.length);
      }
      if (!OK_TYPES.test(String(f.type || ''))) {
        msgs.push('「' + esc(f.name) + '」 은 받지 않는 종류입니다 ('
                + esc(f.type || '알 수 없음') + '). <b>이미지</b>나 <b>PDF</b>로 보내 주십시오.');
        return next(i + 1);
      }
      var isImg = /^image\//.test(f.type);
      var lim = isImg ? MAX_IMG_SRC : MAX_DOC;
      if (f.size > lim) {
        msgs.push('「' + esc(f.name) + '」 이 너무 큽니다 (' + fmtSize(f.size) + ' · '
                + (isImg ? '사진은 15MB' : 'PDF 는 5MB') + '까지).'
                + (isImg ? '' : ' 스캔 품질을 낮추거나 쪽수를 줄이면 작아집니다.'));
        return next(i + 1);
      }
      /* 같은 파일을 두 번 넣지 않습니다 */
      if (PICKED.some(function (p) { return p.name === f.name && p.size === f.size; })) {
        return next(i + 1);
      }

      if (isImg) {
        shrink(f, IMG_MAX_PX, function (blob, preview) {
          PICKED.push({ file: f, blob: blob, name: f.name, size: blob.size,
                        isImg: true, preview: preview || null });
          drawFiles();
          next(i + 1);
        });
      } else {
        PICKED.push({ file: f, blob: f, name: f.name, size: f.size, isImg: false, preview: null });
        next(i + 1);
      }
    })(0);
  }

  function drawFiles() {
    var box = $('saFiles');
    if (!box) return;
    if (!PICKED.length) { box.innerHTML = ''; return; }

    box.innerHTML = PICKED.map(function (p, i) {
      var th = p.isImg && p.preview
        ? '<img src="' + esc(p.preview) + '" alt="">'
        : (p.isImg ? 'IMG' : 'PDF');
      return '<div class="sa-file">'
        + '<span class="sa-file-th">' + th + '</span>'
        + '<span class="sa-file-in">'
        +   '<span class="sa-file-nm">' + esc(p.name) + '</span>'
        +   '<span class="sa-file-sz">' + fmtSize(p.size)
        +     (p.isImg && p.blob !== p.file ? ' · 줄였습니다' : '') + '</span>'
        + '</span>'
        + '<button type="button" class="sa-file-x" data-rm="' + i + '" '
        +   'aria-label="' + esc(p.name) + ' 빼기">&#10005;</button>'
        + '</div>';
    }).join('');

    [].forEach.call(box.querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-rm'), 10);
        var p = PICKED[i];
        if (p && p.preview) { try { URL.revokeObjectURL(p.preview); } catch (e) {} }
        PICKED.splice(i, 1);
        drawFiles();
      });
    });
  }

  /* ── 저장통에 올립니다 ────────────────────────────────────
     ★ 올리다 막히면 <b>문의는 그대로 보냅니다</b> — 파일 때문에 문의를
       놓치는 것이 가장 나쁩니다. 그때는 「메일로 보내 주십시오」 라고
       알려 드립니다(창구를 닫아 둔 경우에도 이렇게 됩니다). */
  function upload(c, cb) {
    if (!PICKED.length) return cb([], null);
    var day = new Date().toISOString().slice(0, 10);
    var out = [], failed = 0;

    (function next(i) {
      if (i >= PICKED.length) return cb(out, failed);
      var p = PICKED[i];
      var path = 'inquiry/' + day + '/' + safeName(p.name);
      c.storage.from('shop').upload(path, p.blob, {
        contentType: p.isImg ? 'image/jpeg' : (p.file.type || 'application/pdf'),
        upsert: false
      }).then(function (r) {
        if (r.error) failed++;
        else out.push({ name: p.name, path: path, size: p.size });
        next(i + 1);
      })['catch'](function () { failed++; next(i + 1); });
    })(0);
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

    /* ★ 파일을 <b>먼저</b> 올리고 그 목록과 함께 문의를 담습니다.
       ★ 파일이 막혀도 <b>문의는 보냅니다</b> — 파일 때문에 문의를 놓치는
         것이 가장 나쁩니다. 몇 개가 못 올라갔는지 알려 드립니다. */
    if (btn) btn.textContent = PICKED.length ? '파일을 올리는 중…' : '보내는 중…';

    upload(c, function (files, failed) {
      if (btn) btn.textContent = '보내는 중…';

      c.from('shop_inquiries').insert({
        company: company, person: person, email: email,
        phone: phone || null, site_url: url || null,
        category: cat || null, message: message || null,
        attachments: files,
        status: 'new'
      }).select('id').then(function (r) {
        /* ★ 몇 줄이 들어갔는지 <b>받아서</b> 확인합니다 —
           줄 보안에 막히면 오류 없이 0줄이 됩니다. */
        if (r.error) throw new Error(r.error.message);
        if (!(r.data || []).length) throw new Error('보내지 못했습니다. 잠시 뒤 다시 시도해 주십시오.');
        done(failed);
      })['catch'](function (e) {
        btn.disabled = false; btn.textContent = old;
        var m = String(e.message || e);
        if (/check|constraint/i.test(m)) m = '적어 주신 내용이 너무 깁니다. 줄여서 다시 보내 주십시오.';
        else if (/row-level|policy/i.test(m)) m = '보내지 못했습니다. 메일로 보내 주시면 확인하겠습니다.';
        say('no', esc(m) + '<br>급하시면 <a href="mailto:cser@wixon.co.kr">cser@wixon.co.kr</a> 로 보내 주십시오.');
      });
    });
  }

  function focus(id) { var e = $(id); if (e) { try { e.focus(); } catch (x) {} } }

  /* 보낸 뒤 — 폼을 감추고 고맙다는 말을 둡니다.
     ★ 폼을 그대로 두면 「보내졌나?」 하고 다시 누르게 됩니다. */
  function done(failed) {
    var wrap = $('saForm');
    if (!wrap) return;
    /* 미리보기로 만든 주소를 되돌립니다 — 두면 메모리에 남습니다 */
    PICKED.forEach(function (p) {
      if (p.preview) { try { URL.revokeObjectURL(p.preview); } catch (e) {} }
    });
    PICKED = [];

    /* ★ 파일이 못 올라갔으면 <b>숨기지 않고</b> 알립니다 —
       「보냈다」고만 하면 파트너가 자료를 기다리다 엇갈립니다. */
    var fileNote = failed
      ? '<p class="sa-done-sub" style="color:#b4685f">'
        + '다만 첨부 <b>' + failed + '개</b>는 올라가지 않았습니다. '
        + '<a href="mailto:cser@wixon.co.kr">cser@wixon.co.kr</a> 로 보내 주시면 함께 보겠습니다.</p>'
      : '';

    wrap.innerHTML =
        '<div class="sa-done">'
      +   '<div class="sa-done-i" aria-hidden="true">&#10003;</div>'
      +   '<h3>문의를 받았습니다</h3>'
      +   '<p>적어 주신 메일로 <b>영업일 기준 2~3일 안에</b> 답을 드리겠습니다.<br>'
      +     '초기 입점 혜택과 노출 자리를 함께 안내해 드립니다.</p>'
      +   fileNote
      +   '<p class="sa-done-sub">답이 늦으면 <a href="mailto:cser@wixon.co.kr">cser@wixon.co.kr</a> 로 '
      +     '다시 알려 주십시오. 메일이 스팸함에 들어가는 일이 있습니다.</p>'
      + '</div>';
    try { wrap.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  window.OCShopApply = { form: form };
})();
