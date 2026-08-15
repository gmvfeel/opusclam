/* ============================================================
   자동 시드 콘텐츠 풀 — 핫토픽 · 영어 (hottopic / lang: 'en')
   ------------------------------------------------------------
   2026-08-15 · 첫 영어 배치

   ★ 번역이 아닙니다
     한국어 글을 옮긴 것이 아니라, 영어권 연주자가 <b>부딪히는 벽</b>을
     주제로 새로 썼습니다. 한국어 풀의 「아파트 층간소음」에 해당하는
     것이 여기서는 <b>연습실 예약 경쟁·리스 조항·오디션 투어 비용</b>입니다.
     같은 고민이라도 걸리는 지점이 다릅니다.

   ★ 결이 무너지는 지점 (다음 배치를 쓸 때 조심할 것)
     · 한국어 글을 영어로 옮기면 첫 줄에서 티가 납니다
     · 지나치게 매끈한 문장 — 실제 게시글은 문장이 고르지 않습니다
     · 모든 글이 훈훈하게 끝나면 게시판이 아니라 홍보물이 됩니다
       → 결론이 안 난 글, 댓글에서 이견이 갈리는 글을 섞었습니다

   ★ 글쓴이 이름은 <b>영어권 닉네임</b>입니다
     auto-seed 가 POOL.authors(한국어 이름)를 붙이지 않도록,
     글마다 author 를 반드시 적어 둡니다.

   ★ category 는 한국어 그대로 씁니다 ('국내' · '해외')
     화면에서 i18n 사전이 Domestic · International 로 바꿉니다.
     여기에 영어를 적으면 어느 분류에도 잡히지 않습니다.
   ============================================================ */

