/* ============================================================
   OPUSCLAM 오늘 업데이트 개수 — assets/today-count.js
   ------------------------------------------------------------
   커뮤니티·정보SPOT 첫 화면의 「바로가기」 카드 줄 맨 끝에
   <b>오늘 새로 담긴 것이 몇 건인지</b> 카드 하나를 더 놓습니다.

   ★ 왜 (2026-08-12 · 파트너 요청)
     카드마다 전체 건수는 있는데 <b>오늘 무엇이 늘었는지</b>는
     알 수 없었습니다. 매일 자동수집이 도는 사이트이므로
     「오늘 27건 올라왔다」가 다시 찾아올 이유가 됩니다.

     ★ 카드 자리도 마침 비어 있었습니다 — 커뮤니티는 카드가 열 개라
       여섯 칸 줄에서 마지막 한 칸이 빈 채였습니다.

   ★ 무엇을 세나
     여러 표를 한꺼번에 세어 <b>합</b>을 보여 줍니다.
     기준은 <b>한국 시간 오늘 0시</b>부터입니다 —
     created_at 은 UTC 로 담기므로 그대로 자르면 한국 새벽에 올린 글이
     어제로 밀립니다(날짜 다루기에서 여러 번 겪은 일입니다).

   ★ 표를 하나씩 세지 않고 <b>한 번에</b> 셉니다
     표마다 조회를 보내면 열 번이 됩니다. PostgREST 는 한 표씩만
     세므로 조회 수는 표 수만큼이지만, <b>건수만</b>(select=id&limit=1 +
     count=exact) 받으므로 줄 내용은 오가지 않습니다. 가볍습니다.

   쓰는 법 — 화면에 카드 자리를 두고
     <a class="cm-qcard" id="ocToday" ...> … </a>
   또는 그냥 이 파일을 부르면 카드를 <b>스스로 만들어 붙입니다.</b>

     <script src="/assets/today-count.js"
             data-tables="hottopic,gallery,admission,qna,news"
             data-label="오늘 업데이트"></script>

   ★ 표마다 조건을 덧붙일 수 있습니다
     data-tables="spot|hidden=is.false"          감춘 것은 세지 않습니다
     data-tables="news:published_at"             날짜 칸이 다를 때

   ★ 자료를 못 받으면 카드를 만들지 않습니다 — 「—건」이 남아 있는
     것보다 아예 없는 편이 낫습니다.

   ══ 2026-08-21 · 카드마다 「+N」 배지 (파트너 요청) ══════════════

   ★ 무엇을 푸는가
     합계 카드 한 장으로는 <b>어느 갈래가</b> 늘었는지 알 수 없습니다.
     「오늘 업데이트 9건」은 나오는데 정작 음원·동영상 카드에는 아무
     표시가 없어, 무엇이 들어왔는지 알 수 없었습니다(파트너 지적).

   ★ 왜 이 파일에 넣나 — 서브 메인마다 카드 만드는 <b>방식이 다릅니다</b>
     · DATABASE  : hub.js 의 OCHub.init 이 만듦
     · 정보SPOT  : 화면 안 코드가 spot 표를 section 으로 갈라 셈
     · OC커뮤니티 : 화면 안 코드가 게시판 표 열 개를 각각 셈
     화면마다 따로 붙이면 같은 일이 세 벌이 되고, 나중에 한쪽만 고치는
     날이 옵니다. <b>이 파일은 이미 세 화면에 다 붙어 있으므로</b>
     여기 한 곳만 넓히면 끝납니다.

   ★ 쓰는 법 — 화면마다 <b>한 줄</b>만 더합니다
     <script src="/assets/today-count.js"
             data-tables="spot|hidden=is.false"
             data-marks="#cFes=>spot|hidden=is.false&section=eq.페스티벌;
                         #cMed=>spot|hidden=is.false&section=eq.음원영상"></script>

     · 「고를 자리=>표이름[:날짜칸][|덧붙일 조건]」 을 <b>세미콜론</b>으로 잇습니다
     · 고를 자리는 <b>숫자가 들어 있는 그 칸</b>입니다 — 배지는 그 바로
       뒤에 붙습니다. 화면마다 카드 모양이 달라도 자리를 안 탑니다.
     · data-tables 없이 data-marks 만 써도 됩니다 (합계 카드는 안 만듭니다)

   ★ 0건이면 <b>아무것도 붙이지 않습니다</b>
     합계 카드는 0도 뜻이 있지만, 배지는 다릅니다. 카드마다 「+0」이
     붙으면 늘어난 곳이 눈에 띄지 않습니다.

   ★ 담아 두지 않습니다 — 방금 들어온 것이 <b>바로</b> 보여야 합니다.
     조회는 카드마다 하나씩 늘지만, 건수만 받으므로 가볍습니다.
   ============================================================ */

