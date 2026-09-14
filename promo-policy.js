(() => {
  'use strict';

  const PROMO_ENDPOINT = './api/promo';
  const MASTER_KEY = 'copeMasterAccess_v1';
  const AI_ACCESS_KEY = 'copeAIAccess';
  const AI_EXPIRES_KEY = 'copeAIAccessExpiresAt_v1';

  function setMessage(text, ok) {
    const msg = document.getElementById('promoQuickMsg') || document.getElementById('promoMsg');
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
    const input = document.getElementById('promoQuickInput') || document.getElementById('promoInput');
    const button = document.getElementById('promoQuickApply') || document.getElementById('codeApplyBtn');
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
        document.getElementById('promoQuickOverlay')?.classList.remove('open');
        if (typeof window.closePaywall === 'function') window.closePaywall();
        if (typeof window.renderHome === 'function') window.renderHome();
      }, 700);
    } catch (error) {
      console.error('Cope promo error:', error);
      setMessage(error.message || 'That promo code could not be applied.', false);
      if (button) button.disabled = false;
    }
  };

  function injectAlwaysAvailablePromo() {
    if (document.getElementById('copePromoQuickButton')) return;

    const style = document.createElement('style');
    style.id = 'cope-promo-quick-styles';
    style.textContent = `
      #copePromoQuickButton { position:fixed; right:14px; bottom:calc(70px + env(safe-area-inset-bottom)); z-index:150; border:1px solid rgba(184,159,216,.38); background:rgba(16,16,30,.94); color:#d4bff5; border-radius:999px; padding:8px 12px; font:500 .66rem 'DM Sans',sans-serif; letter-spacing:.7px; box-shadow:0 6px 24px rgba(0,0,0,.28); backdrop-filter:blur(12px); cursor:pointer; }
      #copePromoQuickOverlay { position:fixed; inset:0; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(4,4,10,.84); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:10000; }
      #copePromoQuickOverlay.open { display:flex; }
      .cope-promo-quick-card { width:min(100%,380px); background:#10101e; border:1px solid rgba(184,159,216,.35); border-radius:22px; padding:22px; box-shadow:0 24px 80px rgba(0,0,0,.55); }
      .cope-promo-quick-card h2 { color:#f0eeff; font:600 1.65rem 'Cormorant Garamond',serif; margin-bottom:7px; }
      .cope-promo-quick-card p { color:#9694ad; font-size:.78rem; line-height:1.5; margin-bottom:15px; }
      #promoQuickInput { width:100%; box-sizing:border-box; border:1px solid #2b2940; background:#0b0b14; color:#f0eeff; border-radius:12px; padding:12px; font:inherit; outline:none; }
      .cope-promo-quick-actions { display:flex; gap:8px; margin-top:12px; }
      .cope-promo-quick-actions button { flex:1; min-height:44px; border-radius:12px; font:inherit; cursor:pointer; }
      #promoQuickClose { border:1px solid #2b2940; background:transparent; color:#9694ad; }
      #promoQuickApply { border:1px solid #b89fd8; background:rgba(184,159,216,.18); color:#d4bff5; }
      #promoQuickMsg { min-height:18px; margin-top:10px; font-size:.7rem; line-height:1.4; }
      .bottom-nav .nav-btn[onclick*="talk"] { background:transparent !important; border:0 !important; color:inherit !important; box-shadow:none !important; }
      .bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color:var(--white) !important; filter:none !important; }
      .bottom-nav .nav-btn[onclick*="talk"] .nav-label { color:var(--text) !important; }
      .bottom-nav .nav-btn[onclick*="talk"].active { background:transparent !important; border:0 !important; color:inherit !important; box-shadow:none !important; }
      .bottom-nav .nav-btn[onclick*="talk"].active .nav-icon { color:var(--white) !important; filter:drop-shadow(0 0 6px rgba(184,159,216,.6)) !important; }
      .bottom-nav .nav-btn[onclick*="talk"].active .nav-label { color:var(--lavender) !important; }
    `;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.id = 'copePromoQuickButton';
    button.type = 'button';
    button.textContent = 'PROMO CODE';
    button.addEventListener('click', () => document.getElementById('promoQuickOverlay')?.classList.add('open'));
    document.body.appendChild(button);

    const overlay = document.createElement('div');
    overlay.id = 'promoQuickOverlay';
    overlay.innerHTML = `
      <div class="cope-promo-quick-card" role="dialog" aria-modal="true" aria-labelledby="promoQuickTitle">
        <h2 id="promoQuickTitle">Have a promo code?</h2>
        <p>Enter your code here anytime. No need to return to the welcome screen.</p>
        <input id="promoQuickInput" type="text" inputmode="text" autocomplete="off" placeholder="Enter promo code" aria-label="Promo code">
        <div class="cope-promo-quick-actions">
          <button type="button" id="promoQuickClose">Cancel</button>
          <button type="button" id="promoQuickApply">Apply</button>
        </div>
        <div id="promoQuickMsg" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('promoQuickClose').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.classList.remove('open'); });
    document.getElementById('promoQuickApply').addEventListener('click', window.applyPromo);
    document.getElementById('promoQuickInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') window.applyPromo();
    });
  }

  function init() {
    const recovery = document.querySelector('.cope-recovery');
    if (recovery) recovery.remove();
    const row = document.getElementById('confirmRow');
    if (row) row.style.display = '';
    injectAlwaysAvailablePromo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
