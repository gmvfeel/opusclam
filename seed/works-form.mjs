/* ============================================================
   OPUSCLAM 작품DB — 작품 형식 보강   seed/works-form.mjs
   2026-08-08

   무엇을 하나
    · 이미 담긴 작품의 위키데이터 번호로 <b>P31(이것은 무엇인가)</b>
      를 물어, 작품 형식을 채웁니다
        교향곡 · 오페라 · 협주곡 · 소나타 · 미사곡 · 가곡 …

   왜 별도 도구인가
    ★ 수집기(works-wikidata.mjs)를 고치면 <b>앞으로 담기는 것만</b>
      채워집니다. 이미 담긴 11,046개는 영원히 빈칸입니다.
      전체를 다시 훑는 것(--redo)은 너무 무겁습니다.
      그래서 <b>형식만 채우는</b> 도구를 따로 둡니다.
      works-openopus.mjs 와 같은 자리의 보강 도구입니다.

   ★ 형식과 편성을 섞지 않습니다
    P31 은 <b>형식</b>(교향곡 · 소나타)이고 genre 는 <b>편성</b>
    (관현악 · 건반)입니다. 형식을 편성으로 바꾸려면 추론이 들어갑니다.

        symphony → 관현악   ○ 의심 없습니다
        sonata   → 건반     ✗ 바이올린 소나타가 건반이 됩니다

    그래서 <b>형식은 형식 칸에</b> 담고, 편성은 의심 없는 것만
    채웁니다. 애매한 것은 <b>비워 둡니다.</b> 2026-08-07 학술DB 에서
    자동 판정으로 세 번 오판한 것이 이 지점입니다.

   ★ 처음에는 --dry 로 <b>무엇이 오는지</b> 보십시오
   ★ 2026-08-08 확인 실행으로 알아낸 것 — 전제가 무너졌습니다
    「클래식 작품에는 P31 이 잘 채워져 있다」고 보았는데,
    2,000개를 물어보니 <b>1,375개(69%)가 musical work/composition</b>
    — 그냥 「음악 작품」 이라는 가장 넓은 말뿐이었습니다.
    구체적 형식을 얻은 것은 623개(31%)입니다.

    ★ 그런데 더 중요한 것이 드러났습니다
      형식을 얻은 623개 가운데 <b>개별 음악 작품이 아닌 것이 72%</b>
      였습니다. 영화 228개 · 판본 93개 · 묶음 항목 85개 ·
      음반과 필사본 37개. 그래서 이 도구의 값은 <b>형식 채우기보다
      무엇이 작품이 아닌지 알아내는 것</b>에 있습니다.

    ★ 영화가 왜 들어왔나
      위키데이터에서 영화의 P86 은 <b>영화음악 작곡가</b>를
      가리킵니다. 수집기가 P86 으로 작품을 찾으니 영화 자체가
      「그 작곡가의 작품」 으로 들어왔습니다.
      ★ 지우지 않습니다 — 편성을 「영화·방송」 으로 주어 살립니다.
        존 윌리엄스 작품 목록에 「스타워즈」 가 있는 것이 맞습니다.

   ★ 번역표(FORM)에 없는 형식은 <b>영문 그대로</b> 담고 편성은
    건드리지 않습니다. 지어내지 않습니다. --dry 가 「번역표에 없는
    형식」 을 보여 주므로 그것을 보고 채워 갑니다.

   쓰는 법
     node seed/works-form.mjs --dry            무엇이 오는지만 봅니다
     node seed/works-form.mjs --dry --limit=500
     node seed/works-form.mjs                  실제로 담습니다

   옵션
     --dry          담지 않습니다 (분포만 보여 줍니다)
     --limit=N      작품 몇 개까지 (기본 3000)
     --batch=N      한 번에 물어볼 작품 수 (기본 150)
     --redo         형식이 이미 있는 작품도 다시 물어봅니다
     --all          편성이 채워진 작품도 대상에 넣습니다
                    (기본은 편성이 빈 것부터 — 급한 쪽입니다)
     --debug        받은 값을 자세히

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
const REDO  = !!args.redo;
const ALL   = !!args.all;
const LIMIT = Number(args.limit) > 0 ? Number(args.limit) : 3000;
const BATCH = Number(args.batch) > 0 ? Number(args.batch) : 150;

const WDQS = 'https://query.wikidata.org/sparql';
const UA   = 'OpusclamFormBot/1.0 (https://opusclam.com)';

/* ============================================================
   형식표 — 이름 · 한국어 · 편성 · 갈래

   ★ 2026-08-08 확인 실행 결과로 채웠습니다
     2,000개를 물어보니 67가지가 왔습니다. 아래는 그 가운데
     <b>뜻이 하나로 정해진 것</b>만 옮긴 것입니다.

   ★ 제가 세운 전제가 무너졌습니다 — 적어 둡니다
     「클래식 작품에는 P31 이 잘 채워져 있다」고 보았는데,
     <b>2,000개 중 1,375개(69%)가 musical work/composition</b>
     — 그냥 「음악 작품」 이라는 가장 넓은 말뿐이었습니다.
     구체적 형식을 얻은 것은 623개(31%)입니다.

   ★ 그런데 더 중요한 것이 드러났습니다
     형식을 얻은 623개 가운데 <b>개별 음악 작품이 아닌 것이 72%</b>
     였습니다. 영화 228개 · 판본 93개 · 묶음 항목 85개 ·
     음반과 필사본 37개. 그래서 이 도구의 값은 형식 채우기보다
     <b>무엇이 작품이 아닌지 알아내는 것</b>에 있습니다.

   ── 갈래(kind) 가 하는 일 ────────────────────────────────
     work   음악 작품 — 그대로 살립니다
     video  영상물 — 편성을 「영화·방송」 으로 주어 살립니다.
            영화의 P86 은 <b>영화음악 작곡가</b>를 가리킵니다.
            수집기가 P86 으로 찾으니 영화 자체가 들어왔습니다.
            ★ 지우지 않습니다 — 존 윌리엄스 작품 목록에
              「스타워즈」 가 있는 것이 맞습니다
     group  묶음 항목 — 「6개의 브란덴부르크 협주곡」 처럼 정당한
            것이 섞여 있어 <b>사람이 봐야 합니다.</b> 자동으로
            감추지 않습니다
     aside  작품이 아님 — 음반 · 판본 · 필사본 · 특정 공연 ·
            위키 안내문서. 감출 후보이지만 <b>여기서 감추지
            않습니다.</b> 어드민 도구를 만들어 눈으로 고릅니다
     broad  너무 넓어 화면에 쓸모없음 — form_ko 를 비웁니다.
            ★ 다만 form_raw 에는 담습니다. 그러지 않으면 다음에
              돌릴 때 <b>같은 1,375개를 또 물어봅니다</b>
              (2026-08-07 함정 16번과 같은 낭비입니다)

   ── 왜 자동으로 감추지 않는가 ────────────────────────────
     2026-08-07 학술DB 에서 자동 판정으로 세 번 오판했습니다.
     판단이 필요한 일은 <b>사람이 고를 화면</b>을 만드는 편이
     맞습니다. 여기서는 <b>갈래만 적어 두고</b> 손대지 않습니다.

   ── 편성(genre) 을 넣는 규칙 ─────────────────────────────
     ★ 의심 없는 것만 넣습니다.
         symphony → Orchestral   ○
         sonata   → (비움)       ✗ 바이올린 소나타가 건반이 됩니다
     ★ 이미 편성이 있으면 <b>건드리지 않습니다.</b>
       Open Opus 가 넣은 값이 더 정확할 수 있습니다.
     ★ 값의 모양에 주의하십시오. genre 칸에는 두 가지가 섞여
       있습니다 — Open Opus 가 넣은 <b>영문</b> 다섯 가지
       (Orchestral · Keyboard · Chamber · Stage · Vocal)와
       기존 wixon 자료의 <b>한국어</b> 열세 가지입니다.
       화면(works.js · work-view.html)이 영문을 한국어로 옮겨
       보여주므로 둘 다 괜찮습니다. 「영화·방송」 은 영문 대응이
       없어 <b>한국어 그대로</b> 씁니다(기존 값과 같은 모양입니다).

   ── 열쇠에 대하여 ────────────────────────────────────────
     열쇠는 <b>영문 라벨을 소문자로 낮춘 것</b>입니다.
     위키데이터 번호(QID)가 더 튼튼하지만, 번호를 제 기억으로
     적으면 지어내는 것이 됩니다. 번호는 form_qid 칸에 담아
     두므로 뒤에 표를 번호로 옮길 수 있습니다.

   ── 여기에 없는 형식은 ───────────────────────────────────
     <b>영문 그대로 담고 편성은 건드리지 않습니다.</b>
     지어내지 않습니다. --dry 가 「번역표에 없는 것」 을
     보여 주므로 그것을 보고 채워 갑니다.
   ============================================================ */
