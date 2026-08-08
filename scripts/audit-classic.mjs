/* ============================================================
   OPUSCLAM 담긴 자료 클래식 재검사 — scripts/audit-classic.mjs
   ------------------------------------------------------------
   지금 담긴 자료를 <b>새 잣대</b>로 다시 봅니다.
   판정 규칙은 scripts/lib/classic.mjs 한 곳에만 있습니다.

   ★ 첫 실행은 아무것도 지우지 않습니다 (기본값)
     무엇이 걸리는지 숫자와 표본으로 보여만 줍니다.

   ★ --hide 를 주면 <b>지우지 않고 감춥니다</b>
     hidden = true 로 바꿀 뿐이라 언제든 되돌릴 수 있습니다.
     지우는 것은 되돌릴 수 없으므로 이 도구는 지우지 않습니다.

   쓰는 법
     node scripts/audit-classic.mjs                    전부 살펴보기
     node scripts/audit-classic.mjs --table=persons    한 표만
     node scripts/audit-classic.mjs --list             걸린 것 전부 찍기
     node scripts/audit-classic.mjs --hide             걸린 것 감추기
     node scripts/audit-classic.mjs --unhide           감춘 것 되돌리기

   필요한 환경변수
     SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

import { checkClassic } from './lib/classic.mjs';

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
const LIST   = !!args.list;
const HIDE   = !!args.hide;
const UNHIDE = !!args.unhide;
const ONLY   = typeof args.table === 'string' ? args.table : null;

const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

/* ── 살펴볼 표 ─────────────────────────────────────────────
   ★ 클래식 여부를 물을 수 있는 자료(장르·직업이 있는 것)만 넣었습니다.
     공연장·학교는 「클래식 음악인인가」를 물을 대상이 아니므로 뺐습니다. */
const TABLES = [
  { name: 'persons',          label: '인물DB' },
  /* ★ 현대음악DB 는 자기 장르·직업 칸이 없습니다.
     대신 wikidata_id 로 인물DB 와 이어져 있으므로 그 판정을 물려받습니다.
     (2026-08-08 · 표에 직접 물어 확인한 구조입니다) */
  { name: 'modern_composers', label: '현대음악DB', viaPersons: true }
];

/* ★ 표마다 칸이 다릅니다 — 있는 칸만 골라 씁니다.
   2026-08-08 에 modern_composers.wd_genre 가 없어서 도구가 죽었습니다.
   인물DB 와 같은 칸을 가졌으리라 짐작한 것이 잘못이었습니다.
   이제 표에 <b>먼저 물어보고</b> 있는 칸만 읽습니다. */
const WANT_COLS = [
  'id', 'name_ko', 'name_en', 'title', 'field',
  'wd_genre', 'wd_occupation', 'genre', 'occupation',
  'description', 'description_en', 'wikidata_id', 'hidden'
];

/** 그 표에 실제로 있는 칸만 돌려줍니다 */
async function realCols(table) {
  /* 한 줄만 받아 보면 어떤 칸이 있는지 알 수 있습니다 */
  const rows = await rest(table + '?select=*&limit=1');
  if (!Array.isArray(rows) || !rows.length) {
    /* 줄이 하나도 없으면 id 만 씁니다 */
    return ['id'];
  }
  const have = Object.keys(rows[0]);
  const use = WANT_COLS.filter(c => have.indexOf(c) >= 0);
  if (use.indexOf('id') < 0) use.unshift('id');
  return use;
}

