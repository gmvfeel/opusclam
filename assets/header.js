/* ============================================================
   OPUSCLAM 공용 헤더 동작 — assets/header.js
   헤더 솔리드/스티키 · 드롭다운 · 햄버거 · 전체메뉴. (테마토글은 auth.js 담당)
   헤더 표시 모드는 페이지가 <body data-header="overlay"> 로 지정한다
   (지정 안 하면 항상 solid = 흰 배경 페이지 기본값). 상세는 아래 참조.
   include.js(동기)로 헤더가 DOM에 들어간 "뒤"에 실행되어야 함.
   각 요소가 없으면 자동으로 건너뛰도록(guard) 되어 있어 어느 페이지든 안전.
   ※ 지금은 커뮤니티(게시판) 페이지에서 사용. 추후 DB 페이지의
     인라인 헤더 스크립트도 이 파일로 대체하면 복붙이 사라진다.
   ============================================================ */
/* ※ 테마(다크/화이트) 토글은 auth.js가 단독으로 담당한다.
   (게시판·계정 등 auth.js를 로드하는 모든 페이지에서 .theme-toggle 클릭 처리)
   여기서 또 붙이면 클릭당 두 번 토글되어 다크모드가 안 켜지므로 넣지 않는다. */

/* ------------------------------------------------------------
   헤더 표시 모드 — 페이지가 <body data-header="..."> 로 명시한다.
   (DOM 구조를 추측하지 않으므로 페이지가 바뀌어도 안 깨진다)

   · 기본(속성 없음)     = 항상 solid(불투명).
       흰 배경의 일반/게시판 페이지. 헤더가 늘 보인다.
   · data-header="overlay" = 투명하게 히어로 위에 얹혔다가
       스크롤/호버 시 solid. 상단이 어두운 히어로인 홈·DB 페이지용.
       (히어로 요소는 .hero / .pdb / .pdb-bg 중 하나를 자동 인식)
   ------------------------------------------------------------ */
(function(){
  var sh=document.getElementById('siteHeader');
  if(!sh)return;
  var mode=(document.body.getAttribute('data-header')||'').toLowerCase();

  /* 기본: 항상 solid */
  if(mode!=='overlay'){
    sh.classList.add('solid');
    return;
  }

  /* overlay: 투명 → 스크롤/호버 시 solid */
  var hero=document.querySelector('.hero, .pdb, .pdb-bg, .board-hero');
  var hovering=false;
  function update(){
    var solid;
    if(window.innerWidth<=880){
      solid = window.scrollY>8;               // 모바일: 맨 위는 투명, 스크롤하면 불투명
    } else if(hero){
      var trigger=hero.offsetHeight-sh.offsetHeight-8;
      solid = hovering || window.scrollY>Math.max(trigger,60);
    } else {
      solid = hovering || window.scrollY>40;  // overlay인데 히어로를 못 찾은 예외 대비
    }
    sh.classList.toggle('solid', solid);
  }
  sh.addEventListener('mouseenter',function(){hovering=true;update();});
  sh.addEventListener('mouseleave',function(){hovering=false;update();});
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',update);
  update();
})();

document.querySelectorAll('.tabs').forEach(function(t){
  t.querySelectorAll('button').forEach(function(b){
    b.addEventListener('click',function(){
      t.querySelectorAll('button').forEach(function(x){x.classList.remove('on')});
      b.classList.add('on');
    });
  });
});

/* back to top */
(function(){
  var btn=document.getElementById('toTop');
  if(!btn)return;
  window.addEventListener('scroll',function(){
    if(window.scrollY>420)btn.classList.add('show');else btn.classList.remove('show');
  },{passive:true});
  btn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});
})();

