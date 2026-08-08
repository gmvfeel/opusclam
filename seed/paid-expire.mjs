/* ============================================================
   OPUSCLAM · 유료 등재 기간 만료 정리 — seed/paid-expire.mjs
   ------------------------------------------------------------
   무엇을 하나
     게재 기간(paid_until)이 지난 콩쿨 공고의 상단 고정을 풉니다.
     DB 함수 oc_paid_expire() 를 부르기만 합니다 — 판단은 전부 DB 가 합니다.

   ★ 손으로 고정해 두신 무료 공지는 건드리지 않습니다.
     함수 조건에 paid_plan is not null 이 들어 있습니다.

   ★ 공고 자체는 지우지 않습니다.
     고정만 풀리고, 무료 공고로 목록에 그대로 남습니다.

   쓰는 법
     node seed/paid-expire.mjs          확인만 (아무것도 바꾸지 않습니다)
     node seed/paid-expire.mjs --save   실제로 정리합니다

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY  (또는 SUPABASE_SERVICE_KEY)
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const SAVE = !!args.save;

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init,
    headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  console.log('── 유료 등재 만료 정리 ' + (SAVE ? '(실제로 정리합니다)' : '(확인만 합니다)') + ' ──');

  const today = ymd(Date.now());

  /* 1) 지금 게재 중인 것 */
  const live = await rest(
    'spot?select=id,title,paid_plan,paid_from,paid_until'
    + '&paid_plan=not.is.null&order=paid_until.asc,id.asc&limit=200'
  );
  console.log('\n지금 게재 중 : ' + live.length + '건');
  for (const s of live) {
    const over = s.paid_until && s.paid_until < today;
    console.log(
      '  ' + (over ? '[기간 끝남] ' : '[게재 중]   ')
      + '#' + s.id + '  ' + (s.title || '').slice(0, 40)
      + '  (' + s.paid_plan + ' · ~' + (s.paid_until || '?') + ')'
    );
  }

  const due = live.filter(s => s.paid_until && s.paid_until < today);
  console.log('\n오늘 내려야 할 것 : ' + due.length + '건');

  if (!due.length) {
    console.log('내릴 것이 없습니다. 끝냅니다.');
    return;
  }

  if (!SAVE) {
    console.log('\n※ 확인만 했습니다. 실제로 내리려면 --save 를 붙여 주십시오.');
    return;
  }

  /* 2) 정리 — 판단은 DB 함수가 합니다 */
  const n = await rest('rpc/oc_paid_expire', { method: 'POST', body: '{}' });
  console.log('\n내렸습니다 : ' + n + '건');

  /* 3) 확인 */
  const after = await rest(
    'spot?select=id,title,is_pinned,paid_plan&paid_plan=not.is.null&limit=200'
  );
  console.log('남은 게재 중 : ' + after.length + '건');
}

main().catch(e => {
  console.error('실패했습니다 :', e.message || e);
  process.exit(1);
});
