/* ============================================================
   OPUSCLAM 작품DB — Open Opus 보강  seed/works-openopus.mjs

   무엇을 하나
    · 이미 담긴 작품(위키데이터에서 온 것)에
      <b>갈래 · 널리 연주되는지 · 권할 만한지 · 부제</b>를 채웁니다

   왜 필요한가
    위키데이터는 작품 QID 와 IMSLP 번호를 주지만 <b>갈래를 주지 않습니다.</b>
    지금 담긴 작품의 genre 가 <b>모두 비어</b> 있습니다. 그러면
      · 목록에서 「관현악 · 건반 · 실내악」으로 걸러낼 수 없고
      · 바흐 칸타타 200곡이 목록 앞에 쏟아집니다

    Open Opus 는 사람이 손질한 자료라
      genre        Orchestral · Keyboard · Chamber · Stage · Vocal
      popular      널리 연주되는 작품
      recommended  입문자에게 권할 작품
    를 줍니다. 그리고 <b>공개 자료(public domain)</b>입니다.

   ★ 어떻게 맞추나 — <b>두 단계로만</b> 맞춥니다
     ① 제목이 그대로 같으면 (대소문자 · 악센트 · 구두점 무시)
          우리  Piano Concerto No.20 in D minor, K.466
          OO    Piano Concerto no. 20 in D minor, K.466
     ② 작품번호가 겹치고 <b>첫 낱말까지 같으면</b>
          우리  Symphony No. 20        (IMSLP 에 K.133)
          OO    Symphony no. 20 in D major, K.133

     ★ 번호만 보면 안 됩니다 — op.10 하나가 에튀드 열두 곡에 다 걸립니다.
       그래서 첫 낱말(symphony · concerto · sonata …)을 함께 봅니다.
       애매하면 <b>맞추지 않습니다.</b> 갈래를 잘못 붙이는 것보다
       비워 두는 편이 낫습니다.

   ★ 지어내지 않습니다
    갈래 · 추천 표시는 Open Opus 값을 그대로 옮깁니다.

   ★ 이미 값이 있는 것은 건드리지 않습니다
    genre 가 이미 채워진 줄은 넘어갑니다(--force 를 주면 덮어씁니다).

   쓰는 법
     node seed/works-openopus.mjs --dry          맞춘 결과만 보기
     node seed/works-openopus.mjs --dry --debug  표본을 자세히
     node seed/works-openopus.mjs                실제로 채우기
     node seed/works-openopus.mjs --force        이미 있는 값도 덮어쓰기

   옵션
     --dry      채우지 않습니다
     --debug    맞춘 표본 · 못 맞춘 표본을 보여 줍니다
     --force    genre 가 이미 있어도 덮어씁니다
     --limit=N  작곡가 몇 명까지 (기본 전체)

   필요한 환경변수
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('환경변수 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [a, true];
  })
);
const DRY   = !!args.dry;
const DEBUG = !!args.debug;
const FORCE = !!args.force;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 0;

const OO_DUMP = 'https://api.openopus.org/work/dump.json';
const UA = 'OpusclamWorksBot/1.0 (https://opusclam.com)';

/* ============================================================
   도구
   ============================================================ */
async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ★ 알려진 카탈로그 약호만 씁니다. 조성 표기(in D minor)를
     작품번호로 착각하지 않게 「알려진 이름」 방식을 씁니다. */
const CATS = 'BWV|KV|K|Hob|WoO|Op|op|opus|D|S|RV|TWV|HWV|Wq|H|B|W|T|M|L|F'
           + '|WAB|Sz|BB|CD|FP|MS|G|P|Z|SWV|BuxWV|Anh';

/* ★ \b 를 쓰면 안 됩니다 — 밑줄이 「낱말 글자」로 취급되어
     IMSLP 형식 _K.344 에서 경계가 생기지 않습니다. */
const CAT_RE = new RegExp(
  '(?<![A-Za-z0-9])(' + CATS + ')[\\s._]{0,3}(\\d{1,4})([a-zA-Z]?)'
  + '((?:/\\d{1,4}[a-zA-Z]?)*)(?![\\d])', 'g');

function cats(text) {
  const out = new Set();
  if (!text) return out;
  const s = String(text);
  CAT_RE.lastIndex = 0;
  let m;
  while ((m = CAT_RE.exec(s)) !== null) {
    let a = m[1].toUpperCase();
    if (a === 'OPUS') a = 'OP';
    out.add(a + String(parseInt(m[2], 10)) + (m[3] || '').toLowerCase());
    const tail = m[4] || '';
    const alt = tail.match(/\/(\d{1,4})([a-zA-Z]?)/g) || [];
    for (const one of alt) {
      const mm = one.match(/\/(\d{1,4})([a-zA-Z]?)/);
      if (mm) out.add(a + String(parseInt(mm[1], 10)) + (mm[2] || '').toLowerCase());
    }
  }
  return out;
}

