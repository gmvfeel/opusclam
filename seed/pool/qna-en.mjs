/* ============================================================
   자동 시드 콘텐츠 풀 — 지식나눔 · 영어 (qna / lang: 'en')
   ------------------------------------------------------------
   2026-08-15 · 세 번째 외국어 배치

   ★ 이 게시판만 <b>track 칸이 있습니다</b>
     auto-seed 의 extraCols:['track','keywords'] 가 따로 담습니다.
     쓸 수 있는 값은 두 가지뿐이고, 분류는 그 아래에 딸립니다 —

       track: '음악지식'  → 서양음악사 · 공연홀 · 연주/공연/음반 · 현대음악
                            대관관련 · 음악학교 · 연주자/연주단체/작곡과
                            해외유학 · 콩쿨 · 입시/진로관련
       track: '전공별'    → 기악전공 · 성악전공 · 작곡전공
                            음악사/이론전공 · 교회음악전공 · 기타전공

     ★ track 과 category 를 <b>둘 다</b> 적어야 합니다. 하나만 적으면
       화면의 갈래 고르개에서 걸리지 않습니다.
     ★ 값은 한국어 그대로입니다 — 영어를 적으면 잡히지 않습니다.

   ★ 결
     묻고 답하는 게시판입니다. 본문은 <b>질문</b>이고, 댓글이 답입니다.
     핫토픽처럼 결론을 갖고 시작하면 안 됩니다.
     ★ '입시/진로관련'·'해외유학' 은 <b>한국 입시</b> 이야기가 아니라
       그쪽 나라 사정으로 씁니다.
   ============================================================ */

