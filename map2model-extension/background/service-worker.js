// ========================================
// background/service-worker.js — v10.0
// 대시보드 탭 관리 + API 프록시
// ========================================

// ── 확장 아이콘 클릭 ──
chrome.action.onClicked.addListener(async (tab) => {
  // map2model.com에 있으면 → 기존 패널 토글
  if (tab.url && tab.url.includes('map2model.com')) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content-script.js']
      });
    } catch (e) { /* already injected */ }
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
    return;
  }

  // 그 외 → 대시보드 열기
  const dashUrl = chrome.runtime.getURL('dashboard/dashboard.html');
  const existing = await chrome.tabs.query({ url: dashUrl });
  if (existing.length > 0) {
    chrome.tabs.update(existing[0].id, { active: true });
  } else {
    chrome.tabs.create({ url: dashUrl });
  }
});

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
    chrome.tabs.query({ url: 'https://map2model.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'injectAndDraw',
          coords: msg.coords,
          name: msg.name,
          autoMesh: msg.autoMesh,
          isRect: msg.isRect
        });
        sendResponse({ success: true });
      } else {
        // map2model.com 새 탭 열기
        chrome.tabs.create({ url: 'https://map2model.com' }, (newTab) => {
          // 로드 완료 후 전송
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === newTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                chrome.scripting.executeScript({
                  target: { tabId: newTab.id },
                  files: ['content/content-script.js']
                }).then(() => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(newTab.id, {
                      action: 'injectAndDraw',
                      coords: msg.coords,
                      name: msg.name,
                      autoMesh: msg.autoMesh,
                      isRect: msg.isRect
                    });
                  }, 2000);
                });
              }, 1000);
            }
          });
          sendResponse({ success: true, opened: true });
        });
      }
    });
    return true;
  }

  // map2model 스크린샷 캡처
  if (msg.action === 'captureMap') {
    chrome.tabs.query({ url: 'https://map2model.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true, dataUrl });
          }
        });
      } else {
        sendResponse({ success: false, error: 'map2model.com 탭이 없습니다' });
      }
    });
    return true;
  }

  // APIYI 텍스트 생성 프록시
  if (msg.action === 'apiyi_text') {
    fetchApiyiText(msg.prompt, msg.apiKey, msg.maxTokens)
      .then(text => sendResponse({ success: true, text }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // APIYI 이미지 생성 프록시
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
  const url = 'https://vip.apiyi.com/v1beta/models/gemini-2.5-flash:generateContent';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function fetchApiyiImage(prompt, apiKey, referenceImages = [], aspectRatio = '9:16') {
  const url = 'https://api.apiyi.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';
  const parts = [];

  for (let i = 0; i < Math.min(referenceImages.length, 2); i++) {
    const img = referenceImages[i];
    if (img.startsWith('data:')) {
      const match = img.match(/^data:image\/([a-z+]+);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } });
      }
    }
  }
  parts.push({ text: prompt });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '4K'
        }
      }
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
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
  const timestamp = Date.now();
  // bcrypt 서명은 서버사이드에서 해야 하므로, 여기서는 간단한 HMAC 방식 사용
  // 실제로는 bcrypt가 필요 — Cloudflare Worker 프록시 권장
  const password = `${clientId}_${timestamp}`;
  // Service Worker에서 bcrypt를 직접 실행할 수 없으므로
  // client_secret_sign을 외부에서 받아야 합니다
  throw new Error('네이버 토큰 발급은 프록시 서버가 필요합니다. 설정에서 프록시 URL을 입력하세요.');
}

async function uploadNaverImage(token, imageUrl) {
  // 네이버 상품 이미지 업로드 API
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