/* ★ 2026-08-07 작품번호를 <b>두 종류로</b> 나눕니다
     강한 번호  K.525 · BWV.1046 · D.969 · RV.269 …
                작곡가별 고유 목록이라 <b>한 곡을 유일하게</b> 가리킵니다
                → 번호만 같으면 맞춥니다
     약한 번호  Op.10
                묶음 번호라 <b>여러 곡에 걸립니다</b>(op.10 = 에튀드 12곡)
                → 번호 + 첫 낱말이 함께 같아야 합니다

   앞판은 모두 「번호 + 첫 낱말」을 요구했습니다. 그래서
       우리  Eine kleine Nachtmusik   (IMSLP 에 K.525)
       OO    Serenade no. 13 in G major, K.525
   가 첫 낱말이 달라(eine / serenade) 거부됐습니다.
   The Marriage of Figaro ↔ Le nozze di Figaro 도 같은 경우입니다. */
const WEAK_RE = /^OP\d/;
function isWeak(c) { return WEAK_RE.test(c); }
function strongOf(set) {
  const o = new Set();
  for (const c of set) if (!isWeak(c)) o.add(c);
  return o;
}
function weakOf(set) {
  const o = new Set();
  for (const c of set) if (isWeak(c)) o.add(c);
  return o;
}

