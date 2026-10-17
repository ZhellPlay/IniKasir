function isMejaFeatureEnabled() {
  const f = state.settings?.fitur;
  return f?.meja !== undefined ? f.meja !== false : state.settings?.meja?.aktif !== false;
}

function isDiscountFeatureEnabled() {
  return state.settings?.fitur?.diskon !== false;
}

function getDiscountConfig() {
  return state.settings?.fitur?.diskonPengaturan || { mode: 'both', templates: [] };
}

function getEligibleDiscountTemplates(subtotal = getCartSubtotal()) {
  const templates = Array.isArray(getDiscountConfig().templates) ? getDiscountConfig().templates : [];
  return templates.filter(t => t.aktif !== false && Number(t.minBelanja || 0) <= subtotal)
    .sort((a, b) => Number(b.minBelanja || 0) - Number(a.minBelanja || 0));
}

function syncAutoDiscount() {
  if (!isDiscountFeatureEnabled()) return;
  const cfg = getDiscountConfig();
  if (!['auto', 'both'].includes(cfg.mode)) return;
  if (state.discountSource !== 'auto' && cfg.mode === 'both') return;
  const subtotal = getCartSubtotal();
  const eligible = getEligibleDiscountTemplates(subtotal);
  const selected = eligible.find(t => t.id === state.discountTemplateId);
  const template = selected || eligible[0];
  if (!template) {
    state.discountSource = 'auto';
    state.discountTemplateId = null;
    state.discountValue = 0;
    state.discountMode = 'percent';
    window._discountDraftValue = 0;
    return;
  }
  state.discountSource = 'auto';
  state.discountTemplateId = template.id;
  state.discountMode = template.tipe === 'nominal' ? 'nominal' : 'percent';
  state.discountValue = Number(template.nilai || 0);
  window._discountDraftValue = state.discountValue;
}

