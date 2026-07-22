/* ===== OPUSCLAM 공통 스크립트 (헤더/푸터·공통 동작) =====
   이 파일 하나만 고치면 이 파일을 불러오는 모든 페이지에 반영됩니다.
   현재 담당: 공통 푸터 자동 삽입 + 푸터 연도 자동. (헤더는 다음 단계) */
(function(){
  "use strict";
  var FOOTER_HTML = "<footer>\n  <div class=\"wrap\">\n    <div class=\"foot-top\">\n      <img class=\"foot-logo\" src=\"/assets/logo.png\" alt=\"OPUSCLAM.COM\">\n      <div class=\"foot-links\">\n        <a href=\"#\">광고안내</a><a href=\"#\">(주)윅슨어소시에이츠</a><a href=\"#\">엘피스탁</a>\n      </div>\n    </div>\n    <div class=\"foot-mid\">\n      <a href=\"#\">DataBase</a><a href=\"#\">OC커뮤니티</a><a href=\"#\">정보SPOT</a><a href=\"#\">레슨:ON</a>\n      <a href=\"#\">SHOPPING</a><a href=\"#\">리쿠르트</a><a href=\"/privacy.html\" target=\"_blank\" rel=\"noopener\">개인정보취급방침</a><a href=\"/terms.html\" target=\"_blank\" rel=\"noopener\">서비스약관</a><a href=\"/data-policy.html\" target=\"_blank\" rel=\"noopener\">데이터정책</a>\n      <a href=\"#\">고객지원센터</a><a href=\"#\">제휴문의</a>\n    </div>\n    <div class=\"addr\">\n      03993 서울특별시 마포구 동교로 215-1(동교동) 스튜디오한사 406 &nbsp;|&nbsp; Tel : 02-3141-1305 &nbsp;|&nbsp; Fax : 02-3141-1335<br>\n      4 Floor, #406, Studio HANSA, 215-1, Donggyo-ro, Mapo-gu, Seoul, Republic of Korea &nbsp;|&nbsp; Tel : +82-2-3141-1305 &nbsp;|&nbsp; Fax : +82-2-3141-1335<br>\n      © 2026 opusclam &amp; wixon associates Inc All rights reserved. &nbsp; Designed by WXN / Sim da seon.\n    </div>\n    <div class=\"foot-bot\">\n      <select class=\"fam\"><option>FAMILY SITE</option><option>LPSTOCK</option><option>WIXON ASSOCIATES</option></select>\n      <div class=\"sns\">\n        <a href=\"#\" aria-label=\"facebook\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M14 9h3V6h-3c-2 0-3 1-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V9z\"/></svg></a>\n        <a href=\"#\" aria-label=\"twitter\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M22 6c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.3 1.7-2.2-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.8 3.6A11 11 0 0 1 4 5s-4 9 5 13a12 12 0 0 1-7 2c9 5 20 0 20-11.5 0-.3 0-.6-.1-.8.9-.6 1.5-1.4 2.1-2.4z\"/></svg></a>\n        <a href=\"#\" aria-label=\"blog\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M7 5h5.4a3.3 3.3 0 0 1 2.5 5.5A3.6 3.6 0 0 1 13 18H7V5zm3 2.4v2.8h2.1a1.4 1.4 0 0 0 0-2.8H10zm0 4.8V15h2.6a1.5 1.5 0 0 0 0-2.8H10z\"/></svg></a>\n      </div>\n    </div>\n  </div>\n</footer>";
  function injectFooter(){
    var slot=document.getElementById("oc-footer");
    if(slot){ slot.outerHTML = FOOTER_HTML; }
    // 푸터 연도 자동 갱신 (© 20xx)
    try{
      var y=new Date().getFullYear();
      document.querySelectorAll("footer .addr").forEach(function(el){
        el.innerHTML = el.innerHTML.replace(/©\s*20\d{2}/, "© "+y);
      });
    }catch(e){}
  }
  // ===== 헤더 로그인 상태 반영 (로그인 시 이름/로그아웃으로 교체) =====
  var SB_URL="https://ptdxzxkgddvkusamkiol.supabase.co";
  var SB_KEY="sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu";
  function loadSupabase(cb){
    if(window.supabase && window.supabase.createClient){ cb(); return; }
    var s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload=cb; s.onerror=function(){};
    document.head.appendChild(s);
  }
  function collectAuthLinks(){
    var login=[], join=[];
    var els=document.querySelectorAll(".mast-tools .link-txt, .m-actions a");
    for(var i=0;i<els.length;i++){
      var t=(els[i].textContent||"").trim();
      if(t==="로그인") login.push(els[i]);
      else if(t==="회원가입") join.push(els[i]);
    }
    return {login:login, join:join};
  }
  function setLoggedOut(links){
    links.login.forEach(function(a){ a.setAttribute("href","/login.html"); a.onclick=null; });
    links.join.forEach(function(a){ a.setAttribute("href","/join.html"); a.onclick=null; });
  }
  var OC_TYPE_LABEL={major:"전공자",industry:"음악관계자",org:"단체·기업",school:"음악학교",general:"일반"};
  function setLoggedIn(links, name, typeLabel, sb){
    var label=name+"님"+(typeLabel?" ("+typeLabel+")":"");
    links.login.forEach(function(a){ a.textContent=label; a.setAttribute("href","/mypage.html"); a.onclick=null; });
    links.join.forEach(function(a){ a.textContent="로그아웃"; a.setAttribute("href","#"); a.onclick=function(e){ e.preventDefault(); sb.auth.signOut().then(function(){ location.reload(); }); }; });
  }
  function showPendingBanner(){
    if(document.getElementById("oc-pending-bar")) return;
    var bar=document.createElement("div");
    bar.id="oc-pending-bar";
    bar.setAttribute("style","background:#fdf3e0;border-bottom:1px solid #f0d9a8;color:#9a6512;padding:11px 20px;text-align:center;font-size:13px;line-height:1.6;");
    bar.innerHTML="🕐 <strong>승인 대기 중</strong>입니다. 관리자 승인 후 데이터 등록·보강 기능을 이용하실 수 있습니다. (자료 열람은 지금도 가능합니다)";
    document.body.insertBefore(bar, document.body.firstChild);
  }
  function updateHeaderAuth(){
    var links=collectAuthLinks();
    if(!links.login.length && !links.join.length) return; // 헤더가 없는 페이지
    loadSupabase(function(){
      if(!(window.supabase && window.supabase.createClient)) return;
      var sb=window.supabase.createClient(SB_URL, SB_KEY);
      sb.auth.getSession().then(function(r){
        var session=(r.data && r.data.session)?r.data.session:null;
        if(!session){ setLoggedOut(links); return; }
        sb.from("members").select("name,username,member_type,status").eq("id",session.user.id).single().then(function(mr){
          var d=mr.data||{};
          var nm=(d.name||d.username) || (session.user.email||"회원");
          setLoggedIn(links, nm, OC_TYPE_LABEL[d.member_type]||"", sb);
          if(d.status==='pending' && ['major','industry','org','school'].indexOf(d.member_type)>=0) showPendingBanner();
        }, function(){ setLoggedIn(links, (session.user.email||"회원"), "", sb); });
      });
    });
  }

  function ocInit(){ injectFooter(); updateHeaderAuth(); }
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", ocInit); }
  else { ocInit(); }
})();
