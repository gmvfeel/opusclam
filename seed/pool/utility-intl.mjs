/* ============================================================
   자동 시드 콘텐츠 풀 — 유틸리티 · 영어 (utility / lang: 'en')
   ------------------------------------------------------------
   2026-08-15 · 일곱 번째 외국어 배치

   ★ 결
     「내가 만들어 쓰는 방법」을 적는 게시판입니다.
     한국어 글은 「연주할 홀의 정보를 미리 모아 두는 표를 만들었습니다」
     처럼 <b>손수 만든 도구·정리법</b>을 나눕니다. 댓글은 없습니다.
     본문 600자쯤으로 길고, 항목을 나열하는 짜임이 많습니다.

   ★ 상품·서비스 이름을 함부로 적지 않습니다
     특정 앱·제품을 권하면 사실 확인이 필요해지고, 값이나 기능이
     바뀌면 글이 틀린 것이 됩니다. <b>방법</b>을 적고 도구는 일반명사로
     둡니다.

   ★ 분류는 한국어 그대로 — '자료' · '악보' · '유틸리티'
   ============================================================ */

export const UTILITY_EN = [

{
  board: 'utility', lang: 'en', category: '유틸리티', author: 'venue_sheet',
  title: 'A sheet I keep about every hall I have played',
  body:
    '<p>After the third time I turned up somewhere and had to ask the same questions again, I started writing it down.</p>' +
    '<p>What I record for each venue: seating capacity, what piano is there and roughly what condition, who tunes it and whether that is arranged by the hall or by me, the state of the green room, how much rehearsal time is realistically available, whether there is a loading entrance, and where you can park.</p>' +
    '<p>Two more that turned out to matter more than expected. First, how dry or reverberant it is in my own words — not a number, just a note like "very dry, need more bow than feels right". Second, who to contact, because the person who answers the general enquiry address is rarely the person who can unlock a door on a Sunday.</p>' +
    '<p>It lives in a plain spreadsheet. Nothing clever. The value is entirely in having written it down at the time rather than trying to remember eighteen months later.</p>',
  comments: [
    { author: "touringplayer", body: "The contact person note is the one I would underline. The general address is never the right person." },
    { author: "madeone_too", body: "Writing the acoustic in your own words rather than a number is a good idea. Numbers do not help me remember." },
  ],
},

{
  board: 'utility', lang: 'en', category: '악보', author: 'edition_compare',
  title: 'Putting two editions side by side taught me more than a masterclass',
  body:
    '<p>Printed the same movement from two different editions and laid them next to each other. I expected small differences. There were dozens.</p>' +
    '<p>Slurs of different lengths, dynamics in different places, one edition with fingering baked in that the other left alone, an accidental present in one and not the other.</p>' +
    '<p>What this changed is that I stopped treating the page as the composer speaking directly. Somebody made every one of those decisions, often long after the composer died, and I had been obeying them without knowing they were choices.</p>' +
    '<p>How I do it now. Pick the movement, get whichever editions are legitimately available to me, print both single-sided, and mark every difference in a third colour. It takes an evening for a short movement. I have done four pieces this way and it has changed how I read everything else.</p>',
  comments: [
    { author: "urtext_curious", body: "Realising the page contains editorial decisions is one of those things that cannot be unseen." },
    { author: "teaches_this", body: "I do this with students in their third year and it changes how they read for good." },
  ],
},

{
  board: 'utility', lang: 'en', category: '유틸리티', author: 'shortsessions',
  title: 'Splitting practice into short blocks, six months in',
  body:
    '<p>I used to practise in two long stretches. Now I do five or six short ones spread across the day, usually twenty to thirty minutes.</p>' +
    '<p>What improved: retention between days, and the amount of genuinely focused time. In a two-hour block, my honest estimate is that forty minutes were attentive and the rest was hands moving.</p>' +
    '<p>What got worse: anything requiring long continuous stamina. Running a full programme needs to be practised as a full programme, and short blocks do not build that. I now keep one long session a week purely for endurance.</p>' +
    '<p>The practical difficulty is instrument access — this only works if you can get to it repeatedly. For anyone practising away from home it may not be possible at all.</p>' +
    '<p>I would not present this as better. It suited a change in my schedule and turned out to have unexpected advantages.</p>',
  comments: [
    { author: "longblocks", body: "The stamina point is the honest caveat. Short blocks alone will not get you through a recital." },
  ],
},

{
  board: 'utility', lang: 'en', category: '자료', author: 'listening_log',
  title: 'Keeping a listening log, and what I actually write in it',
  body:
    '<p>Started because I kept forgetting recordings I had liked. It has become more useful than that.</p>' +
    '<p>For each thing I hear properly I write four lines. What it was and who played. One sentence about what struck me. One about anything I did not understand. And the date.</p>' +
    '<p>The did-not-understand line is the one that earns its place. Going back a year later, those are the entries that show movement — things that confused me and now do not, or still do, which is its own information.</p>' +
    '<p>I keep it in a plain text file, one entry per paragraph, searchable. I tried more structured systems twice and abandoned both because the friction of filling in fields meant I stopped writing entries at all.</p>',
  comments: [
    { author: "keepsnotes", body: "The did-not-understand line is a good idea. Mine only records what I liked, which ages badly." },
  ],
},

{
  board: 'utility', lang: 'en', category: '악보', author: 'pdf_workflow',
  title: 'How I organise digital scores so I can find them',
  body:
    '<p>I had four hundred files with names like scan_001. Here is the naming scheme that fixed it.</p>' +
    '<p>Composer surname, then work, then movement or number, then edition or source if known. So a file might read Brahms - Sonata No 1 Op 78 - II - urtext. Long filenames, but every one sorts correctly and searches sensibly.</p>' +
    '<p>Folders by composer, not by project or concert. Projects end. Composers do not, and you will look for the piece again in three years without remembering which recital it was for.</p>' +
    '<p>One more habit: when I mark up a score, I keep the clean version and work on a copy named with the year. Two years later I can see what I thought last time without losing what I think now.</p>' +
    '<p>None of this is sophisticated. The whole benefit came from doing it consistently for one afternoon and then not deviating.</p>',
  comments: [
    { author: "fourhundredfiles", body: "Folders by composer rather than project. Obvious once said, and I have been doing the opposite for years." },
    { author: "marksupcopies", body: "Keeping the clean version is the habit I wish I had started with." },
  ],
},

{
  board: 'utility', lang: 'en', category: '유틸리티', author: 'recording_myself',
  title: 'Recording every practice session, and what I learned from hating it',
  body:
    '<p>I record most sessions now. The first month was miserable and I nearly stopped.</p>' +
    '<p>The gap between what I thought I sounded like and what came back was substantial, and specifically in areas I believed were fine. Rhythm mostly. I had been rushing in the same three places for years without hearing it.</p>' +
    '<p>What made it sustainable was a rule: listen back to two minutes, not the whole session. Full playback is demoralising and low information. Two minutes of a passage I was working on is specific and finite.</p>' +
    '<p>Second rule: listen the next day rather than immediately. Straight after playing I hear it through the memory of what I intended. A day later I hear what is there.</p>' +
    '<p>Any phone is adequate for this. It is not a fidelity exercise.</p>',
  comments: [
    { author: "hatesplayback", body: "Two minutes rather than the whole session is what makes it survivable." },
    { author: "nextdaylistening", body: "Listening the next day is the part I had not thought of and it explains why immediate playback felt useless." },
  ],
},

{
  board: 'utility', lang: 'en', category: '자료', author: 'travel_checklist',
  title: 'The list I check before leaving for any performance',
  body:
    '<p>Written after I arrived at a concert two hours away without the second half of my music.</p>' +
    '<p>Instrument and case. Music, including anything the other players might need. Spare strings and whatever tools they require. Rosin. Concert clothes, checked the night before rather than assumed. Shoes, which is the item most commonly left behind. Water. Something to eat that does not need preparation.</p>' +
    '<p>Then the ones learned the hard way. A pencil, because you will be given a change. A stand, if you have any doubt at all about whether one will be there. Cash, for parking machines that do not take cards. And the phone number of somebody at the venue, saved before you leave rather than found on a website while standing outside a locked door.</p>' +
    '<p>It lives as a note on my phone that I read out loud. Reading silently, I skip lines.</p>',
  comments: [
    { author: "forgotshoes", body: "Shoes. Always the shoes." },
  ],
},

{
  board: 'utility', lang: 'en', category: '유틸리티', author: 'humidity_room',
  title: 'How I keep the room stable without spending much',
  body:
    '<p>After a seam opened for the second winter running, I started treating the room rather than the case.</p>' +
    '<p>First, a real hygrometer, not the one that came in the case. Mine read fifteen points off, which meant every decision I had made from it was wrong.</p>' +
    '<p>Then I measured for a fortnight before buying anything, at the same three times each day. It turned out the problem was not the whole winter but the eight weeks when the heating ran constantly.</p>' +
    '<p>What I ended up with is a small humidifier used only in those weeks, and a habit of not putting the instrument near the radiator or an outside wall. That is the entire intervention.</p>' +
    '<p>The thing I would say to anyone starting: measure first. I nearly bought equipment for a problem that was eight weeks long, not five months.</p>',
  comments: [
    { author: "measurefirst", body: "Measuring for two weeks before buying anything is advice I would extend to most instrument problems." },
  ],
},

{
  board: 'utility', lang: 'en', category: '악보', author: 'memorising_method',
  title: 'A memorising method that finally worked for me',
  body:
    '<p>I could never memorise reliably. What I was doing was repeating until my hands knew it, which collapses under pressure because it has no structure to fall back on.</p>' +
    '<p>What works now: I learn the piece away from the instrument first. Sit with the score, no playing, and work out the sections — where each begins, what key it is in, what happens harmonically at the joins.</p>' +
    '<p>Then I practise starting from each section boundary. Not from the beginning. If I can start cleanly from any of eleven points, a memory slip becomes a jump rather than a stop.</p>' +
    '<p>The slowest part is the first stage and it feels like not practising. It is the part that made the difference.</p>',
  comments: [
    { author: "memoryslips", body: "Starting from eleven points rather than the beginning is the whole thing. A slip becomes a jump." },
  ],
},

{
  board: 'utility', lang: 'en', category: '자료', author: 'teaching_records',
  title: 'What I write down after each lesson I teach',
  body:
    '<p>Three lines per student, immediately after they leave. Longer than that and I stop doing it.</p>' +
    '<p>What we worked on. What I asked them to do this week. One thing I noticed but did not say.</p>' +
    '<p>The third line is the useful one. Often something is not ready to be raised — a habit forming, a piece that is wrong for them, something going on outside music. Written down, I can see whether it appears three weeks running, at which point it is real rather than an impression.</p>' +
    '<p>It also solves the problem of forgetting what I assigned. Asking a student what you told them to do last week is a small thing that costs you something.</p>',
},

{
  board: 'utility', lang: 'en', category: '유틸리티', author: 'warmup_short',
  title: 'A ten-minute warm-up for days when there is no time',
  body:
    '<p>The full routine takes forty minutes and on busy days I was skipping it entirely, which is worse than a short one.</p>' +
    '<p>What I kept: two minutes of slow long tones on open strings, listening for evenness rather than doing anything. Three minutes of slow scales in one key, chosen from whatever I am playing that day. Two minutes of shifting between two fixed positions. Three minutes of the hardest passage in whatever I am working on, at half speed.</p>' +
    '<p>What I cut: everything for speed and all the exercises I was doing because I had always done them.</p>' +
    '<p>The last section is the one I would defend. Ending the warm-up inside the actual repertoire means the transition into practice has already happened.</p>',
},

{
  board: 'utility', lang: 'en', category: '유틸리티', author: 'gigfinances',
  title: 'Tracking freelance income in a way that survives tax season',
  body:
    '<p>Nothing sophisticated, just consistent. One row per engagement, entered the day it is agreed rather than the day it is paid.</p>' +
    '<p>Columns: date of performance, who booked it, agreed fee, expenses I will incur, date invoiced, date paid. That last pair is what actually matters — the gap between them tells you which organisations are slow, and after a year you can see it clearly.</p>' +
    '<p>I also log unpaid work separately: teaching prep, travel, rehearsals not covered by the fee. Not to bill anyone, just because the real hourly rate is a different number from the headline fee and it is useful to know it before agreeing to something.</p>' +
    '<p>The habit that makes it work is entering it at the point of agreement. Reconstructing a year from bank statements in March is where the whole thing falls apart.</p>',
},

];

