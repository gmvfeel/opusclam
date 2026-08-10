#!/usr/bin/env python3
"""
════════════════════════════════════════════════════════════════
 OPUSCLAM · 화면 제목 자동 만들기         tools/i18n-titles.py
════════════════════════════════════════════════════════════════

★ 무엇에 쓰나
  「핫토픽 · OPUSCLAM」 「인물DB · OPUSCLAM.COM Database」 처럼
  <title> 에 쓰이는 제목을 <b>사전으로 조합해</b> 만듭니다.

★ 왜 손으로 적지 않나
  제목은 여든 개 가까이 되는데, 모두 <b>「무엇 · 꼬리말」</b> 꼴입니다.
  머리말(핫토픽·인물DB…)은 이미 사전에 들어 있으니, 손으로 또 적으면
  ① 같은 말을 두 번 옮기게 되고
  ② 나중에 「핫토픽」 의 번역을 고쳤을 때 <b>제목만 옛말로 남습니다.</b>
  조합해 두면 사전 한 곳만 고쳐도 제목이 함께 따라옵니다.

★ 꼬리말은 옮기지 않습니다
  OPUSCLAM · OPUSCLAM.COM 은 상표이고, Database 는 이미 영어입니다.

★ 머리말이 사전에 없으면 <b>건너뛰고 알립니다</b>
  조용히 반쪽짜리 제목을 만들면 영어 화면에 한국어가 남습니다.
  못 만든 것은 화면에 찍어 주니, 그 말을 먼저 사전에 넣으십시오.

★ 쓰는 법
    python3 tools/i18n-titles.py            살펴만 봅니다
    python3 tools/i18n-titles.py --apply    _batch9.○○.json 으로 씁니다
  그다음 tools/i18n-merge.py --apply 로 본 사전에 합칩니다.
════════════════════════════════════════════════════════════════
"""
import os, re, sys, json, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
APPLY = '--apply' in sys.argv

KO = re.compile(r'[가-힣]')
SEP = ' · '


def clean(d):
    return {k: v for k, v in d.items() if not k.startswith('_')}


def main():
    en = clean(json.load(open('assets/i18n/en.json', encoding='utf-8')))
    ja = clean(json.load(open('assets/i18n/ja.json', encoding='utf-8')))

    # 화면에서 뽑아 둔 대기 목록에서 제목만 고른다
    todo_path = 'assets/i18n/_todo.json'
    if not os.path.exists(todo_path):
        sys.exit('assets/i18n/_todo.json 이 없습니다 — 먼저 tools/i18n-extract.py 를 돌리세요')
    todo = [k for k in json.load(open(todo_path, encoding='utf-8')) if not k.startswith('_')]

    oe, oj, miss = collections.OrderedDict(), collections.OrderedDict(), []

    for t in todo:
        if ' · OPUSCLAM' not in t:
            continue
        head, tail = t.split(' · OPUSCLAM', 1)
        tail = 'OPUSCLAM' + tail          # 꼬리말은 그대로 둡니다

        # ★ 머리말 <b>전체</b>를 먼저 찾습니다 (2026-08-10)
        #   「DB 등록 · 보강」 처럼 가운뎃점이 든 말이 사전에 통째로
        #   들어 있는 일이 있습니다. 무턱대고 쪼개면 「DB 등록」 과
        #   「보강」 을 따로 찾다가 <b>못 찾고 건너뜁니다.</b>
        if head in en and head in ja:
            oe[t] = en[head] + SEP + tail
            oj[t] = ja[head] + SEP + tail
            continue

        # 통째로 없으면 「A · B」 로 나뉜 것으로 보고 토막마다 찾습니다
        parts = [p.strip() for p in head.split(SEP)]
        pe, pj, ok = [], [], True
        for p in parts:
            if p in en and p in ja:
                pe.append(en[p]); pj.append(ja[p])
            elif not KO.search(p):
                pe.append(p); pj.append(p)   # 이미 영어면 그대로
            else:
                ok = False; break
        if not ok:
            miss.append(t); continue
        oe[t] = SEP.join(pe) + SEP + tail
        oj[t] = SEP.join(pj) + SEP + tail

    print(f'  조합한 제목  {len(oe)}개')
    print(f'  못 만든 것   {len(miss)}개')
    for m in miss:
        print('    ·', m)
    if miss:
        print('    ↑ 머리말이 사전에 없습니다. 먼저 그 말을 사전에 넣으십시오.')

    if not APPLY:
        print('\n  보기 다섯')
        for k in list(oe)[:5]:
            print(f'    {k}\n       → {oe[k]}\n       → {oj[k]}')
        print('\n  실제로 쓰려면:  python3 tools/i18n-titles.py --apply')
        return

    for lang, d in (('en', oe), ('ja', oj)):
        out = collections.OrderedDict()
        out['_batch'] = '9차 · 화면 제목 (tools/i18n-titles.py 가 사전으로 조합)'
        out['_note'] = '손으로 고치지 마세요 — 머리말 사전을 고치고 이 도구를 다시 돌리십시오.'
        for k in sorted(d):
            out[k] = d[k]
        p = f'assets/i18n/_batch9.{lang}.json'
        json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'  → {p}  {len(d)}개')
    print('\n  이어서:  python3 tools/i18n-merge.py --apply')


if __name__ == '__main__':
    main()