function deaccent(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(s) {
  if (!s) return '';
  return deaccent(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}
function firstWord(s) {
  if (!s) return '';
  const m = deaccent(s).match(/[a-zA-Z]{3,}/);
  return m ? m[0].toLowerCase() : '';
}

/* ★ 2026-08-07 <b>작곡가 이름 보조 맞추기</b>
   첫판은 전체 이름만 비교했습니다. 그래서 일곱 분을 놓쳤습니다.
       우리                          Open Opus
       Joseph Haydn                  Franz Joseph Haydn
       Modest Petrovich Mussorgsky   Modest Mussorgsky
       Michael Glinka                Mikhail Glinka
       Johann Strauss II             Johann Strauss Jr.
   합치면 1,000곡이 넘습니다(요한 슈트라우스 2세 584 · 하이든 275 …).

   ▶ 성(姓)으로 보조 맞추되 <b>애매하면 맞추지 않습니다.</b>
     · 성이 <b>유일</b>하면 그것으로 (Mussorgsky · Glinka)
     · 성이 여럿이면 <b>이름이 겹치는</b> 것 하나만 (Haydn 둘 → joseph)
     · 그래도 여럿이면 <b>꼬리표</b>로 (Strauss 넷 → II = Jr. · I = Sr.)
     · 끝까지 여럿이면 <b>포기</b>합니다 (Johann Bach 는 둘이라 모호) */
const TAIL_MAP = {
  ii:'jr', jr:'jr', junior:'jr', younger:'jr',
  i:'sr', sr:'sr', senior:'sr', elder:'sr',
  iii:'iii', iv:'iv', the:'',
};
function nameWords(s) {
  return String(deaccent(s || '')).split(/[^A-Za-z]+/).filter(Boolean)
    .map((w) => w.toLowerCase());
}
function tailOf(s) {
  const ws = nameWords(s);
  for (let i = ws.length - 1; i >= 0; i--) {
    if (Object.prototype.hasOwnProperty.call(TAIL_MAP, ws[i])) return TAIL_MAP[ws[i]];
    break;
  }
  return '';
}
function coreWords(s) {
  const ws = nameWords(s);
  while (ws.length && Object.prototype.hasOwnProperty.call(TAIL_MAP, ws[ws.length - 1])) ws.pop();
  return ws;
}
function surnameOf(s) {
  const ws = coreWords(s);
  return ws.length ? ws[ws.length - 1] : '';
}
function givensOf(s) {
  const ws = coreWords(s);
  return new Set(ws.length > 1 ? ws.slice(0, -1) : []);
}
function shareGiven(a, b) {
  const A = givensOf(a);
  for (const w of givensOf(b)) if (A.has(w)) return true;
  return false;
}
/* 이름 첫 글자 — Michael 과 Mikhail 은 같은 이름의 다른 표기입니다 */
function initialsOf(s) {
  const o = new Set();
  for (const w of givensOf(s)) if (w) o.add(w.charAt(0));
  return o;
}
function shareInitial(a, b) {
  const A = initialsOf(a);
  for (const c of initialsOf(b)) if (A.has(c)) return true;
  return false;
}

/* ============================================================
   1) Open Opus 전체 자료 받기
   ============================================================ */
async function loadOpenOpus() {
  for (let t = 1; t <= 4; t++) {
    try {
      const res = await fetch(OO_DUMP, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const j = await res.json();
        return (j && j.composers) || [];
      }
      console.log(`  · Open Opus 응답 ${res.status} — ${t}/4 다시 시도`);
    } catch (e) {
      console.log(`  · 통신 오류 — ${t}/4 다시 시도 (${e.message})`);
    }
    await sleep(2000 * t);
  }
  return null;
}

/* ============================================================
   2) 우리 작품 읽기 (쪽 나눠서)
   ============================================================ */
async function loadOurWorks() {
  /* ★ 2026-08-07 <b>여기서 200개만 읽고 멈추는 버그를 두 번 고쳤습니다.</b>

     첫판  Range 머리글로 쪽을 넘기려 했습니다 → 200개만 왔습니다
     둘째판 limit=1000 · offset 으로 바꿨습니다 → <b>그래도 200개</b>였습니다

     까닭은 <b>서버 쪽 응답 상한</b>입니다. Supabase(PostgREST)는
     한 번에 돌려주는 줄 수에 상한이 있고, 이 프로젝트는 <b>200</b>입니다.
     limit 을 1000으로 줘도 200개만 옵니다.

     그런데 끝냄 조건이 「받은 수 < 요청한 수」(200 < 1000)였습니다.
     그래서 <b>첫 바퀴에서 참이 되어</b> 멈췄습니다.

     ▶ 고침 — offset 을 <b>실제로 받은 수만큼</b> 넘깁니다.
       서버가 몇 개를 주든 그만큼 나아가므로 상한과 무관합니다.
       끝냄은 「0개가 왔을 때」로만 판단합니다. */
  const out = [];
  for (let guard = 0; guard < 500; guard++) {
    const rows = await sb(
      'person_works?select=id,person_id,title,title_ko,opus,imslp_ref,genre,subtitle'
      + '&source=eq.wikidata&order=id.asc'
      + `&limit=1000&offset=${out.length}`
    );
    if (!rows || !rows.length) break;
    out.push(...rows);
    if (guard === 0) console.log(`  (한 번에 ${rows.length}개씩 받습니다)`);
  }
  return out;
}

async function loadComposers(ids) {
  const map = new Map();
  const CH = 150;
  for (let i = 0; i < ids.length; i += CH) {
    const part = ids.slice(i, i + CH);
    const rows = await sb(
      `persons?select=id,name_ko,name_en&id=in.(${part.join(',')})`
    );
    for (const r of (rows || [])) map.set(r.id, r);
  }
  return map;
}

/* ============================================================
   3) 채우기
   ============================================================ */
async function savePatches(patches) {
  let saved = 0;
  const failed = [];
  for (const p of patches) {
    try {
      await sb(`person_works?id=eq.${p.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(p.set),
      });
      saved++;
    } catch (e) {
      failed.push({ id: p.id, why: String(e.message || '').slice(0, 120) });
    }
  }
  return { saved, failed };
}

/* ============================================================
   본줄기
   ============================================================ */
async function main() {
  console.log('══ 작품DB Open Opus 보강 ══');
  console.log(DRY ? '※ 채우지 않습니다 (--dry)' : '※ 실제로 채웁니다');
  if (FORCE) console.log('※ 이미 있는 값도 덮어씁니다 (--force)');
  console.log('');

  console.log('Open Opus 자료를 받습니다…');
  const ooComposers = await loadOpenOpus();
  if (!ooComposers) { console.error('Open Opus 자료를 받지 못했습니다.'); process.exit(1); }
  let ooWorkCount = 0;
  for (const c of ooComposers) ooWorkCount += (c.works || []).length;
  console.log(`  작곡가 ${ooComposers.length}명 · 작품 ${ooWorkCount}개`);

  console.log('우리 작품을 읽습니다…');
  const ours = await loadOurWorks();
  console.log(`  ${ours.length}개`);
  if (!ours.length) { console.log('채울 것이 없습니다.'); return; }

  const personIds = [...new Set(ours.map((w) => w.person_id))];
  const composers = await loadComposers(personIds);
  console.log(`  작곡가 ${composers.size}명`);
  console.log('');

  /* Open Opus 작곡가를 이름 · 성 두 갈래로 정리합니다 */
  const ooByName = new Map();
  const ooBySurname = new Map();
  for (const c of ooComposers) {
    const key = norm(c.complete_name);
    if (key) ooByName.set(key, c);
    const sn = surnameOf(c.complete_name);
    if (sn) {
      if (!ooBySurname.has(sn)) ooBySurname.set(sn, []);
      ooBySurname.get(sn).push(c);
    }
  }

  /* 우리 작곡가 한 명에 맞는 Open Opus 작곡가를 찾습니다 */
  function findComposer(ourName) {
    if (!ourName) return null;
    const exact = ooByName.get(norm(ourName));
    if (exact) return { c: exact, why: '이름 일치' };
    const sn = surnameOf(ourName);
    if (!sn) return null;
    const cands = ooBySurname.get(sn) || [];

    /* ★ 2026-08-07 <b>성이 유일해도 이름을 확인합니다.</b>
       Clara Schumann 을 Robert Schumann 으로 맞춘 사고가 있었습니다.
       부부지만 다른 사람이고, Open Opus 에는 로베르트만 있습니다.
       그대로 채웠으면 클라라 슈만 작품에 로베르트의 편성이 붙었습니다.

       판단 — 아래 셋 가운데 하나면 같은 사람으로 봅니다.
         · 이름이 겹침            Modest ↔ Modest
         · 이름 첫 글자가 같음     Michael ↔ Mikhail
         · 한쪽에 이름 정보가 없음  (성만 있는 자료)
       Clara(C) ↔ Robert(R) 는 어느 것도 아니므로 <b>거부</b>합니다. */
    if (cands.length === 1) {
      const c = cands[0];
      const gOurs = givensOf(ourName);
      const gOo = givensOf(c.complete_name);
      if (!gOurs.size || !gOo.size) {
        return { c: c, why: '성 ' + sn + ' 유일 (이름 정보 없음)' };
      }
      if (shareGiven(ourName, c.complete_name)) {
        return { c: c, why: '성 ' + sn + ' 유일 + 이름 겹침' };
      }
      if (shareInitial(ourName, c.complete_name)) {
        return { c: c, why: '성 ' + sn + ' 유일 + 이름 첫 글자' };
      }
      return null;    /* 이름이 명백히 다릅니다 */
    }
    if (cands.length > 1) {
      const hit = cands.filter((c) => shareGiven(ourName, c.complete_name));
      if (hit.length > 1) {
        const t = tailOf(ourName);
        if (t) {
          const nar = hit.filter((c) => tailOf(c.complete_name) === t);
          if (nar.length === 1) return { c: nar[0], why: '성+이름+꼬리표(' + t + ')' };
        }
      }
      if (hit.length === 1) return { c: hit[0], why: '성 ' + sn + ' + 이름' };
    }
    return null;
  }

  /* 우리 작곡가별로 묶습니다 */
  const byPerson = new Map();
  for (const w of ours) {
    if (!byPerson.has(w.person_id)) byPerson.set(w.person_id, []);
    byPerson.get(w.person_id).push(w);
  }

  let personHit = 0, personMiss = 0;
  const missNames = [];
  const hitWhy = [];   /* 보조 규칙으로 맞춘 작곡가 — 눈으로 확인하시게 */
  let matched = 0, already = 0, noMatch = 0;
  const patches = [];
  const sampleHit = [], sampleMiss = [];
  const byGenre = {};

  let done = 0;
  for (const [pid, works] of byPerson) {
    if (LIMIT && done >= LIMIT) break;
    done++;
    const p = composers.get(pid);
    if (!p) continue;

    const found = findComposer(p.name_en);
    if (!found) {
      personMiss++;
      if (missNames.length < 20) missNames.push(p.name_en || p.name_ko || String(pid));
      continue;
    }
    const oo = found.c;
    personHit++;
    if (DEBUG && found.why !== '이름 일치' && hitWhy.length < 12) {
      hitWhy.push(`${p.name_en} → ${oo.complete_name}  (${found.why})`);
    }

    /* Open Opus 작품을 두 갈래 열쇠로 정리합니다 */
    const ooByTitle = new Map();
    const ooList = [];
    for (const w of (oo.works || [])) {
      const k = norm(w.title);
      if (k && !ooByTitle.has(k)) ooByTitle.set(k, w);
      const cs = cats(w.title + ' ' + (w.searchterms || ''));
      ooList.push({
        w,
        cats: cs,
        strong: strongOf(cs),
        weak: weakOf(cs),
        fw: firstWord(w.title),
      });
    }

    for (const our of works) {
      if (our.genre && !FORCE) { already++; continue; }

      let hit = null, why = '';

      /* ① 제목이 그대로 같은가 */
      const k = norm(our.title);
      if (k && ooByTitle.has(k)) { hit = ooByTitle.get(k); why = '제목 일치'; }

      /* ② 강한 번호(K.525 · BWV.1046 …)는 <b>그것만으로</b> 충분합니다
            — 한 곡을 유일하게 가리키므로 제목이 아주 달라도 됩니다 */
      const ourCats = new Set([
        ...cats(our.title), ...cats(our.imslp_ref), ...cats(our.opus),
      ]);
      const ourStrong = strongOf(ourCats);
      if (!hit && ourStrong.size) {
        for (const cand of ooList) {
          let shared = null;
          for (const c of ourStrong) { if (cand.strong.has(c)) { shared = c; break; } }
          if (shared) { hit = cand.w; why = '강한 번호 ' + shared; break; }
        }
      }

      /* ③ 약한 번호(Op.10)는 <b>첫 낱말까지</b> 같아야 합니다
            — 그러지 않으면 op.10 하나가 에튀드 열두 곡에 다 걸립니다 */
      if (!hit) {
        const ourWeak = weakOf(ourCats);
        if (ourWeak.size) {
          const ourFw = firstWord(our.title);
          if (ourFw) {
            for (const cand of ooList) {
              if (cand.fw !== ourFw) continue;
              let shared = null;
              for (const c of ourWeak) { if (cand.weak.has(c)) { shared = c; break; } }
              if (shared) { hit = cand.w; why = '약한 번호 ' + shared + '+첫 낱말'; break; }
            }
          }
        }
      }

      if (!hit) {
        noMatch++;
        if (sampleMiss.length < 10) sampleMiss.push(our.title);
        continue;
      }

      matched++;
      byGenre[hit.genre || '(빈 값)'] = (byGenre[hit.genre || '(빈 값)'] || 0) + 1;
      const set = {
        genre: hit.genre || null,
        is_popular: String(hit.popular) === '1',
        is_recommended: String(hit.recommended) === '1',
      };
      if (hit.subtitle && !our.subtitle) set.subtitle = hit.subtitle;
      patches.push({ id: our.id, set });
      if (sampleHit.length < 12) {
        sampleHit.push(`${our.title}  →  ${hit.genre}`
          + (set.is_popular ? ' · 널리 연주' : '')
          + (set.is_recommended ? ' · 권함' : '')
          + `  (${why})`);
      }
    }
  }

  console.log('══ 맞춘 결과 ══');
  console.log(`  작곡가  맞음 ${personHit}명 · 못 맞음 ${personMiss}명`);
  if (missNames.length) {
    console.log(`   └ 못 맞은 작곡가 표본 : ${missNames.slice(0, 12).join(' · ')}`);
  }
  if (hitWhy.length) {
    console.log('   └ 보조 규칙으로 맞춘 작곡가 (★눈으로 확인해 주십시오)');
    for (const s of hitWhy) console.log(`      · ${s}`);
  }
  console.log(`  작품    맞음 ${matched}개 · 못 맞음 ${noMatch}개`
              + (already ? ` · 이미 갈래가 있어 넘김 ${already}개` : ''));

  const gl = Object.keys(byGenre).sort((a, b) => byGenre[b] - byGenre[a])
    .map((k) => `${k} ${byGenre[k]}`);
  if (gl.length) console.log(`  장르별 : ${gl.join(' · ')}`);

  if (DEBUG) {
    if (sampleHit.length) {
      console.log('\n  [맞춘 표본]');
      for (const s of sampleHit) console.log(`    · ${s}`);
    }
    if (sampleMiss.length) {
      console.log('\n  [못 맞춘 표본]');
      for (const s of sampleMiss) console.log(`    · ${s}`);
    }
  }

  if (!DRY && patches.length) {
    console.log('');
    console.log(`채웁니다 — ${patches.length}개`);
    const { saved, failed } = await savePatches(patches);
    console.log(`  채워짐 ${saved}개` + (failed.length ? ` · 실패 ${failed.length}개` : ''));
    for (const f of failed.slice(0, 10)) console.log(`    ✗ id ${f.id} — ${f.why}`);
  }

  if (DRY) {
    console.log('');
    console.log('※ --dry 였으므로 아무것도 채우지 않았습니다.');
    console.log('  맞춘 결과가 알맞으면 --dry 를 떼고 다시 돌리십시오.');
  }
}

main().catch((e) => {
  console.error('멈췄습니다:', e.message);
  process.exit(1);
});
