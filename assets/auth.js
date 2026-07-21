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

  window.ocAuth = ocAuth;
})();
