/* ============================================================
   OPUSCLAM 「우리 대회를 등록해 주세요」 — assets/spot-suggest.js
   ------------------------------------------------------------
   왜 만들었나
     국내 콩쿠르(동아·중앙·협회·대학·지자체)는 위키데이터에 항목이
     없습니다. 자동수집으로는 채워지지 않고, 크롤링은 금지입니다.
     남은 길은 <b>알고 있는 사람에게 받는 것</b>뿐입니다.
     주최측·지도교수·입상자 본인이 알려주는 것이 가장 정확합니다.

   ★ 로그인을 요구하지 않습니다
     회원이 적은 지금 로그인을 요구하면 아무것도 들어오지 않습니다.
     신고 통로(report.js)와 같은 판단입니다.

   ★ 새 표를 쓰지 않습니다
     어제 만든 oc_paid_apps 에 plan_code='free' 로 들어갑니다.
     어드민 화면도 이미 있는 것(admin/paid.html)을 그대로 씁니다.

   쓰는 법 — 목록 화면 맨 아래에 한 줄만 넣으십시오.
     <script src="/assets/spot-suggest.js?v=20260808"
             data-section="콩쿨" defer></script>

     data-section 은 콩쿨 또는 페스티벌 입니다.
   ============================================================ */
(function () {
  'use strict';

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var REF = 'ptdxzxkgddvkusamkiol';

  var me = document.currentScript;
  var SECTION = (me && me.getAttribute('data-section')) || '콩쿨';
  var WHAT    = SECTION === '페스티벌' ? '축제' : '대회';

  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 로그인했으면 그 자격으로 보냅니다. 없어도 됩니다. */
  function token() {
    try {
      var raw = localStorage.getItem('sb-' + REF + '-auth-token');
      if (!raw) return null;
      var j = JSON.parse(raw);
      return (j && j.access_token) ? j.access_token : null;
    } catch (e) { return null; }
  }

  function css() {
    if (document.getElementById('ocSugCss')) return;
    var s = document.createElement('style');
    s.id = 'ocSugCss';
    s.textContent = [
      '.oc-sug-bar{display:flex;align-items:center;justify-content:center;gap:12px;',
      '  flex-wrap:wrap;margin:26px auto 8px;padding:18px 22px;max-width:760px;',
      '  border:1px dashed var(--line-2);border-radius:14px;background:var(--paper);',
      '  color:var(--text-2);font-size:.94rem;line-height:1.6;text-align:center}',
      '.oc-sug-btn{font-family:inherit;font-size:.94rem;font-weight:700;cursor:pointer;',
      '  padding:9px 18px;border-radius:9px;border:0;color:#fff;',
      '  background:linear-gradient(135deg,#9C7FD6,#C9A94E)}',
      '.oc-sug-btn:hover{filter:brightness(1.06)}',

      '.oc-sug-dim{position:fixed;inset:0;background:rgba(12,13,28,.55);z-index:9998;',
      '  display:flex;align-items:center;justify-content:center;padding:18px}',
      '.oc-sug-box{width:100%;max-width:520px;max-height:88vh;overflow:auto;',
      '  background:var(--bg,#fff);color:var(--text,#20223a);border-radius:16px;',
      '  padding:26px 26px 22px;box-shadow:0 24px 60px rgba(0,0,0,.3)}',
      '.oc-sug-box h3{margin:0 0 6px;font-size:1.15rem}',
      '.oc-sug-box .lead{margin:0 0 18px;color:var(--text-2);font-size:.9rem;line-height:1.6}',
      '.oc-sug-f{display:flex;flex-direction:column;margin-bottom:14px}',
      '.oc-sug-f label{font-size:.88rem;font-weight:700;margin-bottom:6px}',
      '.oc-sug-f label i{color:#c0392b;font-style:normal;margin-left:3px}',
      '.oc-sug-f input,.oc-sug-f textarea{width:100%;box-sizing:border-box;padding:10px 12px;',
      '  border:1px solid var(--line-2,#d8d8e2);border-radius:9px;background:var(--paper,#fff);',
      '  color:inherit;font-family:inherit;font-size:.95rem}',
      '.oc-sug-f textarea{min-height:96px;resize:vertical;line-height:1.6}',
      '.oc-sug-f .hint{margin-top:5px;font-size:.82rem;color:var(--text-2)}',
      '.oc-sug-act{display:flex;gap:9px;align-items:center;margin-top:6px;flex-wrap:wrap}',
      '.oc-sug-act .go{flex:1;min-width:130px;padding:11px;border:0;border-radius:9px;',
      '  background:linear-gradient(135deg,#9C7FD6,#C9A94E);color:#fff;',
      '  font-family:inherit;font-weight:700;font-size:.96rem;cursor:pointer}',
      '.oc-sug-act .no{padding:11px 18px;border:1px solid var(--line-2,#d8d8e2);',
      '  border-radius:9px;background:transparent;color:inherit;',
      '  font-family:inherit;font-size:.92rem;cursor:pointer}',
      '.oc-sug-msg{margin-top:10px;font-size:.88rem;line-height:1.55}',
      '.oc-sug-msg.err{color:#c0392b}',
      '.oc-sug-done{text-align:center;padding:18px 4px;line-height:1.75}',
      '.oc-sug-done b{display:block;font-size:1.1rem;margin-bottom:8px}',
      '.oc-sug-done p{margin:4px 0;color:var(--text-2);font-size:.92rem}'
    ].join('');
    document.head.appendChild(s);
  }

  function close(dim) { if (dim && dim.parentNode) dim.parentNode.removeChild(dim); }

  function open() {
    css();
    var dim = document.createElement('div');
    dim.className = 'oc-sug-dim';
    dim.innerHTML =
      '<div class="oc-sug-box" role="dialog" aria-modal="true">'
      + '<h3>알고 계신 ' + WHAT + '를 알려 주십시오</h3>'
      + '<p class="lead">'
      +   '국내 ' + WHAT + '는 공개된 자료가 거의 없어 저희가 찾아내기 어렵습니다.<br>'
      +   '주최하시는 분, 지도하시는 분, 나가보신 분이 알려주시는 것이 가장 정확합니다.<br>'
      +   '<b>회원가입은 하지 않으셔도 됩니다.</b>'
      + '</p>'
      + '<div class="oc-sug-f"><label for="ocSugT">' + WHAT + ' 이름<i>*</i></label>'
      +   '<input type="text" id="ocSugT" maxlength="200" placeholder="예) 제57회 동아음악콩쿠르"></div>'
      + '<div class="oc-sug-f"><label for="ocSugU">공식 홈페이지</label>'
      +   '<input type="text" id="ocSugU" maxlength="300" placeholder="https://">'
      +   '<span class="hint">주소만 알려 주셔도 저희가 나머지를 찾아 채웁니다.</span></div>'
      + '<div class="oc-sug-f"><label for="ocSugO">주최 · 주관</label>'
      +   '<input type="text" id="ocSugO" maxlength="100" placeholder="예) 동아일보사"></div>'
      + '<div class="oc-sug-f"><label for="ocSugM">아시는 만큼</label>'
      +   '<textarea id="ocSugM" maxlength="2000" placeholder="부문, 열리는 시기, 참가 자격, 그 밖에 아시는 것을 편하게 적어 주십시오."></textarea>'
      +   '<span class="hint">확실하지 않은 것은 「아마도」라고 적어 주십시오. 저희가 확인하겠습니다.</span></div>'
      + '<div class="oc-sug-f"><label for="ocSugN">알려주시는 분<i>*</i></label>'
      +   '<input type="text" id="ocSugN" maxlength="60" placeholder="이름 또는 별명"></div>'
      + '<div class="oc-sug-f"><label for="ocSugE">메일<i>*</i></label>'
      +   '<input type="email" id="ocSugE" maxlength="200" placeholder="answer@example.com">'
      +   '<span class="hint">확인할 것이 있을 때만 씁니다. 화면에 나오지 않습니다.</span></div>'
      + '<div class="oc-sug-act">'
      +   '<button type="button" class="go" id="ocSugGo">보내기</button>'
      +   '<button type="button" class="no" id="ocSugNo">닫기</button>'
      + '</div>'
      + '<div class="oc-sug-msg" id="ocSugMsg"></div>'
      + '</div>';
    document.body.appendChild(dim);

    dim.addEventListener('click', function (e) { if (e.target === dim) close(dim); });
    dim.querySelector('#ocSugNo').addEventListener('click', function () { close(dim); });
    dim.querySelector('#ocSugGo').addEventListener('click', function () { send(dim, this); });
    var t = dim.querySelector('#ocSugT');
    if (t) t.focus();
  }

  function send(dim, btn) {
    var msg = dim.querySelector('#ocSugMsg');
    function say(t, bad) {
      msg.textContent = t || '';
      msg.className = 'oc-sug-msg' + (bad ? ' err' : '');
    }
    var g = function (id) { return (dim.querySelector(id).value || '').trim(); };

    var title = g('#ocSugT'), who = g('#ocSugN'), mail = g('#ocSugE');
    var url = g('#ocSugU'), org = g('#ocSugO'), note = g('#ocSugM');

    if (title.length < 2)  { say(WHAT + ' 이름을 적어 주십시오.', true); return; }
    if (who.length   < 2)  { say('알려주시는 분의 이름을 적어 주십시오.', true); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { say('메일 주소를 다시 확인해 주십시오.', true); return; }

    /* 홈페이지와 아시는 내용을 하나로 묶어 보냅니다 */
    var memo = [];
    if (url)  memo.push('홈페이지: ' + url);
    if (note) memo.push(note);
    memo.push('(목록 화면에서 보내신 등록 제보입니다 · ' + location.href.slice(0, 200) + ')');

    var h = { apikey: KEY, 'Content-Type': 'application/json' };
    var tk = token();
    h.Authorization = 'Bearer ' + (tk || KEY);

    btn.disabled = true;
    say('보내는 중입니다…');

    fetch(SB + '/rest/v1/rpc/oc_paid_apply', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        p: {
          plan_code: 'free',
          section:   SECTION,
          title:     title,
          applicant: who,
          email:     mail,
          org_name:  org,
          memo:      memo.join('\n')
        }
      })
    })
      .then(function (r) {
        return r.text().then(function (t) {
          if (!r.ok) {
            var m = t;
            try { m = JSON.parse(t).message || t; } catch (e) {}
            throw new Error(m);
          }
          return t;
        });
      })
      .then(function () {
        dim.querySelector('.oc-sug-box').innerHTML =
          '<div class="oc-sug-done">'
          + '<b>고맙습니다. 잘 받았습니다.</b>'
          + '<p>확인한 뒤 목록에 올리겠습니다.</p>'
          + '<p>더 여쭐 것이 있으면 적어 주신 메일로 연락드리겠습니다.</p>'
          + '<div class="oc-sug-act" style="justify-content:center">'
          +   '<button type="button" class="no" id="ocSugNo2">닫기</button>'
          + '</div></div>';
        dim.querySelector('#ocSugNo2').addEventListener('click', function () { close(dim); });
      })
      .catch(function (e) {
        say(String(e.message || e), true);
        btn.disabled = false;
      });
  }

  /* ── 목록 아래에 띠를 붙입니다 ─────────────────────────── */
  function mount() {
    if (document.querySelector('.oc-sug-bar')) return;
    css();

    var bar = document.createElement('div');
    bar.className = 'oc-sug-bar';
    bar.innerHTML =
      '<span>찾으시는 ' + WHAT + '가 없나요? 알고 계신 ' + WHAT + '를 알려 주시면 저희가 채워 넣겠습니다.</span>'
      + '<button type="button" class="oc-sug-btn">우리 ' + WHAT + '를 등록해 주세요</button>';
    bar.querySelector('button').addEventListener('click', open);

    /* 목록 다음, 쪽번호 아래에 놓습니다 */
    var anchor = document.querySelector('.board-page, .board-pager, .board-foot')
              || document.querySelector('.board-list')
              || document.querySelector('main');
    if (!anchor) return;
    if (anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    else anchor.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 400); });
  } else {
    setTimeout(mount, 400);
  }
})();
