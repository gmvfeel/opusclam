-- ============================================================
--  학교DB 로고 연결 (전체 39개)
--  · 파트너님이 보내주신 로고 30개 + 예전 시안에서 추출한 9개
--  · 파일은 assets/logos/ 폴더에 있습니다
--  · 요강 리스트·요강 상세·학교DB 리스트에 모두 반영됩니다
--  1번으로 매칭 확인 → 2번 실행 → 3번 결과 확인
-- ============================================================

-- ── 1) 매칭 미리보기 (읽기 전용) ──
with m(pat, url, label) as (values
  -- 새로 받은 로고 30개
  ('한세대학교%',       '/assets/logos/hansei.png',        '한세대학교'),
  ('서울예술고등학교%',   '/assets/logos/seoul-arts.png',    '서울예술고등학교'),
  ('덕원예술고등학교%',   '/assets/logos/dukwon-arts.png',   '덕원예술고등학교'),
  ('중앙대학교%',       '/assets/logos/chungang.png',      '중앙대학교'),
  ('한양대학교%',       '/assets/logos/hanyang.png',       '한양대학교'),
  ('경성대학교%',       '/assets/logos/kyungsung.png',     '경성대학교'),
  ('계명대학교%',       '/assets/logos/keimyung.png',      '계명대학교'),
  ('숙명여자대학교%',    '/assets/logos/sookmyung.png',     '숙명여자대학교'),
  ('추계예술대학교%',    '/assets/logos/chugye.png',        '추계예술대학교'),
  ('선화예술고등학교%',   '/assets/logos/sunhwa-arts.png',   '선화예술고등학교'),
  ('상명대학교%',       '/assets/logos/sangmyung.png',     '상명대학교'),
  ('세종대학교%',       '/assets/logos/sejong.png',        '세종대학교'),
  ('동아대학교%',       '/assets/logos/donga.png',         '동아대학교'),
  ('한국예술종합학교%',   '/assets/logos/karts.png',         '한국예술종합학교'),
  ('가천대학교%',       '/assets/logos/gachon.png',        '가천대학교'),
  ('전북대학교%',       '/assets/logos/jbnu.png',          '전북대학교'),
  ('경북대학교%',       '/assets/logos/kyungpook.png',     '경북대학교'),
  ('영남대학교%',       '/assets/logos/yeungnam.png',      '영남대학교'),
  ('안양예술고등학교%',   '/assets/logos/anyang-arts.png',   '안양예술고등학교'),
  ('충남대학교%',       '/assets/logos/cnu.png',           '충남대학교'),
  ('부산예술고등학교%',   '/assets/logos/busan-arts.png',    '부산예술고등학교'),
  ('서울대학교%',       '/assets/logos/snu.png',           '서울대학교'),
  ('전남대학교%',       '/assets/logos/jnu.png',           '전남대학교'),
  ('연세대학교%',       '/assets/logos/yonsei.png',        '연세대학교'),
  ('경희대학교%',       '/assets/logos/khu.png',           '경희대학교'),
  ('수원대학교%',       '/assets/logos/suwon.png',         '수원대학교'),
  ('부산대학교%',       '/assets/logos/pnu.png',           '부산대학교'),
  ('강원대학교%',       '/assets/logos/kangwon.png',       '강원대학교'),
  ('계원예술고등학교%',   '/assets/logos/kaywon-arts.png',   '계원예술고등학교'),
  ('이화여자대학교%',    '/assets/logos/ewha.png',          '이화여자대학교'),
  -- 예전 시안에서 추출한 9개 (새 파일에 없는 학교)
  ('성신여자대학교%',    '/assets/logos/sungshin.png',      '성신여자대학교'),
  ('단국대학교%',       '/assets/logos/dankook.png',       '단국대학교'),
  ('국민대학교%',       '/assets/logos/kookmin.png',       '국민대학교'),
  ('목원대학교%',       '/assets/logos/mokwon.png',        '목원대학교'),
  ('고양예술고등학교%',   '/assets/logos/goyang-arts.png',   '고양예술고등학교'),
  ('인천예술고등학교%',   '/assets/logos/incheon-arts.png',  '인천예술고등학교'),
  ('서울여자대학교%',    '/assets/logos/swu.png',           '서울여자대학교'),
  ('덕성여자대학교%',    '/assets/logos/duksung.png',       '덕성여자대학교'),
  ('강남대학교%',       '/assets/logos/kangnam.png',       '강남대학교')
)
select m.label as 로고, s.id, s.name_ko as 학교DB이름,
       case when s.id in (select distinct school_id from public.admission where school_id is not null)
            then '요강있음' else '-' end as 요강,
       m.url as 넣을값
