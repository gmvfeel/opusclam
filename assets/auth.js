/* i18n 이 없을 때를 위한 폴백 — 언어를 붙이지 못해도 이동은 됩니다 */
if (typeof window.ocGo !== 'function') { window.ocGo = function (u, r) { if (r) location.replace(u); else location.href = u; }; }
/* ══════════════════════════════════════════════════════════════
   생년월일 — <b>고르는 상자 세 개</b>로                2026-08-05
   window.OCBirth

   ★ 왜 만드나 (파트너 지적)
     input type="date" 의 달력은 <b>우리가 그리는 것이 아니라 브라우저가
     그립니다.</b> 그래서 브라우저마다 모양이 다르고, 어두운 화면에서는
     흐트러져 보입니다. 시안(07_인스트럭터신청)도 「선택 / 선택 / 선택」
     세 개입니다 — 브라우저에 맡기지 않으면 어디서나 같게 보입니다.

   ★ 같은 결함이 <b>네 화면</b>에 있었습니다 —
       account/profile.html · join-major · join-industry · join-general
     화면마다 따로 고치면 하나를 빠뜨립니다. 그래서 <b>여기 한 곳</b>에
     두고 네 화면이 함께 씁니다. auth.js 는 그 넷이 모두 싣습니다.

   쓰는 법
     OCBirth.mount(자리요소, 지금값)   →  상자 셋을 그 자리에 놓습니다
     OCBirth.get(자리요소)             →  'YYYY-MM-DD' 또는 null
     OCBirth.set(자리요소, 값)         →  값을 셋에 나눠 넣습니다

   ★ <b>날 수를 달마다 다시 셉니다</b> — 2월은 29일까지, 4월은 30일까지.
     그러지 않으면 「2월 31일」을 고를 수 있고 저장할 때 오류가 납니다.
     윤년도 저절로 셈합니다(그 달의 0일 = 앞 달 마지막 날).
   ══════════════════════════════════════════════════════════════ */
(function(){
  if (window.OCBirth) return;

  function sel(cls, label){
    var s = document.createElement('select');
    s.className = cls || '';
    s.setAttribute('aria-label', label || '');
    return s;
  }
  function fill(el, list, keep){
    var h = '<option value="">선택</option>';
    list.forEach(function(o){ h += '<option value="'+o[0]+'">'+o[1]+'</option>'; });
    el.innerHTML = h;
    if (keep) el.value = keep;
  }
  function lastDay(y, m){
    if (!m) return 31;
    return new Date(y || 2000, m, 0).getDate();   /* 0일 = 앞 달 마지막 날 */
  }

  /* 자리요소 안에 상자 셋을 놓습니다.
     ★ 상자에 붙이는 class 는 <b>화면이 정합니다</b> — 화면마다 입력칸
       모양이 달라서(inp · ln-select …) 여기서 못박으면 어긋납니다. */
  function mount(host, value, opt){
    if (!host) return null;
    opt = opt || {};
    var cls = opt.cls || '';
    var wrap = document.createElement('div');
    wrap.className = opt.rowCls || 'oc-birth';
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.flexWrap = 'wrap';

    var Y = sel(cls, '태어난 해'), M = sel(cls, '태어난 달'), D = sel(cls, '태어난 날');
    Y.style.flex = '0 0 110px'; M.style.flex = '0 0 92px'; D.style.flex = '0 0 92px';
    wrap.appendChild(Y); wrap.appendChild(M); wrap.appendChild(D);

    var now = new Date().getFullYear();
    var years = [];
    var from = now - (opt.minAge == null ? 10 : opt.minAge);
    for (var y = from; y >= (opt.oldest || 1930); y--) years.push([y, y]);
    fill(Y, years);

    var months = [];
    for (var m = 1; m <= 12; m++) months.push([m, m + '월']);
    fill(M, months);

    function days(){
      var keep = D.value, last = lastDay(parseInt(Y.value,10), parseInt(M.value,10));
      var list = [];
      for (var d = 1; d <= last; d++) list.push([d, d + '일']);
      fill(D, list, (keep && parseInt(keep,10) <= last) ? keep : '');
    }
    Y.addEventListener('change', days);
    M.addEventListener('change', days);
    days();

    host.innerHTML = '';
    host.appendChild(wrap);
    host._ocBirth = { Y:Y, M:M, D:D, days:days };
    if (value) set(host, value);
    return host._ocBirth;
  }

  function get(host){
    var b = host && host._ocBirth; if (!b) return null;
    var y = b.Y.value, m = b.M.value, d = b.D.value;
    if (!y || !m || !d) return null;
    return y + '-' + ('0'+m).slice(-2) + '-' + ('0'+d).slice(-2);
  }

  function set(host, v){
    var b = host && host._ocBirth; if (!b || !v) return;
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return;
    b.Y.value = String(parseInt(m[1],10));
    b.M.value = String(parseInt(m[2],10));
    b.days();                                   /* 달을 정한 뒤 날 수를 다시 셉니다 */
    b.D.value = String(parseInt(m[3],10));
  }

  /* ── [data-birth] 자리에 상자 셋을 <b>저절로</b> 놓습니다 ────────
     ★ 가입 화면 셋은 각자 코드를 두지 않습니다 — 화면에 자리만 두면
       여기서 채웁니다. 화면마다 적으면 하나를 빠뜨립니다.
     ★ 상자에 붙일 class 는 화면이 data-cls 로 알려 줍니다(없으면 inp).
       화면마다 입력칸 모양이 달라서(inp · ln-select …) 여기서 못박으면
       어긋납니다. */
  function autoMount(){
    var list = document.querySelectorAll('[data-birth]');
    for (var i = 0; i < list.length; i++){
      var host = list[i];
      if (host._ocBirth) continue;
      mount(host, host.getAttribute('data-value') || '',
            { cls: host.getAttribute('data-cls') || 'inp' });
    }
  }
  if (document.readyState !== 'loading') autoMount();
  else document.addEventListener('DOMContentLoaded', autoMount);

  window.OCBirth = { mount: mount, get: get, set: set, autoMount: autoMount };
})();

