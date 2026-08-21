// ============================================================
// OPUSCLAM 공용 JSON 읽기 (v1)
//
//  왜 만들었나 — 2026-08-09 학교 수집이 이렇게 멈췄습니다
//    Bad control character in string literal in JSON at position 2071574
//
//  위키데이터는 누구나 고칠 수 있습니다. 어느 항목의 이름이나 설명에
//  줄바꿈 같은 <b>제어문자</b>가 그대로 들어가는 일이 생깁니다.
//  그것이 응답에 실려 오면 JSON.parse 가 통째로 실패하고,
//  <b>그 한 글자 때문에 890곳이 전부 날아갑니다.</b>
//
//  이 모듈이 하는 일
//    ① 평소에는 아무것도 하지 않습니다 — 정상 JSON 은 그대로 읽습니다
//    ② 읽기에 실패했을 때만 손질합니다
//         · 글을 앞에서부터 훑으며 「따옴표 안인지 밖인지」를 셉니다
//         · 따옴표 <b>안</b>의 제어문자만 정식 표기로 바꿉니다 (\n \t \u0007 …)
//         · 따옴표 <b>밖</b>의 줄바꿈·들여쓰기는 원래 정상이므로 두십니다
//    ③ 손질했다는 사실을 로그에 남깁니다 — 조용히 넘어가면 모릅니다
//
//  왜 버리지 않고 살리나
//    항목을 통째로 버리면 그날 수집이 0건이 됩니다.
//    제어문자는 눈에 보이지 않는 글자라 지워도 뜻이 상하지 않습니다.
//
//  쓰는 법
//    import { readJson } from './lib/json.mjs';
//    const j = await readJson(res, '위키데이터 음악학교');
// ============================================================

/* 손질한 횟수 — 실행이 끝날 때 한 번 알려주려고 셉니다 */
let _repaired = 0;
export function repairedCount() { return _repaired; }

/* ── 따옴표 안의 제어문자만 정식 표기로 바꿉니다 ──
   
   ★ 따옴표 안인지 밖인지를 왜 세는가
       { "name": "가나\n다" }   ← 이 \n 은 값의 일부. 바꿔야 함
       {\n  "name": "가나" }    ← 이 \n 은 보기 좋으라고 넣은 것. 두어야 함
     둘을 구분하지 않고 모두 지우면 값이 서로 달라붙습니다.

   ★ 역슬래시를 따로 세는 까닭
       "가나\\"  ← 역슬래시 두 개는 <b>역슬래시 한 글자</b>이지 따옴표 시작이 아닙니다.
     이것을 놓치면 안팎 판정이 그 지점부터 통째로 뒤집힙니다. */
export function fixControlChars(s) {
  let out = '', inStr = false, esc = false, hit = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (esc) { out += ch; esc = false; continue; }       // 앞 글자가 역슬래시 → 무조건 통과
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"')  { inStr = !inStr; out += ch; continue; }

    const code = s.charCodeAt(i);
    if (inStr && code < 0x20) {                          // 따옴표 <b>안</b>의 제어문자
      hit++;
      if      (code === 0x0A) out += '\\n';
      else if (code === 0x0D) out += '\\r';
      else if (code === 0x09) out += '\\t';
      else if (code === 0x08) out += '\\b';
      else if (code === 0x0C) out += '\\f';
      else out += '\\u' + code.toString(16).padStart(4, '0');
      continue;
    }

    out += ch;                                           // 그 밖에는 손대지 않습니다
  }

  return { text: out, hit };
}

/* ── 글자열을 JSON 으로 읽습니다 ──
   먼저 그대로 읽어 보고, 실패했을 때만 손질합니다.
   손질해도 안 되면 원래 오류를 그대로 올립니다 — 숨기지 않습니다. */
