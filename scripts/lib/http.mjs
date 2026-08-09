// ============================================================
// OPUSCLAM 공용 HTTP 유틸 (v1)
//
//  바깥 자료원(OpenAlex · 위키데이터 · 위키백과)을 부를 때 쓰는 공용 함수입니다.
//  수집기마다 같은 코드를 복사해 두면 한 곳을 고쳐도 나머지가 그대로 남습니다.
//  그래서 이 파일 하나만 고치면 모든 수집기에 반영되게 했습니다.
//
//  왜 필요했나
//    GitHub Actions 는 전 세계 사용자가 IP 를 함께 씁니다.
//    남이 쓴 몫까지 합산돼 자료원이 그 IP 를 통째로 막는 일이 있습니다.
//    이때 자료원은 'Retry-After' 로 다시 오라는 시각을 알려주는데,
//    2026-07-29 학술 수집에서 13,162초(3시간 39분)를 요구했습니다.
//    그것을 그대로 기다리다 40분 제한에 걸려 강제 취소됐습니다.
//
//  이 모듈이 하는 일
//    ① 대기 상한 90초 — 그보다 긴 대기를 요구하면 따르지 않습니다
//    ② 실행 예산 25분 — 넘으면 더 부르지 않습니다
//    ③ 연속 실패 3회 — 자료원 전체가 막힌 것으로 보고 멈춥니다
//    ④ 한 번 멈춘 뒤의 호출은 기다리지 않고 바로 돌려보냅니다
//       (수집기가 묶음마다 몇 초씩 쉬며 헛돌지 않게 하려는 것입니다)
//
//  멈춘 뒤에도 수집기는 계속 진행합니다.
//  이 모듈은 바깥 자료원만 담당하고 Supabase 저장은 건드리지 않으므로,
//  그때까지 모은 것은 정상적으로 저장되고 실행은 성공으로 끝납니다.
//  못 채운 몫은 다음 예약 실행에서 다시 받아옵니다.
//
//  쓰는 법
//    import { makeGetJSON, isStop, sleep, stopReason } from './lib/http.mjs';
//    const getJSON = makeGetJSON({ ua: UA, accept: 'application/json' });
//    ...
//    main().catch(e => {
//      if (isStop(e)) { console.log('■ 자료원이 막혀 여기까지 · 다음 예약에 이어서'); return; }
//      console.error('■ 실패:', e); process.exit(1);
//    });
// ============================================================

import { readJson } from './json.mjs';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MAX_WAIT_MS   = 90 * 1000;            // ① 대기 상한
const BUDGET_MS     = 25 * 60 * 1000;       // ② 실행 예산 (워크플로 제한보다 넉넉히 안쪽)
const FAIL_LIMIT    = 3;                    // ③ 서로 다른 요청이 이만큼 완전히 실패하면 멈춤
const BACKOFF       = [5000, 15000, 30000, 60000, 90000];

const STARTED = Date.now();

// 멈춤 상태는 모듈 하나에 모아 둡니다.
// 한 수집기가 자료원 두 곳을 부르더라도 상태를 함께 보게 하려는 것입니다.
let _stop = null;
let _hardFails = 0;

export class RateLimitStop extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'RateLimitStop';
    this.stop = true;                       // isStop 이 이것을 봅니다
  }
}

// 수집기가 '멈춤 신호'와 '보통 오류'를 구분할 때 씁니다.
export function isStop(e) { return !!(e && e.stop === true); }

// 멈춘 까닭 (안 멈췄으면 null)
export function stopReason() { return _stop; }

// 남은 시간 (분)
export function budgetLeftMin() {
  return Math.max(0, Math.round((BUDGET_MS - (Date.now() - STARTED)) / 60000));
}

function raiseStop(reason) {
  if (!_stop) {
    _stop = reason;
    console.log('■ 바깥 자료원 호출을 멈춥니다 · ' + reason);
    console.log('  모은 것까지 저장하고 정상 종료합니다. 다음 예약 실행에서 이어서 받아옵니다.');
  }
  throw new RateLimitStop(reason);
}

// ── 공용 조회 함수 만들기 ────────────────────────────────────
//  opt.ua      · User-Agent (자료원이 우리를 식별하는 값 · 예의상 반드시 넣습니다)
//  opt.accept  · Accept 헤더 ('application/json' · SPARQL 은 'application/sparql-results+json')
//  opt.tries   · 재시도 횟수 (기본 5)
//  opt.label   · 로그에 붙일 이름 (없어도 됩니다)
export function makeGetJSON(opt = {}) {
  const ua      = opt.ua || 'OpusclamBot/1.0 (https://opusclam.com; cser@wixon.co.kr)';
  const accept  = opt.accept || 'application/json';
  const tries0  = opt.tries || 5;
  const backoff = opt.backoff || BACKOFF;
  const maxWait = opt.maxWaitMs || MAX_WAIT_MS;
  const budget  = opt.budgetMs || BUDGET_MS;

  return async function getJSON(url, triesOverride) {
    // ④ 이미 멈춘 뒤라면 기다리지 않고 바로 돌려보냅니다
    if (_stop) throw new RateLimitStop(_stop);

    const tries = triesOverride || tries0;
    let last = null;

    for (let i = 0; i < tries; i++) {
      // ② 실행 예산
      if (Date.now() - STARTED > budget) {
        raiseStop('실행 시간 예산 ' + Math.round(budget / 60000) + '분을 넘겼습니다');
      }

      try {
        const r = await fetch(url, { headers: { 'User-Agent': ua, Accept: accept } });

        if (r.status === 429 || r.status >= 500) {
          const ra    = Number(r.headers.get('retry-after'));
          const asked = ra > 0 ? ra * 1000 : 0;

          // ① 자료원이 요구한 대기가 상한을 넘으면 따르지 않습니다
          if (asked > maxWait) {
            const mm = Math.round(asked / 60000);
            raiseStop('자료원이 ' + (mm >= 1 ? mm + '분' : Math.round(asked / 1000) + '초')
                      + ' 뒤에 오라고 합니다 · HTTP ' + r.status
                      + ' (상한 ' + Math.round(maxWait / 1000) + '초를 넘어 기다리지 않습니다)');
          }

          const wait = asked || backoff[i] || maxWait;
          last = new Error('HTTP ' + r.status);

          if (i < tries - 1) {
            console.log('    (' + r.status + ' · ' + Math.round(wait / 1000) + '초 기다린 뒤 다시 시도 '
                        + (i + 2) + '/' + tries + ')');
            await sleep(wait);
            continue;
          }
          throw last;
        }

        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
        return await readJson(r);

      } catch (e) {
        if (isStop(e)) throw e;             // 멈춤 신호는 그대로 위로 올립니다
        last = e;
        if (i === tries - 1) break;
        if (!/HTTP (429|5\d\d)/.test(String(e.message))) await sleep(backoff[i] || 30000);
      }
    }

    // ③ 재시도를 모두 소진한 요청이 거듭되면 자료원 전체가 막힌 것으로 봅니다
    _hardFails++;
    if (_hardFails >= FAIL_LIMIT) {
      raiseStop('요청 ' + _hardFails + '건이 재시도를 모두 소진했습니다 (자료원이 막힌 것으로 봅니다)');
    }
    throw last || new Error('요청 실패');
  };
}
