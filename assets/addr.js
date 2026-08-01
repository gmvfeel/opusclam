/* ============================================================
   OPUSCLAM 주소 검색 — assets/addr.js

   무엇을 하나
    · 「주소검색」 단추를 누르면 우편번호 창을 열고,
      고른 주소를 우편번호·주소·상세주소 칸에 넣습니다

   왜 공통으로 두나
    주소를 적는 곳은 한둘이 아닙니다 —
      회원가입(5종) · 인재등록 · 채용등록 · 단체등록 …
    화면마다 따로 만들면 어느 화면은 도로명, 어느 화면은 지번이
    담기는 식으로 어긋납니다. 한 곳에서 정하면 모두 같아집니다.

   쓰는 법 ① — 표시만 붙이면 됩니다 (스크립트를 부르지 않아도 됩니다)
     <input id="zip">
     <input id="a1">
     <input id="a2">
     <button type="button" data-addr-search
             data-zip="#zip" data-addr1="#a1" data-addr2="#a2">주소검색</button>

   쓰는 법 ② — 코드에서 직접
     OCAddr.open({ zip: '#zip', addr1: '#a1', addr2: '#a2' });

   ★ 값은 무료입니다. 열쇠(API key)도 필요 없습니다.
   ★ 스크립트는 <b>처음 누를 때</b> 받아 옵니다 — 주소를 적지 않는
     사람에게 미리 짐을 지우지 않으려고요.
   ============================================================ */
(function () {
  'use strict';

  var SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
  var loading = null;

  function el(s) {
    if (!s) return null;
    return (typeof s === 'string') ? document.querySelector(s) : s;
  }

  /* 스크립트를 한 번만 받아 옵니다 — 두 번 눌러도 두 번 받지 않습니다 */
  function load() {
    if (window.daum && window.daum.Postcode) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise(function (done, fail) {
      var s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = function () { done(true); };
      s.onerror = function () { loading = null; fail(new Error('postcode script load failed')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* 고른 결과를 한 줄 주소로 다듬습니다.
     도로명을 고르면 동·아파트명을 괄호로 덧붙입니다 —
     「판교역로 166 (백현동, 분당 주공)」 처럼 사람이 아는 꼴이 됩니다. */
  function compose(data) {
    var road = data.userSelectedType === 'R';
    var addr = road ? (data.roadAddress || '') : (data.jibunAddress || '');
    if (road) {
      var extra = '';
      if (data.bname && /[동|로|가]$/.test(data.bname)) extra += data.bname;
      if (data.buildingName && data.apartment === 'Y') {
        extra += (extra ? ', ' : '') + data.buildingName;
      }
      if (extra) addr += ' (' + extra + ')';
    }
    return addr;
  }

  function fire(node) {
    if (!node) return;
    /* 다른 곳(작성 도우미의 진행률 같은 것)이 알아채게 알려 줍니다 */
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function open(opt) {
    opt = opt || {};
    var zip = el(opt.zip), a1 = el(opt.addr1), a2 = el(opt.addr2);

    load().then(function () {
      new window.daum.Postcode({
        oncomplete: function (data) {
          if (zip) { zip.value = data.zonecode || ''; fire(zip); }
          if (a1) { a1.value = compose(data); fire(a1); }
          if (typeof opt.onDone === 'function') opt.onDone(data);
          /* 고른 뒤에는 상세주소로 손을 옮겨 줍니다 —
             거기까지 적어야 주소가 끝나기 때문입니다 */
          if (a2) { try { a2.focus(); } catch (e) {} }
        },
        /* 창 안에서 뒤로 가기를 눌렀을 때 화면이 어긋나지 않게 */
        width: '100%', height: '100%',
      }).open();
    }).catch(function () {
      /* 스크립트를 받지 못해도 <b>직접 적는 길</b>은 남아 있습니다.
         주소를 적을 수 없어 등록을 못 하게 만들지 않습니다. */
      var msg = '주소 검색을 열지 못했습니다. 주소를 직접 적어 주셔도 됩니다.';
      if (typeof opt.onError === 'function') opt.onError(msg);
      else if (a1) { try { a1.focus(); } catch (e) {} alert(msg); }
    });
  }

  /* 표시(data-addr-search)만 붙여 두면 저절로 듣습니다.
     화면마다 스크립트를 적지 않아도 되고, 나중에 칸이 늘어도
     같은 표시만 붙이면 됩니다. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-addr-search]');
    if (!b) return;
    e.preventDefault();
    open({
      zip: b.getAttribute('data-zip'),
      addr1: b.getAttribute('data-addr1'),
      addr2: b.getAttribute('data-addr2'),
    });
  });

  window.OCAddr = { open: open, load: load, compose: compose };
})();