function renderKasir() {
  state.currentView = "kasir";
  if (!state.currentSession) { renderNoSession(); return; }

  syncAutoDiscount();

  const categoryContainer = document.getElementById('category-scroll-container');
  if (categoryContainer) state.lastCategoryScroll = categoryContainer.scrollLeft;
  const menuContainer = document.getElementById('menu-scroll-container');
  if (menuContainer) state.lastMenuScroll = menuContainer.scrollTop;
  const cartBody = document.querySelector('.pos-cart-body');
  if (cartBody) state.lastCartScroll = cartBody.scrollTop;

  const sortedCategories = [
    ...state.categories.filter(c => !c.system).sort((a, b) => a.name.localeCompare(b.name)),
    ...state.categories.filter(c => c.system)
  ];
  const categoryNames = ["ALL", ...sortedCategories.map(c => c.name)];
  const filteredMenus = (state.selectedCategory === "ALL"
    ? state.menus
    : state.menus.filter(m => {
      const cat = state.categories.find(c => c.id === m.categoryId);
      return cat && cat.name === state.selectedCategory;
    })
  ).filter(m => !state.kasirSearchQuery || m.name.toLowerCase().includes(state.kasirSearchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeTab = state.activeMobileTab || 'menu';
  const cartQty = state.cart.reduce((s, i) => s + i.qty, 0);
  const content = `
    <div class="pos-layout ${activeTab === 'menu' ? 'show-menu-tab' : 'show-cart-tab'}">
      <div class="pos-mobile-tabs">
        <button onclick="window.setMobileTab('menu')" class="pos-mobile-tab-btn ${activeTab === 'menu' ? 'active' : ''}">
          <i class="fas fa-utensils"></i> Menu
        </button>
        <button onclick="window.setMobileTab('cart')" class="pos-mobile-tab-btn ${activeTab === 'cart' ? 'active' : ''}">
          <i class="fas fa-shopping-cart"></i> Keranjang
          ${cartQty > 0 ? `<span class="pos-mobile-cart-badge">${cartQty}</span>` : ''}
        </button>
      </div>
      <div class="pos-left-panel">
        <div class="smart-header pos-header-sticky">
          <div id="category-scroll-container">
            ${categoryNames.map(c => `
              <button data-category="${Utils.escapeHtml(c)}"
                      onclick="selectCategory(this.dataset.category)"
                      class="category-btn ${state.selectedCategory === c ? 'active' : ''}">
                ${Utils.escapeHtml(c)}
              </button>
            `).join('')}
          </div>
          <div class="pos-search-wrapper">
            <i class="fas fa-search"></i>
            <input type="text" class="pos-search-input" placeholder="Cari..."
                   value="${Utils.escapeHtml(state.kasirSearchQuery || '')}" oninput="window._onKasirSearch(this.value)">
            ${state.kasirSearchQuery ? `
              <button class="pos-search-clear" onclick="window._clearKasirSearch()">
                <i class="fas fa-times-circle"></i>
              </button>
            ` : ''}
          </div>
        </div>
          <div class="menu-scroll-container" id="menu-scroll-container">
            <div class="menu-grid ${filteredMenus.length === 0 ? 'empty-grid' : ''}" id="menu-grid-container">
              ${filteredMenus.length === 0 ? `
                <div class="empty-state">
                  <i class="fas fa-search"></i>
                  <p>Produk tidak ditemukan</p>
                  ${state.kasirSearchQuery ? `<button class="btn btn-secondary btn-sm mt-2" onclick="window._clearKasirSearch()">Reset Pencarian</button>` : ''}
                </div>
              ` : filteredMenus.map(m => renderMenuItem(m)).join('')}
            </div>
          </div>
      </div>
      <div class="pos-right-panel">
        <div class="checkout-panel pos-checkout-panel">
          <div class="panel-header-inner">
            <h3 class="panel-title">
              <i class="fas fa-shopping-cart text-primary icon-mr"></i>
              Pesanan
            </h3>
            <span class="nav-badge">${state.cart.reduce((s, i) => s + i.qty, 0)}</span>
          </div>
          <div class="pos-cart-body">
            ${renderCartItems()}
          </div>
          <div class="panel-footer panel-footer-rounded">
            ${renderCartFooter()}
          </div>
          <div class="cart-pay-bar">
            ${renderCartActions()}
          </div>
        </div>
      </div>
    </div>
  `;

  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();

  requestAnimationFrame(() => {
    const _catEl = document.getElementById('category-scroll-container');
    if (_catEl && state.lastCategoryScroll > 0) _catEl.scrollLeft = state.lastCategoryScroll;
    const _menuEl = document.getElementById('menu-scroll-container');
    if (_menuEl && state.lastMenuScroll > 0) _menuEl.scrollTop = state.lastMenuScroll;
    const _cartEl = document.querySelector('.pos-cart-body');
    if (_cartEl && state.lastCartScroll > 0) _cartEl.scrollTop = state.lastCartScroll;
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.classList.add('main-kasir-override');
  });
}

function renderNoSession() {
  app.innerHTML = Layout.renderMain(`
    <div class="empty-center">
      <div class="empty-state large">
        <i class="fas fa-lock"></i>
        <h2>Tidak Ada Shift Aktif</h2>
        <p>Buka shift untuk memulai transaksi</p>
        <button class="btn btn-primary" onclick="bukaShift()">BUKA SHIFT</button>
      </div>
    </div>
  `);
  Layout._restoreSidebarScroll();
}

function renderMenuItem(m) {
  const stockOk = cekKetersediaanBahan(m);
  const stokOtomatis = !m.useStock && m.resep ? Utils.hitungStokProduk(m) : null;
  const stokTersedia = stokOtomatis !== null ? stokOtomatis : (m.useStock ? m.stock : null);
  const hasModifiers = (m.modifierGroupIds || []).length > 0;
  return `
    <div class="card hover-scale ${!stockOk.ok ? 'product-disabled' : ''}" onclick="addToCart('${m.id}')">
      ${m.imageUrl
      ? `<div class="card-img"><img src="${Utils.escapeHtml(m.imageUrl)}" alt="${Utils.escapeHtml(m.name)}" class="img-card-pos"></div>`
      : `<div class="img-placeholder-pos"><i class="fas fa-utensils"></i></div>`
    }
      <div class="card-title">${Utils.escapeHtml(m.name)}</div>
      <div class="card-price">Rp ${Utils.formatRupiah(m.price)}</div>
      ${hasModifiers ? `<div class="card-modifier-badge"><i class="fas fa-sliders-h"></i></div>` : ''}
      ${!stockOk.ok
      ? `<div class="card-stock text-danger"><i class="fas fa-exclamation-circle"></i> ${Utils.escapeHtml(stockOk.kurang)}</div>`
      : stokTersedia !== null
        ? `<div class="card-stock"><i class="fas ${m.resep ? 'fa-cubes' : 'fa-box'}"></i> Stok: ${stokTersedia} ${m.resep ? 'porsi' : ''}</div>`
        : `<div class="card-stock text-muted"><i class="fas fa-infinity"></i></div>`
    }
    </div>
  `;
}

function renderCartItems() {
  if (state.cart.length === 0) {
    return `
      <div class="empty-state">
        <i class="fas fa-shopping-basket"></i>
        <p>Belum ada pesanan</p>
      </div>
    `;
  }
  return state.cart.map(i => {
    const modTotal = _getItemModifierTotal(i);
    const unitPrice = i.price + modTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-main">
          <div class="cart-item-name">${Utils.escapeHtml(i.name)}</div>
          ${(i.modifiers || []).length > 0 ? `
            <div class="cart-item-modifiers">
              ${i.modifiers.map(mod => `
                <span class="cart-modifier-tag">
                  ${Utils.escapeHtml(mod.optionName)}${mod.price > 0 ? ` +${Utils.formatRupiah(mod.price)}` : ''}
                </span>
              `).join('')}
            </div>
          ` : ''}
          <div class="cart-item-notes-wrap">
            <input
              type="text"
              class="cart-notes-input"
              placeholder="Catatan... (opsional)"
              value="${Utils.escapeHtml(i.notes || '')}"
              oninput="updateCartNotes('${i.cartItemId}', this.value)"
            >
          </div>
          <div class="cart-item-price">Rp ${Utils.formatRupiah(unitPrice)} x ${i.qty}</div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-total">Rp ${Utils.formatRupiah(unitPrice * i.qty)}</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty('${i.cartItemId}',-1)"><i class="fas fa-minus"></i></button>
            <span>${i.qty}</span>
            <button class="qty-btn" onclick="changeQty('${i.cartItemId}',1)"><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDiscountBox() {
  const cfg = getDiscountConfig();
  const mode = cfg.mode || 'both';
  const eligible = getEligibleDiscountTemplates();
  const source = state.discountSource || 'manual';
  const canAuto = mode === 'auto' || mode === 'both';
  const canManual = mode === 'manual' || mode === 'both';
  return `<div class="discount-box">
    <div class="discount-title"><span><i class="fas fa-tags"></i> Diskon</span>${getDiscountAmount() > 0 ? `<button class="btn-icon-sm" onclick="clearDiscount()" title="Hapus diskon"><i class="fas fa-times"></i></button>` : ''}</div>
    ${mode === 'both' ? `<div class="discount-source-tabs">
      <button class="discount-source-btn ${source === 'auto' ? 'active' : ''}" onclick="setDiscountSource('auto')"><i class="fas fa-magic"></i> Otomatis</button>
      <button class="discount-source-btn ${source === 'manual' ? 'active' : ''}" onclick="setDiscountSource('manual')"><i class="fas fa-hand-pointer"></i> Manual</button>
    </div>` : ''}
    ${canAuto && source === 'auto' ? `
      <div class="discount-auto-wrap">
        <select class="form-input discount-template-select" onchange="window.selectDiscountTemplate(this.value)" ${eligible.length ? '' : 'disabled'}>
          ${eligible.length ? eligible.map(t => `<option value="${t.id}" ${state.discountTemplateId === t.id ? 'selected' : ''}>${t.nama || 'Template'} · Min Rp ${Utils.formatRupiah(Number(t.minBelanja || 0))} · ${t.tipe === 'nominal' ? 'Rp ' + Utils.formatRupiah(Number(t.nilai || 0)) : Number(t.nilai || 0) + '%'}</option>`).join('') : '<option selected>Tidak ada promo yang memenuhi syarat</option>'}
        </select>
        <small class="text-muted">${eligible.length > 1 ? 'Pilih promo yang ingin digunakan.' : eligible.length === 1 ? 'Promo tersedia berdasarkan subtotal saat ini.' : 'Naikkan subtotal untuk memenuhi minimal belanja promo.'}</small>
      </div>` : ''}
    ${canManual && source === 'manual' ? `
      <div class="discount-controls">
        <select class="form-input discount-mode-select" onchange="setDiscountMode(this.value)">
          <option value="percent" ${state.discountMode === 'percent' ? 'selected' : ''}>Persen (%)</option>
          <option value="nominal" ${state.discountMode === 'nominal' ? 'selected' : ''}>Nominal (Rp)</option>
        </select>
        <input type="number" min="0" ${state.discountMode === 'percent' ? 'max="100" step="0.01"' : ''} class="form-input discount-value-input" value="${window._discountDraftValue ?? state.discountValue ?? 0}" placeholder="0" oninput="window._discountDraftValue=this.value" onkeydown="if(event.key==='Enter')applyDiscount(this.value)">
        <button class="btn btn-secondary btn-sm" onclick="applyDiscount(document.querySelector('.discount-value-input')?.value)">Terapkan</button>
      </div>` : ''}
    ${getDiscountAmount() > 0 ? `<div class="discount-applied">- Rp ${Utils.formatRupiah(getDiscountAmount())}${source === 'auto' ? ' · Otomatis' : ' · Manual'}</div>` : ''}
  </div>`;
}

function renderCartActions() {
  const hasOpenBill = !!window._currentOpenBillId;
  const mejaEnabled = isMejaFeatureEnabled();
  const total = getTotal();
  const cartEmpty = state.cart.length === 0;

  return `
    <div class="cart-footer-actions">
      ${!cartEmpty ? `
        <button class="btn btn-secondary btn-block" onclick="simpanKeOpenBill()">
          <i class="fas fa-receipt"></i> ${hasOpenBill ? 'Update Open Bill' : 'Simpan Open Bill'}
        </button>
      ` : ''}
      <button class="btn btn-primary btn-block btn-large"
        onclick="showPaymentModal()"
        ${(cartEmpty || (mejaEnabled && !state.selectedTable && !hasOpenBill)) ? 'disabled' : ''}>
        <i class="fas fa-credit-card"></i> BAYAR (Rp ${Utils.formatRupiah(total)})
      </button>
    </div>
  `;
}

function renderCartFooter() {
  const hasOpenBill = !!window._currentOpenBillId;
  const mejaEnabled = isMejaFeatureEnabled();
  const discountEnabled = isDiscountFeatureEnabled();
  const mejaLabel = state.selectedTable
    ? `${state.selectedTable.nomor} - ${state.selectedTable.nama}`
    : 'Pilih meja';
  const total = getTotal();

  return `
    ${mejaEnabled ? `
    <div class="table-info mb-4">
      <div>
        <i class="fas fa-chair"></i>
        ${mejaLabel}
        ${hasOpenBill ? `<span class="badge badge-warning ml-1">Open Bill</span>` : ''}
      </div>
      <button class="btn btn-secondary btn-sm" onclick="pilihMeja()">Ganti</button>
    </div>` : ''}
    <div class="cart-summary">
      <div class="cart-summary-row"><span>Subtotal</span><span>Rp ${Utils.formatRupiah(getCartSubtotal())}</span></div>
      ${discountEnabled ? renderDiscountBox() : ''}
      <div class="total-row"><span>Total</span><span class="total-amount">Rp ${Utils.formatRupiah(total)}</span></div>
    </div>
  `;
}

function selectCategory(c) {
  state.selectedCategory = c;
  const categoryContainer = document.getElementById('category-scroll-container');
  if (categoryContainer) {
    categoryContainer.querySelectorAll('.category-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === c);
    });
  }
  _renderKasirMenuGrid();

  const grid = document.getElementById('menu-grid-container');
  if (grid) {
    grid.classList.remove('category-enter');
    void grid.offsetWidth;
    grid.classList.add('category-enter');
  }
}

function _renderKasirMenuGrid() {
  const filteredMenus = (state.selectedCategory === "ALL"
    ? state.menus
    : state.menus.filter(m => {
      const cat = state.categories.find(c => c.id === m.categoryId);
      return cat && cat.name === state.selectedCategory;
    })
  ).filter(m => !state.kasirSearchQuery || m.name.toLowerCase().includes(state.kasirSearchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const grid = document.getElementById('menu-grid-container');
  if (grid) {
    if (filteredMenus.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>Produk tidak ditemukan</p>
          ${state.kasirSearchQuery ? `<button class="btn btn-secondary btn-sm mt-2" onclick="window._clearKasirSearch()">Reset Pencarian</button>` : ''}
        </div>
      `;
      grid.classList.add('empty-grid');
    } else {
      grid.innerHTML = filteredMenus.map(m => renderMenuItem(m)).join('');
      grid.classList.remove('empty-grid');
    }
  }
}

function _addRecipeToStockPlan(plan, recipe, multiplier, contextLabel) {
  for (const bahan of recipe || []) {
    if (!bahan?.bahanId) {
      throw new Error(`${contextLabel} memiliki bahan yang tidak valid`);
    }
    const qtyPerUnit = Number(bahan.qty);
    if (!Number.isFinite(qtyPerUnit) || qtyPerUnit <= 0) {
      throw new Error(`${contextLabel} memiliki jumlah bahan yang tidak valid`);
    }
    const qty = qtyPerUnit * multiplier;
    plan.set(bahan.bahanId, (plan.get(bahan.bahanId) || 0) + qty);
  }
}

function _buildCartStockPlan(cartItems) {
  const plan = new Map();
  for (const item of cartItems || []) {
    const qtyItem = Number(item.qty || 0);
    if (!Number.isFinite(qtyItem) || qtyItem <= 0) continue;

    if (!item.useStock) {
      _addRecipeToStockPlan(plan, item.resep || [], qtyItem, `Resep ${item.name || item.id || 'produk'}`);
    }

    for (const mod of item.modifiers || []) {
      _addRecipeToStockPlan(
        plan,
        mod.resep || [],
        qtyItem,
        `Resep ${mod.optionName || 'varian/tambahan'}`
      );
    }
  }
  return plan;
}

function _checkCartStock(cartItems) {
  let plan;
  try {
    plan = _buildCartStockPlan(cartItems);
  } catch (error) {
    return { ok: false, kurang: error.message || 'Resep tidak valid' };
  }
  for (const [bahanId, required] of plan) {
    const bahanData = state.rawMaterials.find(b => b.id === bahanId);
    if (!bahanData) return { ok: false, kurang: `Bahan ${bahanId} tidak ditemukan`, bahanId, required };
    const stock = Number(bahanData.stock || 0);
    if (stock < required) {
      return {
        ok: false,
        kurang: `${bahanData.name} (butuh ${Utils.formatNumber ? Utils.formatNumber(required) : required} ${bahanData.satuan || 'pcs'}, tersisa ${Utils.formatNumber ? Utils.formatNumber(stock) : stock})`,
        bahanId,
        required,
        stock,
        bahan: bahanData
      };
    }
  }
  return { ok: true, plan };
}

function cekKetersediaanBahan(menu, qty = 1) {
  if (menu.useStock) return { ok: true };
  return _checkCartStock([{ ...menu, qty }]);
}

function _checkCartWithCandidate(candidate) {
  const cart = (state.cart || []).map(item =>
    item.cartItemId === candidate.cartItemId ? candidate : item
  );
  if (!cart.some(item => item.cartItemId === candidate.cartItemId)) cart.push(candidate);
  return _checkCartStock(cart);
}

function _getItemModifierTotal(item) {
  return (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
}

function getCartSubtotal() {
  return state.cart.reduce((s, i) => s + ((i.price + _getItemModifierTotal(i)) * i.qty), 0);
}

function getDiscountAmount(subtotal = getCartSubtotal()) {
  if (!isDiscountFeatureEnabled() && !window._currentOpenBillId) return 0;
  const value = Math.max(0, Number(state.discountValue) || 0);
  if (!subtotal || !value) return 0;
  if (state.discountMode === 'nominal') return Math.min(Math.round(value), subtotal);
  return Math.min(Math.round(subtotal * Math.min(value, 100) / 100), subtotal);
}

function getTotal() {
  return Math.max(0, getCartSubtotal() - getDiscountAmount());
}

window.setDiscountSource = function(source) {
  const cfg = getDiscountConfig();
  if (source === 'auto' && cfg.mode === 'manual') source = 'manual';
  if (source === 'manual' && cfg.mode === 'auto') source = 'auto';
  state.discountSource = source === 'auto' ? 'auto' : 'manual';
  if (state.discountSource === 'auto') syncAutoDiscount();
  else { state.discountTemplateId = null; state.discountValue = 0; state.discountMode = 'percent'; window._discountDraftValue = 0; }
  renderKasir();
};

window.selectDiscountTemplate = function(id) {
  const template = (getDiscountConfig().templates || []).find(t => t.id === id && t.aktif !== false);
  if (!template) { syncAutoDiscount(); renderKasir(); return; }
  if (getCartSubtotal() < Number(template.minBelanja || 0)) { Utils.showToast('Minimal belanja belum terpenuhi', 'warning'); syncAutoDiscount(); renderKasir(); return; }
  state.discountSource = 'auto';
  state.discountTemplateId = template.id;
  state.discountMode = template.tipe === 'nominal' ? 'nominal' : 'percent';
  state.discountValue = Number(template.nilai || 0);
  window._discountDraftValue = state.discountValue;
  renderKasir();
};

window.applyDiscount = function(value) {
  let v = Number(value);
  if (!Number.isFinite(v) || v < 0) v = 0;
  if (state.discountMode === 'percent') v = Math.min(v, 100);
  state.discountSource = 'manual';
  state.discountTemplateId = null;
  state.discountValue = v;
  window._discountDraftValue = v;
  renderKasir();
};

window.setDiscountMode = function(mode) {
  state.discountSource = 'manual';
  state.discountTemplateId = null;
  state.discountMode = mode === 'nominal' ? 'nominal' : 'percent';
  window._discountDraftValue = state.discountValue || 0;
  renderKasir();
};

window.clearDiscount = function() {
  state.discountSource = 'manual';
  state.discountTemplateId = null;
  state.discountValue = 0;
  window._discountDraftValue = 0;
  renderKasir();
};

function _genCartId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function _productStockOk(menu, extra) {
  if (!menu?.useStock) return true;
  const inCart = (state.cart || []).filter(c => c.id === menu.id).reduce((sum, c) => sum + Number(c.qty || 0), 0);
  return inCart + extra <= Number(menu.stock || 0);
}

async function addToCart(id) {
  const item = state.menus.find(m => m.id === id);
  if (!item) return;

  const stokOtomatis = !item.useStock && item.resep ? Utils.hitungStokProduk(item) : null;
  const stokTersedia = stokOtomatis !== null ? stokOtomatis : (item.useStock ? item.stock : Infinity);
  const stockOk = cekKetersediaanBahan(item);
  if (!stockOk.ok) { Utils.showToast(`${stockOk.kurang} tidak cukup!`, 'error'); return; }
  if (stokTersedia < 1) { Utils.showToast(`Stok ${item.name} habis!`, 'error'); return; }
  if (!_productStockOk(item, 1)) { Utils.showToast(`Stok ${item.name} tidak cukup!`, 'error'); return; }

  const modGroups = (item.modifierGroupIds || [])
    .map(gid => (state.modifierGroups || []).find(g => g.id === gid))
    .filter(Boolean);

  if (modGroups.length > 0) {
    await _showModifierModal(item, modGroups);
  } else {
    const exist = state.cart.find(c => c.id === id && (c.modifiers || []).length === 0);
    const candidate = exist
      ? { ...exist, qty: exist.qty + 1 }
      : { ...item, cartItemId: _genCartId(), qty: 1, modifiers: [], notes: '' };
    const cartStockOk = _checkCartWithCandidate(candidate);
    if (!cartStockOk.ok) { Utils.showToast(`${cartStockOk.kurang} tidak cukup!`, 'error'); return; }
    if (exist) exist.qty++;
    else state.cart.unshift(candidate);
    renderKasir();
  }
}

async function _showModifierModal(item, modGroups) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modifier-select-modal';

    const selections = {};
    modGroups.forEach(g => {
      selections[g.id] = (g.options || []).filter(o => o.isDefault).map(o => ({ ...o, groupId: g.id, groupName: g.name }));
    });

    function buildContent() {
      return modGroups.map(group => {
        const selected = selections[group.id] || [];
        return `
          <div class="modifier-group-section">
            <div class="modifier-group-label">
              ${group.name}
              <span class="badge ${group.required ? 'badge-danger' : 'badge-secondary'}">
                ${group.required ? 'Wajib' : 'Opsional'}
              </span>
              ${group.maxSelect > 1 ? `<span class="badge badge-info">Max ${group.maxSelect}</span>` : ''}
            </div>
            <div class="modifier-options-grid">
              ${(group.options || []).map(opt => {
          const isSelected = selected.some(s => s.id === opt.id);
          return `
                  <button
                    class="modifier-opt-btn ${isSelected ? 'selected' : ''}"
                    data-group="${group.id}"
                    data-opt="${opt.id}"
                    onclick="window._toggleModifierOpt('${group.id}','${opt.id}',${group.maxSelect},${group.required})"
                  >
                    <span>${Utils.escapeHtml(opt.name)}</span>
                    <span class="modifier-opt-price">
                      ${opt.price > 0 ? `+Rp ${Utils.formatRupiah(opt.price)}` : 'Gratis'}
                    </span>
                  </button>
                `;
        }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    modal.innerHTML = `
      <div class="modal modal-wide">
        <div class="modal-header">
          <h3><i class="fas fa-sliders-h"></i> Pilihan untuk ${Utils.escapeHtml(item.name)}</h3>
          <button class="btn-icon-sm" onclick="document.getElementById('modifier-select-modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body stack-y" id="modifier-modal-body">
          ${buildContent()}
        </div>
        <div class="modal-footer-inline">
          <button class="btn btn-secondary" onclick="document.getElementById('modifier-select-modal').remove()">Batal</button>
          <button class="btn btn-primary" id="confirm-modifier-btn" onclick="window._confirmModifier()">
            <i class="fas fa-cart-plus"></i> Tambah ke Pesanan
          </button>
        </div>
      </div>
    `;

    window._toggleModifierOpt = function(groupId, optId, maxSelect, required) {
      const group = modGroups.find(g => g.id === groupId);
      if (!group) return;
      const opt = group.options.find(o => o.id === optId);
      if (!opt) return;

      const sel = selections[groupId] || [];
      const idx = sel.findIndex(s => s.id === optId);

      if (idx >= 0) {
        if (required && sel.length <= 1) { Utils.showToast('Minimal 1 pilihan wajib dipilih', 'warning'); return; }
        selections[groupId] = sel.filter(s => s.id !== optId);
      } else {
        if (maxSelect === 1) {
          selections[groupId] = [{ ...opt, groupId, groupName: group.name }];
        } else {
          if (sel.length >= maxSelect) { Utils.showToast(`Maksimal ${maxSelect} pilihan`, 'warning'); return; }
          selections[groupId] = [...sel, { ...opt, groupId, groupName: group.name }];
        }
      }

      const body = document.getElementById('modifier-modal-body');
      if (body) body.innerHTML = buildContent();
    };

    window._confirmModifier = function() {
      for (const group of modGroups) {
        if (group.required && (selections[group.id] || []).length === 0) {
          Utils.showToast(`"${group.name}" wajib dipilih`, 'warning');
          return;
        }
      }

      const allSelected = Object.values(selections).flat();
      const cartItem = {
        ...item,
        cartItemId: _genCartId(),
        qty: 1,
        modifiers: allSelected.map(s => ({
          groupId: s.groupId,
          groupName: s.groupName,
          optionId: s.id,
          optionName: s.name,
          price: Number(s.price || 0),
          costPrice: Number(s.costPrice || 0),
          resep: s.resep || []
        })),
        notes: ''
      };

      if (!_productStockOk(item, 1)) {
        Utils.showToast(`Stok ${item.name} tidak cukup!`, 'error');
        return;
      }

      const cartStockOk = _checkCartWithCandidate(cartItem);
      if (!cartStockOk.ok) {
        Utils.showToast(`${cartStockOk.kurang} tidak cukup!`, 'error');
        return;
      }

      state.cart.unshift(cartItem);
      document.getElementById('modifier-select-modal')?.remove();
      renderKasir();
      resolve();
    };

    modal.addEventListener('click', e => {
      if (e.target === modal) { modal.remove(); resolve(); }
    });

    document.body.appendChild(modal);
  });
}

function changeQty(cartItemId, d) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (!item) return;
  const menu = state.menus.find(m => m.id === item.id);
  if (!menu) return;
  if (d > 0) {
    const candidate = { ...item, qty: item.qty + d };
    const candidateCart = (state.cart || []).map(c => c.cartItemId === item.cartItemId ? candidate : c);
    const stockOk = _checkCartStock(candidateCart);
    if (!stockOk.ok) { Utils.showToast(`${stockOk.kurang} tidak cukup!`, 'error'); return; }
    if (menu.useStock && !_productStockOk(menu, d)) { Utils.showToast(`Stok ${menu.name} tidak cukup!`, 'error'); return; }
  }
  item.qty += d;
  if (item.qty <= 0) state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
  renderKasir();
}

function updateCartNotes(cartItemId, value) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (item) item.notes = value;
}

async function pilihMeja() {
  const tables = state.tables.filter(t => t.aktif !== false).sort((a, b) => {
    const nc = String(a.nama).localeCompare(String(b.nama), undefined, { numeric: true, sensitivity: 'base' });
    return nc !== 0 ? nc : String(a.nomor).localeCompare(String(b.nomor), undefined, { numeric: true, sensitivity: 'base' });
  });

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-pilih-meja">
      <h3><i class="fas fa-chair"></i> Pilih Meja</h3>
      <div class="table-grid${tables.length ? '' : ' table-grid-empty'}">
        ${tables.length ? tables.map(meja => `
          <button class="table-btn" data-id="${meja.id}" data-nomor="${Utils.escapeHtml(meja.nomor)}" data-nama="${Utils.escapeHtml(meja.nama)}">
            <div class="table-number">${Utils.escapeHtml(meja.nomor)}</div>
            <div class="table-name text-bold-md mt-1 color-primary">${Utils.escapeHtml(meja.nama)}</div>
          </button>
        `).join('') : '<div class="empty-state"><i class="fas fa-chair"></i><p>Belum ada meja aktif</p></div>'}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll('.table-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedTable = {
        id: btn.dataset.id,
        nomor: btn.dataset.nomor,
        nama: btn.dataset.nama
      };
      modal.remove();
      Utils.showToast(`Meja ${btn.dataset.nomor} - ${btn.dataset.nama} dipilih`, 'success');
      renderKasir();
    });
  });
}

function _loadOpenBill(openBill, meja) {
  state.selectedTable = meja;
  state.cart = (openBill.items || []).map(i => ({
    ...i,
    price: i.price ?? i.salePrice ?? 0,
    salePrice: i.salePrice ?? i.price ?? 0,
    costPrice: i.costPrice ?? 0,
    cartItemId: i.cartItemId || _genCartId()
  }));
  state.discountMode = openBill.discountType || 'percent';
  state.discountValue = Number(openBill.discountValue) || 0;
  state.discountSource = openBill.discountSource || 'manual';
  state.discountTemplateId = openBill.discountTemplateId || null;
  window._discountDraftValue = state.discountValue;
  window._currentOpenBillId = openBill.id;
  Utils.showToast('Open bill dimuat', 'success');
  renderKasir();
}

async function simpanKeOpenBill() {
  if (state.cart.length === 0) { Utils.showToast('Keranjang kosong!', 'warning'); return; }

  const mejaAktif = isMejaFeatureEnabled();
  const mejaOptions = mejaAktif
    ? `<select id="open-bill-table-input" class="swal2-select" required><option value="">Pilih meja</option>${state.tables.filter(t => t.aktif !== false).sort((a, b) => String(a.nomor).localeCompare(String(b.nomor), undefined, { numeric: true })).map(t => `<option value="${t.id}" ${state.selectedTable?.id === t.id ? 'selected' : ''}>${Utils.escapeHtml(t.nomor)} - ${Utils.escapeHtml(t.nama)}</option>`).join('')}</select>`
    : '';
  const currentBill = window._currentOpenBillId ? (state.openBills || []).find(ob => ob.id === window._currentOpenBillId) : null;

  const result = await Swal.fire({
    title: currentBill ? 'Edit Open Bill' : 'Simpan Open Bill',
    html: `
      <div class="open-bill-form">
        <label class="swal2-input-label">Nama pelanggan <span class="text-danger">*</span></label>
        <input id="open-bill-name-input" class="swal2-input" value="${String(currentBill?.namaPelanggan || '').replace(/"/g, '&quot;')}" placeholder="Contoh: Budi">
        ${mejaAktif ? `<label class="swal2-input-label">Meja <span class="text-danger">*</span></label>${mejaOptions}` : ''}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: currentBill ? 'Simpan' : 'Simpan Open Bill',
    cancelButtonText: 'Batal',
    focusConfirm: false,
    customClass: { popup: 'swal2-is-medium' },
    preConfirm: () => {
      const nama = String(document.getElementById('open-bill-name-input')?.value || '').trim();
      if (!nama) {
        Swal.showValidationMessage('Nama pelanggan wajib diisi');
        return false;
      }
      const mejaId = document.getElementById('open-bill-table-input')?.value || '';
      if (mejaAktif && !mejaId) {
        Swal.showValidationMessage('Meja wajib dipilih');
        return false;
      }
      const meja = mejaAktif ? (state.tables.find(t => t.id === mejaId) || null) : null;
      return { namaPelanggan: nama, meja };
    }
  });

  if (!result.isConfirmed) return;

  const { namaPelanggan, meja } = result.value;
  const total = getTotal();
  const data = {
    namaPelanggan,
    mejaId: meja?.id || null,
    mejaNama: meja?.nama || null,
    mejaNomor: meja?.nomor || null,
    sessionId: state.currentSession.id,
    kasir: state.user.email,
    items: state.cart.map(i => ({
      ...i,
      price: Number(i.price || i.salePrice || 0),
      salePrice: Number(i.salePrice || i.price || 0),
      modifierTotal: _getItemModifierTotal(i),
      modifiers: (i.modifiers || []).map(mod => ({
        ...mod,
        price: Number(mod.price || 0),
        costPrice: Number(mod.costPrice || 0),
        resep: (mod.resep || []).map(b => ({ ...b }))
      }))
    })),
    subtotal: getCartSubtotal(),
    discountType: state.discountMode,
    discountValue: Number(state.discountValue) || 0,
    discountSource: state.discountSource || 'manual',
    discountTemplateId: state.discountTemplateId || null,
    discountAmount: getDiscountAmount(),
    total,
    status: 'open',
    updatedAt: new Date()
  };

  try {
    if (window._currentOpenBillId) {
      await dbCloud.collection('openBills').doc(window._currentOpenBillId).update(data);
      Utils.showToast('Open bill diperbarui', 'success');
    } else {
      data.createdAt = new Date();
      const ref = await dbCloud.collection('openBills').add(data);
      window._currentOpenBillId = ref.id;
      Utils.showToast('Open bill disimpan', 'success');
    }
    state.cart = [];
    state.selectedTable = null;
    state.discountMode = 'percent';
    state.discountValue = 0;
    state.discountSource = 'manual';
    state.discountTemplateId = null;
    window._discountDraftValue = 0;
    window._currentOpenBillId = null;
    renderKasir();
  } catch (err) {
    Utils.showToast(Utils.getFriendlyError(err, 'Gagal menyimpan open bill. Silakan coba lagi.'), 'error');
  }
}

let _bayarInFlight = false;

async function bayar() {
  if (_bayarInFlight) return;
  if (!state.currentSession) { bukaShift(); return; }
  if (isMejaFeatureEnabled() && !state.selectedTable && !window._directOpenBillPayment && !window._currentOpenBillId) { Utils.showToast("Pilih meja!", 'warning'); return; }
  if (state.cart.length === 0) { Utils.showToast("Keranjang kosong!", 'error'); return; }
  const total = getTotal();
  let cashAmount = 0, qrisAmount = 0, paid = 0;

  if (state.selectedPaymentMethod === 'tunai') {
    cashAmount = state.cashAmount || 0;
    paid = cashAmount;
    if (cashAmount < total) { Utils.showToast("Uang cash kurang!", 'error'); return; }
  } else if (state.selectedPaymentMethod === 'qris') {
    qrisAmount = total; paid = total;
  } else {
    cashAmount = state.cashAmount || 0;
    qrisAmount = state.qrisAmount || 0;
    paid = cashAmount + qrisAmount;
    if (qrisAmount > total) { Utils.showToast("Nominal QRIS tidak boleh melebihi total transaksi!", 'error'); return; }
    if (paid !== total) { Utils.showToast("Untuk pembayaran campuran, total cash + QRIS harus sama dengan total transaksi.", 'error'); return; }
  }

  _bayarInFlight = true;

  try {
    const stockPlan = new Map();
    const productPlan = new Map();
    const snapshotItems = [];

    for (const item of state.cart) {
      const produk = state.menus.find(m => m.id === item.id);
      if (!produk) throw new Error(`Produk "${item.name || item.id}" tidak ditemukan`);
      const recipeSnapshot = (!produk.useStock ? (produk.resep || []) : []).map(b => ({ ...b }));
      if (produk.useStock) {
        productPlan.set(item.id, (productPlan.get(item.id) || 0) + Number(item.qty || 0));
      }
      for (const bahan of recipeSnapshot) {
        if (!bahan?.bahanId) throw new Error(`Resep ${produk.name} memiliki bahan yang tidak valid`);
        const qty = Number(bahan.qty || 0) * Number(item.qty || 0);
        if (qty > 0) stockPlan.set(bahan.bahanId, (stockPlan.get(bahan.bahanId) || 0) + qty);
      }
      const modifierSnapshots = (item.modifiers || []).map(mod => ({
        ...mod,
        resep: (mod.resep || []).map(b => ({ ...b }))
      }));
      for (const mod of modifierSnapshots) {
        for (const bahan of mod.resep) {
          if (!bahan?.bahanId) throw new Error(`Resep modifier ${mod.optionName || ''} memiliki bahan yang tidak valid`);
          const qty = Number(bahan.qty || 0) * Number(item.qty || 0);
          if (qty > 0) stockPlan.set(bahan.bahanId, (stockPlan.get(bahan.bahanId) || 0) + qty);
        }
      }
      snapshotItems.push({ item, produk, recipeSnapshot, modifierSnapshots });
    }

    const trxData = {
      items: state.cart.map(i => {
        const grossSubtotal = (i.price + _getItemModifierTotal(i)) * i.qty;
        const cartSubtotal = getCartSubtotal();
        const allocatedDiscount = cartSubtotal > 0 ? Math.round(getDiscountAmount() * grossSubtotal / cartSubtotal) : 0;
        return {
          id: i.id,
          name: i.name,
          price: i.price,
          salePrice: i.price,
          costPrice: Number(i.costPrice || 0) + (i.modifiers || []).reduce((sum, mod) => sum + Number(mod.costPrice || 0), 0),
          costPriceIncludesModifiers: true,
          useStock: !!i.useStock,
          menuRecipeApplied: !i.useStock && Array.isArray(i.resep) && i.resep.length > 0,
          qty: i.qty,
          modifiers: i.modifiers || [],
          recipeSnapshot: ((snapshotItems.find(x => x.item === i)?.recipeSnapshot) || []).map(b => ({ ...b })),
          modifierTotal: _getItemModifierTotal(i),
          notes: i.notes || '',
          subtotal: grossSubtotal,
          discountAmount: allocatedDiscount,
          netSubtotal: Math.max(0, grossSubtotal - allocatedDiscount)
        };
      }),
      subtotal: getCartSubtotal(),
      discountType: state.discountMode,
      discountValue: Number(state.discountValue) || 0,
      discountSource: state.discountSource || 'manual',
      discountTemplateId: state.discountTemplateId || null,
      discountAmount: getDiscountAmount(),
      total, paid, change: paid - total,
      cashAmount, qrisAmount,
      metodeBayar: state.selectedPaymentMethod,
      sessionId: state.currentSession.id,
      mejaId: isMejaFeatureEnabled() ? (state.selectedTable?.id || null) : null,
      mejaNama: isMejaFeatureEnabled() ? (state.selectedTable?.nama || null) : null,
      mejaNomor: isMejaFeatureEnabled() ? (state.selectedTable?.nomor || null) : null,
      kasir: state.user.email,
      kasirNama: state.currentSession?.kasir || state.user.email,
      kasirAkun: state.user.email,
      date: new Date(),
      openBillId: window._currentOpenBillId || null
    };

    const trxRef = dbCloud.collection("transactions").doc();
    const sessionRef = dbCloud.collection("sessions").doc(state.currentSession.id);
    const openBillRef = window._currentOpenBillId ? dbCloud.collection('openBills').doc(window._currentOpenBillId) : null;

    if (openBillRef && !state.openBills.some(b => b.id === window._currentOpenBillId)) throw new AppError('Open bill ini sudah dibayar atau dibatalkan');
    for (const [id, qty] of stockPlan) {
      const bahan = state.rawMaterials.find(b => b.id === id);
      if (!bahan) throw new AppError(`Bahan ${id} tidak ditemukan`);
      if (Number(bahan.stock || 0) < qty) throw new AppError(`Stok ${bahan.name || id} tidak cukup`);
    }
    for (const [id, qty] of productPlan) {
      const menu = state.menus.find(m => m.id === id);
      if (!menu) throw new AppError(`Produk ${id} tidak ditemukan`);
      if (Number(menu.stock || 0) < qty) throw new AppError(`Stok ${menu.name || id} tidak cukup`);
    }

    const batch = dbCloud.batch();
    batch.set(trxRef, trxData);
    for (const [id, qty] of stockPlan) {
      batch.update(dbCloud.collection('raw_materials').doc(id), { stock: firebase.firestore.FieldValue.increment(-qty) });
    }
    for (const [id, qty] of productPlan) {
      batch.update(dbCloud.collection('menus').doc(id), { stock: firebase.firestore.FieldValue.increment(-qty) });
    }
    const now = new Date();
    for (const { item, produk, recipeSnapshot, modifierSnapshots } of snapshotItems) {
      for (const bahan of recipeSnapshot) {
        const qty = Number(bahan.qty || 0) * Number(item.qty || 0);
        batch.set(dbCloud.collection('stock_mutations').doc(), {
          type: 'out', source: 'sale', bahanId: bahan.bahanId, namaBahan: bahan.nama || bahan.namaBahan || bahan.name || '', qty,
          satuan: bahan.satuan || 'pcs', produkId: item.id, namaProduk: produk.name,
          transactionId: trxRef.id, sessionId: state.currentSession.id, userId: state.user.email, createdAt: now
        });
      }
      for (const mod of modifierSnapshots) {
        for (const bahan of mod.resep) {
          const qty = Number(bahan.qty || 0) * Number(item.qty || 0);
          batch.set(dbCloud.collection('stock_mutations').doc(), {
            type: 'out', source: 'sale', bahanId: bahan.bahanId, namaBahan: bahan.namaBahan || bahan.nama || bahan.name || '', qty,
            satuan: bahan.satuan || 'pcs', produkId: item.id, namaProduk: produk.name,
            modifierId: mod.optionId, namaModifier: mod.optionName, transactionId: trxRef.id, sessionId: state.currentSession.id,
            userId: state.user.email, createdAt: now
          });
        }
      }
      if (item.useStock) {
        batch.set(dbCloud.collection('stock_mutations').doc(), {
          type: 'out', source: 'sale', targetType: 'menu', menuId: item.id, qty: Number(item.qty || 0),
          produkId: item.id, namaProduk: produk.name, transactionId: trxRef.id,
          sessionId: state.currentSession.id, userId: state.user.email, createdAt: now
        });
      }
    }
    batch.update(sessionRef, {
      totalPenjualan: firebase.firestore.FieldValue.increment(total),
      jumlahTransaksi: firebase.firestore.FieldValue.increment(1),
      updatedAt: now
    });
    if (openBillRef) batch.update(openBillRef, { status: 'paid', paidAt: now, transactionId: trxRef.id });
    await batch.commit();

    const trxId = trxRef.id;

    trxData.id = trxId;
    let printOk = true;
    try {
      if (typeof window.printStruk === 'function') {
        const printResult = await window.printStruk(trxData);
        printOk = printResult !== false;
      }
    } catch (printError) {
      printOk = false;
      console.error('[IniKasir] Transaksi tersimpan, tetapi cetak struk gagal:', printError);
    }

    state.cart = [];
    state.selectedTable = null;
    state.cashAmount = 0;
    state.qrisAmount = 0;
    state.selectedPaymentMethod = 'tunai';
    state.discountSource = 'manual';
    state.discountTemplateId = null;
    state.discountMode = 'percent';
    state.discountValue = 0;
    window._discountDraftValue = 0;
    window._currentOpenBillId = null;

    Utils.showToast(printOk ? "Transaksi berhasil!" : "Transaksi berhasil disimpan. Struk belum tercetak.", printOk ? 'success' : 'warning');
    renderKasir();
  } catch (err) {
    console.error('[IniKasir] Pembayaran gagal:', err);
    if (/^Stok .+ tidak cukup$/i.test(String(err?.message || ''))) renderKasir();
    Utils.showToast(Utils.getFriendlyError(err, 'Transaksi gagal diproses. Silakan coba lagi.'), 'error');
  } finally {
    _bayarInFlight = false;
  }
}

async function showOpenBillPaymentModal(openBill) {
  if (!openBill) return;
  const snapshot = {
    cart: state.cart,
    selectedTable: state.selectedTable,
    discountMode: state.discountMode,
    discountValue: state.discountValue,
    discountSource: state.discountSource,
    discountTemplateId: state.discountTemplateId,
    cashAmount: state.cashAmount,
    qrisAmount: state.qrisAmount,
    selectedPaymentMethod: state.selectedPaymentMethod,
    discountDraftValue: window._discountDraftValue,
    currentOpenBillId: window._currentOpenBillId
  };
  _loadOpenBill(openBill, openBill.mejaId ? { id: openBill.mejaId, nomor: openBill.mejaNomor, nama: openBill.mejaNama } : null);
  state.cashAmount = 0;
  state.qrisAmount = 0;
  state.selectedPaymentMethod = 'tunai';
  window._directOpenBillPayment = { snapshot, openBillId: openBill.id };
  await showPaymentModal();
}

function _restoreDirectOpenBillPayment() {
  const context = window._directOpenBillPayment;
  if (!context) return;
  const s = context.snapshot;
  state.cart = s.cart;
  state.selectedTable = s.selectedTable;
  state.discountMode = s.discountMode;
  state.discountValue = s.discountValue;
  state.discountSource = s.discountSource;
  state.discountTemplateId = s.discountTemplateId;
  state.cashAmount = s.cashAmount;
  state.qrisAmount = s.qrisAmount;
  state.selectedPaymentMethod = s.selectedPaymentMethod;
  window._discountDraftValue = s.discountDraftValue;
  window._currentOpenBillId = s.currentOpenBillId;
  delete window._directOpenBillPayment;
  renderKasir();
}

async function showPaymentModal() {
  const total = getTotal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'payment-modal';
  modal.innerHTML = `
    <div class="modal">
      <h3><i class="fas fa-credit-card"></i> Pembayaran</h3>
      <div class="total-display">Rp ${Utils.formatRupiah(total)}</div>
      <div class="payment-grid">
        <button class="payment-option ${state.selectedPaymentMethod === 'tunai' ? 'active' : ''}" onclick="selectPaymentMethod('tunai')">
          <i class="fas fa-money-bill-wave"></i><span>CASH</span>
        </button>
        <button class="payment-option ${state.selectedPaymentMethod === 'qris' ? 'active' : ''}" onclick="selectPaymentMethod('qris')">
          <i class="fas fa-qrcode"></i><span>QRIS</span>
        </button>
        <button class="payment-option ${state.selectedPaymentMethod === 'mixed' ? 'active' : ''}" onclick="selectPaymentMethod('mixed')">
          <i class="fas fa-random"></i><span>CAMPUR</span>
        </button>
      </div>
      <div id="modalPaymentContent">${renderModalPaymentContent()}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="cancelPaymentBtn">Batal</button>
        <button class="btn btn-primary" id="processPaymentBtn">Proses</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.selectPaymentMethod = function(method) {
    state.selectedPaymentMethod = method;
    if (method === 'tunai') { state.cashAmount = 0; state.qrisAmount = 0; }
    else if (method === 'qris') { state.cashAmount = 0; state.qrisAmount = total; }
    else { state.cashAmount = 0; state.qrisAmount = 0; }
    const contentDiv = document.getElementById('modalPaymentContent');
    if (contentDiv) contentDiv.innerHTML = renderModalPaymentContent();
    document.querySelectorAll('.payment-option').forEach((btn, i) => {
      btn.classList.toggle('active', (method === 'tunai' && i === 0) || (method === 'qris' && i === 1) || (method === 'mixed' && i === 2));
    });
  };

  document.getElementById('cancelPaymentBtn').addEventListener('click', () => { modal.remove(); _restoreDirectOpenBillPayment(); });
  document.getElementById('processPaymentBtn').addEventListener('click', async function() {
    const btn = this;
    Utils.setButtonLoading(btn, true);
    try {
      await bayar();
      if (document.body.contains(modal)) modal.remove();
      if (window._directOpenBillPayment) _restoreDirectOpenBillPayment();
    } catch (error) {
      Utils.setButtonLoading(btn, false);
      Utils.showToast(Utils.getFriendlyError(error, 'Pembayaran gagal diproses. Silakan coba lagi.'), 'error');
    }
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
      _restoreDirectOpenBillPayment();
    }
  });
}

function renderModalPaymentContent() {
  const total = getTotal();
  if (state.selectedPaymentMethod === 'tunai') {
    return `
      <div>
        <label class="form-label">Nominal Cash</label>
        <input type="text" id="cash-input" class="form-input" placeholder="Masukkan nominal"
               oninput="handleCashInput(this.value)" autocomplete="off"
               value="${state.cashAmount ? Utils.formatRupiah(state.cashAmount) : ''}">
        <div class="quick-buttons">
          <button class="btn btn-secondary" onclick="quickCash(50000)">50K</button>
          <button class="btn btn-secondary" onclick="quickCash(100000)">100K</button>
          <button class="btn btn-secondary" onclick="quickCash(${total})">LUNAS</button>
        </div>
        <div class="change-info ${state.cashAmount >= total ? 'success' : 'warning'}">
          <span>${state.cashAmount >= total ? 'Kembalian' : 'Kekurangan'}</span>
          <span>Rp ${Utils.formatRupiah(Math.abs(state.cashAmount - total))}</span>
        </div>
      </div>
    `;
  }
  if (state.selectedPaymentMethod === 'qris') {
    return `
      <div class="qris-display">
        <i class="fas fa-qrcode qris-icon"></i>
        <div class="qris-amount">Rp ${Utils.formatRupiah(total)}</div>
        <p>Scan QRIS</p>
      </div>
    `;
  }
  return `
    <div>
      <div class="form-group">
        <label class="form-label">Cash</label>
        <div class="mixed-input-flex">
          <input type="text" id="mixed-cash-input" class="form-input" placeholder="Nominal"
                 oninput="handleMixedCashInput(this.value)" autocomplete="off"
                 value="${state.cashAmount ? Utils.formatRupiah(state.cashAmount) : ''}">
          <button class="btn btn-secondary" onclick="quickCash(50000)">50K</button>
          <button class="btn btn-secondary" onclick="quickCash(100000)">100K</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">QRIS</label>
        <div class="mixed-input-flex">
          <input type="text" id="mixed-qris-input" class="form-input" placeholder="Nominal"
                 oninput="handleMixedQrisInput(this.value)" autocomplete="off"
                 value="${state.qrisAmount ? Utils.formatRupiah(state.qrisAmount) : ''}">
          <button class="btn btn-secondary" onclick="quickQris(50000)">50K</button>
          <button class="btn btn-secondary" onclick="quickQris(100000)">100K</button>
        </div>
      </div>
      <div class="payment-summary">
        <div><span>Total</span><span>Rp ${Utils.formatRupiah(total)}</span></div>
        <div><span>Cash</span><span>Rp ${Utils.formatRupiah(state.cashAmount || 0)}</span></div>
        <div><span>QRIS</span><span>Rp ${Utils.formatRupiah(state.qrisAmount || 0)}</span></div>
        <div class="total"><span>Dibayar</span><span>Rp ${Utils.formatRupiah((state.cashAmount || 0) + (state.qrisAmount || 0))}</span></div>
        <div class="${(state.cashAmount || 0) + (state.qrisAmount || 0) >= total ? 'success' : 'warning'}">
          <span>${(state.cashAmount || 0) + (state.qrisAmount || 0) >= total ? 'Kembalian' : 'Kekurangan'}</span>
          <span>Rp ${Utils.formatRupiah(Math.abs((state.cashAmount || 0) + (state.qrisAmount || 0) - total))}</span>
        </div>
      </div>
    </div>
  `;
}

window.handleCashInput = function(value) {
  const cash = parseInt(value.replace(/\./g, '')) || 0;
  const total = getTotal();
  state.cashAmount = cash;
  const changeInfo = document.querySelector('.change-info');
  if (changeInfo) {
    changeInfo.className = `change-info ${cash >= total ? 'success' : 'warning'}`;
    changeInfo.innerHTML = `<span>${cash >= total ? 'Kembalian' : 'Kekurangan'}</span><span>Rp ${Utils.formatRupiah(Math.abs(cash - total))}</span>`;
  }
};

window.handleMixedCashInput = function(value) {
  const cash = parseInt(value.replace(/\./g, '')) || 0;
  const total = getTotal();
  state.cashAmount = cash;
  state.qrisAmount = Math.max(0, total - cash);
  const qi = document.getElementById('mixed-qris-input');
  if (qi && state.qrisAmount > 0) qi.value = Utils.formatRupiah(state.qrisAmount);
  else if (qi) qi.value = '';
  updateMixedSummary();
};

window.handleMixedQrisInput = function(value) {
  const qris = parseInt(value.replace(/\./g, '')) || 0;
  const total = getTotal();
  state.qrisAmount = qris;
  state.cashAmount = Math.max(0, total - qris);
  const ci = document.getElementById('mixed-cash-input');
  if (ci && state.cashAmount > 0) ci.value = Utils.formatRupiah(state.cashAmount);
  else if (ci) ci.value = '';
  updateMixedSummary();
};

function updateMixedSummary() {
  const total = getTotal();
  const paid = (state.cashAmount || 0) + (state.qrisAmount || 0);
  const summary = document.querySelector('.payment-summary');
  if (summary) {
    summary.innerHTML = `
      <div><span>Total</span><span>Rp ${Utils.formatRupiah(total)}</span></div>
      <div><span>Cash</span><span>Rp ${Utils.formatRupiah(state.cashAmount || 0)}</span></div>
      <div><span>QRIS</span><span>Rp ${Utils.formatRupiah(state.qrisAmount || 0)}</span></div>
      <div class="total"><span>Dibayar</span><span>Rp ${Utils.formatRupiah(paid)}</span></div>
      <div class="${paid >= total ? 'success' : 'warning'}">
        <span>${paid >= total ? 'Kembalian' : 'Kekurangan'}</span>
        <span>Rp ${Utils.formatRupiah(Math.abs(paid - total))}</span>
      </div>
    `;
  }
}

window.quickCash = function(amount) {
  if (state.selectedPaymentMethod === 'mixed') {
    const total = getTotal();
    state.cashAmount = Math.min(amount, total);
    state.qrisAmount = total - state.cashAmount;
    const ci = document.getElementById('mixed-cash-input');
    const qi = document.getElementById('mixed-qris-input');
    if (ci) ci.value = Utils.formatRupiah(state.cashAmount);
    if (qi) qi.value = state.qrisAmount > 0 ? Utils.formatRupiah(state.qrisAmount) : '';
    updateMixedSummary();
  } else {
    state.cashAmount = amount;
    const ci = document.getElementById('cash-input');
    if (ci) ci.value = Utils.formatRupiah(amount);
    window.handleCashInput(String(amount));
  }
};

window.quickQris = function(amount) {
  const total = getTotal();
  state.qrisAmount = Math.min(Math.max(amount, 0), total);
  state.cashAmount = total - state.qrisAmount;
  const ci = document.getElementById('mixed-cash-input');
  const qi = document.getElementById('mixed-qris-input');
  if (ci) ci.value = state.cashAmount > 0 ? Utils.formatRupiah(state.cashAmount) : '';
  if (qi) qi.value = Utils.formatRupiah(state.qrisAmount);
  updateMixedSummary();
};

window.renderKasir = renderKasir;
window.selectCategory = selectCategory;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.updateCartNotes = updateCartNotes;
window.getTotal = getTotal;
window.pilihMeja = pilihMeja;
window.simpanKeOpenBill = simpanKeOpenBill;
window.bayar = bayar;
window.showPaymentModal = showPaymentModal;
window.showOpenBillPaymentModal = showOpenBillPaymentModal;

window._onKasirSearch = function(val) {
  state.kasirSearchQuery = val;
  _renderKasirMenuGrid();
};

window._clearKasirSearch = function() {
  state.kasirSearchQuery = '';
  renderKasir();
};
window.renderModalPaymentContent = renderModalPaymentContent;
window._loadOpenBill = _loadOpenBill;

window.setMobileTab = function(tab) {
  state.activeMobileTab = tab;
};
