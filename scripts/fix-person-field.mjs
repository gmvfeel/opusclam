/* ============================================================
   OPUSCLAM 인물 분야 다시 판정 — scripts/fix-person-field.mjs
   ------------------------------------------------------------
   왜 필요한가
     인물DB의 「분야」가 잘못 정해진 사람이 있습니다.
     마우리치오 폴리니(피아니스트)가 「작곡」으로 되어 있던 것을
     이용자가 데이터 신고로 알려 주셔서 드러났습니다.

   ★ 무엇을 근거로 고치나 — 소개문입니다
     위키백과 소개문의 첫 문장은 그 사람이 무엇으로 알려졌는지를 말합니다.
       모차르트  「… 오스트리아의 작곡가이다」    → 작곡
       폴리니    「… 이탈리아의 피아니스트이다」  → 연주
     직업 목록(wd_occupation)은 살면서 한 모든 일의 나열이라
     이것으로 판정하면 모차르트가 음악교육자가 됩니다. 실제로 그랬습니다.

   ★ 소개문이 없는 사람은 건드리지 않습니다
     짐작으로 고치느니 그대로 두는 편이 낫습니다.
     (--fill 을 주시면 빈칸인 사람만 직업 목록으로 채웁니다)

   ★ field 칸만 고칩니다
     PATCH 로 그 칸만 보냅니다. 이름·소개·사진은 건드리지 않습니다.

   쓰는 법
     node scripts/fix-person-field.mjs                무엇이 바뀔지만 봅니다
     node scripts/fix-person-field.mjs --list         바뀔 사람을 전부 찍습니다
     node scripts/fix-person-field.mjs --save         실제로 고칩니다
     node scripts/fix-person-field.mjs --only=작곡    지금 값이 '작곡'인 것만
     node scripts/fix-person-field.mjs --fill         분야가 빈칸인 사람도 채웁니다

   필요한 환경변수
     SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { decideField } from './lib/field.mjs';

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
const LIST = !!args.list;
const FILL = !!args.fill;
const ONLY = typeof args.only === 'string' ? args.only : null;

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init, headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다.
   끝냄은 0줄일 때만, offset 은 실제로 받은 수만큼, order 에 id 필수. */
async function getAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await rest(path + '&limit=200&offset=' + off);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    off += rows.length;
    if (rows.length < 200) break;
    if (off % 2000 === 0) process.stdout.write('   읽는 중 ' + off + '명\r');
  }
  return out;
}

function short(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  인물 분야 다시 판정 (소개문 기준)           ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(SAVE ? '\n★ 실제로 고칩니다 (--save)\n'
                   : '\n※ 고치지 않고 무엇이 바뀔지만 봅니다.\n');
  if (FILL) console.log('※ 빈칸인 사람도 채웁니다 (--fill)\n');
  if (ONLY) console.log('※ 지금 값이 「' + ONLY + '」 인 사람만 봅니다\n');

  let path = 'persons?select=id,name_ko,name_en,field,description,description_en,wd_occupation'
           + '&order=id.asc';
  if (ONLY) path += '&field=eq.' + encodeURIComponent(ONLY);

  const rows = await getAll(path);
  console.log('인물 : ' + rows.length + '명        ');

  const change = [];   // 값이 있는데 틀린 것 (소개문 근거만)
  const fill = [];     // 빈칸을 채울 수 있는 것
  const fromCount = new Map();
  let same = 0, noBase = 0, cannot = 0;

  for (const p of rows) {
    const d = decideField(p);
    const cur = (p.field == null ? '' : String(p.field)).trim();

    if (!d.field) { cannot++; continue; }
    fromCount.set(d.from, (fromCount.get(d.from) || 0) + 1);

    if (!cur) { fill.push({ ...p, to: d.field, from: d.from }); continue; }
    if (d.field === cur) { same++; continue; }

    /* ★ 이미 값이 있는 사람은 소개문 근거가 있을 때만 고칩니다.
       직업 목록만으로 고치면 모차르트가 음악교육자가 됩니다. */
    if (d.from === '직업목록') { noBase++; continue; }

    change.push({ ...p, to: d.field, from: d.from });
  }

  console.log('\n── 다시 판정한 결과 ──');
  console.log('   그대로              : ' + same + '명');
  console.log('   ★ 바뀔 것          : ' + change.length + '명   (소개문에 근거가 있는 것만)');
  console.log('   빈칸을 채울 수 있음  : ' + fill.length + '명' + (FILL ? '  (함께 고칩니다)' : '  (--fill 을 주시면 함께)'));
  console.log('   근거가 없어 그냥 둠  : ' + noBase + '명   (소개문이 없어 확신할 수 없습니다)');
  console.log('   정할 수 없음        : ' + cannot + '명');

  console.log('\n── 무엇을 보고 정했나 ──');
  [...fromCount.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(6) + '  ' + k));

  const pair = new Map();
  for (const c of change) {
    const k = (c.field || '(빈칸)') + ' → ' + c.to;
    pair.set(k, (pair.get(k) || 0) + 1);
  }
  if (pair.size) {
    console.log('\n── 어떻게 바뀌나 ──');
    [...pair.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([k, v]) => console.log('   ' + String(v).padStart(6) + '  ' + k));
  }

  /* ★ 로그가 너무 길면 파트너가 확인할 수 없습니다.
     기본은 40명만 보여 주고, 전부 보시려면 --list 를 주십시오. */
  if (change.length) {
    const show = LIST ? change.length : Math.min(40, change.length);
    console.log('\n── ' + (LIST ? '바뀔 사람 전부' : '표본 ' + show + '명') + ' ──');
    if (!LIST && change.length > show) {
      console.log('   ※ 전부 보시려면 --list 를 주십시오 (로그가 길어집니다).');
    }
    change.slice(0, show).forEach((c, i) => {
      console.log('   ' + String(i + 1).padStart(4) + '. '
        + (c.name_ko || c.name_en || ('#' + c.id))
        + '   ' + (c.field || '(빈칸)') + ' → ' + c.to + '   [' + c.from + ']');
      console.log('         ' + short(c.description || c.description_en, 90));
    });
  }

  const todo = FILL ? change.concat(fill) : change;

  if (!SAVE) {
    console.log('\n※ 아무것도 고치지 않았습니다.');
    console.log('  ' + todo.length + '명을 고치시려면 --save 를 주십시오.');
    return;
  }
  if (!todo.length) {
    console.log('\n고칠 것이 없습니다.');
    return;
  }

  /* 울타리 — 한 번에 너무 많이 바뀌면 멈춥니다 */
  if (todo.length > rows.length * 0.6) {
    console.error('\n★ 멈췄습니다 — 전체의 60%가 넘는 ' + todo.length + '명이 바뀝니다.');
    console.error('  규칙이 잘못됐을 수 있습니다. 사람이 먼저 확인해 주십시오.');
    process.exit(1);
  }

  console.log('\n── 고치는 중 ──');
  let ok = 0, ng = 0;
  for (const c of todo) {
    try {
      /* ★ field 칸만 보냅니다. */
      await rest('persons?id=eq.' + c.id, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ field: c.to })
      });
      ok++;
    } catch (e) {
      ng++;
      if (ng <= 20) {
        console.log('   [실패] #' + c.id + ' ' + (c.name_ko || '') + ' — ' + short(e.message, 100));
      }
    }
    if (ok % 100 === 0) process.stdout.write('   ' + ok + '/' + todo.length + '\r');
  }
  console.log('   끝 · 고침 ' + ok + '명 · 실패 ' + ng + '명        ');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
