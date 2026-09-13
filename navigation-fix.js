(() => {
  'use strict';

  function safeGate() {
    if (typeof window.hasAccess === 'function' && window.hasAccess()) return false;
    if (typeof window.copeShowLeadPrompt === 'function') {
      window.copeShowLeadPrompt('gate');
      return true;
    }
    if (typeof window.__copeOriginalOpenPaywall === 'function') {
      window.__copeOriginalOpenPaywall('standalone');
      return true;
    }
    if (typeof window.openPaywall === 'function') {
      window.openPaywall('standalone');
      return true;
    }
    return true;
  }

  function bind() {
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
      const label = (btn.querySelector('.nav-label')?.textContent || '').trim().toLowerCase();
      const target = {
        home: 'home',
        breathe: 'breathing',
        journal: 'journal',
        asmr: 'asmr',
        talk: 'talk',
        help: 'crisis'
      }[label];
      if (!target) return;

      btn.onclick = function(event) {
        event.preventDefault();
        if (target === 'breathing' || target === 'journal') {
          if (typeof window.hasAccess === 'function' && window.hasAccess()) window.goTo(target);
          else safeGate();
          return false;
        }
        if (target === 'talk') {
          if (typeof window.hasAIAccess === 'function' && window.hasAIAccess()) window.goTo(target);
          else safeGate();
          return false;
        }
        if (typeof window.goTo === 'function') window.goTo(target);
        return false;
      };
    });

    document.querySelectorAll('.quick-card').forEach(card => {
      const title = (card.querySelector('.qc-title')?.textContent || '').trim().toLowerCase();
      const target = { breathe:'breathing', journal:'journal', affirm:'home', sleep:'sleep' }[title];
      if (!target) return;
      card.onclick = function(event) {
        event.preventDefault();
        if (typeof window.hasAccess === 'function' && window.hasAccess()) window.goTo(target);
        else safeGate();
        return false;
      };
    });
  }

  function init() {
    bind();
    setTimeout(bind, 250);
    setTimeout(bind, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