async function rest(path, init = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...init, headers: { ...HDR, ...(init.headers || {}) }
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

/* ★ PostgREST 는 한 번에 200줄까지만 줍니다. */
async function getAll(path) {
  const out = [];
  let off = 0;
  for (;;) {
    const rows = await rest(path + '&limit=200&offset=' + off);
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    off += rows.length;
    if (rows.length < 200) break;
    if (off % 2000 === 0) process.stdout.write('   읽는 중 ' + off + '줄\r');
  }
  return out;
}

function short(s, n) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/* ★ 인물DB 의 판정 결과를 위키데이터 번호로 찾아볼 수 있게 만듭니다.
   현대음악DB 처럼 자기 근거가 없는 표가 이것을 씁니다. */
let personVerdict = null;
async function loadPersonVerdict() {
  if (personVerdict) return personVerdict;
  const rows = await getAll(
    'persons?select=wikidata_id,name_ko,wd_genre,wd_occupation&order=id.asc');
  const byWid = new Map();
  const byName = new Map();
  for (const p of rows) {
    const c = checkClassic(p);
    if (p.wikidata_id) byWid.set(String(p.wikidata_id).trim(), c);
    if (p.name_ko) byName.set(String(p.name_ko).trim(), c);
  }
  personVerdict = { byWid, byName, n: rows.length };
  return personVerdict;
}

async function auditOne(t) {
  console.log('\n════════════════════════════════════════════');
  console.log(' ' + t.label + '  (' + t.name + ')');
  console.log('════════════════════════════════════════════');

  const cols = await realCols(t.name);
  console.log('읽는 칸 : ' + cols.join(', '));

  /* ★ 인물DB 에 기대는 표 */
  if (t.viaPersons) {
    const v = await loadPersonVerdict();
    console.log('인물DB 판정 ' + v.n + '명을 불러왔습니다 (번호·이름으로 맞춰 봅니다)');

    const rows = await getAll(t.name + '?select=' + cols.join(',') + '&order=id.asc');
    console.log('담긴 것 : ' + rows.length + '줄        ');

    const keep = [], drop = [], why = new Map();
    for (const r of rows) {
      let c = null;
      if (r.wikidata_id) c = v.byWid.get(String(r.wikidata_id).trim()) || null;
      if (!c && r.name_ko) c = v.byName.get(String(r.name_ko).trim()) || null;

      if (!c) {
        /* 인물DB 에 짝이 없습니다 — 판정 근거가 없으므로 건드리지 않습니다 */
        why.set('인물DB에 짝이 없음(그대로 둠)', (why.get('인물DB에 짝이 없음(그대로 둠)') || 0) + 1);
        keep.push(r);
        continue;
      }
      why.set(c.why, (why.get(c.why) || 0) + 1);
      (c.ok ? keep : drop).push({ ...r, _why: '인물DB 판정 · ' + c.why });
    }

    const already = drop.filter(x => x.hidden === true).length;
    const toHide = drop.filter(x => x.hidden !== true);

    console.log('\n── 인물DB 판정을 물려받으면 ──');
    console.log('   클래식으로 남음   : ' + keep.length + '줄');
    console.log('   ★ 걸리는 것      : ' + drop.length + '줄'
      + (already ? '  (그중 ' + already + '줄은 이미 감춰져 있습니다)' : ''));
    console.log('   실제로 손댈 것    : ' + toHide.length + '줄');

    console.log('\n── 걸린 까닭 ──');
    [...why.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log('   ' + String(n).padStart(6) + '  ' + k));

    const show2 = LIST ? toHide.length : Math.min(30, toHide.length);
    if (toHide.length) {
      console.log('\n── ' + (LIST ? '걸린 것 전부' : '표본 ' + show2 + '줄') + ' ──');
      toHide.slice(0, show2).forEach((x, i) => {
        console.log('   ' + String(i + 1).padStart(5) + '. '
          + (x.name_ko || x.name_en || ('#' + x.id)) + '   [' + x._why + ']');
      });
    }
    return { table: t, keep: keep.length, drop, toHide, cols };
  }

  const noBase = ['wd_genre', 'genre', 'wd_occupation', 'occupation']
    .every(c => cols.indexOf(c) < 0);
  if (noBase) {
    console.log('\n★ 이 표에는 장르·직업 칸이 없습니다.');
    console.log('  글자로 클래식 여부를 판정할 근거가 없으므로 건너뜁니다.');
    console.log('  (판정하려면 먼저 그 칸을 채우는 수집기가 있어야 합니다)');
    return { table: t, keep: 0, drop: [], toHide: [], skipped: true };
  }

  const rows = await getAll(t.name + '?select=' + cols.join(',') + '&order=id.asc');
  console.log('담긴 것 : ' + rows.length + '줄        ');

  const keep = [];
  const drop = [];
  const why = new Map();

  for (const p of rows) {
    const c = checkClassic(p);
    why.set(c.why, (why.get(c.why) || 0) + 1);
    (c.ok ? keep : drop).push({ ...p, _why: c.why });
  }

  const alreadyHidden = drop.filter(x => x.hidden === true).length;
  const toHide = drop.filter(x => x.hidden !== true);

  console.log('\n── 새 잣대로 다시 보면 ──');
  console.log('   클래식으로 남음   : ' + keep.length + '줄');
  console.log('   ★ 걸리는 것      : ' + drop.length + '줄'
    + (alreadyHidden ? '  (그중 ' + alreadyHidden + '줄은 이미 감춰져 있습니다)' : ''));
  console.log('   실제로 손댈 것    : ' + toHide.length + '줄');

  console.log('\n── 걸린 까닭 ──');
  [...why.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(6) + '  ' + k));

  const show = LIST ? toHide.length : Math.min(30, toHide.length);
  if (toHide.length) {
    console.log('\n── ' + (LIST ? '걸린 것 전부' : '표본 ' + show + '줄') + ' ──');
    if (!LIST && toHide.length > show) {
      console.log('   ※ 전부 보시려면 --list 를 주십시오.');
    }
    toHide.slice(0, show).forEach((x, i) => {
      console.log('   ' + String(i + 1).padStart(5) + '. '
        + (x.name_ko || x.name_en || ('#' + x.id))
        + '   [' + x._why + ']');
      const g = short(x.wd_genre, 60);
      const o = short(x.wd_occupation, 70);
      if (g) console.log('          장르 : ' + g);
      if (o) console.log('          직업 : ' + o);
    });
  }

  return { table: t, keep: keep.length, drop, toHide, cols };
}

