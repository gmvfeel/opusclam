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
      if(el.offsetParent === null) return;
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
    if(common.password && common.password !== common.password2) return { ok:false, msg:'비밀번호가 일치하지 않습니다.' };
    delete common.password2;
    return await ocAuth.signup(Object.assign({ type:type, extra:extra }, common));
  };

  window.ocAuth = ocAuth;
})();
