// ============================================================
// OPUSCLAM 학술 ↔ 인물 주제 연결 (v1)
//
//  논문 제목에 나오는 작곡가 · 연주자를 인물DB 와 잇습니다.
//  그러면 인물 페이지에 '그를 다룬 논문' 이 붙고,
//  논문에서 인물 페이지로 넘어갈 수 있습니다.
//
//  왜 성으로만 맞추는가
//    논문 제목에는 성만 나옵니다 · "Beethoven's compositional process"
//    그래서 인물DB 의 영문명 마지막 낱말을 성으로 보고 대조합니다.
//
//  잘못 잇지 않기 위한 장치
//    ① 성이 5자 이상이어야 합니다 (Kim · Lee · Park · Bach 는 제외됩니다)
//    ② 그 성을 가진 인물이 인물DB 에 한 명뿐이어야 합니다
//       (Bach · Wagner · Weber 처럼 여러 명이면 특정할 수 없어 건너뜁니다)
//    ③ 일반 영어 낱말과 겹치는 성은 쓰지 않습니다
//       ('Young musicians in the choir' 가 Young 이라는 인물에 붙는 것을 막습니다)
//    ④ 한글 이름은 제목에 그대로 나오므로 전체를 맞춥니다
//
//  기존 entity_links 규칙을 따릅니다 · rel 은 영문 소문자 · 양방향 두 줄 저장
//
//  환경변수 · SUPABASE_URL, SUPABASE_SERVICE_KEY
//            SUBJECT_DRY=1 이면 저장하지 않고 결과만 보여줍니다
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('환경변수 필요: SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const VERSION = 'v1';
const DRY = process.env.SUBJECT_DRY === '1';

const H = {
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
};

const MIN_SUR = 5;        // 성 최소 길이
const CONF_EN = 70;       // 영문 성 매칭 신뢰도 (성만 맞춘 것이라 낮게)
const CONF_KO = 85;       // 한글 전체 이름 매칭 신뢰도
const CONF_REP = 60;      // 겹치는 성에서 대표를 고른 경우 (추정이 섞임)

// 성이면서 일반 낱말인 것들. 이 목록이 부족하면 오탐이 쏟아집니다.
// 첫 시험에서 실제로 이런 일이 있었습니다.
//   알렉스 노스(North) 95건 ← 'in the north' · 'North America'
//   Gregory Short 35건 ← 'short pieces'
//   James Reese Europe 30건 ← 'in Europe'
//   Simon House 22건 ← 'opera house'
// 그래서 지명 · 음악용어 · 흔한 성을 모두 담았습니다.
const STOP = new Set((
   // 방위 · 지명
   'north south east west northern southern eastern western europe european asia asian '
 + 'africa african america american britain british england english france french '
 + 'german germany italy italian spain spanish russia russian poland polish czech '
 + 'japan japanese korea korean china chinese india indian canada latin western '
   // 크기 · 정도 · 흔한 형용사
 + 'short long little small large great greater lesser higher lower middle central '
 + 'young early later modern late first second third last next past present future '
 + 'major minor common public private simple complex direct clear plain single double '
 + 'whole total final initial general special local rural urban '
   // 색 · 자연
 + 'brown white green black grey gray silver golden stone field water river brook '
 + 'wood woods forest garden hill hills lake springs winters summers rivers banks '
   // 장소 · 건물
 + 'house home hall court church temple chapel palace castle tower bridge bridges '
 + 'gates station market street village '
   // 사람 · 직함
 + 'musician musicians singer singers player players master masters teacher student '
 + 'child children women people person doctor professor bishop baker miller taylor '
 + 'turner walker cooper carter foster porter mason gardner marshall wright fisher '
 + 'james thomas martin morris lewis harris jones davis clark ward cook price bell '
 + 'king queen prince princess duke count baron lord lady noble royal '
   // 음악 용어
 + 'music musical sound sounds voice voices song songs piece pieces work works '
 + 'style styles form forms scale scales chord notes beats tempo tones pitch '
 + 'sonata sonatas opera operas choral vocal instrumental orchestral chamber '
 + 'piano violin cello viola organ flute clarinet oboe trumpet drums bands '
 + 'sharp flat treble bass tenor rhythm melody harmony '
 + 'classic classical romantic baroque medieval renaissance popular sacred secular '
   // 연구 용어
 + 'study studies theory theories practice practices analysis performance education '
 + 'research learning teaching reading writing listening singing playing making '
 + 'method model system process effect change group level value range order place '
 + 'space times culture history school review report survey approach context '
 + 'meaning identity memory emotion gender social human national international '
   // 기타 흔한 낱말
 + 'between within through during before after above under about again these those '
 + 'their there where which while would could should might still three other '
 + 'perfect harmony health nature light dark deep wide real true main '
   // 유일한 성이지만 일반 낱말이거나 흔한 이름인 것들.
   // 첫 시험에서 데니스 브레인(Brain) 33건 · Charles · Joseph · Roots 가 걸렸습니다.
 + 'brain brains charles joseph roots root basic '
   // 지명 · 도시. 논문 제목에 매우 흔합니다
 + 'paris london vienna berlin rome milan venice naples madrid moscow prague '
 + 'budapest warsaw leipzig dresden munich hamburg cologne frankfurt zurich '
 + 'geneva brussels amsterdam copenhagen stockholm helsinki dublin edinburgh '
 + 'boston chicago philadelphia baltimore seattle sydney melbourne brisbane '
 + 'toronto montreal vancouver tokyo osaka kyoto beijing shanghai seoul '
   // 왕조 · 시대. 'Tudor music' 처럼 쓰입니다
 + 'tudor stuart victorian georgian edwardian medici bourbon habsburg '
   // 의학 · 실험 용어. 음악치료 논문에 'clinical trial' 이 계속 나옵니다
 + 'trial trials clinical patient patients therapy therapies control controls '
 + 'sample samples subject subjects placebo random cohort '
   // 이름 뒤에 붙는 말 · 성으로 잡히면 오탐이 됩니다
 + 'junior senior third fourth fifth elder younger '
   // 그 밖에 걸린 것들 · Alan Civil 9건 ← 'civil war'
 + 'civil military naval royal imperial federal '
   // 이름으로 흔한 것들. 성으로 잡히면 오탐이 됩니다.
   //   david ← 'King David' · michael ← 이름으로 흔함
   //   roman ← 'Roman Empire' · 화성 표기 'roman numeral'
 + 'david michael roman romans peter simon philip daniel samuel gabriel '
).split(/\s+/).filter(Boolean));

// ── 유틸 ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ★ 나눠받기 — 「받은 만큼만 나아가고, 아무것도 오지 않을 때 끝냅니다」
   예전에는 「1000개 달라 하고 1000보다 적게 오면 끝」 이었습니다.
   그런데 Supabase 의 Max rows 가 200 이라 서버가 200에서 잘라 줍니다.
   그러면 200 < 1000 이므로 첫 200개만 읽고 멈췄습니다.
   상한이 몇이든(200이든 1000이든) 맞게 돌도록 고쳤습니다. */
// ★ 나눠받기에는 <b>순서를 확정해</b> 주어야 합니다.
//
//   왜 필요한가 (2026-08-03 실제로 겪은 일입니다)
//     Range 로 페이지를 나눠 받는데 정렬이 없으면, 데이터베이스는
//     <b>매 페이지마다 다른 순서</b>로 줄 수 있습니다. 그러면 어떤 줄은
//     두 번 오고 어떤 줄은 아예 오지 않습니다.
//
//     어드민 화면에서 인물 9,346명을 그렇게 받다가 같은 인물이 두 번
//     담겼고, 삭제할 때 같은 위키데이터 번호를 두 번 보내
//       ON CONFLICT DO UPDATE command cannot affect row a second time
//     오류가 났습니다. 300명으로 재현해 보니 <b>돌릴 때마</b> 중복 5~8줄,
//     누락 5~8명이 생겼습니다.
//
//     수집기들은 「이미 담긴 항목 목록」 을 이렇게 받아 중복을 피합니다.
//     목록이 새면 <b>이미 있는 것을 또 담거나, 있는 것을 못 알아봅니다.</b>
//
//   기본키는 겹치지 않으므로 정렬에 붙이면 순서가 확정됩니다.
//   blocklist 는 기본키가 wikidata_id 이고, 나머지는 id 입니다.
function orderFor(table) {
  return '&order=' + (table === 'blocklist' ? 'wikidata_id' : 'id') + '.asc';
}

async function sbGetAll(table, select, extra) {
  const out = []; const STEP = 1000; let from = 0;
  while (true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=' + select + (extra || '') + orderFor(table),
      { headers: { ...H, Range: from + '-' + (from + STEP - 1) } });
    if (!r.ok) throw new Error('GET ' + table + ' ' + r.status + ' ' + await r.text());
    const batch = await r.json();
    out.push(...batch);
    if (!batch.length) break;              // 더 없으면 끝
    from += batch.length;                 // ★ 받은 만큼만 나아갑니다
    if (from > 100000) break;
  }
  return out;
}

