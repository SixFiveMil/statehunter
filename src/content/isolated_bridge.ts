(function initIsolatedBridge() {
  // Prevent double injection
  if ((window as any).__STATEHUNTER_BRIDGE_INITIALIZED__) return;
  (window as any).__STATEHUNTER_BRIDGE_INITIALIZED__ = true;

  const SECURE_TELEMETRY_EVENT = '__STATEHUNTER_SECURE_TELEMETRY__';
  const SECURE_CONTROL_EVENT = '__STATEHUNTER_SECURE_CONTROL__';

  // 1. Listen for secure telemetry from MAIN world probe
  document.addEventListener(SECURE_TELEMETRY_EVENT, ((event: CustomEvent) => {
    if (!event.detail) return;
    const { type, payload } = event.detail;

    try {
      chrome.runtime.sendMessage({
        type: 'STATEHUNTER_TELEMETRY',
        telemetryType: type,
        data: payload,
        url: window.location.href,
        title: document.title
      });
    } catch (err) {
      console.debug('[StateHunter Bridge] Failed to send message to background:', err);
    }
  }) as EventListener);

  // 2. Listen for control messages from background/DevTools to trigger actions in MAIN probe
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'TRIGGER_RESCAN') {
      document.dispatchEvent(new CustomEvent(SECURE_CONTROL_EVENT, {
        detail: { action: 'TRIGGER_RESCAN' }
      }));
      sendResponse({ status: 'rescan_triggered' });
    } else if (message && message.type === 'DISPATCH_POST_MESSAGE') {
      document.dispatchEvent(new CustomEvent(SECURE_CONTROL_EVENT, {
        detail: {
          action: 'DISPATCH_POST_MESSAGE',
          params: message.params
        }
      }));
      sendResponse({ status: 'dispatched' });
    }
  });
})();


