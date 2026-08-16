/* 문장 꼴 파서 시험 — 위키 문체를 흉내낸 여러 변형으로 확인합니다.
   실제 문서를 받아 보기 전에 <b>짜임이 다른 다섯 꼴</b>을 다 읽는지 봅니다. */
import { readFileSync } from 'fs';

/* concours-probe.mjs 에서 파서만 꺼내 씁니다 (실행부는 돌지 않게) */
const src = readFileSync(new URL('./concours-probe.mjs', import.meta.url), 'utf8');
const cut = src.indexOf('/* ══ 담기');
const mod = src.slice(0, cut)
  + '\nexport { parseProse, parseAll };\n';
const { writeFileSync } = await import('fs');
writeFileSync(new URL('/tmp/_t-parsers.mjs', import.meta.url), mod);
const P = await import('/tmp/_t-parsers.mjs');

const CASES = [
  ['① 표준 — won by … silver and bronze', `
'''The Sixteenth Van Cliburn International Piano Competition''' was held from June 2 to June 18, 2022, in [[Fort Worth, Texas]]. It was won by [[Yunchan Lim]] of [[South Korea]], while [[Anna Geniushene]] and [[Dmytro Choni]] were awarded the silver and bronze medals respectively.

==References==
{{reflist}}
`, { '1': 'Yunchan Lim', '2': 'Anna Geniushene', '3': 'Dmytro Choni' }],

  ['② 목록 꼴 — Gold Medal:', `
The '''Fifteenth Van Cliburn International Piano Competition''' took place in 2017.

==Results==
* Gold Medal: [[Yekwon Sunwoo]] ([[South Korea]])
* Silver Medal: [[Kenneth Broberg]] ([[United States]])
* Bronze Medal: [[Daniel Hsu]] ([[United States]])
`, { '1': 'Yekwon Sunwoo', '2': 'Kenneth Broberg', '3': 'Daniel Hsu' }],

  ['③ awarded to … with … taking the silver', `
The gold medal was awarded to [[Vadym Kholodenko]] of [[Ukraine]], with [[Beatrice Rana]] taking the silver medal and [[Sean Chen]] the bronze medal.
`, { '1': 'Vadym Kholodenko', '2': 'Beatrice Rana', '3': 'Sean Chen' }],

  ['④ 공동 1위 — shared by', `
The '''Thirteenth Van Cliburn International Piano Competition''' was held in 2009. The gold medal was shared by [[Nobuyuki Tsujii]] of Japan and [[Haochen Zhang]] of China. [[Yeol Eum Son]] of South Korea was awarded the silver medal, and [[Evgeni Bozhanov]] the bronze medal.
`, { '1': 'Nobuyuki Tsujii', '2': 'Yeol Eum Son', '3': 'Evgeni Bozhanov' }],

  ['⑤ first prize 낱말 꼴', `
The first prize went to [[Alexander Kobrin]] of [[Russia]]. The second prize was won by [[Joyce Yang]] and the third prize by [[Roberto Plano]].
`, { '1': 'Alexander Kobrin', '2': 'Joyce Yang', '3': 'Roberto Plano' }],

  ['⑥ 딴 대회 이야기 · 심사위원 섞임 (걸러져야 함)', `
The competition was won by [[Radu Lupu]] of [[Romania]]. Lupu had previously won the [[George Enescu]] prize. In 1966 the jury was chaired by [[Lili Kraus]].

==Jury==
* [[Jorge Bolet]]
* [[Lili Kraus]]
`, { '1': 'Radu Lupu' }],

  ['⑦ 이름 앞에 나라가 붙은 목록', `
* Gold Medal – Hong Kong Aristo Sham
* Silver Medal – Israel Russia Vitaly Starikov
* Bronze Medal – USA Evren Ozel
`, { '1': 'Aristo Sham', '2': 'Vitaly Starikov', '3': 'Evren Ozel' }],

  ['⑧ X won the competition (won by 가 아님)', `
[[José Feghali]] won the competition, while [[Philippe Bianconi]] and [[Barry Douglas]] were awarded the silver and bronze medals.
`, { '1': 'José Feghali', '2': 'Philippe Bianconi', '3': 'Barry Douglas' }],

  ['⑨ was the winner', `
[[Jon Nakamatsu]] was the winner. [[Yakov Kasman]] took the silver medal and [[Aviram Reichert]] the bronze medal.
`, { '1': 'Jon Nakamatsu', '2': 'Yakov Kasman', '3': 'Aviram Reichert' }],

  ['⑩ 표 안은 보지 않음 (후원자 이름이 1위가 되던 것)', `
{| class="wikitable"
! Prize !! Winner
|-
| First Prize (Nancy Lee and Perry R. Bass Gold Medal) || China Haochen Zhang
|}
`, {}],

  ['⑪ 상 이름 세로 표 (13회 · 실제 원문)', `{| class="wikitable"
! Award !! Winner(s) !! Benefits
|-
! First Prize (Nancy Lee and Perry R. Bass Gold Medal)
|bgcolor="gold"| {{flagicon|China}} [[Haochen Zhang]]<br />{{flagicon|Japan}} [[Nobuyuki Tsujii]]<br />(tie)
| cash award of [[US $]]20,000 each
|-
! Second Prize (Silver Medal)
|bgcolor="silver"|{{flagicon|South Korea}} [[Yeol Eum Son]]
| cash award of [[US $]]20,000
|-
! Third Prize (Crystal Award)
| not awarded
|-
! [[Steven De Groote]] Memorial Award for the Best Performance(s) of Chamber Music
| {{flagicon|Bulgaria}} [[Evgeni Bozhanov]]<br />and<br />{{flagicon|South Korea}} [[Yeol Eum Son]]
| cash award
|}`, { '1': 'Haochen Zhang', '2': 'Yeol Eum Son' }, true],

  ['⑫ 머리줄이 등수인 가로 표 (15회 · 실제 원문)', `{| class="wikitable"
! Gold Medalist
! Silver Medalist
! Bronze Medalist
! Audience Award
|-
|[[Yekwon Sunwoo]]
|[[Kenneth Broberg]]
|[[Daniel Hsu]]
| [[Rachel Cheung]]
|}`, { '1': 'Yekwon Sunwoo', '2': 'Kenneth Broberg', '3': 'Daniel Hsu' }, true],

  ['⑬ 세 글자 나라 코드 (14회)', `{| class="wikitable"
! Award !! Winner !! Prize money
|-
! Gold Medal
| {{flagicon|UKR}} UKR [[Vadym Kholodenko]] || $50,000
|-
! Silver Medal
| {{flagicon|ITA}} ITA [[Beatrice Rana]] || $30,000
|-
! Crystal Medal
| {{flagicon|USA}} USA [[Sean Chen]] || $20,000
|}`, { '1': 'Vadym Kholodenko', '2': 'Beatrice Rana', '3': 'Sean Chen' }, true],
];

