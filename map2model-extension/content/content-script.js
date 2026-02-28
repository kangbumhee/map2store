// ========================================
// content/content-script.js — v10.0
// map2model.com 전용 패널 + 폴리곤 중계
// ========================================

if (window.__m2m_content_loaded) {
  if (typeof window.__m2m_toggle === 'function') window.__m2m_toggle();
} else {
  window.__m2m_content_loaded = true;

  // page-script 주입
  if (!document.getElementById('m2m-page-script')) {
    const s = document.createElement('script');
    s.id = 'm2m-page-script';
    s.src = chrome.runtime.getURL('content/page-script.js');
    document.documentElement.appendChild(s);
  }

  let panelFrame = null;

  function createPanel() {
    if (panelFrame) return;
    const wrap = document.createElement('div');
    wrap.id = 'm2m-panel-wrap';
    wrap.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;display:flex;flex-direction:column;align-items:flex-end;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'width:28px;height:28px;border:none;border-radius:50%;background:#ef4444;color:white;font-size:16px;font-weight:bold;cursor:pointer;margin-bottom:4px;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;line-height:1;';
    closeBtn.addEventListener('click', togglePanel);
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#dc2626');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = '#ef4444');

    const frame = document.createElement('iframe');
    frame.id = 'm2m-panel-frame';
    frame.src = chrome.runtime.getURL('panel/panel.html');
    frame.style.cssText = 'width:380px;height:620px;border:2px solid #0ea5e9;border-radius:12px;background:#1e293b;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

    wrap.appendChild(closeBtn);
    wrap.appendChild(frame);
    document.body.appendChild(wrap);
    panelFrame = wrap;
  }

  function togglePanel() {
    if (panelFrame) { panelFrame.remove(); panelFrame = null; }
    else { createPanel(); }
  }

  window.__m2m_toggle = togglePanel;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'togglePanel') togglePanel();
    if (msg.action === 'injectAndDraw') {
      // 대시보드에서 직접 폴리곤 전송된 경우
      window.postMessage({
        type: 'M2M_DRAW_POLYGON',
        coords: msg.coords,
        name: msg.name,
        autoMesh: msg.autoMesh || false,
        isRect: msg.isRect || false
      }, '*');
    }
  });

  // 패널 iframe ↔ page-script 메시지 중계
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'M2M_DRAW_POLYGON' && e.source !== window) {
      // iframe에서 온 메시지를 page-script에 전달
      window.postMessage({
        type: 'M2M_DRAW_POLYGON',
        coords: e.data.coords,
        name: e.data.name,
        autoMesh: e.data.autoMesh || false,
        isRect: e.data.isRect || false
      }, '*');
    }
    if (e.data?.type === 'M2M_STATUS') {
      const frame = document.querySelector('#m2m-panel-frame');
      if (frame) {
        frame.contentWindow.postMessage({
          type: 'statusUpdate',
          message: e.data.message,
          done: e.data.done
        }, '*');
      }
    }
  });

  createPanel();
}
