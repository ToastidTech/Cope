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

  function ensureHomePromoSection() {
    const home = document.getElementById('screen-home');
    if (!home || document.getElementById('homePromoCard')) return;

    if (!document.getElementById('copeHomePromoStyles')) {
      const style = document.createElement('style');
      style.id = 'copeHomePromoStyles';
      style.textContent = `
        .home-promo-card {
          background: linear-gradient(135deg, rgba(184,159,216,0.08), rgba(201,132,154,0.05));
          border: 1px solid rgba(184,159,216,0.18);
          border-radius: 18px;
          padding: 18px;
          margin: 6px 0 20px;
        }
        .home-promo-kicker {
          font-size: .62rem;
          letter-spacing: 3px;
          color: var(--lav-dim);
          text-transform: uppercase;
          margin-bottom: 7px;
          font-weight: 500;
        }
        .home-promo-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.25rem;
          color: var(--white);
          margin-bottom: 5px;
        }
        .home-promo-sub {
          font-size: .72rem;
          color: var(--dim);
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .home-promo-row { display:flex; gap:8px; }
        #promoQuickInput {
          flex:1;
          min-width:0;
          box-sizing:border-box;
          border:1px solid var(--border);
          background:rgba(255,255,255,.03);
          color:var(--white);
          border-radius:12px;
          padding:11px 12px;
          font:inherit;
          outline:none;
        }
        #promoQuickInput:focus { border-color:rgba(184,159,216,.45); }
        #promoQuickApply {
          flex-shrink:0;
          border:1px solid rgba(184,159,216,.28);
          background:rgba(184,159,216,.12);
          color:var(--lav-bright);
          border-radius:12px;
          padding:0 15px;
          cursor:pointer;
          font:500 .78rem 'DM Sans',sans-serif;
        }
        #promoQuickApply:disabled { opacity:.55; cursor:default; }
        #promoQuickMsg { min-height:18px; margin-top:9px; font-size:.7rem; line-height:1.4; }
      `;
      document.head.appendChild(style);
    }

    const card = document.createElement('div');
    card.id = 'homePromoCard';
    card.className = 'home-promo-card';
    card.innerHTML = `
      <div class="home-promo-kicker">Promo Code</div>
      <div class="home-promo-title">Have a promo code?</div>
      <div class="home-promo-sub">Enter your code here anytime. No need to return to the welcome screen.</div>
      <div class="home-promo-row">
        <input id="promoQuickInput" type="text" inputmode="text" autocomplete="off" placeholder="Enter promo code" aria-label="Promo code">
        <button type="button" id="promoQuickApply">Apply</button>
      </div>
      <div id="promoQuickMsg" aria-live="polite"></div>`;

    const powered = home.querySelector('.powered');
    if (powered) home.insertBefore(card, powered);
    else home.appendChild(card);

    document.getElementById('promoQuickApply').addEventListener('click', window.applyPromo);
    document.getElementById('promoQuickInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') window.applyPromo();
    });
  }

  function init() {
    ensureHomePromoSection();
    const row = document.getElementById('confirmRow');
    if (row) row.style.display = '';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
