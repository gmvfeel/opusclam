/* ============================================================
   OPUSCLAM 정보 오류 신고   assets/report.js
   2026-08-08

   무엇을 하나
    · 상세 화면 아래 「메일문의하기」 옆에 <b>「정보 오류 신고」</b>
      단추를 스스로 붙입니다
    · 누르면 작은 창이 열리고, 무엇이 문제인지 고르고 한 줄 적어
      보냅니다

   왜 만들었나
    ★ 2026-08-08 바그너 작품에 <b>「발퀴레의 기승」</b> 이 있는 것을
      파트너가 화면에서 보셨습니다. 표준 번역은 「발퀴레의 기행」 이고,
      우리가 지어낸 것이 아니라 <b>위키데이터의 한국어 라벨</b>이
      그렇게 적혀 있었습니다.

      작품 16,642 · 인물 9,332 · 학술 15,268 …
      <b>사람이 다 볼 수는 없습니다.</b> 보는 사람이 알려줄 길이
      있어야 「국내 최고 수준의 품질」 이 됩니다.

   ── 왜 「DB보강」 폼이 아닌가 ─────────────────────────────
    db/write.html 의 보강 폼은 <b>제출 단추에 아무 동작이 없는
    껍데기</b>입니다(2026-08-08 확인). 그리고 무겁습니다 — 자격 회원 ·
    여러 칸 · 출처 메모.
    ★ 「제목이 틀렸어요」 를 알리려고 그 폼을 채울 사람은 없습니다.
      <b>한 줄로 끝나야</b> 실제로 쓰입니다.

   ── 붙이는 법 (화면마다 한 줄) ────────────────────────────
    상세 화면 아래쪽에 이 한 줄을 넣습니다.

      <script src="/assets/report.js?v=20260808"
              data-table="person_works" data-label="작품" defer></script>

      data-table  어느 표인지 (짐작하지 않도록 화면이 알려 줍니다)
      data-label  창에 보일 이름 (작품 · 인물 · 학교 …)

    ★ HTML 을 여덟 번 고치지 않습니다. 이 파일이 스스로 붙습니다.
      고칠 일이 생기면 <b>이 파일 한 곳</b>만 고칩니다.

   ── 통신 방식 ────────────────────────────────────────────
    ★ 상세 화면들은 supabase-js 를 쓰지 않고 <b>fetch 로 REST 를
      직접</b> 부릅니다(work-view.html 등). 그래서 이 파일도 같은
      방식을 씁니다 — 무거운 라이브러리를 새로 얹지 않습니다.
    ★ 로그인해 둔 사람이면 저장된 토큰을 찾아 함께 보냅니다.
      그러면 누가 알려 준 것인지 남습니다. 없으면 손님으로 넣습니다.

   ── 지어내지 않는 것 ─────────────────────────────────────
    ★ 표 이름을 <b>파일 이름에서 짐작하지 않습니다.</b>
      work-view.html 의 표는 work 가 아니라 person_works 입니다.
      화면이 data-table 로 알려 주게 했습니다.
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var REF = 'ptdxzxkgddvkusamkiol';

  /* 이 파일을 불러온 <script> 태그에서 설정을 읽습니다 */
  var me = document.currentScript;
  var TABLE = me && me.getAttribute('data-table');
  var LABEL = (me && me.getAttribute('data-label')) || '항목';

  if (!TABLE) {
    /* ★ 조용히 죽지 않고 알려 줍니다. 붙이는 것을 잊었을 때
       화면에 단추가 없는 까닭을 알 수 있어야 합니다. */
    console.warn('[report.js] data-table 이 없습니다. 단추를 붙이지 않습니다.');
    return;
  }

  /* ── 이 화면이 무엇을 보여주고 있나 ───────────────────── */
  function pageId() {
    var v = new URLSearchParams(location.search).get('id');
    return (v && /^[0-9]+$/.test(v)) ? Number(v) : null;
  }
  function pageTitle() {
    /* ★ 신고 당시의 제목을 함께 담아 둡니다. 그 줄이 나중에
       고쳐지거나 감춰지면 무엇을 신고한 것인지 알 수 없습니다.
       제목은 여덟 상세 화면이 모두 .pv-name 을 씁니다(확인함). */
    var h = document.querySelector('.pv-name');
    if (!h) return document.title || '';
    /* 원제(.pv-name-sub)까지 함께 담습니다 */
    return String(h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  }

  /* ── 로그인 토큰 찾기 ─────────────────────────────────────
     supabase-js 가 localStorage 에 넣어 둔 것을 읽습니다.
     ★ 없어도 됩니다 — 손님으로 넣습니다. 회원이 거의 없는 지금
       로그인을 요구하면 아무 신고도 들어오지 않습니다. */
  function token() {
    try {
      var raw = localStorage.getItem('sb-' + REF + '-auth-token');
      if (!raw) return null;
      var j = JSON.parse(raw);
      return (j && j.access_token) ? j.access_token : null;
    } catch (e) { return null; }
  }

  /* ── 화면 만들기 ───────────────────────────────────────── */
  var KINDS = [
    ['wrong',   '틀린 내용이 있습니다'],
    ['missing', '빠진 내용이 있습니다'],
    ['dup',     '같은 항목이 두 번 있습니다'],
    ['other',   '그 밖']
  ];

  function css() {
    if (document.getElementById('ocRepCss')) return;
    var s = document.createElement('style');
    s.id = 'ocRepCss';
    s.textContent = [
      /* 단추 — 옆에 있는 .pv-mailbtn 과 나란히 보이게 합니다 */
      '.oc-repbtn{display:inline-flex;align-items:center;gap:7px;margin-left:8px;',
      '  font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;',
      '  padding:9px 15px;border-radius:8px;border:1px solid var(--line,#e6e3ef);',
      '  background:#fff;color:var(--text-2,#5c5e70);transition:border-color .15s,color .15s}',
      '.oc-repbtn:hover{border-color:#5b4b9e;color:#5b4b9e}',
      '.oc-repbtn svg{width:15px;height:15px;flex:0 0 auto}',
      /* 덮개 */
      '.oc-repwrap{position:fixed;inset:0;z-index:9999;display:none;align-items:center;',
      '  justify-content:center;padding:20px;background:rgba(20,18,32,.5)}',
      '.oc-repwrap.on{display:flex}',
      '.oc-repbox{width:100%;max-width:460px;background:#fff;border-radius:14px;',
      '  padding:24px;box-shadow:0 24px 60px -12px rgba(20,18,32,.4);',
      '  font-family:inherit;max-height:90vh;overflow:auto}',
      '.oc-reph{font-size:17px;font-weight:800;margin:0 0 6px;color:var(--text,#20223a)}',
      '.oc-repsub{font-size:12.5px;color:var(--text-3,#8a8798);margin:0 0 18px;line-height:1.6}',
      '.oc-repsub b{color:var(--text-2,#5c5e70)}',
      '.oc-repl{display:block;font-size:12px;font-weight:700;color:var(--text-2,#5c5e70);margin:0 0 7px}',
      '.oc-repsel{width:100%;padding:10px 12px;border:1px solid var(--line,#e6e3ef);',
      '  border-radius:8px;font-size:13.5px;font-family:inherit;background:#fff;margin-bottom:16px}',
      '.oc-repta{width:100%;padding:11px 13px;border:1px solid var(--line,#e6e3ef);',
      '  border-radius:8px;font-size:13.5px;font-family:inherit;line-height:1.65;',
      '  resize:vertical;min-height:96px;box-sizing:border-box}',
      '.oc-repta:focus{outline:none;border-color:#5b4b9e;box-shadow:0 0 0 3px rgba(91,75,158,.1)}',
      '.oc-repcnt{font-size:11.5px;color:var(--text-3,#8a8798);text-align:right;margin:6px 0 0}',
      '.oc-repact{display:flex;gap:9px;justify-content:flex-end;margin-top:18px}',
      '.oc-repb{padding:11px 20px;border-radius:8px;font-size:13.5px;font-weight:700;',
      '  cursor:pointer;border:0;font-family:inherit}',
      '.oc-repb-c{background:#fff;color:var(--text-2,#5c5e70);border:1px solid #cfd0dd}',
      '.oc-repb-s{background:#5b4b9e;color:#fff}',
      '.oc-repb:disabled{opacity:.45;cursor:not-allowed}',
      '.oc-repmsg{font-size:13px;line-height:1.7;padding:12px 14px;border-radius:8px;margin-top:14px;display:none}',
      '.oc-repmsg.ok{display:block;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}',
      '.oc-repmsg.no{display:block;background:#fff6f6;border:1px solid #f3caca;color:#a01c1c}'
    ].join('');
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openBox() {
    var w = document.getElementById('ocRepWrap');
    if (w) { w.classList.add('on'); var t = w.querySelector('.oc-repta'); if (t) t.focus(); return; }

    w = document.createElement('div');
    w.id = 'ocRepWrap';
    w.className = 'oc-repwrap on';
    w.innerHTML = ''
      + '<div class="oc-repbox" role="dialog" aria-modal="true" aria-label="정보 오류 신고">'
      +   '<h3 class="oc-reph">정보 오류 신고</h3>'
      +   '<p class="oc-repsub">이 ' + esc(LABEL) + ' 자료에서 잘못된 곳을 알려 주십시오.<br>'
      +     '<b>' + esc(pageTitle().slice(0, 80)) + '</b></p>'
      +   '<label class="oc-repl" for="ocRepKind">무엇이 문제입니까</label>'
      +   '<select class="oc-repsel" id="ocRepKind">'
      +     KINDS.map(function (k) {
              return '<option value="' + k[0] + '">' + esc(k[1]) + '</option>';
            }).join('')
      +   '</select>'
      +   '<label class="oc-repl" for="ocRepBody">어떻게 고쳐야 하는지 적어 주십시오</label>'
      +   '<textarea class="oc-repta" id="ocRepBody" maxlength="1000"'
      +     ' placeholder="보기 — 제목이 「발퀴레의 기승」 으로 되어 있는데 「발퀴레의 기행」 이 맞습니다"></textarea>'
      +   '<p class="oc-repcnt"><span id="ocRepN">0</span> / 1000자</p>'
      +   '<div class="oc-repmsg" id="ocRepMsg"></div>'
      +   '<div class="oc-repact">'
      +     '<button type="button" class="oc-repb oc-repb-c" id="ocRepX">닫기</button>'
      +     '<button type="button" class="oc-repb oc-repb-s" id="ocRepGo">보내기</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(w);

    var ta   = w.querySelector('#ocRepBody');
    var n    = w.querySelector('#ocRepN');
    var msg  = w.querySelector('#ocRepMsg');
    var go   = w.querySelector('#ocRepGo');

    ta.addEventListener('input', function () { n.textContent = ta.value.length; });
    w.querySelector('#ocRepX').addEventListener('click', close);
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    document.addEventListener('keydown', onEsc);
    go.addEventListener('click', send);
    ta.focus();

    function onEsc(e) { if (e.key === 'Escape') close(); }
    function close() {
      w.classList.remove('on');
      document.removeEventListener('keydown', onEsc);
    }

    function show(kind, text) {
      msg.className = 'oc-repmsg ' + kind;
      msg.textContent = text;
    }

    async function send() {
      var body = String(ta.value || '').trim();
      if (body.length < 5) {
        show('no', '다섯 글자 이상 적어 주십시오.');
        ta.focus();
        return;
      }
      go.disabled = true;
      show('', '');
      msg.className = 'oc-repmsg';

      try {
        var tk = token();
        var res = await fetch(SB + '/rest/v1/rpc/oc_report_add', {
          method: 'POST',
          headers: {
            apikey: KEY,
            Authorization: 'Bearer ' + (tk || KEY),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_table: TABLE,
            p_id   : pageId(),
            p_title: pageTitle(),
            p_url  : location.href.slice(0, 500),
            p_kind : w.querySelector('#ocRepKind').value,
            p_body : body
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()));

        var out = await res.text();
        var id  = Number(out);

        if (id === 0) {
          /* ★ 도배 막기에 걸린 경우입니다. 잘못한 것이 아니므로
             붉은 글씨로 알리지 않습니다. */
          show('ok', '이미 알려 주셨습니다. 고맙습니다.');
        } else {
          show('ok', '알려 주셔서 고맙습니다. 확인한 뒤 반영하겠습니다.');
        }
        ta.value = '';
        n.textContent = '0';
        go.textContent = '보냈습니다';
        setTimeout(close, 1800);
      } catch (e) {
        var m = String(e.message || e);
        if (/function .*does not exist|could not find/i.test(m)) {
          show('no', '아직 준비되지 않았습니다. 잠시 뒤 다시 시도해 주십시오.');
        } else if (/oc_reports_body_chk/.test(m)) {
          show('no', '내용이 너무 짧거나 깁니다.');
        } else {
          show('no', '보내지 못했습니다. 잠시 뒤 다시 시도해 주십시오.');
        }
        console.warn('[report.js]', m);
        go.disabled = false;
      }
    }
  }

  /* ── 단추 붙이기 ───────────────────────────────────────── */
  function attach() {
    /* ★ 「메일문의하기」 옆에 붙입니다. 여덟 상세 화면이 모두
       .pv-source 안에 .pv-mailbtn 을 두고 있습니다(확인함).
       ★ .pv-source 를 못 찾으면 붙이지 않습니다 — 엉뚱한 자리에
         단추가 나타나는 것보다 없는 편이 낫습니다. */
    var box = document.querySelector('.pv-source');
    if (!box) {
      console.warn('[report.js] .pv-source 를 찾지 못했습니다.');
      return;
    }
    if (box.querySelector('.oc-repbtn')) return;   /* 두 번 붙이지 않습니다 */

    css();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'oc-repbtn';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'
      + '<path d="M12 9v4"/><path d="M12 17h.01"/>'
      + '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'
      + '</svg> 정보 오류 신고';
    b.addEventListener('click', openBox);

    var mail = box.querySelector('.pv-mailbtn');
    if (mail && mail.parentNode) mail.parentNode.insertBefore(b, mail.nextSibling);
    else box.appendChild(b);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
