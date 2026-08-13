/* ============================================================
   OPUSCLAM 공용 고르개(풀다운) — assets/select.js
   2026-08-13

   ★ 왜 만드나 (파트너 지적 · 모바일 실기)
     조건 고르개가 브라우저 기본 <select> 였습니다. 안드로이드에서는
     화면을 가득 채우는 <b>회색 라디오 목록</b>이 뜨고, 아이폰에서는
     아래에서 굴림판이 올라옵니다. 기기마다 달라 사이트의 결과 맞지
     않았습니다. 푸터의 FAMILY SITE 고르개는 직접 만들어 결이 맞는데,
     나머지가 기본 <select> 라 <b>같은 화면에 두 가지 모양</b>이 있었습니다.

   ★ 어떻게 하나 — <b>기본 select 를 지우지 않습니다</b>
     그 위에 단추와 목록을 얹고, 고르면 <b>원래 select 의 값을 바꾸고
     change 를 알립니다.</b> 그래서 기존 코드(db-list.js·board.js·
     include.js·i18n.js)를 <b>한 줄도 고치지 않아도</b> 그대로 돕니다.
     · 값을 읽는 곳    select.value        → 그대로
     · 바뀜을 듣는 곳  addEventListener    → 그대로
     · 옵션을 채우는 곳 innerHTML = …      → 지켜보고 다시 그립니다

   ★ 어디에 붙나 (TARGETS)
     목록·걸러내기 고르개만 바꿉니다. 글쓰기·회원가입 폼의 고르개는
     아직 손대지 않습니다 — 폼은 한 번에 여러 칸을 오가므로 따로
     살펴야 합니다.

   ★ 크기는 <b>원래 select 가 정합니다</b>
     화면마다 고르개 높이·폭이 다릅니다(49px·44px·260px·100%…).
     그래서 새로 정하지 않고, 원래 select 를 투명하게 남겨 두어
     그것이 자리를 잡게 하고 단추를 그 위에 덮습니다.
     창 크기가 바뀌면 다시 잽니다.

   ★ 짜임은 푸터 FAMILY SITE · 머리글 언어 고르개와 같은 결입니다.
   ============================================================ */
