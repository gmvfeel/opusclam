/* i18n 이 없을 때를 위한 폴백 — 언어를 붙이지 못해도 이동은 됩니다 */
if (typeof window.ocGo !== 'function') { window.ocGo = function (u, r) { if (r) location.replace(u); else location.href = u; }; }
/* ============================================================
   OPUSCLAM  관심분야                    assets/interests.js
   2026-08-04

   ★ 무엇을 하나
     회원이 <b>관심 있는 게시판</b>을 담아 두면, 로그인했을 때
     메인이 그것으로 채워집니다 — <b>나만의 오퍼스클램</b>.

   ★ 왜 갈래 목록을 코드에 두나
     스물세 갈래이고 잘 바뀌지 않습니다. 표에 두면 관리 화면이 또
     필요하고, 게시판을 늘릴 때 표에도 넣어야 해서 잊기 쉽습니다.
     게시판이 늘면 <b>이 파일에 한 줄</b>만 더하면 됩니다.

   ★ 회원 종류로 걸러 냅니다
     인재정보는 단체·기업·학교 회원만 볼 수 있습니다. 일반 회원이
     그것을 담아도 메인에 나올 수 없으므로, <b>고르지 못하게</b> 합니다.
     담아 두었는데 안 보이면 「고장인가?」 싶습니다.

   ★ 담는 것은 (big, key) 두 값입니다
       big   spot · community · db · recruit    큰 메뉴
       key   festival · concours · person …     작은 갈래
     메인에서 「정보SPOT > 페스티벌정보」 처럼 보여 주려면 큰 메뉴를
     알아야 하고, 회원 종류로 걸러 낼 때도 그것이 기준이 됩니다.

   쓰는 법
     <script src="/assets/interests.js"></script>
     OCInterests.button(el, 'spot', 'festival')   ← 담기 단추 붙이기
     await OCInterests.list()                     ← 내가 담은 것
     OCInterests.all(memberType)                  ← 고를 수 있는 갈래
   ============================================================ */
