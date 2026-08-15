let _optRowIdx = 0;
let _modSearchQuery = '';

let lastModifierScroll = 0;

function _saveModifierScroll() {
  const m = document.querySelector('main');
  if (m) lastModifierScroll = m.scrollTop;
}

function renderModifierManager() {
  _saveModifierScroll();
  state.currentView = 'modifierManager';
  const groups = state.modifierGroups || [];

  const filteredGroups = !(_modSearchQuery || '').trim() ? groups :
    groups.filter(g => g.name.toLowerCase().includes(_modSearchQuery.toLowerCase()) || 
                      (g.options || []).some(o => o.name.toLowerCase().includes(_modSearchQuery.toLowerCase())));

  const content = `
    <div class="stack-y">
      <div class="management-control-bar">
        <div class="search-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Cari modifier..." 
                 value="${_modSearchQuery}" oninput="window._onModSearch(this.value)">
        </div>
        
        <div class="management-stats">
          <div class="stat-item">
            <i class="fas fa-layer-group"></i> <span class="text-muted">Total:</span> <span>${groups.length} Group</span>
          </div>
          ${_modSearchQuery ? `
            <div class="stat-divider"></div>
            <div class="stat-item">
              <i class="fas fa-filter"></i> <span class="text-muted">Hasil:</span> <span class="text-primary">${filteredGroups.length}</span>
            </div>
          ` : ''}
        </div>

        <div class="management-actions">
          <button class="btn btn-primary" onclick="showAddModifierGroupModal()">
            <i class="fas fa-plus"></i> Tambah Group
          </button>
        </div>
      </div>

      ${filteredGroups.length === 0 ? `
        <div class="empty-center">
          <div class="empty-state large">
            <i class="fas ${_modSearchQuery ? 'fa-search' : 'fa-sliders-h'}"></i>
            <h2>${_modSearchQuery ? 'Modifier Tidak Ditemukan' : 'Belum Ada Modifier'}</h2>
            <p>${_modSearchQuery ? `Tidak ada hasil untuk "${_modSearchQuery}"` : 'Buat modifier group untuk add-on atau pilihan menu'}</p>
            ${_modSearchQuery ? `
              <button class="btn btn-secondary btn-sm" onclick="window._onModSearch('')">Reset Pencarian</button>
            ` : `
              <button class="btn btn-primary" onclick="showAddModifierGroupModal()">
                <i class="fas fa-plus"></i> Tambah Group
              </button>
            `}
          </div>
        </div>
      ` : `
        <div class="modifier-group-list">
          ${filteredGroups.map(g => _renderGroupCard(g)).join('')}
        </div>
      `}
    </div>
  `;

  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();
  requestAnimationFrame(() => { const mn = document.querySelector("main"); if (mn && lastModifierScroll > 0) mn.scrollTop = lastModifierScroll; });
}

function _renderGroupCard(group) {
  const linked = (state.menus || []).filter(m => (m.modifierGroupIds || []).includes(group.id));
  return `
    <div class="modifier-group-card card">
      <div class="modifier-group-header">
        <div class="modifier-group-info">
          <div class="modifier-group-name">${group.name}</div>
          <div class="modifier-group-badges">
            <span class="badge ${group.required ? 'badge-danger' : 'badge-secondary'}">
              ${group.required ? 'Wajib' : 'Opsional'}
            </span>
            <span class="badge badge-info">Max ${group.maxSelect || 1} pilihan</span>
          </div>
        </div>
        <div class="modifier-group-actions">
          <button class="btn-icon-sm" onclick="editModifierGroup('${group.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon-sm btn-icon-danger" onclick="deleteModifierGroup('${group.id}')" title="Hapus">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="modifier-options-preview">
        ${(group.options || []).map(opt => `
          <div class="modifier-option-chip">
            ${opt.isDefault ? '<i class="fas fa-check-circle text-success"></i>' : ''}
            <span>${opt.name}</span>
            <span class="modifier-option-price-chip">
              ${opt.price > 0 ? `+Rp ${Utils.formatRupiah(opt.price)}` : 'Gratis'}
            </span>
            ${(opt.resep && opt.resep.length > 0) ? `
              <span class="badge badge-info" title="Punya resep bahan">
                <i class="fas fa-flask"></i> ${opt.resep.length} bahan
              </span>
            ` : ''}
          </div>
        `).join('')}
      </div>
      <div class="modifier-linked-menus">
        <i class="fas ${linked.length > 0 ? 'fa-link text-primary' : 'fa-unlink text-muted'}"></i>
        <small>${linked.length > 0 ? linked.map(m => m.name).join(', ') : 'Belum terhubung ke menu manapun'}</small>
      </div>
    </div>
  `;
}