export const HOTTOPIC_EN = [

/* ── 1 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'practiceroom6am',
  title: 'The practice room sign-up sheet is broken and everyone knows it',
  body:
    '<p>Every semester it is the same thing. The sheet goes up Monday at 8am, and by 8:04 every decent room is gone for the entire week. Not booked by people who will actually use them — booked by three or four students who sign up for everything and then show up for maybe half.</p>' +
    '<p>I counted last Thursday. Walked the hall at 2pm, which is supposedly peak. Six of eleven rooms were empty and marked as reserved. One had a bag in it and nobody came back for two hours.</p>' +
    '<p>I brought it up with the department and got the answer I expected, which is that they are aware and looking into options. That was also the answer in October.</p>' +
    '<p>What actually works, at least for me: I stopped fighting for the good rooms. Room 118 has a piano that has not been tuned since the Obama administration and nobody wants it, but I play cello so I do not care. It is free almost every afternoon. If you are a string or wind player, look for the rooms with bad pianos.</p>' +
    '<p>The other thing is 6am. Nobody is there. I hated it for about three weeks and now it is the only time I actually get anything done.</p>',
  comments: [
    { author: 'violadad', body: 'The bad-piano trick is real. I have been using the two rooms with uprights that are half a step flat for years. Empty every single day.' },
    { author: 'mmarchetti', body: 'Our school went to a swipe-card system where the reservation expires if you do not badge in within fifteen minutes. Complaints for one semester, then everyone adjusted. It is not complicated to fix, schools just do not want the fight.' },
    { author: 'practiceroom6am', body: 'That is exactly what I proposed. The response was that it would require IT resources. I think the real reason is that the people hoarding rooms are the ones with faculty backing.' },
    { author: 'quietcorner', body: 'Genuinely not trying to be contrary but I hoard rooms and I will explain why. I have a recital in five weeks and I need four hours a day. If I book day-of I get nothing. The system rewards booking early so I book early. Fix the system, not the students.' },
  ],
},

/* ── 2 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'lowbrassmatt',
  title: 'I spent $4,200 on auditions last year and won nothing',
  body:
    '<p>Posting the actual numbers because nobody does and I think that is part of the problem.</p>' +
    '<p>Seven auditions. Application fees came to $610. Flights were $2,180, and that is with me driving to two of them. Hotels $890. Ground transport, checked instrument fees, food on the road, a coach session before the big one — call it $520.</p>' +
    '<p>Advanced past the prelim twice. Semifinal once. No job.</p>' +
    '<p>I am not writing this to complain exactly. I knew the odds. What I did not understand going in was how much the money changes the way you play. By audition five I was doing the math in the hotel room the night before, and you cannot walk out on stage carrying that. The people who win are often the people who can afford to not care about the plane ticket.</p>' +
    '<p>This year I am doing three. Picking them based on repertoire I already have in my hands rather than what looks prestigious. I would rather show up to three prepared than seven scared.</p>',
  comments: [
    { author: 'hornfixation', body: 'Three well-prepared is right. I did nine one year and my playing got measurably worse across the season because I was never off the road long enough to actually improve anything.' },
    { author: 'sublist_survivor', body: 'The part about the money affecting the playing is the truest thing in this post. Nobody talks about it because admitting it sounds like an excuse.' },
    { author: 'lowbrassmatt', body: 'It does sound like an excuse. That is why I sat on this post for a month before putting it up.' },
  ],
},

/* ── 3 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'thirdfloorwalkup',
  title: 'My lease says no musical instruments. I have lived here four years.',
  body:
    '<p>Standard clause, buried in the middle of page six. No musical instruments of any kind. I signed it because every lease in this neighborhood has some version of it and I needed an apartment.</p>' +
    '<p>What I did was talk to the two neighbors who share walls before I ever unpacked the violin. Told them I was a musician, gave them my number, said text me any time and I will stop. The woman below me said her daughter used to play flute and she missed the sound. The guy next door works nights so I do not play before 11am.</p>' +
    '<p>Four years, zero complaints. The clause has never come up.</p>' +
    '<p>I know the advice here is technically do not do this. But the honest version is that the clause exists so the landlord has an option if someone becomes a problem. If you are not a problem, nobody goes looking. The failure mode is not the lease, it is the neighbor who gets annoyed and starts a paper trail.</p>' +
    '<p>Practice mute for anything after 9pm. And I never, ever run passages on a Sunday morning.</p>',
  comments: [
    { author: 'brooklyncellist', body: 'This matches my experience. Four apartments, same clause every time, never once enforced. The one time a friend got a letter it was after a neighbor complained twice and she had ignored both.' },
    { author: 'legaladjacent', body: 'Worth saying though — if the landlord ever does want you out for an unrelated reason, that clause is sitting there. You have handed them a clean eviction. It has not bitten you yet. That is different from it being safe.' },
    { author: 'thirdfloorwalkup', body: 'Fair. I have thought about that. I think I decided the alternative was not playing, and that was not really an alternative.' },
  ],
},

/* ── 4 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'ceIloseat',
  title: 'Flying with a cello: the seat is not the hard part',
  body:
    '<p>Twelve flights with the cello last year. Here is what I actually learned, most of which I could not find written down anywhere.</p>' +
    '<p><strong>Buying the seat is easy.</strong> Most carriers have a process. It costs what a passenger costs, sometimes a bit less. Book it by phone, not online, because the web form will not let you enter a name like CBBG or Cello Extra.</p>' +
    '<p><strong>The hard part is the gate agent who has never seen this.</strong> Twice I had to explain the airline\'s own policy to the person enforcing it. Now I carry a printout. Not a screenshot on my phone — paper. It ends the conversation in about fifteen seconds.</p>' +
    '<p><strong>Window seat, not aisle.</strong> Aisle means the cart hits it all flight. Also ask for the row in front of an exit row rather than the exit row itself, which usually cannot hold a strapped item.</p>' +
    '<p><strong>Humidity on long-haul is the real enemy.</strong> Cabin air is desert-dry. I put two dampits in and check them at every stop. Came back from a January tour with a small open seam anyway.</p>' +
    '<p>The cheaper option nobody mentions: on short domestic hops it can be less expensive to rent an instrument at the destination than to buy a seat. Depends on the city and whether you trust what you will get.</p>',
  comments: [
    { author: 'bassprobs', body: 'Paper printout is the single best tip here. I keep the policy page in the case pocket permanently.' },
    { author: 'onthecircuit', body: 'The rental thing is very city dependent. Worked great for me in Chicago, was a disaster in a smaller market where the only rental was a student instrument with a warped fingerboard.' },
    { author: 'ceIloseat', body: 'Yeah, I should have said that. It is fine in cities with a real shop and a rental program. Anywhere else, buy the seat.' },
  ],
},

/* ── 5 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'anon_adjunct',
  title: 'Four schools, no health insurance, and I am considered lucky',
  body:
    '<p>I teach at four institutions. Two community colleges, a small liberal arts school, and a conservatory prep division. Combined that is roughly thirty contact hours a week plus driving. None of them offers benefits because none of them classifies me as full time, and each one has a cap on credit hours that lands just under whatever the threshold is.</p>' +
    '<p>People in this field tell me I am lucky and they are not wrong. I have steady students, I like the work, and I am teaching my instrument rather than doing something unrelated to pay rent. Plenty of people I graduated with are not.</p>' +
    '<p>But the structure is the structure. There is no version of this where working harder gets me benefits. The cap is the point.</p>' +
    '<p>What I would tell someone about to start: negotiate your per-credit rate before you say yes to the first one. Once you have taught a semester at a number, that number is your number forever. I said yes to a low rate in year one out of gratitude and it followed me for six years.</p>',
  comments: [
    { author: 'twocampuses', body: 'The credit hour cap being deliberate is something I did not understand for years. I thought I was unlucky with scheduling.' },
    { author: 'formeradjunct', body: 'I left for a public school orchestra director job three years ago. Less prestige, salary, benefits, retirement. I miss the college students and I would not go back.' },
    { author: 'anon_adjunct', body: 'I think about that route about once a month, usually in February.' },
    { author: 'strings_and_things', body: 'The rate negotiation advice is the most useful thing in this thread. I got a 40% bump moving between schools purely because I asked once instead of accepting the posted rate.' },
  ],
},

/* ── 6 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'tendonitis_tuesday',
  title: 'The injury I ignored for eight months',
  body:
    '<p>Started as a dull thing in my right forearm after long sessions. I did what everyone does, which is assume it would go away, then assume it was technique, then assume it was posture, then just stop noticing it because it was always there.</p>' +
    '<p>Eight months later I could not hold a bow for more than twenty minutes.</p>' +
    '<p>The thing that finally made me go was that I could not open a jar. Not a music problem. A regular life problem. That was the moment it stopped being something I could reason with.</p>' +
    '<p>Diagnosis was straightforward, treatment was six weeks of not playing and then a slow rebuild with a physical therapist who works with musicians. Finding that person mattered more than anything else. The first PT I saw gave me exercises designed for tennis players and I got worse.</p>' +
    '<p>I am fine now. What I lost was a competition I had been preparing eleven months for, and about a year of confidence I have mostly gotten back.</p>' +
    '<p>If something has hurt for more than two weeks, that is not a thing you play through. I know you have heard that. I had heard it too.</p>',
  comments: [
    { author: 'lefthandpinky', body: 'The jar detail. That was mine too, except it was a doorknob. Something about it being outside music makes it real in a way that playing pain does not.' },
    { author: 'pt_for_musicians', body: 'Please do seek out someone who specifically treats performing artists. General ortho and sports PT are excellent at what they do and often have no framework for what a five-hour practice day does to a body.' },
    { author: 'tendonitis_tuesday', body: 'Seconding this hard. The difference between my first PT and my second was night and day and I wasted six weeks finding that out.' },
  ],
},

/* ── 7 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'screenandcarpet',
  title: 'What the screen actually changes about how you play',
  body:
    '<p>I have taken enough auditions now to have opinions about the screen, and they are not the ones I expected to have.</p>' +
    '<p>Everyone talks about the screen in terms of fairness, and that is real and important and I am not arguing with it. What nobody prepared me for is how strange it is to play into a room where you cannot read anything. No faces, no shifting in seats, nothing. You finish a phrase you know was good and there is just carpet and silence.</p>' +
    '<p>The first two times it wrecked me. I kept playing louder trying to get some kind of response back, which is exactly wrong.</p>' +
    '<p>What helped: practicing into a corner at home. Sounds stupid, works. Also somebody told me to decide before I walked out that I was not going to receive any information during the excerpt, and to treat any impulse to listen for a reaction as a distraction rather than a signal. That reframing did more for me than any amount of technical prep.</p>' +
    '<p>The carpet thing is real too. They roll it out so they cannot hear your shoes and guess gender or height. First time I hit it I thought something was wrong with the room.</p>',
  comments: [
    { author: 'principal_someday', body: 'Practicing into a corner is what my teacher had me do and I thought it was a joke for about a year.' },
    { author: 'audition_ghost', body: 'The silence is the whole thing. I have played fine in front of hostile panels and fallen apart behind a screen where nobody was judging me visibly at all.' },
    { author: 'screenandcarpet', body: 'That is a good way to put it. The absence of information is worse than bad information.' },
  ],
},

/* ── 8 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'notarealstudio',
  title: 'How I make audition recordings in a bedroom without it sounding like a bedroom',
  body:
    '<p>Prescreening recordings have gotten more important and most of us do not have access to a hall. Here is what I have worked out over about thirty takes.</p>' +
    '<p><strong>The room matters more than the microphone.</strong> I spent money on a mic upgrade first and it changed almost nothing. Then I moved to a different room in the same apartment and it changed everything. Look for the space with the least parallel surfaces and the most soft stuff.</p>' +
    '<p><strong>Do not record in a closet.</strong> Common advice, wrong for acoustic instruments. It kills the sound completely. That advice comes from voiceover work.</p>' +
    '<p><strong>Distance.</strong> Too close and you get bow noise and key clatter. I ended up around two meters, higher than my head, angled down. Took a lot of trial and error to land there.</p>' +
    '<p><strong>Do not fix it in post.</strong> Committees can hear reverb that was added, and several explicitly ask you not to process. A slightly dry honest recording beats a fake hall every time.</p>' +
    '<p><strong>Record more days than you think.</strong> My best take came on day four, not because I played better but because I had stopped caring by then.</p>',
  comments: [
    { author: 'onemictwice', body: 'The closet thing needs to be said more. I lost a prescreening round to a recording that sounded like it was made inside a sock.' },
    { author: 'panelist_anon', body: 'I have sat on prescreening panels. We can absolutely tell when reverb has been added, and it reads as someone hiding something even when they are not. Send it dry.' },
    { author: 'notarealstudio', body: 'That confirms something I suspected but had never heard from the other side. Thank you.' },
  ],
},

/* ── 9 ─────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'subsandgigs',
  title: 'Getting on a sub list is a completely different skill from playing well',
  body:
    '<p>Took me three years to figure out that these are unrelated problems and I was only working on one of them.</p>' +
    '<p>The people who get called are not always the best players. They are the players who answer the phone, say yes, show up early, know the cuts, do not complain about the part, and leave without making anything about themselves. Personnel managers are solving a logistics problem, not holding a competition.</p>' +
    '<p>What actually got me on lists:</p>' +
    '<p>One, I stopped emailing music directors and started emailing personnel managers. They are the ones who make the calls. This is obvious in retrospect and took me two years.</p>' +
    '<p>Two, I said yes to a terrible last-minute call for a nutcracker run I was underqualified for and got through it. That one yes generated more work than every audition I took that year.</p>' +
    '<p>Three, I keep a folder with every standard part I have ever played, marked with the cuts I was given. When someone calls at 4pm for an 8pm downbeat I can actually do it.</p>' +
    '<p>The uncomfortable part is that none of this is about music. I found that depressing for a while and then decided it was just a second job I had to learn.</p>',
  comments: [
    { author: 'freelance_fifteen', body: 'The personnel manager point is the whole post. I wasted a year cultivating a relationship with a conductor who had no say in hiring subs.' },
    { author: 'orchpit', body: 'Would add: reply to the group text even when you are declining. The people who go silent get dropped off lists faster than the people who say no.' },
    { author: 'subsandgigs', body: 'Yes, and quickly. A fast no is worth more to them than a slow maybe.' },
    { author: 'tryingtobreakin', body: 'Reading this as someone with zero calls in eighteen months and it is useful but also a little bleak. The folder of parts assumes you have played the parts.' },
  ],
},

/* ── 10 ────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'moderndoubts',
  title: 'I do not connect with most new music and I am tired of pretending',
  body:
    '<p>Writing this expecting to get argued with, which is fine.</p>' +
    '<p>I play a lot of contemporary repertoire. Some of it I love and it has changed how I hear everything else. But a real portion of what I get handed does not do anything for me, and the culture around it makes that impossible to say out loud. If you do not connect with a piece the assumption is that you did not work hard enough to understand it.</p>' +
    '<p>Sometimes that is true. I have had pieces open up on the fourth or fifth pass and I was the problem. That has happened enough that I take it seriously.</p>' +
    '<p>But it cannot be true every time. Some pieces are just not good, the same way some pieces from 1840 are not good. We are comfortable saying that about the dead ones.</p>' +
    '<p>I still play everything I am asked to play, at full commitment. I just want to be able to have an honest conversation in the green room afterward.</p>',
  comments: [
    { author: 'newmusicensemble', body: 'I run a new music group and I agree with you more than you would expect. The defensiveness comes from decades of the repertoire being dismissed wholesale. It makes it hard to have normal critical conversations.' },
    { author: 'sceptic_string', body: 'Thank you for writing this. I have thought it for years.' },
    { author: 'composer_side', body: 'From the writing side — please tell us. A performer who says a passage does not land is giving me information I cannot get anywhere else. Polite silence is much worse for the piece.' },
    { author: 'moderndoubts', body: 'That is a genuinely useful reframe. I have been treating it as a judgment to withhold rather than information to give.' },
  ],
},

/* ── 11 ────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'bowrehair',
  title: 'Small maintenance things that saved me money over ten years',
  body:
    '<p>Nothing dramatic, just accumulated habits.</p>' +
    '<p><strong>Rehair on a schedule, not on feel.</strong> By the time it feels bad you have been playing on bad hair for two months. I do twice a year and set a calendar reminder.</p>' +
    '<p><strong>Loosen the bow every single time.</strong> Everyone knows this. I still see people leave it tight in the case overnight. That is what warps a stick.</p>' +
    '<p><strong>Wipe rosin off the strings and top after every session.</strong> Ten seconds. Rosin that sits and bakes into varnish is a repair bill.</p>' +
    '<p><strong>Get a hygrometer, an actual one, not the free one in the case.</strong> The case ones are decorative. Mine read 45% for a year while the room was at 28%.</p>' +
    '<p><strong>Find a luthier before you need one.</strong> Go in for something small, a sound post adjustment or a bridge check. You want a relationship established before the day something cracks.</p>' +
    '<p>The hygrometer one is the one I would go back and tell myself first. I had a seam open twice before I understood the room was the problem.</p>',
  comments: [
    { author: 'winterseam', body: 'The case hygrometers being useless is not said enough. Mine was off by seventeen points.' },
    { author: 'shopbench', body: 'From behind the bench — the relationship point is real. When I know a player and their instrument I can do a five minute adjustment instead of a diagnostic hour.' },
    { author: 'bowrehair', body: 'That is exactly what I have found. My luthier now knows my cello better than I do.' },
  ],
},

/* ── 12 ────────────────────────────────────────────── */
{
  board: 'hottopic', lang: 'en', category: '해외', author: 'firstchairnobody',
  title: 'Nobody warned me that winning the job was its own adjustment',
  body:
    '<p>Two years in a section job now. I spent seven years trying to get one and about four months being quietly miserable once I had it, which I was not expecting and did not feel entitled to mention to anyone.</p>' +
    '<p>Some of it was practical. The repertoire cycle is relentless in a way that student life is not. You are sight-reading things in rehearsal that you would have spent a month on in school, and the standard is that you just do it.</p>' +
    '<p>Some of it was identity. For seven years the question of who I was had a clear answer, which was someone trying to win a job. Then that ended and there was no next thing lined up behind it.</p>' +
    '<p>What helped was taking on things that were not the job. I started coaching a youth orchestra sectional once a month. Small, unglamorous, and it gave me somewhere to put the part of me that needed a project.</p>' +
    '<p>I am writing this mostly for people currently in year five of auditioning, because I remember reading posts like the ones above and thinking that everything would resolve. It does resolve. It just resolves into a different set of things.</p>',
  comments: [
    { author: 'section_viola', body: 'Four months is about right. Mine was closer to six and I told nobody because it felt obscene to be unhappy about it.' },
    { author: 'stillauditioning', body: 'Honestly I needed to read this. Not because it makes me feel better exactly, but because I have built the job up into something that fixes everything and that is probably not healthy.' },
    { author: 'firstchairnobody', body: 'That was exactly my mistake. The job is a good job. It is not an answer to a question about yourself.' },
    { author: 'twentyyearsin', body: 'Twenty years in the same section here. The thing that keeps it alive for me is that the repertoire keeps changing what it means. Brahms 2 at 26 and Brahms 2 at 46 are different pieces.' },
  ],
},

];
