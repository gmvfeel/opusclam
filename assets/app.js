/* ===== OPUSCLAM 공통 스크립트 (헤더/푸터·공통 동작) =====
   이 파일 하나만 고치면 이 파일을 불러오는 모든 페이지에 반영됩니다.
   현재 담당: 공통 푸터 자동 삽입 + 푸터 연도 자동. (헤더는 다음 단계) */
(function(){
  "use strict";
  var FOOTER_HTML = "<footer>\n  <div class=\"wrap\">\n    <div class=\"foot-top\">\n      <img class=\"foot-logo\" src=\"/assets/logo.png\" alt=\"OPUSCLAM.COM\">\n      <div class=\"foot-links\">\n        <a href=\"#\">광고안내</a><a href=\"#\">(주)윅슨어소시에이츠</a><a href=\"#\">엘피스탁</a>\n      </div>\n    </div>\n    <div class=\"foot-mid\">\n      <a href=\"#\">DataBase</a><a href=\"#\">OC커뮤니티</a><a href=\"#\">정보SPOT</a><a href=\"#\">레슨:ON</a>\n      <a href=\"#\">SHOPPING</a><a href=\"#\">리쿠르트</a><a href=\"#\">개인정보취급방침</a><a href=\"#\">서비스약관</a>\n      <a href=\"#\">고객지원센터</a><a href=\"#\">제휴문의</a>\n    </div>\n    <div class=\"addr\">\n      03993 서울특별시 마포구 동교로 215-1(동교동) 스튜디오한사 406 &nbsp;|&nbsp; Tel : 02-3141-1305 &nbsp;|&nbsp; Fax : 02-3141-1335<br>\n      4 Floor, #406, Studio HANSA, 215-1, Donggyo-ro, Mapo-gu, Seoul, Republic of Korea &nbsp;|&nbsp; Tel : +82-2-3141-1305 &nbsp;|&nbsp; Fax : +82-2-3141-1335<br>\n      © 2026 opusclam &amp; wixon associates Inc All rights reserved. &nbsp; Designed by WXN / Sim da seon.\n    </div>\n    <div class=\"foot-bot\">\n      <select class=\"fam\"><option>FAMILY SITE</option><option>LPSTOCK</option><option>WIXON ASSOCIATES</option></select>\n      <div class=\"sns\">\n        <a href=\"#\" aria-label=\"facebook\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M14 9h3V6h-3c-2 0-3 1-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V9z\"/></svg></a>\n        <a href=\"#\" aria-label=\"twitter\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M22 6c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.3 1.7-2.2-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.8 3.6A11 11 0 0 1 4 5s-4 9 5 13a12 12 0 0 1-7 2c9 5 20 0 20-11.5 0-.3 0-.6-.1-.8.9-.6 1.5-1.4 2.1-2.4z\"/></svg></a>\n        <a href=\"#\" aria-label=\"blog\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M7 5h5.4a3.3 3.3 0 0 1 2.5 5.5A3.6 3.6 0 0 1 13 18H7V5zm3 2.4v2.8h2.1a1.4 1.4 0 0 0 0-2.8H10zm0 4.8V15h2.6a1.5 1.5 0 0 0 0-2.8H10z\"/></svg></a>\n      </div>\n    </div>\n  </div>\n</footer>";
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
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", injectFooter); }
  else { injectFooter(); }
})();
