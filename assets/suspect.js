/* ============================================================
   OPUSCLAM  음악인 판정 엔진        assets/suspect.js

   무엇을 하는가
     한 사람이 <b>클래식 음악과 얼마나 관계있는지</b>를 점수로 셉니다.
     점수가 <b>높을수록 음악과 무관</b>합니다.

   ★ 왜 별도 파일인가
     이 판정을 쓰는 곳이 둘입니다.
       admin/admin.html     인물DB 에 있는 사람을 걸러낼 때
       admin/blocklist.html 차단 목록에 잘못 들어간 사람을 찾을 때
     같은 함수를 두 파일에 복사해 두면, 한 곳을 고쳐도 나머지가 그대로
     남습니다. 오늘 loadAll 함수가 네 파일에 복사돼 있어 네 곳 다 같은
     버그였던 일을 겪었습니다. 그래서 처음부터 밖으로 냅니다.

   점수 매기는 법
     위키데이터 직업(비음악)   + 4점  (여러 개면 여러 번)
     위키데이터 직업(음악)     − 4점
     위키데이터 장르가 클래식  − 5점  (겸업 보호)
     유명 비음악인 이름        + 5점
     소개문 비음악 낱말        + 2점
     소개문 음악 낱말          − 1점  (약하게)
     persons.field             <b>점수 없음</b>

   ★ field 로는 점수를 매기지 않습니다
     field 는 우리가 직업에서 짐작해 만든 값입니다. 잘못 들어온 인물은
     field 도 잘못돼 있으므로, 그것으로 점수를 깎으면
     「음악학으로 분류됐으니 음악인」 이라는 순환 논리가 됩니다.
     실제로 그렇게 두었더니 9,346명 가운데 걸린 사람이 0명이었습니다.

   쓰는 법
     var r = OCSuspect.score({
       name_ko: '...', name_en: '...',
       wd_occupation: 'novelist, writer',   // 위키데이터 직업
       wd_genre: 'classical music',         // 위키데이터 장르
       description: '...', works: '...', field: '작곡'
     });
     r.flag     의심(3점 이상)인가
     r.score    점수 (음수면 음악인 쪽)
     r.noBasis  판단할 근거가 아예 없는가
     r.reason   사람이 읽을 근거 설명
   ============================================================ */