const FORM = {

  /* ── 음악 작품 ─────────────────────────────────────────
     뜻이 하나로 정해진 것들입니다. */
  'symphony'                 : { ko: '교향곡',       genre: 'Orchestral', kind: 'work' },
  'symphonic poem'           : { ko: '교향시',       genre: 'Orchestral', kind: 'work' },
  'overture'                 : { ko: '서곡',         genre: 'Orchestral', kind: 'work' },
  'concerto'                 : { ko: '협주곡',       genre: 'Orchestral', kind: 'work' },
  'sinfonia concertante'     : { ko: '신포니아 콘체르탄테', genre: 'Orchestral', kind: 'work' },
  'suite'                    : { ko: '조곡',         genre: null,         kind: 'work' },
  'serenade'                 : { ko: '세레나데',     genre: null,         kind: 'work' },
  'divertimento'             : { ko: '디베르티멘토', genre: null,         kind: 'work' },
  'rhapsody'                 : { ko: '랩소디',       genre: null,         kind: 'work' },

  'opera'                    : { ko: '오페라',       genre: 'Stage',      kind: 'work' },
  'grand opera'              : { ko: '그랜드 오페라', genre: 'Stage',     kind: 'work' },
  'operetta'                 : { ko: '오페레타',     genre: 'Stage',      kind: 'work' },
  'ballet'                   : { ko: '발레',         genre: 'Stage',      kind: 'work' },
  /* ★ 극음악 · 서정음악극 — 위키데이터가 오페라 · 오페레타 ·
     뮤지컬을 아우를 때 쓰는 말입니다. 무대 작품이 확실합니다. */
  'dramatico-musical work'   : { ko: '극음악',       genre: 'Stage',      kind: 'work' },
  'lyrico-musical work'      : { ko: '서정음악극',   genre: 'Stage',      kind: 'work' },
  'choreographic work'       : { ko: '무용 작품',    genre: 'Stage',      kind: 'work' },

  'string quartet'           : { ko: '현악사중주',   genre: 'Chamber',    kind: 'work' },

  'mass'                     : { ko: '미사곡',       genre: 'Vocal',      kind: 'work' },
  'requiem'                  : { ko: '레퀴엠',       genre: 'Vocal',      kind: 'work' },
  'oratorio'                 : { ko: '오라토리오',   genre: 'Vocal',      kind: 'work' },
  'cantata'                  : { ko: '칸타타',       genre: 'Vocal',      kind: 'work' },
  'motet'                    : { ko: '모테트',       genre: 'Vocal',      kind: 'work' },
  'aria'                     : { ko: '아리아',       genre: 'Vocal',      kind: 'work' },
  'lied'                     : { ko: '리트',         genre: 'Vocal',      kind: 'work' },
  'psalm'                    : { ko: '시편',         genre: 'Vocal',      kind: 'work' },
  /* ★ 수난곡 — 바흐 마태수난곡 · 요한수난곡입니다.
     위키데이터 라벨이 복수형(passions)으로 옵니다. */
  'passions'                 : { ko: '수난곡',       genre: 'Vocal',      kind: 'work' },
  'passion'                  : { ko: '수난곡',       genre: 'Vocal',      kind: 'work' },
  'christian hymn'           : { ko: '찬송가',       genre: 'Vocal',      kind: 'work' },
  'hymn'                     : { ko: '찬가',         genre: null,         kind: 'work' },
  /* ★ 국가(國歌) — 안익태 애국가처럼 한국 자료에 걸립니다 */
  'national anthem'          : { ko: '국가',         genre: 'Vocal',      kind: 'work' },
  'regional hymn'            : { ko: '지역 찬가',    genre: null,         kind: 'work' },
  'song'                     : { ko: '가곡',         genre: null,         kind: 'work' },
  'chorale'                  : { ko: '코랄',         genre: null,         kind: 'work' },
  'vocal trio'               : { ko: '성악 삼중창',  genre: null,         kind: 'work' },

  /* ★ 아래는 편성을 비웁니다 — 악기를 모르면 정할 수 없습니다.
     소나타는 피아노 · 바이올린 · 첼로 · 플루트가 모두 있습니다. */
  'sonata'                   : { ko: '소나타',       genre: null,         kind: 'work' },
  'prelude'                  : { ko: '전주곡',       genre: null,         kind: 'work' },
  'fugue'                    : { ko: '푸가',         genre: null,         kind: 'work' },
  'etude'                    : { ko: '연습곡',       genre: null,         kind: 'work' },
  'nocturne'                 : { ko: '야상곡',       genre: null,         kind: 'work' },
  'waltz'                    : { ko: '왈츠',         genre: null,         kind: 'work' },
  'mazurka'                  : { ko: '마주르카',     genre: null,         kind: 'work' },
  'polonaise'                : { ko: '폴로네즈',     genre: null,         kind: 'work' },
  'march'                    : { ko: '행진곡',       genre: null,         kind: 'work' },
  'variation'                : { ko: '변주곡',       genre: null,         kind: 'work' },
  'fantasia'                 : { ko: '환상곡',       genre: null,         kind: 'work' },
  'toccata'                  : { ko: '토카타',       genre: null,         kind: 'work' },
  'instrumental composition' : { ko: '기악곡',       genre: null,         kind: 'work' },
  /* ★ 가사 없는 곡 — 위키데이터가 기악 트랙에 붙이는 말입니다 */
  'music track without lyrics': { ko: '기악곡',      genre: null,         kind: 'work' },
  'canzone'                  : { ko: '칸초네',       genre: null,         kind: 'work' },

  /* ★ 잃어버린 작품 · 미완성 작품도 <b>작품입니다.</b>
     소실되었을 뿐 기록은 자료입니다. 감추지 않습니다. */
  'lost work'                : { ko: '잃어버린 작품',   genre: null, kind: 'work' },
  'lost musical work'        : { ko: '잃어버린 작품',   genre: null, kind: 'work' },
  'unfinished creative work' : { ko: '미완성 작품',     genre: null, kind: 'work' },
  /* ★ 중단된 기획 — 착수했다가 그만둔 것. 미완성과 같이 봅니다 */
  'abandoned project'        : { ko: '중단된 기획',     genre: null, kind: 'work' },
  /* ★ 편곡도 작품입니다(리스트의 베토벤 교향곡 편곡 등) */
  'arrangement'              : { ko: '편곡',           genre: null, kind: 'work' },

  /* ── 작품의 일부 — 눈으로 봐야 함 ───────────────────────
     ★ 2026-08-08 확인 실행에서 드러난 갈래입니다.
       「발퀴레의 기행」 이 이것입니다 — 오페라 《발퀴레》 3막
       도입부의 한 대목이고, 독립 작품이 아닙니다.
     ★ 지우자는 뜻이 아닙니다. 사람들이 실제로 그 이름으로 찾으므로
       있는 편이 낫습니다. 다만 <b>작품과 발췌를 구분해 보여주는 것</b>
       이 정확한 포털의 모습입니다. */
  'movement'                 : { ko: '악장',   genre: null, kind: 'part' },
  'scene'                    : { ko: '장면',   genre: null, kind: 'part' },

  /* ── 영상물 — 「영화·방송」 으로 살립니다 ───────────────
     영화의 P86 은 영화음악 작곡가를 가리킵니다. */
  'film'                     : { ko: '영화',              genre: '영화·방송', kind: 'video' },
  'television film'          : { ko: '텔레비전 영화',     genre: '영화·방송', kind: 'video' },
  'short film'               : { ko: '단편 영화',         genre: '영화·방송', kind: 'video' },
  'animated film'            : { ko: '애니메이션 영화',   genre: '영화·방송', kind: 'video' },
  'animated short film'      : { ko: '단편 애니메이션',   genre: '영화·방송', kind: 'video' },
  'animated television series': { ko: '애니메이션 시리즈', genre: '영화·방송', kind: 'video' },
  'television series'        : { ko: '텔레비전 시리즈',   genre: '영화·방송', kind: 'video' },
  'television program'       : { ko: '텔레비전 프로그램', genre: '영화·방송', kind: 'video' },
  'documentary film'         : { ko: '다큐멘터리 영화',   genre: '영화·방송', kind: 'video' },
  /* ★ 비디오 게임은 편성을 비웁니다 — 게임을 「영화·방송」 이라
     하기는 어렵습니다. 형식만 적어 두고 판단을 미룹니다. */
  'video game'               : { ko: '비디오 게임',       genre: null,        kind: 'video' },

  /* ── 묶음 항목 — 사람이 봐야 합니다 ────────────────────
     「6개의 브란덴부르크 협주곡」 처럼 정당한 것이 섞여 있습니다.
     자동으로 감추지 않습니다. */
  'group of works'           : { ko: '작품 묶음',        genre: null, kind: 'group' },
  'group of musical works'   : { ko: '음악 작품 묶음',   genre: null, kind: 'group' },
  'musical series'           : { ko: '음악 연작',        genre: null, kind: 'group' },
  'series of creative works' : { ko: '연작',             genre: null, kind: 'group' },
  'opera cycle'              : { ko: '오페라 연작',      genre: null, kind: 'group' },
  'piano repertoire'         : { ko: '피아노 레퍼토리',  genre: null, kind: 'group' },
  'tetrad'                   : { ko: '4부작',            genre: null, kind: 'group' },
  /* ★ heptadecad = hepta(7) + deca(10) → 17부작.
     바흐 · 헨델의 큰 작품집에 붙는 드문 말입니다. */
  'heptadecad'               : { ko: '17부작',           genre: null, kind: 'group' },
  /* ★ 클라비어 위붕 — 바흐가 손수 묶어 낸 건반 작품집입니다.
     낱낱의 곡이 아니라 묶음 이름입니다. */
  'clavier-übung'            : { ko: '클라비어 위붕',    genre: null, kind: 'group' },
  'chorale cantata cycle'    : { ko: '코랄 칸타타 연작', genre: null, kind: 'group' },
  'album series'             : { ko: '음반 연작',        genre: null, kind: 'group' },

  /* ── 작품이 아님 — 감출 후보 (여기서 감추지 않습니다) ── */
  'version, edition or translation': { ko: '판본',       genre: null, kind: 'aside' },
  'album'                    : { ko: '음반',             genre: null, kind: 'aside' },
  'album release'            : { ko: '음반 발매',        genre: null, kind: 'aside' },
  'video album'              : { ko: '영상 음반',        genre: null, kind: 'aside' },
  'discography'              : { ko: '음반 목록',        genre: null, kind: 'aside' },
  'sheet music'              : { ko: '악보',             genre: null, kind: 'aside' },
  'manuscript'               : { ko: '필사본',           genre: null, kind: 'aside' },
  'music manuscript'         : { ko: '음악 필사본',      genre: null, kind: 'aside' },
  'printed sheet music'      : { ko: '인쇄 악보',        genre: null, kind: 'aside' },
  'ballet production'        : { ko: '발레 공연',        genre: null, kind: 'aside' },
  'dance production'         : { ko: '무용 공연',        genre: null, kind: 'aside' },
  'theatrical production'    : { ko: '연극 공연',        genre: null, kind: 'aside' },
  'operatic production'      : { ko: '오페라 공연',      genre: null, kind: 'aside' },
  'literary fragment'        : { ko: '문학 단편',        genre: null, kind: 'aside' },
  'wikimedia disambiguation page': { ko: '위키 안내문서', genre: null, kind: 'aside' },

  /* ── 너무 넓음 — form_ko 를 비우되 form_raw 는 담습니다 ──
     ★ ko 를 빈 글자로 둡니다. 담지 않는 것과 다릅니다 —
       form_raw 가 채워지므로 다음에 다시 묻지 않습니다. */
  'musical work/composition' : { ko: '', genre: null, kind: 'broad' },
  'musical composition'      : { ko: '', genre: null, kind: 'broad' },
  'musical work'             : { ko: '', genre: null, kind: 'broad' },
  'composition'              : { ko: '', genre: null, kind: 'broad' },
  'creative work'            : { ko: '', genre: null, kind: 'broad' },
  'work of art'              : { ko: '', genre: null, kind: 'broad' },
  /* ★ 이것은 <b>형식 자체를 설명하는 항목</b>입니다(「소나타라는
     형식」). 작품이 아니라 개념이라 화면에 쓸모없습니다. */
  'type of musical work/composition': { ko: '', genre: null, kind: 'broad' },
  'artistic work'            : { ko: '', genre: null, kind: 'broad' },
  'written work'             : { ko: '', genre: null, kind: 'broad' },
  'work'                     : { ko: '', genre: null, kind: 'broad' },
};

