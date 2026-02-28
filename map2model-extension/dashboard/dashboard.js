// ========================================
// dashboard/dashboard.js — v10.0
// 대시보드 메인 로직
// ========================================

(function() {
  'use strict';

  // ── 상태 ──
  const state = {
    mapTab: 'preset',
    hdList: [],
    ldList: [],
    presets: [],
    selectedDongs: [],
    selectedPreset: null,
    capturedImage: null,
    sampleImages: [],
    extraImages: [],
    aiSections: [],
    aiCopy: null,
    aiTags: [],
    currentStep: 1,
    history: []
  };
  let _aiGenerating = false;
  let _uploading = false;
  let _batchRunning = false;

  const $ = id => document.getElementById(id);

  // ========== 초기화 ==========
  async function init() {
    await loadSettings();
    await loadData();
    setupNav();
    setupMapPage();
    setupProductPage();
    setupSettingsPage();
    loadHistory();
    checkMapConnection();
  }

  // ── 데이터 로드 ──
  async function loadData() {
    try {
      const r1 = await fetch(chrome.runtime.getURL('data/dong-list.json'));
      state.hdList = await r1.json();
      mapLog(`📂 행정동 로드: ${state.hdList.length}개`);
    } catch (e) { mapLog(`❌ 행정동 로드 실패`, 'err'); }

    try {
      const r2 = await fetch(chrome.runtime.getURL('data/legal-dong-list.json'));
      state.ldList = await r2.json();
      mapLog(`📂 법정동 로드: ${state.ldList.length}개`);
    } catch (e) { mapLog(`❌ 법정동 로드 실패`, 'err'); }

    try {
      const r3 = await fetch(chrome.runtime.getURL('data/presets.json'));
      state.presets = await r3.json();
      const total = state.presets.reduce((s, c) => s + c.items.length, 0);
      mapLog(`📂 명소 프리셋: ${state.presets.length} 카테고리, ${total}개 장소`);
      renderPresets();
      renderBatchList();
    } catch (e) { mapLog(`❌ 프리셋 로드 실패`, 'err'); }
  }

  // ── 설정 로드/저장 ──
  async function loadSettings() {
    const keys = ['gimi9_token', 'apiyi_key', 'ecco_api_key', 'naver_client_id', 'naver_client_secret',
      'category_id', 'return_info', 'outbound_code', 'return_address_id',
      'delivery_company', 'seller_phone'];
    const stored = await chrome.storage.local.get(keys);
    if (stored.gimi9_token) $('set-gimi9').value = stored.gimi9_token;
    if (stored.apiyi_key) $('set-apiyi').value = stored.apiyi_key;
    if (stored.ecco_api_key) $('set-eccoapi').value = stored.ecco_api_key;
    if (stored.naver_client_id) $('set-naver-id').value = stored.naver_client_id;
    if (stored.naver_client_secret) $('set-naver-secret').value = stored.naver_client_secret;
    if (stored.category_id) $('set-category-id').value = stored.category_id;
    if (stored.return_info) $('set-return-info').value = stored.return_info;
    if (stored.outbound_code) $('set-outbound-code').value = stored.outbound_code;
    if (stored.return_address_id) $('set-return-address-id').value = stored.return_address_id;
    if (stored.delivery_company) $('set-delivery-company').value = stored.delivery_company;
    if (stored.seller_phone) $('set-seller-phone').value = stored.seller_phone;
  }

  function getSetting(key) {
    const el = {
      'gimi9_token': 'set-gimi9',
      'apiyi_key': 'set-apiyi',
      'ecco_api_key': 'set-eccoapi',
      'naver_client_id': 'set-naver-id',
      'naver_client_secret': 'set-naver-secret'
    }[key];
    return el ? $(el)?.value?.trim() || '' : '';
  }

  // ── map2model 연결 체크 ──
  function checkMapConnection() {
    chrome.tabs.query({ url: 'https://map2model.com/*' }, (tabs) => {
      const ind = $('status-indicator');
      if (tabs && tabs.length > 0) {
        ind.className = 'status online';
        ind.querySelector('.status-text').textContent = 'map2model 연결됨';
      } else {
        ind.className = 'status offline';
        ind.querySelector('.status-text').textContent = 'map2model 미연결';
      }
    });
    setTimeout(checkMapConnection, 5000);
  }

  // ========== 네비게이션 ==========
  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        $(`page-${btn.dataset.page}`).classList.add('active');
      });
    });
  }

  // ========== 맵 페이지 ==========
  function setupMapPage() {
    // 초기 상태: 명소 탭이 기본
    state.mapTab = 'preset';
    $('map-search-area').style.display = 'none';
    $('map-preset-area').style.display = 'block';

    // 탭
    document.querySelectorAll('.map-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.mapTab = tab.dataset.mtab;
        $('map-search-area').style.display = state.mapTab === 'preset' ? 'none' : 'block';
        $('map-preset-area').style.display = state.mapTab === 'preset' ? 'block' : 'none';
        if (state.mapTab === 'preset') { state.selectedDongs = []; renderTags(); }
        else { state.selectedPreset = null; }
        $('map-results').innerHTML = '';
        updateSelInfo();
      });
    });

    // 검색
    let searchTimer;
    $('map-search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 250);
    });

    // 시작 버튼
    $('map-start-btn').addEventListener('click', doMapStart);
    $('batch-start-btn')?.addEventListener('click', () => {
      if (_batchRunning) return;
      runBatchAuto();
    });
    $('batch-check-all')?.addEventListener('change', (e) => {
      document.querySelectorAll('.batch-chk, .batch-cat-chk').forEach(chk => {
        chk.checked = e.target.checked;
        chk.indeterminate = false;
      });
      updateBatchCount();
    });
  }

  function doSearch() {
    const q = $('map-search').value.trim();
    if (q.length < 1) { $('map-results').innerHTML = ''; return; }
    const list = state.mapTab === 'hd' ? state.hdList : state.ldList;
    const matches = list.filter(d => (d.dong || d.name).includes(q)).slice(0, 50);
    mapLog(`🔍 "${q}" → ${matches.length}개 결과`);
    renderResults(matches);
  }

  function renderResults(matches) {
    const badge = state.mapTab === 'hd' ? 'hd' : 'ld';
    const badgeText = state.mapTab === 'hd' ? '행정' : '법정';
    $('map-results').innerHTML = matches.map((d, i) => {
      const isSel = state.selectedDongs.some(s => s.code === d.code && s.tab === state.mapTab);
      return `<div class="res-item ${isSel ? 'selected' : ''}" data-idx="${i}">
        <span class="res-check ${isSel ? 'checked' : ''}">${isSel ? '✓' : ''}</span>
        <div style="flex:1">
          <span class="res-name">${d.name}</span>
          <span class="res-badge ${badge}">${badgeText}</span>
          <div class="res-code">${d.code}</div>
        </div>
      </div>`;
    }).join('');

    $('map-results').querySelectorAll('.res-item').forEach(el => {
      el.addEventListener('click', () => {
        const d = matches[parseInt(el.dataset.idx, 10)];
        toggleDong(d);
        renderResults(matches);
      });
    });
  }

  function toggleDong(dong) {
    const idx = state.selectedDongs.findIndex(s => s.code === dong.code && s.tab === state.mapTab);
    if (idx >= 0) {
      state.selectedDongs.splice(idx, 1);
      mapLog(`➖ 제거: ${dong.name}`);
    } else {
      state.selectedDongs.push({ ...dong, tab: state.mapTab });
      mapLog(`➕ 추가: ${dong.name} [${state.selectedDongs.length}개]`);
    }
    renderTags();
    updateSelInfo();
  }

  function renderTags() {
    $('map-selected-tags').innerHTML = state.selectedDongs.map((d, i) =>
      `<span class="sel-tag">${d.dong || d.name.split(' ').pop()}
      <span class="sel-tag-x" data-idx="${i}">✕</span></span>`
    ).join('');
    $('map-selected-tags').querySelectorAll('.sel-tag-x').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedDongs.splice(parseInt(el.dataset.idx, 10), 1);
        renderTags();
        updateSelInfo();
        doSearch();
      });
    });
  }

  function updateSelInfo() {
    const infoDiv = $('map-selection-info');
    const startBtn = $('map-start-btn');

    if (state.mapTab === 'preset') {
      if (state.selectedPreset) {
        infoDiv.style.display = 'block';
        const cleanName = state.selectedPreset.name.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
        $('map-sel-name').textContent = cleanName;
        $('map-sel-detail').textContent = state.selectedPreset.desc;
        startBtn.disabled = false;
      } else {
        infoDiv.style.display = 'none';
        startBtn.disabled = true;
      }
      return;
    }

    if (state.selectedDongs.length === 0) {
      infoDiv.style.display = 'none';
      startBtn.disabled = true;
      return;
    }

    infoDiv.style.display = 'block';
    startBtn.disabled = false;
    if (state.selectedDongs.length === 1) {
      $('map-sel-name').textContent = state.selectedDongs[0].name;
      $('map-sel-detail').textContent = `코드: ${state.selectedDongs[0].code}`;
    } else {
      $('map-sel-name').textContent = `${state.selectedDongs.length}개 동 선택`;
      $('map-sel-detail').textContent = state.selectedDongs.map(d => d.dong || d.name.split(' ').pop()).join(', ');
    }
  }

  function renderPresets() {
    const catSel = $('map-preset-cat');
    const itemSel = $('map-preset-item');

    state.presets.forEach((cat, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = `${cat.category} (${cat.items.length})`;
      catSel.appendChild(o);
    });

    catSel.addEventListener('change', () => {
      const idx = catSel.value;
      itemSel.innerHTML = '<option value="">장소 선택</option>';
      itemSel.size = 1;
      $('map-preset-desc').style.display = 'none';
      state.selectedPreset = null;
      updateSelInfo();
      renderBatchList();
      if (idx === '') { itemSel.disabled = true; return; }
      const cat = state.presets[parseInt(idx, 10)];
      cat.items.sort((a, b) => a.name.localeCompare(b.name, 'ko')).forEach((item, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = item.name;
        itemSel.appendChild(o);
      });
      renderBatchList();
      itemSel.disabled = false;
      // 카테고리 선택 시 아이템 셀렉트 자동 포커스 + 드롭다운 열기
      setTimeout(() => {
        itemSel.focus();
        itemSel.click();
        itemSel.size = Math.min(cat.items.length + 1, 10);
        itemSel.addEventListener('change', function onceClose() {
          itemSel.size = 1;
          itemSel.removeEventListener('change', onceClose);
        }, { once: true });
        itemSel.addEventListener('blur', function onceBlur() {
          itemSel.size = 1;
          itemSel.removeEventListener('blur', onceBlur);
        }, { once: true });
      }, 50);
    });

    itemSel.addEventListener('change', () => {
      if (catSel.value === '' || itemSel.value === '') {
        $('map-preset-desc').style.display = 'none';
        state.selectedPreset = null;
        updateSelInfo();
        return;
      }
      const item = state.presets[parseInt(catSel.value, 10)].items[parseInt(itemSel.value, 10)];
      $('map-preset-desc').style.display = 'block';
      $('map-preset-desc').textContent = item.desc;
      state.selectedPreset = item;
      updateSelInfo();
      mapLog(`✅ 명소: ${item.name}`);
    });
  }

  // 카테고리 드롭다운과 무관하게 전체 프리셋 배치 리스트 렌더링
  function renderBatchList() {
    const batchArea = $('batch-area');
    const batchList = $('batch-list');
    if (!batchArea || !batchList) return;

    if (!state.presets || state.presets.length === 0) {
      batchArea.style.display = 'none';
      return;
    }
    batchArea.style.display = 'block';

    let html = '';
    state.presets.forEach((cat, catIdx) => {
      if (!cat.items || cat.items.length === 0) return;
      html += `
        <div class="batch-category" style="margin-bottom:12px;">
          <label style="display:flex;align-items:center;padding:6px 8px;cursor:pointer;color:#93c5fd;font-size:13px;font-weight:bold;background:#1e3a5f;border-radius:4px;margin-bottom:4px;">
            <input type="checkbox" class="batch-cat-chk" data-cat="${catIdx}" style="margin-right:8px;" />
            ${cat.category || cat.name || `카테고리 ${catIdx + 1}`} (${cat.items.length})
          </label>
          <div class="batch-cat-items" style="padding-left:12px;">
            ${cat.items.map((item, itemIdx) => `
              <label class="batch-item" style="display:flex;align-items:center;padding:4px 8px;cursor:pointer;border-radius:4px;color:#e2e8f0;font-size:12px;"
                     onmouseenter="this.style.background='#334155'" onmouseleave="this.style.background=''">
                <input type="checkbox" class="batch-chk" data-cat="${catIdx}" data-idx="${itemIdx}" style="margin-right:8px;" />
                ${item.name.replace(/\//g, ' ')}
              </label>
            `).join('')}
          </div>
        </div>
      `;
    });
    batchList.innerHTML = html;

    updateBatchCount();

    batchList.querySelectorAll('.batch-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        updateCategoryCheckState(chk.dataset.cat);
        updateBatchCount();
      });
    });
    batchList.querySelectorAll('.batch-cat-chk').forEach(catChk => {
      catChk.addEventListener('change', () => {
        const catIdx = catChk.dataset.cat;
        batchList.querySelectorAll(`.batch-chk[data-cat="${catIdx}"]`).forEach(chk => {
          chk.checked = catChk.checked;
        });
        updateBatchCount();
      });
    });
    $('batch-check-all').checked = false;
  }

  // 카테고리 체크 상태 동기화
  function updateCategoryCheckState(catIdx) {
    const items = document.querySelectorAll(`.batch-chk[data-cat="${catIdx}"]`);
    const checkedItems = document.querySelectorAll(`.batch-chk[data-cat="${catIdx}"]:checked`);
    const catChk = document.querySelector(`.batch-cat-chk[data-cat="${catIdx}"]`);
    if (catChk) {
      catChk.checked = items.length > 0 && items.length === checkedItems.length;
      catChk.indeterminate = checkedItems.length > 0 && checkedItems.length < items.length;
    }
  }

  function updateBatchCount() {
    const all = document.querySelectorAll('.batch-chk');
    const checked = document.querySelectorAll('.batch-chk:checked');
    $('batch-count').textContent = `${checked.length}개 선택`;
    $('batch-start-btn').disabled = checked.length === 0 || _batchRunning;
    $('batch-start-btn').textContent = checked.length > 0
      ? `🚀 ${checked.length}개 일괄 자동등록 시작`
      : '🚀 선택 항목 일괄 자동등록';
    const allChk = $('batch-check-all');
    if (allChk) {
      allChk.checked = all.length > 0 && checked.length === all.length;
      allChk.indeterminate = checked.length > 0 && checked.length < all.length;
    }
  }

  // ── 맵 생성 시작 ──
  async function doMapStart() {
    const autoMesh = $('map-auto-mesh').checked;
    const useRect = $('map-use-rect').checked;
    const token = getSetting('gimi9_token');

    if (state.mapTab === 'preset') {
      if (!state.selectedPreset) return mapLog('❌ 명소 선택 필요', 'err');
      const { name, bounds } = state.selectedPreset;
      const sw = bounds[0], ne = bounds[1];
      const coords = [[sw[0],sw[1]], [ne[0],sw[1]], [ne[0],ne[1]], [sw[0],ne[1]], [sw[0],sw[1]]];
      mapLog(`🚀 전송: ${name}`);
      sendPolygon(coords, name, autoMesh, true);
      if ($('prod-region-auto')?.checked) {
        const presetItemText = $('map-preset-item')?.selectedOptions?.[0]?.textContent?.trim() || '';
        const cleanPresetName = state.selectedPreset?.name
          ? state.selectedPreset.name.replace(/\//g, ' ').replace(/\s+/g, ' ').trim()
          : '';
        const cleanOptionText = presetItemText && presetItemText !== '장소 선택'
          ? presetItemText.replace(/\//g, ' ').replace(/\s+/g, ' ').trim()
          : '';
        const regionName = cleanPresetName || cleanOptionText || name;
        $('prod-region').value = regionName;
        const calcSize = calcSizeFromBounds(sw, ne);
        $('prod-name').value = `${regionName} 3D 지형 모형 액자 (${calcSize.label})`;
        $('size-list').innerHTML = '';
        addSizeRowWithData('기본', calcSize.w, calcSize.h, 90000);
        $('size-auto-info').style.display = 'block';
        $('size-auto-text').innerHTML = `좌표 기반: ${calcSize.widthM.toFixed(0)}×${calcSize.heightM.toFixed(0)}m → <strong>${calcSize.label}</strong>`;
      }
      return;
    }

    if (state.selectedDongs.length === 0) return mapLog('❌ 동 선택 필요', 'err');
    if (!token) return mapLog('❌ 설정에서 gimi9 토큰을 저장하세요', 'err');

    const apiType = state.selectedDongs[0].tab === 'hd' ? 'hd' : 'ld';

    // 경계 데이터 가져오기
    mapLog(`📡 ${state.selectedDongs.length}개 동 경계 조회...`);
    const allCoords = [];

    for (const dong of state.selectedDongs) {
      try {
        const resp = await chrome.runtime.sendMessage({
          action: 'gimi9_region', type: apiType, code: dong.code, token
        });
        if (!resp.success) { mapLog(`  ❌ ${dong.name}: ${resp.error}`, 'err'); continue; }
        const data = resp.data;
        let wkt = null;
        if (Array.isArray(data)) wkt = data[0]?.wkt;
        else if (data?.wkt) wkt = data.wkt;
        else if (data?.results) wkt = data.results[0]?.wkt;
        if (!wkt) { mapLog(`  ❌ ${dong.name}: 경계 없음`, 'err'); continue; }
        allCoords.push(parseWKT(wkt));
        mapLog(`  ✅ ${dong.name} OK`);
      } catch (e) { mapLog(`  ❌ ${dong.name}: ${e.message}`, 'err'); }
    }

    if (allCoords.length === 0) return mapLog('❌ 유효한 경계 없음', 'err');

    let finalCoords;
    if (allCoords.length === 1) {
      finalCoords = allCoords[0];
    } else {
      // 여러 개 — 병합은 panel에서 하도록 단일 선택만 지원
      // 대시보드에서는 Turf 없으므로 첫 번째만 사용
      mapLog('⚠️ 대시보드에서는 첫 번째 동 경계만 사용 (병합은 map2model 패널에서)');
      finalCoords = allCoords[0];
    }

    if (useRect) finalCoords = toBBox(finalCoords);

    const names = state.selectedDongs.map(d => d.dong || d.name.split(' ').pop()).join('+');
    mapLog(`🚀 전송: ${names}`);
    sendPolygon(finalCoords, names, autoMesh, useRect);

    // 상품 페이지에 지역명 전달 (체크박스가 체크되어 있을 때만)
    if ($('prod-region-auto')?.checked) {
      $('prod-region').value = names;
      const allLats = finalCoords.map(c => c[0]);
      const allLngs = finalCoords.map(c => c[1]);
      const bSw = [Math.min(...allLats), Math.min(...allLngs)];
      const bNe = [Math.max(...allLats), Math.max(...allLngs)];
      const calcSize = calcSizeFromBounds(bSw, bNe);
      $('prod-name').value = `${names} 3D 지형 모형 액자 (${calcSize.label})`;
      $('size-list').innerHTML = '';
      addSizeRowWithData('기본', calcSize.w, calcSize.h, 90000);
      $('size-auto-info').style.display = 'block';
      $('size-auto-text').innerHTML = `좌표 기반: ${calcSize.widthM.toFixed(0)}×${calcSize.heightM.toFixed(0)}m → <strong>${calcSize.label}</strong>`;
    }
  }

  function sendPolygon(coords, name, autoMesh, isRect) {
    chrome.runtime.sendMessage({
      action: 'sendPolygonToMap',
      coords, name, autoMesh, isRect
    }, (resp) => {
      if (resp?.success) {
        if (resp.opened) mapLog('📂 map2model.com 새 탭 열림');
        else mapLog('✅ 폴리곤 전송 완료!', 'ok');
      } else {
        mapLog(`❌ 전송 실패`, 'err');
      }
    });
  }

  // ========== 상품 페이지 ==========
  function setupProductPage() {
    // 캡처
    $('prod-capture-btn').addEventListener('click', doCapture);
    $('capture-confirm').addEventListener('click', () => {
      setStep(2);
    });
    $('capture-retry').addEventListener('click', doCapture);

    // Step 2: 사이즈 추가/삭제
    $('add-size-btn').addEventListener('click', addSizeRow);
    $('auto-size-btn').addEventListener('click', autoCalculateSize);
    $('size-list').addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del-sz')) {
        e.target.closest('.size-row').remove();
      }
    });

    // 실물 샘플 사진
    const sampleDrop = $('sample-drop');
    const sampleFile = $('sample-file');
    sampleDrop.addEventListener('click', () => sampleFile.click());
    sampleDrop.addEventListener('dragover', (e) => { e.preventDefault(); sampleDrop.classList.add('dragging'); });
    sampleDrop.addEventListener('dragleave', () => sampleDrop.classList.remove('dragging'));
    sampleDrop.addEventListener('drop', (e) => {
      e.preventDefault(); sampleDrop.classList.remove('dragging');
      handleSampleFiles(e.dataTransfer.files);
    });
    sampleFile.addEventListener('change', () => handleSampleFiles(sampleFile.files));
    chrome.storage.local.get('saved_sample_images', async (saved) => {
      if (saved.saved_sample_images && saved.saved_sample_images.length > 0) {
        // 기존 저장분도 1MB 이하로 압축
        const compressed = [];
        for (const img of saved.saved_sample_images) {
          if (img.length > 1024 * 1024) {
            const c = await compressImage(img, 1024, 0.7);
            compressed.push(c);
          } else {
            compressed.push(img);
          }
        }
        state.sampleImages = compressed;
        if (compressed.length !== saved.saved_sample_images.length ||
            compressed.some((c, i) => c !== saved.saved_sample_images[i])) {
          chrome.storage.local.set({ saved_sample_images: compressed });
        }
        renderSampleThumbs();
        prodLog(`📸 저장된 샘플 사진 ${state.sampleImages.length}장 로드`);
      }
    });

    // 추가 이미지
    const drop = $('extra-drop');
    const fileInput = $('extra-file');
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('dragging');
      handleExtraFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleExtraFiles(fileInput.files));

    $('step2-next').addEventListener('click', () => setStep(3));

    // Step 3: AI 생성
    $('ai-regen-btn').addEventListener('click', doAIGenerate);
    $('ai-confirm-btn').addEventListener('click', () => setStep(4));
    $('ai-section-limit').addEventListener('input', () => {
      const val = parseInt($('ai-section-limit').value, 10);
      $('ai-section-limit-label').textContent = `${val} / 7`;
      const cost = (val * 0.02).toFixed(2);
      $('ai-cost-estimate').textContent = `약 $${cost} (${Math.round(val * 27)}원)`;
      $('section-select-area').style.display = val > 0 ? 'block' : 'none';
      const checks = document.querySelectorAll('.sec-chk');
      let checked = 0;
      checks.forEach(chk => {
        if (checked < val) { chk.checked = true; checked++; }
        else { chk.checked = false; }
      });
    });
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('sec-chk')) {
        const checked = document.querySelectorAll('.sec-chk:checked').length;
        $('ai-section-limit').value = checked;
        $('ai-section-limit-label').textContent = `${checked} / 7`;
        const cost = (checked * 0.02).toFixed(2);
        $('ai-cost-estimate').textContent = `약 $${cost} (${Math.round(checked * 27)}원)`;
      }
    });
    $('ai-section-limit').dispatchEvent(new Event('input'));

    // Step 4: 미리보기
    $('preview-confirm').addEventListener('click', () => {
      setStep(5, false);
      doUpload();
    });

    // 원클릭
    $('prod-auto-btn').addEventListener('click', doFullAuto);
  }

  function setStep(n, autoRun = true) {
    state.currentStep = n;
    // 파이프라인 업데이트
    document.querySelectorAll('.pipe-step').forEach(el => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.remove('active', 'done');
      if (s < n) el.classList.add('done');
      if (s === n) el.classList.add('active');
    });
    // 카드 표시
    for (let i = 1; i <= 5; i++) {
      $(`step${i}-card`).style.display = i === n ? 'block' : 'none';
    }
    // 스텝 시작 동작
    if (autoRun && n === 3 && !_aiGenerating) doAIGenerate();
    // Step 5 자동 doUpload 제거 — 명시적 호출만 허용
  }

  async function doCapture() {
    prodLog('📸 캡처 중...');
    const resp = await chrome.runtime.sendMessage({ action: 'captureMap' });
    if (resp.success) {
      state.capturedImage = resp.dataUrl;
      $('capture-preview-img').src = resp.dataUrl;
      $('capture-preview-area').style.display = 'block';
      prodLog('✅ 캡처 완료!', 'ok');
      const existingSizes = getSizes();
      if (existingSizes.length === 0) {
        autoCalculateSize();
      }
    } else {
      prodLog(`❌ 캡처 실패: ${resp.error}. map2model.com을 먼저 열어주세요.`, 'err');
    }
  }

  function addSizeRow() {
    const row = document.createElement('div');
    row.className = 'size-row';
    row.innerHTML = `
      <input type="text" class="sz-label" value="" placeholder="이름">
      <input type="number" class="sz-w" value="" placeholder="가로mm">
      <span class="sz-x">×</span>
      <input type="number" class="sz-h" value="" placeholder="세로mm">
      <input type="number" class="sz-price" value="" placeholder="원">
      <button class="btn-del-sz">✕</button>`;
    $('size-list').appendChild(row);
  }

  function addSizeRowWithData(label, w, h, price) {
    const row = document.createElement('div');
    row.className = 'size-row';
    row.innerHTML = `
      <input type="text" class="sz-label" value="${label}" placeholder="이름">
      <input type="number" class="sz-w" value="${w}" placeholder="가로mm">
      <span class="sz-x">×</span>
      <input type="number" class="sz-h" value="${h}" placeholder="세로mm">
      <input type="number" class="sz-price" value="${price}" placeholder="원">
      <button class="btn-del-sz">✕</button>`;
    $('size-list').appendChild(row);
  }

  // ── 좌표 기반 실제 사이즈 계산 ──
  function calcSizeFromBounds(sw, ne) {
    function haversine(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    const midLat = (sw[0] + ne[0]) / 2;
    const widthM = haversine(midLat, sw[1], midLat, ne[1]);
    const heightM = haversine(sw[0], (sw[1] + ne[1]) / 2, ne[0], (sw[1] + ne[1]) / 2);
    const ratio = widthM / heightM;

    const longSide = 250;
    let w;
    let h;
    if (ratio >= 1) {
      w = longSide;
      h = Math.round(longSide / ratio);
    } else {
      h = longSide;
      w = Math.round(longSide * ratio);
    }

    return { w, h, label: `${w}×${h}mm`, ratio, widthM, heightM };
  }

  function autoCalculateSize() {
    if (!state.capturedImage) return;

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = w / h;

      const longSide = 250;
      const shortSide = Math.round(longSide / (ratio > 1 ? ratio : (1 / ratio)));

      // 항상 긴 쪽이 250mm
      let mmW;
      let mmH;
      if (ratio >= 1) {
        mmW = longSide;
        mmH = shortSide;
      } else {
        mmW = shortSide;
        mmH = longSide;
      }

      $('size-auto-info').style.display = 'block';
      $('size-auto-text').innerHTML = `캡처 비율: ${w}×${h}px (${ratio.toFixed(2)}) → <strong>${mmW}×${mmH}mm</strong>`;

      // 기존 사이즈 목록 초기화 후 자동 입력
      $('size-list').innerHTML = '';
      addSizeRowWithData('기본', mmW, mmH, 90000);

      // 상품명에 사이즈 반영
      const currentName = $('prod-name').value;
      if (currentName) {
        const cleaned = currentName.replace(/\s*\(\d+×\d+mm\)/, '');
        $('prod-name').value = `${cleaned} (${mmW}×${mmH}mm)`;
      }
    };
    img.src = state.capturedImage;
  }

  function handleSampleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (state.sampleImages.length >= 3) {
        prodLog('⚠️ 샘플 사진은 최대 3장까지', 'err');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        // 1MB 이하로 압축 (API 참조이미지 크기 제한 대응)
        compressImage(e.target.result, 1024, 0.7).then(compressed => {
          const beforeKB = (e.target.result.length / 1024).toFixed(0);
          const afterKB = (compressed.length / 1024).toFixed(0);
          state.sampleImages.push(compressed);
          renderSampleThumbs();
          chrome.storage.local.set({ saved_sample_images: state.sampleImages });
          prodLog(`📸 샘플 사진 추가 (${state.sampleImages.length}/3) — ${beforeKB}KB→${afterKB}KB`);
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function compressImage(dataUrl, maxDim, quality) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }

  function renderSampleThumbs() {
    $('sample-thumbs').innerHTML = state.sampleImages.map((img, i) =>
      `<div class="thumb-item">
        <img src="${img}" alt="샘플${i+1}">
        <button class="thumb-del" data-sidx="${i}">✕</button>
      </div>`
    ).join('');
    $('sample-thumbs').querySelectorAll('.thumb-del').forEach(btn => {
      btn.addEventListener('click', () => {
        state.sampleImages.splice(parseInt(btn.dataset.sidx, 10), 1);
        renderSampleThumbs();
        chrome.storage.local.set({ saved_sample_images: state.sampleImages });
      });
    });
  }

  function handleExtraFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        state.extraImages.push(e.target.result);
        renderExtraThumbs();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderExtraThumbs() {
    $('extra-thumbs').innerHTML = state.extraImages.map((img, i) =>
      `<div class="thumb-item">
        <img src="${img}" alt="추가${i+1}">
        <button class="thumb-del" data-idx="${i}">✕</button>
      </div>`
    ).join('');
    $('extra-thumbs').querySelectorAll('.thumb-del').forEach(btn => {
      btn.addEventListener('click', () => {
        state.extraImages.splice(parseInt(btn.dataset.idx, 10), 1);
        renderExtraThumbs();
      });
    });
  }

  // ── 사이즈 데이터 수집 ──
  function getSizes() {
    const rows = $('size-list').querySelectorAll('.size-row');
    const sizes = [];
    rows.forEach(row => {
      const label = row.querySelector('.sz-label').value.trim();
      const w = parseInt(row.querySelector('.sz-w').value, 10) || 0;
      const h = parseInt(row.querySelector('.sz-h').value, 10) || 0;
      const price = parseInt(row.querySelector('.sz-price').value, 10) || 0;
      if (label && w > 0 && h > 0 && price > 0) {
        sizes.push({ label, width: w, height: h, price });
      }
    });
    return sizes;
  }

  // 동시 요청 제한 (API rate limit 대응)
  async function parallelLimit(tasks, limit = 2) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
      const p = task().then(r => {
        executing.splice(executing.indexOf(p), 1);
        return r;
      });
      results.push(p);
      executing.push(p);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    return Promise.all(results);
  }

  // EccoAPI용 프롬프트 래퍼 (참조 이미지 1장 전용)
  function buildEccoPrompt(originalPrompt) {
    let converted = (originalPrompt || '')
      .replace(/You are given two reference images:[\s\S]*?Image 2:[^\n]+\n?/,
        'You are given one reference image: a 3D terrain map rendering. Use the EXACT terrain from this image.\n')
      .replace(/Frame style \(black wood, raised edges\) from Image 2/g,
        'Frame style: black wood frame with raised edges');
    if (!converted.includes('FILL the entire interior')) {
      converted = converted.replace(
        /CRITICAL RULES:\n- The terrain INSIDE the frame must come from Image 1 ONLY[^\n]*\n/,
        `CRITICAL RULES:
- The terrain INSIDE the frame must come from Image 1 ONLY
- The terrain model must FILL the entire interior of the frame edge-to-edge with NO gaps, NO margins, NO visible frame bottom/backing. The 3D terrain extends to all four edges of the frame opening.
`
      );
    }
    return converted;
  }

  // ========== AI 상세페이지 생성 ==========
  async function doAIGenerate() {
    if (_aiGenerating) return;
    _aiGenerating = true;

    const apiKey = getSetting('apiyi_key');
    const eccoKey = $('set-eccoapi')?.value?.trim() || '';
    const useEcco = !!eccoKey;
    if (!apiKey) { prodLog('❌ 설정에서 Nano Banana API Key를 입력하세요', 'err'); _aiGenerating = false; return; }

    const prodName = $('prod-name').value.trim() || '3D 지형 모형 액자';
    if (!$('prod-region').value.trim() && state.selectedPreset?.name) {
      const cleanName = state.selectedPreset.name.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
      $('prod-region').value = cleanName;
      $('prod-name').value = `${cleanName} 3D 지형 모형 액자 (${getSizes()[0]?.width || 250}×${getSizes()[0]?.height || 174}mm)`;
      prodLog(`📍 지역명 자동 보정: ${cleanName}`);
    }
    const prodRegion = $('prod-region').value.trim() || '지역';
    const prodDesc = $('prod-desc').value.trim();
    const sizes = getSizes();
    const hasSamples = state.sampleImages.length > 0;
    const hasCapture = !!state.capturedImage;

    // 체크된 섹션 인덱스 수집
    const checkedSections = [];
    document.querySelectorAll('.sec-chk:checked').forEach(chk => {
      checkedSections.push(parseInt(chk.dataset.sec, 10));
    });
    const sectionLimit = checkedSections.length;
    prodLog(`🎯 이미지 생성: ${sectionLimit}개 섹션 (${checkedSections.map(i => i + 1).join(',')})`);

    $('ai-gen-result').style.display = 'none';
    $('ai-gen-progress').style.display = 'block';
    updateAIProgress(0, '시작...');
    // AI 생성 경과 시간 타이머 (별도 표시)
    const timerStartTime = Date.now();
    const elapsedEl = $('ai-elapsed-time');
    if (elapsedEl) {
      elapsedEl.style.display = 'block';
      elapsedEl.textContent = '⏱️ 경과 시간: 0초';
    }
    const timerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - timerStartTime) / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      if (elapsedEl) {
        elapsedEl.textContent = `⏱️ 경과 시간: ${min > 0 ? `${min}분 ` : ''}${s}초`;
      }
    }, 1000);

    try {
      const generateHero = checkedSections.includes(0) && hasCapture;

      // 사이즈 텍스트
      const sizesText = sizes.map(s => `${s.label}: ${s.width}×${s.height}mm — ${s.price.toLocaleString()}원`).join('\n');
      const sizeInfo = sizes.length > 0 ? `${sizes[0].width}×${sizes[0].height}mm` : '250×174mm';
      let sectionAspectRatio = '16:9';
      if (sizes.length > 0) {
        const sr = sizes[0].width / sizes[0].height;
        sectionAspectRatio = sr > 1.3 ? '16:9' : sr > 0.8 ? '1:1' : '9:16';
        prodLog(`📐 사이즈 비율 ${sr.toFixed(2)} → 섹션 이미지: ${sectionAspectRatio}`);
      }
      const naverKeywords = await fetchNaverKeywords(prodRegion);
      prodLog(`🔍 네이버 연관키워드 ${naverKeywords.length}개 수집`);

      // ═══════════════════════════════════════
      // 0단계 + 1단계 병렬: 대표 이미지 + 텍스트 기획 동시 시작
      // ═══════════════════════════════════════

      // 대표 이미지 프롬프트 (새 프롬프트 적용)
      const heroPromptText = hasSamples
        ? `You are given two reference images:
- Image 1: A 3D terrain map rendering. Use the EXACT terrain, coastline, and geography from this image.
- Image 2: A real product photo showing the BLACK FRAME STYLE and MATERIAL FINISH only. Do NOT copy the terrain from this image.

CRITICAL RULES:
- The terrain INSIDE the frame must come from Image 1 ONLY
- The 3D terrain must FILL the entire frame interior edge-to-edge, NO gaps, NO margins, NO visible backing or empty space between terrain and frame
- Frame style: black wood frame with raised edges
- Product is a SMALL 3D printed terrain relief model (${sizeInfo}), about the size of a paperback book
- If furniture is in the scene, the product must appear SMALL relative to it
- Photorealistic product photography only
- No text, no watermarks, no fantasy elements`
        : `Create a photorealistic product photo of a 3D printed terrain model (${sizeInfo}) inside a black wooden frame.
The terrain should show landscape with roads, buildings, water, and green areas in raised 3D relief.
Professional e-commerce product photography on clean background. No text or watermarks.`;

      // 텍스트 기획 프롬프트
      const planPrompt = `너는 한국 이커머스 상세페이지 전문 기획자야.
아래 상품의 스마트스토어 상세페이지를 7개 섹션으로 기획해줘.

## 상품 정보
- 상품명: ${prodName}
- 지역: ${prodRegion}
- 사이즈: ${sizeInfo}
- 설명: ${prodDesc || '실제 위성 지형 데이터를 기반으로 3D 프린팅한 세상에 하나뿐인 지형 모형 액자입니다.'}
- 사이즈/가격:
${sizesText || '기본: 250×174mm — 90,000원'}

## 핵심 셀링 포인트
- 세상에 없던 완전히 새로운 카테고리의 상품
- 실제 위성 지형 데이터 기반 정밀 3D 프린팅
- 건물, 도로, 공원, 물길이 모두 입체적으로 표현
- 내가 사는 동네, 추억의 장소를 입체적으로 소장
- 선물용으로 완벽 (집들이, 기념일, 졸업 등)
- 액자 프레임 포함, 벽걸이 전용 설치
- 주문 제작 (3일 이내 배송)

## FAQ 작성 시 주의
- "액자 프레임 색상 변경 가능한가요?" 포함 금지
- "원하는 지역은 어떻게 지정하나요?" 포함 금지
- 제작 기간은 "3일 이내"로 안내
- 이 제품은 벽걸이 전용입니다. 탁상 거치, 스탠드, 이젤 관련 내용을 절대 포함하지 마세요.

## 섹션 구조 (7개)
1. hook — 후킹 감성 첫인상
2. product — 제품 상세 (3D 프린팅 공정, 소재)
3. sizes — 사이즈 비교 & 가격
4. lifestyle — 활용 사례 (인테리어, 선물)
5. process — 주문→제작→배송 과정
6. uniqueness — 차별점
7. trust — 배송/AS/신뢰도

## visualPrompt 작성 규칙 (매우 중요!)
각 섹션의 visualPrompt는 반드시 아래 규칙을 따라야 합니다:
- 반드시 "검은 나무 액자에 들어있는 3D 지형 모형 제품"이 사진의 주인공이어야 합니다
- 제품이 특정 장소/상황에 놓여있는 "제품 사진" 설명만 작성하세요
- 좋은 예: "나무 책상 위에 놓인 3D 지형 액자 클로즈업, 옆에 커피잔"
- 좋은 예: "흰 벽에 걸린 3D 지형 액자, 아래에 미니멀 소파"
- 좋은 예: "45도 각도에서 본 3D 지형 액자 클로즈업, 입체적 지형 디테일 강조"
- 나쁜 예: "인포그래픽", "비교 이미지", "여러 패널", "노트북 화면", "QR코드"
- 나쁜 예: "선물 포장", "리본", "배송 박스"
- 절대 금지: infographic, split image, panel, laptop screen, text overlay, diagram
- 모든 섹션에서 실제 제품 사진 촬영 컨셉으로만 작성하세요
- 제품을 탁상에 세워놓는 장면 금지. 벽에 걸려있거나 평평하게 놓여있는 장면만 허용.

JSON 형태로:
{
  "sections": [
    {
      "order": 1,
      "logicType": "hook",
      "title": "섹션 제목",
      "keyMessage": "메인 카피",
      "subMessage": "보조 카피",
      "visualPrompt": "English prompt describing the SCENE/SETTING only (desk, wall, close-up etc). Do NOT describe the terrain — it comes from a reference image. Mention product is a small 250mm framed model if furniture is present."
    }
  ],
  "productCopy": {
    "catchphrase": "캐치프레이즈",
    "headline": "헤드라인",
    "description": "상세 설명 200자 이상",
    "specs": [{"label": "소재", "value": "PLA 친환경 소재"}, ...],
    "faq": [{"question": "질문", "answer": "답변"}, ...]
  },
  "tags": ["네이버 검색용 태그1", "태그2", ...]
}
태그 규칙:
- 최대 10개
- 아래 네이버 연관 키워드를 우선 포함: ${naverKeywords.slice(0, 5).join(', ')}
- 지역명 + 관광/맛집/볼거리/선물 조합
- 상품 관련: 3D지형모형, 인테리어액자, 지형모형액자 등 (띄어쓰기 없이)
- 반드시 네이버에서 검색 가능한 키워드만 사용
- "특별한 선물", "특별한선물" 등 일반적 형용사+명사 조합 금지
- 한글만, 각 태그 10자 이내 권장
JSON만 출력해.`;

      // ── 병렬 실행 ──
      prodLog('🚀 대표 이미지 + 텍스트 기획 동시 시작...');
      updateAIProgress(5, '대표 이미지 + 텍스트 기획 병렬 생성 중...');

      const refImages = [];
      if (hasCapture) refImages.push(state.capturedImage);
      if (hasSamples) refImages.push(state.sampleImages[0]);

      const [heroResult, planText] = await Promise.all([
        // 대표 이미지 (generateHero가 false면 null)
        generateHero
          ? chrome.runtime.sendMessage(
              useEcco
                ? {
                    action: 'ecco_image',
                    prompt: buildEccoPrompt(heroPromptText),
                    referenceImages: [state.capturedImage],
                    aspectRatio: '3:4',
                    eccoApiKey: eccoKey
                  }
                : {
                    action: 'apiyi_image',
                    prompt: heroPromptText,
                    apiKey,
                    referenceImages: refImages,
                    aspectRatio: '3:4'
                  }
            ).catch(e => ({ success: false, error: e.message }))
          : Promise.resolve(null),
        // 텍스트 기획
        callAPIYI(apiKey, planPrompt)
      ]);

      // 대표 이미지 결과 처리
      let heroImage = null;
      if (heroResult && heroResult.success) {
        heroImage = heroResult.imageData;
        prodLog('✅ 대표 이미지 생성 완료!', 'ok');
      } else if (heroResult) {
        prodLog(`⚠️ 대표 이미지 실패: ${heroResult.error}`);
      }

      // 텍스트 기획 결과 처리
      updateAIProgress(35, '기획 완료, 섹션 이미지 생성 중...');
      let planData;
      try {
        let clean = planText.trim();
        const jsonBlock = clean.match(/```json\s*([\s\S]*?)```/);
        if (jsonBlock) clean = jsonBlock[1].trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) planData = JSON.parse(jsonMatch[0]);
        else throw new Error('JSON not found');
      } catch (e) {
        prodLog(`❌ 기획 파싱 실패: ${e.message}`, 'err');
        _aiGenerating = false; return;
      }

      state.aiSections = planData.sections || [];
      state.aiCopy = planData.productCopy || null;
      if (Array.isArray(state.aiCopy?.faq)) {
        state.aiCopy.faq = state.aiCopy.faq.map((f) => {
          const q = (f.question || '').trim();
          if (/탁상|거치|스탠드|이젤/.test(q)) {
            return {
              question: '어떻게 설치하나요?',
              answer: '액자 뒷면에 벽걸이용 고리가 있어 벽에 간편하게 설치할 수 있습니다.'
            };
          }
          return f;
        });
      }
      const bannedTags = [
        '함께 많이 찾는', '특별한 선물', '특별한선물',
        '벽걸이액자', '벽걸이', '액자', '탁상액자',
        '무료배송', '당일배송', '할인', '세일', '최저가',
        '인기상품', '추천상품', '베스트', '1위',
        '정품', '가품', '짝퉁', '리뷰', '후기'
      ];
      const rawTags = [
        ...naverKeywords.slice(0, 5),
        ...(planData.tags || [])
      ].filter(t => t && t.length >= 2 && !bannedTags.includes(t) && !bannedTags.includes(t.replace(/\s/g, '')));
      const seen = new Set();
      state.aiTags = [];
      for (const tag of rawTags) {
        const normalized = tag.replace(/\s/g, '');
        if (!seen.has(normalized)) {
          seen.add(normalized);
          state.aiTags.push(tag);
        }
        if (state.aiTags.length >= 10) break;
      }
      prodLog(`✅ ${state.aiSections.length}개 섹션 기획 완료`);
      prodLog(`🏷️ 상품 태그 ${state.aiTags.length}개: ${state.aiTags.join(', ')}`);

      // 대표 이미지 → 섹션 1 적용
      if (heroImage && state.aiSections.length > 0) {
        try {
          const uploadResp = await chrome.runtime.sendMessage({
            action: 'cloudinary_upload', base64: heroImage, folder: 'map2model-products'
          });
          state.aiSections[0].imageUrl = uploadResp.success ? uploadResp.url : heroImage;
        } catch (e) { state.aiSections[0].imageUrl = heroImage; }
        prodLog('✅ 대표 이미지 → 섹션 1 적용');
      }

      // ═══════════════════════════════════════
      // 2단계: 나머지 체크된 섹션 이미지 생성
      // ═══════════════════════════════════════
      const sectionsToGenerate = state.aiSections
        .filter((sec, idx) => checkedSections.includes(idx) && !(idx === 0 && heroImage))
        .map(sec => sec);

      if (sectionsToGenerate.length > 0) {
        prodLog(`🎨 ${sectionsToGenerate.length}개 섹션 이미지 생성 시작...`);
        let done = 0;
        const total = sectionsToGenerate.length;

        async function generateSectionImage(section) {
          const sectionRefImages = [];
          if (hasCapture) sectionRefImages.push(state.capturedImage);
          if (hasSamples) sectionRefImages.push(state.sampleImages[0]);

          const fullPrompt = `You are given two reference images:
- Image 1: A 3D terrain map rendering. Use the EXACT terrain, coastline, and geography from this image.
- Image 2: A real product photo showing the BLACK FRAME STYLE and MATERIAL FINISH only. Do NOT copy the terrain from this image.

${section.visualPrompt}

CRITICAL RULES:
- The terrain INSIDE the frame must come from Image 1 ONLY
- The terrain model must FILL the entire interior of the frame edge-to-edge with NO gaps, NO margins, NO visible frame bottom/backing. The 3D terrain extends to all four edges of the frame opening.
- Frame style: black wood frame with raised edges
- Product is a SMALL 3D printed terrain relief model (${sizeInfo}), about the size of a paperback book
- If furniture is in the scene, the product must appear SMALL relative to it
- Photorealistic product photography only
- No text, no watermarks, no fantasy elements
- Must look like the same product photographed in different settings/angles`;

          try {
            const refs = sectionRefImages.slice(0, 2);
            const resp = await chrome.runtime.sendMessage(
              useEcco
                ? {
                    action: 'ecco_image',
                    prompt: buildEccoPrompt(fullPrompt),
                    referenceImages: [state.capturedImage],
                    aspectRatio: sectionAspectRatio,
                    eccoApiKey: eccoKey
                  }
                : {
                    action: 'apiyi_image',
                    prompt: fullPrompt,
                    apiKey,
                    referenceImages: refs,
                    aspectRatio: sectionAspectRatio
                  }
            );
            done++;
            updateAIProgress(35 + Math.round((done / total) * 55), `이미지 ${done}/${total} 완료`);

            if (resp.success) {
              try {
                const uploadResp = await chrome.runtime.sendMessage({
                  action: 'cloudinary_upload', base64: resp.imageData, folder: 'map2model-products'
                });
                section.imageUrl = uploadResp.success ? uploadResp.url : resp.imageData;
              } catch (e) { section.imageUrl = resp.imageData; }
              prodLog(`  ✅ ${section.logicType} 이미지 OK`);
            } else {
              prodLog(`  ❌ ${section.logicType} 실패: ${resp.error}`, 'err');
            }
          } catch (e) {
            done++;
            prodLog(`  ❌ ${section.logicType} 오류: ${e.message}`, 'err');
          }
        }

        for (const section of sectionsToGenerate) {
          await generateSectionImage(section);
          await new Promise(r => setTimeout(r, 2000)); // 2초 대기
        }
      }

      updateAIProgress(100, '완료!');
      const successCount = state.aiSections.filter(s => s.imageUrl).length;
      prodLog(`✅ AI 생성 완료! (${successCount}/${state.aiSections.length}개 이미지)`, 'ok');

      renderAISections();
      $('ai-gen-progress').style.display = 'none';
      $('ai-gen-result').style.display = 'block';

    } catch (e) {
      prodLog(`❌ AI 생성 실패: ${e.message}`, 'err');
      updateAIProgress(0, '실패');
    } finally {
      _aiGenerating = false;
      clearInterval(timerInterval);
      const elapsedEl = $('ai-elapsed-time');
      if (elapsedEl) elapsedEl.style.display = 'none';
    }
  }

  function updateAIProgress(pct, msg) {
    $('ai-progress-bar').style.width = `${pct}%`;
    $('ai-progress-text').textContent = msg;
  }

  function renderAISections() {
    $('ai-sections').innerHTML = state.aiSections.map((sec, i) => `
      <div class="ai-sec-thumb">
        ${sec.imageUrl
          ? `<img src="${sec.imageUrl}" alt="섹션${i+1}">`
          : `<div style="height:120px;display:flex;align-items:center;justify-content:center;background:#1e293b;color:#64748b">❌</div>`}
        <p><strong>${sec.title}</strong><br>${sec.keyMessage}</p>
      </div>
    `).join('');

    // Step 4 미리보기도 업데이트
    renderPreview();
  }

  function renderPreview() {
    let html = '';

    // 상품명 헤더
    const name = $('prod-name').value.trim() || '3D 지형 모형 액자';
    const sizes = getSizes();
    const basePrice = sizes.length > 0 ? sizes[0].price : 59000;

    html += `<div style="padding:20px;text-align:center;background:#1e293b;border-bottom:1px solid #475569">
      <h2 style="font-size:20px;margin-bottom:8px">${name}</h2>
      <p style="font-size:24px;font-weight:700;color:#3b82f6">${basePrice.toLocaleString()}원~</p>
    </div>`;

    // ═══ AI 섹션 (이미지 + 텍스트 설명) ═══
    state.aiSections.forEach((sec, i) => {
      if (sec.imageUrl) {
        html += `<img src="${sec.imageUrl}" style="width:100%;display:block" alt="섹션${i+1}">`;
      }
      html += `<div style="padding:40px 24px;background:${i % 2 === 0 ? '#1e293b' : '#0f172a'};text-align:center">
        <h3 style="font-size:48px;font-weight:700;margin-bottom:16px;color:#e2e8f0">${sec.title || ''}</h3>
        <p style="font-size:36px;font-weight:600;color:#3b82f6;margin-bottom:12px;line-height:1.5">${sec.keyMessage || ''}</p>
        ${sec.subMessage ? `<p style="font-size:28px;color:#94a3b8;line-height:1.6">${sec.subMessage}</p>` : ''}
      </div>`;
    });

    // 추가 이미지
    state.extraImages.forEach(img => {
      html += `<img src="${img}" style="width:100%;display:block;margin-top:4px">`;
    });

    // 스펙 테이블
    if (state.aiCopy?.specs) {
      html += `<div style="padding:20px;background:#1e293b">
        <h3 style="text-align:center;margin-bottom:12px;font-size:48px;font-weight:700">제품 상세 스펙</h3>
        <table style="width:100%;border-collapse:collapse">`;
      state.aiCopy.specs.forEach((spec, i) => {
        html += `<tr style="background:${i % 2 === 0 ? '#334155' : '#1e293b'}">
          <td style="padding:16px;border:1px solid #475569;font-weight:700;width:35%;font-size:28px;color:#94a3b8">${spec.label}</td>
          <td style="padding:16px;border:1px solid #475569;font-size:28px;color:#e2e8f0">${spec.value}</td></tr>`;
      });
      html += `</table></div>`;
    }

    // FAQ
    if (state.aiCopy?.faq) {
      html += `<div style="padding:20px;background:#0f172a">
        <h3 style="text-align:center;margin-bottom:12px;font-size:48px;font-weight:700">자주 묻는 질문</h3>`;
      state.aiCopy.faq.forEach(item => {
        html += `<div style="padding:12px;margin-bottom:8px;background:#1e293b;border-radius:8px">
          <p style="font-weight:700;color:#3b82f6;font-size:28px">Q. ${item.question}</p>
          <p style="margin-top:6px;color:#94a3b8;font-size:24px">A. ${item.answer}</p></div>`;
      });
      html += `</div>`;
    }

    $('preview-area').innerHTML = html;
  }

  function buildDetailHtml() {
    let html = '<div style="max-width:860px;margin:0 auto;text-align:center;">';

    // ── 각 섹션: 텍스트 + 이미지 교차 배치 ──
    state.aiSections.forEach(sec => {
      if (sec.title || sec.keyMessage || sec.subMessage) {
        html += '<div style="padding:40px 20px 20px;text-align:center;">';
        if (sec.title) {
          html += `<h3 style="font-size:36px;font-weight:700;color:#1a1a1a;margin:0 0 12px;line-height:1.4;">${sec.title}</h3>`;
        }
        if (sec.keyMessage) {
          html += `<p style="font-size:28px;color:#333;margin:0 0 8px;line-height:1.6;">${sec.keyMessage}</p>`;
        }
        if (sec.subMessage) {
          html += `<p style="font-size:24px;color:#666;margin:0;line-height:1.5;">${sec.subMessage}</p>`;
        }
        html += '</div>';
      }
      if (sec.imageUrl) {
        html += `<img src="${sec.imageUrl}" style="width:100%;max-width:860px;display:block;margin:0 auto;" alt="${sec.title || ''}">`;
      }
    });

    // ── 제품 상세 스펙 테이블 (font-size 4배 = 28px) ──
    if (state.aiCopy?.specs) {
      html += '<div style="padding:40px 20px 10px;"><h3 style="font-size:36px;font-weight:700;color:#1a1a1a;margin:0 0 16px;">제품 상세 스펙</h3></div>';
      html += '<table style="width:100%;max-width:860px;margin:0 auto 20px;border-collapse:collapse;">';
      state.aiCopy.specs.forEach((s, i) => {
        html += `<tr style="background:${i % 2 === 0 ? '#f8f9fa' : '#fff'}">
          <td style="padding:14px;border:1px solid #dee2e6;font-weight:700;font-size:28px;width:35%;">${s.label}</td>
          <td style="padding:14px;border:1px solid #dee2e6;font-size:28px;">${s.value}</td></tr>`;
      });
      html += '</table>';
    }

    // ── FAQ ──
    if (state.aiCopy?.faq && state.aiCopy.faq.length > 0) {
      html += '<div style="padding:30px 20px 10px;"><h3 style="font-size:36px;font-weight:700;color:#1a1a1a;margin:0 0 16px;">자주 묻는 질문</h3></div>';
      html += '<div style="max-width:860px;margin:0 auto;text-align:left;">';
      state.aiCopy.faq.forEach(f => {
        html += `<div style="padding:16px 20px;border-bottom:1px solid #eee;">
          <p style="font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">Q. ${f.question}</p>
          <p style="font-size:26px;color:#555;margin:0;line-height:1.5;">A. ${f.answer}</p></div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function saveHistory(item) {
    saveToHistory(item);
  }

  // ========== 스마트스토어 업로드 ==========
  async function doUpload() {
    if (_uploading) {
      prodLog('⚠️ 업로드 이미 진행 중 — 중복 호출 무시');
      return;
    }
    _uploading = true;
    prodLog('🚀 스마트스토어 업로드 시작...');
    try {
      const stored = await chrome.storage.local.get([
        'naver_client_id', 'naver_client_secret', 'category_id', 'return_info',
        'outbound_code', 'return_address_id', 'delivery_company', 'seller_phone'
      ]);

      if (!stored.naver_client_id || !stored.naver_client_secret) {
        prodLog('❌ 설정에서 네이버 API 키를 입력하세요', 'err'); return;
      }

      const api = new SmartStoreAPI(stored.naver_client_id, stored.naver_client_secret);
      prodLog('🔐 네이버 토큰 발급 시도...');
      await api.authenticate();
      prodLog('✅ 네이버 인증 성공');

      // 이미지 URL 수집 (base64면 Cloudinary 업로드 후 URL로 교체)
      const imageUrls = [];
      for (const sec of state.aiSections) {
        if (!sec.imageUrl) continue;
        if (sec.imageUrl.startsWith('http')) {
          imageUrls.push(sec.imageUrl);
        } else if (sec.imageUrl.startsWith('data:')) {
          try {
            prodLog('☁️ base64 이미지 Cloudinary 업로드 중...');
            const uploadResp = await chrome.runtime.sendMessage({
              action: 'cloudinary_upload',
              base64: sec.imageUrl,
              folder: 'map2model-products'
            });
            if (uploadResp.success) {
              imageUrls.push(uploadResp.url);
              sec.imageUrl = uploadResp.url;
            }
          } catch (e) {
            prodLog(`⚠️ Cloudinary 업로드 실패: ${e.message}`);
          }
        }
      }
      for (const img of state.extraImages) {
        if (img.startsWith('http')) {
          imageUrls.push(img);
        } else if (img.startsWith('data:')) {
          try {
            const uploadResp = await chrome.runtime.sendMessage({
              action: 'cloudinary_upload',
              base64: img,
              folder: 'map2model-products'
            });
            if (uploadResp.success) imageUrls.push(uploadResp.url);
          } catch (e) {
            // 개별 추가 이미지 실패는 전체 업로드를 중단하지 않음
          }
        }
      }

      // 캡처 이미지도 추가
      if (state.capturedImage) {
        if (state.capturedImage.startsWith('data:')) {
          try {
            const resp = await chrome.runtime.sendMessage({
              action: 'cloudinary_upload',
              base64: state.capturedImage,
              folder: 'map2model-products'
            });
            if (resp.success) imageUrls.push(resp.url);
          } catch (e) {
            // 캡처 이미지 단건 실패는 전체 업로드를 중단하지 않음
          }
        } else {
          imageUrls.push(state.capturedImage);
        }
      }

      if (imageUrls.length === 0 && state.capturedImage) {
        prodLog('⚠️ AI 이미지 없음, 캡처 이미지를 대표 이미지로 사용');
        try {
          const resp = await chrome.runtime.sendMessage({
            action: 'cloudinary_upload',
            base64: state.capturedImage,
            folder: 'map2model-products'
          });
          if (resp.success) imageUrls.push(resp.url);
        } catch (e) {
          // ignore
        }
      }

      if (imageUrls.length === 0) {
        prodLog('❌ 업로드할 이미지가 없습니다.', 'err');
        return;
      }

      // 네이버 이미지 호스팅 업로드
      prodLog(`📸 ${imageUrls.length}개 이미지 네이버 업로드 중...`);
      $('upload-bar').style.width = '20%';
      const naverImages = await api.uploadImages(imageUrls);
      prodLog(`✅ ${naverImages.length}개 이미지 준비 완료`);
      $('upload-bar').style.width = '50%';

      // 상품 데이터 구성
      const prodName = $('prod-name').value.trim() || '3D 지형 모형 액자';
      const prodDesc = $('prod-desc').value.trim();
      const sizes = getSizes();
      renderPreview();
      const detailHtml = buildDetailHtml();

      const productData = api.buildProductData({
        name: prodName,
        description: prodDesc,
        detailHtml: detailHtml,
        images: naverImages,
        sizes: sizes,
        categoryId: stored.category_id || '50000803',
        returnInfo: stored.return_info,
        tags: state.aiTags || [],
        settings: {
          outboundShippingPlaceCode: parseInt(stored.outbound_code, 10) || 100797935,
          returnAddressId: parseInt(stored.return_address_id, 10) || 100797936,
          shippingAddressId: parseInt(stored.outbound_code, 10) || 100797935,
          sellerPhone: stored.seller_phone || '010-7253-0101',
          deliveryCompany: stored.delivery_company || 'CJGLS'
        }
      });

      // 디버깅: 전송 데이터 로그
      console.log('[SmartStore] 전송 payload:', JSON.stringify(productData, null, 2));

      prodLog('📦 상품 등록 중...');
      $('upload-bar').style.width = '80%';
      const result = await api.createProduct(productData);

      $('upload-bar').style.width = '100%';
      prodLog(`✅ 상품 등록 성공! productNo: ${result.originProductNo}`, 'ok');

      // 성공 UI
      $('upload-status').style.display = 'none';
      $('upload-done').style.display = 'block';
      const productUrl = `https://smartstore.naver.com/mumuriri/products/${result.smartstoreChannelProductNo || result.originProductNo}`;
      $('product-url').href = productUrl;
      $('product-url').textContent = `스마트스토어에서 보기 → ${productUrl}`;

      // 히스토리 저장 (썸네일 포함)
      let thumb = state.aiSections?.[0]?.imageUrl || '';
      if (thumb && thumb.startsWith('data:')) {
        try {
          thumb = await createThumbnail(thumb, 128);
        } catch (e) {
          // 썸네일 리사이즈 실패 시 원본 유지
        }
      }
      saveHistory({
        name: prodName,
        region: $('prod-region').value.trim(),
        productNo: result.originProductNo,
        url: productUrl,
        date: new Date().toISOString(),
        images: naverImages.length,
        thumbnail: thumb,
        sizes: getSizes()
      });

    } catch (e) {
      prodLog(`❌ 업로드 실패: ${e.message}`, 'err');
      $('upload-msg').textContent = `실패: ${e.message}`;
    } finally {
      _uploading = false;
    }
  }

  // ========== 풀 오토 ==========
  async function doCaptureMap() {
    await doCapture();
  }

  async function doBuildAndUpload() {
    setStep(4, false);
    renderPreview();
    setStep(5, false);
    await doUpload();
  }

  async function runBatchAuto() {
    const checkedBoxes = [...document.querySelectorAll('.batch-chk:checked')];
    if (checkedBoxes.length === 0) return;

    _batchRunning = true;
    $('batch-start-btn').disabled = true;
    $('batch-progress').style.display = 'block';

    const totalCount = checkedBoxes.length;
    let doneCount = 0;
    let failCount = 0;
    const results = [];

    try {
      for (const chk of checkedBoxes) {
        const catIdx = parseInt(chk.dataset.cat, 10);
        const itemIdx = parseInt(chk.dataset.idx, 10);
        const preset = state.presets[catIdx].items[itemIdx];
        const cleanName = preset.name.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();

        doneCount++;
        const pct = Math.round((doneCount / totalCount) * 100);
        $('batch-progress-bar').style.width = `${pct}%`;
        $('batch-progress-bar').textContent = `${doneCount}/${totalCount}`;
        $('batch-status').textContent = `🚀 [${doneCount}/${totalCount}] ${cleanName} 처리 중...`;

        try {
          // === Step 1: 프리셋 선택 + 지역명 설정 ===
          state.mapTab = 'preset';
          state.selectedPreset = preset;
          updateSelInfo();
          $('prod-region').value = cleanName;

          // 사이즈 계산
          const sw = preset.bounds[0];
          const ne = preset.bounds[1];
          const calcSize = calcSizeFromBounds(sw, ne);
          $('prod-name').value = `${cleanName} 3D 지형 모형 액자 (${calcSize.label})`;

          prodLog(`\n${'═'.repeat(50)}`);
          prodLog(`🚀 [배치 ${doneCount}/${totalCount}] ${cleanName} 시작`);

          // === Step 2: 지도 전송 + map2model 탭 전환 ===
          await doMapStart();

          // === Step 3: 모델링 완료 대기 (60초) ===
          prodLog('⏳ 모델링 대기 60초...');
          for (let sec = 60; sec > 0; sec--) {
            $('batch-status').textContent = `⏳ [${doneCount}/${totalCount}] ${cleanName} — 모델링 대기 ${sec}초...`;
            await new Promise(r => setTimeout(r, 1000));
          }

          // === Step 4: 캡처 ===
          prodLog('📸 캡처 시작...');
          $('batch-status').textContent = `📸 [${doneCount}/${totalCount}] ${cleanName} — 캡처 중...`;
          await doCaptureMap();
          if (!state.capturedImage) throw new Error('캡처 실패 — capturedImage가 비어있음');

          // === Step 5: AI 생성 ===
          prodLog('🎨 AI 생성 시작...');
          $('batch-status').textContent = `🎨 [${doneCount}/${totalCount}] ${cleanName} — AI 생성 중...`;
          await doAIGenerate();

          // === Step 6: HTML 빌드 + 업로드 ===
          prodLog('📤 업로드 시작...');
          $('batch-status').textContent = `📤 [${doneCount}/${totalCount}] ${cleanName} — 업로드 중...`;
          await doBuildAndUpload();

          prodLog(`✅ [배치] ${cleanName} 완료!`, 'ok');
          results.push({ name: cleanName, status: 'success' });
          chk.parentElement.style.background = '#166534';
          chk.parentElement.style.color = '#4ade80';
        } catch (e) {
          failCount++;
          prodLog(`❌ [배치] ${cleanName} 실패: ${e.message}`, 'err');
          results.push({ name: cleanName, status: 'fail', error: e.message });
          chk.parentElement.style.background = '#7f1d1d';
          chk.parentElement.style.color = '#f87171';
        }

        if (doneCount < totalCount) {
          $('batch-status').textContent = '⏸️ 다음 항목 준비 중 (5초)...';
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      $('batch-progress-bar').style.width = '100%';
      $('batch-progress-bar').textContent = '완료!';
      $('batch-status').textContent = `🎉 배치 완료! 성공 ${totalCount - failCount}개 / 실패 ${failCount}개`;
      $('batch-start-btn').textContent = '🚀 다시 실행';
      $('batch-start-btn').disabled = false;

      prodLog(`\n${'═'.repeat(50)}`);
      prodLog('🎉 배치 자동등록 완료!');
      prodLog(`   성공: ${totalCount - failCount}개`);
      prodLog(`   실패: ${failCount}개`);
      results.forEach(r => {
        prodLog(`   ${r.status === 'success' ? '✅' : '❌'} ${r.name}${r.error ? `: ${r.error}` : ''}`);
      });
    } finally {
      _batchRunning = false;
      updateBatchCount();
    }
  }

  async function doFullAuto() {
    const skip1 = !$('chk-step1').checked;
    const skip2 = !$('chk-step2').checked;
    const skip3 = !$('chk-step3').checked;
    const skip4 = !$('chk-step4').checked;
    const skip5 = !$('chk-step5').checked;

    prodLog('⚡ 원클릭 자동 등록 시작!');

    // Step 1: 캡처
    setStep(1);
    await doCapture();
    if (!state.capturedImage) {
      prodLog('❌ 캡처 실패 — 중단', 'err');
      return;
    }
    if (!skip1) {
      prodLog('⏸️ Step 1 확인 대기... (확인 버튼 클릭)');
      await waitForClick('capture-confirm');
    }

    // Step 2: 상품 정보
    setStep(2);
    // 자동 입력 — 사이즈 포함
    if (!$('prod-name').value.trim() || !$('prod-name').value.includes('mm')) {
      const region = $('prod-region').value || '지역';
      const sizes = getSizes();
      const sizeStr = sizes.length > 0 ? `${sizes[0].width}×${sizes[0].height}mm` : '250×174mm';
      const baseName = `${region} 3D 지형 모형 액자`;
      $('prod-name').value = `${baseName} (${sizeStr})`;
    }
    if (!skip2) {
      prodLog('⏸️ Step 2 확인 대기... (다음 단계 버튼 클릭)');
      await waitForClick('step2-next');
    }

    // Step 3: AI 생성
    setStep(3);
    // doAIGenerate는 setStep(3)에서 자동 호출됨
    await waitForAIComplete();
    if (!skip3) {
      prodLog('⏸️ Step 3 확인 대기... (확인 버튼 클릭)');
      await waitForClick('ai-confirm-btn');
    }

    // Step 4: 미리보기
    setStep(4);
    renderPreview();
    if (!skip4) {
      prodLog('⏸️ Step 4 확인 대기... (업로드 진행 버튼 클릭)');
      await waitForClick('preview-confirm');
    }

    // Step 5: 업로드
    setStep(5, false);
    await doUpload();

    prodLog('🏁 풀 오토 프로세스 완료!', 'ok');
  }

  function waitForClick(btnId) {
    return new Promise(resolve => {
      const handler = () => {
        $(btnId).removeEventListener('click', handler);
        resolve();
      };
      $(btnId).addEventListener('click', handler);
    });
  }

  function waitForAIComplete() {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if ($('ai-gen-result').style.display !== 'none') {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }

  // ========== 히스토리 ==========
  function loadHistory() {
    try {
      const saved = localStorage.getItem('m2m_history');
      if (saved) state.history = JSON.parse(saved);
      renderHistory();
    } catch (e) { /* ignore */ }
  }

  function saveToHistory(item) {
    state.history.unshift(item);
    if (state.history.length > 50) state.history = state.history.slice(0, 50);
    try { localStorage.setItem('m2m_history', JSON.stringify(state.history)); } catch (e) { /* ignore */ }
    renderHistory();
  }

  function createThumbnail(dataUrl, maxSize = 128) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = maxSize / Math.max(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = dataUrl;
    });
  }

  function renderHistory() {
    if (state.history.length === 0) {
      $('history-grid').innerHTML = '<p class="empty-state">아직 생성된 상품이 없습니다</p>';
      return;
    }
    $('history-grid').innerHTML = state.history.map((item, i) => `
      <div class="history-card" data-index="${i}">
        ${item.thumbnail
          ? `<img src="${item.thumbnail}" alt="${item.name}" style="height:160px;object-fit:cover;width:100%">`
          : `<div style="height:160px;background:#1e293b;display:flex;align-items:center;justify-content:center;color:#64748b">🗺️</div>`}
        <div class="history-card-body">
          <h4>${item.name || '제목 없음'}</h4>
          <p>${item.region || ''} · ${new Date(item.date).toLocaleDateString('ko-KR')}</p>
          ${item.url ? `<a href="${item.url}" target="_blank" style="color:#3b82f6;font-size:12px;">스마트스토어에서 보기</a>` : ''}
        </div>
        <button class="hist-delete-btn" data-index="${i}" title="삭제" style="position:absolute;top:8px;right:8px;background:rgba(239,68,68,0.8);color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:none;">✕</button>
      </div>
    `).join('');

    document.querySelectorAll('.history-card').forEach(card => {
      const delBtn = card.querySelector('.hist-delete-btn');
      card.style.position = 'relative';
      card.style.cursor = 'pointer';
      card.addEventListener('mouseenter', () => { delBtn.style.display = 'block'; });
      card.addEventListener('mouseleave', () => { delBtn.style.display = 'none'; });

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('hist-delete-btn')) return;
        const idx = parseInt(card.dataset.index, 10);
        const item = state.history[idx];
        if (item?.url) window.open(item.url, '_blank');
      });

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(delBtn.dataset.index, 10);
        if (confirm(`"${state.history[idx]?.name}" 히스토리를 삭제하시겠습니까?`)) {
          state.history.splice(idx, 1);
          try { localStorage.setItem('m2m_history', JSON.stringify(state.history)); } catch (err) {}
          renderHistory();
        }
      });
    });
  }

  // ========== 설정 ==========
  function setupSettingsPage() {
    $('save-all-settings').addEventListener('click', async () => {
      await chrome.storage.local.set({
        gimi9_token: $('set-gimi9').value.trim(),
        apiyi_key: $('set-apiyi').value.trim(),
        ecco_api_key: $('set-eccoapi').value.trim(),
        naver_client_id: $('set-naver-id').value.trim(),
        naver_client_secret: $('set-naver-secret').value.trim(),
        category_id: $('set-category-id').value.trim(),
        return_info: $('set-return-info').value.trim(),
        outbound_code: $('set-outbound-code').value.trim(),
        return_address_id: $('set-return-address-id').value.trim(),
        delivery_company: $('set-delivery-company').value,
        seller_phone: $('set-seller-phone').value.trim()
      });
      // localStorage에도 APIYI 키 저장 (panel.js 호환)
      localStorage.setItem('nanoBananaApiKey', $('set-apiyi').value.trim());

      $('settings-saved').style.display = 'block';
      setTimeout(() => { $('settings-saved').style.display = 'none'; }, 3000);
      prodLog('💾 전체 설정 저장 완료', 'ok');
    });
  }

  // ========== APIYI 텍스트 호출 ==========
  async function callAPIYI(apiKey, prompt) {
    const resp = await chrome.runtime.sendMessage({
      action: 'apiyi_text',
      prompt: prompt,
      apiKey: apiKey,
      maxTokens: 8192
    });
    if (!resp.success) throw new Error(resp.error);
    return resp.text;
  }

  // ========== 네이버 연관검색어 수집 ==========
  async function fetchNaverKeywords(regionName) {
    const keywords = [];
    const parts = regionName.split(/[\/,+&]/).map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      try {
        const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(part)}`;
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('.related_srch .tit').forEach(el => {
          const t = el.textContent.trim();
          if (t && t.length >= 3) keywords.push(t);
        });
      } catch (e) {
        console.log(`[키워드] ${part} 수집 실패:`, e.message);
      }
    }
    return [...new Set(keywords)];
  }

  // ========== 유틸리티 ==========
  function parseWKT(wkt) {
    const match = wkt.match(/\(\(([^)]+)\)\)/);
    if (!match) return [];
    return match[1].split(',').map(pair => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lat, lng];
    });
  }

  function toBBox(coords) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of coords) {
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    }
    return [[minLat,minLng],[maxLat,minLng],[maxLat,maxLng],[minLat,maxLng],[minLat,minLng]];
  }

  function mapLog(msg, type = '') {
    appendLog('map-log', msg, type);
  }

  function prodLog(msg, type = '') {
    appendLog('prod-log', msg, type);
  }

  function appendLog(elId, msg, type) {
    const el = $(elId);
    if (!el) return;
    const d = document.createElement('div');
    const time = new Date().toLocaleTimeString('ko-KR');
    d.innerHTML = `<span class="log-time">${time}</span> <span class="log-${type || ''}">${msg}</span>`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
    console.log(`[Dashboard] ${msg}`);
  }

  // ── 시작 ──
  init();

})();
