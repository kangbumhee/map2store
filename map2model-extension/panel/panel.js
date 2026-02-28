// ========================================
// panel/panel.js — v10.0
// map2model.com 내부 패널 (기존 기능 유지)
// ========================================

(function () {
  let token = '';
  let hdList = [];
  let ldList = [];
  let presets = [];
  let currentTab = 'hd';
  let selectedDongs = [];
  let selectedPreset = null;

  const $ = id => document.getElementById(id);

  async function init() {
    const stored = await chrome.storage.local.get('gimi9_token');
    if (stored.gimi9_token) {
      token = stored.gimi9_token;
      $('token-input').value = token;
    }

    try {
      const r1 = await fetch(chrome.runtime.getURL('data/dong-list.json'));
      hdList = await r1.json();
      log(`📂 행정동 로드: ${hdList.length}개`);
    } catch (e) { log(`❌ 행정동 로드 실패: ${e.message}`); }

    try {
      const r2 = await fetch(chrome.runtime.getURL('data/legal-dong-list.json'));
      ldList = await r2.json();
      log(`📂 법정동 로드: ${ldList.length}개`);
    } catch (e) { log(`❌ 법정동 로드 실패: ${e.message}`); }

    try {
      const r3 = await fetch(chrome.runtime.getURL('data/presets.json'));
      presets = await r3.json();
      const totalItems = presets.reduce((sum, c) => sum + c.items.length, 0);
      log(`📂 명소 프리셋: ${presets.length}개 카테고리, ${totalItems}개 장소`);
      renderPresetDropdowns();
    } catch (e) { log(`❌ 프리셋 로드 실패: ${e.message}`); }

    if (typeof turf !== 'undefined') {
      log('📐 Turf.js 로드 완료');
    } else {
      log('⚠️ Turf.js 미로드 — 복수 선택 병합 불가');
    }

    $('token-save').addEventListener('click', () => {
      token = $('token-input').value.trim();
      chrome.storage.local.set({ gimi9_token: token });
      log('🔑 토큰 저장 완료');
    });

    $('search-input').addEventListener('input', debounce(onSearch, 250));
    $('start-btn').addEventListener('click', onStart);

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        $('search-section').style.display = currentTab === 'preset' ? 'none' : 'block';
        $('preset-section').style.display = currentTab === 'preset' ? 'block' : 'none';
        if (currentTab === 'preset') {
          selectedDongs = [];
          renderSelectedList();
        } else {
          selectedPreset = null;
        }
        $('results').innerHTML = '';
        if (currentTab === 'hd') $('search-input').placeholder = '행정동 검색 (예: 장기동) — 복수 선택 가능';
        else if (currentTab === 'ld') $('search-input').placeholder = '법정동 검색 (예: 장기동) — 복수 선택 가능';
        updateSelectedSection();
      });
    });

    window.addEventListener('message', e => {
      if (e.data?.type === 'M2M_STATUS' || e.data?.type === 'statusUpdate') {
        log(e.data.message);
      }
    });
  }

  function renderPresetDropdowns() {
    const catSelect = $('preset-category');
    const itemSelect = $('preset-item');
    const descDiv = $('preset-desc');

    presets.forEach((cat, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${cat.category} (${cat.items.length})`;
      catSelect.appendChild(opt);
    });

    catSelect.addEventListener('change', () => {
      const idx = catSelect.value;
      itemSelect.innerHTML = '<option value="">-- 장소 선택 --</option>';
      descDiv.style.display = 'none';
      selectedPreset = null;
      updateSelectedSection();
      if (idx === '') { itemSelect.disabled = true; return; }
      const cat = presets[parseInt(idx, 10)];
      const sorted = cat.items.map((item, i) => ({ ...item, origIdx: i }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      sorted.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.origIdx;
        opt.textContent = item.name;
        itemSelect.appendChild(opt);
      });
      itemSelect.disabled = false;
    });

    itemSelect.addEventListener('change', () => {
      const catIdx = catSelect.value;
      const itemIdx = itemSelect.value;
      if (catIdx === '' || itemIdx === '') {
        descDiv.style.display = 'none';
        selectedPreset = null;
        updateSelectedSection();
        return;
      }
      const item = presets[parseInt(catIdx, 10)].items[parseInt(itemIdx, 10)];
      descDiv.style.display = 'block';
      descDiv.textContent = item.desc;
      selectedPreset = { ...item, tab: 'preset' };
      updateSelectedSection();
      log(`✅ 명소 선택: ${item.name}`);
    });
  }

  function onSearch() {
    const q = $('search-input').value.trim();
    if (q.length < 1) { $('results').innerHTML = ''; return; }
    const list = currentTab === 'hd' ? hdList : ldList;
    const matches = list.filter(d => (d.dong || d.name).includes(q)).slice(0, 50);
    log(`🔍 "${q}" → ${matches.length}개 결과 (${currentTab === 'hd' ? '행정동' : '법정동'})`);
    renderResults(matches);
  }

  function renderResults(matches) {
    const badge = currentTab === 'hd' ? 'hd' : 'ld';
    const badgeText = currentTab === 'hd' ? '행정' : '법정';
    $('results').innerHTML = matches.map((d, i) => {
      const isSel = selectedDongs.some(s => s.code === d.code && s.tab === currentTab);
      return `<div class="result-item ${isSel ? 'selected' : ''}" data-idx="${i}">
        <span class="result-check ${isSel ? 'checked' : ''}">${isSel ? '✓' : ''}</span>
        <div style="flex:1">${d.name} <span class="type-badge ${badge}">${badgeText}</span>
        <div class="code">${d.code}</div></div></div>`;
    }).join('');
    $('results').querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => {
        toggleDong(matches[parseInt(el.dataset.idx, 10)]);
        renderResults(matches);
      });
    });
  }

  function toggleDong(dong) {
    const idx = selectedDongs.findIndex(s => s.code === dong.code && s.tab === currentTab);
    if (idx >= 0) {
      selectedDongs.splice(idx, 1);
      log(`➖ 제거: ${dong.name} (${dong.code})`);
    } else {
      selectedDongs.push({ ...dong, tab: currentTab });
      log(`➕ 추가: ${dong.name} (${dong.code}) [${selectedDongs.length}개 선택]`);
    }
    renderSelectedList();
    updateSelectedSection();
  }

  function renderSelectedList() {
    const container = $('selected-list');
    if (selectedDongs.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = selectedDongs.map((d, i) =>
      `<span class="selected-tag">${d.dong || d.name.split(' ').pop()}
      <span class="remove-tag" data-idx="${i}">✕</span></span>`
    ).join('');
    container.querySelectorAll('.remove-tag').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(el.dataset.idx, 10);
        const removed = selectedDongs.splice(i, 1)[0];
        log(`➖ 제거: ${removed.name}`);
        renderSelectedList();
        updateSelectedSection();
        if ($('search-input').value.trim().length >= 1) onSearch();
      });
    });
  }

  function updateSelectedSection() {
    const section = $('selected-section');
    const info = $('selected-info');
    const rectRow = $('rect-row');

    if (currentTab === 'preset') {
      if (selectedPreset) {
        section.style.display = 'block';
        rectRow.style.display = 'none';
        info.innerHTML = `<strong>${selectedPreset.name}</strong>
          <span style="display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;background:#cba6f7;color:#1e1e2e;margin-left:6px;">명소</span><br>
          <span style="color:#a6adc8">${selectedPreset.desc}</span>`;
      } else { section.style.display = 'none'; }
      return;
    }

    if (selectedDongs.length === 0) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    rectRow.style.display = 'flex';
    const typeLabel = currentTab === 'hd' ? '행정동' : '법정동';
    if (selectedDongs.length === 1) {
      info.innerHTML = `<strong>${selectedDongs[0].name}</strong><br>
        <span style="color:#a6adc8">${typeLabel} 코드: ${selectedDongs[0].code}</span>`;
    } else {
      const names = selectedDongs.map(d => d.dong || d.name.split(' ').pop()).join(', ');
      info.innerHTML = `<strong>${selectedDongs.length}개 ${typeLabel} 선택</strong><br>
        <span style="color:#a6adc8">${names}</span><br>
        <span style="color:#f9e2af;font-size:10px">인접한 동은 자동으로 병합됩니다</span>`;
    }
  }

  function toBoundingBox(coords) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of coords) {
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    }
    return [[minLat, minLng], [maxLat, minLng], [maxLat, maxLng], [minLat, maxLng], [minLat, minLng]];
  }

  function parseWKT(wkt) {
    const match = wkt.match(/\(\(([^)]+)\)\)/);
    if (!match) return [];
    return match[1].split(',').map(pair => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lat, lng];
    });
  }

  function coordsToGeoJSON(coords) {
    const ring = coords.map(([lat, lng]) => [lng, lat]);
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
    return turf.polygon([ring]);
  }

  function geoJSONToCoords(geojson) {
    return geojson.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
  }

  function mergePolygons(polygonList) {
    if (polygonList.length === 1) return polygonList[0];
    let merged = polygonList[0];
    for (let i = 1; i < polygonList.length; i++) {
      try {
        const result = turf.union(turf.featureCollection([merged, polygonList[i]]));
        if (result) merged = result;
      } catch (e) { console.warn('Union failed for polygon', i, e); }
    }
    return merged;
  }

  async function onStart() {
    const autoMesh = $('auto-mesh').checked;
    const useRect = $('use-rect')?.checked || false;

    if (currentTab === 'preset') {
      if (!selectedPreset) return log('❌ 명소를 먼저 선택하세요');
      const { name, bounds } = selectedPreset;
      const sw = bounds[0], ne = bounds[1];
      const rectCoords = [[sw[0], sw[1]], [ne[0], sw[1]], [ne[0], ne[1]], [sw[0], ne[1]], [sw[0], sw[1]]];
      log(`🚀 사각형 폴리곤 전송: ${name}`);
      window.parent.postMessage({
        type: 'M2M_DRAW_POLYGON', coords: rectCoords, name, autoMesh, isRect: true
      }, '*');
      return;
    }

    if (selectedDongs.length === 0) return log('❌ 동을 먼저 선택하세요');
    if (!token) return log('❌ 토큰을 먼저 저장하세요');

    const apiType = selectedDongs[0].tab === 'hd' ? 'hd' : 'ld';

    if (selectedDongs.length === 1) {
      const { code, name } = selectedDongs[0];
      log(`📡 API 호출: type=${apiType}, code=${code}`);
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'gimi9_region', type: apiType, code, token });
        if (!resp.success) return log(`❌ API 오류: ${resp.error}`);
        const data = resp.data;
        let wkt = null;
        if (Array.isArray(data)) wkt = data[0]?.wkt;
        else if (data?.wkt) wkt = data.wkt;
        else if (data?.results) wkt = data.results[0]?.wkt;
        if (!wkt) return log('❌ 경계 데이터 없음');
        let coords = parseWKT(wkt);
        if (useRect) { coords = toBoundingBox(coords); log('📐 직사각형 변환'); }
        log(`🚀 폴리곤 전송: ${name}`);
        window.parent.postMessage({
          type: 'M2M_DRAW_POLYGON', coords, name, autoMesh, isRect: useRect
        }, '*');
      } catch (e) { log(`❌ 오류: ${e.message}`); }
      return;
    }

    if (typeof turf === 'undefined') return log('❌ Turf.js 미로드 — 복수 선택 병합 불가');

    const names = selectedDongs.map(d => d.dong || d.name.split(' ').pop());
    log(`📡 ${selectedDongs.length}개 동 경계 조회 시작`);
    const geoPolygons = [];

    for (let i = 0; i < selectedDongs.length; i++) {
      const d = selectedDongs[i];
      const short = d.dong || d.name.split(' ').pop();
      log(`  📡 (${i + 1}/${selectedDongs.length}) ${short} 조회 중...`);
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'gimi9_region', type: apiType, code: d.code, token });
        if (!resp.success) { log(`  ❌ ${short} 실패`); continue; }
        const data = resp.data;
        let wkt = null;
        if (Array.isArray(data)) wkt = data[0]?.wkt;
        else if (data?.wkt) wkt = data.wkt;
        else if (data?.results) wkt = data.results[0]?.wkt;
        if (!wkt) { log(`  ❌ ${short} 경계 없음`); continue; }
        geoPolygons.push(coordsToGeoJSON(parseWKT(wkt)));
        log(`  ✅ ${short} OK`);
      } catch (e) { log(`  ❌ ${short} 오류: ${e.message}`); }
    }

    if (geoPolygons.length === 0) return log('❌ 유효한 경계 없음');
    log(`📐 ${geoPolygons.length}개 폴리곤 병합 중...`);
    let merged;
    try { merged = mergePolygons(geoPolygons); } catch (e) { return log(`❌ 병합 실패: ${e.message}`); }

    let finalCoords;
    if (merged.geometry.type === 'MultiPolygon') {
      let maxLen = 0, maxRing = null;
      for (const poly of merged.geometry.coordinates) {
        if (poly[0].length > maxLen) { maxLen = poly[0].length; maxRing = poly[0]; }
      }
      finalCoords = maxRing.map(([lng, lat]) => [lat, lng]);
    } else {
      finalCoords = geoJSONToCoords(merged);
    }

    if (useRect) { finalCoords = toBoundingBox(finalCoords); log('📐 직사각형 변환'); }
    const combinedName = names.join('+');
    log(`🚀 병합 폴리곤 전송: ${combinedName}`);
    window.parent.postMessage({
      type: 'M2M_DRAW_POLYGON', coords: finalCoords, name: combinedName, autoMesh, isRect: useRect
    }, '*');
  }

  function log(msg) {
    const logEl = $('log');
    const d = document.createElement('div');
    d.textContent = `${new Date().toLocaleTimeString('ko-KR')} ${msg}`;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    console.log('[M2M Panel]', msg);
  }

  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

  init();
})();
