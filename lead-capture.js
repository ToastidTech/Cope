(() => {
  'use strict';

  const STORAGE_KEY = 'copeLeadCaptureShown';
  const ENDPOINT = '/api/lead';

  function injectStyles() {
    if (document.getElementById('copeLeadStyles')) return;
    const style = document.createElement('style');
    style.id = 'copeLeadStyles';
    style.textContent = `
      #copeLeadOverlay{position:fixed;inset:0;background:rgba(4,4,10,.78);backdrop-filter:blur(12px);display:none;align-items:center;justify-content:center;padding:20px;z-index:1000}
      #copeLeadOverlay.open{display:flex}
      .cope-lead-card{width:min(100%,430px);background:#10101e;border:1px solid #2b2940;border-radius:22px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.45)}
      .cope-lead-card h2{font-family:'Cormorant Garamond',serif;color:#f0eeff;font-size:1.8rem;margin-bottom:6px}
      .cope-lead-card p{color:#7d7b96;font-size:.8rem;line-height:1.55;margin-bottom:18px}
      .cope-lead-card label{display:block;color:#c8c8e0;font-size:.72rem;margin:12px 0 6px}
      .cope-lead-card input,.cope-lead-card textarea{width:100%;border:1px solid #2b2940;background:#0b0b14;color:#f0eeff;border-radius:12px;padding:12px;font:inherit;outline:none}
      .cope-lead-card textarea{min-height:110px;resize:vertical}
      .cope-lead-card input:focus,.cope-lead-card textarea:focus{border-color:#b89fd8}
      .cope-lead-actions{display:flex;gap:10px;margin-top:18px}
      .cope-lead-actions button{flex:1;border-radius:12px;padding:12px 14px;font:inherit;cursor:pointer}
      .cope-lead-skip{background:transparent;border:1px solid #2b2940;color:#7d7b96}
      .cope-lead-submit{background:#b89fd8;border:1px solid #b89fd8;color:#08080f;font-weight:600}
      .cope-lead-status{min-height:18px;margin-top:10px;font-size:.72rem;color:#7abfa0}
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
        <h2 id="copeLeadTitle">Before you go</h2>
        <p>If Cope helped, or if you have something you'd like us to know, we'd love to hear from you. This is completely optional.</p>
        <form id="copeLeadForm" novalidate>
          <label for="copeLeadName">Name</label>
          <input id="copeLeadName" name="name" autocomplete="name" maxlength="120" required>
          <label for="copeLeadEmail">Email</label>
          <input id="copeLeadEmail" name="email" type="email" autocomplete="email" maxlength="254" required>
          <label for="copeLeadComment">Comment</label>
          <textarea id="copeLeadComment" name="comment" maxlength="2000" placeholder="Anything you'd like to share?"></textarea>
          <div class="cope-lead-actions">
            <button type="button" class="cope-lead-skip" id="copeLeadSkip">Not now</button>
            <button type="submit" class="cope-lead-submit">Send</button>
          </div>
          <div class="cope-lead-status" id="copeLeadStatus" aria-live="polite"></div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      sessionStorage.setItem(STORAGE_KEY, '1');
    };

    document.getElementById('copeLeadSkip').addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });

    document.getElementById('copeLeadForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const comment = form.elements.comment.value.trim();
      const status = document.getElementById('copeLeadStatus');

      if (!name || !email || !email.includes('@')) {
        status.textContent = 'Please enter your name and a valid email.';
        status.style.color = '#c97a8a';
        return;
      }

      status.textContent = 'Sending…';
      status.style.color = '#7d7b96';
      try {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ name, email, comment })
        });
        if (!response.ok) throw new Error('Lead submission failed');
        status.textContent = 'Thank you. 💜';
        status.style.color = '#7abfa0';
        setTimeout(close, 900);
      } catch (error) {
        console.error('Cope lead capture error:', error);
        status.textContent = 'Could not send right now. Please try again.';
        status.style.color = '#c97a8a';
      }
    });
  }

  function showPrompt() {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const overlay = document.getElementById('copeLeadOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('copeLeadName')?.focus();
  }

  function init() {
    injectStyles();
    injectMarkup();

    // Desktop exit intent.
    document.addEventListener('mouseout', (event) => {
      if (event.clientY <= 4 && event.relatedTarget === null) showPrompt();
    });

    // Best-effort mobile/tablet support: prompt when the user backgrounds the app.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        setTimeout(() => {
          if (document.visibilityState === 'visible') showPrompt();
        }, 350);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
