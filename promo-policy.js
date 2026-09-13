(() => {
  'use strict';

  const PROMO_ENDPOINT = './api/promo';
  const MASTER_KEY = 'copeMasterAccess_v1';
  const AI_ACCESS_KEY = 'copeAIAccess';
  const AI_EXPIRES_KEY = 'copeAIAccessExpiresAt_v1';

  function setMessage(text, ok) {
    const msg = document.getElementById('promoMsg');
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? 'var(--green)' : 'var(--red)';
  }

  function setMasterAccess() {
    localStorage.setItem(MASTER_KEY, 'true');
    localStorage.setItem('copeAccess', 'true');
    localStorage.setItem(AI_ACCESS_KEY, 'true');
    localStorage.removeItem(AI_EXPIRES_KEY);
    localStorage.removeItem('copePromoAccess_v1');
    localStorage.removeItem('copePromoExpiresAt_v1');
  }

  function setAIAccess(expiresAt) {
    const expires = Number(expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) return false;
    localStorage.setItem(AI_ACCESS_KEY, 'true');
    localStorage.setItem(AI_EXPIRES_KEY, String(expires));
    return true;
  }

  window.applyPromo = async function () {
    const input = document.getElementById('promoInput');
    const button = document.getElementById('codeApplyBtn');
    const code = input ? input.value.trim() : '';
    if (!code) {
      setMessage('Enter your promo code.', false);
      return;
    }

    if (button) button.disabled = true;
    setMessage('Checking code…', true);

    try {
      const deviceId = typeof window.copeGetDeviceId === 'function' ? window.copeGetDeviceId() : '';
      const response = await fetch(PROMO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code, deviceId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);

      if (data.scope === 'master') {
        setMasterAccess();
        if (typeof window.copeSetMasterAccess === 'function') window.copeSetMasterAccess(true);
        setMessage('Master access activated. Cope is fully unlocked. ✦', true);
      } else if (data.scope === 'ai') {
        if (!setAIAccess(data.expiresAt)) throw new Error('The CopeAI access window is invalid.');
        if (typeof window.copeSetAIAccess === 'function') window.copeSetAIAccess(data.expiresAt);
        setMessage('CopeAI 3-day access is active. ✦', true);
      } else {
        throw new Error('That promo code is not valid.');
      }

      setTimeout(() => {
        if (typeof window.closePaywall === 'function') window.closePaywall();
        if (typeof window.renderHome === 'function') window.renderHome();
      }, 700);
    } catch (error) {
      console.error('Cope promo error:', error);
      setMessage(error.message || 'That promo code could not be applied.', false);
      if (button) button.disabled = false;
    }
  };

  function init() {
    const row = document.getElementById('confirmRow');
    if (row) row.style.display = '';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
