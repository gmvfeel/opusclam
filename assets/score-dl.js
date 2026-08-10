/* i18n 이 없을 때를 위한 폴백 — 언어를 붙이지 못해도 이동은 됩니다 */
if (typeof window.ocGo !== 'function') { window.ocGo = function (u, r) { if (r) location.replace(u); else location.href = u; }; }
/* ============================================================
   OPUSCLAM  악보 내려받기          assets/score-dl.js

   무엇을 하는가
     악보 파일을 <b>회원에게만</b> 내려받게 합니다.

   ★ 왜 이 파일이 필요한가
     scores 버킷을 비공개로 잠갔습니다. 공개였을 때는 주소를 그대로
     링크하면 됐지만, 이제는 <b>내려받을 때마다 임시 주소를 새로
     만들어야</b> 합니다. 그 주소는 몇 분 뒤 스스로 죽으므로
     퍼 나르기도 어렵습니다.

     화면에서만 「회원만」 이라고 막는 것으로는 뜻이 없습니다 —
     주소를 알면 누구나 받을 수 있고, 게시판 목록 응답에 주소가
     들어 있으므로 알아내기도 어렵지 않습니다. 그래서 저장소를
     잠그고, 여기서 로그인을 확인합니다.

   ★ 이미 올라간 악보도 그대로 씁니다
     예전에 담긴 file_url 은 공개 주소 꼴입니다. 거기서 <b>경로만
     뽑아</b> 임시 주소를 새로 만들므로, 자료를 고치지 않아도 됩니다.

   쓰는 법
     await OCScoreDL.open(fileUrl);          // 새 창으로 열기
     await OCScoreDL.download(fileUrl, name); // 파일로 내려받기
     OCScoreDL.isMember();                    // 회원인가 (모르면 null)
   ============================================================ */
