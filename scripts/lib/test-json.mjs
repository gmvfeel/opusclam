// lib/json.mjs 검증 — node scripts/lib/test-json.mjs
import { parseJsonSafe, fixControlChars } from './json.mjs';

let pass = 0, fail = 0;
const log = [];
function ok(name, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; log.push('  ✗ ' + name + (extra ? '  · ' + extra : '')); }
}
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  ok(name, g === w, g === w ? '' : 'got=' + g.slice(0, 120) + ' want=' + w.slice(0, 120));
}

console.log('══ ① 정상 JSON 이 절대 망가지지 않는지 (가장 중요) ══');

const normals = [
  '{"a":1}',
  '{"a":"가나다"}',
  '[1,2,3]',
  '{\n  "a": "b",\n  "c": [1, 2]\n}',                    // 따옴표 밖 줄바꿈·들여쓰기
  '{"a":"줄\\n바꿈"}',                                    // 이미 정식 표기된 \n
  '{"a":"탭\\t끝"}',
  '{"a":"역슬래시\\\\"}',                                  // 값이 역슬래시로 끝남 ★ 안팎 판정 함정
  '{"a":"따옴표\\"안"}',                                   // 이스케이프된 따옴표
  '{"a":"\\u0041\\u00e9"}',
  '{"a":""}',
  '{"a":null,"b":true,"c":-1.5e3}',
  '{"a":{"b":{"c":[{"d":"깊이"}]}}}',
  '{"results":{"bindings":[{"item":{"value":"http://www.wikidata.org/entity/Q1"}}]}}',
];
for (const s of normals) {
  const want = JSON.parse(s);
  eq('그대로 읽힘: ' + s.slice(0, 34), parseJsonSafe(s), want);
}

// 손질 함수 자체가 정상 글을 건드리지 않는지 (원문 보존)
for (const s of normals) {
  const { text, hit } = fixControlChars(s);
  ok('원문 보존: ' + s.slice(0, 30), text === s && hit === 0);
}

console.log('══ ② 깨진 문자가 실제로 복구되는지 ══');

const broken = [
  ['줄바꿈',      '{"a":"가나' + '\n' + '다"}',            { a: '가나\n다' }],
  ['탭',          '{"a":"가나' + '\t' + '다"}',            { a: '가나\t다' }],
  ['캐리지리턴',  '{"a":"가나' + '\r' + '다"}',            { a: '가나\r다' }],
  ['널문자',      '{"a":"가나' + '\u0000' + '다"}',        { a: '가나\u0000다' }],
  ['벨문자',      '{"a":"가나' + '\u0007' + '다"}',        { a: '가나\u0007다' }],
  ['백스페이스',  '{"a":"가나' + '\b' + '다"}',            { a: '가나\b다' }],
  ['폼피드',      '{"a":"가나' + '\f' + '다"}',            { a: '가나\f다' }],
  ['0x1F',        '{"a":"가나' + '\u001f' + '다"}',        { a: '가나\u001f다' }],
  ['여러 개',     '{"a":"가\n나\t다\u0001라"}',            { a: '가\n나\t다\u0001라' }],
  ['키 안에',     '{"키\n름":"값"}',                       { '키\n름': '값' }],
];
for (const [name, raw, want] of broken) {
  let got = null, err = '';
  try { got = parseJsonSafe(raw); } catch (e) { err = e.message; }
  eq('복구: ' + name, got, want);
  ok('복구 후 오류 없음: ' + name, !err, err);
}

console.log('══ ③ 함정 — 역슬래시가 안팎 판정을 뒤집지 않는지 ══');

// 값이 역슬래시로 끝난 <b>뒤에</b> 깨진 문자가 오는 경우
{
  const raw = '{"a":"끝역슬래시\\\\","b":"깨\n짐"}';
  const got = parseJsonSafe(raw);
  eq('역슬래시 뒤 복구', got, { a: '끝역슬래시\\', b: '깨\n짐' });
}
// 이스케이프된 따옴표 뒤에 깨진 문자
{
  const raw = '{"a":"따\\"옴","b":"깨\n짐"}';
  const got = parseJsonSafe(raw);
  eq('이스케이프 따옴표 뒤 복구', got, { a: '따"옴', b: '깨\n짐' });
}
// 문자열 밖 줄바꿈과 문자열 안 줄바꿈이 섞인 경우
{
  const raw = '{\n  "a": "안에\n줄바꿈",\n  "b": 2\n}';
  const got = parseJsonSafe(raw);
  eq('안팎 혼재', got, { a: '안에\n줄바꿈', b: 2 });
}