/* 테마(다크/화이트) 토글 — .theme-toggle 클릭 시 전환, localStorage 저장 */
(function(){
  try{ if(localStorage.getItem('oc-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); }catch(e){}
  function ready(){
    /* ★ assets/header.js 가 이미 잡았으면 여기서는 잡지 않습니다 (2026-08-05)
       두 곳이 함께 걸리면 <b>두 번 뒤집혀 그대로</b>가 되어
       「눌러도 안 바뀐다」 가 됩니다. */
    if (window.__ocThemeBound) return;
    window.__ocThemeBound = true;
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
      /* ★ 화면 전체에 하나만 둡니다 (window.__ocSb).
         여러 개 만들면 「Multiple GoTrueClient instances」 경고가 뜨고
         세션 토큰이 질의에 안 실리는 일이 생깁니다. */
      if(!window.__ocSb) window.__ocSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      _sb = window.__ocSb;
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
      var email;
      if(username.indexOf('@') >= 0){ email = username; }
      else {
        var er = await c.rpc('email_for_username', { p_username: username });
        email = er && er.data;
        if(!email) return { ok:false, msg:'아이디 또는 비밀번호를 확인해 주세요.' };
      }
      var r = await c.auth.signInWithPassword({ email: email, password: password });
      if(r.error) return { ok:false, msg:'아이디 또는 비밀번호를 확인해 주세요.' };
      var me = await c.from('members').select('status').eq('id', r.data.user.id).single();
      if(me && me.data && me.data.status === 'withdrawn'){ await c.auth.signOut(); return { ok:false, msg:'탈퇴한 계정입니다. 재가입하시거나 고객센터로 문의해 주세요.' }; }

      /* ★ 오늘 첫 로그인이면 <b>활동점수</b>를 줍니다. (2026-08-04)

         왜 화면에서 부르나
           로그인은 <b>트리거로 잡을 수 없습니다</b> — auth 쪽 일이라
           우리 표에 아무 줄도 담기지 않습니다. 그래서 여기서 부릅니다.

         ★ 하루 한 번만 오릅니다 — point_rules 의 per_day=1 이 막으므로
           여러 번 불러도 괜찮습니다.
         ★ <b>기다리지 않습니다.</b> 점수 주기가 늦어도 로그인은 끝나야
           합니다. 실패해도 로그인을 막지 않습니다.
         ★ 연속 7일이면 100점을 더 줍니다(서버가 셉니다). */
      try {
        c.rpc('oc_daily_login').then(function(){}, function(){});
      } catch (e) { /* 함수가 아직 없어도 로그인은 됩니다 */ }

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
      ocGo('/home.html');
    },

    /* 비밀번호 재설정 메일 발송 */
    sendPasswordReset: async function(email){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var r = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/account/reset-password.html' });
      if(r.error) return { ok:false, msg: r.error.message || '메일 발송 오류' };
      return { ok:true };
    },

    /* 새 비밀번호로 변경 (재설정 링크로 들어온 세션에서) */
    verifyCurrentPassword: async function(currentPw){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var sr = await c.auth.getUser();
      var email = sr && sr.data && sr.data.user && sr.data.user.email;
      if(!email) return { ok:false, msg:'로그인이 필요합니다.' };
      var r = await c.auth.signInWithPassword({ email: email, password: currentPw });
      if(r.error) return { ok:false, msg:'현재 비밀번호가 일치하지 않습니다.' };
      return { ok:true };
    },
    updatePassword: async function(newPw){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var r = await c.auth.updateUser({ password: newPw });
      if(r.error) return { ok:false, msg: r.error.message || '변경 오류' };
      return { ok:true };
    },

    /* 아이디 찾기/가입확인용: 가입된 이메일에만 본인확인 링크 발송 */
    sendLoginLink: async function(email, redirectPath){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var r = await c.auth.signInWithOtp({ email: email, options: { shouldCreateUser:false, emailRedirectTo: location.origin + (redirectPath || '/account/mypage.html') } });
      if(r.error) return { ok:false, msg: r.error.message };
      return { ok:true };
    },

    /* 회원 탈퇴: 본인 계정을 '탈퇴' 상태로 표시하고 로그아웃 */
    withdraw: async function(){
      var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
      var r = await c.rpc('withdraw_me');
      if(r.error) return { ok:false, msg: r.error.message };
      await c.auth.signOut();
      return { ok:true };
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
      /* ★ 생년월일은 <b>고르는 상자 셋</b>입니다 (2026-08-05)
         담는 요소가 &lt;div&gt; 라서 el.value 가 없습니다. 그대로 두면
         빈 값이 들어가 생년월일이 <b>저장되지 않습니다.</b>
         OCBirth 가 셋을 합쳐 'YYYY-MM-DD' 로 줍니다. */
      if(el.hasAttribute('data-birth')){
        var bv = (window.OCBirth ? (OCBirth.get(el) || '') : '');
        el.style.borderColor = '';
        if(el.hasAttribute('data-req') && !bv){ missing = true; el.style.outline = '1px solid #f2777a'; }
        else { el.style.outline = ''; }
        if(CK.indexOf(k) >= 0) common[k] = bv; else if(bv) extra[k] = bv;
        return;
      }
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
    if(!common.name){
      if(extra.company) common.name = extra.company;             // 단체·기업 → 단체명
      else if(extra.school_name) common.name = extra.school_name; // 음악학교 → 학교명
    }
    return await ocAuth.signup(Object.assign({ type:type, extra:extra }, common));
  };

  /* 관리자: 내 회원정보 / 회원목록 / 상태변경 */
  ocAuth.myMember = async function(){
    var c = sb(); if(!c) return null;
    var u = await c.auth.getUser(); var uid = u && u.data && u.data.user && u.data.user.id; if(!uid) return null;
    var r = await c.from('members').select('*').eq('id', uid).maybeSingle();
    return r.data || null;
  };
  ocAuth.listMembers = async function(status){
    var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
    var q = c.from('members').select('id,username,member_type,status,name,email,phone,created_at,extra').order('created_at', { ascending:false });
    if(status) q = q.eq('status', status);
    var r = await q; if(r.error) return { ok:false, msg:r.error.message };
    return { ok:true, rows:r.data || [] };
  };
  ocAuth.setMemberStatus = async function(id, status){
    var c = sb(); if(!c) return { ok:false, msg:'초기화 오류' };
    var r = await c.from('members').update({ status:status }).eq('id', id);
    if(r.error) return { ok:false, msg:r.error.message };
    return { ok:true };
  };

  window.ocAuth = ocAuth;
})();

/* ===== 회원 페이지 UI 향상: 네트워크 배경 · 눈 아이콘 · 비번 가이드 · 캘린더 ===== */
(function(){
  function net(){
    /* 네트워크 배경은 회원 페이지 전용. 이 배경을 꾸며주는 auth.css 가
       로드된 페이지에서만 그린다. (auth.js 만 쓰는 게시판 등 다른 페이지에
       점 덩어리가 잘못 끼어드는 것을 방지) */
    if(!document.querySelector('link[href*="auth.css"]')) return;
    /* ★ <b>무늬를 쓰지 않는 화면</b>은 건너뜁니다 (2026-08-05 · 파트너 지시)
       마이페이지가 대시보드가 되면서 카드가 화면을 가득 채웁니다. 그
       뒤로 별자리 무늬가 비쳐 어수선했습니다.
       &lt;html data-no-net&gt; 를 달아 둔 화면에서는 그리지 않습니다.
     ★ 이 파일이 무늬를 <b>스스로 만들어 붙이므로</b>, 화면에서 &lt;div&gt; 만
       지워서는 없어지지 않습니다 — 반드시 이 관문이 있어야 합니다. */
    if(document.documentElement.hasAttribute('data-no-net')) return;
    var el=document.getElementById('oc-net');
    if(!el){ el=document.createElement('div'); el.id='oc-net'; el.className='oc-net'; el.setAttribute('aria-hidden','true'); document.body.insertBefore(el, document.body.firstChild); }
    if(el.dataset.done) return; el.dataset.done='1';
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
  /* ── 전체메뉴 ──────────────────────────────────────────────
     ★ 무엇이 잘못됐었나 (2026-08-05 · 파트너 지적)
       회원 헤더의 「전체메뉴」 단추가 <b>아무것에도 이어져 있지</b>
       않았습니다. 눌러도 아무 일이 없었습니다.

     ★ 처음에는 오른쪽 서랍을 새로 만들었는데, 파트너님 말씀대로
       그것은 <b>모바일 결</b>이었습니다. 메인의 <b>PC 전체메뉴</b>와
       같아야 맞습니다.

     ★ 그래서 <b>메뉴를 새로 적지 않습니다.</b> 메인 헤더 파일
       (partials/header.html)에 이미 있는 #fullMenu 를 <b>그대로 가져와</b>
       씁니다. 메뉴가 바뀌면 그 파일 한 곳만 고치면 양쪽에 반영됩니다.
       (목록을 두 곳에 적으면 반드시 한 곳을 빠뜨립니다)

     ★ 여는 방법도 메인과 같습니다 (assets/header.js 와 같은 짜임) —
       .open 을 붙이고, [data-fm-close] · 메뉴 링크 · Esc 로 닫습니다.
     ★ 꾸미는 규칙(.fullmenu*)은 style.css 에 있습니다. 회원 화면도
       그 파일을 싣습니다.
     ★ 한 번 가져오면 담아 둡니다 — 두 번 받아 오지 않습니다. */
  var fmBox = null, fmLoading = false;

  function fmSet(open){
    if (!fmBox) return;
    fmBox.classList.toggle('open', !!open);
    document.body.style.overflow = open ? 'hidden' : '';
    var b = document.querySelector('.gnb .burger');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function fmWire(){
    if (!fmBox) return;
    fmBox.querySelectorAll('[data-fm-close]').forEach(function(el){
      el.addEventListener('click', function(){ fmSet(false); });
    });
    fmBox.querySelectorAll('.fm-col a').forEach(function(a){
      a.addEventListener('click', function(){ fmSet(false); });
    });
    /* 헤더 로고를 전체메뉴에도 씁니다 (메인과 같은 처리) */
    var hdr = document.querySelector('.gnb .logo img');
    var fml = fmBox.querySelector('.fm-logo');
    if (hdr && fml) fml.src = hdr.src;
  }

  /* ★ 전체메뉴의 꾸미는 규칙(.fullmenu*)은 <b>style.css</b> 에 있습니다.
     그런데 마이페이지 · 로그인 · 가입은 그 파일을 싣지 않습니다.
     안 싣고 마크업만 붙이면 <b>꾸밈 없는 링크 뭉치</b>가 쏟아집니다.
     그래서 필요할 때(처음 여는 그때) 한 번만 싣습니다.

   ★ <b>auth.css 바로 앞에</b> 끼웁니다 — 순서가 중요합니다.
     뒤에 붙이면 style.css 가 auth.css 를 이겨 회원 화면 꾸밈이
     흐트러집니다. 회원정보 수정 화면이 이미 「style.css → auth.css」
     순서로 잘 돌고 있으니 그 순서를 그대로 따릅니다.
   ★ 규칙을 <b>베껴 적지 않습니다</b> — 한 곳(style.css)만 고치면 됩니다. */
  function fmNeedCss(){
    if (document.querySelector('link[href="/style.css"]')) return Promise.resolve();
    var auth = document.querySelector('link[href*="auth.css"]');
    if (!auth || !auth.parentNode) return Promise.resolve();
    return new Promise(function(done){
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '/style.css';
      l.onload = function(){ done(); };
      l.onerror = function(){ done(); };
      auth.parentNode.insertBefore(l, auth);
      /* 혹시 load 가 오지 않아도 오래 기다리지 않습니다 */
      setTimeout(done, 1500);
    });
  }

  async function fmLoad(){
    if (fmBox || fmLoading) return;
    fmLoading = true;
    try {
      await fmNeedCss();
      var r = await fetch('/partials/header.html', { cache: 'force-cache' });
      var html = await r.text();
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var fm = tmp.querySelector('#fullMenu');
      if (!fm) { fmLoading = false; return; }
      document.body.appendChild(fm);
      fmBox = fm;
      fmWire();
    } catch (e) { /* 못 가져오면 아무 일도 하지 않습니다 */ }
    fmLoading = false;
  }

  function fullmenu(){
    if (window.__ocFmBound) return;
    window.__ocFmBound = true;

    document.addEventListener('click', async function(e){
      var b = e.target.closest && e.target.closest('.gnb .burger');
      if (!b) return;
      e.preventDefault();
      if (!fmBox) await fmLoad();
      if (!fmBox) return;
      fmSet(!fmBox.classList.contains('open'));
    });

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && fmBox && fmBox.classList.contains('open')) fmSet(false);
    });
  }

  function init(){ net(); eyes(); guide(); cal(); email(); fullmenu(); }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();

/* ===== 이미 로그인한 상태로 로그인/가입/찾기 페이지 접근 시 안내 배너 ===== */
(function(){
  "use strict";
  // 배너를 띄울 '비로그인 전용' 페이지들 (완료/결과/마이페이지/재설정은 제외)
  var GUEST_PAGES = ['/account/login.html','/account/join.html','/account/join-general.html','/account/join-major.html','/account/join-industry.html','/account/join-school.html','/account/join-consent.html','/account/find-id.html','/account/find-pw.html','/account/join-check.html'];
  function pageMatch(){
    var p = location.pathname;
    for(var i=0;i<GUEST_PAGES.length;i++){ if(p === GUEST_PAGES[i] || p.slice(-GUEST_PAGES[i].length) === GUEST_PAGES[i]) return true; }
    return false;
  }
  function showBanner(name){
    if(document.getElementById('oc-guest-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'oc-guest-bar';
    bar.setAttribute('style','position:relative;z-index:2;background:var(--tagbg,#f3eefb);border-bottom:1px solid var(--line2,#dedbe4);color:var(--tx,#1a1a2e);padding:12px 20px;text-align:center;font-size:13px;line-height:1.6;');
    bar.innerHTML = '이미 <strong>'+name+'</strong>님으로 로그인되어 있습니다. '
      + '<a href="/account/mypage.html" style="color:var(--navh,#EC7A1C);font-weight:700;text-decoration:underline;margin:0 4px;">마이페이지</a>'
      + '<a href="#" id="oc-guest-logout" style="color:var(--tx3,#8a8a9a);text-decoration:underline;margin-left:8px;">로그아웃</a>';
    var gnb = document.querySelector('.gnb');
    if(gnb && gnb.parentNode) gnb.parentNode.insertBefore(bar, gnb.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
    var lo = document.getElementById('oc-guest-logout');
    if(lo) lo.addEventListener('click', function(e){ e.preventDefault(); if(window.ocAuth && window.ocAuth.logout) window.ocAuth.logout(); });
  }
  function check(){
    if(!pageMatch()) return;
    if(!window.ocAuth || !window.ocAuth.session) return;
    window.ocAuth.session().then(function(s){
      if(!s) return;
      if(window.ocAuth.myMember){
        window.ocAuth.myMember().then(function(m){
          var name = (m && (m.name || m.username)) || (s.user && s.user.email) || '회원';
          showBanner(name);
        }, function(){ showBanner('회원'); });
      } else { showBanner('회원'); }
    });
  }
  if(document.readyState !== 'loading') check(); else document.addEventListener('DOMContentLoaded', check);
})();


/* ── INNER SPACE 를 필요할 때만 싣습니다 ───────────────────────
   ★ 로그인한 사람에게만 필요합니다. 비로그인 화면에서는 헛되게 받아
     오지 않습니다.
   ★ 한 번만 싣습니다.
 */
function needInnerSpace() {
  if (window.__ocInnerJs) return;
  window.__ocInnerJs = true;
  var sc = document.createElement('script');
  /* ★ <b>캐시를 무력화</b>합니다 (2026-08-04 · 파트너님 화면에서 옛 파일이
       실렸습니다). 브라우저와 Vercel 이 파일을 담아 두므로, 고쳐도
       옛 것이 돌 수 있습니다. 날짜를 붙이면 <b>날마다 한 번</b>은
       새로 받아 옵니다 — 매번 받으면 느려지니 그 정도가 알맞습니다. */
    var v = new Date().toISOString().slice(0,10).replace(/-/g,"");
    sc.src = '/assets/inner-space.js?v=' + v;
  sc.onerror = function () { /* 못 받아도 화면은 그대로 돕니다 */ };
  document.head.appendChild(sc);
}
/* ===== 회원 페이지 헤더(.authlink) 로그인 상태 반영 ===== */
(function(){
  "use strict";
  var TYPE = {major:'전공자',industry:'음악관계자',org:'단체·기업',school:'음악학교',general:'일반'};
  function esc(str){ var d=document.createElement('div'); d.textContent=(str==null?'':String(str)); return d.innerHTML; }
  function updateAuthlink(){
    var al = document.querySelector('.authlink');
    if(!al || !window.ocAuth || !window.ocAuth.session) return;
    window.ocAuth.session().then(function(s){
      if(!s) return; // 비로그인: 기존 '로그인 / 회원가입' 그대로 둠
      function paint(name, typeLabel){
        /* ★ <b>이너스페이스</b>를 놓습니다 (2026-08-04)
           이름을 누르면 마이페이지로 가고, 「이너스페이스」 를 누르면
           <b>화면 위에 패널</b>이 열립니다 — 시안의 그 자리입니다.
           ★ 그 파일을 스스로 싣습니다 — 화면마다 넣으면 빠뜨립니다. */
        /* ★ <b>이너스페이스를 놓지 않는 화면</b> (2026-08-05 · 파트너 지시)
             /account/mypage.html    마이페이지가 곧 이너스페이스의 「자세한 판」
             /account/profile.html   회원정보 수정 — 일 하는 화면입니다
             /account/interests.html 관심분야 관리 — 일 하는 화면입니다
           같은 것을 두 번 두면 어수선하고, 무엇을 고치던 중에 패널이
           열리면 흐름이 끊깁니다. 여기서 걸러 두면 <b>깜빡임도 없습니다.</b>

         ★ 목록을 <b>여기 한 곳</b>에 두고 창에 얹어 둡니다 —
           assets/inner-space.js 도 이것을 보고 스스로 물러납니다.
           두 곳에 적으면 반드시 한 곳을 빠뜨립니다. */
        window.OC_NO_INNER = [
          '/account/mypage.html',
          '/account/profile.html',
          '/account/interests.html'
        ];
        var noInner = window.OC_NO_INNER.indexOf((window.ocPath||String)(location.pathname)) >= 0;  /* ★ 언어를 떼고 견줍니다 */

        /* ★ 이름 옆 「마이페이지」 표시 — assets/app.js 와 같은 모양입니다.
           currentColor 라 어느 헤더에서든 색이 따라옵니다. */
        var MYTAG = '<i style="font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.04em;margin-left:6px;padding:2px 6px;border-radius:4px;border:1px solid currentColor;opacity:.7;vertical-align:1px">마이페이지</i>';

        /* ★ 회원 종류 (일반) 를 뗐습니다 — assets/app.js 와 같은 까닭 */
        al.innerHTML = '<a href="/account/mypage.html">'+esc(name)+'님'+MYTAG+'</a> '
          + (noInner ? '' : '<a href="#" data-oc-inner="1" id="oc-hdr-inner">이너스페이스</a> ')
          + '<a href="#" id="oc-hdr-logout">로그아웃</a>';
        if (!noInner) needInnerSpace();
        var lo = document.getElementById('oc-hdr-logout');
        if(lo) lo.addEventListener('click', function(e){ e.preventDefault(); if(window.ocAuth.logout) window.ocAuth.logout(); });
      }
      if(window.ocAuth.myMember){
        window.ocAuth.myMember().then(function(m){
          var name = (m && (m.name || m.username)) || (s.user && s.user.email) || '회원';
          paint(name, (m && TYPE[m.member_type]) || '');
        }, function(){ paint('회원',''); });
      } else { paint('회원',''); }
    });
  }
  if(document.readyState !== 'loading') updateAuthlink(); else document.addEventListener('DOMContentLoaded', updateAuthlink);
})();

/* ===== 탈퇴 회원 공통 차단 (이메일·소셜 등 모든 로그인 경로) ===== */
(function(){
  "use strict";
  function check(){
    if(!window.ocAuth || !window.ocAuth.session || !window.ocAuth.myMember) return;
    window.ocAuth.session().then(function(s){
      if(!s) return;
      window.ocAuth.myMember().then(function(m){
        if(m && m.status === 'withdrawn'){
          alert('탈퇴한 계정입니다. 재가입을 원하시면 고객센터(cser@wixon.co.kr)로 문의해 주세요.');
          if(window.ocAuth.logout) window.ocAuth.logout();
        }
      }, function(){ /* 조회 실패 시 무시 */ });
    });
  }
  if(document.readyState !== 'loading') check(); else document.addEventListener('DOMContentLoaded', check);
  /* ── 소셜 로그인·이미 로그인된 채 들어온 경우 ─────────────────
     ★ 소셜 로그인은 화면이 <b>다른 곳을 다녀와서</b> 돌아옵니다.
       그때는 위의 login() 을 지나지 않으므로 점수가 안 오릅니다.
     ★ 그래서 화면이 열릴 때 로그인해 있으면 한 번 부릅니다.
       하루 한 번만 오르므로 여러 화면을 돌아다녀도 괜찮습니다.
     ★ 한 화면에서 두 번 부르지 않게 표시를 남깁니다. */
  (function ocLoginPoint(){
    if (window.__ocLoginPointDone) return;
    window.__ocLoginPointDone = true;   /* oc-login-point */

    /* ★ sb() 대신 <b>window.__ocSb</b> 를 봅니다.
       sb() 는 supabase-js 가 없으면 콘솔에 오류를 적고 null 을 돌려주고,
       아직 아무도 부르지 않은 화면에서는 객체를 <b>새로 만들게</b> 되어
       「GoTrueClient 가 여러 개」 경고가 날 수 있습니다.
       이미 만들어진 것이 있을 때만 씁니다.

     ★ <b>여러 번 다시 봅니다.</b>
       한 번만 보면 그때 아직 __ocSb 가 없는 화면(메인 등)에서는
       그냥 지나갑니다 — 화면마다 Supabase 를 만드는 때가 다릅니다.
       0.8초마다 최대 12번(약 10초) 살펴보고, 찾으면 한 번 부르고 그칩니다. */
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      var c = window.__ocSb;
      if (!c || !c.auth || !c.rpc) {
        if (tries >= 12) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      c.auth.getSession().then(function(g){
        if (!(g && g.data && g.data.session)) return;
        var q = c.rpc('oc_daily_login');
        /* ★ 오류를 <b>조용히 먹지 않습니다.</b> 앞서 try/catch 로
           감싸 두었더니 왜 안 되는지 알 수 없었습니다.
           콘솔에만 적고 화면은 그대로 둡니다. */
        if (q && q.then) q.then(function(){}, function(e){
          console.warn('[auth] 로그인 포인트를 주지 못했습니다:', e && e.message);
        });
      }, function(){});
    }, 800);
  })();

})();