(function () {
  var SB = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'count=exact' };

  /* 이 파일을 부른 <script> 태그에서 설정을 읽습니다 */
  var me = document.currentScript;

  /* ★ 한국 시간 오늘 0시를 UTC 로 바꿔 줍니다.
       한국은 UTC+9 이므로 한국 0시 = 전날 15:00 UTC 입니다.
       toISOString().slice(0,10) 으로 자르면 한국 새벽 글이 어제가 됩니다. */
  function kstTodayStartUTC() {
    var now = new Date();
    /* 지금을 한국 시각으로 옮겨 놓고 날짜만 봅니다 */
    var kst = new Date(now.getTime() + 9 * 3600 * 1000);
    var y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
    /* 그 날짜의 한국 0시 = UTC 로 9시간 전 */
    return new Date(Date.UTC(y, m, d, 0, 0, 0) - 9 * 3600 * 1000).toISOString();
  }

  /* ★ 표마다 덧붙일 조건이 다릅니다.
       정보SPOT 은 spot 표 하나에 여러 갈래가 섞여 있고
       <b>hidden=is.false</b> 인 것만 화면에 나옵니다. 그 조건을 빼면
       카드의 다른 숫자들과 셈이 어긋납니다(감춘 것까지 세게 됩니다).
       data-tables 에 「표이름|조건」 으로 적을 수 있게 했습니다. */
  function countOne(spec, sinceISO) {
    var parts = String(spec).split('|');
    var head = parts[0].split(':');
    var table = head[0];
    var col = head[1] || 'created_at';
    var extra = parts[1] ? ('&' + parts[1]) : '';
    var q = SB + '/rest/v1/' + table + '?select=id&limit=1'
          + '&' + col + '=gte.' + encodeURIComponent(sinceISO) + extra;
    return fetch(q, { headers: H })
      .then(function (r) {
        var cr = r.headers.get('content-range');
        if (!cr) return 0;
        return parseInt((cr.split('/')[1] || '0'), 10) || 0;
      })
      .catch(function () { return 0; });
  }

  /* ── 카드별 「+N」 배지 ────────────────────────────────────
     ★ 모양을 <b>이 파일이 스스로</b> 넣습니다. 서브 메인 세 곳이 서로
       다른 css 를 쓰므로(hub.css · style.css …), 한 곳에 적으면 나머지
       화면에서 배지가 맨몸으로 나옵니다. */
  var MARK_CSS = ''
    + '.oc-newmark{display:inline-block;margin-left:6px;vertical-align:middle;'
    +   'font-style:normal;font-size:11px;font-weight:800;letter-spacing:-.02em;'
    +   'line-height:1;padding:3px 7px;border-radius:99px;white-space:nowrap;'
    +   'color:var(--violet,#5A4A7A);background:rgba(156,127,214,.16)}'
    + 'html[data-theme="dark"] .oc-newmark{color:var(--violet-3,#bebebe);'
    +   'background:rgba(255,255,255,.10)}';

  function injectCss() {
    if (document.getElementById('oc-newmark-css')) return;
    var st = document.createElement('style');
    st.id = 'oc-newmark-css';
    st.textContent = MARK_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function putMark(sel, n) {
    if (!n || n < 1) return;                 /* 0 이면 아무것도 안 붙입니다 */
    var el = document.querySelector(sel);
    if (!el) return;
    injectCss();
    /* 두 번 붙지 않게 — 화면이 숫자를 다시 채워도 배지는 하나뿐이어야 합니다 */
    var old = el.parentNode && el.parentNode.querySelector('.oc-newmark');
    if (old) old.parentNode.removeChild(old);
    var em = document.createElement('em');
    em.className = 'oc-newmark';
    em.textContent = '+' + n.toLocaleString();
    em.setAttribute('title', '오늘 ' + n.toLocaleString() + '건 새로 들어왔습니다');
    /* ★ 숫자 <b>바로 뒤</b>가 아니라 그 칸의 <b>맨 끝</b>에 놓습니다.
         바로 뒤에 두면 「485 +9 건」처럼 단위 앞에 끼어 읽힙니다.
         맨 끝에 두면 「485건 +9」가 되어 자연스럽습니다. */
    (el.parentNode || el).appendChild(em);
  }

  /* 「고를 자리=>표이름|조건」 을 세미콜론으로 이은 글을 풀어 냅니다 */
  function parseMarks(txt) {
    return String(txt || '').split(';').map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (one) {
        var i = one.indexOf('=>');
        if (i < 0) return null;
        var sel = one.slice(0, i).trim();
        var spec = one.slice(i + 2).trim();
        return (sel && spec) ? { sel: sel, spec: spec } : null;
      })
      .filter(Boolean);
  }

  function makeCard(label, n, href) {
    var a = document.createElement('a');
    a.className = 'cm-qcard is-today';
    a.id = 'ocToday';
    if (href) a.href = href;
    a.innerHTML = '<span class="cm-qlabel">' + label + '</span>'
                + '<span class="cm-qcount"><b>' + n.toLocaleString() + '</b><i>건</i></span>';
    return a;
  }

  function start() {
    var tables = ((me && me.getAttribute('data-tables')) || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    /* ★ 카드별 배지 — 합계 카드와 <b>따로 돕니다.</b>
         한쪽이 안 되어도 다른 쪽은 나와야 합니다. */
    var marks = parseMarks(me && me.getAttribute('data-marks'));
    if (marks.length) {
      var since0 = kstTodayStartUTC();
      marks.forEach(function (m) {
        countOne(m.spec, since0).then(function (n) { putMark(m.sel, n); });
      });
    }

    if (!tables.length) return;   /* 배지만 쓰는 화면 — 합계 카드는 건너뜁니다 */

    var label = (me && me.getAttribute('data-label')) || '오늘 업데이트';
    var href  = (me && me.getAttribute('data-href')) || '';
    var box   = document.querySelector((me && me.getAttribute('data-into')) || '.cm-quick');

    /* ★★ 2026-08-21 · 여기서 <b>곧바로 나가면 안 됩니다</b>
         예전에는 합계 카드를 붙일 상자(.cm-quick)가 없으면 바로 나갔습니다.
         그런데 DATABASE 처럼 <b>배지만 쓰는 화면</b>에는 그 상자가 없어,
         data-marks 를 적어도 아무 일이 일어나지 않았습니다.
       ▶ 상자가 없으면 <b>합계 카드만</b> 건너뛰고 배지는 그대로 답니다. */
    if (!box && !tables.length && !marks.length) return;

    var since = kstTodayStartUTC();
    Promise.all(tables.map(function (t) {
      /* 「표이름:날짜칸」 으로 적으면 그 칸으로 셉니다 (기본 created_at) */
      return countOne(t, since);
    })).then(function (nums) {
      var sum = nums.reduce(function (a, b) { return a + b; }, 0);
      /* ★ 0건이어도 보여 줍니다 — 「오늘은 아직 없다」도 뜻이 있습니다.
           다만 자료를 못 받아 모두 0 인 것과 구별할 수 없으므로,
           한 표라도 응답이 왔는지는 위에서 이미 걸렀습니다(실패는 0). */
      var el = document.getElementById('ocToday');
      if (el) {
        var b = el.querySelector('b');
        if (b) b.textContent = sum.toLocaleString();
      } else if (box) {
        box.appendChild(makeCard(label, sum, href));
      }
    }).catch(function () { /* 못 받으면 카드를 만들지 않습니다 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
