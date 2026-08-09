#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 공용 CSS 뽑아내기 도구         tools/css-extract.py
════════════════════════════════════════════════════════════════

★ 무엇을 하나
  여러 화면이 <b>글자까지 똑같이</b> 들고 있는 CSS 규칙을 찾아
  공용 파일 하나로 모으고, 각 화면에서는 지웁니다.

★ 반드시 지키는 세 가지 (하나라도 어긋나면 옮기지 않습니다)
  ① 그 묶음의 <b>모든</b> 화면이 갖고 있을 것
     → 일부만 가진 것을 옮겨 모두에게 이으면, 없던 화면이 바뀝니다.
       2026-08-10 에 base.css 는 표 머리를 box-shadow 로, 상세 화면은
       border 로 그리고 있었는데, 상세 것을 전부에 이어 목록 화면이 바뀌었습니다.
  ② 어느 화면에서도 <b>딱 한 번씩만</b> 나올 것
     → 한 화면에 두 번 나오면 뒤엣것이 앞엣것을 덮습니다. 옮기면
       그 차례가 뒤집혀 지는 쪽이 이깁니다. 표 머리 밑줄이 그렇게 바뀌었습니다.
  ③ 내용이 모두 같을 것
     → 이름이 같아도 내용이 다르면 화면마다 달라야 하는 것입니다
       (표 칸 너비 등). 합치면 표가 전부 틀어집니다.

★ 주석을 살립니다
  이 프로젝트는 CSS 주석에 「왜 이렇게 했는지」가 적혀 있어 그 자체가 자산입니다.
  규칙 바로 앞의 주석은 그 규칙에 딸린 것으로 보고 함께 옮깁니다.

★ 쓰는 법
    # 1) 먼저 지금 모습을 찍어 둡니다
    python3 tools/css-snapshot.py before admin

    # 2) 어떤 화면끼리 묶을지 정해 실행합니다
    python3 tools/css-extract.py admin "*.html" assets/admin-common.css

    # 3) 모습이 그대로인지 견줍니다
    python3 tools/css-snapshot.py after admin
    python3 tools/css-snapshot.py compare

★ 인자
    폴더        저장소 안 폴더 이름 (db · admin · community …)
    무늬        묶을 화면 무늬. 여러 개면 쉼표. 보기: "*-view.html,write.html"
    내보낼곳    만들 공용 CSS 자리. 보기: assets/db-view.css

★ 되돌리려면
  git 으로 되돌리는 것이 가장 안전합니다. 이 도구는 원본을 지우지 않지만
  화면을 직접 고치므로, 실행 전 커밋해 두시길 권합니다.
