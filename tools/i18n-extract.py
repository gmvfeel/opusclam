#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 화면 문구 뽑기                tools/i18n-extract.py
════════════════════════════════════════════════════════════════

★ 무엇에 쓰나
  화면 124개에서 <b>번역할 한국어 문구</b>를 뽑아 사전 후보를 만듭니다.

★ 왜 「뽑기」보다 「거르기」가 중요한가
  화면에는 번역하면 <b>안 되는</b> 한국어가 섞여 있습니다.
    · 표 안의 <b>예시 데이터</b>  — 「김서연」·「베토벤 후기 현악4중주의…」
      디자인을 보려고 넣어 둔 가짜 줄입니다. 실제로는 JS 가 지우고
      데이터베이스에서 받은 것으로 다시 그립니다.
    · <b>아바타 첫 글자</b> — 「서울시향」의 「서」, 「롯데콘서트홀」의 「롯」
      글자 하나만 보고는 사람 이름인지 단추인지 알 수 없습니다.
    · 상세 화면의 <b>값</b>(dd) — 「2021년」·「한국음악학회지 제42집」
  이것들이 사전에 들어가면 사전이 더러워지고, 사람 이름을 영어로
  옮기는 어이없는 일이 생깁니다.

★ 그래서 <b>글자가 아니라 자리</b>를 봅니다
  같은 「작곡」 이라도 거르는 상자(select) 안에 있으면 번역하고,
  표 몸통(tbody) 안에 있으면 데이터이므로 건드리지 않습니다.

★ 판단이 애매한 것은 <b>버리지 않고 따로 모읍니다</b>
  자동으로 잘라 내면 무엇이 빠졌는지 아무도 모릅니다.
  tools/i18n-report.html 에 분류별로 담아, 눈으로 훑을 수 있게 합니다.

★ 뽑는 규칙은 assets/i18n.js 와 <b>똑같아야 합니다</b>
  엔진이 「글 조각 전체가 열쇠와 같을 때만」 바꾸므로, 뽑을 때도
  같은 방식으로 여백을 고르고 같은 꼬리표를 건너뜁니다.
  한쪽만 고치면 사전에 있는데도 안 바뀌는 문구가 생깁니다.

★ 쓰는 법
    python3 tools/i18n-extract.py
  결과
    assets/i18n/_todo.json     번역 대기 목록 (사람이 채울 것)
    tools/i18n-report.html     검토 화면 (분류·자리·쓰인 곳)