(function () {
  'use strict';

  var SB_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SB_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var BUCKET = 'scores';
  var TTL    = 300;   /* 임시 주소가 살아 있는 시간(초) — 5분 */

  var _sb = null;
  function sb(){
    if (_sb) return _sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    /* ★ 다른 화면이 이미 만들어 둔 접속을 <b>같이 씁니다.</b>
       따로 만들면 로그인 상태를 못 보고 「회원이 아니다」 라고
       판단하는 일이 생깁니다. */
    _sb = window.__ocSb || window.supabase.createClient(SB_URL, SB_KEY);
    window.__ocSb = _sb;
    return _sb;
  }

  /* ── 공개 주소에서 <b>경로만</b> 뽑습니다 ────────────────────
     들어오는 모양이 여러 가지입니다 —
       https://…/storage/v1/object/public/scores/uid/file_1_x.pdf
       https://…/storage/v1/object/sign/scores/uid/file_1_x.pdf?token=…
       uid/file_1_x.pdf                     (경로만 담긴 경우)
     어느 쪽이든 「uid/file_1_x.pdf」 를 돌려줍니다. */
  function pathOf(url){
    var s = String(url || '').trim();
    if (!s) return '';
    if (s.indexOf('http') !== 0) return s.replace(/^\/+/, '');
    var m = s.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^?]+)/);
    if (!m) return '';
    var p = decodeURIComponent(m[1]);
    /* 앞에 붙은 버킷 이름을 떼어 냅니다 */
    if (p.indexOf(BUCKET + '/') === 0) p = p.slice(BUCKET.length + 1);
    return p;
  }

  /* ── 회원인가 ─────────────────────────────────────────────
     모르면 null 을 돌려줍니다(라이브러리가 아직 안 실렸을 때). */
  var _me = undefined;
  async function isMember(){
    if (_me !== undefined) return _me;
    var c = sb();
    if (!c) return null;
    try {
      var g = await c.auth.getUser();
      _me = !!(g && g.data && g.data.user);
    } catch (e) { _me = false; }
    return _me;
  }

  function askLogin(){
    /* ★ 지금 보던 자리로 돌아오게 합니다 — 로그인 뒤 목록 첫 장으로
       튕기면 다시 찾아 들어가야 해서 번거롭습니다. */
    var back = encodeURIComponent(location.pathname + location.search);
    if (confirm('악보는 회원만 내려받을 수 있습니다.\n\n로그인 화면으로 가시겠습니까?')){
      ocGo('/account/login.html?next=' + back);
    }
  }

  /* ── 임시 주소 만들기 ───────────────────────────────────── */
  async function signed(fileUrl){
    var c = sb();
    if (!c) throw new Error('Supabase 라이브러리를 불러오지 못했습니다');
    var p = pathOf(fileUrl);
    if (!p) throw new Error('파일 경로를 알 수 없습니다');
    var r = await c.storage.from(BUCKET).createSignedUrl(p, TTL);
    if (r.error) throw new Error(r.error.message);
    return r.data.signedUrl;
  }

  /* ── 새 창으로 열기 ─────────────────────────────────────── */
  async function open_(fileUrl){
    var ok = await isMember();
    if (ok === false){ askLogin(); return false; }
    if (ok === null){
      alert('로그인 상태를 확인할 수 없습니다. 화면을 새로 불러 주십시오.');
      return false;
    }
    /* ★ 창을 <b>먼저</b> 열어 둡니다.
       주소를 받아온 뒤에 열면 브라우저가 「사용자가 누른 것이 아니다」 라고
       보아 팝업으로 막습니다. 빈 창을 먼저 열고 주소를 채웁니다. */
    var w = window.open('', '_blank');
    try {
      var url = await signed(fileUrl);
      if (w) { w.location.href = url; }
      else { location.href = url; }   /* 팝업이 막혔으면 이 창에서 엽니다 */
      return true;
    } catch (e){
      if (w) w.close();
      alert('악보를 열지 못했습니다: ' + (e.message || e));
      return false;
    }
  }

  /* ── 파일로 내려받기 ────────────────────────────────────── */
  async function download(fileUrl, fileName){
    var ok = await isMember();
    if (ok === false){ askLogin(); return false; }
    if (ok === null){
      alert('로그인 상태를 확인할 수 없습니다. 화면을 새로 불러 주십시오.');
      return false;
    }
    try {
      var url = await signed(fileUrl);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'score.pdf';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ a.remove(); }, 1000);
      return true;
    } catch (e){
      alert('악보를 내려받지 못했습니다: ' + (e.message || e));
      return false;
    }
  }

  /* ── 내려받은 수 올리기 ─────────────────────────────────────
     ★ 실패해도 그냥 넘어갑니다. 숫자를 못 올린 것 때문에
       악보를 못 받게 되면 안 됩니다. */
  async function countUp(id){
    if (!id) return;
    var c = sb();
    if (!c) return;
    try { await c.rpc('spot_download_inc', { p_id: id }); } catch (e) {}
  }

  /* ── 바깥 링크(IMSLP 등) — 회원만 ─────────────────────────
     ★ 왜 표를 따로 읽는가
       주소를 spot.link_url 에 두면 게시판 엔진이 select=* 로 받아오므로
       <b>비회원의 목록 응답에도 주소가 들어갑니다.</b> 화면에서 단추를
       감춰도 개발자 도구로 보입니다.

       그래서 score_links 표로 옮기고, 그 표를 <b>로그인한 회원만</b>
       읽게 했습니다(줄 단위 보안). 비회원은 한 줄도 못 읽습니다.

     ★ 정직하게 — IMSLP 는 공개 사이트입니다. 작품명과 작곡가를 알면
       그쪽에서 검색해 찾을 수 있습니다. 이것은 <b>바로 가는 편의</b>를
       회원 혜택으로 두는 것이고, 자료를 감추는 것이 아닙니다. */
  var IMSLP_BASE = 'https://imslp.org/wiki/';

  async function linkOf(spotId){
    var c = sb();
    if (!c) throw new Error('Supabase 라이브러리를 불러오지 못했습니다');
    var r = await c.from('score_links').select('url,imslp_ref')
      .eq('spot_id', spotId).limit(1);
    if (r.error) throw new Error(r.error.message);
    var row = (r.data && r.data[0]) || null;
    if (!row) return '';
    if (row.url && String(row.url).trim()) return String(row.url).trim();
    if (row.imslp_ref && String(row.imslp_ref).trim()){
      return IMSLP_BASE + String(row.imslp_ref).trim().replace(/ /g, '_');
    }
    return '';
  }

  /* 링크가 있는가 — 단추를 보일지 정할 때 씁니다.
     ★ 비회원에게는 <b>묻지 않습니다.</b> 물어도 못 읽고, 괜히
       「없다」 고 판단해 단추를 감추면 회원가입할 이유가 안 보입니다.
       그래서 비회원에게는 「회원만」 단추를 그대로 보여 줍니다. */
  async function openLink(spotId){
    var ok = await isMember();
    if (ok === false){ askLink(); return false; }
    if (ok === null){
      alert('로그인 상태를 확인할 수 없습니다. 화면을 새로 불러 주십시오.');
      return false;
    }
    /* 창을 먼저 열어 둡니다 — 주소를 받은 뒤 열면 팝업으로 막힙니다 */
    var w = window.open('', '_blank');
    try {
      var url = await linkOf(spotId);
      if (!url) throw new Error('링크가 등록되지 않았습니다');
      if (w) w.location.href = url;
      else location.href = url;
      return true;
    } catch (e){
      if (w) w.close();
      alert('링크를 열지 못했습니다: ' + (e.message || e));
      return false;
    }
  }

  function askLink(){
    var back = encodeURIComponent(location.pathname + location.search);
    if (confirm('악보 링크는 회원만 볼 수 있습니다.\n\n로그인 화면으로 가시겠습니까?')){
      ocGo('/account/login.html?next=' + back);
    }
  }

  window.OCScoreDL = {
    openLink: openLink,
    linkOf: linkOf,
    open: open_,
    download: download,
    isMember: isMember,
    pathOf: pathOf,
    countUp: countUp,
    TTL: TTL
  };
})();
