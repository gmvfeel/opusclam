/* ============================================================
   OPUSCLAM 공용 글쓰기 엔진 — assets/board-write.js
   폼 생성 + 리치에디터 + 이미지 업로드(+카드용 썸네일) + 저장.
   각 글쓰기 페이지는 OCBoardWrite.init(cfg) 만 호출 (복붙 없음).
   cfg = { table, listPage, viewPage, bucket, formTitle,
           categories:[{value,label}], mount:'#bw-root' }
   ※ 페이지엔 supabase-js, DOMPurify, auth.js 가 먼저 로드돼야 함.
   ============================================================ */
(function () {
  'use strict';
  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function clean(html) { try { return window.DOMPurify ? window.DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'style'] }) : html; } catch (e) { return html; } }

  function formHtml(cfg) {
    var catRow = '';
    if (cfg.categories && cfg.categories.length) {
      var opts = cfg.categories.map(function (c) { return '<option value="' + esc(c.value) + '">' + esc(c.label || c.value) + '</option>'; }).join('');
      catRow = '<div class="bf-row" style="max-width:220px"><label>분류 *</label><select id="f-category">' + opts + '</select></div>';
    }
    return ''
      + '<div id="bwGate" class="bf-gate">확인 중…</div>'
      + '<form class="board-form" id="bwForm" style="display:none" onsubmit="return false">'
      + '<div class="bf-formhead">' + esc(cfg.formTitle || '등록') + ' <span class="bf-req">* 필수입력사항입니다.</span></div>'
      + catRow
      + '<div class="bf-row"><label>제목 *</label><input type="text" id="f-title" placeholder="제목을 입력하세요"></div>'
      + '<div class="bf-row"><label>내용 *</label><div class="bf-editor">'
      + '<div class="bf-etools" id="f-tools">'
      + '<button type="button" data-cmd="bold" title="굵게"><b>B</b></button>'
      + '<button type="button" data-cmd="italic" title="기울임"><i>I</i></button>'
      + '<button type="button" data-cmd="underline" title="밑줄"><u>U</u></button>'
      + '<button type="button" data-cmd="strikeThrough" title="취소선"><s>S</s></button>'
      + '<label class="bf-color" title="글자색">색<input type="color" id="f-color" value="#7c63b0"></label>'
      + '<span class="bf-sep"></span>'
      + '<button type="button" data-cmd="justifyLeft" title="왼쪽 정렬">좌</button>'
      + '<button type="button" data-cmd="justifyCenter" title="가운데 정렬">중</button>'
      + '<button type="button" data-cmd="insertUnorderedList" title="글머리 목록">• 목록</button>'
      + '<button type="button" data-cmd="insertOrderedList" title="번호 목록">1. 목록</button>'
      + '<span class="bf-sep"></span>'
      + '<button type="button" id="f-link" title="링크 넣기">링크</button>'
      + '<button type="button" id="f-image" title="이미지 넣기">이미지</button>'
      + '</div>'
      + '<div class="bf-earea" id="f-body" contenteditable="true" data-ph="내용을 입력하세요."></div>'
      + '</div><input type="file" id="f-imgfile" accept="image/*" multiple style="display:none"></div>'
      + '<div class="bf-row"><label>검색어 <span style="color:var(--text-3);font-weight:400">(선택)</span></label><input type="text" id="f-keywords" placeholder="쉼표(,)로 구분"></div>'
      + '<label class="bf-consent"><span class="bf-consent-t">등록하신 콘텐츠가 성격에 맞지 않거나 비속어 등이 사용된 것으로 판단된 경우, 예고 없이 등록하신 데이터가 삭제될 수 있습니다.<br>데이터 등록이 승인된 경우, 모든 유료서비스에 사용할 수 있는 액티브포인트가 적립됩니다.(등록한 데이터별 100 액티브포인트 제공)</span>'
      + '<span class="bf-consent-c"><input type="checkbox" id="f-agree"> 동의</span></label>'
      + '<div class="bf-actions"><button type="button" class="bf-submit" id="bwSubmit">작성완료</button><a class="bf-cancel" href="' + esc(cfg.listPage) + '">취소</a></div>'
      + '<div class="bf-msg" id="bwMsg"></div>'
      + '</form>';
  }

  function init(cfg) {
    cfg = cfg || {};
    cfg.bucket = cfg.bucket || cfg.table;
    var mount = document.querySelector(cfg.mount || '#bw-root');
    if (!mount) { console.error('board-write: mount 없음'); return; }
    mount.innerHTML = formHtml(cfg);

    var sb = window.supabase.createClient(SB_URL, SB_KEY);
    var editId = new URLSearchParams(location.search).get('id');
    var me = null, thumbMap = {}, savedRange = null;

    function gate(msg) { var g = $('bwGate'); g.style.display = ''; g.innerHTML = esc(msg) + '<br><br><a class="bf-cancel" href="' + esc(cfg.listPage) + '">목록으로</a>'; }

    /* 에디터 */
    function saveSel() { var s = window.getSelection(); var ed = $('f-body'); if (s && s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0); }
    function restoreSel() { var ed = $('f-body'); ed.focus(); if (savedRange) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
    function exec(cmd, val) { restoreSel(); document.execCommand(cmd, false, val || null); saveSel(); }
    function initEditor() {
      var ed = $('f-body');
      ed.addEventListener('keyup', saveSel); ed.addEventListener('mouseup', saveSel); ed.addEventListener('blur', saveSel);
      var tools = $('f-tools');
      tools.addEventListener('mousedown', function (e) { if (e.target.closest('button,label')) e.preventDefault(); });
      tools.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var cmd = b.getAttribute('data-cmd'); if (cmd) exec(cmd); });
      $('f-color').addEventListener('input', function () { exec('foreColor', this.value); });
      $('f-link').addEventListener('click', function () { var url = prompt('링크 주소를 입력하세요', 'https://'); if (!url) return; exec('createLink', url); });
      $('f-image').addEventListener('click', function () { $('f-imgfile').click(); });
      $('f-imgfile').addEventListener('change', function () { uploadImages(this.files); this.value = ''; });
    }

    function makeThumbBlob(file, maxW) {
      return new Promise(function (resolve) {
        try {
          var im = new Image();
          im.onload = function () {
            var s = Math.min(1, maxW / im.width);
            if (s >= 1) { resolve(null); return; }
            var w = Math.round(im.width * s), h = Math.round(im.height * s);
            var c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').drawImage(im, 0, 0, w, h);
            c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.85);
          };
          im.onerror = function () { resolve(null); };
          im.src = URL.createObjectURL(file);
        } catch (e) { resolve(null); }
      });
    }
    function uploadImages(files) {
      if (!files || !files.length) return;
      $('bwMsg').textContent = '이미지 업로드 중…';
      var arr = [].slice.call(files);
      (function next(i) {
        if (i >= arr.length) { $('bwMsg').textContent = ''; return; }
        var file = arr[i];
        var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        var base = me.id + '/' + Date.now() + '_' + i;
        sb.storage.from(cfg.bucket).upload(base + '.' + ext, file, { upsert: false }).then(function (res) {
          if (res.error) { $('bwMsg').textContent = '이미지 업로드 실패: ' + res.error.message; return; }
          var url = sb.storage.from(cfg.bucket).getPublicUrl(base + '.' + ext).data.publicUrl;
          restoreSel();
          document.execCommand('insertHTML', false, '<img src="' + url + '" alt=""><p><br></p>');
          saveSel();
          makeThumbBlob(file, 640).then(function (blob) {
            if (!blob) { next(i + 1); return; }
            sb.storage.from(cfg.bucket).upload(base + '_thumb.jpg', blob, { upsert: false, contentType: 'image/jpeg' }).then(function (tr) {
              if (!tr.error) { thumbMap[url] = sb.storage.from(cfg.bucket).getPublicUrl(base + '_thumb.jpg').data.publicUrl; }
              next(i + 1);
            });
          });
        });
      })(0);
    }

    function initForm() {
      $('bwGate').style.display = 'none';
      $('bwForm').style.display = '';
      initEditor();
      if (editId) {
        var h = $('bwHead'); if (h) h.textContent = (h.textContent || '').replace('작성', '수정') || '수정';
        $('bwSubmit').textContent = '수정완료';
        sb.from(cfg.table).select('*').eq('id', editId).single().then(function (r) {
          if (r.error || !r.data) { $('bwMsg').textContent = '글을 불러오지 못했습니다.'; return; }
          var o = r.data;
          if ($('f-category')) $('f-category').value = o.category || (cfg.categories && cfg.categories[0] ? cfg.categories[0].value : '');
          $('f-title').value = o.title || '';
          $('f-body').innerHTML = clean(o.body || '');
          $('f-keywords').value = o.keywords || '';
          $('f-agree').checked = true;
        });
      }
      $('bwSubmit').addEventListener('click', submit);
    }

    function submit() {
      var btn = $('bwSubmit');
      var title = $('f-title').value.trim();
      var bodyHtml = clean($('f-body').innerHTML.trim());
      var isEmpty = !$('f-body').textContent.trim() && !/<img/i.test(bodyHtml);
      if (!title) { $('bwMsg').textContent = '제목을 입력해 주세요.'; $('f-title').focus(); return; }
      if (isEmpty) { $('bwMsg').textContent = '내용을 입력해 주세요.'; return; }
      if (!$('f-agree').checked) { $('bwMsg').textContent = '안내사항 동의가 필요합니다.'; return; }

      var tmp = document.createElement('div'); tmp.innerHTML = bodyHtml;
      var firstImg = tmp.querySelector('img');
      var fsrc = firstImg ? firstImg.getAttribute('src') : null;
      var thumb = fsrc ? (thumbMap[fsrc] || fsrc) : null;

      var row = { title: title, body: bodyHtml, thumb_url: thumb, keywords: $('f-keywords').value.trim() || null };
      if ($('f-category')) row.category = $('f-category').value;
      btn.disabled = true; $('bwMsg').textContent = '저장 중…';

      var op;
      if (editId) { op = sb.from(cfg.table).update(row).eq('id', editId); }
      else { row.author_id = me.id; row.author_name = me.name; op = sb.from(cfg.table).insert(row).select('id').single(); }
      op.then(function (res) {
        btn.disabled = false;
        if (res.error) { $('bwMsg').textContent = '저장 실패: ' + res.error.message; return; }
        var goId = editId || (res.data && res.data.id);
        location.href = goId ? (cfg.viewPage + '?id=' + encodeURIComponent(goId)) : cfg.listPage;
      });
    }

    document.addEventListener('DOMContentLoaded', boot);
    if (document.readyState !== 'loading') boot();
    var booted = false;
    function boot() {
      if (booted) return; booted = true;
      sb.auth.getSession().then(function (r) {
        var user = r.data && r.data.session && r.data.session.user;
        if (!user) { gate('글을 작성하려면 로그인이 필요합니다.'); return; }
        sb.from('members').select('*').eq('id', user.id).maybeSingle().then(function (mr) {
          var m = mr.data || {};
          me = { id: user.id, name: (m.name || m.nickname || m.display_name || m.username || (user.email || '회원').split('@')[0]), is_admin: !!m.is_admin };
          initForm();
        }).catch(function () { me = { id: user.id, name: (user.email || '회원').split('@')[0], is_admin: false }; initForm(); });
      });
    }
  }

  window.OCBoardWrite = { init: init };
})();
