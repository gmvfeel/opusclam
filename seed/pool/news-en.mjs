/* ============================================================
   자동 시드 콘텐츠 풀 — 뉴스 · 영어 (news / lang: 'en')
   ------------------------------------------------------------
   2026-08-15 · 네 번째 외국어 배치

   ★ 이 게시판은 <b>기사가 아닙니다</b> — 반드시 기억할 것
     이름은 「뉴스」지만, 한국어 글을 보면 실제 사건을 전하는 것이
     아니라 <b>안내·해설</b>입니다. 「공연장 로비에서 파는 음반, 사도
     좋을까요」 같은 결입니다.
     ▶ 여기에 진짜 기사처럼 쓰면 <b>없는 사실을 지어내게 됩니다.</b>
       날짜·이름·수치가 들어간 소식은 절대 쓰지 않습니다.
     ▶ 언제 읽어도 맞는 이야기만 씁니다.

   ★ 결
     본문 평균 <b>790자</b>로 이 게시판이 가장 깁니다.
     문단마다 굵은 글씨로 요점을 하나씩 세우는 짜임입니다.
     댓글은 없습니다(한국어 글도 없습니다).

   ★ 분류는 한국어 그대로 — '국내' · '해외'
     외국어 글은 '해외' 로 둡니다.
   ============================================================ */