async function setHidden(table, ids, v) {
  let ok = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    try {
      await rest(table + '?id=in.(' + part.join(',') + ')', {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ hidden: v })
      });
      ok += part.length;
    } catch (e) {
      console.log('   [실패] ' + short(e.message, 100));
    }
    process.stdout.write('   ' + ok + '/' + ids.length + '\r');
  }
  return ok;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  담긴 자료를 새 잣대로 다시 보기                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(HIDE   ? '\n★ 걸린 것을 감춥니다 (--hide) · 지우지 않으므로 되돌릴 수 있습니다'
            : UNHIDE ? '\n★ 감춘 것을 되돌립니다 (--unhide)'
                     : '\n※ 아무것도 바꾸지 않습니다. 살펴보기만 합니다.');

  const tables = ONLY ? TABLES.filter(t => t.name === ONLY) : TABLES;
  if (!tables.length) {
    console.error('그런 표가 없습니다 : ' + ONLY);
    process.exit(1);
  }

  /* 되돌리기 */
  if (UNHIDE) {
    for (const t of tables) {
      const cols = await realCols(t.name);
      if (cols.indexOf('hidden') < 0) {
        console.log('\n' + t.label + ' : hidden 칸이 없어 건너뜁니다');
        continue;
      }
      const rows = await getAll(t.name + '?select=id&hidden=is.true&order=id.asc');
      console.log('\n' + t.label + ' : 감춰진 ' + rows.length + '줄을 되돌립니다');
      if (rows.length) {
        const n = await setHidden(t.name, rows.map(r => r.id), false);
        console.log('   ' + n + '줄 되돌렸습니다        ');
      }
    }
    return;
  }

  const results = [];
  for (const t of tables) results.push(await auditOne(t));

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  마무리                                              ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  let total = 0;
  for (const r of results) {
    if (r.skipped) {
      console.log('   ' + r.table.label.padEnd(14) + '건너뜀 (장르·직업 칸이 없습니다)');
      continue;
    }
    console.log('   ' + r.table.label.padEnd(14)
      + '남음 ' + String(r.keep).padStart(6)
      + ' · 걸림 ' + String(r.toHide.length).padStart(6));
    total += r.toHide.length;
  }

  if (!HIDE) {
    console.log('\n※ 아무것도 바꾸지 않았습니다.');
    console.log('  ' + total + '줄을 감추시려면 --hide 를 주십시오.');
    console.log('  ★ 감추기일 뿐 지우지 않습니다. --unhide 로 되돌릴 수 있습니다.');
    return;
  }

  /* 울타리 — 너무 많이 걸리면 멈춥니다 */
  for (const r of results) {
    if (r.skipped) continue;
    const all = r.keep + r.drop.length;
    if (all && r.toHide.length > all * 0.7) {
      console.error('\n★ 멈췄습니다 — ' + r.table.label + ' 의 70%가 넘는 '
        + r.toHide.length + '줄이 걸립니다.');
      console.error('  잣대가 잘못됐을 수 있습니다. 사람이 먼저 확인해 주십시오.');
      process.exit(1);
    }
  }

  for (const r of results) {
    if (r.skipped || !r.toHide.length) continue;
    /* ★ hidden 칸이 없는 표는 감출 수 없습니다 */
    if (r.cols.indexOf('hidden') < 0) {
      console.log('\n── ' + r.table.label + ' ──');
      console.log('   ★ 이 표에는 hidden 칸이 없어 감출 수 없습니다.');
      console.log('     먼저 칸을 만드셔야 합니다 :');
      console.log('       alter table public.' + r.table.name
        + ' add column if not exists hidden boolean not null default false;');
      continue;
    }
    console.log('\n── ' + r.table.label + ' 감추는 중 ──');
    const n = await setHidden(r.table.name, r.toHide.map(x => x.id), true);
    console.log('   ' + n + '줄 감췄습니다        ');
  }
  console.log('\n※ 되돌리시려면 --unhide 를 주십시오.');
}

main().catch(e => {
  console.error('\n실패했습니다 :', e.message || e);
  process.exit(1);
});
