(() => {
  'use strict';

  const DEVICE_KEY = 'copePromoDeviceId_v1';
  const ACCESS_KEY = 'copePromoAccess_v1';
  const EXPIRES_KEY = 'copePromoExpiresAt_v1';
  const MASTER_KEY = 'copeMasterAccess_v1';
  const AI_ACCESS_KEY = 'copeAIAccess';
  const AI_EXPIRES_KEY = 'copeAIAccessExpiresAt_v1';
  const CAPTURED_KEY = 'copeLeadCaptured_v3';

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'cope-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function isMasterActive() {
    return localStorage.getItem(MASTER_KEY) === 'true';
  }

  function isLocallyActive() {
    if (isMasterActive()) return true;
    const active = localStorage.getItem(ACCESS_KEY) === 'true';
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0);
    return active && expiresAt > Date.now();
  }

  function isLocalAIAccessActive() {
    if (isMasterActive()) return true;
    const active = localStorage.getItem(AI_ACCESS_KEY) === 'true';
    const expiresAt = Number(localStorage.getItem(AI_EXPIRES_KEY) || 0);
    return active && expiresAt > Date.now();
  }

  function setAccess(expiresAt) {
    if (isMasterActive()) return true;
    const expires = new Date(expiresAt).getTime();
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(EXPIRES_KEY);
      localStorage.removeItem('copeAccess');
      return false;
    }
    localStorage.setItem(ACCESS_KEY, 'true');
    localStorage.setItem(EXPIRES_KEY, String(expires));
    localStorage.setItem('copeAccess', 'true');
    return true;
  }

  function setAIAccess(expiresAt) {
    if (isMasterActive()) return true;
    const expires = new Date(expiresAt).getTime();
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      localStorage.removeItem(AI_ACCESS_KEY);
      localStorage.removeItem(AI_EXPIRES_KEY);
      return false;
    }
    localStorage.setItem(AI_ACCESS_KEY, 'true');
    localStorage.setItem(AI_EXPIRES_KEY, String(expires));
    return true;
  }

  function injectTalkContrast() {
    // Talk styling is controlled by the normal navigation styling. Do not force a highlighted state here.
  }

  function syncLocks(active) {
    document.querySelectorAll('.quick-card').forEach(card => {
      card.classList.toggle('locked', !active);
    });
    const talkLock = document.getElementById('talkNavLock');
    if (talkLock) talkLock.style.display = active ? 'none' : '';
  }

  function notifyAccessChanged() {
    window.dispatchEvent(new CustomEvent('copeaccesschange', {
      detail: {
        active: isLocallyActive(),
        aiActive: isLocalAIAccessActive(),
        master: isMasterActive(),
        expiresAt: localStorage.getItem(EXPIRES_KEY) || null,
        aiExpiresAt: localStorage.getItem(AI_EXPIRES_KEY) || null
      }
    }));
  }

  window.copeGetDeviceId = getDeviceId;
  window.copeHasPromoAccess = isLocallyActive;
  window.copeSetPromoAccess = function (expiresAt) {
    const active = setAccess(expiresAt);
    syncLocks(active);
    notifyAccessChanged();
    return active;
  };
  window.copeSetMasterAccess = function (active) {
    if (active) {
      localStorage.setItem(MASTER_KEY, 'true');
      localStorage.setItem(ACCESS_KEY, 'true');
      localStorage.setItem(AI_ACCESS_KEY, 'true');
      localStorage.setItem('copeAccess', 'true');
      localStorage.removeItem(EXPIRES_KEY);
      localStorage.removeItem(AI_EXPIRES_KEY);
    } else {
      localStorage.removeItem(MASTER_KEY);
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(AI_ACCESS_KEY);
      localStorage.removeItem('copeAccess');
    }
    syncLocks(Boolean(active));
    notifyAccessChanged();
    return Boolean(active);
  };
  window.copeSetAIAccess = function (expiresAt) {
    const active = setAIAccess(expiresAt);
    notifyAccessChanged();
    return active;
  };

  window.hasAccess = function () {
    return isLocallyActive();
  };
  window.hasAIAccess = function () {
    return isLocalAIAccessActive();
  };

  function showGate(defaultPlan) {
    if (isLocallyActive()) return;
    const original = window.__copeOriginalOpenPaywall;
    if (localStorage.getItem(CAPTURED_KEY) === 'true' && typeof original === 'function') {
      original(defaultPlan);
      return;
    }
    if (typeof window.copeShowLeadPrompt === 'function') {
      window.copeShowLeadPrompt('gate');
      setTimeout(() => {
        const overlay = document.getElementById('copeLeadOverlay');
        if (!overlay && typeof original === 'function') original(defaultPlan);
      }, 150);
      return;
    }
    if (typeof original === 'function') original(defaultPlan);
  }

  if (typeof window.openPaywall === 'function' && !window.__copeOriginalOpenPaywall) {
    window.__copeOriginalOpenPaywall = window.openPaywall;
  }
  window.openPaywall = showGate;

  async function refreshAccess() {
    try {
      const response = await fetch('./api/access?deviceId=' + encodeURIComponent(getDeviceId()), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Access check failed: ' + response.status);
      const data = await response.json();

      if (data.master) {
        localStorage.setItem(MASTER_KEY, 'true');
        localStorage.setItem(ACCESS_KEY, 'true');
        localStorage.setItem(AI_ACCESS_KEY, 'true');
        localStorage.setItem('copeAccess', 'true');
        localStorage.removeItem(EXPIRES_KEY);
        localStorage.removeItem(AI_EXPIRES_KEY);
      } else {
        localStorage.removeItem(MASTER_KEY);
        if (data.active && data.expiresAt) setAccess(data.expiresAt);
        else setAccess(null);
        if (data.aiActive && data.aiExpiresAt) setAIAccess(data.aiExpiresAt);
        else if (!data.aiActive) setAIAccess(null);
      }

      syncLocks(isLocallyActive());
      notifyAccessChanged();
    } catch (error) {
      const active = isLocallyActive();
      syncLocks(active);
      console.warn('Cope access check unavailable:', error);
    }
  }

  function showIntroOnStart() {
    if (isLocallyActive()) return;
    if (localStorage.getItem(CAPTURED_KEY) === 'true') return;
    if (typeof window.copeShowLeadPrompt === 'function') {
      window.copeShowLeadPrompt('intro', true);
    }
  }

  function init() {
    injectTalkContrast();
    syncLocks(isLocallyActive());
    refreshAccess();
    setInterval(refreshAccess, 5 * 60 * 1000);
    setInterval(() => {
      if (!isLocallyActive() && localStorage.getItem(CAPTURED_KEY) === 'true') refreshAccess();
    }, 3000);
    setTimeout(showIntroOnStart, 900);
    setTimeout(showIntroOnStart, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();