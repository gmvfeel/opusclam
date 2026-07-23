/* ===== OPUSCLAM 공통 스크립트 (헤더/푸터·공통 동작) =====
   이 파일 하나만 고치면 이 파일을 불러오는 모든 페이지에 반영됩니다.
   현재 담당: 공통 푸터 자동 삽입 + 푸터 연도 자동. (헤더는 다음 단계) */
(function(){
  "use strict";
  var FOOTER_CSS = "<style id=\"oc-foot-css\">footer{background:#fff;color:#5a5b74;border-top:1px solid #efeae0;font-family:\"Pretendard\",-apple-system,system-ui,sans-serif;text-align:left;padding:0;letter-spacing:normal}footer .wrap{max-width:1080px;margin:0 auto;padding:42px 20px 50px;text-align:left}footer .foot-top{display:flex;align-items:center;justify-content:space-between;padding-bottom:22px;flex-wrap:wrap;gap:16px}footer .foot-logo{height:32px;width:auto;display:block;filter:grayscale(1)}footer .foot-links{display:flex;gap:26px;font-size:13px;flex-wrap:wrap}footer .foot-links a{color:#20223a;font-weight:600;display:inline-flex;align-items:center;gap:6px;text-decoration:none}footer .foot-links a::after{content:'›';color:#8f90a6;font-weight:400}footer .foot-links a:hover{color:#7C63B0}footer .foot-mid{display:flex;flex-wrap:wrap;align-items:center;gap:6px 0;padding:4px 0 16px;font-size:11px}footer .foot-mid a{color:#20223a;font-weight:600;text-decoration:none}footer .foot-mid a:not(:last-child)::after{content:'·';margin:0 5px;color:#e4ded2;font-weight:400}footer .foot-mid a:hover{color:#7C63B0}footer .addr{font-size:11.5px;color:#8f90a6;line-height:1.85}footer .foot-bot{display:flex;align-items:center;justify-content:space-between;margin-top:24px;flex-wrap:wrap;gap:14px}footer .fam{background:none;border:0;border-bottom:1px solid #e4ded2;color:#5a5b74;padding:8px 4px;font-size:12.5px;min-width:210px;font-family:inherit;cursor:pointer}footer .sns{display:flex;gap:10px}footer .sns a{width:34px;height:34px;border-radius:50%;background:#f7f2ea;display:grid;place-items:center;color:#8f90a6;transition:background .2s,color .2s;text-decoration:none}footer .sns a:hover{background:#7C63B0;color:#fff}footer .sns svg{width:15px;height:15px}html[data-theme=\"dark\"] footer{background:#0d0d0d;color:#a2a2a2;border-top-color:#2b2b2b}html[data-theme=\"dark\"] footer .foot-links a,html[data-theme=\"dark\"] footer .foot-mid a{color:#eaeaea}html[data-theme=\"dark\"] footer .foot-links a:hover,html[data-theme=\"dark\"] footer .foot-mid a:hover{color:#a2a2a2}html[data-theme=\"dark\"] footer .foot-links a::after{color:#6d6d6d}html[data-theme=\"dark\"] footer .foot-mid a:not(:last-child)::after{color:#383838}html[data-theme=\"dark\"] footer .addr{color:#6d6d6d}html[data-theme=\"dark\"] footer .fam{border-bottom-color:#383838;color:#a2a2a2}html[data-theme=\"dark\"] footer .sns a{background:#1f1f1f;color:#6d6d6d}html[data-theme=\"dark\"] footer .sns a:hover{background:#a2a2a2;color:#0d0d0d}</style>";
  var FOOTER_HTML = "<footer>\n  <div class=\"wrap\">\n    <div class=\"foot-top\">\n      <img class=\"foot-logo\" src=\"/assets/logo.png\" alt=\"OPUSCLAM.COM\">\n      <div class=\"foot-links\">\n        <a href=\"#\">광고안내</a><a href=\"#\">(주)윅슨어소시에이츠</a><a href=\"#\">엘피스탁</a>\n      </div>\n    </div>\n    <div class=\"foot-mid\">\n      <a href=\"#\">DataBase</a><a href=\"#\">OC커뮤니티</a><a href=\"#\">정보SPOT</a><a href=\"#\">레슨:ON</a>\n      <a href=\"#\">SHOPPING</a><a href=\"#\">리쿠르트</a><a href=\"/privacy.html\" target=\"_blank\" rel=\"noopener\">개인정보취급방침</a><a href=\"/terms.html\" target=\"_blank\" rel=\"noopener\">서비스약관</a><a href=\"/data-policy.html\" target=\"_blank\" rel=\"noopener\">데이터정책</a>\n      <a href=\"#\">고객지원센터</a><a href=\"#\">제휴문의</a>\n    </div>\n    <div class=\"addr\">\n      03993 서울특별시 마포구 동교로 215-1(동교동) 스튜디오한사 406 &nbsp;|&nbsp; Tel : 02-3141-1305 &nbsp;|&nbsp; Fax : 02-3141-1335<br>\n      4 Floor, #406, Studio HANSA, 215-1, Donggyo-ro, Mapo-gu, Seoul, Republic of Korea &nbsp;|&nbsp; Tel : +82-2-3141-1305 &nbsp;|&nbsp; Fax : +82-2-3141-1335<br>\n      © 2026 opusclam &amp; wixon associates Inc All rights reserved. &nbsp; Designed by WXN / Sim da seon.\n    </div>\n    <div class=\"foot-bot\">\n      <select class=\"fam\"><option>FAMILY SITE</option><option>LPSTOCK</option><option>WIXON ASSOCIATES</option></select>\n      <div class=\"sns\">\n        <a href=\"#\" aria-label=\"facebook\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M14 9h3V6h-3c-2 0-3 1-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V9z\"/></svg></a>\n        <a href=\"#\" aria-label=\"twitter\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M22 6c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.3 1.7-2.2-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.8 3.6A11 11 0 0 1 4 5s-4 9 5 13a12 12 0 0 1-7 2c9 5 20 0 20-11.5 0-.3 0-.6-.1-.8.9-.6 1.5-1.4 2.1-2.4z\"/></svg></a>\n        <a href=\"#\" aria-label=\"blog\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M7 5h5.4a3.3 3.3 0 0 1 2.5 5.5A3.6 3.6 0 0 1 13 18H7V5zm3 2.4v2.8h2.1a1.4 1.4 0 0 0 0-2.8H10zm0 4.8V15h2.6a1.5 1.5 0 0 0 0-2.8H10z\"/></svg></a>\n      </div>\n    </div>\n  </div>\n</footer>";
  var BANNER_CSS = "<style id=\"oc-banner-css\">.wxn-eyebrow{position:relative;z-index:3;height:26px;margin:8px 0 0;overflow:hidden;text-align:center}.wxn-run{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);white-space:nowrap;font-family:\"Pretendard\",-apple-system,system-ui,sans-serif;font-size:8px;font-weight:600;letter-spacing:.16em;color:#8f90a6}.triple{position:relative;z-index:1;background:#000;overflow:hidden;box-shadow:0 16px 30px -10px rgba(0,0,0,.5)}.tb-viewport{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 28%,#000 72%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 28%,#000 72%,transparent 100%)}.tb-track{display:flex;will-change:transform}.tb{flex:0 0 auto;width:clamp(260px,25vw,360px);padding:30px 26px;color:#fff;position:relative;display:flex;align-items:center;gap:18px;min-height:132px;transition:.25s;overflow:hidden;border-right:1px solid rgba(255,255,255,.14);text-decoration:none}.tb-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:5;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.75);display:grid;place-items:center;cursor:pointer;transition:background .2s,color .2s,border-color .2s}.tb-arrow:hover{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.4)}.tb-prev{left:12px}.tb-next{right:12px}.tb .ic{width:58px;height:58px;flex:0 0 58px;border-radius:12px;background:rgba(255,255,255,.1);display:grid;place-items:center;color:#fff;opacity:.45;transition:transform .32s cubic-bezier(.22,1,.36,1),background .3s,box-shadow .3s,opacity .35s;position:relative;z-index:1}.tb .ic svg{width:30px;height:30px}.tb .en-s{font-family:\"Pretendard\",-apple-system,system-ui,sans-serif;font-size:11px;letter-spacing:.22em;color:rgba(255,255,255,.28);text-transform:uppercase;transition:color .3s}.tb h3{font-family:\"Pretendard\",-apple-system,system-ui,sans-serif;font-size:15px;font-weight:600;margin:3px 0 5px;color:rgba(255,255,255,.3);transition:transform .3s cubic-bezier(.22,1,.36,1),color .3s}.tb p{font-size:12px;color:rgba(255,255,255,.24);line-height:1.45;transition:color .3s}.tb>div{transition:transform .3s cubic-bezier(.22,1,.36,1)}.tb::after{content:\"\";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#7C63B0,#EC7A1C);transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.22,1,.36,1)}.tb:hover{background:rgba(255,255,255,.08)}.tb:hover::after{transform:scaleX(1)}.tb:hover .ic{transform:translateY(-4px) scale(1.07);background:#fff;color:#7C63B0;box-shadow:0 12px 26px -8px rgba(0,0,0,.55);opacity:1}.tb:hover>div{transform:translateX(5px)}.tb:hover h3{color:#fff}.tb:hover .en-s{color:#fff}.tb:hover p{color:rgba(255,255,255,.72)}@media(max-width:768px){.tb{padding:13px 18px;min-height:0;gap:13px;width:clamp(230px,72vw,300px)}.tb-arrow{width:34px;height:34px}.tb-prev{left:6px}.tb-next{right:6px}.tb .ic{width:40px;height:40px;flex:0 0 40px;border-radius:9px}.tb .ic svg{width:21px;height:21px}.tb .en-s{font-size:9.5px;letter-spacing:.14em}.tb h3{font-size:17px;margin:2px 0 3px}.tb p{font-size:11px}}</style>";
  var BANNER_HTML = "<div class=\"wxn-eyebrow\"><span class=\"wxn-run\">ALLIANCE WXN</span></div><section class=\"triple\"><button class=\"tb-arrow tb-prev\" id=\"tbPrev\" aria-label=\"이전\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 6l-6 6 6 6\"/></svg></button><div class=\"tb-viewport\"><div class=\"tb-track\" id=\"tbTrack\"></div></div><button class=\"tb-arrow tb-next\" id=\"tbNext\" aria-label=\"다음\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6l6 6-6 6\"/></svg></button></section>";

  function initBanner(){
    var track=document.getElementById('tbTrack');
    if(!track)return;
    var IC={
      search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v10a1.6 1.6 0 0 0-1.6-1.6H4z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v10a1.6 1.6 0 0 1 1.6-1.6H20z"/><circle cx="17.5" cy="18" r="3"/><path d="m21.5 22-1.7-1.7"/></svg>',
      vinyl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/></svg>',
      wave:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h2l2-6 3 15 3-11 2 5h6"/></svg>',
      headphones:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 14v-2a7 7 0 0 1 14 0v2"/><rect x="3" y="13" width="4" height="7" rx="1.6"/><rect x="17" y="13" width="4" height="7" rx="1.6"/></svg>',
      chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-8M4 20h16" stroke-linecap="round"/></svg>',
      shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3 3 0 0 1 0 6M18 20c0-2.6-1.3-4.4-3-5.2" opacity=".7"/></svg>'
    };
    var PROJECTS=[
      {ko:'부클립스',en:'Book · LP · Search',desc:'희귀·절판 도서·음반 통합 검색',icon:'search',url:'https://booklps.vercel.app'},
      {ko:'LPSTOCK',en:'Used Classical LP',desc:'클래식 LP 레코드 익스체인지',icon:'vinyl',url:'#'},
      {ko:'현대음악 DB',en:'Contemporary Music',desc:'현대음악 데이터베이스',icon:'wave',url:'#'},
      {ko:'엘파그 LPAUG',en:'LP · Audio Guide',desc:'LP·오디오 입문 가이드',icon:'headphones',url:'https://lpaug.vercel.app'},
      {ko:'한눈에셋',en:'Asset Dashboard',desc:'전 자산 한눈에 · 실시간 시세',icon:'chart',url:'https://myasset-share2.vercel.app'},
      {ko:'치킬 CheatKill',en:'Fraud Report',desc:'온라인 사기·피싱 신고·블랙리스트',icon:'shield',url:'https://cheatkill-web.vercel.app'},
      {ko:'구역노트 cellnote',en:'Cell Group',desc:'교회 구역 모임 관리',icon:'people',url:'https://cellnote-k7bb.vercel.app'}
    ];
    for(var i=PROJECTS.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=PROJECTS[i];PROJECTS[i]=PROJECTS[j];PROJECTS[j]=tmp;}
    function card(p){
      var ext=(p.url&&p.url!=='#')?' target="_blank" rel="noopener"':'';
      return '<a class="tb" href="'+p.url+'"'+ext+'><span class="ic">'+IC[p.icon]+'</span>'
        +'<div><div class="en-s">'+p.en+'</div><h3>'+p.ko+'</h3><p>'+p.desc+'</p></div></a>';
    }
    var html=PROJECTS.map(card).join('');
    track.innerHTML=html+html;
    var offset=0,setW=0,speed=0.4,paused=false;
    function measure(){setW=track.scrollWidth/2;}
    measure(); window.addEventListener('resize',measure);
    function tick(){
      if(!paused&&setW>0){offset-=speed; if(-offset>=setW)offset+=setW; track.style.transform='translateX('+offset.toFixed(2)+'px)';}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    var vp=track.parentNode;
    vp.addEventListener('mouseenter',function(){paused=true;});
    vp.addEventListener('mouseleave',function(){paused=false;});
    function stepMove(dir){
      var c=track.querySelector('.tb'); var w=c?c.getBoundingClientRect().width:320;
      offset+=dir*w; if(offset>0)offset-=setW; if(-offset>=setW)offset+=setW;
      track.style.transform='translateX('+offset.toFixed(2)+'px)';
    }
    var pv=document.getElementById('tbPrev'),nx=document.getElementById('tbNext');
    if(pv)pv.addEventListener('click',function(){stepMove(1);});
    if(nx)nx.addEventListener('click',function(){stepMove(-1);});
  }
  function injectBannerIfNeeded(footerSlot){
    if(document.getElementById('tbTrack'))return; /* db·home 등 이미 배너 있는 페이지는 건너뜀 */
    footerSlot.insertAdjacentHTML('beforebegin', BANNER_CSS + BANNER_HTML);
    initBanner();
  }
  function injectFooter(){
    var slot=document.getElementById("oc-footer");
    if(slot){ injectBannerIfNeeded(slot); slot.outerHTML = FOOTER_CSS + FOOTER_HTML; }
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
