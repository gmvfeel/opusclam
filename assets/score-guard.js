/* ============================================================
   OPUSCLAM  악보 PDF 저작권 판별 엔진   assets/score-guard.js

   무엇을 하는가
     악보 PDF 를 읽어 <b>올려도 되는지</b> 를 가려 줍니다.
     출판사 이름 · 판권 문구 · 자유 저장소 표시를 찾고,
     작곡가 사망연도와 견주어 넷 가운데 하나로 판정합니다.

       ok     올려도 됨      자유 저장소 표시를 확인했습니다
       maybe  올려도 될 듯   작곡가 사후 70년 지남 · 출판사 표시 없음
       wa     확인 필요      단서가 없거나 글자를 읽지 못했습니다
       no     올리면 안 됨   대여 악보 · 최근 판권 · 현대 출판사 판본

   ★ 왜 별도 파일인가
     이 판별을 쓰는 곳이 둘입니다.
       admin/score-check.html   내 컴퓨터의 악보를 미리 훑을 때
       admin/score-review.html  회원이 올린 악보를 검수할 때
     같은 코드를 두 파일에 복사해 두면 한 곳을 고쳐도 나머지가
     그대로 남습니다. 오늘 loadAll 이 네 파일에 복사돼 있어 네 곳 다
     같은 버그였던 일을 겪었으므로 처음부터 밖으로 냅니다.

   ★ 이것은 법률 자문이 아닙니다
     사람의 판단을 <b>돕는</b> 도구입니다. maybe 와 wa 는 반드시
     눈으로 보셔야 합니다.

   ★ 쓰기 전에 pdf.js 를 실어 주십시오
     <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

   쓰는 법
     OCScoreGuard.setComposers(idx);          // 이름 → 사망연도 (없어도 됩니다)
     var r = await OCScoreGuard.check(fileOrBlob, '파일 경로');
     var r = await OCScoreGuard.checkUrl(url); // 인터넷에 있는 PDF
     r.judge · r.reasons · r.text
   ============================================================ */