/* ============================================================
   유틸리티 · 일본어 (utility / lang: 'ja')
   ============================================================ */

export const UTILITY_JA = [

{
  board: 'utility', lang: 'ja', category: '유틸리티', author: 'ホール表',
  title: '演奏したホールの情報を、表にして残しています',
  body:
    '<p>同じことを毎回また問い合わせていることに気づいて、書き留めるようにしました。</p>' +
    '<p>記録している項目は、客席数、ピアノの機種と状態、調律を誰がどう手配するのか、控室の様子、実際に取れるリハーサル時間、搬入口の有無、駐車できる場所です。</p>' +
    '<p>思ったより役に立った項目が二つあります。一つは響きの印象を自分の言葉で書いておくこと。数値ではなく「かなり乾いている、弓を多めに使う必要あり」といった書き方です。もう一つは連絡先で、代表の窓口に出る方と、日曜に鍵を開けられる方は別人であることがほとんどです。</p>' +
    '<p>ただの表計算です。凝ったことは何もしていません。価値は全部、その場で書いたという一点にあります。一年半後に思い出そうとしても出てきません。</p>',
  comments: [
    { author: "あちこち弾く", body: "連絡先の項目に同感です。代表窓口の方に聞いても分からないことが多いです。" },
    { author: "表つくった", body: "響きを言葉で書くのは良いですね。数値だと後から思い出せません。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '악보', author: '版くらべ',
  title: '版の違う楽譜を並べて見比べてみました',
  body:
    '<p>同じ楽章を二つの版で印刷して、横に並べました。細かい違いがいくつかあるだろうと思っていたら、数十か所ありました。</p>' +
    '<p>スラーの長さが違う、強弱の位置が違う、片方には運指が印刷されていてもう片方にはない、臨時記号が片方にだけある。</p>' +
    '<p>これで変わったのは、楽譜を「作曲家の言葉そのもの」として読まなくなったことです。あの一つ一つを誰かが決めていて、多くは作曲家の死後です。それを選択だと知らないまま従っていました。</p>' +
    '<p>やり方は単純です。楽章を決め、正規に手に入る版をそろえ、両方を片面で印刷し、違いを三色目の筆記具で印をつけます。短い楽章で一晩ほどです。四曲やりましたが、他の曲の読み方まで変わりました。</p>',
  comments: [
    { author: "原典版とは", body: "楽譜に編集者の判断が入っているというのは、一度気づくと戻れません。" },
    { author: "教えています", body: "三年目の生徒にこれをやらせています。読み方が変わります。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '유틸리티', author: '短く分ける',
  title: '練習を短く分ける方式に変えて半年',
  body:
    '<p>以前は長い時間を二回でした。今は二十分から三十分を一日に五、六回に分けています。</p>' +
    '<p>良くなったのは、日をまたいだときの定着と、本当に集中している時間の量です。二時間続けたうち、正直に言って集中していたのは四十分くらいで、あとは手が動いていただけでした。</p>' +
    '<p>悪くなったのは持久力です。プログラムを通す力は通して練習しないとつきません。今は週に一度だけ、長い回を持久力のために残しています。</p>' +
    '<p>難しいのは楽器に何度も触れる必要があることです。外で練習している方には成り立たないかもしれません。</p>' +
    '<p>優れた方法として勧めるつもりはありません。生活が変わって仕方なく始めたら、思わぬ利点があったという話です。</p>',
  comments: [
    { author: "長時間派", body: "持久力の話は正直な但し書きだと思います。短い回だけでは通せません。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '자료', author: '聴いた記録',
  title: '聴いたものの記録を、四行だけ書いています',
  body:
    '<p>良いと思った録音を忘れてしまうので始めました。今は別の役に立っています。</p>' +
    '<p>きちんと聴いたものについて四行。何を誰の演奏で聴いたか。心に残ったことを一文。分からなかったことを一文。そして日付です。</p>' +
    '<p>役に立つのは三行目です。一年後に読み返すと、そこだけが動きを見せます。分からなかったことが今は分かる、あるいはまだ分からない。どちらも情報です。</p>' +
    '<p>ただのテキストファイルに、一件一段落で書いています。整った仕組みを二度試して二度ともやめました。項目を埋める手間があると、書くこと自体をやめてしまうからです。</p>',
  comments: [
    { author: "記録つけてる", body: "分からなかったことを書く、というのは良いですね。良かったことしか書いていませんでした。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '악보', author: 'ファイル名',
  title: '電子楽譜を、あとで探せるように整理する',
  body:
    '<p>scan_001 のような名前のファイルが四百ありました。直した命名の仕方を書きます。</p>' +
    '<p>作曲家の姓、作品、楽章か番号、分かれば版か出典。たとえば「Brahms - Sonata No 1 Op 78 - II - urtext」。長いですが、並べ替えも検索も正しく効きます。</p>' +
    '<p>フォルダは作曲家ごとにします。公演や企画ごとにすると、企画は終わるのに楽譜は残ります。三年後に探すとき、どの演奏会のものだったかは覚えていません。</p>' +
    '<p>もう一つ。書き込むときは、きれいなものを残して、年をつけた複製のほうに書きます。二年後に、前回考えたことを失わずに今の考えを重ねられます。</p>' +
    '<p>高度なことは何もしていません。一度きちんとやって、そのあと崩さなかった、それだけです。</p>',
  comments: [
    { author: "整理できない", body: "企画ごとではなく作曲家ごと。言われてみればそうなのに、逆をやっていました。" },
    { author: "書き込み派", body: "きれいなものを残しておく習慣、最初からやっておけばよかったです。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '유틸리티', author: '録って聴く',
  title: '練習を毎回録音するようにして、分かったこと',
  body:
    '<p>ほとんどの練習を録音しています。最初の一か月はつらくて、やめかけました。</p>' +
    '<p>自分が思っている音と返ってくる音の差が大きく、しかも問題ないと思っていた場所ほどそうでした。主にリズムです。同じ三か所で何年も走っていたのに、聞こえていませんでした。</p>' +
    '<p>続けられるようになったのは、二分だけ聴き返すと決めてからです。全部聴くのは気が滅入るうえ、情報が少ないです。取り組んでいた箇所の二分なら具体的で、終わりがあります。</p>' +
    '<p>もう一つ、聴くのは翌日にします。直後は「こう弾いたつもり」の記憶を通して聞いてしまいます。一日おくと、あるものが聞こえます。</p>' +
    '<p>携帯で十分です。音質の話ではありません。</p>',
  comments: [
    { author: "聴き返せない", body: "全部ではなく二分、というのが続けられる理由ですね。" },
    { author: "翌日に聴く", body: "翌日というのは思いつきませんでした。直後だと役に立たない理由が分かりました。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '자료', author: '出かける前',
  title: '本番に出る前に読み上げる一覧',
  body:
    '<p>二時間かかる会場に、後半の楽譜を持たずに着いたことがあって作りました。</p>' +
    '<p>楽器とケース。楽譜、共演者の分も含めて。予備の弦と必要な道具。松脂。衣装は前夜に実物を確認します。靴、これがいちばん忘れられます。水。手を加えずに食べられるもの。</p>' +
    '<p>あとは痛い目を見て加えたものです。鉛筆、必ず何か変更が出ます。譜面台、あるかどうか少しでも怪しいなら。現金、カードが使えない駐車場のために。そして会場の担当者の電話番号を、出る前に控えておくこと。閉まった扉の前で調べることになります。</p>' +
    '<p>携帯のメモに置いて、声に出して読みます。黙って読むと飛ばします。</p>',
  comments: [
    { author: "靴を忘れる", body: "靴です。いつも靴です。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '유틸리티', author: '部屋の湿度',
  title: 'お金をかけずに部屋の湿度を安定させる',
  body:
    '<p>二年続けて冬に接ぎ目が開いたので、ケースではなく部屋を扱うことにしました。</p>' +
    '<p>まず、ちゃんとした湿度計を買いました。ケース付属のものは十五ポイントずれていて、それを見て決めたことは全部間違っていたことになります。</p>' +
    '<p>次に、何も買う前に二週間、毎日同じ三つの時刻に測りました。すると問題は冬全体ではなく、暖房を切らさない八週間だけだと分かりました。</p>' +
    '<p>行き着いたのは、その八週間だけ使う小さな加湿器と、楽器を暖房器具と外壁のそばに置かない習慣です。対策はそれで全部です。</p>' +
    '<p>これから始める方に言えるのは、先に測ることです。五か月分の問題だと思って設備を買うところでした。実際は八週間でした。</p>',
  comments: [
    { author: "先に測る", body: "何かを買う前に二週間測る、というのは他の悩みにも当てはまりそうです。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '악보', author: '暗譜のやり方',
  title: 'ようやく身についた暗譜のやり方',
  body:
    '<p>暗譜が苦手でした。やっていたのは、手が覚えるまで繰り返すことです。これは本番で崩れます。戻る場所がないからです。</p>' +
    '<p>今のやり方。まず楽器から離れて覚えます。楽譜を前に、弾かずに、区切りを決めます。どこから始まり、何調で、つなぎ目で和声が何をしているか。</p>' +
    '<p>そのうえで、区切りごとに「そこから弾き始める」練習をします。頭からではありません。十一か所のどこからでも入れるようになると、記憶が飛んでも止まらずに跳べます。</p>' +
    '<p>いちばん時間がかかるのは最初の段階で、練習していない気分になります。効いたのはそこでした。</p>',
  comments: [
    { author: "暗譜が苦手", body: "頭からではなく十一か所から。それだけで飛んでも止まらない、というのは大きいです。" },
  ],
},

{
  board: 'utility', lang: 'ja', category: '자료', author: 'レッスン記録',
  title: 'レッスンのあとに書き留めている三行',
  body:
    '<p>生徒さんが帰ったらすぐ、一人につき三行です。それ以上にすると続きません。</p>' +
    '<p>今日やったこと。今週やってくるよう伝えたこと。気づいたけれど言わなかったこと。</p>' +
    '<p>役に立つのは三行目です。まだ言う時期ではないことがあります。癖ができかけている、曲が合っていない、音楽の外で何かある。書いておくと、三週続けて出てくるかどうかが見えます。三週続けば、印象ではなく事実です。</p>' +
    '<p>宿題を忘れる問題も解決します。先週何を出したかを生徒さんに聞くのは、小さいようで失うものがあります。</p>',
},

{
  board: 'utility', lang: 'ja', category: '유틸리티', author: '十分で',
  title: '時間がない日のための十分の準備運動',
  body:
    '<p>本来の手順は四十分かかるので、忙しい日は丸ごと飛ばしていました。それは短くやるより悪いです。</p>' +
    '<p>残したもの。開放弦の長い音を二分、何かをするのではなく均一さだけを聴きます。その日弾く曲の調でゆっくり音階を三分。決めた二つのポジション間の移動を二分。取り組んでいる曲のいちばん難しい箇所を、半分の速さで三分。</p>' +
    '<p>やめたもの。速さのための練習全部と、昔からやっているからという理由だけで続けていたもの全部です。</p>' +
    '<p>最後の項目は残す価値があると思っています。準備運動を実際の曲の中で終えると、練習への移行がもう済んでいます。</p>',
},

{
  board: 'utility', lang: 'ja', category: '유틸리티', author: '謝礼の記録',
  title: 'フリーランスの収入を、確定申告に耐える形で記録する',
  body:
    '<p>凝ったことはしていません。一件一行、支払われた日ではなく<b>決まった日</b>に書きます。</p>' +
    '<p>項目は、本番の日、依頼元、決まった金額、こちらが負担する経費、請求した日、入金された日。最後の二つが実は大事で、その差を見ると、支払いの遅い相手が一年ではっきり分かります。</p>' +
    '<p>報酬の出ない時間も別に記録しています。準備、移動、謝礼に含まれないリハーサル。誰かに請求するためではなく、実際の時給が提示額とは別の数字だからです。引き受ける前に知っておくと判断が変わります。</p>' +
    '<p>続けるこつは、決まった時点で書くことです。三月に通帳から一年分を組み立てようとすると、そこで全部崩れます。</p>',
},

];