function _buildModalShell(id, title, bodyHtml) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = id;
  modal.innerHTML = `
    <div class="modal modal-wide">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn-icon-sm" onclick="document.getElementById('${id}').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body stack-y">${bodyHtml}</div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  return modal;
}

function _getBahanOptions(selectedId = '') {
  const bahans = (state.rawMaterials || []).sort((a, b) => a.name.localeCompare(b.name));
  if (bahans.length === 0) return '<option value="">Belum ada bahan</option>';
  return `<option value="">Pilih Bahan</option>` +
    bahans.map(b =>
      `<option value="${b.id}" data-satuan="${b.satuan || 'pcs'}" ${b.id === selectedId ? 'selected' : ''}>${b.name} (${b.satuan || 'pcs'})</option>`
    ).join('');
}

function _resepRowHtml(optIdx, resepIdx, resepItem = {}) {
  const rowId = `resep-${optIdx}-${resepIdx}`;
  return `
    <div class="recipe-row" id="${rowId}">
      <select class="recipe-select opt-resep-bahan" data-opt="${optIdx}" data-idx="${resepIdx}"
        onchange="window._onModResepBahanChange('${optIdx}','${resepIdx}')">
        ${_getBahanOptions(resepItem.bahanId || '')}
      </select>
      <input type="number" class="recipe-input opt-resep-qty" data-opt="${optIdx}" data-idx="${resepIdx}"
        placeholder="Jumlah" min="0.01" step="0.01" value="${resepItem.qty || 1}">
      <span class="recipe-unit opt-resep-satuan" id="satuan-${optIdx}-${resepIdx}">
        ${resepItem.satuan || 'pcs'}
      </span>
      <button type="button" class="recipe-remove" onclick="document.getElementById('${rowId}').remove()">×</button>
    </div>
  `;
}

function _resepSectionHtml(optIdx, resep = []) {
  const rows = resep.length > 0
    ? resep.map((r, i) => _resepRowHtml(optIdx, i, r)).join('')
    : _resepRowHtml(optIdx, 0);
  return `
    <div class="opt-resep-section" id="resep-section-${optIdx}">
      <div class="opt-resep-header mb-sm">
        <small class="text-muted"><i class="fas fa-flask"></i> Resep Bahan (opsional)</small>
      </div>
      <div class="recipe-container" id="resep-container-${optIdx}">
        ${rows}
      </div>
      <button type="button" class="recipe-add btn btn-sm btn-outline-primary btn-dashed-full" onclick="window._addModResepRow('${optIdx}')">
        <i class="fas fa-plus"></i> Tambah Bahan
      </button>
    </div>
  `;
}

window._onModResepBahanChange = function(optIdx, resepIdx) {
  const sel = document.querySelector(`.opt-resep-bahan[data-opt="${optIdx}"][data-idx="${resepIdx}"]`);
  const satuanEl = document.getElementById(`satuan-${optIdx}-${resepIdx}`);
  if (sel && satuanEl) {
    const opt = sel.options[sel.selectedIndex];
    satuanEl.textContent = opt?.dataset?.satuan || 'pcs';
  }
};

window._addModResepRow = function(optIdx) {
  const container = document.getElementById(`resep-container-${optIdx}`);
  if (!container) return;
  const idx = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = _resepRowHtml(optIdx, idx);
  container.appendChild(div.firstElementChild);
};

function _optionRowHtml(idx, opt = {}) {
  return `
    <div class="modifier-option-row-wrap border-bottom-light" data-id="${opt.id || ''}" id="opt-row-${idx}">
      <div class="modifier-option-row mb-sm">
        <input type="text" class="form-input opt-name" placeholder="Nama opsi" value="${opt.name || ''}">
        <div class="input-currency-wrapper">
          <span class="input-currency-prefix">Rp</span>
          <input type="number" class="form-input opt-price input-with-currency" placeholder="0" value="${opt.price === undefined ? '' : opt.price}" min="0">
        </div>
        <label class="modifier-default-label">
          <input type="checkbox" class="opt-default" ${opt.isDefault ? 'checked' : ''}> Default
        </label>
        <button class="btn-icon-sm btn-icon-danger ml-auto" onclick="document.getElementById('opt-row-${idx}').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      ${_resepSectionHtml(idx, opt.resep || [])}
    </div>
  `;
}

function _collectResep(optIdx) {
  const container = document.getElementById(`resep-container-${optIdx}`);
  if (!container) return [];
  const resep = [];
  container.querySelectorAll('.recipe-row').forEach(row => {
    const bahanSel = row.querySelector('.opt-resep-bahan');
    const qtyInput = row.querySelector('.opt-resep-qty');
    const satuanEl = row.querySelector('.opt-resep-satuan');
    const bahanId = bahanSel?.value;
    const qty = parseFloat(qtyInput?.value) || 0;
    if (bahanId && qty > 0) {
      const bahan = (state.rawMaterials || []).find(b => b.id === bahanId);
      resep.push({
        bahanId,
        namaBahan: bahan?.name || '',
        qty,
        satuan: satuanEl?.textContent?.trim() || bahan?.satuan || 'pcs'
      });
    }
  });
  return resep;
}

function _collectResepFromRow(optWrapRow) {
  const container = optWrapRow.querySelector('.recipe-container');
  if (!container) return [];
  const resep = [];
  container.querySelectorAll('.recipe-row').forEach(row => {
    const bahanSel = row.querySelector('.opt-resep-bahan');
    const qtyInput = row.querySelector('.opt-resep-qty');
    const satuanEl = row.querySelector('.opt-resep-satuan');
    const bahanId = bahanSel?.value;
    const qty = parseFloat(qtyInput?.value) || 0;
    if (bahanId && qty > 0) {
      const bahan = (state.rawMaterials || []).find(b => b.id === bahanId);
      resep.push({
        bahanId,
        namaBahan: bahan?.name || '',
        qty,
        satuan: satuanEl?.textContent?.trim() || bahan?.satuan || 'pcs'
      });
    }
  });
  return resep;
}

function _collectOptions(containerSelector) {
  const rows = document.querySelectorAll(`${containerSelector} .modifier-option-row-wrap`);
  const options = [];
  rows.forEach((row) => {
    const name = row.querySelector('.opt-name')?.value?.trim();
    const price = parseInt(row.querySelector('.opt-price')?.value) || 0;
    const isDefault = row.querySelector('.opt-default')?.checked || false;
    const id = row.dataset.id || _genId();
    const resep = _collectResepFromRow(row);
    if (name) options.push({ id, name, price, isDefault, resep });
  });
  return options;
}

function _genId() {
  return Math.random().toString(36).substr(2, 9);
}

async function _syncMenuLinks(groupId, newMenuIds, oldMenuIds = []) {
  const toAdd = newMenuIds.filter(id => !oldMenuIds.includes(id));
  const toRemove = oldMenuIds.filter(id => !newMenuIds.includes(id));
  if (toAdd.length === 0 && toRemove.length === 0) return;
  const batch = dbCloud.batch();
  toAdd.forEach(menuId => {
    const menu = state.menus.find(m => m.id === menuId);
    const existing = menu?.modifierGroupIds || [];
    if (!existing.includes(groupId)) {
      batch.update(dbCloud.collection('menus').doc(menuId), {
        modifierGroupIds: [...existing, groupId]
      });
    }
  });
  toRemove.forEach(menuId => {
    const menu = state.menus.find(m => m.id === menuId);
    const existing = (menu?.modifierGroupIds || []).filter(gid => gid !== groupId);
    batch.update(dbCloud.collection('menus').doc(menuId), { modifierGroupIds: existing });
  });
  await batch.commit();
}

function _menuChecklistHtml(checkedIds = [], cssClass = 'mg-menu-check') {
  const menus = (state.menus || []).sort((a, b) => a.name.localeCompare(b.name));
  if (menus.length === 0) return '<small class="text-muted">Belum ada menu</small>';
  return `
    <div class="modifier-menu-link-grid">
      ${menus.map(m => `
        <label class="checkbox-label">
          <input type="checkbox" class="${cssClass}" value="${m.id}" ${checkedIds.includes(m.id) ? 'checked' : ''}>
          ${m.name}
        </label>
      `).join('')}
    </div>
  `;
}

function showAddModifierGroupModal() {
  _optRowIdx = 1;
  const body = `
    <div class="form-group">
      <label class="form-label">Nama Group Modifier</label>
      <input type="text" id="mgNama" class="form-input" placeholder="cth: Pilihan Nasi, Tambahan Topping">
    </div>
    <div class="form-row-equal">
      <div class="form-group">
        <label class="form-label">Tipe</label>
        <select id="mgRequired" class="form-input">
          <option value="false">Opsional</option>
          <option value="true">Wajib dipilih</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Maks Pilihan</label>
        <input type="number" id="mgMax" class="form-input" value="1" min="1">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Daftar Opsi</label>
      <div id="mg-opts" class="modifier-options-editor">
        ${_optionRowHtml(0)}
      </div>
      <button class="btn btn-sm btn-secondary mg-add-opt-btn" onclick="window._addOptRow()">
        <i class="fas fa-plus"></i> Tambah Opsi
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Hubungkan ke Menu <span class="text-muted">(opsional)</span></label>
      ${_menuChecklistHtml()}
    </div>
    <div class="modal-footer-inline">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-add-modifier').remove()">Batal</button>
      <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);saveNewModifierGroup().finally(()=>Utils.setButtonLoading(b,false))">
        <i class="fas fa-save"></i> Simpan
      </button>
    </div>
  `;
  _buildModalShell('modal-add-modifier', '<i class="fas fa-plus"></i> Tambah Modifier Group', body);
}

window._addOptRow = function() {
  const container = document.getElementById('mg-opts');
  if (!container) return;
  const idx = _optRowIdx++;
  const div = document.createElement('div');
  div.innerHTML = _optionRowHtml(idx);
  container.appendChild(div.firstElementChild);
};

async function saveNewModifierGroup() {
  const nama = document.getElementById('mgNama')?.value?.trim();
  if (!nama) { Utils.showToast('Nama group wajib diisi', 'warning'); return; }
  const required = document.getElementById('mgRequired')?.value === 'true';
  const maxSelect = parseInt(document.getElementById('mgMax')?.value) || 1;
  const options = _collectOptions('#mg-opts');
  if (options.length === 0) { Utils.showToast('Tambahkan minimal 1 opsi', 'warning'); return; }
  const linkedIds = [...document.querySelectorAll('.mg-menu-check:checked')].map(c => c.value);

  const ref = await dbCloud.collection('modifierGroups').add({
    name: nama, required,
    minSelect: required ? 1 : 0,
    maxSelect, options,
    createdAt: new Date()
  });

  await _syncMenuLinks(ref.id, linkedIds);
  document.getElementById('modal-add-modifier')?.remove();
  Utils.showToast('Modifier group berhasil ditambahkan', 'success');
}

async function editModifierGroup(id) {
  const group = (state.modifierGroups || []).find(g => g.id === id);
  if (!group) return;
  _optRowIdx = (group.options?.length || 1);
  const oldLinked = (state.menus || []).filter(m => (m.modifierGroupIds || []).includes(id)).map(m => m.id);

  const body = `
    <div class="form-group">
      <label class="form-label">Nama Group Modifier</label>
      <input type="text" id="mgEditNama" class="form-input" value="${group.name}">
    </div>
    <div class="form-row-equal">
      <div class="form-group">
        <label class="form-label">Tipe</label>
        <select id="mgEditRequired" class="form-input">
          <option value="false" ${!group.required ? 'selected' : ''}>Opsional</option>
          <option value="true" ${group.required ? 'selected' : ''}>Wajib dipilih</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Maks Pilihan</label>
        <input type="number" id="mgEditMax" class="form-input" value="${group.maxSelect || 1}" min="1">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Daftar Opsi</label>
      <div id="mg-edit-opts" class="modifier-options-editor">
        ${(group.options || []).map((opt, i) => _optionRowHtml(i, opt)).join('')}
      </div>
      <button class="btn btn-sm btn-secondary mg-add-opt-btn" onclick="window._addEditOptRow()">
        <i class="fas fa-plus"></i> Tambah Opsi
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Hubungkan ke Menu</label>
      ${_menuChecklistHtml(oldLinked, 'mg-edit-menu-check')}
    </div>
    <div class="modal-footer-inline">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-edit-modifier').remove()">Batal</button>
      <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);saveEditModifierGroup('${id}').finally(()=>Utils.setButtonLoading(b,false))">
        <i class="fas fa-save"></i> Simpan
      </button>
    </div>
  `;
  _buildModalShell('modal-edit-modifier', '<i class="fas fa-edit"></i> Edit Modifier Group', body);
  window._editModGroupOldLinked = oldLinked;
}

window._addEditOptRow = function() {
  const container = document.getElementById('mg-edit-opts');
  if (!container) return;
  const idx = _optRowIdx++;
  const div = document.createElement('div');
  div.innerHTML = _optionRowHtml(idx);
  container.appendChild(div.firstElementChild);
};

async function saveEditModifierGroup(id) {
  const nama = document.getElementById('mgEditNama')?.value?.trim();
  if (!nama) { Utils.showToast('Nama group wajib diisi', 'warning'); return; }
  const required = document.getElementById('mgEditRequired')?.value === 'true';
  const maxSelect = parseInt(document.getElementById('mgEditMax')?.value) || 1;
  const options = _collectOptions('#mg-edit-opts');
  if (options.length === 0) { Utils.showToast('Tambahkan minimal 1 opsi', 'warning'); return; }
  const newLinked = [...document.querySelectorAll('.mg-edit-menu-check:checked')].map(c => c.value);
  const oldLinked = window._editModGroupOldLinked || [];

  await dbCloud.collection('modifierGroups').doc(id).update({
    name: nama, required,
    minSelect: required ? 1 : 0,
    maxSelect, options
  });

  await _syncMenuLinks(id, newLinked, oldLinked);
  document.getElementById('modal-edit-modifier')?.remove();
  Utils.showToast('Modifier group berhasil diupdate', 'success');
}

async function deleteModifierGroup(id) {
  const result = await Swal.fire({
    title: 'Hapus Modifier Group?',
    text: 'Menu yang terhubung akan kehilangan modifier ini.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#dc3545',
    customClass: { popup: 'swal2-is-konfirmasi' }
  });
  if (!result.isConfirmed) return;

  const linked = (state.menus || []).filter(m => (m.modifierGroupIds || []).includes(id));
  if (linked.length > 0) {
    const batch = dbCloud.batch();
    linked.forEach(menu => {
      batch.update(dbCloud.collection('menus').doc(menu.id), {
        modifierGroupIds: (menu.modifierGroupIds || []).filter(gid => gid !== id)
      });
    });
    await batch.commit();
  }

  await dbCloud.collection('modifierGroups').doc(id).delete();
  Utils.showToast('Modifier group dihapus', 'success');
}

window.renderModifierManager = renderModifierManager;
window.showAddModifierGroupModal = showAddModifierGroupModal;
window.saveNewModifierGroup = saveNewModifierGroup;
window.editModifierGroup = editModifierGroup;
window.saveEditModifierGroup = saveEditModifierGroup;
window.deleteModifierGroup = deleteModifierGroup;

window._onModSearch = function(val) {
  _modSearchQuery = val;
  renderModifierManager();
  const input = document.querySelector('.search-input');
  if (input) {
    input.focus();
    input.setSelectionRange(val.length, val.length);
  }
};