let pass = 0, fail = 0;
for (const [label, wt, want, viaAll] of CASES) {
  /* 표 꼴은 parseAll(문장 먼저 보는 대회) 로 봅니다 — 상표 파서가 함께 돕니다 */
  const got = viaAll ? P.parseAll(wt, { proseFirst: true }).list : P.parseProse(wt);
  const byRank = {};
  got.forEach(p => { if (!byRank[p.rank]) byRank[p.rank] = p.name; });
  const bad = [];
  for (const r of Object.keys(want)) {
    if (byRank[r] !== want[r]) bad.push(`${r}위 기대「${want[r]}」→ 얻음「${byRank[r] || '없음'}」`);
  }
  /* 기대에 없는 등수가 더 나오면 그것도 알립니다 */
  for (const r of Object.keys(byRank)) {
    if (!want[r]) bad.push(`${r}위 군더더기「${byRank[r]}」`);
  }
  if (bad.length) { fail++; console.log(`✗ ${label}`); bad.forEach(b => console.log('    ' + b)); }
  else { pass++; console.log(`✓ ${label}  → ` + Object.keys(byRank).sort().map(r => `${r}:${byRank[r]}`).join(' · ')); }
}
console.log(`\n=== 통과 ${pass} · 실패 ${fail} ===`);