(function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';

  /* ── 갈래 목록 ─────────────────────────────────────────────
     big    큰 메뉴
     key    작은 갈래 (게시판 파일 이름과 맞춥니다 — 헷갈리지 않게)
     label  사람이 읽을 이름
     href   그 게시판 주소
     sec    spot 표의 section 값 (메인에서 글을 가져올 때 씁니다)
     only   이 회원 종류만 고를 수 있음 (없으면 누구나)
     ★ 게시판을 늘리면 여기에 한 줄 더하십시오. */
  /* ★ hidden 칸이 <b>없는</b> 표가 있으면 그 갈래에 noHidden:true 를
     붙여 주십시오. 그러지 않으면 「hidden=not.is.true」 조건이
       column ... does not exist
     오류를 내어 그 칸이 통째로 비어 보입니다.
     확인 SQL(check-hidden-null.sql) 의 ⓵ 에서 「hidden 칸 없음」 으로
     나오는 표가 그것입니다. */

  var CATS = [
    /* ── 정보SPOT ── */
    { big:'spot', key:'festival',  label:'페스티벌정보',       href:'/spot/festival.html',  sec:'페스티벌',
      en:'Festival',   tb:'spot', view:'/spot/spot-view.html' },
    { big:'spot', key:'concours',  label:'국내/외 콩쿨정보',   href:'/spot/concours.html',  sec:'콩쿨',
      en:'Concours',   tb:'spot', view:'/spot/spot-view.html' },
    { big:'spot', key:'concert',   label:'공연정보',           href:'/spot/concert.html',   sec:'공연정보',
      en:'Concert',    tb:'spot', view:'/spot/spot-view.html' },
    { big:'spot', key:'funding',   label:'지원금 / 정책자금',  href:'/spot/funding.html',   sec:'지원금',
      en:'Funding',    tb:'spot', view:'/spot/spot-view.html' },
    { big:'spot', key:'media',     label:'음원 / 동영상',      href:'/spot/media.html',     sec:'음원영상',
      en:'Media',      tb:'spot', view:'/spot/spot-view.html' },
    { big:'spot', key:'score',     label:'각 분야별 악보',     href:'/spot/score.html',     sec:'악보',
      en:'Score',      tb:'spot', view:'/spot/spot-view.html' },
    { big:'spot', key:'sites',     label:'관련사이트',         href:'/spot/sites.html',     sec:'관련사이트',
      en:'Sites',      tb:'spot', view:'/spot/spot-view.html' },

    /* ── OC커뮤니티 ── */
    { big:'community', key:'hottopic',   label:'핫토픽',          href:'/community/hottopic.html',
      en:'Hot Topic',  tb:'hottopic',  view:'/community/hottopic-view.html' },
    { big:'community', key:'news',       label:'뉴스',            href:'/community/news.html',
      en:'News',       tb:'news',      view:'/community/news-view.html' },
    { big:'community', key:'qna',        label:'지식나눔',        href:'/community/qna.html',
      en:'Q&A',        tb:'qna',       view:'/community/qna-view.html' },
    { big:'community', key:'admission',  label:'입시요강',        href:'/community/admission.html',
      en:'Admission',  tb:'admission', view:'/community/admission-view.html' },
    { big:'community', key:'admission-community', label:'입시커뮤니티', href:'/community/admission-community.html',
      en:'Admission Talk', tb:'admission_community', view:'/community/admission-community-view.html' },
    { big:'community', key:'gallery',    label:'공연사진 / 영상', href:'/community/gallery.html',
      en:'Gallery',    tb:'gallery',   view:'/community/gallery-view.html' },
    { big:'community', key:'modern',     label:'현대음악',        href:'/community/modern.html',
      en:'Modern',     tb:'modern_music', view:'/community/modern-view.html' },
    { big:'community', key:'prenatal',   label:'태교음악',        href:'/community/prenatal.html',
      en:'Prenatal',   tb:'prenatal_music', view:'/community/prenatal-view.html' },
    /* ★ SELF PR 은 <b>회원 자기 소개</b>입니다 — members 표에서 옵니다.
       메인에 글 목록으로 보여 줄 것이 아니라, 매일 한 사람을 뽑아
       보여 주는 방식이었습니다(pick_self_pr). 그래서 <b>목록 가져오기는
       하지 않고</b> 링크만 둡니다. */
    { big:'community', key:'selfpr',     label:'SELF PR',         href:'/community/selfpr.html',
      en:'Self PR',    noList:true },
    /* ★ 이달의 음악학교도 <b>한 달에 한 곳</b>을 뽑는 방식입니다
       (pick_monthly_school). 목록이 아니므로 링크만 둡니다. */
    { big:'community', key:'school-month', label:'이달의 음악학교', href:'/community/school-month.html',
      en:'School of the Month', noList:true },
    /* ★ <b>유틸리티 / 자료는 목록에서 뺍니다.</b>
       (2026-08-04 · 파트너 정한 것)
       메인 광고 아래에 <b>고정 자리</b>로 늘 있습니다. 담아 두어도
       메인이 바뀌지 않으니, 회원 입장에서는 「담았는데 아무 일도
       안 나네?」 가 됩니다. 고를 수 없게 두는 편이 헷갈리지 않습니다.

       ★ 게시판에서도 담기 단추가 안 나옵니다 — 이 목록에 없으면
         include.js 가 단추를 놓지 않습니다.
       ★ 나중에 메인 짜임이 바뀌어 고정이 아니게 되면 이 줄을 되살리면
         됩니다.

    */

    /* ── DATABASE ── */
    { big:'db', key:'person',     label:'인물DB',           href:'/db/person.html',
      en:'People',      tb:'persons',   view:'/db/person-view.html',   nameCol:'name_ko' },
    { big:'db', key:'org',        label:'음악단체DB',       href:'/db/org.html',
      en:'Organization', tb:'orgs',     view:'/db/org-view.html',      nameCol:'name_ko' },
    { big:'db', key:'venue',      label:'공연장DB',         href:'/db/venue.html',
      en:'Venue',       tb:'venues',    view:'/db/venue-view.html',    nameCol:'name_ko' },
    { big:'db', key:'school',     label:'음악학교DB',       href:'/db/school.html',
      en:'School',      tb:'schools',   view:'/db/school-view.html',   nameCol:'name_ko' },
    { big:'db', key:'modern',     label:'현대음악DB',       href:'/db/modern.html',
      en:'Contemporary', tb:'modern_composers', view:'/db/modern-view.html', nameCol:'name_ko' },
    { big:'db', key:'foundation', label:'관련기관·재단DB',  href:'/db/foundation.html',
      en:'Foundation',  tb:'foundations', view:'/db/foundation-view.html', nameCol:'name_ko' },
    { big:'db', key:'academic',   label:'학술DB',           href:'/db/academic.html',
      en:'Academic',    tb:'academic',  view:'/db/academic-view.html', nameCol:'title' }

    /* ── 리쿠르트 · 유틸리티는 <b>목록에 넣지 않습니다</b> ──────
       (2026-08-04 · 파트너 정한 것)

       메인 광고 아래에 <b>고정 자리</b>로 늘 있습니다 —
         리쿠르트   한 칸에서 「구인 / 구직」 탭으로 둘 다 보여 줍니다
         유틸리티   자기 칸이 따로 있습니다

       담아 두어도 메인이 바뀌지 않으니, 회원 입장에서는
       「담았는데 아무 일도 안 나네?」 가 됩니다. 고를 수 없게 두는 편이
       헷갈리지 않습니다.

       ★ 게시판에서도 담기 단추가 나오지 않습니다 — 이 목록에 없으면
         include.js 가 단추를 놓지 않습니다.
       ★ 입시요강은 <b>남깁니다</b> — 그것은 고정 자리가 아닙니다.
       ★ 나중에 메인 짜임이 바뀌면 여기에 다시 넣으면 됩니다. */
  ];

  var BIG_LABEL = {
    spot:'정보SPOT', community:'OC커뮤니티', db:'DATABASE', recruit:'리쿠르트'
  };

  /* ── Supabase ─────────────────────────────────────────────
     ★ 같은 객체를 씁니다 — 새로 만들면 로그인 상태가 갈라집니다.

     ★ <b>supabase-js 가 없는 화면도 있습니다.</b>
       DATABASE 목록(인물DB 등)은 그것을 싣지 않습니다. 그래서 처음에는
       로그인해 있는데도 <b>로그인 화면으로 보내는</b> 일이 났습니다 —
       Supabase 객체를 못 만들어 「로그인 안 함」 으로 읽었기 때문입니다.

       그래서 없으면 <b>스스로 싣습니다.</b> 그러면 어느 화면에서든
       똑같이 돕니다. */
  var _libWait = null;

  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
    if (_libWait) return _libWait;
    _libWait = new Promise(function (res) {
      /* 이미 누군가 싣는 중이면 그것을 기다립니다 */
      var old = document.querySelector('script[data-oc-sblib]');
      if (old) {
        old.addEventListener('load', function () { res(true); });
        old.addEventListener('error', function () { res(false); });
        return;
      }
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      sc.setAttribute('data-oc-sblib', '1');
      sc.onload = function () { res(true); };
      sc.onerror = function () { res(false); };
      document.head.appendChild(sc);
    });
    return _libWait;
  }

  async function sb() {
    if (window.__ocSb) return window.__ocSb;
    var ok = await loadLib();
    if (!ok || !window.supabase || !window.supabase.createClient) return null;
    if (!window.__ocSb)
      window.__ocSb = window.supabase.createClient(SB_URL, SB_KEY);
    return window.__ocSb;
  }

  var _me = undefined;   /* undefined = 아직 안 봄 · null = 로그인 안 함 */
  async function me() {
    if (_me !== undefined) return _me;
    var c = await sb();
    if (!c) { _me = null; return _me; }
    try {
      var g = await c.auth.getSession();
      var s = g && g.data && g.data.session;
      if (!s) { _me = null; return _me; }
      var r = await c.from('members').select('id,member_type,status').eq('id', s.user.id).single();
      _me = (r && r.data) ? r.data : { id: s.user.id, member_type: '', status: '' };
    } catch (e) { _me = null; }
    return _me;
  }

  /* ── 고를 수 있는 갈래 ───────────────────────────────────── */
  function all(memberType) {
    var t = memberType || '';
    return CATS.filter(function (c) {
      return !c.only || c.only.indexOf(t) >= 0;
    });
  }
  function find(big, key) {
    for (var i = 0; i < CATS.length; i++)
      if (CATS[i].big === big && CATS[i].key === key) return CATS[i];
    return null;
  }
  function labelOf(big, key) {
    var c = find(big, key);
    return c ? (BIG_LABEL[big] + ' › ' + c.label) : (big + ' › ' + key);
  }

  /* ── 내가 담은 것 ───────────────────────────────────────── */
  var _mine = null;
  async function list(force) {
    if (_mine && !force) return _mine;
    var m = await me(), c = await sb();
    if (!m || !c) { _mine = []; return _mine; }
    try {
      var r = await c.from('member_interests')
        .select('id,big,key,sort_no')
        .eq('member_id', m.id)
        .order('sort_no', { ascending: true })
        .order('id', { ascending: true });
      _mine = (r && r.data) ? r.data : [];
    } catch (e) { _mine = []; }
    return _mine;
  }
  async function has(big, key) {
    var mine = await list();
    return mine.some(function (x) { return x.big === big && x.key === key; });
  }

  /* ── 담기 · 빼기 ───────────────────────────────────────── */
  async function add(big, key) {
    var m = await me(), c = await sb();
    if (!m || !c) return { ok:false, why:'login' };
    var cat = find(big, key);
    if (!cat) return { ok:false, why:'unknown' };
    if (cat.only && cat.only.indexOf(m.member_type) < 0)
      return { ok:false, why:'type' };
    try {
      var mine = await list(true);
      /* 맨 뒤에 놓습니다 — 먼저 담은 것이 위에 옵니다 */
      var maxNo = 100;
      mine.forEach(function (x) { if (x.sort_no > maxNo) maxNo = x.sort_no; });
      var r = await c.from('member_interests')
        .insert({ member_id: m.id, big: big, key: key, sort_no: maxNo + 10 })
        .select('id');
      if (r.error) {
        /* 이미 담은 것 — unique 가 막습니다. 잘못이 아닙니다. */
        if (String(r.error.message || '').indexOf('duplicate') >= 0)
          return { ok:true, already:true };
        throw new Error(r.error.message);
      }
      await list(true);
      return { ok:true };
    } catch (e) {
      return { ok:false, why:'error', msg:String(e.message || e) };
    }
  }

  async function remove(big, key) {
    var m = await me(), c = await sb();
    if (!m || !c) return { ok:false, why:'login' };
    try {
      /* ★ 실제로 몇 줄이 지워졌는지 받아서 확인합니다 —
         줄 보안이 막으면 오류 없이 0줄이 됩니다. */
      var r = await c.from('member_interests').delete()
        .eq('member_id', m.id).eq('big', big).eq('key', key).select('id');
      if (r.error) throw new Error(r.error.message);
      await list(true);
      return { ok: !!(r.data && r.data.length) };
    } catch (e) {
      return { ok:false, why:'error', msg:String(e.message || e) };
    }
  }

  /* ── 순서 바꾸기 ───────────────────────────────────────── */
  async function reorder(ids) {
    var m = await me(), c = await sb();
    if (!m || !c) return { ok:false };
    try {
      for (var i = 0; i < ids.length; i++) {
        await c.from('member_interests')
          .update({ sort_no: (i + 1) * 10 })
          .eq('id', ids[i]).eq('member_id', m.id);
      }
      await list(true);
      return { ok:true };
    } catch (e) { return { ok:false, msg:String(e.message || e) }; }
  }

  /* ── 담기 단추 ─────────────────────────────────────────────
     ★ 게시판 제목 옆에 놓습니다. 담긴 상태면 채워진 별, 아니면 빈 별.
     ★ 로그인하지 않은 사람에게도 <b>보입니다.</b> 누르면 로그인으로
       보내면서, 돌아올 곳을 알려 줍니다. 단추를 숨기면 이런 기능이
       있다는 것을 아예 모르게 됩니다.
     ★ 담을 수 없는 갈래(회원 종류가 안 맞음)에서는 <b>놓지 않습니다.</b> */
  function button(host, big, key, opt) {
    opt = opt || {};
    if (!host) return;
    var cat = find(big, key);
    if (!cat) return;

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'oc-fav-btn';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<i class="star" aria-hidden="true">☆</i><span>관심분야</span>';
    host.appendChild(b);

    function paint(on) {
      b.classList.toggle('on', !!on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.querySelector('.star').textContent = on ? '★' : '☆';
      b.querySelector('span').textContent = on ? '관심분야' : '관심분야';
      b.title = on ? '관심분야에서 빼기' : '관심분야에 담기';
    }

    (async function () {
      var m = await me();
      if (m && cat.only && cat.only.indexOf(m.member_type) < 0) {
        /* 담을 수 없는 갈래 — 단추를 없앱니다 */
        b.remove(); return;
      }
      if (m) paint(await has(big, key));
    })();

    b.addEventListener('click', async function () {
      var m = await me();
      if (!m) {
        ocGo('/account/login.html?next='
          + encodeURIComponent(location.pathname + location.search));
        return;
      }
      b.disabled = true;
      var on = b.classList.contains('on');
      var r = on ? await remove(big, key) : await add(big, key);
      b.disabled = false;
      if (!r.ok) {
        if (r.why === 'type') toast('이 갈래는 단체·기업·학교 회원만 담을 수 있습니다.');
        else toast('처리하지 못했습니다. 잠시 뒤에 다시 해 주십시오.');
        return;
      }
      paint(!on);
      toast(!on ? '관심분야에 담았습니다.' : '관심분야에서 뺐습니다.');
    });

    return b;
  }

  /* 짧은 알림 — alert 은 흐름을 끊습니다 */
  function toast(text) {
    var old = document.querySelector('.oc-fav-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'oc-fav-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('go'); }, 20);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ── 오늘 첫 로그인이면 활동점수를 줍니다 ─────────────────────
     ★ 왜 여기서도 부르나 (2026-08-04)
       assets/auth.js 에 넣었는데, <b>메인은 그 파일을 싣지 않습니다.</b>
       그래서 메인만 들어온 회원은 점수가 오르지 않았습니다.

       이 파일은 게시판·메인이 모두 싣고, Supabase 객체도 스스로
       챙기므로 여기서 부르는 편이 확실합니다.

     ★ 하루 한 번만 오릅니다 — point_rules 의 per_day=1 이 막으므로
       두 곳에서 불러도 두 번 오르지 않습니다.
     ★ 한 화면에서 두 번 부르지 않게 표시를 남깁니다. */
  (function dailyPoint(){
    if (window.__ocLoginPointDone) return;
    window.__ocLoginPointDone = true;
    setTimeout(async function(){
      try {
        var m = await me();
        if (!m) return;                  /* 로그인 안 함 */
        var c = await sb();
        if (!c || !c.rpc) return;
        var q = c.rpc('oc_daily_login');
        if (q && q.then) q.then(function(){}, function(e){
          console.warn('[interests] 로그인 포인트를 주지 못했습니다:', e && e.message);
        });
      } catch (e) { /* 화면은 그대로 돕니다 */ }
    }, 1500);   /* 화면이 다 뜬 뒤에 — 첫 그림이 늦어지지 않게 */
  })();

  window.OCInterests = {
    all: all, find: find, labelOf: labelOf, bigLabel: BIG_LABEL,
    me: me, list: list, has: has,
    add: add, remove: remove, reorder: reorder,
    button: button, toast: toast,
    CATS: CATS
  };
})();
