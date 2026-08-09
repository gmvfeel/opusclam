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
    if (!/control character/i.test(String(e.message))) throw e;   // 다른 이유의 실패는 손대지 않음

    const { text: fixed, hit } = fixControlChars(text);
    const j = JSON.parse(fixed);                                  // 여기서 또 실패하면 그대로 올라갑니다

    _repaired += hit;
    console.log('    ⚠ 자료원 응답에 깨진 문자 ' + hit + '개가 있어 손질했습니다'
                + (label ? ' — ' + label : ''));
    return j;
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