(function () {
  'use strict';

  var MG_NONMUSIC=[
    /* 정치·행정 */ '정치인','정치가','대통령','국회의원','장관','시장','주지사','도지사','의원','총리','서기장',
    /* 영상·연예 */ '영화배우','탤런트','영화감독','드라마','예능','개그맨','코미디언','희극','연기자','배우','아나운서','방송인','성우','유튜버','인플루언서','모델','기자',
    /* 대중음악 */ '아이돌','래퍼','힙합','걸그룹','보이그룹','트로트','인디밴드','록밴드','아이돌 그룹','가수',
    /* 문학·미술 */ '소설가','시인','수필가','만화가','웹툰','화가','조각가','건축가',
    /* 체육 */ '축구','야구','농구','배구','골프','테니스','운동선수','격투기','씨름','태권도',
    /* 학문·사업 */ '물리학자','과학자','수학자','철학자','경제학자','역사학자','법학자','의사','변호사','기업인','사업가','최고경영자','종교인','목사','신부','스님',
    /* 그 밖 */ '강사','유아교육','난타','마술사','요리사','승무원'
  ];

  var MG_MUSIC=[
    '작곡가','작곡','편곡','지휘자','지휘','연주자','피아니스트','바이올리니스트','첼리스트',
    '비올리스트','플루티스트','오보이스트','클라리네티스트','트럼페터','호르니스트','타악기',
    '오르가니스트','하피스트','기타리스트','콘트라베이스','성악가','소프라노','메조소프라노',
    '알토','테너','바리톤','바스','베이스','가곡','오페라','교향곡','협주곡','실내악','현악사중주',
    '음악학자','음악학','음악사','음악평론','음악교육','음악원','음악대학','음대','콘서바토리',
    '관현악','교향악단','오케스트라','합창단','합창','실내악단','독주회','리사이틀','음악감독',
    '클래식','고전음악','현대음악','국악','작품번호','피아노','바이올린','첼로','비올라','오르간','하프시코드',
    /* 이론·직역 낱말 — 아리스토크세노스(고대 음악이론가)가 「철학자」 때문에
       걸렸습니다. 「음악이론가」 가 목록에 없어서였습니다. */
    '음악이론','음악이론가','이론가','악장','칸토르','편곡가','반주자','악보','대위법',
    '화성학','솔페주','음향학','음악감독','예술감독','악단','교향악단','필하모닉','앙상블'
  ];

  var MG_OCC_BAD=[
    'novelist','writer','author','poet','playwright','essayist','translator',
    'politician','statesman','diplomat','president','minister','mayor','senator',
    'physician','surgeon','psychiatrist','dentist','veterinarian','nurse',
    'painter','sculptor','architect','photographer','illustrator','designer',
    'actor','actress','film director','television presenter','comedian','model',
    'journalist','editor','publisher','critic of literature',
    'philosopher','theologian','mathematician','physicist','chemist','biologist',
    'economist','historian','sociologist','psychologist','linguist','archaeologist',
    'lawyer','judge','jurist','businessperson','entrepreneur','banker','engineer',
    'athlete','footballer','chess player','cyclist','boxer','swimmer',
    'military officer','soldier','police officer','priest','pastor','rabbi','imam',
    'rapper','disc jockey','youtuber','influencer','chef','magician',
    /* 대중음악 쪽 직업 — 클래식 타악기는 percussionist · timpanist 로
       따로 있으므로 drummer 는 대중음악으로 봅니다. */
    'drummer','bass guitarist','session musician','record producer',
    'religious leader','cult leader','televangelist',
    'streamer','esports player','voice actor','dancer','choreographer'
  ];

  var MG_OCC_GOOD=[
    'composer','conductor','musician','pianist','violinist','violist','cellist',
    'double bassist','organist','harpsichordist','harpist','guitarist','lutenist',
    'flautist','flutist','oboist','clarinetist','bassoonist','saxophonist',
    'trumpeter','horn player','trombonist','tubist','percussionist','timpanist',
    /* ★ 'singer' 는 <b>넣지 않습니다.</b> 대중가수도 singer 입니다.
       클래식 성악가는 opera singer · soprano · tenor 처럼 갈라져 있고,
       그것으로도 안 잡히면 wd_genre 의 opera · classical music 이나
       소개문의 「성악가」·「소프라노」 가 대신 지켜 줍니다.
       'singer' 를 넣었더니 「가수·유아음악 강사·난타강사」 인 인물이
       −4점을 받아 빠져나갔습니다. */
    'opera singer','classical singer','lieder singer','concert singer',
    'soprano','mezzo-soprano','contralto','alto',
    'tenor','baritone','bass','countertenor','chorister','choirmaster',
    'musicologist','music theorist','music historian','music critic','music teacher',
    'music educator','music director','orchestrator','arranger','music publisher',
    'concertmaster','répétiteur','accompanist','kapellmeister','cantor','organ builder'
  ];

  var MG_GENRE_CLASSICAL=[
    'classical music','art music','opera','operetta','oratorio','chamber music',
    'symphony','concerto','sonata','baroque music','renaissance music',
    'romantic music','contemporary classical music','choral music','sacred music',
    'church music','lieder','art song','ballet','early music','serialism',
    'twelve-tone technique','minimal music','electroacoustic music'
  ];

  /* ★ <b>비클래식 장르</b> — 클래식이 아닌 음악 갈래입니다.

     왜 필요했나 (2026-08-03 차단 목록을 검토하다 드러났습니다)
       예전에는 클래식 장르에만 점수를 깎고, <b>비클래식 장르에는 아무
       점수도 주지 않았습니다.</b> 그래서
         이루마        직업 pianist  · 장르 new-age music     → 음악 4점(통과)
         키쿠타 히로키  직업 composer · 장르 video game music → 음악 4점(통과)
       처럼 직업이 음악이면 장르가 무엇이든 지켜졌습니다.
       클래식 포털에 뉴에이지·게임음악이 남는 셈입니다.

     그래서 비클래식 장르에 <b>+8점</b>을 줍니다. 클래식 장르(−5)와
     음악 직업(−4)이 함께 있는 <b>겸업</b>은 여전히 지켜집니다 —
     클래식 작곡가가 영화음악도 쓴 경우 +8 −5 −4 = −1 이 되어 통과합니다. */
  var MG_GENRE_NONCLASSICAL=[
    'pop music','rock music','rock and roll','heavy metal','punk rock','indie rock',
    'jazz','blues','soul music','funk','disco','hip hop music','rap','trap music',
    'electronic music','electronic dance music','house music','techno','trance',
    'new-age music','ambient music','lounge music','easy listening',
    'video game music','anime music','k-pop','j-pop','c-pop','trot',
    'country music','folk music','reggae','latin music','salsa music',
    'gospel music','contemporary christian music','worship music',
    'musical theatre','film score','television music','advertising music'
  ];
  var MG_FIELD_MUSIC=['작곡','연주','지휘','성악','음악학','음악교육'];

  var MG_FAMOUS=['아인슈타인','einstein','클린턴','clinton','톰 크루즈','tom cruise','트럼프','trump','오바마','obama','푸틴','putin','만델라','mandela','간디','gandhi','링컨','lincoln','케네디','kennedy','처칠','churchill','나폴레옹','napoleon','괴테','goethe','펠레','pel\u00e9','조던','jordan','히틀러','hitler'];

  function score(p) {
    /* ★ 점수 매기는 순서 — <b>믿을 만한 근거를 무겁게</b> 봅니다.

         위키데이터 직업(비음악)   + 4점  (여러 개면 여러 번)
         위키데이터 직업(음악)     − 4점
         위키데이터 장르가 클래식  − 5점  (겸업 보호)
         유명 비음악인 이름        + 5점
         소개문 비음악 낱말        + 2점
         소개문 음악 낱말          − 1점  (약하게 — 소개문에는 「음악」 이 흔히 섞입니다)
         persons.field             <b>점수 없음</b> (믿을 수 없는 근거)

       합이 3점 이상이면 의심으로 표시합니다.

       ★ 왜 field 로 점수를 깎지 않는가
         알레산드로 바리코(소설가)의 field 는 「음악학」, 테오도어 빌로트
         (외과의사)의 field 는 「연주」 로 되어 있습니다. field 가 잘못
         들어왔기 때문에 이 사람들이 인물DB 에 있는 것인데, 그 값으로
         점수를 깎으면 <b>영원히 걸러지지 않습니다.</b>
         실제로 그렇게 두었더니 9,346명 가운데 의심이 <b>0명</b>이었습니다. */
    var occ  = String(p.wd_occupation || '').toLowerCase();
    var gen  = String(p.wd_genre || '').toLowerCase();
    var text = ((p.description || '') + ' ' + (p.works || '')).toLowerCase();
    var name = ((p.name_ko || '') + ' ' + (p.name_en || '')).toLowerCase();
    var score = 0, bad = [], good = [];

    /* 유명 비음악인 — 이름으로 걸립니다 */
    for (var i=0; i<MG_FAMOUS.length; i++){
      if (name.indexOf(MG_FAMOUS[i]) >= 0){ score += 5; bad.push('유명 비음악인'); break; }
    }

    /* 위키데이터 직업 — 가장 믿을 만한 근거 */
    var hitOccBad = [];
    for (var a=0; a<MG_OCC_BAD.length; a++){
      if (occ.indexOf(MG_OCC_BAD[a]) >= 0){ score += 4; hitOccBad.push(MG_OCC_BAD[a]); }
    }
    if (hitOccBad.length) bad.push('직업: ' + hitOccBad.slice(0,3).join('·')
      + (hitOccBad.length>3 ? ' 외 '+(hitOccBad.length-3) : ''));

    var hitOccGood = [];
    for (var b2=0; b2<MG_OCC_GOOD.length; b2++){
      if (occ.indexOf(MG_OCC_GOOD[b2]) >= 0){ score -= 4; hitOccGood.push(MG_OCC_GOOD[b2]); }
    }
    if (hitOccGood.length) good.push('직업: ' + hitOccGood.slice(0,3).join('·')
      + (hitOccGood.length>3 ? ' 외 '+(hitOccGood.length-3) : ''));

    /* 클래식 장르가 있으면 겸업으로 보고 지킵니다 */
    var hitGen = [];
    for (var c=0; c<MG_GENRE_CLASSICAL.length; c++){
      if (gen.indexOf(MG_GENRE_CLASSICAL[c]) >= 0){ hitGen.push(MG_GENRE_CLASSICAL[c]); }
    }
    if (hitGen.length){ score -= 5; good.push('장르: ' + hitGen.slice(0,2).join('·')); }

    /* ★ 비클래식 장르는 <b>무겁게</b> 봅니다.
       직업이 composer · pianist 여도 장르가 게임음악·뉴에이지라면
       클래식 포털에 있을 사람이 아닙니다. */
    var hitGenBad = [];
    for (var c2=0; c2<MG_GENRE_NONCLASSICAL.length; c2++){
      if (gen.indexOf(MG_GENRE_NONCLASSICAL[c2]) >= 0){ hitGenBad.push(MG_GENRE_NONCLASSICAL[c2]); }
    }
    if (hitGenBad.length){ score += 8; bad.push('장르: ' + hitGenBad.slice(0,2).join('·')); }

    /* 소개문 — 근거가 약하므로 가볍게 봅니다 */
    var hitBad = [];
    for (var d=0; d<MG_NONMUSIC.length; d++){
      if (text.indexOf(MG_NONMUSIC[d].toLowerCase()) >= 0){ score += 2; hitBad.push(MG_NONMUSIC[d]); }
    }
    if (hitBad.length) bad.push('소개: ' + hitBad.slice(0,3).join('·')
      + (hitBad.length>3 ? ' 외 '+(hitBad.length-3) : ''));

    var hitGood = [];
    for (var e=0; e<MG_MUSIC.length; e++){
      if (text.indexOf(MG_MUSIC[e].toLowerCase()) >= 0){ score -= 1; hitGood.push(MG_MUSIC[e]); }
    }
    if (hitGood.length) good.push('소개: ' + hitGood.slice(0,3).join('·')
      + (hitGood.length>3 ? ' 외 '+(hitGood.length-3) : ''));

    /* ★ 판단할 근거가 <b>아예 없는</b> 인물을 따로 셉니다.
       직업도 장르도 소개도 없으면 점수가 0이 되어 의심에 걸리지
       않습니다. 그것은 「깨끗하다」 는 뜻이 아니라 「모른다」 는 뜻입니다.
       섞어 두면 「의심 0명」 을 보고 다 깨끗한 줄로 오해합니다. */
    var noBasis = !occ && !gen && !String(p.description || '').trim();

    /* ★ 문턱을 3점으로 둡니다.
       2점이면 아리스토크세노스(고대 음악이론가)처럼 「철학자 겸 음악
       이론가」 인 사람이 걸립니다. <b>잘못 지우는 것보다 남기는 것이
       안전하므로</b> 경계는 통과시키는 쪽으로 둡니다.
       의심 목록이 너무 길면 사람이 다 볼 수 없기도 합니다. */
    var flag = score >= 3;
    var why = [];
    if (flag) why = why.concat(bad);
    else if (bad.length) why.push('↑ ' + bad.join(' · '));
    if (good.length) why.push('↓ ' + good.join(' · '));
    if (noBasis) why.push('판단 근거 없음(직업·장르·소개 모두 비어 있음)');
    /* ★ 「의심 N점」 이라고 적었더니 「의심스러운 정도」 인지 「믿을 만한
       정도」 인지 헷갈린다는 말을 들었습니다. 방향을 이름에 담습니다 —
       <b>비음악 점수</b>. 높을수록 음악과 무관합니다.
       음수일 때도 점수를 보여 주어, 얼마나 뚜렷한 음악인인지 알 수 있게 합니다. */
    return { flag: flag, score: score, noBasis: noBasis,
             reason: (flag ? ('비음악 ' + score + '점 — ')
                           : (score < 0 ? ('음악 ' + (-score) + '점 · ') : ''))
                     + why.join(' / ') };
  }

  window.OCSuspect = {
    score: score,
    /* 목록도 내보냅니다 — 화면에서 「무엇을 근거로 봤는지」 보여 줄 때 씁니다 */
    lists: {
      nonmusic: MG_NONMUSIC, music: MG_MUSIC,
      occBad: MG_OCC_BAD, occGood: MG_OCC_GOOD,
      genreClassical: MG_GENRE_CLASSICAL, genreNonClassical: MG_GENRE_NONCLASSICAL,
      fieldMusic: MG_FIELD_MUSIC,
      famous: MG_FAMOUS
    },
    /* 문턱 — 이 값 이상이면 의심입니다 */
    THRESHOLD: 3
  };
})();