export const QNA_EN = [

{
  board: 'qna', lang: 'en', track: '음악지식', category: '서양음악사',
  author: 'wheredidthatgo', title: 'Why did the harpsichord just stop?',
  body:
    '<p>I understand the piano could do things the harpsichord could not. What I do not understand is how completely it vanished.</p>' +
    '<p>It was not a gradual decline into a niche — it seems to have gone from standard to nearly extinct inside a couple of generations, and then come back two centuries later. Was there a specific point where it flipped?</p>',
  comments: [
    { author: 'earlykeys', body: 'Dynamics did most of it. Once composers started writing music that requires getting louder inside a phrase, the harpsichord could not play the repertoire being written.' },
    { author: 'periodinstruments', body: 'Worth adding that many were destroyed or converted. Instruments were expensive objects, not museum pieces — an old harpsichord became firewood or furniture.' },
    { author: 'wheredidthatgo', body: 'The converted-into-furniture part explains a lot about why so few survived.' },
    { author: 'organist_side', body: 'The organ is the counterexample. Same limitation, never disappeared, because it was attached to an institution that kept using it.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '음악지식', category: '연주/공연/음반',
  author: 'takeone_takenine', title: 'How much of a studio recording is actually one take?',
  body:
    '<p>Been listening to a lot of studio recordings lately and started wondering what I am really hearing.</p>' +
    '<p>Is a typical classical album assembled from many takes, or do most artists still try to capture longer stretches? Does it vary by label?</p>',
  comments: [
    { author: 'sessionplayer', body: 'Varies enormously. Some producers work in long takes and patch only what fails. Others record in short sections by design. Both are normal.' },
    { author: 'behindtheglass', body: 'The thing that surprised me working sessions is that heavy editing does not automatically sound worse. A badly assembled long take can sound more disjointed than a well-edited patchwork.' },
    { author: 'takeone_takenine', body: 'So the seams are more about the editor than the number of takes.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '음악지식', category: '공연홀',
  author: 'seatmap_confused', title: 'Are the expensive seats actually the best sounding ones?',
  body:
    '<p>Front orchestra seats cost the most everywhere I look. But I have had better listening experiences in cheaper seats further back.</p>' +
    '<p>Is the pricing about sound at all, or is it about sightlines and prestige?</p>',
  comments: [
    { author: 'hallacoustics', body: 'Mostly sightlines and prestige. Acoustically, front orchestra often gets an unbalanced picture — you hear whoever is closest disproportionately.' },
    { author: 'balconyregular', body: 'First balcony center is the standard answer among people who go a lot, and it is usually not the most expensive ticket.' },
    { author: 'seatmap_confused', body: 'That matches what I have been experiencing without understanding why.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '음악지식', category: '현대음악',
  author: 'notationquestion', title: 'When a score has no barlines, what is holding it together?',
  body:
    '<p>Looking at a piece with no time signature and no barlines. Performers seem to arrive at similar results anyway.</p>' +
    '<p>What are they actually reading? Is there a shared convention, or is it more that they all listened to the same recording?</p>',
  comments: [
    { author: 'newmusicperformer', body: 'Usually proportional notation — horizontal distance on the page equals time. Once you know that, spacing carries the information barlines would.' },
    { author: 'scorestudy', body: 'And the recording thing is real. First recordings become de facto interpretations for pieces with loose notation. Not always what the composer wanted.' },
    { author: 'notationquestion', body: 'So spacing is the notation. That reframes what I have been staring at.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '음악지식', category: '해외유학',
  author: 'applying_abroad', title: 'Does the country matter more than the teacher?',
  body:
    '<p>Deciding between programs in three countries. The teacher I most want to study with is at the least prestigious school in the least obvious city.</p>' +
    '<p>Am I underrating what the institution and location give you — the network, the concerts, the language?</p>',
  comments: [
    { author: 'studied_two', body: 'Teacher. Not close. You will spend four years in a room with that person and about six hours a year with the institution.' },
    { author: 'moved_for_school', body: 'I will push back slightly. The city matters for what happens after — where you can freelance, who hears you play. Not more than the teacher, but not nothing.' },
    { author: 'applying_abroad', body: 'That is the tension I could not name. Teacher for the four years, city for the ten after.' },
    { author: 'former_faculty', body: 'One practical note — teachers move. Ask how long they have been there before you build a decision around one person.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '음악지식', category: '콩쿨',
  author: 'competition_math', title: 'How do judges actually score, and does it work?',
  body:
    '<p>Most competitions publish a scoring system but not the scores. I have never understood what happens between fifteen judges hearing the same performance and one number appearing.</p>' +
    '<p>Are outliers dropped? Is there discussion, or is it purely arithmetic?</p>',
  comments: [
    { author: 'jurymember', body: 'Varies by competition. Many drop the highest and lowest scores specifically to blunt strategic voting. Some allow discussion between rounds, some forbid it entirely.' },
    { author: 'competed_lots', body: 'The forbid-discussion rule matters more than people realise. Where discussion is allowed, the most persuasive person in the room has outsized influence.' },
    { author: 'competition_math', body: 'Dropping high and low makes sense. It never occurred to me that judges might vote strategically.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '전공별', category: '기악전공',
  author: 'shifting_problems', title: 'Is there a point where shifting stops being scary?',
  body:
    '<p>Third year, cello. Large shifts still feel like a leap of faith rather than a movement I control. I land correctly most of the time but I never feel like I chose to.</p>' +
    '<p>Is this a practice problem or is there something structural I am missing?</p>',
  comments: [
    { author: 'cello_teacher', body: 'Usually structural. If you are aiming at the destination note, you are guessing. Practice the release and the travel — where the hand goes in between — and the arrival takes care of itself.' },
    { author: 'fourthyear', body: 'What changed it for me was shifting silently. No bow. Just the left hand moving, listening to the tap of arrival. Ugly practice, worked in about three weeks.' },
    { author: 'shifting_problems', body: 'Both of these describe the same thing — I am thinking about where I land instead of how I travel.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '전공별', category: '성악전공',
  author: 'passaggio_help', title: 'Every teacher describes the passaggio differently and I am lost',
  body:
    '<p>Three teachers, three explanations. One talks about space, one about breath, one about vowel modification. They contradict each other on specifics.</p>' +
    '<p>Are they describing the same thing in different words, or do they genuinely disagree?</p>',
  comments: [
    { author: 'voice_faculty', body: 'Mostly the same thing described from different angles. Singing pedagogy has no shared vocabulary, so teachers invent language that worked on their own instrument.' },
    { author: 'baritone_here', body: 'Pick one and stay with it for a year. Mixing three vocabularies is worse than committing to an imperfect one.' },
    { author: 'passaggio_help', body: 'The idea that they invented the language from their own experience explains why none of it transfers cleanly.' },
    { author: 'accompanist_view', body: 'From the piano — I can usually hear when a singer is thinking about a concept mid-phrase. Whichever one you pick, it has to become automatic.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '전공별', category: '작곡전공',
  author: 'orchestration_fear', title: 'How do you learn orchestration without an orchestra?',
  body:
    '<p>Writing for large forces and I have never heard any of it played. Sample libraries lie to me — everything balances perfectly, which I know is not real.</p>' +
    '<p>How did people learn this before they had ensembles willing to read their work?</p>',
  comments: [
    { author: 'orch_teacher', body: 'Score and recording together. Follow a score you know while listening, and specifically listen for what you cannot hear — the doublings that vanish. Samples never teach you what disappears.' },
    { author: 'young_composer', body: 'Write for whatever will actually play it. A bad quartet reading taught me more than three orchestral pieces that only existed as files.' },
    { author: 'orchestration_fear', body: 'Listening for what disappears is a completely different exercise from what I have been doing.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '전공별', category: '음악사/이론전공',
  author: 'analysis_doubt', title: 'When analysis and hearing disagree, which wins?',
  body:
    '<p>Wrote a paper arguing a passage functions one way. My advisor agrees the analysis is sound but says it does not sound like that.</p>' +
    '<p>How is this resolved? It feels like the whole field rests on something unstable.</p>',
  comments: [
    { author: 'theory_phd', body: 'Your ear wins, and then the job is figuring out why the analysis missed it. Usually the model is too narrow, not the hearing wrong.' },
    { author: 'performer_analyst', body: 'This is exactly why performers get impatient with theory. Not because analysis is useless but because it is often presented as more settled than it is.' },
    { author: 'analysis_doubt', body: 'So the disagreement is data rather than a failure. That is a more useful framing than what I had.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '전공별', category: '교회음악전공',
  author: 'sunday_repertoire', title: 'How do you choose music when the congregation cannot sing it?',
  body:
    '<p>Small church, aging congregation, hymns pitched too high for most of them. I can transpose, but at some point transposing everything down changes the character of the writing.</p>' +
    '<p>Where do you draw the line between serving the music and serving the people singing it?</p>',
  comments: [
    { author: 'churchmusician20', body: 'People every time. A hymn nobody can sing is not being served by its original key. Most hymnals were pitched for congregations that sang far more often than ours do.' },
    { author: 'organist_rural', body: 'A step down is almost always fine. Beyond that the accompaniment starts sitting badly and you would do better choosing different repertoire.' },
    { author: 'sunday_repertoire', body: 'The point about hymnals being pitched for a different singing culture is one I had not considered.' },
  ],
},

{
  board: 'qna', lang: 'en', track: '전공별', category: '기타전공',
  author: 'making_the_switch', title: 'Is it too late to change instruments at twenty-four?',
  body:
    '<p>Trained on one instrument through a degree, and I have known for two years that I want to be playing a different one. Everyone tells me the window has closed.</p>' +
    '<p>Has anyone actually done this? Not as a hobby — as the thing you do.</p>',
  comments: [
    { author: 'switched_at_26', body: 'Did it at twenty-six. The advantage nobody mentions is that you already know how to practice. That is most of the first five years and you skip it.' },
    { author: 'conservatory_admin', body: 'It is not too late but be honest about the timeline. You are looking at five or six years to a professional standard, not two.' },
    { author: 'making_the_switch', body: 'Six years feels long until I remember I would be thirty either way.' },
    { author: 'stayed_put', body: 'Counterpoint worth hearing — I wanted to switch at that age and did not, and the restlessness turned out to be about the career rather than the instrument. Worth checking which one it is.' },
  ],
},

];