/* 갈래 이름 — 로그에 보여줄 때 씁니다 */
const KIND_KO = {
  work : '음악 작품',
  video: '영상물 (영화·방송)',
  part : '작품의 일부 — 눈으로 봐야 함',
  group: '묶음 항목 — 눈으로 봐야 함',
  aside: '작품이 아님 — 감출 후보',
  broad: '너무 넓음 — 화면에 안 보임',
  '?'  : '번역표에 없음',
};

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

/* 위키데이터는 붐빌 때 429 · 500 을 돌려줍니다. 네 번까지 다시 묻습니다. */
async function sparql(query) {
  const url = `${WDQS}?format=json&query=${encodeURIComponent(query)}`;
  for (let t = 1; t <= 4; t++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
      });
      if (res.ok) {
        const j = await res.json();
        return (j.results && j.results.bindings) || [];
      }
      console.log(`    · 위키데이터 응답 ${res.status} — ${t}/4 다시 시도`);
    } catch (e) {
      console.log(`    · 통신 오류 — ${t}/4 다시 시도 (${e.message})`);
    }
    await sleep(2000 * t);
  }
  console.log('    ✗ 이 묶음은 건너뜁니다');
  return null;
}

/* ============================================================
   1) 대상 모으기

   ★ PostgREST 는 한 번에 <b>200개까지만</b> 줍니다. limit=3000 을
     줘도 200개만 옵니다. 그래서 나눠 받습니다.
   ★ 끝냄은 <b>0개일 때만</b> 판단합니다. 「받은 수 < 요청한 수」로
     하면 200개를 받은 첫 바퀴에서 멈춥니다
     (2026-08-07 에 이 실수를 두 번 했습니다).
   ★ offset 은 <b>실제로 받은 수만큼</b> 넘깁니다.
   ★ order 에 id 를 넣습니다 — 정렬이 흔들리면 빠지거나 겹칩니다.
   ============================================================ */