export function parseJsonSafe(text, label = '') {
  try {
    return JSON.parse(text);
  } catch (e) {
    const msg = String(e && e.message || '');

    /* ── ① 제어문자 (v1 부터 하던 일) ──────────────────────── */
    if (/control character/i.test(msg)) {
      const { text: fixed, hit } = fixControlChars(text);
      const j = JSON.parse(fixed);                 // 또 실패하면 그대로 올라갑니다
      _repaired += hit;
      console.log('    ⚠ 자료원 응답에 깨진 문자 ' + hit + '개가 있어 손질했습니다'
                  + (label ? ' — ' + label : ''));
      return j;
    }

    /* ── ② 답이 <b>중간에서 끊긴</b> 경우 (v2 · 2026-08-21) ───────
       ★ 왜 넓혔나
         학교 수집이 2주째 이 오류로 멈춰 있었습니다 —
           Expected property name or '}' in JSON at position 356050
         v1 은 「control character」 라는 말이 든 오류만 손질하고
         나머지는 그대로 던졌습니다. 그래서 <b>손질조차 해 보지 않고</b>
         890곳이 통째로 날아갔습니다.

       ★ 왜 「끊김」으로 보나
         스크립트가 <b>세 번 다시 시도</b>하는데 세 번 다 <b>같은 자리</b>
         에서 깨졌습니다. 우연한 끊김이면 자리가 달라집니다.
         하지만 어느 쪽이든 <b>받은 데까지는 살릴 수 있습니다.</b>

       ★ 어떻게 살리나
         SPARQL 답은 { head:…, results:{ bindings:[ …, …, … ] } } 꼴입니다.
         마지막으로 <b>온전히 닫힌 항목</b>까지만 잘라 내고 닫아 줍니다.
         ▶ 890곳 중 880곳이라도 들어오는 편이 0곳보다 낫습니다.

       ★ 반드시 <b>몇 개를 잃었는지 알립니다.</b> 조용히 넘어가면
         자료가 새는 줄 모르고 지나갑니다. */
    const salvaged = salvageBindings(text);
    if (salvaged) {
      _repaired += 1;
      console.log('    ⚠ 자료원 응답이 중간에 끊겼습니다 — 받은 '
                  + salvaged.n + '건까지 살렸습니다'
                  + (label ? ' — ' + label : ''));
      console.log('       (원인: ' + msg.slice(0, 60) + ')');
      return salvaged.json;
    }

    throw e;                                        // 살릴 수 없으면 숨기지 않습니다
  }
}

/* ── 끊긴 SPARQL 답에서 온전한 항목까지만 건집니다 ──────────
   ★ 여는 괄호와 닫는 괄호를 세어 <b>깊이 0 으로 돌아온 자리</b>를 찾습니다.
     그 자리가 항목 하나가 온전히 끝난 곳입니다.
   ★ 따옴표 안의 괄호는 세지 않습니다 — 이름에 { } 가 들어 있을 수 있습니다.
   ★ 역슬래시도 봅니다. 안 보면 "\\" 를 따옴표 시작으로 잘못 읽습니다. */
export function salvageBindings(text) {
  const key = '"bindings"';
  const kp = text.indexOf(key);
  if (kp < 0) return null;

  const lb = text.indexOf('[', kp);
  if (lb < 0) return null;

  let depth = 0, inStr = false, esc = false, lastGood = -1, n = 0;

  for (let i = lb + 1; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) { lastGood = i; n++; }        // 항목 하나가 온전히 닫혔습니다
      else if (depth < 0) { lastGood = i - 1; break; } // 배열이 닫힌 자리
    }
  }

  if (lastGood < 0 || n === 0) return null;          // 한 건도 못 건졌습니다

  const head = text.slice(0, lb + 1);
  const body = text.slice(lb + 1, lastGood + 1);
  try {
    return { json: JSON.parse(head + body + ']}}'), n };
  } catch (e2) {
    return null;                                     // 그래도 안 되면 포기합니다
  }
}

/* ── fetch 응답을 JSON 으로 읽습니다 ──
   res.json() 을 이것으로 바꾸면 그만입니다.

   이름을 따로 주지 않으면 <b>응답이 온 주소</b>를 대신 적습니다.
   그래야 나중에 로그만 보고 어느 자료원이 깨졌는지 알 수 있습니다.
   주소는 길고 열쇠가 섞일 수 있어 물음표 앞까지만 남깁니다. */
export async function readJson(res, label = '') {
  let tag = label;
  if (!tag && res && res.url) tag = String(res.url).split('?')[0];
  return parseJsonSafe(await res.text(), tag);
}
