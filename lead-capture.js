(() => {
  'use strict';

  const INTRO_KEY = 'copeLeadIntroShown';
  const EXIT_KEY = 'copeLeadExitShown';
  const ENDPOINT = './api/lead';

  function injectStyles() {
    if (document.getElementById('copeLeadStyles')) return;
    const style = document.createElement('style');
    style.id = 'copeLeadStyles';
    style.textContent = `
      #copeLeadOverlay {
        position: fixed; inset: 0; display: none; align-items: flex-end; justify-content: center;
        padding: 16px; background: rgba(4,4,10,.84); backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px); z-index: 9999;
      }
      #copeLeadOverlay.open { display: flex; }
      .cope-lead-card {
        width: min(100%, 440px); max-height: calc(100dvh - 32px); overflow-y: auto;
        background: #10101e; border: 1px solid rgba(184,159,216,.35); border-radius: 24px;
        padding: 22px; box-shadow: 0 24px 80px rgba(0,0,0,.55); animation: copeLeadUp .25s ease-out;
      }
      @keyframes copeLeadUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
      .cope-lead-handle { width:42px; height:4px; border-radius:99px; background:#3a3850; margin:0 auto 18px; }
      .cope-lead-card h2 { font-family:'Cormorant Garamond',serif; color:#f0eeff; font-size:1.9rem; line-height:1.1; margin-bottom:7px; }
      .cope-lead-card p { color:#9694ad; font-size:.8rem; line-height:1.55; margin-bottom:17px; }
      .cope-lead-card label { display:block; color:#c8c8e0; font-size:.7rem; margin:12px 0 6px; }
      .cope-lead-card input,.cope-lead-card textarea { width:100%; border:1px solid #2b2940; background:#0b0b14; color:#f0eeff; border-radius:12px; padding:12px; font:inherit; font-size:.9rem; outline:none; }
      .cope-lead-card input:focus,.cope-lead-card textarea:focus { border-color:#b89fd8; box-shadow:0 0 0 2px rgba(184,159,216,.10); }
      .cope-lead-card textarea { min-height:90px; resize:vertical; }
      .cope-lead-actions { display:flex; gap:10px; margin-top:18px; }
      .cope-lead-actions button { flex:1; min-height:46px; border-radius:12px; padding:12px 14px; font:inherit; cursor:pointer; }
      .cope-lead-skip { background:transparent; border:1px solid #2b2940; color:#9694ad; }
      .cope-lead-submit { background:#b89fd8; border:1px solid #b89fd8; color:#08080f; font-weight:600; }
      .cope-lead-submit:disabled { opacity:.6; cursor:wait; }
      .cope-lead-status { min-height:18px; margin-top:10px; font-size:.72rem; line-height:1.4; color:#7abfa0; }
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
        <div class="cope-lead-handle" aria-hidden="true"></div>
        <h2 id="copeLeadTitle">Welcome to Cope</h2>
        <p id="copeLeadIntro">Before you begin, we'd love to stay in touch. Share your name and email with the Cope team. You can continue without sharing.</p>
        <form id="copeLeadForm" novalidate>
          <label for="copeLeadName">Name</label>
          <input id="copeLeadName" name="name" type="text" autocomplete="name" maxlength="120" required>
          <label for="copeLeadEmail">Email</label>
          <input id="copeLeadEmail" name="email" type="email" autocomplete="email" maxlength="254" required>
          <label for="copeLeadComment">Anything you'd like us to know? <span style="opacity:.65">(optional)</span></label>
          <textarea id="copeLeadComment" name="comment" maxlength="2000" placeholder="Tell us what brought you to Cope..."></textarea>
          <div class="cope-lead-actions">
            <button type="button" class="cope-lead-skip" id="copeLeadSkip">Continue without sharing</button>
            <button type="submit" class="cope-lead-submit" id="copeLeadSubmit">Enter Cope</button>
          </div>
          <div class="cope-lead-status" id="copeLeadStatus" aria-live="polite"></div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('copeLeadSkip').addEventListener('click', () => closePrompt());
    overlay.addEventListener('click', event => { if (event.target === overlay) closePrompt(); });

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
      status.textContent = 'Saving…';
      status.style.color = '#9694ad';
      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name, email, comment })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
        status.textContent = 'Thank you. 💜';
        status.style.color = '#7abfa0';
        setTimeout(() => closePrompt(), 650);
      } catch (error) {
        console.error('Cope lead capture error:', error);
        status.textContent = 'Could not send right now. Please try again.';
        status.style.color = '#c97a8a';
        submit.disabled = false;
      }
    });
  }

  function closePrompt() {
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function showPrompt(mode) {
    const key = mode === 'intro' ? INTRO_KEY : EXIT_KEY;
    if (sessionStorage.getItem(key)) return;
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay || overlay.classList.contains('open')) return;

    sessionStorage.setItem(key, '1');
    const title = document.getElementById('copeLeadTitle');
    const intro = document.getElementById('copeLeadIntro');
    const skip = document.getElementById('copeLeadSkip');
    const submit = document.getElementById('copeLeadSubmit');

    if (mode === 'exit') {
      title.textContent = 'Before you go';
      intro.textContent = "We'd love to hear from you. Leave your name, email, and anything you'd like to share with the Cope team.";
      skip.textContent = 'Not now';
      submit.textContent = 'Send';
    } else {
      title.textContent = 'Welcome to Cope';
      intro.textContent = "Before you begin, we'd love to stay in touch. Share your name and email with the Cope team. You can continue without sharing.";
      skip.textContent = 'Continue without sharing';
      submit.textContent = 'Enter Cope';
    }

    document.getElementById('copeLeadForm').reset();
    document.getElementById('copeLeadStatus').textContent = '';
    submit.disabled = false;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('copeLeadName')?.focus(), 50);
  }

  function init() {
    injectStyles();
    injectMarkup();

    // Upfront capture: show once at the start of each session.
    setTimeout(() => showPrompt('intro'), 250);

    // Desktop exit intent: browser-edge mouseout.
    document.addEventListener('mouseout', event => {
      if (event.clientY <= 4 && event.relatedTarget === null) showPrompt('exit');
    });

    // Mobile/tablet: capture when the app is backgrounded or closed.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') showPrompt('exit');
    });

    // Browser/page lifecycle fallback for supported browsers.
    window.addEventListener('pagehide', () => showPrompt('exit'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