async function pickTargets() {
  const PAGE = 200;
  const out = [];
  let off = 0;

  let q = 'person_works?select=id,wikidata_id,title,genre,form_raw'
        + '&wikidata_id=not.is.null'
        + '&order=id.asc';
  if (!REDO) q += '&form_raw=is.null';   /* 이미 형식이 있는 것은 넘깁니다 */
  if (!ALL)  q += '&genre=is.null';      /* 편성이 빈 것부터 — 급한 쪽 */

  while (out.length < LIMIT) {
    const want = Math.min(PAGE, LIMIT - out.length);
    const rows = await sb(`${q}&limit=${want}&offset=${off}`);
    if (!rows || !rows.length) break;    /* 0개일 때만 끝냅니다 */
    out.push(...rows);
    off += rows.length;                  /* 실제로 받은 수만큼 */
  }
  return out;
}

/* ============================================================
   2) 형식 물어보기

   ★ 라벨을 SERVICE 없이 직접 받습니다 — 어떤 말이 올지 정하려면
     영어를 명시해야 합니다(works-wikidata.mjs 와 같은 판단).
   ★ OPTIONAL 로 둡니다 — 영어 라벨이 없는 형식도 번호는 받아
     두어야 나중에 채울 수 있습니다.
   ============================================================ */
