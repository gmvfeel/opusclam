/* ============================================================
   OPUSCLAM 공용 관계(네트워크) 표시 엔진  — assets/links.js
   entity_links 표를 읽어 뷰 페이지 하단에 "네트워크" 영역을 자동 생성합니다.
     · 인물 뷰 : 사사(스승) · 제자 · 소속 단체 · 출신 학교 · 같은 학교 동문
     · 단체 뷰 : 이 단체 소속 인물
     · 학교 뷰 : 이 학교 출신 인물
   이 한 파일만 고치면 모든 뷰 페이지에 반영됩니다.
   ※ 동문 관계는 저장하지 않고 실시간 조회합니다 (조합 폭발·용량 방지)
   ============================================================ */
(function () {
  'use strict';

  if (window.OCLinks) return;   // 중복 로드 방지

  var SB  = 'https://ptdxzxkgddvkusamkiol.supabase.co';
  var KEY = 'sb_publishable_FDTL3-sQ0c5NVCTA2lif7Q_v6Wee8Wu';
  var H   = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  var TABLE = { person: 'persons', org: 'orgs', school: 'schools' };
  var VIEW  = { person: '/db/person-view.html', org: '/db/org-view.html', school: '/db/school-view.html' };
  var NAMEK = ['name_ko', 'name', 'name_kr', 'title', 'org_name', 'school_name', 'name_en'];

  var CAP_ALUMNI = 12;   // 동문 표시 최대
  var CAP_GROUP  = 24;   // 그룹별 표시 최대

  /* ---------- 도우미 ---------- */
  function esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function rest(q) {
    return fetch(SB + '/rest/v1/' + q, { headers: H })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }
  function pickName(row) {
    for (var i = 0; i < NAMEK.length; i++) {
      var v = row[NAMEK[i]];
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  }
  function initial(s) { return (s || '?').trim().charAt(0) || '?'; }

  /* ---------- 스타일 (페이지 CSS를 건드리지 않도록 여기서 주입) ---------- */
  function injectCSS() {
    if (document.getElementById('ocl-css')) return;
    var css = ''
      + '.ocl-sec{margin-top:44px}'
      + '.ocl-g{margin-top:22px}'
      + '.ocl-t{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:13px;font-weight:700;color:var(--text-2,#3a3c52);letter-spacing:.02em}'
      + '.ocl-t em{font-style:normal;font-size:11px;font-weight:600;color:var(--text-3,#8a8c9e);background:var(--paper-2,#f2f2f7);border-radius:99px;padding:2px 8px}'
      + '.ocl-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}'
      + '@media(max-width:900px){.ocl-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}'
      + '@media(max-width:560px){.ocl-cards{grid-template-columns:1fr}}'
      + '.ocl-c{display:flex;align-items:center;gap:12px;padding:13px 15px;border:1px solid var(--line,#e4e4ec);border-radius:12px;text-decoration:none;background:transparent;transition:border-color .15s,transform .15s}'
      + 'a.ocl-c:hover{border-color:var(--violet-2,#7c63b0);transform:translateY(-2px)}'
      + '.ocl-c--off{opacity:.72}'
      + '.ocl-av{width:42px;height:42px;border-radius:50%;background:var(--paper-2,#f2f2f7);border:1px solid var(--line,#e4e4ec);display:grid;place-items:center;font-family:var(--display,inherit);font-weight:700;font-size:15px;color:var(--text-3,#8a8c9e);flex:0 0 auto}'
      + '.ocl-b{min-width:0}'
      + '.ocl-n{display:block;font-size:13.5px;font-weight:600;color:var(--text,#20223a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.ocl-s{display:block;font-size:11.5px;color:var(--text-3,#8a8c9e);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.ocl-cards[hidden]{display:none}'
      + '.ocl-cards+.ocl-cards{margin-top:12px}'
      + '.ocl-morebtn{margin-top:12px;background:transparent;border:1px solid var(--line,#e4e4ec);border-radius:9px;padding:9px 16px;font-size:12.5px;font-weight:600;font-family:inherit;color:var(--text-2,#3a3c52);cursor:pointer;transition:border-color .15s,color .15s}'
      + '.ocl-morebtn:hover{border-color:var(--violet-2,#7c63b0);color:var(--violet-2,#7c63b0)}'
      + ':where(.ocl-sec .pv-h){font-size:19px;font-weight:700}';
    var st = document.createElement('style');
    st.id = 'ocl-css'; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- 카드 ---------- */
  function card(item) {
    var av = '<span class="ocl-av">' + esc(initial(item.name)) + '</span>';
    var bd = '<span class="ocl-b"><span class="ocl-n">' + esc(item.name) + '</span>'
           + (item.sub ? '<span class="ocl-s">' + esc(item.sub) + '</span>' : '') + '</span>';
    if (item.href) {
      return '<a class="ocl-c" href="' + esc(item.href) + '">' + av + bd + '</a>';
    }
    return '<span class="ocl-c ocl-c--off" title="오퍼스클램 DB에 아직 등록되지 않은 항목입니다">' + av + bd + '</span>';
  }

  function group(g) {
    if (!g.items.length) return '';
    var cap  = g.cap || CAP_GROUP;
    var head = g.items.slice(0, cap);
    var tail = g.items.slice(cap);
    return '<div class="ocl-g"><h3 class="ocl-t">' + esc(g.label)
      + '<em>' + g.items.length + '</em></h3>'
      + '<div class="ocl-cards">' + head.map(card).join('') + '</div>'
      + (tail.length
          ? '<div class="ocl-cards ocl-rest" hidden>' + tail.map(card).join('') + '</div>'
            + '<button type="button" class="ocl-morebtn">+ ' + tail.length + '개 더 보기</button>'
          : '')
      + '</div>';
  }

  /* ---------- 이름 채우기 ---------- */
  // ids 를 종류별로 모아 한 번에 조회
  function resolve(needs) {
    var jobs = [];
    var store = { person: {}, org: {}, school: {} };
    Object.keys(needs).forEach(function (type) {
      var ids = Object.keys(needs[type]);
      if (!ids.length || !TABLE[type]) return;
      var sel = (type === 'person')
        ? 'id,name_ko,name_en,field,era_name,life'
        : '*';
      jobs.push(
        rest(TABLE[type] + '?select=' + sel + '&id=in.(' + ids.join(',') + ')&limit=500')
          .then(function (rows) {
            (rows || []).forEach(function (r) { store[type][r.id] = r; });
          })
      );
    });
    return Promise.all(jobs).then(function () { return store; });
  }

  function toItem(type, row) {
    if (!row) return null;
    if (type === 'person') {
      var nm = (row.name_ko || row.name_en || '').trim();
      var sub = [];
      if (row.field) sub.push(String(row.field).split(',')[0].trim());
      if (row.era_name) sub.push(String(row.era_name).trim());
      else if (row.life) sub.push(String(row.life).trim());
      return { name: nm || '(이름 없음)', sub: sub.filter(Boolean).join(' · '), href: VIEW.person + '?id=' + encodeURIComponent(row.id) };
    }
    var n = pickName(row);
    var s2 = (row.region || row.area || row.category || row.name_en || '');
    return { name: n || '(이름 없음)', sub: String(s2 || '').trim(), href: (VIEW[type] || '#') + '?id=' + encodeURIComponent(row.id) };
  }

  /* ---------- 인물 뷰 ---------- */
  function forPerson(id, mount) {
    var buckets = {
      teacher:    { label: '사사 · 스승',    items: [] },
      student:    { label: '제자',           items: [] },
      member_of:  { label: '소속 단체',      items: [] },
      fellow_of:  { label: '관련 단체 · 학회', items: [] },
      alumnus_of: { label: '출신 학교',      items: [] },
      alumni:     { label: '같은 학교 동문', items: [], cap: CAP_ALUMNI }
    };

    var fwd = rest('entity_links?select=rel,to_type,to_id,to_label&from_type=eq.person&from_id=eq.' + id + '&limit=400');
    var rev = rest('entity_links?select=rel,from_type,from_id&to_type=eq.person&to_id=eq.' + id + '&limit=400');
    var me  = rest('persons?select=id,school&id=eq.' + id);

    return Promise.all([fwd, rev, me]).then(function (res) {
      var rows = res[0] || [], back = res[1] || [], meRow = (res[2] || [])[0] || {};

      // 필요한 id 모으기
      var needs = { person: {}, org: {}, school: {} };
      var plain = [];   // DB 미등록(이름만)
      var seen  = {};

      rows.forEach(function (r) {
        var b = buckets[r.rel];
        if (!b) return;
        if (r.to_id && needs[r.to_type]) {
          var k = r.rel + '|' + r.to_type + '|' + r.to_id;
          if (seen[k]) return; seen[k] = 1;
          needs[r.to_type][r.to_id] = 1;
          b.items.push({ _t: r.to_type, _i: r.to_id });
        } else if (r.to_label) {
          var k2 = r.rel + '|label|' + r.to_label;
          if (seen[k2]) return; seen[k2] = 1;
          b.items.push({ name: r.to_label, sub: 'DB 미등록', href: null });
        }
      });

      // 역방향: 남이 나를 스승으로 등록 → 나에게는 제자
      back.forEach(function (r) {
        var target = (r.rel === 'teacher') ? 'student' : (r.rel === 'student' ? 'teacher' : null);
        if (!target || r.from_type !== 'person') return;
        var k = target + '|person|' + r.from_id;
        if (seen[k]) return; seen[k] = 1;
        needs.person[r.from_id] = 1;
        buckets[target].items.push({ _t: 'person', _i: r.from_id });
      });

      // 동문 (저장하지 않고 실시간 조회)
      var alumniJob = Promise.resolve([]);
      var sc = (meRow.school || '').trim();
      if (sc) {
        var base = sc.split(/[,·\/]/)[0].replace(/\s*(음악대학|음악학부|음악학과|음악과|대학원).*$/, '').trim();
        if (base.length >= 2) {
          alumniJob = rest('persons?select=id,name_ko,name_en,field,era_name,life,sort_no'
            + '&school=ilike.*' + encodeURIComponent(base) + '*'
            + '&id=neq.' + id + '&order=sort_no.asc.nullslast&limit=' + (CAP_ALUMNI + 1));
        }
      }

      return Promise.all([resolve(needs), alumniJob]).then(function (out) {
        var store = out[0], alumni = out[1] || [];

        // 자리표시자 → 실제 항목
        Object.keys(buckets).forEach(function (key) {
          buckets[key].items = buckets[key].items.map(function (it) {
            if (!it._t) return it;
            return toItem(it._t, store[it._t][it._i]);
          }).filter(Boolean);
        });

        alumni.forEach(function (r) {
          var it = toItem('person', r);
          if (it) buckets.alumni.items.push(it);
        });

        var order = ['teacher', 'student', 'member_of', 'fellow_of', 'alumnus_of', 'alumni'];
        var html = order.map(function (k) { return group(buckets[k]); }).join('');
        paint(mount, html, sc);
      });
    });
  }

  /* ---------- 단체 · 학교 뷰 (역방향: 소속·출신 인물) ---------- */
  function forEntity(type, id, mount) {
    var rel   = (type === 'org') ? 'member_of' : 'alumnus_of';
    var label = (type === 'org') ? '이 단체 소속 인물' : '이 학교 출신 인물';
    return rest('entity_links?select=from_id&to_type=eq.' + type + '&to_id=eq.' + id
                + '&rel=eq.' + rel + '&limit=200')
      .then(function (rows) {
        var needs = { person: {}, org: {}, school: {} }, order = [];
        (rows || []).forEach(function (r) {
          if (!r.from_id || needs.person[r.from_id]) return;
          needs.person[r.from_id] = 1; order.push(r.from_id);
        });
        if (!order.length) { paint(mount, '', ''); return; }
        return resolve(needs).then(function (store) {
          var items = order.map(function (i) { return toItem('person', store.person[i]); }).filter(Boolean);
          paint(mount, group({ label: label, items: items }), '');
        });
      });
  }

  /* ---------- 그리기 ---------- */
  function paint(mount, html, schoolText) {
    if (!html) { mount.remove(); return; }
    mount.innerHTML =
      '<div class="pv-sechead"><h2 class="pv-h">네트워크 <span class="pv-h-en">Network</span></h2>'
      + '<span class="pv-auto">자동 연결</span></div>' + html;

    // 더 보기 → 숨겨둔 카드 펼치기
    mount.querySelectorAll('.ocl-morebtn').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = b.previousElementSibling;
        if (box && box.classList.contains('ocl-rest')) box.hidden = false;
        b.remove();
      });
    });
  }

  /* ---------- 시작 ---------- */
  function boot() {
    var file = location.pathname.split('/').pop();
    var m = file.match(/^(.+)-view\.html$/);
    if (!m) return;
    var type = m[1];
    if (!TABLE[type]) return;                       // 아직 관계를 쓰지 않는 뷰는 조용히 통과

    var id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) return;

    var art = document.querySelector('article.pv');
    if (!art) return;

    injectCSS();
    var mount = document.createElement('section');
    mount.className = 'pv-sec ocl-sec';
    var contrib = art.querySelector('.pv-contrib');
    if (contrib) art.insertBefore(mount, contrib);
    else art.appendChild(mount);

    var job = (type === 'person') ? forPerson(id, mount) : forEntity(type, id, mount);
    job.catch(function () { mount.remove(); });
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  window.OCLinks = { boot: boot };
})();
