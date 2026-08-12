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
    if (!tables.length) return;

    var label = (me && me.getAttribute('data-label')) || '오늘 업데이트';
    var href  = (me && me.getAttribute('data-href')) || '';
    var box   = document.querySelector((me && me.getAttribute('data-into')) || '.cm-quick');
    if (!box) return;

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
      } else {
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