async function fetchForms(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const query = `
SELECT ?work ?form ?lbl WHERE {
  VALUES ?work { ${values} }
  ?work wdt:P31 ?form .
  OPTIONAL { ?form rdfs:label ?lbl . FILTER(lang(?lbl) = "en") }
}
LIMIT ${qids.length * 12}`;

  const rows = await sparql(query);
  if (rows === null) return null;

  /* 작품마다 형식 여러 개를 모읍니다 */
  const byWork = new Map();
  for (const b of rows) {
    const wQid = String(b.work.value).split('/').pop();
    const fQid = String(b.form.value).split('/').pop();
    const lbl  = (b.lbl && b.lbl.value) ? String(b.lbl.value).trim() : '';
    const arr  = byWork.get(wQid) || [];
    if (!arr.some((x) => x.qid === fQid)) arr.push({ qid: fQid, label: lbl });
    byWork.set(wQid, arr);
  }
  return byWork;
}

/* ★ 여러 형식 가운데 <b>가장 알맞은 것</b>을 고릅니다.

   한 작품에 P31 이 둘 이상 붙는 일이 잦습니다 — 오페라이면서
   극음악이면서 음악 작품, 영화이면서 창작물처럼.

   고르는 순서
     ① 우리가 아는 음악 작품 형식 (교향곡 · 오페라 …)
     ② 우리가 아는 영상물 (영화 …)
     ③ 우리가 아는 묶음 · 작품 아님 (판본 · 음반 …)
     ④ 번역표에 없지만 이름이 있는 것 — 영문 그대로 담습니다
     ⑤ 너무 넓은 말 (musical work/composition)

   ★ ⑤ 를 <b>버리지 않고 마지막으로 고릅니다.</b> 버리면 form_raw
     가 비어 다음에 돌릴 때 같은 것을 또 물어봅니다. */
