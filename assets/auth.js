/* 테마(다크/화이트) 토글 — .theme-toggle 클릭 시 전환, localStorage 저장 */
(function(){
  try{ if(localStorage.getItem('oc-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); }catch(e){}
  function ready(){
    document.addEventListener('click', function(e){
      var t = e.target.closest && e.target.closest('.theme-toggle'); if(!t) return;
      var toDark = document.documentElement.getAttribute('data-theme') !== 'dark';
      if(toDark) document.documentElement.setAttribute('data-theme','dark');
      else document.documentElement.removeAttribute('data-theme');
      try{ localStorage.setItem('oc-theme', toDark ? 'dark' : 'light'); }catch(e){}
    });
  }
  if(document.readyState !== 'loading') ready(); else document.addEventListener('DOMContentLoaded', ready);
})();

/* ===== OPUSCLAM 회원 인증 공통 스크립트 =====
   Supabase Auth 연동: 로그인(아이디→이메일 변환), 소셜 로그인,
   아이디 중복확인, 세션 확인/로그아웃.
   ※ 사용 페이지는 supabase-js를 먼저 로드해야 함:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/assets/auth.js"></script>
*/
(function(){
  "use strict";
  var SUPABASE_URL = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var _sb = null;

  function sb(){
    if(!_sb){
      if(!window.supabase || !window.supabase.createClient){
        console.error('[auth] supabase-js가 로드되지 않았습니다.');
        return null;
      }
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _sb;
  }

  var ocAuth = {
    client: sb,

    /* 아이디 사용 가능 여부 (가입 화면 '중복확인') */
    usernameAvailable: async function(username){
      var c = sb(); if(!c) return false;
      var r = await c.rpc('username_available', { p_username: username });
      return r && r.data === true;
    },

    /* 아이디 + 비밀번호 로그인 (아이디를 이메일로 변환 후 로그인) */
    login: async function(username, password){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var er = await c.rpc('email_for_username', { p_username: username });
      var email = er && er.data;
      if(!email) return { ok:false, msg:'아이디 또는 비밀번호를 확인해 주세요.' };
      var r = await c.auth.signInWithPassword({ email: email, password: password });
      if(r.error) return { ok:false, msg:'아이디 또는 비밀번호를 확인해 주세요.' };
      return { ok:true };
    },

    /* 소셜 로그인 (google / kakao / naver) — 제공자는 Supabase에서 활성화 필요 */
    social: function(provider){
      var c = sb(); if(!c) return;
      c.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: location.origin + '/home.html' }
      });
    },

    /* 회원가입: 아이디 중복확인 → 계정 생성 → members 프로필 저장
       p = { type, username, password, name, email, phone, birth, address, extra } */
    signup: async function(p){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var avail = await this.usernameAvailable(p.username);
      if(!avail) return { ok:false, msg:'이미 사용 중인 아이디입니다.' };
      var su = await c.auth.signUp({ email:p.email, password:p.password });
      if(su.error) return { ok:false, msg: su.error.message || '가입 처리 중 오류' };
      var uid = su.data && su.data.user && su.data.user.id;
      if(!uid) return { ok:false, msg:'가입 처리 중 오류 (이메일 인증 설정을 확인하세요)' };
      var status = (p.type === 'general') ? 'approved' : 'pending';
      var ins = await c.from('members').insert({
        id: uid, username: p.username, member_type: p.type, status: status,
        name: p.name || null, email: p.email || null, phone: p.phone || null,
        birth: p.birth || null, address: p.address || null, extra: p.extra || {}
      });
      if(ins.error) return { ok:false, msg: ins.error.message || '프로필 저장 오류' };
      return { ok:true, status: status };
    },

    /* 현재 로그인 세션 */
    session: async function(){
      var c = sb(); if(!c) return null;
      var r = await c.auth.getSession();
      return r.data ? r.data.session : null;
    },

    logout: async function(){
      var c = sb(); if(!c) return;
      await c.auth.signOut();
      location.href = '/home.html';
    }
  };

  /* 폼 자동 수집 → 가입: [data-k] 요소를 모아 common/extra 분류 후 signup 호출 */
  ocAuth.formSignup = async function(scope, type){
    var els = scope.querySelectorAll('[data-k]');
    var common = {}, extra = {}, missing = false;
    var CK = ['username','password','password2','name','email','phone','birth','address'];
    els.forEach(function(el){
      var _grp = el.closest('[data-group]'); if(_grp && _grp.style.display === 'none') return;
      var k = el.getAttribute('data-k');
      if(el.type === 'checkbox'){
        if(el.hasAttribute('data-multi')){ extra[k] = extra[k] || []; if(el.checked) extra[k].push(el.value); }
        else { extra[k] = el.checked; }
        return;
      }
      var val = (el.value || '').trim();
      el.style.borderColor = '';
      if(el.hasAttribute('data-req') && !val){ missing = true; el.style.borderColor = '#f2777a'; }
      if(CK.indexOf(k) >= 0) common[k] = val; else if(val) extra[k] = val;
    });
    if(missing) return { ok:false, msg:'필수 항목을 모두 입력해 주세요.' };
    if(common.password){
      var _pw=common.password, _r=(_pw.length>=8)&&/[A-Za-z]/.test(_pw)&&/[0-9]/.test(_pw)&&/[^A-Za-z0-9]/.test(_pw);
      if(!_r) return { ok:false, msg:'비밀번호는 8자 이상, 영문·숫자·특수문자를 포함해야 합니다.' };
    }
    if(common.password && common.password !== common.password2) return { ok:false, msg:'비밀번호가 일치하지 않습니다.' };
    delete common.password2;
    return await ocAuth.signup(Object.assign({ type:type, extra:extra }, common));
  };

  window.ocAuth = ocAuth;
})();

/* ===== 회원 페이지 UI 향상: 네트워크 배경 · 눈 아이콘 · 비번 가이드 · 캘린더 ===== */
(function(){
  function net(){
    var el=document.getElementById('oc-net'); if(!el||el.dataset.done) return; el.dataset.done='1';
    var W=1280,H=880,N=44,R=178,pts=[],i,a,b;
    for(i=0;i<N;i++) pts.push({x:Math.random()*W,y:Math.random()*H});
    var L=''; for(a=0;a<N;a++) for(b=a+1;b<N;b++){var dx=pts[a].x-pts[b].x,dy=pts[a].y-pts[b].y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<R) L+='<line x1="'+pts[a].x.toFixed(1)+'" y1="'+pts[a].y.toFixed(1)+'" x2="'+pts[b].x.toFixed(1)+'" y2="'+pts[b].y.toFixed(1)+'" style="opacity:'+((1-d/R)*0.55).toFixed(2)+'"/>';}
    var C=''; pts.forEach(function(p){C+='<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(1.4+Math.random()*2.6).toFixed(1)+'" fill="url(#ocdg)"/>';});
    el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="ocdg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9C7FD6"/><stop offset="1" stop-color="#C9A94E"/></linearGradient></defs><g class="ln">'+L+'</g><g class="nd">'+C+'</g></svg>';
  }
  var EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYEOFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18"/><path d="M10.6 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a18 18 0 0 1-3.1 3.9M6.1 6.1A18 18 0 0 0 1 12s4 7 11 7a11 11 0 0 0 3.9-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function eyes(){
    document.querySelectorAll('input[type=password]').forEach(function(inp){
      if(inp.dataset.eye) return; inp.dataset.eye='1';
      var w=document.createElement('span'); w.className='oc-pw-wrap'; inp.parentNode.insertBefore(w,inp); w.appendChild(inp);
      var btn=document.createElement('button'); btn.type='button'; btn.className='oc-eye'; btn.innerHTML=EYE; btn.setAttribute('aria-label','비밀번호 표시');
      w.appendChild(btn);
      btn.addEventListener('click',function(){ var s=inp.type==='password'; inp.type=s?'text':'password'; btn.innerHTML=s?EYEOFF:EYE; });
    });
  }
  function guide(){
    var pw=document.querySelector('input[data-k="password"]'); if(!pw||pw.dataset.guide) return; pw.dataset.guide='1';
    var g=document.createElement('div'); g.className='oc-pw-guide';
    g.innerHTML='<span data-r="len">8자 이상</span><span data-r="alpha">영문</span><span data-r="num">숫자</span><span data-r="spec">특수문자</span>';
    var host=pw.closest('.oc-pw-wrap')||pw; host.parentNode.insertBefore(g, host.nextSibling);
    function set(r,ok){var e=g.querySelector('[data-r="'+r+'"]'); if(e) e.classList.toggle('ok',ok);}
    function upd(){var v=pw.value; set('len',v.length>=8); set('alpha',/[A-Za-z]/.test(v)); set('num',/[0-9]/.test(v)); set('spec',/[^A-Za-z0-9]/.test(v));}
    pw.addEventListener('input',upd); upd();
  }
  function cal(){
    document.querySelectorAll('input[type=date]').forEach(function(inp){
      if(inp.dataset.cal) return; inp.dataset.cal='1';
      inp.type='text'; inp.readOnly=true; inp.classList.add('oc-date'); if(!inp.placeholder) inp.placeholder='YYYY-MM-DD';
      var w=document.createElement('span'); w.className='oc-date-wrap'; inp.parentNode.insertBefore(w,inp); w.appendChild(inp);
      var pop=document.createElement('div'); pop.className='oc-cal'; w.appendChild(pop);
      var now=new Date(), view={y:now.getFullYear()-20,m:now.getMonth()}, sel=null;
      function pad(n){return (n<10?'0':'')+n;}
      function draw(){
        var y=view.y,m=view.m, first=new Date(y,m,1).getDay(), dim=new Date(y,m+1,0).getDate(), yy,mm,d,i;
        var ys=''; for(yy=now.getFullYear();yy>=1930;yy--) ys+='<option'+(yy===y?' selected':'')+'>'+yy+'</option>';
        var ms=''; for(mm=0;mm<12;mm++) ms+='<option value="'+mm+'"'+(mm===m?' selected':'')+'>'+(mm+1)+'월</option>';
        var wd=['일','월','화','수','목','금','토'].map(function(x){return '<span class="wd">'+x+'</span>';}).join('');
        var cells=''; for(i=0;i<first;i++) cells+='<button type="button" class="empty"></button>';
        for(d=1;d<=dim;d++){var iso=y+'-'+pad(m+1)+'-'+pad(d); cells+='<button type="button" data-d="'+iso+'"'+(sel===iso?' class="sel"':'')+'>'+d+'</button>';}
        pop.innerHTML='<div class="oc-cal-head"><button type="button" class="oc-cal-nav" data-nav="-1">‹</button><select class="oc-cal-y">'+ys+'</select><select class="oc-cal-m">'+ms+'</select><button type="button" class="oc-cal-nav" data-nav="1">›</button></div><div class="oc-cal-grid">'+wd+cells+'</div>';
      }
      inp.addEventListener('click',function(e){ e.stopPropagation(); var open=pop.classList.toggle('open'); if(open) draw(); });
      pop.addEventListener('click',function(e){ e.stopPropagation();
        var nav=e.target.closest('[data-nav]'); if(nav){ view.m+=(+nav.getAttribute('data-nav')); if(view.m<0){view.m=11;view.y--;} if(view.m>11){view.m=0;view.y++;} draw(); return; }
        var dd=e.target.closest('[data-d]'); if(dd){ sel=dd.getAttribute('data-d'); inp.value=sel; pop.classList.remove('open'); }
      });
      pop.addEventListener('change',function(e){ if(e.target.classList.contains('oc-cal-y')) view.y=+e.target.value; if(e.target.classList.contains('oc-cal-m')) view.m=+e.target.value; draw(); });
      document.addEventListener('click',function(ev){ if(!w.contains(ev.target)) pop.classList.remove('open'); });
    });
  }
  function email(){
    document.querySelectorAll('input[data-k="email"]').forEach(function(inp){
      if(inp.dataset.emok) return; inp.dataset.emok='1';
      inp.type='hidden';
      var box=document.createElement('div'); box.className='oc-email';
      box.innerHTML='<input type="text" class="inp oc-em-id" placeholder="이메일" autocomplete="off"><span class="oc-em-at">@</span><input type="text" class="inp oc-em-dom" placeholder="직접입력" autocomplete="off"><select class="inp oc-em-sel"><option value="">직접입력</option><option>naver.com</option><option>gmail.com</option><option>daum.net</option><option>hanmail.net</option><option>nate.com</option><option>kakao.com</option><option>outlook.com</option><option>icloud.com</option></select>';
      inp.parentNode.insertBefore(box, inp.nextSibling);
      var idEl=box.querySelector('.oc-em-id'), domEl=box.querySelector('.oc-em-dom'), selEl=box.querySelector('.oc-em-sel');
      function sync(){ var a=idEl.value.trim(), b=domEl.value.trim(); inp.value=(a&&b)?(a+'@'+b):''; }
      selEl.addEventListener('change',function(){ if(selEl.value){ domEl.value=selEl.value; domEl.readOnly=true; } else { domEl.readOnly=false; domEl.value=''; domEl.focus(); } sync(); });
      idEl.addEventListener('input',sync); domEl.addEventListener('input',sync);
    });
  }
  function init(){ net(); eyes(); guide(); cal(); email(); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