════════════════════════════════════════════════════════════════
"""
import re, sys, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def norm(css):
    return re.sub(r'\s+', ' ', strip_comments(css)).strip()


def split_rules(block):
    """규칙 단위로 자릅니다. 규칙 앞 주석은 그 규칙에 딸려 갑니다.
       돌려주는 것 : (셀렉터, 원문(주석포함), 정규화내용)"""
    out, i, n, pending = [], 0, len(block), ''
    while i < n:
        m = re.match(r'\s*/\*.*?\*/', block[i:], re.S)
        if m:
            pending += m.group(0); i += m.end(); continue
        m = re.match(r'\s*@[\w-]+[^{;]*\{', block[i:])
        if m:
            depth, j = 0, i + m.end() - 1
            while j < n:
                if block[j] == '{': depth += 1
                elif block[j] == '}':
                    depth -= 1
                    if depth == 0: break
                j += 1
            raw = block[i:j+1]
            head = ' '.join(re.match(r'\s*(@[\w-]+[^{]*)\{', raw).group(1).split())
            out.append((head, pending + raw, norm(raw))); pending = ''; i = j + 1; continue
        m = re.match(r'\s*@[\w-]+[^{;]*;', block[i:])
        if m:
            out.append(('@stmt', pending + m.group(0), norm(m.group(0))))
            pending = ''; i += m.end(); continue
        m = re.match(r'\s*([^{}@]+)\{([^{}]*)\}', block[i:])
        if m:
            sel = ' '.join(m.group(1).split())
            out.append((sel, pending + m.group(0), norm(m.group(0))))
            pending = ''; i += m.end(); continue
        pending += block[i]; i += 1
    if pending.strip():
        out.append(('@trailing-comment', pending, '@trailing-comment'))
    return out


def main(folder, patterns, out_rel):
    base = ROOT / folder
    files = []
    for pat in patterns.split(','):
        files += sorted(base.glob(pat.strip()))
    files = sorted(set(files))
    if len(files) < 2:
        print(f'✗ 묶을 화면이 {len(files)}개뿐입니다'); sys.exit(1)

    print(f'묶은 화면 {len(files)}개')
    for f in files:
        sc = sum(len(x) for x in re.findall(r'<style[^>]*>(.*?)</style>',
                 f.read_text(encoding='utf-8'), re.S))
        print(f'  {sc:>8,}자  {f.name}')

    per_file = {}
    occur = collections.defaultdict(lambda: collections.defaultdict(list))
    for p in files:
        rules = []
        for m in re.finditer(r'<style[^>]*>(.*?)</style>',
                             p.read_text(encoding='utf-8'), re.S):
            rules += split_rules(m.group(1))
        per_file[p.name] = rules
        for sel, raw, nm in rules:
            occur[sel][p.name].append(nm)

    movable, sk_all, sk_multi, sk_diff = {}, [], [], []
    for sel, fs in occur.items():
        if sel in ('@stmt', '@trailing-comment'): continue
        if len(fs) != len(files):            sk_all.append(sel);   continue
        if any(len(v) > 1 for v in fs.values()): sk_multi.append(sel); continue
        vals = {v[0] for v in fs.values()}
        if len(vals) != 1:                   sk_diff.append(sel);  continue
        movable[sel] = list(vals)[0]

    print(f'\n옮길 규칙 {len(movable)}종')
    print(f'  건너뜀 — 일부 화면만 {len(sk_all)} · 한 화면에 여러 번 {len(sk_multi)} · 내용 다름 {len(sk_diff)}')
    if not movable:
        print('옮길 것이 없습니다.'); return

    best = {}
    for sel in movable:
        holder = sorted(occur[sel].keys())[0]
        for s2, raw, nm in per_file[holder]:
            if s2 == sel: best[sel] = raw.strip(); break

    plain  = sorted(s for s in movable if not s.startswith('@'))
    medias = sorted(s for s in movable if s.startswith('@'))

    out = ROOT / out_rel
    out.parent.mkdir(parents=True, exist_ok=True)
    head = f'''/* ============================================================
   OPUSCLAM 공용 스타일 — {folder} / {patterns}   (자동 생성)

   화면 {len(files)}개가 <b>글자까지 똑같이</b> 들고 있던 규칙 {len(movable)}종을
   모은 것입니다. tools/css-extract.py 가 만들었습니다.

   ★ 화면에 남은 것도 있습니다 — 일부러입니다
     화면마다 달라야 하는 것, 한 화면에 두 번 넘게 나와 차례가 중요한 것,
     일부 화면만 가진 것은 옮기지 않았습니다.

   ★ 읽히는 차례 : 다른 CSS → 이 파일 → 화면 안 <style>
     그래서 화면에 남은 규칙이 이깁니다. 모습은 그대로입니다.
   ============================================================ */

'''
    txt = head + '/* ── 일반 규칙 ─────────────────────────────── */\n'
    txt += '\n'.join(best[s] for s in plain)
    txt += '\n\n/* ── 화면 폭에 따른 규칙 ───────────────────── */\n'
    txt += '\n'.join(best[s] for s in medias) + '\n'
    out.write_text(txt, encoding='utf-8')
    print(f'  → {out_rel}  ({len(txt):,}자)')

    href = '/' + out_rel + '?v=' + __import__('datetime').date.today().strftime('%Y%m%d')
    link = f'<link rel="stylesheet" href="{href}">'
    print('\n파일                       전 → 후            줄인 양   옮긴 규칙')
    print('─' * 68)
    tb = ta = 0
    for p in files:
        src = p.read_text(encoding='utf-8')
        b = len(src)
        removed = [0]

        def clean(m):
            head_tag = m.group(0)[:m.group(0).index('>') + 1]
            kept = []
            for sel, raw, nm in split_rules(m.group(1)):
                if sel in movable and movable[sel] == nm:
                    removed[0] += 1; continue
                kept.append(raw.rstrip())
            body = '\n'.join(x for x in kept if x.strip())
            return (head_tag + '\n' + body + '\n</style>') if body.strip() else ''

        src = re.sub(r'<style[^>]*>(.*?)</style>', clean, src, flags=re.S)
        if out.name not in src:
            links = list(re.finditer(r'<link[^>]+\.css[^>]*>', src))
            if links:
                at = links[-1].end(); src = src[:at] + '\n' + link + src[at:]
            else:
                at = src.index('<style') if '<style' in src else src.index('</head>')
                src = src[:at] + link + '\n' + src[at:]
        p.write_text(src, encoding='utf-8')
        a = len(src); tb += b; ta += a
        print(f'{p.name:<26} {b:>7,} → {a:>7,}   {b-a:>7,}자   {removed[0]:>3}종')
    print('─' * 68)
    print(f'{"합계":<26} {tb:>7,} → {ta:>7,}   {tb-ta:>7,}자')
    print('\n★ 이제 tools/css-snapshot.py after <폴더> · compare 로 꼭 견주십시오.')


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(0)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