(function () {
  'use strict';

  var PUB_MODERN = [
    'g. henle','henle verlag','henle',
    'edition peters','c.f. peters','peters edition',
    'bärenreiter','baerenreiter','barenreiter',
    'wiener urtext','universal edition','universal-edition',
    'boosey','hawkes','schott music','schott mainz',
    'g. schirmer','schirmer','hal leonard','alfred music','alfred publishing',
    'ricordi','durand','salabert','leduc','eschig','billaudot',
    'carus-verlag','carus verlag','sikorski','chester music','novello',
    'faber music','oxford university press','stainer & bell','bosworth',
    'edition wilhelm hansen','musikverlag','breitkopf urtext','urtext edition',
    /* 국내 */ '음악춘추','세광음악출판사','태림스코어','현대음악출판사','아름출판사'
  ];

  var PUB_OLD = [
    'breitkopf','härtel','haertel','litolff','augener','schlesinger',
    'kalmus','dover','edwin f. kalmus','luck','broude'
  ];

  var FREE_MARK = [
    'imslp','petrucci music library','petrucci',
    'creative commons','public domain','mutopia','cpdl',
    'choral public domain library','openscore','musescore',
    'gemeinfrei','domaine public'
  ];

  var RE_COPY = /(?:©|\(c\)|copyright)\s*(?:by\s*)?((?:19|20)\d{2})/gi;
  var RE_ARR  = /all\s+rights\s+reserved|무단\s*(전재|복제)|저작권자?\s*동의/i;
  var RE_HIRE = /performance\s+material.*hire|rental\s+(?:score|material)|대여\s*악보/i;

  var YEAR_SAFE_DEATH = 2026 - 70;
  var YEAR_COPY_RISK  = 1930;

  /* ── 작곡가 사망연도 색인 ─────────────────────────────────
     화면 쪽에서 인물DB 를 받아 넣어 줍니다. 넣지 않으면 작곡가
     대조를 하지 않고, 그만큼 「확인 필요」 가 늘어납니다. */
  var COMPOSERS = null;
  function setComposers(idx){ COMPOSERS = idx || null; }

  function findComposer(pathText){
    if (!COMPOSERS) return null;
    var s = String(pathText || '').toLowerCase().replace(/[^a-z가-힣]+/g, ' ');
    var words = s.split(' ').filter(function(w){ return w.length >= 4; });
    /* 긴 낱말부터 봅니다 — beethoven 이 beet 보다 확실합니다 */
    words.sort(function(a,b){ return b.length - a.length; });
    for (var i = 0; i < words.length; i++){
      if (words[i] in COMPOSERS) return { key: words[i], death: COMPOSERS[words[i]] };
    }
    return null;
  }

  /* ── PDF 에서 글자를 뽑습니다 ─────────────────────────────
     ★ 앞 두 장과 <b>마지막 장</b>만 읽습니다. 판권 표시는 거의 앞머리에
       있고, IMSLP 표시는 마지막 장 하단에 찍히기 때문입니다.
       전체를 읽으면 7GB 에 몇 시간이 걸립니다. */
  async function extract(data){
    var pdf = null, out = { text: '', pages: 0, ok: false };
    try {
      pdf = await window.pdfjsLib.getDocument({ data: data, disableAutoFetch: true }).promise;
      out.pages = pdf.numPages;
      var metaTxt = '';
      try {
        var meta = await pdf.getMetadata();
        if (meta && meta.info){
          ['Title','Author','Subject','Keywords','Creator','Producer'].forEach(function(k){
            if (meta.info[k]) metaTxt += ' ' + meta.info[k];
          });
        }
      } catch(e){}
      var pageTxt = '';
      var n = Math.min(2, pdf.numPages);
      for (var p = 1; p <= n; p++){
        try {
          var pg = await pdf.getPage(p);
          var tc = await pg.getTextContent();
          pageTxt += ' ' + tc.items.map(function(x){ return x.str; }).join(' ');
          pg.cleanup();
        } catch(e){}
      }
      if (pdf.numPages > 2){
        try {
          var last = await pdf.getPage(pdf.numPages);
          var lc = await last.getTextContent();
          pageTxt += ' ' + lc.items.map(function(x){ return x.str; }).join(' ');
          last.cleanup();
        } catch(e){}
      }
      out.text = (metaTxt + ' ' + pageTxt).replace(/\s+/g, ' ').trim();
      out.ok = true;
    } finally {
      if (pdf){ try { await pdf.destroy(); } catch(e){} }
    }
    return out;
  }

  /* ── 판정 ─────────────────────────────────────────────────
     순서가 중요합니다 — <b>위험을 먼저</b> 봅니다.
     안전 신호가 있어도 대여 악보 표시가 있으면 올릴 수 없습니다. */
  function judge(all, pathText){
    var res = { judge: 'wa', reasons: [] };
    var low = String(all || '').toLowerCase();
    /* 악보 표지는 제목·작곡가만 있어 짧을 수 있으므로 25자로 둡니다 */
    var hasText = String(all || '').replace(/\s/g, '').length > 25;

    var free   = FREE_MARK.filter(function(k){ return low.indexOf(k) >= 0; });
    var modern = PUB_MODERN.filter(function(k){ return low.indexOf(k) >= 0; });
    var old    = PUB_OLD.filter(function(k){ return low.indexOf(k) >= 0; });
    var years = [], m2;
    RE_COPY.lastIndex = 0;
    while ((m2 = RE_COPY.exec(all)) !== null){ years.push(parseInt(m2[1], 10)); }
    var maxYear = years.length ? Math.max.apply(null, years) : null;
    var arr  = RE_ARR.test(all);
    var hire = RE_HIRE.test(all);
    var comp = findComposer(pathText);

    if (hire){
      res.judge = 'no';
      res.reasons.push('대여 악보 표시 — 판매·배포가 금지된 자료입니다');
    } else if (maxYear && maxYear >= YEAR_COPY_RISK){
      res.judge = 'no';
      res.reasons.push('판권 표시 © ' + maxYear + ' — ' + YEAR_COPY_RISK + '년 이후입니다');
      if (modern.length) res.reasons.push('출판사: ' + modern.slice(0,2).join(', '));
    } else if (modern.length && !free.length){
      res.judge = 'no';
      res.reasons.push('현대 출판사 판본으로 보입니다: ' + modern.slice(0,2).join(', '));
      res.reasons.push('작곡가가 퍼블릭 도메인이어도 <b>이 판본의 조판</b>에 저작권이 있습니다');
    } else if (arr && !free.length){
      res.judge = 'no';
      res.reasons.push('무단전재 금지 문구가 있습니다');
    } else if (free.length){
      res.judge = 'ok';
      res.reasons.push('자유 저장소 표시: ' + free.slice(0,2).join(', '));
      if (comp && comp.death) res.reasons.push('작곡가 사망 ' + comp.death + '년');
    } else if (comp && comp.death && comp.death <= YEAR_SAFE_DEATH && !old.length && hasText){
      res.judge = 'maybe';
      res.reasons.push('작곡가 사망 ' + comp.death + '년 (사후 70년 지남)');
      res.reasons.push('출판사·판권 표시를 찾지 못했습니다 — <b>판본을 한 번 확인해 주십시오</b>');
    } else {
      res.judge = 'wa';
      if (!hasText) res.reasons.push('글자를 읽지 못했습니다 — 그림으로만 된 스캔입니다');
      if (old.length) res.reasons.push('예전 출판사 이름: ' + old.slice(0,2).join(', ')
        + ' (19세기 판이면 자유일 수 있습니다)');
      if (comp && comp.death && comp.death > YEAR_SAFE_DEATH)
        res.reasons.push('작곡가 사망 ' + comp.death + '년 — <b>사후 70년이 안 지났습니다</b>');
      if (comp && !comp.death) res.reasons.push('작곡가가 생존 중이거나 사망연도를 모릅니다');
      if (!comp) res.reasons.push('이름에서 작곡가를 찾지 못했습니다');
      if (maxYear) res.reasons.push('판권 표시 © ' + maxYear);
      if (!res.reasons.length) res.reasons.push('판단할 단서가 없습니다');
    }
    return res;
  }

  /* ── 파일 하나 검사 (내 컴퓨터의 파일) ────────────────────── */
  async function check(file, pathText){
    var res = { name: file.name || '', path: pathText || file.name || '',
                size: file.size || 0, pages: 0, judge: 'wa', reasons: [], text: '' };
    try {
      var buf = await file.arrayBuffer();
      var ex = await extract(buf);
      res.pages = ex.pages;
      res.text = ex.text.slice(0, 400);
      var j = judge(ex.text, res.path);
      res.judge = j.judge; res.reasons = j.reasons;
    } catch (e){
      res.judge = 'wa';
      res.reasons = ['PDF 를 열지 못했습니다: ' + String(e.message || e).slice(0, 80)];
    }
    return res;
  }

  /* ── 인터넷에 있는 PDF 검사 (회원이 올린 것) ────────────────
     ★ 저장소에서 받아 브라우저 안에서만 읽습니다. 다른 곳으로
       보내지 않습니다. */
  async function checkUrl(url, pathText){
    var res = { name: '', path: pathText || url, size: 0, pages: 0,
                judge: 'wa', reasons: [], text: '' };
    try {
      var r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var buf = await r.arrayBuffer();
      res.size = buf.byteLength;
      var ex = await extract(buf);
      res.pages = ex.pages;
      res.text = ex.text.slice(0, 400);
      var j = judge(ex.text, res.path);
      res.judge = j.judge; res.reasons = j.reasons;
    } catch (e){
      res.judge = 'wa';
      res.reasons = ['PDF 를 받아 오지 못했습니다: ' + String(e.message || e).slice(0, 80)];
    }
    return res;
  }

  var LABEL = { ok:'올려도 됨', maybe:'올려도 될 듯', wa:'확인 필요', no:'올리면 안 됨' };

  window.OCScoreGuard = {
    setComposers: setComposers,
    check: check,
    checkUrl: checkUrl,
    judge: judge,          /* 이미 뽑아 둔 글자로 판정만 하고 싶을 때 */
    LABEL: LABEL,
    lists: { modern: PUB_MODERN, old: PUB_OLD, free: FREE_MARK },
    YEAR_SAFE_DEATH: YEAR_SAFE_DEATH,
    YEAR_COPY_RISK: YEAR_COPY_RISK
  };
})();
