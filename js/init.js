window.APP_NAME = "INI KASIR";
document.title = window.APP_NAME;
const _appTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
if (_appTitleMeta) _appTitleMeta.setAttribute('content', window.APP_NAME);

try {
  if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark');
} catch (error) { document.documentElement.dataset.darkModeFallback = 'true'; }

function updateThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && color) meta.setAttribute('content', color);
}
document.addEventListener('DOMContentLoaded', updateThemeColor);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('service-worker.js');
    } catch (error) {
      const toast = document.getElementById('toast-container');
      if (toast) toast.setAttribute('data-sw-error', 'true');
    }
  });
}
