const app = document.getElementById("app");

const _storedSidebar = window.Utils?.storage?.get('sidebarCollapsed', null);
let sidebarCollapsed = window.matchMedia('(orientation: portrait)').matches
  ? true
  : (_storedSidebar === null ? window.innerWidth < 1100 : _storedSidebar === 'true');
let _isRendering = false;
let _lastView = null;

const NAV_ORDER = ['kasir', 'openBill', 'history', 'laporan', 'pengeluaran', 'bahanManager', 'menuManager', 'modifierManager', 'settings'];

window.triggerPageTransition = function(direction = 'forward') {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector('.main-inner');
      if (!el) return;
      el.classList.remove('page-enter', 'page-enter-back');
      void el.offsetWidth;
      el.classList.add(direction === 'back' ? 'page-enter-back' : 'page-enter');
    });
  });
};

window.navigateTo = function(view) {
  if (_lastView === view) return;
  const isDrawerLayout = window.matchMedia('(orientation: portrait)').matches;
  if (isDrawerLayout) {
    sidebarCollapsed = true;
    window.sidebarCollapsed = true;
    if (!window.Utils?.storage?.set('sidebarCollapsed', 'true')) document.documentElement.dataset.storageFallback = 'true';
  }
  const fromIdx = NAV_ORDER.indexOf(_lastView);
  const toIdx = NAV_ORDER.indexOf(view);
  const dir = (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) ? 'back' : 'forward';
  _lastView = view;
  state.currentView = view;
  if (view === 'kasir') window.renderKasir?.();
  else if (view === 'history') window.renderHistory?.();
  else if (view === 'menuManager') window.renderMenuManager?.();
  else if (view === 'bahanManager') window.renderBahanManager?.();
  else if (view === 'modifierManager') window.renderModifierManager?.();
  else if (view === 'laporan') window.renderLaporan?.();
  else if (view === 'settings') window.renderSettings?.();
  window._startTopProgress?.();
  setTimeout(() => {
    window.triggerPageTransition(dir);
    window._doneTopProgress?.();
  }, 60);
};

function createState(initialState) {
  const handlers = {
    set(target, property, value) {
      if (target[property] === value) return true;
      target[property] = value;
      const shouldRender = [
        'currentView', 'cart', 'selectedCategory', 'selectedTable',
        'selectedPaymentMethod', 'cashAmount', 'qrisAmount',
        'transactions', 'selectedHistory', 'selectedMenus',
        'modifierGroups', 'openBills', 'activeMobileTab', 'discountMode', 'discountValue', 'discountSource', 'discountTemplateId'
      ].includes(property);
      if (!shouldRender) return true;
      requestAnimationFrame(() => {
        window.safeRender();
      });
      return true;
    }
  };
  return new Proxy(initialState, handlers);
}

let state = createState({
  user: null, cart: [], menus: [], categories: [],
  selectedCategory: "ALL", selectedMenus: new Set(),
  transactions: [], allTransactions: [],
  selectedHistory: new Set(),
  currentView: "kasir", currentCategoryId: null,
  currentSession: null, sessions: [], allSessions: [],
  rawMaterials: [], stockMutations: [], tables: [],
  selectedTable: null, settings: null,
  pengeluaran: [], selectedPaymentMethod: 'tunai',
  cashAmount: 0, qrisAmount: 0,
  lastCategoryScroll: 0, lastMenuScroll: 0, lastCartScroll: 0,
  modifierGroups: [], openBills: [],
  kasirSearchQuery: '', categorySearchQuery: '',
  activeMobileTab: 'menu',
  discountMode: 'percent',
  discountValue: 0,
  discountSource: 'manual',
  discountTemplateId: null
});

window.app = app;
window.state = state;
window.sidebarCollapsed = sidebarCollapsed;

window.toggleSidebar = function() {
  sidebarCollapsed = !sidebarCollapsed;
  window.sidebarCollapsed = sidebarCollapsed;
  if (!window.Utils?.storage?.set('sidebarCollapsed', String(sidebarCollapsed))) document.documentElement.dataset.storageFallback = 'true';
  window.safeRender();
};

window.safeRender = function() {
  if (_isRendering) return;
  _isRendering = true;
  const viewChanged = _lastView !== state.currentView;
  if (viewChanged) _lastView = state.currentView;
  requestAnimationFrame(() => {
    try {
      if (state.currentView === "kasir" && typeof window.renderKasir === 'function') window.renderKasir();
      else if (state.currentView === "history" && typeof window.renderHistory === 'function') window.renderHistory();
      else if (state.currentView === "menuManager" && typeof window.renderMenuManager === 'function') window.renderMenuManager();
      else if (state.currentView === "openCategory" && typeof window.openCategory === 'function') window.openCategory(state.currentCategoryId);
      else if (state.currentView === "bahanManager" && typeof window.renderBahanManager === 'function') window.renderBahanManager();
      else if (state.currentView === "modifierManager" && typeof window.renderModifierManager === 'function') window.renderModifierManager();
      else if (state.currentView === "laporan" && typeof window.renderLaporan === 'function') window.renderLaporan();
      else if (state.currentView === "settings" && typeof window.renderSettings === 'function') window.renderSettings();
      if (viewChanged) {
        window._startTopProgress?.();
        setTimeout(() => {
          window.triggerPageTransition('forward');
          window._doneTopProgress?.();
        }, 60);
      }
    } catch (error) {
      const message = error?.message || 'Terjadi kesalahan saat menampilkan halaman.';
      const main = document.querySelector('.main-scroll');
      if (main) {
        main.innerHTML = `<div class="app-error-state"><i class="fas fa-triangle-exclamation"></i><h2>Halaman tidak dapat ditampilkan</h2><p>${window.Utils?.escapeHtml ? window.Utils.escapeHtml(message) : String(message).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</p><button class="btn btn-primary" onclick="window.safeRender()">Coba lagi</button></div>`;
      }
    } finally {
      _isRendering = false;
    }
  });
};
