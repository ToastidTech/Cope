(() => {
  'use strict';

  const INTRO_KEY = 'copeLeadIntroShown_v6';
  const CAPTURED_KEY = 'copeLeadCaptured_v3';
  const ENDPOINT = './api/lead';
  const PROMO_ENDPOINT = './api/promo';
  const DEVICE_KEY = 'copePromoDeviceId_v1';
  const PAYPAL_CLIENT_ID = 'BAA_bwsA-47MoqZ3z6GT6zqk5wTbTVOH3nMUJGGLX-5Xs87BOAIbiMS319_tABrb_kKD_cOLC4XXC8S3Dc';
  const PAYPAL_PLANS = {
    standalone: 'P-46U46696YB261861SNKS3D6Y',
    bundle: 'P-1FP81662AP009764MNKS3G7I'
  };

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'cope-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function injectStyles() {
    if (document.getElementById('copeLeadStyles')) return;
    const style = document.createElement('style');
    style.id = 'copeLeadStyles';
    style.textContent = `
      .bottom-nav .nav-btn[onclick*="talk"] { background:rgba(184,159,216,.10)!important; border:1px solid rgba(184,159,216,.32)!important; color:#d4bff5!important; box-shadow:0 0 14px rgba(184,159,216,.10); }
      .bottom-nav .nav-btn[onclick*="talk"] .nav-icon { color:#d4bff5!important; filter:drop-shadow(0 0 6px rgba(184,159,216,.55)); }
      .bottom-nav .nav-btn[onclick*="talk"] .nav-label { color:#c7b7df!important; }
      #copeLeadOverlay { position:fixed; inset:0; display:none; align-items:flex-end; justify-content:center; padding:16px; background:rgba(4,4,10,.84); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:9999; }
      #copeLeadOverlay.open { display:flex; }
      .cope-lead-card { width:min(100%,440px); max-height:calc(100dvh - 32px); overflow-y:auto; background:#10101e; border:1px solid rgba(184,159,216,.35); border-radius:24px; padding:22px; box-shadow:0 24px 80px rgba(0,0,0,.55); }
      .cope-lead-card h2 { font-family:'Cormorant Garamond',serif; color:#f0eeff; font-size:1.9rem; line-height:1.1; margin-bottom:7px; }
      .cope-lead-card p { color:#9694ad; font-size:.8rem; line-height:1.55; margin-bottom:17px; }
      .cope-lead-card label { display:block; color:#c8c8e0; font-size:.7rem; margin:12px 0 6px; }
      .cope-lead-card input,.cope-lead-card textarea { width:100%; border:1px solid #2b2940; background:#0b0b14; color:#f0eeff; border-radius:12px; padding:12px; font:inherit; font-size:.9rem; outline:none; box-sizing:border-box; }
      .cope-lead-card textarea { min-height:90px; resize:vertical; }
      .cope-lead-actions { display:flex; gap:10px; margin-top:18px; }
      .cope-lead-actions button { flex:1; min-height:46px; border-radius:12px; padding:12px 14px; font:inherit; cursor:pointer; }
      .cope-lead-skip { background:transparent; border:1px solid #2b2940; color:#9694ad; }
      .cope-lead-submit { background:#b89fd8; border:1px solid #b89fd8; color:#08080f; font-weight:600; }
      .cope-lead-status { min-height:18px; margin-top:10px; font-size:.72rem; line-height:1.4; color:#7abfa0; }
      .cope-recovery { margin-top:18px; padding-top:15px; border-top:1px solid #2b2940; }
      .cope-recovery summary { cursor:pointer; color:#9694ad; font-size:.72rem; }
      .cope-recovery-row { display:flex; gap:8px; margin-top:10px; }
      .cope-recovery-row input { flex:1; }
      .cope-recovery-row button { min-width:92px; border-radius:12px; border:1px solid #b89fd8; background:rgba(184,159,216,.14); color:#d4bff5; font:inherit; cursor:pointer; }
      .cope-paypal-wrap { margin-top:12px; padding:10px 0 0; }
      .cope-paypal-label { font-size:.68rem; color:#9694ad; text-align:center; margin-bottom:7px; }
      #sheetBuyBtn { display:none !important; }
      @media (min-width:700px) { #copeLeadOverlay { align-items:center; } }
    `;
    document.head.appendChild(style);
  }

  function injectMarkup() {
    if (document.getElementById('copeLeadOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'copeLeadOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="cope-lead-card" role="dialog" aria-modal="true" aria-labelledby="copeLeadTitle">
        <h2 id="copeLeadTitle">Complete this to start your 3-day free trial</h2>
        <p id="copeLeadIntro">No credit card required. Just tell us a little about yourself so we can personalize your Cope experience.</p>
        <form id="copeLeadForm" novalidate>
          <label for="copeLeadName">Name</label>
          <input id="copeLeadName" name="name" type="text" autocomplete="name" maxlength="120" required>
          <label for="copeLeadEmail">Email</label>
          <input id="copeLeadEmail" name="email" type="email" autocomplete="email" maxlength="254" required>
          <label for="copeLeadComment">Anything you'd like us to know? <span style="opacity:.65">(optional)</span></label>
          <textarea id="copeLeadComment" name="comment" maxlength="2000" placeholder="Tell us what brought you to Cope..."></textarea>
          <div class="cope-lead-actions">
            <button type="button" class="cope-lead-skip" id="copeLeadSkip">Continue without sharing</button>
            <button type="submit" class="cope-lead-submit" id="copeLeadSubmit">Continue</button>
          </div>
          <div class="cope-lead-status" id="copeLeadStatus" aria-live="polite"></div>
        </form>
        <details class="cope-recovery">
          <summary>Accidentally closed this? Have a promo code?</summary>
          <div class="cope-recovery-row">
            <input id="copeRecoveryCode" type="text" inputmode="text" autocomplete="off" placeholder="Enter promo code" aria-label="Promo code">
            <button type="button" id="copeRecoveryApply">Apply</button>
          </div>
          <div class="cope-lead-status" id="copeRecoveryStatus" aria-live="polite"></div>
        </details>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('copeLeadSkip').addEventListener('click', () => closePrompt());
    overlay.addEventListener('click', event => { if (event.target === overlay) closePrompt(); });
    document.getElementById('copeRecoveryApply').addEventListener('click', applyRecoveryCode);

    document.getElementById('copeLeadForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const comment = form.elements.comment.value.trim();
      const status = document.getElementById('copeLeadStatus');
      const submit = document.getElementById('copeLeadSubmit');

      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Please enter your name and a valid email.';
        status.style.color = '#c97a8a';
        return;
      }

      submit.disabled = true;
      status.textContent = 'Saving your information…';
      status.style.color = '#9694ad';
      try {
        const response = await fetch(ENDPOINT, {
          method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, credentials:'same-origin',
          body:JSON.stringify({name,email,comment,deviceId:getDeviceId()})
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        localStorage.setItem(CAPTURED_KEY, 'true');
        status.textContent = 'Thanks. Your information has been saved.';
        status.style.color = '#7abfa0';
        submit.style.display = 'none';
        document.getElementById('copeLeadSkip').textContent = 'Continue to Cope';
      } catch (error) {
        console.error('Cope lead capture error:', error);
        status.textContent = 'Could not save your information right now. Please try again.';
        status.style.color = '#c97a8a';
        submit.disabled = false;
      }
    });
  }

  async function applyRecoveryCode() {
    const input = document.getElementById('copeRecoveryCode');
    const status = document.getElementById('copeRecoveryStatus');
    const button = document.getElementById('copeRecoveryApply');
    const code = input.value.trim();
    if (!code) { status.textContent = 'Enter your promo code.'; status.style.color = '#c97a8a'; return; }
    button.disabled = true;
    status.textContent = 'Checking code…';
    status.style.color = '#9694ad';
    try {
      const response = await fetch(PROMO_ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, credentials:'same-origin',
        body:JSON.stringify({code, deviceId:getDeviceId()})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
      localStorage.setItem('copePromoAccess_v1','true');
      localStorage.setItem('copePromoExpiresAt_v1', String(Number(data.expiresAt)));
      if (typeof window.copeSetPromoAccess === 'function') window.copeSetPromoAccess(data.expiresAt);
      status.textContent = 'Code accepted. Your 3-day access is active. 💜';
      status.style.color = '#7abfa0';
      setTimeout(() => closePrompt(), 900);
    } catch (error) {
      console.error('Cope promo code error:', error);
      status.textContent = error.message || 'That promo code could not be applied.';
      status.style.color = '#c97a8a';
      button.disabled = false;
    }
  }

  function closePrompt() {
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
  }

  function showPrompt(mode, force) {
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay || overlay.classList.contains('open')) return;
    if (!force && mode === 'intro' && localStorage.getItem(INTRO_KEY)) return;
    if (!force && mode !== 'intro') return;
    if (mode === 'intro') localStorage.setItem(INTRO_KEY, '1');

    const title = document.getElementById('copeLeadTitle');
    const intro = document.getElementById('copeLeadIntro');
    const skip = document.getElementById('copeLeadSkip');
    const submit = document.getElementById('copeLeadSubmit');
    const status = document.getElementById('copeLeadStatus');
    title.textContent = mode === 'intro'
      ? 'Complete this to start your 3-day free trial'
      : 'Stay Connected with Cope';
    intro.textContent = mode === 'intro'
      ? 'No credit card required. Just tell us a little about yourself so we can personalize your Cope experience.'
      : 'Share your name and email to stay connected with Cope.';
    skip.textContent = 'Continue without sharing';
    submit.textContent = 'Continue';
    submit.style.display = '';
    submit.disabled = false;
    status.textContent = '';
    document.getElementById('copeLeadForm').reset();
    document.getElementById('copeRecoveryCode').value = '';
    document.getElementById('copeRecoveryStatus').textContent = '';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    setTimeout(() => document.getElementById('copeLeadName')?.focus(),50);
  }

  function loadPayPal() {
    if (window.paypal) return Promise.resolve(window.paypal);
    if (window.__copePayPalPromise) return window.__copePayPalPromise;
    window.__copePayPalPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.async = true;
      script.onload = () => window.paypal ? resolve(window.paypal) : reject(new Error('PayPal SDK unavailable'));
      script.onerror = () => reject(new Error('PayPal SDK failed to load'));
      document.head.appendChild(script);
    });
    return window.__copePayPalPromise;
  }

  function renderPayPal(container, planId, label) {
    if (!container || container.dataset.rendered === 'true') return;
    container.dataset.rendered = 'loading';
    loadPayPal().then(paypal => paypal.Buttons({
      style: { shape:'rect', color:'gold', layout:'vertical', label:'subscribe' },
      createSubscription: (data, actions) => actions.subscription.create({ plan_id: planId }),
      onApprove: data => {
        container.dataset.rendered = 'true';
        const msg = document.createElement('div');
        msg.style.cssText = 'margin-top:8px;color:#7abfa0;font-size:.75rem;text-align:center;';
        msg.textContent = `${label} subscription approved. Subscription ID: ${data.subscriptionID}`;
        container.appendChild(msg);
      },
      onError: error => {
        console.error('Cope PayPal error:', error);
        container.dataset.rendered = 'error';
      }
    }).render(container)).catch(error => {
      console.error('Cope PayPal SDK error:', error);
      container.dataset.rendered = 'error';
    });
  }

  function patchPaymentUI() {
    const standalone = document.getElementById('plan-standalone');
    const bundle = document.getElementById('plan-bundle');
    if (standalone) {
      const price = standalone.querySelector('div[style*="font-size:1.8rem"]');
      if (price && price.textContent !== '$9.99') price.textContent = '$9.99';
      const meta = standalone.querySelector('div[style*="letter-spacing:2px"]');
      if (meta && meta.textContent !== '/ MONTH · COPE') meta.textContent = '/ MONTH · COPE';
      const desc = Array.from(standalone.querySelectorAll('div')).find(el => /12\.99|Cope/i.test(el.textContent) && el !== price && el !== meta && el.children.length === 0);
      if (desc && desc.textContent !== 'Standard Cope Features · 3-Day Free Trial') desc.textContent = 'Standard Cope Features · 3-Day Free Trial';
      if (!standalone.querySelector('.cope-paypal-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'cope-paypal-wrap';
        wrap.innerHTML = '<div class="cope-paypal-label">$9.99/month · 3-day free trial</div><div id="cope-paypal-standard"></div>';
        standalone.appendChild(wrap);
        renderPayPal(wrap.querySelector('#cope-paypal-standard'), PAYPAL_PLANS.standalone, 'Cope Standard');
      }
    }
    if (bundle) {
      const price = bundle.querySelector('div[style*="font-size:1.8rem"]');
      if (price && price.textContent !== '$19.99') price.textContent = '$19.99';
      const meta = bundle.querySelector('div[style*="letter-spacing:2px"]');
      if (meta && meta.textContent !== '/ MONTH · COPEAI') meta.textContent = '/ MONTH · COPEAI';
      if (!bundle.querySelector('.cope-paypal-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'cope-paypal-wrap';
        wrap.innerHTML = '<div class="cope-paypal-label">$19.99/month · 3-day free trial</div><div id="cope-paypal-ai"></div>';
        bundle.appendChild(wrap);
        renderPayPal(wrap.querySelector('#cope-paypal-ai'), PAYPAL_PLANS.bundle, 'CopeAI');
      }
    }
    const oldBtn = document.getElementById('sheetBuyBtn');
    if (oldBtn) oldBtn.style.display = 'none';
  }

  window.copeShowLeadPrompt = function(mode) { showPrompt(mode || 'gate', true); };

  function init() {
    injectStyles();
    injectMarkup();
    setTimeout(() => {
      if (!localStorage.getItem(CAPTURED_KEY) && !localStorage.getItem(INTRO_KEY)) showPrompt('intro');
      patchPaymentUI();
    }, 700);
    const observer = new MutationObserver(() => patchPaymentUI());
    observer.observe(document.body, {childList:true, subtree:true});
    setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
