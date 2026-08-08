/* ============================================================
   OPUSCLAM 인물 지우기 — assets/admin-person-delete.js
   ------------------------------------------------------------
   ★ 왜 공용 모듈로 뺐나 (2026-08-08 · 파트너 지적)
     인물을 지우는 코드가 <b>admin.html 과 db-audit.html 두 곳</b>에
     따로 있었습니다. 그래서 이런 일이 났습니다.

       2026-08-04  admin.html 에만 「현대음악DB 도 함께 지우기」를 넣음
       2026-08-08  db-audit.html 로 야니를 지웠더니
                   현대음악DB 에 그대로 남아 사용자단에 계속 보임

     db-audit.html 에는 <b>차단 목록 등록도 빠져</b> 있어서,
     지운 사람이 다음 수집에 다시 들어올 상태였습니다.

     같은 판단을 여러 파일에 적으면 반드시 어긋납니다.
     이제 두 화면이 이 파일 하나를 부릅니다.

   ────────────────────────────────────────────────────────────
   ★ 지우는 차례 — 바꾸지 마십시오. 하나하나 이유가 있습니다.

     ① 차단 목록(blocklist)에 위키데이터 번호를 먼저 넣습니다
        차단이 실패하면 <b>아무것도 지우지 않고 멈춥니다.</b>
        「지웠는데 다음 수집에 또 들어오는」 것이 가장 나쁩니다.

     ② 현대음악DB(modern_composers)를 지웁니다
        ★ 인물보다 <b>먼저</b>여야 합니다.
          modern_composers.person_id 는 on delete set null 이라
          인물을 먼저 지우면 person_id 가 null 이 되어
          어느 줄이 그 사람인지 알 수 없게 됩니다.
        ★ 두 가지로 찾습니다 — person_id 로 이어진 줄 + 이름이 같은 줄
          (이어지지 않은 줄이 90개 넘게 있습니다)

     ③ 관계(entity_links)를 양쪽 방향으로 지웁니다

     ④ 마지막에 인물을 지웁니다

   ★ .select('id') 를 반드시 붙입니다
     Supabase 는 줄 보안(RLS)이 막으면 <b>오류 없이 0줄</b>을 지웁니다.
     붙이지 않으면 「지웠습니다」라고 알리고도 그대로 남습니다.
     (2026-08-04 · 현대음악DB 정제에서 겪은 함정)
   ============================================================ */
