// Nama aplikasi permanen (beda dari nama toko di Pengaturan) - ubah di sini, otomatis update ke login, sidebar & judul tab.
window.APP_NAME = "INI KASIR";
document.title = window.APP_NAME;
const _appTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
if (_appTitleMeta) _appTitleMeta.setAttribute('content', window.APP_NAME);

if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}

function updateThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--primary-light').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && color) meta.setAttribute('content', color);
}
document.addEventListener('DOMContentLoaded', updateThemeColor);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {})
      .catch(err => {});
  });
}