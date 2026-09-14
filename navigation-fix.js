(() => {
  'use strict';

  function clearTalkActiveState() {
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
      const label = (btn.querySelector('.nav-label')?.textContent || '').trim().toLowerCase();
      if (label === 'talk') btn.classList.remove('active');
    });
  }

  function clearHelpLockState() {
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
      const label = (btn.querySelector('.nav-label')?.textContent || '').trim().toLowerCase();
      if (label !== 'help') return;
      btn.classList.remove('locked');
      btn.querySelectorAll('.locked, [class*="lock"], [id*="lock"]').forEach(el => {
        el.classList.remove('locked');
        el.style.display = 'none';
      });
    });
  }

  function safeGate(defaultPlan = 'standalone') {
    clearTalkActiveState();
    clearHelpLockState();
    if (typeof window.hasAccess === 'function' && window.hasAccess()) {
      if (typeof window.__copeOriginalOpenPaywall === 'function') {
        window.__copeOriginalOpenPaywall(defaultPlan);
        return true;
      }
      return false;
    }
    if (typeof window.copeShowLeadPrompt === 'function') {
      window.copeShowLeadPrompt('gate', true);
      return true;
    }
    if (typeof window.__copeOriginalOpenPaywall === 'function') {
      window.__copeOriginalOpenPaywall(defaultPlan);
      return true;
    }
    if (typeof window.openPaywall === 'function') {
      window.openPaywall(defaultPlan);
      return true;
    }
    return false;
  }

  function route(target, requiresAI) {
    if (target === 'crisis') {
      clearHelpLockState();
      window.goTo(target);
      return;
    }

    if (requiresAI) {
      if (typeof window.hasAIAccess === 'function' && window.hasAIAccess()) {
        window.goTo(target);
      } else {
        safeGate('standalone');
      }
      return;
    }

    if (target === 'breathing' || target === 'journal' || target === 'sleep' || target === 'talk') {
      if (typeof window.hasAccess === 'function' && window.hasAccess()) {
        window.goTo(target);
      } else {
        safeGate('standalone');
      }
      return;
    }

    window.goTo(target);
  }

  function getNavTarget(btn) {
    const label = (btn.querySelector('.nav-label')?.textContent || '').trim().toLowerCase();
    return {
      home: 'home',
      breathe: 'breathing',
      journal: 'journal',
      asmr: 'asmr',
      talk: 'talk',
      help: 'crisis'
    }[label] || null;
  }

  function getCardTarget(card) {
    const title = (card.querySelector('.qc-title')?.textContent || '').trim().toLowerCase();
    return {
      breathe: 'breathing',
      journal: 'journal',
      affirm: 'home',
      sleep: 'sleep'
    }[title] || null;
  }

  function handleClick(event) {
    const nav = event.target.closest?.('.bottom-nav .nav-btn');
    const card = event.target.closest?.('.quick-card');
    if (!nav && !card) return;

    const target = nav ? getNavTarget(nav) : getCardTarget(card);
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    route(target, false);
  }

  function init() {
    clearHelpLockState();
    document.addEventListener('click', handleClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