function pickForm(forms) {
  if (!forms || !forms.length) return null;
  const norm = (s) => String(s || '').trim().toLowerCase();
  const kindOf = (f) => {
    const e = FORM[norm(f.label)];
    if (e) return e.kind;
    return f.label ? '?' : 'none';
  };
  /* ★ part(악장 · 장면)를 group 앞에 둡니다. 「발퀴레의 기행」 이
     movement 와 musical work/composition 을 함께 가지고 올 때
     movement 가 골라져야 발췌임을 알 수 있습니다. */
  const RANK = { work: 1, video: 2, part: 3, group: 4, aside: 5, '?': 6, broad: 7, none: 8 };

  let best = null, bestRank = 99;
  for (const f of forms) {
    const r = RANK[kindOf(f)] || 9;
    if (r < bestRank) { best = f; bestRank = r; }
  }
  return best || forms[0];
}

/* ============================================================
   3) 담기

   ★ 200개씩 나눠 보냅니다. 묶음이 크면 하나가 실패할 때 전부
     되돌려집니다.
   ★ 형식이 이미 같으면 보내지 않습니다 — 쓸데없는 수정은
     updated_at 만 흔듭니다.
   ============================================================ */
async function saveRows(rows) {
  let ok = 0;
  const fail = [];
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200);
    try {
      /* ★ id 를 열쇠로 하는 upsert 입니다. 다른 칸은 건드리지
         않습니다 — 보내지 않은 칸은 그대로 남습니다. */
      await sb('person_works?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(part),
      });
      ok += part.length;
    } catch (e) {
      /* 묶음이 실패하면 한 건씩 다시 담습니다 */
      console.log(`  [묶음 실패] ${i + 1}~${i + part.length}번째 — 한 건씩 다시 담습니다`);
      for (const r of part) {
        try {
          await sb('person_works?on_conflict=id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([r]),
          });
          ok += 1;
        } catch (e2) {
          fail.push({ id: r.id, why: e2.message });
        }
      }
    }
  }
  return { ok, fail };
}