from m
left join public.schools s on s.name_ko like m.pat and s.hidden = false
order by (s.id is null), m.label;


-- ── 2) 실행 ──
update public.schools s
set logo_url = m.url
from (values
  ('한세대학교%','/assets/logos/hansei.png'),
  ('서울예술고등학교%','/assets/logos/seoul-arts.png'),
  ('덕원예술고등학교%','/assets/logos/dukwon-arts.png'),
  ('중앙대학교%','/assets/logos/chungang.png'),
  ('한양대학교%','/assets/logos/hanyang.png'),
  ('경성대학교%','/assets/logos/kyungsung.png'),
  ('계명대학교%','/assets/logos/keimyung.png'),
  ('숙명여자대학교%','/assets/logos/sookmyung.png'),
  ('추계예술대학교%','/assets/logos/chugye.png'),
  ('선화예술고등학교%','/assets/logos/sunhwa-arts.png'),
  ('상명대학교%','/assets/logos/sangmyung.png'),
  ('세종대학교%','/assets/logos/sejong.png'),
  ('동아대학교%','/assets/logos/donga.png'),
  ('한국예술종합학교%','/assets/logos/karts.png'),
  ('가천대학교%','/assets/logos/gachon.png'),
  ('전북대학교%','/assets/logos/jbnu.png'),
  ('경북대학교%','/assets/logos/kyungpook.png'),
  ('영남대학교%','/assets/logos/yeungnam.png'),
  ('안양예술고등학교%','/assets/logos/anyang-arts.png'),
  ('충남대학교%','/assets/logos/cnu.png'),
  ('부산예술고등학교%','/assets/logos/busan-arts.png'),
  ('서울대학교%','/assets/logos/snu.png'),
  ('전남대학교%','/assets/logos/jnu.png'),
  ('연세대학교%','/assets/logos/yonsei.png'),
  ('경희대학교%','/assets/logos/khu.png'),
  ('수원대학교%','/assets/logos/suwon.png'),
  ('부산대학교%','/assets/logos/pnu.png'),
  ('강원대학교%','/assets/logos/kangwon.png'),
  ('계원예술고등학교%','/assets/logos/kaywon-arts.png'),
  ('이화여자대학교%','/assets/logos/ewha.png'),
  ('성신여자대학교%','/assets/logos/sungshin.png'),
  ('단국대학교%','/assets/logos/dankook.png'),
  ('국민대학교%','/assets/logos/kookmin.png'),
  ('목원대학교%','/assets/logos/mokwon.png'),
  ('고양예술고등학교%','/assets/logos/goyang-arts.png'),
  ('인천예술고등학교%','/assets/logos/incheon-arts.png'),
  ('서울여자대학교%','/assets/logos/swu.png'),
  ('덕성여자대학교%','/assets/logos/duksung.png'),
  ('강남대학교%','/assets/logos/kangnam.png')
) as m(pat, url)
where s.name_ko like m.pat and s.hidden = false;


-- ── 3) 결과 확인 — 로고 없는 요강이 위로 옵니다 ──
select a.title as 요강, s.name_ko as 학교,
       coalesce(nullif(s.logo_url,''),'❌ 없음') as 학교로고
from public.admission a
left join public.schools s on s.id = a.school_id
order by (coalesce(s.logo_url,'') <> ''), a.title;
