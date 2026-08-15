#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
맨 아래 큰 광고(C·D)를 partial 로 빼기 — tools/bigban-to-partial.py

무엇을 하나
  화면 42곳에 복붙돼 있던 <section class="bigban"> … </section> 을
  <div id="oc-bigban"></div> 한 줄로 바꿉니다.
  내용은 partials/bigban.html 한 곳에 모으고, assets/include.js 가
  문서를 다 읽은 뒤 그 자리에 채워 넣습니다.

왜
  광고주가 바뀔 때마다 42개 화면을 함께 고쳐야 했습니다.
  한 번은 38곳을 빠뜨려 화면마다 다른 광고가 나왔습니다.
  헤더·푸터가 이미 쓰던 방식으로 맞춥니다.

안전장치
  · 바꾸기 전에 그 화면의 마크업이 <b>표준과 같은지</b> 견줍니다
  · 다른 것이 있으면 무엇이 다른지 알리고 <b>그래도 바꿉니다</b>
    (한 곳으로 모으는 것이 목적이므로, 다른 쪽이 통일됩니다)
  · include.js 가 실려 있지 않은 화면은 건너뜁니다 —
    바꿔 두면 광고가 아예 안 나오기 때문입니다

쓰는 법
  python3 tools/bigban-to-partial.py --dry    무엇이 바뀌는지만
  python3 tools/bigban-to-partial.py          실제로 고침
"""

import re
import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRY = '--dry' in sys.argv

SECTION = re.compile(r'[ \t]*<section class="bigban">.*?</section>\n?', re.S)
SLOT = '<div id="oc-bigban"></div>\n'

# 표준 마크업 — partials/bigban.html 의 section 부분
std_src = (ROOT / 'partials' / 'bigban.html').read_text(encoding='utf-8')
std = SECTION.search(std_src)
if not std:
    print('★ partials/bigban.html 에서 section 을 못 찾았습니다'); sys.exit(1)


def norm(t):
    """견주기 전에 주석과 공백을 지웁니다 — 그 둘의 차이는 뜻이 없습니다"""
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    return re.sub(r'\s+', ' ', t).strip()


std_h = hashlib.md5(norm(std.group(0)).encode()).hexdigest()

done, skipped, differed = [], [], []

for path in sorted(ROOT.rglob('*.html')):
    if path.parts[-2:][0] == 'partials':
        continue
    src = path.read_text(encoding='utf-8')
    m = SECTION.search(src)
    if not m:
        continue

    rel = str(path.relative_to(ROOT))

    # include.js 가 없으면 광고를 채워 넣을 사람이 없습니다
    if 'include.js' not in src:
        skipped.append((rel, 'include.js 없음'))
        continue

    if hashlib.md5(norm(m.group(0)).encode()).hexdigest() != std_h:
        differed.append(rel)

    out = src[:m.start()] + SLOT + src[m.end():]
    done.append(rel)
    if not DRY:
        path.write_text(out, encoding='utf-8')

print('%s — 바꾼 화면 %d개' % ('미리보기' if DRY else '적용 완료', len(done)))

if differed:
    print('\n표준과 달랐던 화면 (한 곳으로 모이면서 통일됩니다)')
    for r in differed:
        print('   ', r)

if skipped:
    print('\n건너뛴 화면')
    for r, why in skipped:
        print('    %-40s %s' % (r, why))
