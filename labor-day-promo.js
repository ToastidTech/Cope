(function () {
  var promoEnd = new Date(2026, 8, 14, 0, 0, 0, 0);
  if (new Date() >= promoEnd) return;

  var originalOpenPaywall = window.openPaywall;
  window.openPaywall = function (defaultPlan) {
    if ((defaultPlan || 'standalone') === 'standalone') return;
    if (typeof originalOpenPaywall === 'function') originalOpenPaywall(defaultPlan);
  };

  function addBanner() {
    if (document.getElementById('cope-labor-day-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'cope-labor-day-banner';
    banner.textContent = '🎉 Labor Day Week: Cope is OPEN through Sunday, September 13 at 11:59 PM. No card needed. Cope AI remains available separately.';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:rgba(184,159,216,0.16);border-bottom:1px solid rgba(184,159,216,0.28);color:#f0eeff;text-align:center;padding:10px 14px;font:500 0.76rem/1.35 DM Sans,sans-serif;backdrop-filter:blur(16px);';
    document.body.appendChild(banner);
    document.body.style.paddingTop = '48px';
  }

  if (document.body) addBanner();
  else document.addEventListener('DOMContentLoaded', addBanner, { once: true });
})();