export const NEWS_EN = [

{
  board: 'news', lang: 'en', category: '해외', author: 'hallnotes',
  title: 'What the number on your ticket actually tells you about the sound',
  body:
    '<p>Most halls price seats by sightline and tradition rather than by what you will hear. Knowing the difference can save you a lot of money.</p>' +
    '<p><b>Front orchestra gives you presence, not balance.</b><br>Sitting close, you hear whoever is nearest disproportionately. A violin section can dominate a wind solo that the composer wrote to be equal. The experience is thrilling and inaccurate.</p>' +
    '<p><b>The blend happens further back.</b><br>Sound from different parts of the stage needs distance to combine. Row fifteen to twenty-five in the orchestra is where most listeners find the picture assembles properly.</p>' +
    '<p><b>First balcony centre is the quiet consensus.</b><br>Ask people who attend weekly and this is what most of them say. You are above the direct sound, centred, and far enough back for the hall itself to contribute. It is rarely the most expensive ticket.</p>' +
    '<p><b>Under an overhang is the seat to avoid.</b><br>If a balcony projects over your head, the reverberant sound cannot reach you. You get a dry, boxed version. This affects cheap rear stalls in many older halls.</p>' +
    '<p><b>Side seats trade balance for intimacy.</b><br>You will hear the section nearest you too strongly, but you can watch hands and bows, which is its own kind of understanding.</p>' +
    '<p>None of this is a rule. Every hall behaves differently, and the only real method is to sit in a few places and notice. But if you are choosing blind, the first balcony is a safer bet than the front row.</p>',
  comments: [
    { author: "balconyregular", body: "The under-an-overhang warning is the one I would have wanted years ago. Cheap rear stalls in old halls are genuinely worse, not just further away." },
    { author: "frontrowfan", body: "Mild dissent — I know the front is unbalanced and I still choose it sometimes. Watching hands close up is worth the trade for me." },
  ],
},

{
  board: 'news', lang: 'en', category: '해외', author: 'firsttimeguide',
  title: 'Going to a concert alone for the first time',
  body:
    '<p>A surprising number of people want to attend concerts but wait for someone to come with them, and end up not going at all. It is worth knowing that going alone is completely ordinary.</p>' +
    '<p><b>A large share of any audience is already alone.</b><br>Look around at intermission. People reading, people looking at the ceiling, people who arrived by themselves and will leave by themselves. Nobody is noticing you because most of them are doing the same thing.</p>' +
    '<p><b>A single seat is often a better seat.</b><br>Box offices hold odd single seats that never sell in pairs. These are frequently in excellent positions and released cheaply close to the date.</p>' +
    '<p><b>Intermission is shorter than you fear.</b><br>Twenty minutes. Bring something to read, or walk the lobby and look at the building. It passes.</p>' +
    '<p><b>You will listen differently.</b><br>Without the small social awareness of whether your companion is enjoying it, attention goes entirely to the stage. Many people who try it once find they prefer it and stop asking anyone.</p>' +
    '<p><b>Practical things.</b><br>Arrive with twenty minutes to spare, since latecomers wait outside until a break. Check whether the hall has a cloakroom before wearing a heavy coat. And read the programme note before it starts rather than during.</p>' +
    '<p>The first time feels conspicuous for about four minutes. After the music begins, the question disappears entirely.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'why_so_long',
  title: 'Why the same piece takes different amounts of time',
  body:
    '<p>Look up a symphony and you will find recordings that differ by ten minutes or more. The score is identical. Something else is happening.</p>' +
    '<p><b>Tempo marks are words, not numbers.</b><br>Allegro means cheerful and lively. It does not specify a speed. Two conductors reading the same word can be honestly a third apart.</p>' +
    '<p><b>Repeats are optional in practice.</b><br>Many scores mark a section to be played twice. Taking every repeat can add several minutes. There is no consensus about which to observe, and the decision is often made per performance.</p>' +
    '<p><b>The hall changes the tempo.</b><br>In a very reverberant space, fast passages turn to mud because each chord is still sounding when the next arrives. Conductors slow down to keep the texture clear. The same orchestra plays the same piece differently in two buildings.</p>' +
    '<p><b>Performing tradition drifts.</b><br>Recordings from a century ago are frequently faster than modern ones in some repertoire, and slower in others. Nothing changed in the score. What changed was what performers had grown up hearing.</p>' +
    '<p><b>Editions differ.</b><br>Scholarly work sometimes restores passages that were cut in earlier printings, or removes ones later editors added. Two performers can be reading genuinely different texts.</p>' +
    '<p>The variation is not sloppiness. A score is a set of instructions with real gaps, and interpretation is what fills them. The ten minutes is where the performer lives.</p>',
  comments: [
    { author: "recordingcollector", body: "The repeats point explains a difference I had assumed was tempo." },
    { author: "conductor_side", body: "The hall changing the tempo is real and rarely mentioned. Same programme, two venues, noticeably different evenings." },
  ],
},

{
  board: 'news', lang: 'en', category: '해외', author: 'chamber_intro',
  title: 'Starting with chamber music instead of orchestra',
  body:
    '<p>Newcomers are usually pointed at big orchestral works first. There is a case for the opposite.</p>' +
    '<p><b>You can hear each person.</b><br>In a quartet there are four lines and you can follow any of them. In an orchestra of ninety, individual voices merge. For a listener learning what to pay attention to, four is a more useful number than ninety.</p>' +
    '<p><b>The conversation is visible.</b><br>Chamber players look at each other, breathe together, wait. You can watch a phrase being handed from one player to another. Understanding arrives through your eyes as much as your ears.</p>' +
    '<p><b>The rooms are smaller.</b><br>Chamber venues typically seat a few hundred. You are close, the tickets cost less, and the acoustic does less work, which means you hear the players rather than the building.</p>' +
    '<p><b>The programmes are shorter.</b><br>Often around ninety minutes with one interval. For someone unsure whether they will enjoy sitting still, this matters more than people admit.</p>' +
    '<p><b>Where to begin.</b><br>A piano trio is a good entry point — three distinct colours, easy to tell apart. String quartets reward more listening but ask more at first. Wind quintets are the most immediately colourful and the least often programmed.</p>' +
    '<p>If a large orchestral concert has ever left you feeling that you should have been moved and were not, the problem may have been scale rather than taste.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'programme_reader',
  title: 'How to read a programme note without it spoiling the piece',
  body:
    '<p>Programme notes are written to help, and frequently do the opposite by telling you what to feel before you have heard anything.</p>' +
    '<p><b>Read the facts, skip the adjectives.</b><br>When it was written, for whom, what was happening in the composer\'s life — useful. Passages describing the music as anguished or triumphant hand you a conclusion. You can reach your own.</p>' +
    '<p><b>Movement listings are worth a glance.</b><br>Knowing there are four movements and roughly how long each runs prevents the common confusion of applauding in a gap. It also gives you a map, which helps attention.</p>' +
    '<p><b>Be sceptical of biographical explanations.</b><br>Notes often link a piece to an event in the composer\'s life. Sometimes the connection is documented. Often it is a story that has been repeated so long it reads as fact. If a note says the composer wrote this after a bereavement, it may be true and it may be tidy.</p>' +
    '<p><b>Read afterwards as well.</b><br>The same note is a different document once you have heard the piece. Things that meant nothing before become specific.</p>' +
    '<p><b>The performer biographies can be skipped entirely.</b><br>They are marketing and everyone knows it.</p>' +
    '<p>The best use of a programme note is as a map before and a conversation after. Its worst use is as instructions during.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'recording_vs_live',
  title: 'Why a recording you love can disappoint you live, and the reverse',
  body:
    '<p>People are often surprised when a performer they know from recordings sounds different in a hall. Several things are happening at once.</p>' +
    '<p><b>Recordings are made close.</b><br>Microphones sit near the instrument. You hear detail — breath, fingers, the grain of a bow — that no seat in a hall provides. A live performance can feel less vivid simply because you are further away than the microphone was.</p>' +
    '<p><b>Dynamic range is compressed.</b><br>To be listenable in a car or on headphones, the quiet passages of a recording are usually raised. Live, a genuine pianissimo may be nearly inaudible from the back, which is what the composer intended and what your ears are not used to.</p>' +
    '<p><b>Recordings are assembled.</b><br>Most studio albums are built from multiple takes. The performance you love may never have happened in one continuous stretch. This is not deception, but it does mean live playing is being compared against something no one could do live.</p>' +
    '<p><b>The room adds and subtracts.</b><br>A hall contributes reverberation the recording engineer chose to control. Some music gains enormously from this. Some loses clarity.</p>' +
    '<p><b>And live has something recordings cannot.</b><br>Risk. You can hear a player deciding. Something can go wrong. That awareness changes attention in a way no amount of audio quality replaces.</p>' +
    '<p>Neither is the real version. They are two different things that happen to use the same notes.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'cheap_seats_guide',
  title: 'Ways to hear more concerts for less money',
  body:
    '<p>Ticket prices are the most common reason people give for not attending. Most halls have several cheaper routes that are not advertised prominently.</p>' +
    '<p><b>Open rehearsals.</b><br>Many orchestras open a final rehearsal to the public, sometimes free, sometimes for a small fee. You hear the same programme, occasionally with the conductor stopping to work on a passage, which is fascinating in itself.</p>' +
    '<p><b>Under-thirty and student schemes.</b><br>Widespread and often dramatically cheap. Some require registration in advance, which is why people miss them — the sign-up is not at the box office.</p>' +
    '<p><b>Day-of-performance releases.</b><br>Halls hold back seats for various reasons and release them on the day. These are frequently good seats at reduced prices, and the number available is highest for weekday performances.</p>' +
    '<p><b>Lunchtime and church series.</b><br>Often an hour, often free or by donation, and frequently featuring the same musicians who play the evening concerts. The repertoire skews toward chamber and solo work.</p>' +
    '<p><b>Conservatory concerts.</b><br>Music school performances are usually free or nearly so. The standard at a good conservatory is much higher than most people expect, and you are hearing players a few years before their names cost money.</p>' +
    '<p><b>Subscribing is cheaper per concert.</b><br>Counterintuitive if you are trying to spend less overall, but if you plan to attend more than three or four, the per-ticket price usually drops substantially.</p>' +
    '<p>The combination that works for most people is a conservatory series for volume and one or two full-price concerts a year for occasions.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'applause_when',
  title: 'The applause question, explained properly',
  body:
    '<p>Almost everyone new to concerts worries about clapping at the wrong moment. The convention is simpler than it appears, and less important than the anxiety around it suggests.</p>' +
    '<p><b>The convention.</b><br>In multi-movement works, applause is generally held until the whole piece finishes. A symphony with four movements gets one round of applause at the end, not four.</p>' +
    '<p><b>It is recent.</b><br>Through the nineteenth century audiences applauded between movements routinely, and popular movements were sometimes encored on the spot. The silent-until-the-end habit largely dates from the twentieth century.</p>' +
    '<p><b>Why performers prefer it.</b><br>Multi-movement works are often designed so the silence between movements carries weight. A slow movement ending quietly into applause loses something the composer built.</p>' +
    '<p><b>How to know where you are.</b><br>The programme lists movements. Count them. Failing that, watch the players — if instruments stay up and the conductor keeps their arms raised, the piece is continuing.</p>' +
    '<p><b>If you get it wrong.</b><br>Nothing happens. A few people may look. The performance continues. It is a minor social convention, not a rule with consequences, and treating it as more than that keeps people away from concert halls entirely.</p>' +
    '<p>The one genuinely useful habit is to wait a beat after the final chord before clapping. Letting a piece end in silence is a gift to the room, and it also means you will never be the person who starts early.</p>',
  comments: [
    { author: "newattender", body: "The line about the anxiety keeping people away is true. That was exactly what put me off for years." },
    { author: "orchestral_player", body: "Waiting a beat after the last chord is the only part I would call a rule. Everything else is convention." },
  ],
},

{
  board: 'news', lang: 'en', category: '해외', author: 'what_conductor_does',
  title: 'What a conductor is actually doing',
  body:
    '<p>The most common question from newcomers, usually asked half-jokingly, is whether the conductor is necessary. The honest answer is that most of the work happened before you arrived.</p>' +
    '<p><b>Rehearsal is the job.</b><br>Decisions about balance, phrasing, tempo, articulation and character are made across several rehearsals. By the concert the orchestra largely knows what to do. What you see is the smallest visible part of the work.</p>' +
    '<p><b>Beating time is the least of it.</b><br>Professional orchestras can stay together without help in much of the repertoire. What the conductor supplies is shape — where a phrase is heading, which line should dominate, how much weight a chord takes.</p>' +
    '<p><b>The left hand and the face carry most information.</b><br>The beating hand keeps the frame. Everything expressive tends to come from the other side, and from where the eyes go. Players watch peripheral vision more than they watch the stick.</p>' +
    '<p><b>Repertoire choice is part of the role.</b><br>A music director shapes what an orchestra plays across years. This is arguably the most consequential thing they do and it is entirely invisible from a seat.</p>' +
    '<p><b>Where they genuinely matter in the moment.</b><br>Tempo changes, entries after long silences, and holding an orchestra together when the acoustic makes it hard to hear across the stage.</p>' +
    '<p>A good test is to listen to two recordings of the same orchestra under different conductors a few years apart. Same players, same hall, noticeably different music.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'opera_first_time',
  title: 'Approaching your first opera without preparation panic',
  body:
    '<p>Opera intimidates newcomers more than any other form, largely because of an assumption that you must study before attending. You do not.</p>' +
    '<p><b>Surtitles solved the language problem.</b><br>Nearly every house now projects translated text. You will follow the plot. Reading a full synopsis in advance is optional and, for some people, worse — knowing every turn removes the reason to watch.</p>' +
    '<p><b>Know the shape, not the details.</b><br>Two sentences about the situation is enough. Who wants what, and what is in the way. Everything else can arrive as it happens.</p>' +
    '<p><b>Length varies enormously.</b><br>Some operas run ninety minutes, some closer to five hours with two intervals. Check before booking. This single piece of information prevents most bad first experiences.</p>' +
    '<p><b>Comedies are easier to start with.</b><br>Not because tragedies are harder to understand, but because the pacing is faster and the plots turn on situations rather than psychology.</p>' +
    '<p><b>Sit further back than you think.</b><br>Opera houses are large and voices are designed to carry. Front seats put you below the stage looking up, and the orchestra pit sits between you and the singers.</p>' +
    '<p><b>The singing will sound strange at first.</b><br>Operatic voices are trained to fill a large space without amplification, which produces a sound most people have not heard closely. Two or three exposures and it stops registering as strange and starts registering as loud, warm, and human.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'buying_recordings',
  title: 'How to choose between forty recordings of the same piece',
  body:
    '<p>You have decided you like a piece and discovered that dozens of recordings exist. There is no best one, but there are useful ways to narrow it.</p>' +
    '<p><b>Start with a recent one.</b><br>Not because new is better, but because recorded sound quality is a real variable and older recordings ask you to listen past their limitations. Get to know the piece first, then explore historical performances.</p>' +
    '<p><b>Live and studio are different products.</b><br>A live recording has energy and audience noise. A studio one has precision and no risk. Neither is more authentic. Knowing which you have prevents disappointment.</p>' +
    '<p><b>Period instruments change everything.</b><br>For music before roughly 1830, recordings on historical instruments sound substantially different — lighter, faster, drier. It is not a small variation. Hear one of each before deciding what you prefer.</p>' +
    '<p><b>The famous recording is famous for a reason, usually.</b><br>Reputation does accumulate around genuinely remarkable performances. It also accumulates around whichever recording happened to be available longest. Both are true.</p>' +
    '<p><b>Ignore star ratings.</b><br>Reviews are useful for describing what a recording does. Rankings between excellent recordings are mostly taste presented as judgment.</p>' +
    '<p><b>Two is more useful than one.</b><br>You learn more about a piece from hearing two different accounts than from finding the definitive one. The differences show you where the music has room.</p>',
},

{
  board: 'news', lang: 'en', category: '해외', author: 'listening_habits',
  title: 'Listening at home in a way that actually holds attention',
  body:
    '<p>Many people who enjoy concerts find they cannot concentrate on the same music at home. The problem is usually not attention span but setting.</p>' +
    '<p><b>Sitting down is the whole technique.</b><br>Music as background is a different activity from music as the thing you are doing. Twenty minutes in a chair with nothing else open does more than three hours of accompaniment to other tasks.</p>' +
    '<p><b>Start with shorter pieces.</b><br>A twelve-minute work heard completely is worth more than a symphony abandoned at the second movement. Build the habit on things you can finish.</p>' +
    '<p><b>Follow something specific.</b><br>Pick one instrument and track it through a movement. Attention needs a task. Told to listen generally, most minds wander within ninety seconds.</p>' +
    '<p><b>Repeat rather than expand.</b><br>Hearing one piece five times reveals more than hearing five pieces once. The second and third listens are where structure becomes audible.</p>' +
    '<p><b>Speakers beat headphones for this.</b><br>Headphones give detail but put the sound inside your head. Speakers place it in a room, which is closer to how the music was conceived and easier to stay with for long stretches.</p>' +
    '<p><b>Silence afterwards.</b><br>Not starting the next thing immediately lets the piece finish properly. This is the single change most people report as making the biggest difference.</p>',
},

];