console.log('══ ④ 다른 이유의 실패는 숨기지 않는지 ══');
{
  let threw = '';
  try { parseJsonSafe('{"a":'); } catch (e) { threw = e.message; }
  ok('잘린 JSON 은 오류 그대로', !!threw, threw);
}
{
  let threw = '';
  try { parseJsonSafe('<html>429 Too Many Requests</html>'); } catch (e) { threw = e.message; }
  ok('HTML 응답은 오류 그대로', !!threw, threw);
}

console.log('══ ⑤ 실제 규모 — 위키데이터 응답 흉내 (2MB 넘김) ══');
{
  const N = 15000;
  const rows = [];
  for (let i = 0; i < N; i++) {
    rows.push({
      item:   { value: 'http://www.wikidata.org/entity/Q' + i },
      nameKo: { value: '음악학교 ' + i + ' 서울특별시 소재' },
      nameEn: { value: 'Music School ' + i + ' located in Seoul' },
    });
  }
  let s = JSON.stringify({ results: { bindings: rows } });
  ok('시험 자료가 2MB 를 넘음', s.length > 2000000, s.length + '자');

  // 실제 실패 지점(2,071,574)을 넘어선 자리의 <b>값 한가운데</b>에 끼워 넣습니다.
  // 표적을 이름으로 집어 자리를 확실히 합니다 — 위치 계산에 기대지 않습니다.
  const mark = '음악학교 ';
  const at = s.indexOf(mark, 2071574) + mark.length;
  ok('삽입 자리를 2,071,574 뒤에서 찾음', at > 2071574, '자리=' + at);
  s = s.slice(0, at) + '\u0002' + s.slice(at);

  let got = null, err = '';
  try { got = parseJsonSafe(s, '규모 시험'); } catch (e) { err = e.message; }
  ok('2MB 응답 복구 성공', !!got && !err, err);
  ok('행 수가 그대로 ' + N, got && got.results && got.results.bindings.length === N,
     got && got.results ? String(got.results.bindings.length) : '-');
  ok('첫 행 온전', got && got.results && got.results.bindings[0].nameKo.value === '음악학교 0 서울특별시 소재');
  ok('끝 행 온전', got && got.results && got.results.bindings[N - 1].item.value === 'http://www.wikidata.org/entity/Q' + (N - 1));

  // 손질된 그 한 행만 제어문자를 품고, 나머지는 멀쩡해야 합니다
  if (got && got.results) {
    const dirty = got.results.bindings.filter(b => /[\u0000-\u001f]/.test(b.nameKo.value));
    ok('제어문자를 품은 행은 딱 1개', dirty.length === 1, String(dirty.length));
    ok('그 행도 버려지지 않고 살아 있음', dirty.length === 1 && dirty[0].nameKo.value.includes('음악학교'));
  }
}

console.log('══ ⑥ 속도 — 정상 응답에 부담이 없는지 ══');
{
  const rows = [];
  for (let i = 0; i < 9000; i++) rows.push({ a: { value: 'x'.repeat(80) + i } });
  const s = JSON.stringify({ results: { bindings: rows } });
  const t0 = Date.now(); for (let k = 0; k < 5; k++) parseJsonSafe(s); const t1 = Date.now();
  console.log('  정상 ' + Math.round(s.length / 1024) + 'KB × 5회 : ' + (t1 - t0) + 'ms');
  ok('정상 응답은 느려지지 않음 (5회 2초 이내)', (t1 - t0) < 2000, (t1 - t0) + 'ms');
}

console.log('');
console.log('─'.repeat(52));
if (log.length) console.log(log.join('\n'));
console.log('  통과 ' + pass + ' · 실패 ' + fail);
console.log('─'.repeat(52));
process.exit(fail ? 1 : 0);
