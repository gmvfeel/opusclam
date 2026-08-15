#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
옛 PWA 코드 걷어내기 — tools/pwa-cleanup.py

무엇을 하나
  1) 화면에 박혀 있던 옛 띠 마크업 제거      (18곳)
  2) 옛 설치 스크립트 제거                    (18곳)
  3) 옛 서비스워커 등록 제거                  (18곳)
     → 셋 다 assets/pwa-install.js 가 대신합니다
  4) pwa-install.js 태그에 판 번호 붙이기     (브라우저 캐시 막기)
  5) 태그가 없는 화면에 한 줄 넣기

왜
  DB 화면 16곳에 옛 코드와 새 엔진이 <b>둘 다</b> 실려 있었습니다.
  옛 코드는 「오늘 닫음」을 보지 않고 무조건 띄웁니다 —
  닫아도 다음 방문에 또 뜨던 원인입니다.

쓰는 법
  python3 tools/pwa-cleanup.py --dry    무엇이 바뀌는지만 봅니다
  python3 tools/pwa-cleanup.py          실제로 고칩니다
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRY = '--dry' in sys.argv
VER = '20260815'

# 새 엔진을 실을 화면 (글쓰기·어드민 화면은 넣지 않습니다 — 방해가 됩니다)
ADD_ENGINE = ['home.html']

# ── 걷어낼 덩어리 세 가지 ────────────────────────────────────
PATTERNS = [
    # 1) 띠 마크업
    (re.compile(
        r'\n?<!-- =+ PWA install banner =+ -->\s*'
        r'<div class="pwa-install" id="pwaInstall".*?</div>\n?',
        re.S), '띠 마크업'),

    # 2) 설치 스크립트
    (re.compile(
        r'\n?/\* PWA install banner \*/\s*'
        r'\(function\(\)\{.*?\n\}\)\(\);\n?',
        re.S), '설치 스크립트'),

    # 3) 서비스워커 등록
    (re.compile(
        r"\n?/\* 서비스워커 등록 \(PWA 설치 가능 조건\) \*/\s*"
        r"if\('serviceWorker' in navigator\)\{.*?\n\}\n?",
        re.S), '서비스워커'),
]

# ── 엔진 태그 ────────────────────────────────────────────────
TAG_RE = re.compile(r'<script src="/assets/pwa-install\.js(?:\?v=[^"]*)?" defer></script>')
NEW_TAG = '<script src="/assets/pwa-install.js?v=%s" defer></script>' % VER

total = {'마크업': 0, '스크립트': 0, '서비스워커': 0, '판번호': 0, '새로넣음': 0}
touched = []

for path in sorted(ROOT.rglob('*.html')):
    if '/node_modules/' in str(path):
        continue
    src = path.read_text(encoding='utf-8')
    out = src
    log = []

    # 1~3) 옛 덩어리 걷어내기
    for pat, label in PATTERNS:
        out, n = pat.subn('\n', out)
        if n:
            log.append('%s %d' % (label, n))
            key = {'띠 마크업': '마크업', '설치 스크립트': '스크립트',
                   '서비스워커': '서비스워커'}[label]
            total[key] += n

    # 4) 판 번호 붙이기
    if TAG_RE.search(out):
        out2 = TAG_RE.sub(NEW_TAG, out)
        if out2 != out:
            out = out2
            log.append('판번호')
            total['판번호'] += 1

    # 5) 태그가 없는 화면에 넣기
    rel = str(path.relative_to(ROOT))
    if rel in ADD_ENGINE and not TAG_RE.search(out):
        if '</body>' in out:
            out = out.replace('</body>', NEW_TAG + '\n</body>', 1)
            log.append('새로넣음')
            total['새로넣음'] += 1

    if out != src:
        touched.append((rel, ', '.join(log)))
        if not DRY:
            path.write_text(out, encoding='utf-8')

print('%s — 고친 화면 %d개' % ('미리보기' if DRY else '적용 완료', len(touched)))
print('-' * 58)
for rel, log in touched:
    print('  %-34s %s' % (rel, log))
print('-' * 58)
for k, v in total.items():
    print('  %-8s %d' % (k, v))