/* ============================================================
   4) 본줄기
   ============================================================ */
async function main() {
  console.log('══ 작품DB 형식 보강 ══');
  console.log(DRY ? '※ 담지 않습니다 — 무엇이 오는지만 봅니다'
                  : '※ 실제로 담습니다');
  console.log(`   작품 최대 ${LIMIT}개 · 한 묶음 ${BATCH}개`);
  if (REDO) console.log('   형식이 이미 있는 작품도 다시 물어봅니다');
  if (ALL)  console.log('   편성이 채워진 작품도 대상입니다');
  console.log('');

  const targets = await pickTargets();
  if (!targets.length) {
    console.log('대상이 없습니다. 형식이 이미 채워졌거나 위키데이터 번호가 없습니다.');
    return;
  }
  console.log(`대상 작품 ${targets.length}개`);
  console.log('');

  const byQid = new Map();
  for (const t of targets) {
    const k = String(t.wikidata_id).trim();
    if (!byQid.has(k)) byQid.set(k, []);
    byQid.get(k).push(t);
  }
  const qids = [...byQid.keys()];

  /* 셈 */
  const formCount   = new Map();   /* 영문 라벨 → 몇 개 */
  const kindCount   = new Map();   /* 갈래 → 몇 개 */
  const noTrans     = new Map();   /* 번역표에 없는 것 */
  const rows        = [];          /* 담을 것 */
  let gotForm = 0, noForm = 0, noLabel = 0, genreFilled = 0;

  for (let i = 0; i < qids.length; i += BATCH) {
    const part = qids.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(qids.length / BATCH);
    console.log(`── 묶음 ${n}/${total} : 작품 ${part.length}개`);

    const got = await fetchForms(part);
    if (got === null) { await sleep(3000); continue; }

    for (const qid of part) {
      const forms = got.get(qid);
      const works = byQid.get(qid) || [];
      if (!forms || !forms.length) { noForm += works.length; continue; }

      const picked = pickForm(forms);
      if (!picked) { noForm += works.length; continue; }

      const key = String(picked.label || '').trim().toLowerCase();
      if (!key) { noLabel += works.length; continue; }

      formCount.set(key, (formCount.get(key) || 0) + works.length);

      /* 번역표를 찾아봅니다. 없으면 <b>영문 그대로</b> 담습니다.
         지어내지 않습니다. */
      const ent = FORM[key];
      if (!ent) noTrans.set(key, (noTrans.get(key) || 0) + works.length);

      const kind = ent ? ent.kind : '?';
      /* ★ 갈래가 broad(너무 넓음)이면 화면에 보일 값은 비웁니다.
           그래도 form_raw · form_qid 는 담습니다 — 그러지 않으면
           다음에 돌릴 때 <b>같은 것을 또 물어봅니다.</b>
           2026-08-07 함정 16번과 같은 낭비입니다. */
      const ko    = ent ? ent.ko : picked.label;
      const genre = ent ? (ent.genre || null) : null;

      kindCount.set(kind, (kindCount.get(kind) || 0) + works.length);

      for (const w of works) {
        gotForm += 1;
        const row = {
          id       : w.id,
          form_raw : picked.label,
          form_ko  : ko || null,
          form_qid : picked.qid,
        };
        /* ★ 편성은 <b>비어 있을 때만</b>, 그리고 의심 없는 것만
           채웁니다. 이미 값이 있으면 건드리지 않습니다 —
           Open Opus 가 넣은 값이 더 정확할 수 있습니다. */
        if (genre && !String(w.genre || '').trim()) {
          row.genre = genre;
          genreFilled += 1;
        }
        rows.push(row);
      }

      if (DEBUG) {
        console.log(`   ${qid} → ${picked.label} (${picked.qid})`
                  + `${genre ? ' · 편성 ' + genre : ''}`
                  + `  [형식 ${forms.length}개 중]`);
      }
    }
    await sleep(1200);
  }

  /* ── 갈래별로 묶어 보여줍니다 ─────────────────────────────
     ★ 형식 이름을 한 줄씩 늘어놓으면 예순 줄이 넘어 판단이 안 됩니다.
       갈래로 묶으면 <b>무엇이 작품이고 무엇이 아닌지</b>가 한눈에
       보입니다. 이 도구의 값은 형식 채우기보다 정제에 있습니다. */
  const norm2 = (s) => String(s || '').trim().toLowerCase();
  const kindOfKey = (k) => (FORM[norm2(k)] ? FORM[norm2(k)].kind : '?');

  const bag = new Map();
  for (const [k, v] of formCount.entries()) {
    const kd = kindOfKey(k);
    if (!bag.has(kd)) bag.set(kd, []);
    bag.get(kd).push([k, v]);
  }

  const total = [...formCount.values()].reduce((a, b) => a + b, 0) || 1;
  const pct = (n) => Math.round((n / total) * 1000) / 10;

  console.log('');
  console.log('══ 받은 형식 — 갈래별 ══');
  for (const kd of ['work', 'video', 'part', 'group', 'aside', '?', 'broad']) {
    const items = bag.get(kd);
    if (!items || !items.length) continue;
    const sum = items.reduce((a, b) => a + b[1], 0);
    console.log('');
    console.log(`[${KIND_KO[kd] || kd}]  ${sum}개 (${pct(sum)}%)`);
    items.sort((a, b) => b[1] - a[1]);
    for (const [k, v] of items.slice(0, 25)) {
      const e = FORM[norm2(k)];
      const ko = e ? (e.ko || '(화면에 안 보임)') : '(영문 그대로)';
      const g  = e && e.genre ? ` · 편성 ${e.genre}` : '';
      console.log(`  ${String(v).padStart(6)}  ${k}  →  ${ko}${g}`);
    }
    if (items.length > 25) console.log(`         … 그 밖 ${items.length - 25}가지`);
  }

  if (noTrans.size) {
    console.log('');
    console.log('★ 번역표에 없는 형식 — 이것을 알려 주십시오');
    console.log('  (지금은 영문 그대로 담기고 편성은 건드리지 않습니다)');
    const nt = [...noTrans.entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, v] of nt.slice(0, 60)) {
      console.log(`  ${String(v).padStart(6)}  ${k}`);
    }
    if (nt.length > 60) console.log(`  … 그 밖 ${nt.length - 60}가지`);
  }

  console.log('');
  console.log('══ 마무리 ══');
  console.log(`  대상 작품            ${targets.length}개`);
  console.log(`  형식을 얻은 것       ${gotForm}개`);
  console.log(`  형식이 없는 것       ${noForm}개`);
  console.log(`  이름이 없어 건너뜀   ${noLabel}개`);
  console.log(`  편성도 함께 채울 것  ${genreFilled}개`);
  console.log(`  형식 가지수          ${formCount.size}가지`);
  console.log('');
  console.log('  ── 갈래 셈 ──');
  for (const kd of ['work', 'video', 'part', 'group', 'aside', '?', 'broad']) {
    const n = kindCount.get(kd);
    if (!n) continue;
    console.log(`  ${String(n).padStart(6)}개  ${KIND_KO[kd] || kd}`);
  }

  if (DRY) {
    console.log('');
    console.log('※ --dry 이므로 담지 않았습니다.');
    console.log('  위 「번역표에 없는 형식」 을 알려 주시면 번역표를 채워 드립니다.');
    return;
  }

  if (!rows.length) {
    console.log('');
    console.log('담을 것이 없습니다.');
    return;
  }

  console.log('');
  console.log(`── 담습니다 : ${rows.length}개 ──`);
  const { ok, fail } = await saveRows(rows);
  console.log(`  담김 ${ok}개${fail.length ? ` · 실패 ${fail.length}개` : ''}`);
  if (fail.length) {
    console.log('  ★ 담지 못한 것:');
    for (const f of fail.slice(0, 15)) console.log(`    · id ${f.id} — ${f.why}`);
    if (fail.length > 15) console.log(`    … 그 밖 ${fail.length - 15}개`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
