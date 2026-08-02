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
    var regionRow = '';
    if (cfg.regions && cfg.regions.length) {
      var ropts = cfg.regions.map(function (r) { return '<option value="' + esc(r.value) + '">' + esc(r.label || r.value) + '</option>'; }).join('');
      regionRow = '<div class="bf-row" style="max-width:220px"><label>국내/해외 *</label><select id="f-region">' + ropts + '</select></div>';
    }
    /* docFields
         true            → 홈페이지 · 로고 · 첨부파일 세 칸 (입시요강 기본값)
         { ... } 객체    → 칸마다 켜고 끄거나 라벨을 바꿀 수 있다
           home:false / logo:false / file:false      해당 칸을 만들지 않는다
           homeLabel · homeHint · homePlaceholder    링크 칸 문구
           fileLabel · fileHint                      첨부 칸 문구
       옵션을 주지 않으면 기존과 똑같이 동작하므로 다른 게시판에 영향이 없다 */
    var docRows = '';
    if (cfg.docFields) {
      var D = (typeof cfg.docFields === 'object' && cfg.docFields) ? cfg.docFields : {};
      var HINT = function (t) { return '<span style="color:var(--text-3);font-weight:400">' + t + '</span>'; };
      if (D.home !== false) {
        docRows += '<div class="bf-row"><label>' + esc(D.homeLabel || '홈페이지') + ' ' + HINT(esc(D.homeHint || '(선택)')) + '</label>'
          + '<input type="text" id="f-home" placeholder="' + esc(D.homePlaceholder || '관련 홈페이지 주소') + '"></div>';
      }
      if (D.logo !== false) {
        docRows += '<div class="bf-row"><label>로고등록 ' + HINT('(학교/기관 로고, 선택)') + '</label><div class="bf-file"><button type="button" class="bf-filebtn" id="f-logobtn">이미지 선택</button><span class="bf-filename" id="f-logoname">선택된 파일 없음</span></div><input type="file" id="f-logofile" accept="image/*" style="display:none"></div>';
      }
      /* extra — 링크 칸을 원하는 개수만큼 추가한다
           extra:[ { col:'audio_url', label:'음원', hint:'(링크, 선택)', placeholder:'https://' }, ... ]
         col 은 표의 컬럼 이름이며, 그 컬럼에 입력값이 그대로 저장된다 */
      if (Array.isArray(D.extra)) {
        D.extra.forEach(function (x) {
          if (!x || !x.col) return;
          docRows += '<div class="bf-row"><label>' + esc(x.label || x.col) + ' ' + HINT(esc(x.hint || '(선택)')) + '</label>'
            + '<input type="text" id="f-x-' + esc(x.col) + '" placeholder="' + esc(x.placeholder || 'https://') + '"></div>';
        });
      }
      /* extraLinks: 링크 칸을 필요한 만큼 추가한다
           [{ col:'audio_url', label:'음원', hint:'(듣기 주소, 선택)', placeholder:'https://' }, ...]
         col 은 저장할 컬럼 이름이다. 입력칸 id 는 f-x-<col> 로 만든다. */
      (D.extraLinks || []).forEach(function (x) {
        docRows += '<div class="bf-row"><label>' + esc(x.label || x.col) + ' ' + HINT(esc(x.hint || '(선택)')) + '</label>'
          + '<input type="text" id="f-x-' + esc(x.col) + '" placeholder="' + esc(x.placeholder || 'https://') + '"></div>';
      });
      if (D.file !== false) {
        docRows += '<div class="bf-row"><label>' + esc(D.fileLabel || '첨부파일') + ' ' + HINT(esc(D.fileHint || '(요강 문서 hwp·pdf·doc 등, 선택)')) + '</label>'
          + '<div class="bf-file"><button type="button" class="bf-filebtn" id="f-docbtn">파일 선택</button><span class="bf-filename" id="f-docname">선택된 파일 없음</span></div><input type="file" id="f-docfile" style="display:none"></div>';
      }
    }
    return ''
      + '<div id="bwGate" class="bf-gate">확인 중…</div>'
      + '<form class="board-form" id="bwForm" style="display:none" onsubmit="return false">'
      + '<div class="bf-formhead">' + esc(cfg.formTitle || '등록') + ' <span class="bf-req">* 필수입력사항입니다.</span></div>'
      + catRow
      + regionRow
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
      + '<button type="button" id="f-image" title="사진 · 영상 · 음원 · 파일 넣기">파일넣기</button>'
      + '</div>'
      + '<div class="bf-earea" id="f-body" contenteditable="true" data-ph="내용을 입력하세요."></div>'
      /* ★ 종류 제한을 두지 않습니다(accept 없음).
         사진뿐 아니라 영상·음원·악보 PDF 도 올릴 수 있어야 합니다.
         아이폰 사진(HEIC)처럼 accept="image/*" 에서 걸러지던 것도 이제 됩니다.
         넣을 때 종류를 보고 사진·영상·음원·내려받기로 갈라 넣습니다. */
      + '</div><input type="file" id="f-imgfile" multiple style="display:none"></div>'
      + docRows
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

    /* ★ 접속 객체는 화면 전체에 하나만 둡니다 (window.__ocSb).
       여러 개 만들면 콘솔에 「Multiple GoTrueClient instances」 경고가 뜨고,
       같은 저장 열쇠를 다투다 <b>세션 토큰이 질의에 안 실리는</b> 일이 생깁니다.
       그때 권한 규칙이 자료를 막고, RLS 는 오류가 아니라 빈 결과를 주므로
       코드가 「권한 없음」 으로 잘못 읽습니다. */
    if (!window.__ocSb) window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
    var sb = window.__ocSb;
    var editId = new URLSearchParams(location.search).get('id');
    var me = null, thumbMap = {}, savedRange = null, logoUrl = null, fileUrl = null, fileName = null;

    function gate(msg) { var g = $('bwGate'); g.style.display = ''; g.innerHTML = esc(msg) + '<br><br><a class="bf-cancel" href="' + esc(cfg.listPage) + '">목록으로</a>'; }

    /* 에디터 */
    /* ★ 선택 위치를 저장·복원합니다.

       쓰기 전에 <b>아직 살아 있는지 확인</b>하고, 죽었으면 글 맨 끝에 놓습니다.
       아무 일도 일어나지 않는 것보다 끝에라도 들어가는 편이 낫습니다. */
    function saveSel() {
      var s = window.getSelection(); var ed = $('f-body');
      if (s && s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
    }

    /* 저장해 둔 자리가 아직 쓸 수 있는지 — <b>대비용</b>입니다.

       ★ 확인한 사실 — 브라우저는 문서가 바뀌면 기억해 둔 자리의 번호를
         스스로 맞춰 줍니다. 그래서 「사진을 지웠더니 자리가 망가졌다」 는
         제 첫 짐작은 <b>틀렸습니다.</b> jsdom 으로 시험해 확인했습니다.

       그래도 이 검사를 두는 까닭은 자리가 <b>정말로</b> 죽는 경우가 있기
       때문입니다 — 글 전체를 다시 그리거나(고치기 화면을 불러올 때),
       굵게·색 바꾸기가 문단을 통째로 갈아치울 때입니다.
       그때는 아무 일도 일어나지 않는 대신 글 맨 끝에 넣습니다. */
    function selAlive() {
      var ed = $('f-body');
      if (!savedRange || !ed) return false;
      try {
        var n = savedRange.startContainer;
        if (!document.contains(n) || !ed.contains(n)) return false;
        var max = (n.nodeType === 3) ? String(n.nodeValue || '').length : n.childNodes.length;
        if (savedRange.startOffset > max) return false;
        var n2 = savedRange.endContainer;
        if (!ed.contains(n2)) return false;
        var max2 = (n2.nodeType === 3) ? String(n2.nodeValue || '').length : n2.childNodes.length;
        if (savedRange.endOffset > max2) return false;
        return true;
      } catch (e) { return false; }
    }

    function restoreSel() {
      var ed = $('f-body');
      ed.focus();
      var s = window.getSelection();
      if (selAlive()) {
        try { s.removeAllRanges(); s.addRange(savedRange); return; } catch (e) {}
      }
      /* 자리가 사라졌으면 글 맨 끝으로 */
      savedRange = null;
      try {
        var r = document.createRange();
        r.selectNodeContents(ed); r.collapse(false);
        s.removeAllRanges(); s.addRange(r);
        savedRange = r.cloneRange();
      } catch (e) {}
    }

    /* ★ 글 안에 무언가를 끼워 넣습니다.
       execCommand('insertHTML') 은 오래된 기능이라 브라우저마다 다르게 굴고,
       편집칸에 초점이 없으면 조용히 아무 일도 하지 않습니다.
       그래서 Range 로 직접 넣고, 안 되면 execCommand 로 한 번 더 시도합니다. */
    function insertNodes(html) {
      var ed = $('f-body');
      restoreSel();
      var s = window.getSelection();
      try {
        if (!s.rangeCount) throw new Error('no range');
        var r = s.getRangeAt(0);
        r.deleteContents();
        var tpl = document.createElement('template');
        tpl.innerHTML = html;
        var frag = tpl.content;
        var last = frag.lastChild;
        r.insertNode(frag);
        if (last) {
          var after = document.createRange();
          after.setStartAfter(last); after.collapse(true);
          s.removeAllRanges(); s.addRange(after);
          savedRange = after.cloneRange();
        }
        return true;
      } catch (e) {
        try { document.execCommand('insertHTML', false, html); saveSel(); return true; }
        catch (e2) {
          /* 마지막 방법 — 글 맨 끝에 붙입니다 */
          try { ed.insertAdjacentHTML('beforeend', html); saveSel(); return true; } catch (e3) {}
          return false;
        }
      }
    }
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
    /* 파일 이름에서 확장자를 뽑습니다.
       이름에 확장자가 없으면(휴대폰에서 바로 올릴 때 그런 일이 있습니다)
       종류(MIME)에서 짐작합니다. 그러지 않으면 파일 이름 전체가
       확장자 자리에 들어가 이상한 주소가 됩니다. */
    function extOf(file) {
      var n = String(file.name || '');
      var m = n.match(/\.([A-Za-z0-9]{1,8})$/);
      if (m) return m[1].toLowerCase();
      var t = String(file.type || '');
      var guess = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
        'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif', 'image/svg+xml': 'svg',
        'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
        'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'm4a', 'audio/flac': 'flac',
        'application/pdf': 'pdf',
      }[t];
      return guess || 'bin';
    }

    /* 브라우저가 화면에 그려 줄 수 있는 사진인가.
       HEIC · TIFF 는 올라가기는 하지만 대개 화면에 안 보입니다.
       그런 것은 사진으로 넣지 않고 내려받기 링크로 넣습니다 —
       깨진 그림틀을 보여 주는 것보다 낫습니다. */
    function shownAsImage(file, ext) {
      var t = String(file.type || '').toLowerCase();
      if (/^image\/(jpeg|png|gif|webp|avif|svg\+xml|bmp)$/.test(t)) return true;
      if (!t && /^(jpg|jpeg|png|gif|webp|avif|svg|bmp)$/.test(ext)) return true;
      return false;
    }

    function fmtSize(n) {
      if (!n) return '';
      if (n < 1024) return n + 'B';
      if (n < 1024 * 1024) return Math.round(n / 1024) + 'KB';
      return (n / 1024 / 1024).toFixed(1) + 'MB';
    }

    /* ★ 파일을 올려 글 안에 넣습니다.

       고친 것 셋
         ① 종류 제한을 없애고, 사진·영상·음원·그 밖 파일을 갈라 넣습니다
         ② 하나가 실패해도 <b>나머지를 계속</b> 올립니다
            (예전에는 첫 실패에서 통째로 멈췄습니다)
         ③ 실패한 까닭을 그대로 보여 줍니다
            (저장소가 종류·크기를 막고 있으면 그 말이 나옵니다) */
    function uploadImages(files) {
      if (!files || !files.length) return;
      var arr = [].slice.call(files);
      var okN = 0, failN = 0, fails = [];

      (function next(i) {
        if (i >= arr.length) {
          var msg = okN ? (okN + '개 올렸습니다.') : '';
          if (failN) msg += (msg ? ' ' : '') + failN + '개 실패 — ' + fails.slice(0, 2).join(' / ');
          $('bwMsg').textContent = msg;
          return;
        }
        var file = arr[i];
        $('bwMsg').textContent = '올리는 중… (' + (i + 1) + '/' + arr.length + ') ' + file.name;

        var ext = extOf(file);
        var base = me.id + '/' + Date.now() + '_' + i;
        var path = base + '.' + ext;

        sb.storage.from(cfg.bucket).upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        }).then(function (res) {
          if (res.error) {
            failN++;
            /* ★ 저장소가 없다는 오류는 사람이 알아볼 말로 바꿔 줍니다.

               왜 필요한가 (실제로 겪은 일입니다)
                 글쓰기 화면 열여섯 개 가운데 열 개가 <b>없는 저장소</b>를
                 가리키고 있었습니다. 그 게시판에서는 파일 올리기가 처음부터
                 되지 않았는데, 화면에는 「Bucket not found」 라고만 떠서
                 무엇을 고쳐야 하는지 알 수 없었습니다. */
            var m = String(res.error.message || '');
            if (/bucket not found|not found/i.test(m)) {
              m = '저장소 「' + cfg.bucket + '」 가 없습니다. 관리자에게 알려 주십시오.';
            } else if (/mime|content type/i.test(m)) {
              m = '이 종류의 파일은 저장소가 받지 않습니다 (' + (file.type || ext) + ')';
            } else if (/exceeded|too large|size/i.test(m)) {
              m = '파일이 너무 큽니다 (' + fmtSize(file.size) + ')';
            } else if (/policy|permission|unauthorized|row-level/i.test(m)) {
              m = '올릴 권한이 없습니다. 다시 로그인해 보십시오.';
            }
            fails.push(file.name + ': ' + m);
            next(i + 1);                       /* ★ 멈추지 않고 다음 파일로 */
            return;
          }
          var url = sb.storage.from(cfg.bucket).getPublicUrl(path).data.publicUrl;
          var t = String(file.type || '').toLowerCase();
          var html;

          if (shownAsImage(file, ext)) {
            html = '<img src="' + url + '" alt=""><p><br></p>';
          } else if (/^video\//.test(t) || /^(mp4|mov|webm|m4v)$/.test(ext)) {
            html = '<video src="' + url + '" controls playsinline style="max-width:100%"></video><p><br></p>';
          } else if (/^audio\//.test(t) || /^(mp3|wav|m4a|flac|ogg|aac)$/.test(ext)) {
            html = '<audio src="' + url + '" controls style="width:100%"></audio><p><br></p>';
          } else {
            /* 그 밖 — 악보 PDF · 아이폰 HEIC 등은 내려받기 링크로 */
            html = '<p><a href="' + url + '" target="_blank" rel="noopener noreferrer">'
                 + esc(file.name) + (file.size ? ' (' + fmtSize(file.size) + ')' : '')
                 + '</a></p><p><br></p>';
          }

          if (insertNodes(html)) okN++; else { failN++; fails.push(file.name + ': 글에 넣지 못했습니다'); }

          /* 목록에 보일 작은 그림 — 화면에 그려지는 사진일 때만 만듭니다 */
          if (!shownAsImage(file, ext)) { next(i + 1); return; }
          makeThumbBlob(file, 640).then(function (blob) {
            if (!blob) { next(i + 1); return; }
            sb.storage.from(cfg.bucket).upload(base + '_thumb.jpg', blob, {
              upsert: false, contentType: 'image/jpeg',
            }).then(function (tr) {
              if (!tr.error) { thumbMap[url] = sb.storage.from(cfg.bucket).getPublicUrl(base + '_thumb.jpg').data.publicUrl; }
              next(i + 1);
            });
          });
        }).catch(function (e) {
          failN++; fails.push(file.name + ': ' + String(e && e.message || e));
          next(i + 1);
        });
      })(0);
    }

    function initForm() {
      $('bwGate').style.display = 'none';
      $('bwForm').style.display = '';
      initEditor();
      if (cfg.docFields) initDocFields();
      if (editId) {
        var h = $('bwHead'); if (h) h.textContent = (h.textContent || '').replace('작성', '수정') || '수정';
        $('bwSubmit').textContent = '수정완료';
        sb.from(cfg.table).select('*').eq('id', editId).single().then(function (r) {
          if (r.error || !r.data) { $('bwMsg').textContent = '글을 불러오지 못했습니다.'; return; }
          var o = r.data;
          if ($('f-category')) $('f-category').value = o.category || (cfg.categories && cfg.categories[0] ? cfg.categories[0].value : '');
          if ($('f-region')) $('f-region').value = o.region || (cfg.regions && cfg.regions[0] ? cfg.regions[0].value : '');
          $('f-title').value = o.title || '';
          $('f-body').innerHTML = clean(o.body || '');
          $('f-keywords').value = o.keywords || '';
          $('f-agree').checked = true;
          if (cfg.docFields) {
            if ($('f-home')) $('f-home').value = o.link_url || '';
            if (typeof cfg.docFields === 'object' && Array.isArray(cfg.docFields.extra)) {
              cfg.docFields.extra.forEach(function (x) {
                var el = x && x.col ? $('f-x-' + x.col) : null;
                if (el) el.value = o[x.col] || '';
              });
            }
            var _DL = (typeof cfg.docFields === 'object' && cfg.docFields) ? cfg.docFields : {};
            (_DL.extraLinks || []).forEach(function (x) {
              var el = $('f-x-' + x.col);
              if (el) el.value = o[x.col] || '';
            });
            if (o.logo_url && $('f-logoname')) { logoUrl = o.logo_url; $('f-logoname').textContent = '기존 로고 유지'; }
            if (o.file_url && $('f-docname')) { fileUrl = o.file_url; fileName = o.file_name; $('f-docname').textContent = o.file_name || '기존 파일 유지'; }
          }
        });
      }
      $('bwSubmit').addEventListener('click', submit);
    }

    function uploadSingle(file, prefix, cb) {
      var safe = (file.name || 'file').replace(/[^\w.\-\uAC00-\uD7A3]/g, '_');
      var p = me.id + '/' + prefix + '_' + Date.now() + '_' + safe;
      $('bwMsg').textContent = '업로드 중…';
      sb.storage.from(cfg.bucket).upload(p, file, { upsert: false }).then(function (r) {
        if (r.error) { $('bwMsg').textContent = '업로드 실패: ' + r.error.message; return; }
        $('bwMsg').textContent = '';
        cb(sb.storage.from(cfg.bucket).getPublicUrl(p).data.publicUrl);
      });
    }
    function initDocFields() {
      /* 칸을 끈 경우도 있으므로 요소가 있을 때만 연결한다 */
      if ($('f-logobtn')) {
        $('f-logobtn').addEventListener('click', function () { $('f-logofile').click(); });
        $('f-logofile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; uploadSingle(f, 'logo', function (url) { logoUrl = url; $('f-logoname').textContent = f.name; }); });
      }
      if ($('f-docbtn')) {
        $('f-docbtn').addEventListener('click', function () { $('f-docfile').click(); });
        $('f-docfile').addEventListener('change', function () { var f = this.files[0]; if (!f) return; uploadSingle(f, 'file', function (url) { fileUrl = url; fileName = f.name; $('f-docname').textContent = f.name; }); });
      }
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
      if ($('f-region')) row.region = $('f-region').value;
      /* 페이지가 정한 고정 값 (예: 지식나눔의 갈래 track)
         쓰지 않는 게시판에는 영향이 없습니다 */
      if (cfg.fixed) Object.keys(cfg.fixed).forEach(function (k) { row[k] = cfg.fixed[k]; });
      if (cfg.docFields) {
        if ($('f-home')) row.link_url = ($('f-home').value || '').trim() || null;
        var _D = (typeof cfg.docFields === 'object' && cfg.docFields) ? cfg.docFields : {};
        (_D.extraLinks || []).forEach(function (x) {
          var el = $('f-x-' + x.col);
          if (el) row[x.col] = (el.value || '').trim() || null;
        });
        if (typeof cfg.docFields === 'object' && Array.isArray(cfg.docFields.extra)) {
          cfg.docFields.extra.forEach(function (x) {
            var el = x && x.col ? $('f-x-' + x.col) : null;
            if (el) row[x.col] = (el.value || '').trim() || null;
          });
        }
        if (logoUrl) row.logo_url = logoUrl;
        if (fileUrl) { row.file_url = fileUrl; row.file_name = fileName; }
      }
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
