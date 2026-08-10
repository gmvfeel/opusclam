#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 200행 캡 함정 잡기          tools/check-range-loop.py
════════════════════════════════════════════════════════════════

★ 무엇을 잡는가
  Supabase 는 한 번에 <b>200줄까지만</b> 돌려줍니다.
  그런데 이렇게 적으면 200줄에서 조용히 멈춥니다.

      const STEP = 1000;
      ...
      if (rows.length < STEP) break;      ← 200 < 1000 이라 끝났다고 봅니다
      from += STEP;                       ← 받지도 않은 만큼 건너뜁니다

  화면에 오류가 나지 않습니다. 그냥 <b>앞 200줄만</b> 처리하고
  「다 했다」 고 말합니다. 그래서 눈으로는 알아채기 어렵습니다.

★ 실제로 당했습니다 (2026-08-10)
  일본어 이름 수집기가 인물 15,248명 가운데 <b>200명만</b> 보고 끝났습니다.
  인계 문서에 「Supabase 200행 서버 캡 → .range() 루프 필요」 라고
  적혀 있었는데도 새 파일을 쓰면서 그대로 되풀이했습니다.
  ▶ 사람의 기억에 맡기지 않고 도구가 잡게 합니다.

★ 옳은 꼴
      const PAGE = 200;                   // 서버가 자르는 크기와 같게
      ...
      if (!rows.length) break;
      if (rows.length < PAGE) break;
      from += rows.length;                // 받은 만큼만 앞으로

★ 쓰는 법
    python3 tools/check-range-loop.py
  (문제가 있으면 1 로 끝나므로 워크플로에서도 쓸 수 있습니다)
════════════════════════════════════════════════════════════════
"""
import os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

TARGETS = sorted(glob.glob('scripts/*.mjs')) + sorted(glob.glob('scripts/lib/*.mjs')) \
        + sorted(glob.glob('assets/*.js')) + sorted(glob.glob('seed/*.mjs'))

# Range 헤더나 .range( 를 쓰면서 쪽 크기를 정하는 곳
SIZE = re.compile(r'\b(?:const|let|var)\s+(\w*(?:STEP|PAGE|CHUNK|SIZE|LIMIT)\w*)\s*=\s*(\d+)', re.I)
USES_RANGE = re.compile(r"Range:\s*|\.range\s*\(", re.I)

bad = []
warn = []

for f in TARGETS:
    try:
        s = open(f, encoding='utf-8').read()
    except Exception:
        continue
    if not USES_RANGE.search(s):
        continue

    for m in SIZE.finditer(s):
        name, val = m.group(1), int(m.group(2))

        # ★ SPARQL 의 LIMIT 은 이 함정과 무관합니다 — 위키데이터는 5000도 줍니다.
        #   그 이름이 LIMIT 뒤에만 쓰이면 건너뜁니다.
        if re.search(r'LIMIT \$\{' + re.escape(name) + r'\}', s) and \
           not re.search(r'Range:[^\n]*' + re.escape(name), s):
            continue

        # 그 이름이 Range 헤더를 만드는 데 쓰이는가
        if not re.search(r'Range:[^\n]*' + re.escape(name), s):
            continue
        # 그 이름이 「덜 왔으면 끝」 판정에 쓰이는가
        if not re.search(r'\.length\s*<\s*' + re.escape(name), s):
            continue
        # ★ 앞으로 가는 방식이 「받은 만큼」 이면 안전합니다.
        #   from += batch.length 처럼 적으면 서버가 적게 주어도 자리를 건너뛰지
        #   않으므로, 크기가 커도 실제로는 제대로 돕니다.
        moves_by_len = re.search(r'\+=\s*\w+\.length', s)
        if moves_by_len:
            continue
        if val > 200:
            bad.append((f, name, val,
                        '서버는 200줄만 줍니다 — %d 로 견주면 첫 쪽에서 멈춥니다' % val))
        elif val == 200 and not moves_by_len:
            warn.append((f, name, val,
                         '크기는 맞지만 「받은 만큼」 앞으로 가는지 확인하십시오'))

print('살펴본 파일: %d개 (Range · .range 를 쓰는 것만)' %
      sum(1 for f in TARGETS if USES_RANGE.search(open(f, encoding='utf-8').read())))

if warn:
    print('\n살펴볼 것 %d곳' % len(warn))
    for f, n, v, why in warn:
        print('  · %s — %s = %d : %s' % (f, n, v, why))

if bad:
    print('\n' + '=' * 56)
    print('★ 200행 캡에 걸립니다 — %d곳' % len(bad))
    for f, n, v, why in bad:
        print('  · %s' % f)
        print('      %s = %d  →  %s' % (n, v, why))
    print('  고치는 법: 쪽 크기를 200 으로 두고, from += rows.length 로 앞으로 갑니다.')
    print('=' * 56)
    sys.exit(1)

print('\n200행 캡에 걸리는 곳 없음')
