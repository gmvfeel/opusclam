#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 번역 조각 합치기                tools/i18n-merge.py
════════════════════════════════════════════════════════════════

★ 무엇에 쓰나
  assets/i18n/_batch*.en.json · _batch*.ja.json 을
  본 사전 en.json · ja.json 에 합칩니다.

★ 왜 조각으로 나누어 두나
  문구가 이천 개가 넘습니다. 한 파일에 다 넣으면 어디까지 했는지
  알 수 없고, 고칠 때마다 큰 파일을 통째로 다시 써야 합니다.
  갈래별로 조각을 만들어 두면 <b>무엇이 남았는지</b> 한눈에 보이고,
  잘못된 것을 고칠 때도 그 조각만 손보면 됩니다.

★ 합치기 전에 반드시 봅니다
  ① 영어·일본어 <b>열쇠가 서로 같은가</b>
     한쪽에만 있으면 그 말에서만 한국어가 남습니다.
  ② 이미 있는 것을 <b>다른 말로</b> 덮어쓰려 하는가
     같은 문구가 두 조각에 서로 다르게 적히면 나중 것이 이깁니다.
     조용히 덮어쓰지 않고 <b>멈춰서 알립니다.</b>
  ③ 빈 값 · 한국어가 그대로 남은 것
  ④ 열쇠에 여백이 접혀 있는가 (엔진과 같은 규칙)

★ 쓰는 법
    python3 tools/i18n-merge.py            살펴만 봅니다(합치지 않음)
    python3 tools/i18n-merge.py --apply    실제로 합칩니다
════════════════════════════════════════════════════════════════
"""
import os, re, sys, json, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

LANGS = ('en', 'ja')
KO = re.compile(r'[가-힣]')
def norm(s): return re.sub(r'\s+', ' ', str(s)).strip()

APPLY = '--apply' in sys.argv


def load(path):
    if not os.path.exists(path):
        return {}
    return json.load(open(path, encoding='utf-8'))


def clean(d):
    return {k: v for k, v in d.items() if not k.startswith('_')}


def main():
    bad = []

    # ── 조각 모으기 ────────────────────────────────────────────────
    parts = collections.defaultdict(dict)      # lang → {열쇠: 뜻}
    origin = collections.defaultdict(dict)     # lang → {열쇠: 어느 조각}
    files = sorted(glob.glob('assets/i18n/_batch*.json'))
    if not files:
        sys.exit('합칠 조각이 없습니다 (assets/i18n/_batch*.json)')

    for f in files:
        m = re.search(r'\.(en|ja)\.json$', f)
        if not m:
            bad.append(f'{f} — 이름이 _batch○○.en.json 꼴이 아닙니다')
            continue
        lang = m.group(1)
        d = clean(load(f))
        for k, v in d.items():
            nk = norm(k)
            if nk != k:
                bad.append(f'{os.path.basename(f)} — 열쇠에 여백이 접혀 있지 않습니다: {k!r}')
            if k in parts[lang] and parts[lang][k] != v:
                bad.append(f'{os.path.basename(f)} — {k!r} 이 {origin[lang][k]} 에 다르게 적혀 있습니다\n'
                           f'        여기: {v!r}\n        저기: {parts[lang][k]!r}')
            parts[lang][k] = v
            origin[lang][k] = os.path.basename(f)
        print(f'  조각 {os.path.basename(f):26} {len(d):4}개')

    # ── ① 두 말의 열쇠가 같은가 ───────────────────────────────────
    ke, kj = set(parts['en']), set(parts['ja'])
    if ke - kj:
        bad.append(f'일본어에 빠진 열쇠 {len(ke-kj)}개: {sorted(ke-kj)[:6]}')
    if kj - ke:
        bad.append(f'영어에 빠진 열쇠 {len(kj-ke)}개: {sorted(kj-ke)[:6]}')

    # ── ② 값이 비었거나 한국어가 그대로인가 ────────────────────────
    for lang in LANGS:
        for k, v in parts[lang].items():
            if not str(v).strip():
                bad.append(f'{lang}: {k!r} 의 뜻이 비어 있습니다')
            elif KO.search(str(v)) and lang == 'en':
                bad.append(f'en: {k!r} → {v!r} 에 한국어가 남아 있습니다')

    # ── ③ 이미 있는 것과 어긋나는가 ───────────────────────────────
    for lang in LANGS:
        cur = clean(load(f'assets/i18n/{lang}.json'))
        for k, v in parts[lang].items():
            if k in cur and cur[k] != v:
                bad.append(f'{lang}: {k!r} 이 이미 {cur[k]!r} 로 있는데 {v!r} 로 바꾸려 합니다')

    if bad:
        print('\n' + '=' * 56)
        print('★ 합치지 않았습니다 — 아래를 먼저 손보세요')
        for b in bad:
            print('  ·', b)
        print('=' * 56)
        sys.exit(1)

    print(f'\n  살펴본 결과 어긋난 곳 없음 (영어 {len(ke)} · 일본어 {len(kj)})')

    if not APPLY:
        print('\n  실제로 합치려면:  python3 tools/i18n-merge.py --apply')
        return

    # ── 합치기 ────────────────────────────────────────────────────
    for lang in LANGS:
        p = f'assets/i18n/{lang}.json'
        cur = load(p)
        meta = {k: v for k, v in cur.items() if k.startswith('_')}
        body = clean(cur)
        before = len(body)
        body.update(parts[lang])
        meta['_updated'] = __import__('datetime').date.today().isoformat()
        meta['_count'] = len(body)
        out = collections.OrderedDict()
        for k in ['_lang', '_updated', '_count']:
            if k in meta: out[k] = meta[k]
        for k, v in meta.items():
            if k not in out: out[k] = v
        for k in sorted(body):
            out[k] = body[k]
        json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'  {p}  {before} → {len(body)}개')

    print('\n  ★ assets/i18n.js 의 판(V)을 올리는 것을 잊지 마세요 —')
    print('    올리지 않으면 브라우저가 옛 사전을 그대로 씁니다.')


if __name__ == '__main__':
    main()