(function (w, d) {
  'use strict';

  /* 바꿀 고르개들 — 목록·걸러내기 쪽만 */
  var TARGETS = [
    '.pdb-subnav-sel select',   /* 모바일 갈래 고르개 (인물DB · 음악단체DB …) */
    '.pdb-selects select',      /* DB 목록 조건 (국내/외 · 분야 · 시대 …) */
    'select.board-catsel',      /* 게시판 분류 */
    'select.board-sort',        /* 게시판 정렬 */
    'select.board-regionsel',
    'select.board-erasel',
    'select.board-yearsel',
    'select.sp-daysel',
    'select.sm-ymsel',
    'select.ln-select'          /* 레슨:ON 분류 */
  ].join(',');

  var CSS = ''
    + '.ocs{position:relative;vertical-align:top}'
    + '.ocs > select{opacity:0 !important;width:100% !important;margin:0 !important}'
    /* 단추 — 원래 고르개를 그대로 덮습니다 */
    + '.ocs-btn{position:absolute;inset:0;display:flex;align-items:center;gap:8px;'
    +   'width:100%;padding:0 14px;box-sizing:border-box;cursor:pointer;'
    +   'font:inherit;font-size:13px;text-align:left;letter-spacing:-.01em;'
    +   'background:var(--paper,#fff);color:var(--text,#20223a);'
    +   'border:1px solid var(--line,#e4e4ec);border-radius:11px;'
    +   'transition:border-color .15s ease,color .15s ease,box-shadow .15s ease}'
    + '.ocs-lb{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    /* 아래쪽 화살표 — 누를 수 있는 것으로 보이게 */
    + '.ocs-btn::after{content:"";flex:0 0 auto;width:0;height:0;'
    +   'border-left:4px solid transparent;border-right:4px solid transparent;'
    +   'border-top:5px solid currentColor;opacity:.55;transition:transform .2s ease}'
    + '.ocs-btn:hover{border-color:var(--violet-2,#7c63b0);color:var(--violet-2,#7c63b0)}'
    + '.ocs.open .ocs-btn{border-color:var(--violet-2,#7c63b0);color:var(--violet-2,#7c63b0);'
    +   'box-shadow:0 0 0 3px rgba(124,99,176,.1)}'
    + '.ocs.open .ocs-btn::after{transform:rotate(180deg)}'
    /* 목록 */
    + '.ocs-list{position:absolute;left:0;top:calc(100% + 5px);z-index:70;'
    +   'margin:0;padding:5px 0;list-style:none;min-width:100%;max-width:min(88vw,420px);'
    +   'max-height:min(58vh,420px);overflow:auto;-webkit-overflow-scrolling:touch;'
    +   'background:var(--paper,#fff);border:1px solid var(--line,#e4e4ec);border-radius:11px;'
    +   'box-shadow:0 14px 34px -10px rgba(20,18,40,.26);display:none}'
    + '.ocs.open .ocs-list{display:block}'
    /* 위로 열기 — 아래에 자리가 없을 때 */
    + '.ocs.up .ocs-list{top:auto;bottom:calc(100% + 5px)}'
    + '.ocs-list li{margin:0;padding:0;list-style:none}'
    + '.ocs-opt{display:block;width:100%;box-sizing:border-box;padding:11px 15px;'
    +   'background:none;border:0;font:inherit;font-size:13px;text-align:left;'
    +   'color:var(--text-2,#3a3c52);cursor:pointer;white-space:nowrap}'
    + '.ocs-opt:hover{background:var(--paper-2,#f4f4f8);color:var(--violet-2,#7c63b0)}'
    + '.ocs-opt.on{color:var(--violet-2,#7c63b0);font-weight:700}'
    + '.ocs-opt[disabled]{opacity:.4;cursor:default}'
    /* 묶음 이름표(optgroup) */
    + '.ocs-grp{padding:9px 15px 5px;font-size:11px;font-weight:800;letter-spacing:.02em;'
    +   'color:var(--text-3,#8a8c9e)}'
    + '.ocs-list li + li .ocs-grp{border-top:1px solid var(--line-2,#eeeef4);margin-top:4px}'
    /* 어두운 화면 */
    + 'html[data-theme="dark"] .ocs-btn{background:#17171a;border-color:#2f2f2f;color:#e8e8e8}'
    + 'html[data-theme="dark"] .ocs-list{background:#161616;border-color:#2f2f2f}'
    + 'html[data-theme="dark"] .ocs-opt{color:#d8d8d8}'
    + 'html[data-theme="dark"] .ocs-opt:hover{background:#242424;color:#fff}';

  function injectCSS() {
    if (d.getElementById('ocs-css')) return;
    var st = d.createElement('style');
    st.id = 'ocs-css';
    st.textContent = CSS;
    d.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── 목록 그리기 ─────────────────────────────────────────── */
  function paint(box) {
    var sel = box._sel, list = box._list, btn = box._btn;
    var html = '';
    var kids = sel.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.tagName === 'OPTGROUP') {
        html += '<li><div class="ocs-grp">' + esc(k.getAttribute('label') || '') + '</div></li>';
        for (var j = 0; j < k.children.length; j++) html += opt(k.children[j], sel);
      } else if (k.tagName === 'OPTION') {
        html += opt(k, sel);
      }
    }
    list.innerHTML = html;
    var cur = sel.options[sel.selectedIndex];
    box._lb.textContent = cur ? (cur.textContent || '').trim() : '';
    btn.setAttribute('aria-label', sel.getAttribute('aria-label') || '고르기');
  }

  function opt(o, sel) {
    var v = o.hasAttribute('value') ? o.getAttribute('value') : o.textContent;
    return '<li><button type="button" class="ocs-opt' + (o.selected ? ' on' : '') + '"'
      + (o.disabled ? ' disabled' : '')
      + ' data-v="' + esc(v) + '">' + esc((o.textContent || '').trim()) + '</button></li>';
  }

  /* ── 자리·크기 맞추기 ────────────────────────────────────────
     원래 고르개가 칸을 가득 채우고 있었으면 우리도 가득 채우고,
     그렇지 않으면 그만한 폭만 씁니다. 창 크기가 바뀌면 다시 잽니다. */
  function fit(box) {
    var sel = box._sel;
    var prev = box.style.width;
    box.style.width = '';
    box.style.display = 'inline-block';
    var pw = box.parentNode ? box.parentNode.getBoundingClientRect().width : 0;
    var sw = sel.getBoundingClientRect().width;
    if (!sw) { box.style.width = prev; return; }
    if (pw && sw >= pw - 3) {
      box.style.display = 'block';
      box.style.width = '100%';
    } else {
      box.style.display = 'inline-block';
      box.style.width = Math.round(sw) + 'px';
    }
  }

  function open(box, on) {
    if (on) {
      /* 열려 있던 다른 것은 닫습니다 */
      [].forEach.call(d.querySelectorAll('.ocs.open'), function (o) {
        if (o !== box) o.classList.remove('open');
      });
      /* 아래에 자리가 없으면 위로 엽니다 */
      var r = box.getBoundingClientRect();
      box.classList.toggle('up', (w.innerHeight - r.bottom) < 240 && r.top > 260);
    }
    box.classList.toggle('open', !!on);
    box._btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  /* ── 하나 올려 세우기 ────────────────────────────────────── */
  function upgrade(sel) {
    if (!sel || sel.multiple || sel.dataset.ocsDone) return;
    if (sel.hasAttribute('data-oc-plain')) return;
    sel.dataset.ocsDone = '1';

    var box = d.createElement('div');
    box.className = 'ocs';
    sel.parentNode.insertBefore(box, sel);
    box.appendChild(sel);

    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'ocs-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var lb = d.createElement('span');
    lb.className = 'ocs-lb';
    btn.appendChild(lb);

    var list = d.createElement('ul');
    list.className = 'ocs-list';
    list.setAttribute('role', 'listbox');

    box.appendChild(btn);
    box.appendChild(list);
    box._sel = sel; box._btn = btn; box._lb = lb; box._list = list;

    paint(box);
    fit(box);

    /* ★ 크기가 바뀌면 다시 잽니다.
         접혀 있던 조건 칸이 펼쳐질 때가 특히 그렇습니다 — 접혀 있는 동안은
         폭이 0 이라 잴 수 없고, 펼쳐진 뒤에 다시 재야 단추가 제자리에
         덮입니다. (모바일 조건 접기와 함께 쓰므로 반드시 필요합니다) */
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () { fit(box); }).observe(sel);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      open(box, !box.classList.contains('open'));
    });

    list.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ocs-opt') : null;
      if (!b || b.disabled) return;
      e.stopPropagation();
      var v = b.getAttribute('data-v');
      /* ★ 값이 아니라 <b>글자</b>로 담긴 옵션도 있습니다(value 없이 씀).
           그래서 값으로 못 찾으면 글자로 찾습니다. */
      var hit = -1, o;
      for (var i = 0; i < sel.options.length; i++) {
        o = sel.options[i];
        var ov = o.hasAttribute('value') ? o.getAttribute('value') : o.textContent;
        if (ov === v) { hit = i; break; }
      }
      if (hit < 0) return;
      sel.selectedIndex = hit;
      paint(box);
      open(box, false);
      /* 기존 코드가 듣고 있는 것을 그대로 알립니다 */
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });

    /* 바깥을 누르면 닫습니다 */
    /* ESC 로도 닫힙니다 — 키보드만 쓰는 분을 위해서입니다 */

    /* 옵션이 나중에 채워지는 고르개가 많습니다(board.js·레슨 분야 등).
       그때 다시 그립니다. 값이 코드로 바뀌는 경우도 함께 잡습니다. */
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () { paint(box); fit(box); })
        .observe(sel, { childList: true, subtree: true, attributes: true,
                        attributeFilter: ['value'] });
    }
    /* 코드가 select.value = … 로 바꾼 뒤 change 를 쏘는 곳도 있습니다 */
    sel.addEventListener('change', function () { paint(box); });

    return box;
  }

  function scan(root) {
    injectCSS();
    var list = (root || d).querySelectorAll(TARGETS);
    [].forEach.call(list, upgrade);
  }

  /* ── 문서 전체 지켜보기 ──────────────────────────────────────
     고르개가 나중에 만들어지는 화면이 많습니다 —
       · include.js 가 좁은 화면에서 갈래 고르개를 만듭니다
       · board.js 가 분류 고르개를 채웁니다
     그래서 한 번 훑고 끝내지 않고 계속 지켜봅니다. */
  var _t = null;
  function watch() {
    if (w.__ocsWatch || typeof MutationObserver !== 'function') return;
    w.__ocsWatch = true;
    new MutationObserver(function () {
      if (_t) return;
      _t = setTimeout(function () { _t = null; scan(d); }, 120);
    }).observe(d.documentElement, { childList: true, subtree: true });

    d.addEventListener('click', function (e) {
      [].forEach.call(d.querySelectorAll('.ocs.open'), function (box) {
        if (!box.contains(e.target)) box.classList.remove('open');
      });
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        [].forEach.call(d.querySelectorAll('.ocs.open'), function (box) {
          box.classList.remove('open');
        });
      }
    });
    var _rz = null;
    w.addEventListener('resize', function () {
      if (_rz) return;
      _rz = setTimeout(function () {
        _rz = null;
        [].forEach.call(d.querySelectorAll('.ocs'), function (box) {
          if (box._sel) fit(box);
        });
      }, 180);
    });
  }

  function boot() { scan(d); watch(); }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
  w.addEventListener('load', function () { scan(d); });

  w.OCSelect = { scan: scan, upgrade: upgrade };
})(window, document);