/* mobile menu: drawer + accordion */
(function(){
  var burger=document.getElementById('burger');
  var nav=document.getElementById('mainNav');
  var overlay=document.getElementById('navOverlay');
  var sh=document.getElementById('siteHeader');
  if(!burger||!nav||!overlay)return;
  function open(){nav.classList.add('open');overlay.classList.add('open');burger.classList.add('open');burger.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';if(sh)sh.style.zIndex='95';}
  function close(){nav.classList.remove('open');overlay.classList.remove('open');burger.classList.remove('open');burger.setAttribute('aria-expanded','false');document.body.style.overflow='';if(sh)sh.style.zIndex='';}
  burger.addEventListener('click',function(){nav.classList.contains('open')?close():open();});
  overlay.addEventListener('click',close);
  var navClose=document.getElementById('navClose');
  if(navClose)navClose.addEventListener('click',close);
  /* accordion: only on mobile widths */
  nav.querySelectorAll('.nav-item > a').forEach(function(a){
    a.addEventListener('click',function(e){
      if(window.innerWidth>880)return;      /* desktop keeps hover behavior */
      var item=a.parentElement;
      if(item.querySelector('.dropdown')){
        e.preventDefault();
        /* 아코디언: 다른 열린 메뉴는 닫고 이 메뉴만 토글 */
        nav.querySelectorAll('.nav-item.open').forEach(function(o){ if(o!==item) o.classList.remove('open'); });
        item.classList.toggle('open');
      }
    });
  });
  /* reset when resizing back to desktop */
  window.addEventListener('resize',function(){if(window.innerWidth>880)close();});
})();

/* full menu */
(function(){
  var btn=document.getElementById('fullMenuBtn');
  var fm=document.getElementById('fullMenu');
  if(!btn||!fm)return;
  /* 헤더 로고를 전체 메뉴에도 재사용 */
  var hdrLogo=document.querySelector('.brand .logo-img');
  var fmLogo=fm.querySelector('.fm-logo');
  if(hdrLogo&&fmLogo)fmLogo.src=hdrLogo.src;
  function openFm(){fm.classList.add('open');btn.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';}
  function closeFm(){fm.classList.remove('open');btn.setAttribute('aria-expanded','false');document.body.style.overflow='';}
  btn.addEventListener('click',openFm);
  fm.querySelectorAll('[data-fm-close]').forEach(function(el){el.addEventListener('click',closeFm);});
  fm.querySelectorAll('.fm-col a').forEach(function(a){a.addEventListener('click',closeFm);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&fm.classList.contains('open'))closeFm();});
})();

/* PWA install banner */
(function(){
  var banner=document.getElementById('pwaInstall');
  var installBtn=document.getElementById('pwaInstallBtn');
  var closeBtn=document.getElementById('pwaInstallClose');
  if(!banner||!installBtn||!closeBtn)return;
  var deferred=null;
  window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();
    deferred=e;
    banner.classList.add('show');
  });
  installBtn.addEventListener('click',function(){
    if(!deferred)return;
    deferred.prompt();
    deferred.userChoice.then(function(){deferred=null;banner.classList.remove('show');});
  });
  closeBtn.addEventListener('click',function(){banner.classList.remove('show');});
  window.addEventListener('appinstalled',function(){banner.classList.remove('show');});
})();

/* 서비스워커 등록 (PWA 설치 가능 조건) */
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  });
}

/* WXN project showcase — infinite marquee */
(function(){
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
    {ko:'부클립스',en:'Book · LP · Search',desc:'희귀·절판 도서·음반 통합 검색',icon:'search',pat:'search',url:'https://booklps.vercel.app'},
    {ko:'LPSTOCK',en:'Used Classical LP',desc:'클래식 LP 레코드 익스체인지',icon:'vinyl',pat:'vinyl',url:'#'},
    {ko:'현대음악 DB',en:'Contemporary Music',desc:'현대음악 데이터베이스',icon:'wave',pat:'wave',url:'#'},
    {ko:'엘파그 LPAUG',en:'LP · Audio Guide',desc:'LP·오디오 입문 가이드',icon:'headphones',pat:'headphones',url:'https://lpaug.vercel.app'},
    {ko:'한눈에셋',en:'Asset Dashboard',desc:'전 자산 한눈에 · 실시간 시세',icon:'chart',pat:'chart',url:'https://myasset-share2.vercel.app'},
    {ko:'치킬 CheatKill',en:'Fraud Report',desc:'온라인 사기·피싱 신고·블랙리스트',icon:'shield',pat:'shield',url:'https://cheatkill-web.vercel.app'},
    {ko:'구역노트 cellnote',en:'Cell Group',desc:'교회 구역 모임 관리',icon:'people',pat:'people',url:'https://cellnote-k7bb.vercel.app'}
  ];
  /* shuffle */
  for(var i=PROJECTS.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=PROJECTS[i];PROJECTS[i]=PROJECTS[j];PROJECTS[j]=t;}
  function card(p){
    var ext=(p.url&&p.url!=='#')?' target="_blank" rel="noopener"':'';
    return '<a class="tb" href="'+p.url+'"'+ext+' data-pat="'+p.pat+'">'
      +'<span class="ic">'+IC[p.icon]+'</span>'
      +'<div><div class="en-s">'+p.en+'</div><h3>'+p.ko+'</h3><p>'+p.desc+'</p></div></a>';
  }
  var html=PROJECTS.map(card).join('');
  track.innerHTML=html+html; /* duplicate for seamless loop */

  var offset=0,setW=0,speed=0.4,paused=false;
  function measure(){setW=track.scrollWidth/2;}
  measure();
  window.addEventListener('resize',measure);
  function tick(){
    if(!paused&&setW>0){
      offset-=speed;
      if(-offset>=setW)offset+=setW;
      track.style.transform='translateX('+offset.toFixed(2)+'px)';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  var vp=track.parentNode;
  vp.addEventListener('mouseenter',function(){paused=true;});
  vp.addEventListener('mouseleave',function(){paused=false;});

  function step(dir){
    var card1=track.querySelector('.tb');
    var w=card1?card1.getBoundingClientRect().width:320;
    offset+=dir*w;
    if(offset>0)offset-=setW;
    if(-offset>=setW)offset+=setW;
    track.style.transform='translateX('+offset.toFixed(2)+'px)';
  }
  var prev=document.getElementById('tbPrev'),next=document.getElementById('tbNext');
  if(prev)prev.addEventListener('click',function(){step(1);});
  if(next)next.addEventListener('click',function(){step(-1);});
})();

