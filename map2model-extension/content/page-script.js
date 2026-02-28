// ========================================
// content/page-script.js — v10.0
// Leaflet 맵 위에서 폴리곤 자동 그리기
// ========================================

(function() {
  if (window.__m2m_initialized) return;
  window.__m2m_initialized = true;

  function captureMap() {
    if (window.__m2m_map) return Promise.resolve(window.__m2m_map);
    return new Promise((resolve) => {
      const orig = L.Map.prototype.invalidateSize;
      L.Map.prototype.invalidateSize = function() {
        if (!window.__m2m_map) {
          window.__m2m_map = this;
          console.log('[M2M] map 캡처 성공!');
        }
        return orig.apply(this, arguments);
      };
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => {
        L.Map.prototype.invalidateSize = orig;
        resolve(window.__m2m_map || null);
      }, 500);
    });
  }

  function findButton(text) {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim() === text) return b;
    }
    return null;
  }

  function simulateMapClick(map, lat, lng) {
    const pt = map.latLngToContainerPoint([lat, lng]);
    const mapEl = map.getContainer();
    const rect = mapEl.getBoundingClientRect();
    const clientX = rect.left + pt.x;
    const clientY = rect.top + pt.y;
    const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, button: 0 };
    mapEl.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
    mapEl.dispatchEvent(new MouseEvent('mousedown', opts));
    mapEl.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse' }));
    mapEl.dispatchEvent(new MouseEvent('mouseup', opts));
    mapEl.dispatchEvent(new MouseEvent('click', opts));
  }

  window.addEventListener('message', async (e) => {
    if (e.data?.type !== 'M2M_DRAW_POLYGON') return;

    const coords = e.data.coords;
    const name = e.data.name || '지역';
    const autoMesh = e.data.autoMesh || false;

    try {
      sendStatus(`🎯 ${name} 폴리곤 그리기 시작 (${coords.length}개 꼭짓점)`);

      let map = window.__m2m_map;
      if (!map) { await captureMap(); map = window.__m2m_map; }
      if (!map) throw new Error('지도를 찾을 수 없습니다. 지도를 드래그 후 재시도.');

      const clearBtn = findButton('Clear Shape');
      if (clearBtn) { clearBtn.click(); await sleep(500); sendStatus('🧹 기존 도형 초기화'); }

      let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999;
      coords.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [80, 80] });
      await sleep(1000);
      sendStatus('✅ 지도 이동 완료');

      const polygonBtn = findButton('Polygon');
      if (!polygonBtn) throw new Error('Polygon 버튼을 찾을 수 없습니다');
      polygonBtn.click();
      await sleep(800);
      sendStatus('✅ Polygon 그리기 모드 활성화');

      let clickCoords = coords;
      const first = coords[0], last = coords[coords.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        clickCoords = coords.slice(0, -1);
      }

      for (let i = 0; i < clickCoords.length; i++) {
        simulateMapClick(map, clickCoords[i][0], clickCoords[i][1]);
        await sleep(100);
        if (i % 10 === 0 || i === clickCoords.length - 1) {
          sendStatus(`📍 꼭짓점 ${i + 1}/${clickCoords.length} 클릭 중...`);
        }
      }
      sendStatus(`✅ ${clickCoords.length}개 꼭짓점 클릭 완료`);

      await sleep(500);
      const finishLink = document.querySelector('a.leaflet-pm-action.action-finish');
      if (finishLink) {
        finishLink.click();
        sendStatus('✅ Finish → 폴리곤 확정!');
      } else {
        sendStatus('⏳ Finish 없음 → 첫 점 재클릭...');
        simulateMapClick(map, clickCoords[0][0], clickCoords[0][1]);
        await sleep(300);
        simulateMapClick(map, clickCoords[0][0], clickCoords[0][1]);
        await sleep(500);
        const retry = document.querySelector('a.leaflet-pm-action.action-finish');
        if (retry) { retry.click(); sendStatus('✅ Finish 클릭 완료!'); }
        else { sendStatus('⚠️ 수동으로 Finish를 클릭하세요.'); }
      }

      await sleep(1500);
      if (autoMesh) {
        sendStatus('⚙️ 자동 메쉬 생성 시도...');
        await sleep(500);
        let clicked = false;
        for (const b of document.querySelectorAll('button')) {
          if (b.textContent.includes('Generate Mesh') && !b.disabled) {
            b.click(); clicked = true; break;
          }
        }
        sendStatus(clicked ? '🎉 Generate Mesh 클릭! 메쉬 생성 중...' : '⚠️ Generate Mesh 비활성. 수동 클릭 필요.', true);
      } else {
        sendStatus('✅ 완료! Generate Mesh 버튼을 클릭하세요.', true);
      }
    } catch (err) {
      sendStatus(`❌ 오류: ${err.message}`, true);
    }
  });

  captureMap();

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function sendStatus(message, done = false) {
    window.postMessage({ type: 'M2M_STATUS', message, done }, '*');
    console.log('[M2M]', message);
  }
})();