async function sbInsert(rows) {
  if (!rows.length) return 0;
  const r = await fetch(SUPABASE_URL + '/rest/v1/entity_links', {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows),
  });
  if (r.ok) return rows.length;
  const txt = await r.text();
  // 중복이면 한 줄씩 넣어 건너뜁니다
  if (r.status === 409 || txt.indexOf('23505') >= 0) {
    let ok = 0;
    for (const row of rows) {
      const r2 = await fetch(SUPABASE_URL + '/rest/v1/entity_links', {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify([row]),
      });
      if (r2.ok) ok++;
    }
    return ok;
  }
  throw new Error('INSERT ' + r.status + ' ' + txt);
}

// ── 메인 ────────────────────────────────────────────────────
async function main() {
  console.log('■ 학술 ↔ 인물 주제 연결', VERSION, DRY ? '(시험 실행 · 저장 안 함)' : '');

  const persons = await sbGetAll('persons', 'id,name_ko,name_en,description,description_en');
  console.log('■ 인물', persons.length, '명');

  // 인물별 관계 수를 셉니다. 대표를 고를 때 쓰는 가장 좋은 단서입니다.
  // 볼프강 모차르트는 스승 · 제자 관계가 많고 아버지 레오폴트는 적습니다.
  const relCount = new Map();
  try {
    const all = await sbGetAll('entity_links', 'from_type,from_id,to_type,to_id');
    for (const l of all) {
      if (l.from_type === 'person' && l.from_id) relCount.set(l.from_id, (relCount.get(l.from_id) || 0) + 1);
      if (l.to_type === 'person' && l.to_id) relCount.set(l.to_id, (relCount.get(l.to_id) || 0) + 1);
    }
    console.log('■ 관계가 있는 인물', relCount.size, '명');
  } catch (e) {
    console.log('■ 관계 수를 못 받았습니다 · 소개문 길이로만 판단합니다');
  }

  // 1) 성 사전 만들기
  //
  //    성이 겹치면 원래는 모두 포기했습니다. 그런데 확인해 보니
  //    클래식 거장들이 가족과 함께 등록돼 있어 전부 빠지고 있었습니다.
  //      모차르트 5명 (볼프강 · 아버지 레오폴트 · 누나 · 아들 둘)
  //      슈만 6명 · 바그너 8명 · 슈베르트 4명 · 베토벤 2명
  //
  //    소개문 길이로만 견주면 아버지도 위키백과 항목이 있어 비슷하게 깁니다.
  //    그래서 세 가지를 차례로 봅니다.
  //      ① 한글 이름이 있는 인물만 후보로 둡니다 (유명한 사람만 한국어 항목이 있습니다)
  //      ② 그중 관계 수가 가장 많은 인물
  //      ③ 관계 수가 비슷하면 소개문이 긴 인물
  //    1위와 2위가 엇비슷하면 판단을 미루고 그 성은 쓰지 않습니다.
  const descLen = (p) => Math.max(String(p.description || '').length,
                                  String(p.description_en || '').length);
  const hasKo = (p) => /[가-힣]/.test(String(p.name_ko || ''));
  const score = (p) => (relCount.get(p.id) || 0) * 100 + Math.min(descLen(p), 3000) / 10;

  const bySur = new Map();   // 성 -> 인물 배열
  for (const p of persons) {
    const en = String(p.name_en || '').trim();
    if (!en) continue;
    const parts = en.split(/\s+/);
    const sur = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (sur.length < MIN_SUR) continue;
    if (STOP.has(sur)) continue;
    if (!bySur.has(sur)) bySur.set(sur, []);
    bySur.get(sur).push(p);
  }
  const surMap = new Map();     // 성 -> 인물
  const surRep = new Map();     // 성 -> true (대표로 고른 것 · 신뢰도를 낮춥니다)
  let repCount = 0;
  for (const [sur, arr] of bySur) {
    if (arr.length === 1) { surMap.set(sur, arr[0]); continue; }
    // ① 한글 이름이 있는 인물이 한 명뿐이면 그 사람으로 봅니다
    const kos = arr.filter(hasKo);
    let cand = kos.length ? kos : arr;
    if (cand.length === 1) {
      surMap.set(sur, cand[0]); surRep.set(sur, true); repCount++; continue;
    }
    // ② 점수로 견줍니다 (관계 수를 크게, 소개문 길이를 작게 봅니다)
    const sorted = cand.slice().sort((a, b) => score(b) - score(a));
    const s1 = score(sorted[0]), s2 = score(sorted[1]);
    if (s1 >= 30 && s1 >= s2 * 1.6) {
      surMap.set(sur, sorted[0]); surRep.set(sur, true); repCount++;
    }
  }
  console.log('■ 쓸 수 있는 성', surMap.size, '개'
    + ' (겹치는 성 가운데 대표를 고른 것 ' + repCount + '개)');

  // 주요 작곡가가 사전에 들어갔는지 확인합니다.
  // 빠져 있으면 왜 빠졌는지(가족이 여럿이라 대표를 못 고름 등) 바로 알 수 있습니다.
  const CHECK = ['beethoven', 'mozart', 'schubert', 'schumann', 'chopin', 'liszt',
                 'wagner', 'brahms', 'debussy', 'mahler', 'bruckner', 'sibelius',
                 'ravel', 'stravinsky', 'prokofiev', 'shostakovich'];
  console.log('■ 주요 작곡가 사전 등재');
  for (const c of CHECK) {
    const p = surMap.get(c);
    if (p) {
      console.log('   ' + c.padEnd(13) + (p.name_ko || p.name_en)
        + (surRep.has(c) ? '  (대표 추정)' : ''));
    } else {
      const arr = bySur.get(c) || [];
      const why = arr.length === 0 ? '인물DB에 없음'
                : arr.length > 1 ? '동명 ' + arr.length + '명 · 점수 차이가 작아 대표를 못 고름'
                : '배제 목록에 걸림';
      console.log('   ' + c.padEnd(13) + '— ' + why);
    }
  }

  // 2) 한글 이름 사전 · 두 자 이상이고 유일한 이름만
  const koCount = new Map(), koFirst = new Map();
  for (const p of persons) {
    const ko = String(p.name_ko || '').trim();
    if (ko.length < 2 || !/^[가-힣]+$/.test(ko)) continue;
    koCount.set(ko, (koCount.get(ko) || 0) + 1);
    if (!koFirst.has(ko)) koFirst.set(ko, p);
  }
  const koMap = new Map();
  for (const [ko, n] of koCount) if (n === 1) koMap.set(ko, koFirst.get(ko));
  console.log('■ 쓸 수 있는 한글 이름', koMap.size, '개');

  const papers = await sbGetAll('academic', 'id,name_ko,name_en,author');
  console.log('■ 논문', papers.length, '건 · 제목 대조 시작');

  // 3) 이미 있는 연결 (다시 넣지 않기 위해)
  //    SQL 로 넣을 때는 행마다 중복을 뒤지느라 시간이 초과됐습니다.
  //    여기서는 한 번에 받아 메모리에서 확인하므로 빠릅니다.
  const have = new Set();
  const links = await sbGetAll('entity_links', 'from_id,rel,to_id',
    "&from_type=eq.academic&rel=in.(subject,author)");
  for (const l of links) have.add(l.rel + ':' + l.from_id + ':' + l.to_id);
  console.log('■ 이미 있는 학술 연결', have.size, '건');

  // 3-2) 저자 이름 사전 · 논문의 author 칸과 인물DB 를 맞춥니다.
  //      제목에 나오는 성과 달리, 저자는 이름 전체가 적혀 있어
  //      완전히 같은 이름만 이으면 됩니다.
  //
  //      두 가지를 챙깁니다.
  //        · 한글 이름은 공백이 없으므로 낱말 수를 따지지 않습니다
  //        · 낱말을 가나다순으로 정렬해 견줍니다.
  //          인물DB 는 'Minsu Kim' · 논문은 'Kim Minsu' 로 적히는 일이 흔합니다.
  const nameKey = (s) => {
    const t = String(s || '').trim();
    if (!t) return '';
    if (/[가-힣]/.test(t)) return t.replace(/[^가-힣]/g, '');
    return t.toLowerCase().replace(/[^a-z\s]/g, ' ')
            .split(/\s+/).filter(Boolean).sort().join('');
  };
  const usableName = (s) => {
    const t = String(s || '').trim();
    if (/[가-힣]/.test(t)) return t.replace(/[^가-힣]/g, '').length >= 2;
    return t.split(/\s+/).filter(Boolean).length >= 2;
  };

  const fullCount = new Map(), fullFirst = new Map();
  for (const p of persons) {
    for (const nm of [p.name_en, p.name_ko]) {
      if (!usableName(nm)) continue;
      const k = nameKey(nm);
      // 최소 길이는 글자 종류에 따라 다릅니다.
      // 4자로 두면 '정경화' 같은 세 자 이름이 빠집니다.
      const minLen = /[가-힣]/.test(k) ? 2 : 4;
      if (k.length < minLen) continue;
      fullCount.set(k, (fullCount.get(k) || 0) + 1);
      if (!fullFirst.has(k)) fullFirst.set(k, p);
    }
  }
  const fullMap = new Map();
  for (const [k, n] of fullCount) if (n === 1) fullMap.set(k, fullFirst.get(k));

  // 4) 제목에서 인물 찾기 · 저자 칸에서도 인물 찾기
  const pairs = [];        // { paperId, personId, how }
  const auPairs = [];      // { paperId, personId }
  let hitEn = 0, hitKo = 0;
  for (const a of papers) {
    // 저자 연결
    for (const raw of String(a.author || '').split(',')) {
      const nm = raw.trim();
      if (!usableName(nm)) continue;
      const p = fullMap.get(nameKey(nm));
      if (!p) continue;
      if (have.has('author:' + a.id + ':' + p.id)) continue;
      if (!auPairs.some(x => x.paperId === a.id && x.personId === p.id)) {
        auPairs.push({ paperId: a.id, personId: p.id });
      }
    }

    const title = String(a.name_en || a.name_ko || '');
    if (!title) continue;
    const found = new Map();   // personId -> how

    // 영문 · 제목을 낱말로 쪼개 성 사전과 맞춥니다.
    //
    // 대소문자를 함께 봅니다. 사람 이름은 대문자로 시작하므로
    // 'in the north of Italy' 처럼 소문자로 쓰인 것은 걸러집니다.
    // (제목 첫 낱말은 늘 대문자라 이 조건으로 못 걸러내고,
    //  대신 위쪽 배제 목록이 막습니다)
    //
    // 아포스트로피는 낱말에 넣지 않습니다. 넣으면 "Beethoven's" 가
    // 'beethovens' 로 읽혀 사전과 맞지 않게 됩니다.
    const toks = title.match(/[A-Za-z]+/g) || [];
    for (const raw of toks) {
      const w = raw.toLowerCase();
      if (w.length < MIN_SUR) continue;
      if (raw[0] !== raw[0].toUpperCase()) continue;   // 소문자로 시작하면 이름이 아닙니다
      const p = surMap.get(w);
      if (p && !found.has(p.id)) {
        /* 겹치는 성에서 대표를 고른 경우는 확신이 덜하므로 따로 표시합니다 */
        found.set(p.id, surRep.has(w) ? 'rep' : 'en');
        hitEn++;
      }
    }
    // 한글 · 이름이 제목에 그대로 나오는지 봅니다
    if (/[가-힣]/.test(title)) {
      for (const [ko, p] of koMap) {
        if (title.indexOf(ko) >= 0 && !found.has(p.id)) { found.set(p.id, 'ko'); hitKo++; }
      }
    }
    for (const [pid, how] of found) {
      if (have.has('subject:' + a.id + ':' + pid)) continue;
      pairs.push({ paperId: a.id, personId: pid, how });
    }
  }
  const nRep = pairs.filter(x => x.how === 'rep').length;
  console.log('■ 새로 이을 주제 연결', pairs.length, '건'
    + ' (영문 성 ' + (pairs.length - nRep - pairs.filter(x => x.how === 'ko').length)
    + ' · 대표 추정 ' + nRep + ' · 한글 이름 ' + pairs.filter(x => x.how === 'ko').length + ')');
  console.log('■ 새로 이을 저자 연결', auPairs.length, '건');

  if (!pairs.length && !auPairs.length) { console.log('■ 넣을 것이 없습니다. 종료.'); return; }

  // 5) 미리보기
  const byPerson = new Map();
  for (const p of pairs) byPerson.set(p.personId, (byPerson.get(p.personId) || 0) + 1);
  const top = [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const pName = new Map(persons.map(p => [p.id, p.name_ko || p.name_en]));
  console.log('■ 논문이 많이 붙는 인물 12명');
  for (const [pid, n] of top) console.log('   ' + String(pName.get(pid) || pid).padEnd(24) + n + '건');

  if (DRY) { console.log('■ 시험 실행이므로 저장하지 않습니다.'); return; }

  // 6) 양방향 저장 (기존 teacher/student 쌍과 같은 방식)
  const rows = [];
  for (const p of pairs) {
    const conf = p.how === 'ko' ? CONF_KO : (p.how === 'rep' ? CONF_REP : CONF_EN);
    const src = p.how === 'ko' ? 'title-match-ko'
              : (p.how === 'rep' ? 'title-match-rep' : 'title-match-en');
    rows.push({ from_type: 'academic', from_id: p.paperId, rel: 'subject',
                to_type: 'person', to_id: p.personId, source: src, confidence: conf });
    rows.push({ from_type: 'person', from_id: p.personId, rel: 'studied_by',
                to_type: 'academic', to_id: p.paperId, source: src, confidence: conf });
  }
  // 저자 연결 · 이름 전체가 맞은 것이라 신뢰도를 조금 높게 둡니다
  for (const p of auPairs) {
    rows.push({ from_type: 'academic', from_id: p.paperId, rel: 'author',
                to_type: 'person', to_id: p.personId, source: 'name-match', confidence: 80 });
    rows.push({ from_type: 'person', from_id: p.personId, rel: 'wrote',
                to_type: 'academic', to_id: p.paperId, source: 'name-match', confidence: 80 });
  }
  let ins = 0;
  for (let i = 0; i < rows.length; i += 500) {
    ins += await sbInsert(rows.slice(i, i + 500));
    await sleep(120);
  }
  console.log('■ 저장', ins, '줄 (양방향이므로 연결 수의 두 배입니다)');
  console.log('■ 완료');
}

main().catch(e => { console.error('■ 실패:', e); process.exit(1); });
