// ========================================
// background/service-worker.js — v10.1
// 대시보드 탭 관리 + API 프록시
// ========================================

// ── 확장 아이콘 클릭 ──
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes('map2model.com')) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content-script.js']
      });
    } catch (e) { /* already injected */ }
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' }).catch(() => {});
    return;
  }
  const dashUrl = chrome.runtime.getURL('dashboard/dashboard.html');
  const existing = await chrome.tabs.query({ url: dashUrl });
  if (existing.length > 0) {
    chrome.tabs.update(existing[0].id, { active: true });
  } else {
    chrome.tabs.create({ url: dashUrl });
  }
});

// ── 탭 로드 대기 헬퍼 ──
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── content script 주입 + 준비 대기 ──
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content-script.js']
    });
  } catch (e) { /* already injected */ }
  // page-script.js 주입 + Leaflet 캡처 대기
  await new Promise(r => setTimeout(r, 3000));
}

// ── 안전한 메시지 전송 (재시도 포함) ──
async function safeSendMessage(tabId, message, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await chrome.tabs.sendMessage(tabId, message);
      return resp;
    } catch (e) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw e;
      }
    }
  }
}

// ── 메시지 핸들러 ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // gimi9 지역 경계 조회
  if (msg.action === 'gimi9_region') {
    fetchGimi9Region(msg.type || 'hd', msg.code, msg.token)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // map2model 탭에 폴리곤 전송
  if (msg.action === 'sendPolygonToMap') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: 'https://map2model.com/*' });

        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          // 탭이 이미 있으면 content script 확인 후 전송
          await ensureContentScript(tabId);
          await safeSendMessage(tabId, {
            action: 'injectAndDraw',
            coords: msg.coords,
            name: msg.name,
            autoMesh: msg.autoMesh,
            isRect: msg.isRect
          });
          sendResponse({ success: true });
        } else {
          // map2model.com 새 탭 열기
          const newTab = await chrome.tabs.create({ url: 'https://map2model.com' });
          // 로드 완료 대기
          await waitForTabLoad(newTab.id);
          // content script 주입 + 준비 대기
          await ensureContentScript(newTab.id);
          // 폴리곤 전송
          await safeSendMessage(newTab.id, {
            action: 'injectAndDraw',
            coords: msg.coords,
            name: msg.name,
            autoMesh: msg.autoMesh,
            isRect: msg.isRect
          });
          sendResponse({ success: true, opened: true });
        }
      } catch (e) {
        console.error('[SW] sendPolygonToMap error:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // map2model 스크린샷 캡처 (모델링 영역만)
  if (msg.action === 'captureMap') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: 'https://map2model.com/*' });
        if (tabs.length === 0) {
          sendResponse({ success: false, error: 'map2model.com 탭이 없습니다. 먼저 맵 생성을 실행하세요.' });
          return;
        }
        const tabId = tabs[0].id;

        // 1) 탭 활성화
        await chrome.tabs.update(tabId, { active: true });
        await new Promise(r => setTimeout(r, 800));

        // 2) 전체 화면 캡처
        const dataUrl = await new Promise((resolve, reject) => {
          chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (result) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(result);
          });
        });

        // 3) map2model의 맵 영역 좌표를 content script에서 가져오기
        let cropRect = null;
        try {
          const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              // 맵 프리뷰 캔버스 또는 컨테이너 찾기
              const selectors = [
                'canvas',
                '.mapPreview',
                '[class*="preview"]',
                '[class*="canvas"]',
                '.leaflet-container',
                '#map'
              ];

              let el = null;
              // 가장 큰 canvas 찾기
              const canvases = document.querySelectorAll('canvas');
              if (canvases.length > 0) {
                let maxArea = 0;
                canvases.forEach(c => {
                  const rect = c.getBoundingClientRect();
                  const area = rect.width * rect.height;
                  if (area > maxArea && rect.width > 200 && rect.height > 200) {
                    maxArea = area;
                    el = c;
                  }
                });
              }

              // canvas 못 찾으면 다른 셀렉터 시도
              if (!el) {
                for (const sel of selectors) {
                  const found = document.querySelector(sel);
                  if (found) {
                    const rect = found.getBoundingClientRect();
                    if (rect.width > 200 && rect.height > 200) {
                      el = found;
                      break;
                    }
                  }
                }
              }

              if (!el) return null;

              const rect = el.getBoundingClientRect();
              return {
                x: Math.round(rect.left * window.devicePixelRatio),
                y: Math.round(rect.top * window.devicePixelRatio),
                w: Math.round(rect.width * window.devicePixelRatio),
                h: Math.round(rect.height * window.devicePixelRatio)
              };
            }
          });
          cropRect = result?.result || null;
        } catch (e) {
          console.warn('[SW] 영역 감지 실패, 전체 이미지 사용:', e);
        }

        // 4) 크롭이 필요하면 OffscreenCanvas로 자르기
        if (cropRect && cropRect.w > 0 && cropRect.h > 0) {
          const resp = await fetch(dataUrl);
          const blob = await resp.blob();
          const bmp = await createImageBitmap(blob);

          // 범위 보정
          const cx = Math.max(0, Math.min(cropRect.x, bmp.width - 1));
          const cy = Math.max(0, Math.min(cropRect.y, bmp.height - 1));
          const cw = Math.min(cropRect.w, bmp.width - cx);
          const ch = Math.min(cropRect.h, bmp.height - cy);

          const canvas = new OffscreenCanvas(cw, ch);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bmp, cx, cy, cw, ch, 0, 0, cw, ch);
          bmp.close();

          const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
          const arrayBuf = await croppedBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const croppedDataUrl = 'data:image/png;base64,' + btoa(binary);

          sendResponse({ success: true, dataUrl: croppedDataUrl });
        } else {
          // 크롭 실패 시 전체 이미지 반환
          sendResponse({ success: true, dataUrl });
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // APIYI 텍스트 생성 프록시 (Nano Banana 2)
  if (msg.action === 'apiyi_text') {
    fetchApiyiText(msg.prompt, msg.apiKey, msg.maxTokens)
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // APIYI 이미지 생성 프록시 (Nano Banana 2)
  if (msg.action === 'apiyi_image') {
    fetchApiyiImage(msg.prompt, msg.apiKey, msg.referenceImages, msg.aspectRatio)
      .then(imageData => sendResponse({ success: true, imageData }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Cloudinary 업로드
  if (msg.action === 'cloudinary_upload') {
    uploadToCloudinary(msg.base64, msg.folder)
      .then(url => sendResponse({ success: true, url }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 네이버 커머스 API 토큰 발급
  if (msg.action === 'naver_token') {
    fetchNaverToken(msg.clientId, msg.clientSecret)
      .then(token => sendResponse({ success: true, token }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 네이버 이미지 업로드
  if (msg.action === 'naver_upload_image') {
    uploadNaverImage(msg.token, msg.imageUrl)
      .then(url => sendResponse({ success: true, url }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 네이버 상품 등록
  if (msg.action === 'naver_create_product') {
    createNaverProduct(msg.token, msg.productData)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

});

// ========== API 함수들 ==========

async function fetchGimi9Region(type, code, token) {
  const url = `https://geocode-api.gimi9.com/region?type=${type}&code=${code}&token=${token}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function fetchApiyiText(prompt, apiKey, maxTokens = 8192) {
  // Nano Banana 2 텍스트 생성 (gemini-2.5-flash via APIYI)
  const url = 'https://vip.apiyi.com/v1beta/models/gemini-2.5-flash:generateContent';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
    }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function fetchApiyiImage(prompt, apiKey, referenceImages = [], aspectRatio = '9:16') {
  // Nano Banana 일반 — $0.02/장
  const url = 'https://api.apiyi.com/v1beta/models/gemini-2.5-flash-image:generateContent';
  const parts = [];

  // 참조 이미지 (최대 3장) — snake_case 사용
  const maxRef = Math.min(referenceImages.length, 3);
  for (let i = 0; i < maxRef; i++) {
    const img = referenceImages[i];
    if (img.startsWith('data:')) {
      const match = img.match(/^data:image\/([a-z+]+);base64,(.+)$/);
      if (match) {
        parts.push({ inline_data: { mime_type: `image/${match[1]}`, data: match[2] } });
      }
    }
  }
  parts.push({ text: prompt });

  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: '2K'
      }
    }
  });

  // 최대 3회 재시도, 타임아웃 90초
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 90000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.status === 429) {
        const waitSec = 10 * attempt;
        console.warn(`[SW] 이미지 생성 429 Rate Limit, ${waitSec}초 대기 (${attempt}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const errMsg = err.error?.message || `HTTP ${resp.status}`;
        if (attempt < MAX_RETRIES && resp.status >= 500) {
          console.warn(`[SW] ${resp.status}, 재시도 ${attempt}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, 5000 * attempt));
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await resp.json();
      const contentParts = data.candidates?.[0]?.content?.parts || [];
      for (const part of contentParts) {
        const inlineData = part.inlineData || part.inline_data;
        if (inlineData?.data) {
          const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
          return `data:${mimeType};base64,${inlineData.data}`;
        }
      }
      throw new Error('이미지 생성 응답에 이미지 데이터 없음');
    } catch (e) {
      if (e.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          console.warn(`[SW] 타임아웃, 재시도 ${attempt}/${MAX_RETRIES}`);
          continue;
        }
        throw new Error(`이미지 생성 타임아웃 (${TIMEOUT_MS / 1000}초 × ${MAX_RETRIES}회)`);
      }
      if (attempt >= MAX_RETRIES) throw e;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}

async function uploadToCloudinary(base64Image, folder = 'map2model') {
  if (base64Image.startsWith('http')) return base64Image;
  const CLOUD_NAME = 'dy1q51asy';
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const byteChars = atob(base64Data);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  const mimeType = base64Image.match(/data:image\/(\w+);base64/)?.[1] || 'jpeg';
  const blob = new Blob([byteArr], { type: `image/${mimeType}` });

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', 'ai_detail_page');
  formData.append('folder', folder);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  });
  if (!resp.ok) throw new Error('Cloudinary 업로드 실패');
  const data = await resp.json();
  return data.secure_url;
}

async function fetchNaverToken(clientId, clientSecret) {
  throw new Error('네이버 토큰 발급은 프록시 서버가 필요합니다. 설정에서 프록시 URL을 입력하세요.');
}

async function uploadNaverImage(token, imageUrl) {
  const resp = await fetch(imageUrl);
  const blob = await resp.blob();
  const formData = new FormData();
  formData.append('imageFiles', blob, 'product.jpg');

  const uploadResp = await fetch('https://api.commerce.naver.com/external/v1/product-images/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  if (!uploadResp.ok) throw new Error(`이미지 업로드 실패: ${uploadResp.status}`);
  const data = await uploadResp.json();
  return data.images?.[0]?.url || '';
}

async function createNaverProduct(token, productData) {
  const resp = await fetch('https://api.commerce.naver.com/external/v2/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(productData)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}