════════════════════════════════════════════════════════════════
"""
import re, os, sys, glob, json, html, collections

try:
    from bs4 import BeautifulSoup, Comment
except ImportError:
    sys.exit('bs4 가 없습니다:  pip install beautifulsoup4 --break-system-packages')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# ── assets/i18n.js 와 맞춰야 하는 값들 ────────────────────────────
SKIP_TAG = {'script', 'style', 'noscript', 'textarea', 'code', 'pre', 'svg', 'canvas'}
ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'aria-placeholder',
         'data-empty', 'data-label']

KO = re.compile(r'[가-힣ㄱ-ㅎㅏ-ㅣ]')
def norm(s): return re.sub(r'\s+', ' ', str(s)).strip()

# ── 사람이 정해 둔 것 — 무엇보다 먼저 봅니다 ──────────────────────
#   자동 규칙으로는 「서」 가 아바타 첫 글자인지 요일인지 가릴 수 없습니다.
#   한 번 정한 판단을 파일에 남겨 두면, 규칙을 손봐도 그대로 지켜집니다.
def load_manual():
    p = os.path.join('tools', 'i18n-manual.json')
    if not os.path.exists(p):
        return set(), set(), []
    d = json.load(open(p, encoding='utf-8'))
    return (set(d.get('ui') or []), set(d.get('data') or []),
            list(d.get('data_prefix') or []))

MAN_UI, MAN_DATA, MAN_PREFIX = load_manual()

# ── 어느 화면을 볼 것인가 ─────────────────────────────────────────
#   admin 은 뺍니다 — 관리자만 쓰므로 번역하지 않습니다.
#   brand 는 디자인 문서라 뺍니다.
PATTERNS = ['*.html', 'db/*.html', 'account/*.html', 'community/*.html',
            'spot/*.html', 'recruit/*.html', 'shop/*.html', 'lesson/*.html',
            'legal/*.html', 'partials/*.html']

# ── 데이터가 놓이는 자리 (번역 대상 아님) ─────────────────────────
#   ★ 여기에 더할 때는 반드시 <b>실제 화면을 확인</b>하세요.
#     넓게 잡으면 진짜 단추까지 사라집니다.
DATA_CLASS = {
    'ava',            # 아바타 첫 글자 — 「서」·「롯」
    'pv-worklist',    # 상세 화면 딸림 목록 — 「매년」·「정기」
    'pv-li-main',     # 목록 줄의 <b>내용</b> — 논문 제목·차례
    'pv-person', 'pf',
}
# ★ 목록 줄을 통째로 데이터로 보면 안 됩니다.
#   .pv-lirow 안에는 내용(.pv-li-main)과 <b>단추</b>(.pv-li-act)가 함께 있습니다.
#   처음에 .pv-lirow·.pv-list 를 통째로 넣었다가 「보기 →」·「안내 →」·
#   「재생 →」 같은 <b>단추 글자 36개가 통째로 빠졌습니다.</b>
#   → 안쪽에서 데이터가 놓이는 자리만 콕 집습니다.
DATA_ANCESTOR_TAG = {'tbody'}          # 표 몸통 = 예시 줄
DATA_SELF_TAG = {'dd'}                 # 이름(dt)은 번역, 값(dd)은 데이터

# 표 몸통 안이어도 이것은 화면 문구입니다
TBODY_UI = re.compile(r'^(불러오는 중|검색 결과가? 없|결과가 없|자료가 없|등록된 .{0,12}없)')

# ── 상세 화면의 본문·요약 = 데이터베이스에서 받아 채우는 자리 ──────
#   「1723년부터 세상을 떠날 때까지 라이프치히 성토마스교회의…」 같은
#   바흐 소개문이 화면 파일에 박혀 있습니다. 디자인을 보려고 넣어 둔
#   것이고, 실제로는 DB·위키백과에서 받은 것으로 바뀝니다.
DATA_PROSE = {'pv-prose', 'pv-lead'}

# ── 붙박이 안내문 — 위 규칙에 걸려도 <b>번역해야 합니다</b> ─────────
UI_PROSE = {'pdb-lead', 'pv-source-t', 'why-desc', 'h-lead', 'sub', 'warn', 'mp-note'}

# ── 긴 글이 예시일 가능성이 높은 화면 ─────────────────────────────
#   상세 화면과 홈은 「보기 좋으라고」 넣은 글이 많습니다.
#   자동으로 자르지 않고 <b>살펴볼 것</b>으로 돌려 사람이 정하게 합니다.
SAMPLE_HEAVY = re.compile(r'(-view\.html$|^home\.html$)')
LONG = 40


def ancestors(node, limit=12):
    out, e = [], node.parent
    while e is not None and getattr(e, 'name', None) and len(out) < limit:
        out.append(e)
        e = e.parent
    return out


def classify(node, text, fname=''):
    """이 문구가 무엇인지 — ui / data / check 중 하나와 까닭"""
    anc = ancestors(node)
    names = [e.name.lower() for e in anc]
    classes = set()
    for e in anc:
        for c in (e.get('class') or []):
            classes.add(c)

    # ★ 사람이 정한 것이 가장 앞섭니다
    if text in MAN_UI:
        return 'ui', '사람이 정함'
    if text in MAN_DATA:
        return 'data', '사람이 정함'
    for pre in MAN_PREFIX:
        if text.startswith(pre):
            return 'data', '사람이 정함(예시 글)'

    # ⓪ 붙박이 안내문은 무슨 일이 있어도 번역 대상입니다
    if classes & UI_PROSE:
        return 'ui', '붙박이 안내문'

    # ⓪-2 상세 화면 본문·요약 = DB 에서 채우는 자리
    if classes & DATA_PROSE:
        return 'data', '상세 화면 본문(DB 로 채움)'

    # ⓪-3 상세 화면의 문서 제목도 JS 가 바꿉니다
    if 'title' in names and fname.endswith('-view.html'):
        return 'data', '상세 화면 제목(JS 가 바꿈)'

    # ① 표 몸통 = 예시 줄
    if set(names) & DATA_ANCESTOR_TAG:
        if not TBODY_UI.match(text):
            return 'data', '표 몸통(예시 줄)'

    # ② 아바타·목록 등 데이터 자리
    hit = classes & DATA_CLASS
    if hit:
        return 'data', '데이터 자리(.' + sorted(hit)[0] + ')'

    # ③ 상세 화면의 값
    if names and names[0] in DATA_SELF_TAG:
        return 'data', '상세 화면의 값(dd)'

    # ④ 한 글자 — 사람이 봐야 합니다 (단위인지 이니셜인지 조각인지)
    if len(text) <= 1:
        return 'check', '한 글자'

    # ⑤ 숫자·기호에 붙은 짧은 조각 (「개」·「건」·「명」)
    if len(text) <= 2 and names and names[0] in ('i', 'em', 'small', 'sup'):
        return 'check', '숫자 뒤 단위로 보임'

    # ⑥ 상세·홈의 긴 글 — 예시일 수 있으니 사람이 봅니다
    if len(text) >= LONG and SAMPLE_HEAVY.search(os.path.basename(fname)):
        return 'check', '상세·홈의 긴 글(예시일 수 있음)'

    # ⑦ 문단 속 짧은 조각 — 「다만」·「대신」처럼 문장이 쪼개진 것
    #    (<b>A</b> 다만 <b>B</b> 처럼 태그 사이에 낀 글자)
    if len(text) <= 3 and names and names[0] in ('p', 'li', 'div', 'span') \
       and node.previous_sibling is not None and node.next_sibling is not None:
        return 'check', '문장 속 조각으로 보임'

    return 'ui', '화면 문구'


def collect():
    files = []
    for p in PATTERNS:
        files += sorted(glob.glob(p))
    files = [f for f in files if not f.startswith('brand')]

    rows = collections.OrderedDict()   # 원문 → 정보
    for f in files:
        try:
            soup = BeautifulSoup(open(f, encoding='utf-8').read(), 'html.parser')
        except Exception as e:
            print(' 읽기 실패:', f, e); continue

        found = []

        for n in soup.find_all(string=True):
            if isinstance(n, Comment):
                continue
            p = n.parent
            if p and p.name and p.name.lower() in SKIP_TAG:
                continue
            t = norm(n)
            if not t or not KO.search(t):
                continue
            kind, why = classify(n, t, f)
            where = (p.name if p else '?') + ''.join('.' + c for c in (p.get('class') or [])[:2]) if p else '?'
            found.append((t, kind, why, where))

        for el in soup.find_all(True):
            if el.name.lower() in SKIP_TAG:
                continue
            for a in ATTRS:
                v = el.get(a)
                if not v:
                    continue
                t = norm(v)
                if not t or not KO.search(t):
                    continue
                found.append((t, 'ui', '속성 ' + a, el.name + '[' + a + ']'))
            if el.name.lower() == 'input' and (el.get('type') or '').lower() in ('button', 'submit', 'reset'):
                v = el.get('value')
                if v and KO.search(str(v)):
                    found.append((norm(v), 'ui', '단추 글자', 'input[value]'))

        for t, kind, why, where in found:
            r = rows.setdefault(t, {'kind': kind, 'why': why, 'files': set(),
                                    'where': collections.Counter(), 'n': 0})
            r['files'].add(f)
            r['where'][where] += 1
            r['n'] += 1
            # 한 곳이라도 화면 문구로 쓰이면 번역 대상입니다
            #   (같은 낱말이 표 안에도 있고 거르는 상자에도 있을 수 있습니다)
            if kind == 'ui' and r['kind'] != 'ui':
                r['kind'], r['why'] = 'ui', why
            elif kind == 'check' and r['kind'] == 'data':
                r['kind'], r['why'] = 'check', why
    return rows


def main():
    rows = collect()
    ui    = {t: r for t, r in rows.items() if r['kind'] == 'ui'}
    check = {t: r for t, r in rows.items() if r['kind'] == 'check'}
    data  = {t: r for t, r in rows.items() if r['kind'] == 'data'}

    print(f'모두 {len(rows)}개')
    print(f'  번역 대상   {len(ui)}개')
    print(f'  살펴볼 것   {len(check)}개')
    print(f'  데이터(뺌)  {len(data)}개')

    # ── 번역 대기 목록 ────────────────────────────────────────────
    have = set()
    for lang in ('en', 'ja'):
        p = f'assets/i18n/{lang}.json'
        if os.path.exists(p):
            d = json.load(open(p, encoding='utf-8'))
            have |= {k for k in d if not k.startswith('_')}
    todo = [t for t in ui if t not in have]

    out = collections.OrderedDict()
    out['_note'] = '화면에서 뽑은 번역 대기 목록입니다. tools/i18n-extract.py 가 만듭니다.'
    out['_note2'] = '이미 en.json·ja.json 에 있는 것은 빠져 있습니다.'
    out['_count'] = len(todo)
    for t in sorted(todo, key=lambda x: (-rows[x]['n'], x)):
        out[t] = ''
    json.dump(out, open('assets/i18n/_todo.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'\n  → assets/i18n/_todo.json  ({len(todo)}개, 이미 옮긴 {len(ui)-len(todo)}개 뺌)')

    report(ui, check, data, rows)
    print('  → tools/i18n-report.html  (눈으로 훑어볼 화면)')


def report(ui, check, data, rows):
    def esc(s): return html.escape(str(s))

    def table(d, title, note, cls):
        if not d:
            return f'<h2>{esc(title)} <em>0</em></h2><p class=note>{esc(note)}</p>'
        items = sorted(d.items(), key=lambda kv: (-kv[1]['n'], kv[0]))
        out = [f'<h2 class="{cls}">{esc(title)} <em>{len(d)}개</em></h2>',
               f'<p class=note>{esc(note)}</p>',
               '<table><thead><tr><th class=c1>한국어 원문</th><th class=c2>쓰인 횟수</th>'
               '<th class=c3>놓인 자리</th><th class=c4>화면</th></tr></thead><tbody>']
        for t, r in items:
            where = ', '.join(f'{w}' for w, _ in r['where'].most_common(2))
            files = sorted(r['files'])
            fs = ', '.join(os.path.basename(f) for f in files[:3])
            if len(files) > 3:
                fs += f' 외 {len(files)-3}'
            out.append(f'<tr><td class=ko>{esc(t)}</td><td class=num>{r["n"]}</td>'
                       f'<td class=sm>{esc(where)}</td><td class=sm>{esc(fs)}</td></tr>')
        out.append('</tbody></table>')
        return '\n'.join(out)

    doc = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="robots" content="noindex">
<title>i18n 문구 검토 · OPUSCLAM</title>
<style>
 *{{box-sizing:border-box}}
 body{{margin:0;padding:28px 22px 80px;background:#f7f5f1;color:#23243a;
   font:14px/1.6 "Pretendard",-apple-system,system-ui,sans-serif}}
 .wrap{{max-width:1180px;margin:0 auto}}
 h1{{font-size:21px;margin:0 0 6px}}
 .sum{{color:#6b6c85;font-size:13px;margin-bottom:22px}}
 .sum b{{color:#23243a}}
 h2{{font-size:16px;margin:34px 0 4px;padding-left:10px;border-left:4px solid #7C63B0}}
 h2.d{{border-left-color:#c9a94e}} h2.x{{border-left-color:#b9bac7}}
 h2 em{{font-style:normal;font-size:12.5px;color:#7C63B0;margin-left:6px}}
 .note{{margin:0 0 12px;color:#6b6c85;font-size:12.5px}}
 table{{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e6e1d7;
   border-radius:8px;overflow:hidden}}
 th,td{{padding:7px 10px;border-bottom:1px solid #f0ece4;text-align:left;vertical-align:top}}
 th{{background:#faf8f4;font-size:12px;color:#6b6c85;font-weight:600;position:sticky;top:0}}
 tr:last-child td{{border-bottom:0}}
 .c1{{width:46%}} .c2{{width:8%}} .c3{{width:22%}} .c4{{width:24%}}
 .ko{{font-weight:500;word-break:keep-all}}
 .num{{color:#7C63B0;font-variant-numeric:tabular-nums}}
 .sm{{font-size:11.5px;color:#8b8ca0;word-break:break-all}}
</style></head><body><div class=wrap>
<h1>화면 문구 검토</h1>
<p class=sum>모두 <b>{len(rows)}</b>개 —
 번역 대상 <b>{len(ui)}</b> · 살펴볼 것 <b>{len(check)}</b> · 데이터라 뺀 것 <b>{len(data)}</b><br>
 tools/i18n-extract.py 가 만듭니다. 규칙을 고치면 그 파일 위쪽 목록을 손보세요.</p>
{table(check, '② 살펴볼 것', '한 글자이거나 숫자 뒤 단위로 보이는 것입니다. 번역할지 사람이 정해야 합니다.', 'd')}
{table(ui, '① 번역 대상', '거르는 상자·단추·이름표 등 화면에 붙박이로 있는 문구입니다.', '')}
{table(data, '③ 데이터라 뺀 것', '표 안 예시 줄·아바타 첫 글자·상세 화면의 값입니다. 실제로는 데이터베이스에서 받은 것으로 바뀌므로 번역하지 않습니다.', 'x')}
</div></body></html>"""
    open('tools/i18n-report.html', 'w', encoding='utf-8').write(doc)


if __name__ == '__main__':
    main()