window.OCPersonDelete = (function () {
  'use strict';

  /**
   * 인물을 지웁니다.
   *
   * @param {object} sb    supabase 클라이언트 (window.__ocSb)
   * @param {Array}  rows  지울 인물 [{ id, wikidata_id, name_ko }]
   * @param {object} opt   { log: function(문자열), block: true/false }
   *                       block 을 false 로 주면 차단 목록에 넣지 않습니다
   *                       (되돌릴 수 있는 임시 정리에만 쓰십시오)
   * @returns {Promise<object>}
   *          { ok, gone, mcGone, linkOk, blocked, error }
   */
  async function run(sb, rows, opt) {
    opt = opt || {};
    const log = typeof opt.log === 'function' ? opt.log : function () {};
    const doBlock = opt.block !== false;

    const list = (rows || []).filter(function (p) { return p && p.id; });
    if (!list.length) {
      return { ok: false, gone: 0, mcGone: 0, linkOk: 0, blocked: 0, error: '지울 대상이 없습니다' };
    }

    const ids = list.map(function (p) { return p.id; });

    /* ── ① 차단 목록 ─────────────────────────────────────
       ★ 같은 번호를 한 번만 보냅니다.
         같은 번호가 두 번 들어가면 PostgreSQL 이 이렇게 거절합니다 —
           ON CONFLICT DO UPDATE command cannot affect row a second time
         같은 인물이 인물DB 에 중복으로 담겨 있으면 이 일이 납니다.
       ★ blocklist 는 wikidata_id 한 칸만 넣습니다.
         없는 칸을 넣으면 통째로 실패해 차단이 안 된 채 멈춥니다. */
    let blocked = 0;
    if (doBlock) {
      const seen = {};
      const wids = [];
      let dup = 0;
      list.forEach(function (p) {
        const w = p.wikidata_id && String(p.wikidata_id).trim();
        if (!w) return;
        if (seen[w]) { dup++; return; }
        seen[w] = 1;
        wids.push({ wikidata_id: w });
      });
      if (dup) log('  같은 위키데이터 번호 ' + dup + '개를 한 번으로 묶었습니다');

      if (wids.length) {
        const br = await sb.from('blocklist').upsert(wids, { onConflict: 'wikidata_id' });
        if (br.error) {
          log('  ✗ 차단 목록 등록 실패 — 아무것도 지우지 않았습니다');
          return {
            ok: false, gone: 0, mcGone: 0, linkOk: 0, blocked: 0,
            error: '차단 목록 등록에 실패해서 삭제하지 않았습니다.\n'
                 + br.error.message
                 + '\n\n지우기만 하면 다음 수집에서 다시 들어옵니다.'
          };
        }
        blocked = wids.length;
        log('  차단 목록 ' + blocked + '건 등록');
      } else {
        log('  ※ 위키데이터 번호가 없어 차단하지 못했습니다 (수집으로 다시 들어올 수 있습니다)');
      }
    }

    /* ── ② 현대음악DB — 인물보다 먼저 ────────────────────── */
    let mcGone = 0;
    try {
      for (let i = 0; i < ids.length; i += 200) {
        const part = ids.slice(i, i + 200);
        const mc1 = await sb.from('modern_composers').delete()
          .in('person_id', part).select('id');
        if (!mc1.error) mcGone += (mc1.data && mc1.data.length) || 0;
      }

      /* 이어지지 않은 줄은 이름으로 찾습니다 */
      const names = [];
      list.forEach(function (p) {
        const nm = (p.name_ko || '').trim();
        if (nm && names.indexOf(nm) < 0) names.push(nm);
      });
      for (let i = 0; i < names.length; i += 100) {
        const part = names.slice(i, i + 100);
        const mc2 = await sb.from('modern_composers').delete()
          .in('name_ko', part).select('id');
        if (!mc2.error) mcGone += (mc2.data && mc2.data.length) || 0;
      }
    } catch (e) {
      log('  ※ 현대음악DB 삭제 중 문제 — ' + (e.message || e));
    }
    if (mcGone) log('  현대음악DB ' + mcGone + '줄 함께 삭제');

    /* ── ③ 관계 ──────────────────────────────────────────── */
    let linkOk = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const part = ids.slice(i, i + 200);
      const d1 = await sb.from('entity_links').delete().eq('from_type', 'person').in('from_id', part);
      const d2 = await sb.from('entity_links').delete().eq('to_type', 'person').in('to_id', part);
      if (!d1.error && !d2.error) linkOk++;
    }

    /* ── ④ 인물 ──────────────────────────────────────────── */
    let gone = 0;
    let err = null;
    for (let i = 0; i < ids.length; i += 200) {
      const part = ids.slice(i, i + 200);
      const r = await sb.from('persons').delete().in('id', part).select('id');
      if (r.error) { err = r.error.message; log('  ✗ ' + r.error.message); continue; }
      gone += (r.data && r.data.length) || 0;
    }

    if (!err && gone === 0) {
      return {
        ok: false, gone: 0, mcGone: mcGone, linkOk: linkOk, blocked: blocked,
        error: '삭제가 한 줄도 되지 않았습니다.\n\n'
             + '오류는 없었지만 0줄이 지워졌습니다 — 줄 보안(RLS)이 막은 것입니다.\n'
             + 'Supabase 는 지우기 정책이 없으면 오류 없이 0줄을 지웁니다.\n\n'
             + (blocked ? '차단 목록에는 올라갔으므로 다음 수집에서는 안 들어옵니다.' : '')
      };
    }

    log('✅ 인물 ' + gone + '명 삭제'
      + (mcGone ? ' · 현대음악DB ' + mcGone + '줄' : '')
      + (blocked ? ' · 차단 ' + blocked + '건' : ''));

    return { ok: !err, gone: gone, mcGone: mcGone, linkOk: linkOk, blocked: blocked, error: err };
  }

  return { run: run };
})();
