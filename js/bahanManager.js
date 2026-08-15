let lastBahanScroll = 0;
let _bahanSearchQuery = '';

function renderBahanManager() {
  const _m = document.querySelector('main');
  if (_m && state.currentView === "bahanManager") lastBahanScroll = _m.scrollTop;

  state.currentView = "bahanManager";
  const lowStockMaterials = state.rawMaterials.filter(b => b.stock <= (b.minStock || 5));
  const sortedBahan = SortableTable.sort(state.rawMaterials, 'bahan');
  const filteredBahan = !(_bahanSearchQuery || '').trim() ? sortedBahan :
    sortedBahan.filter(b => b.name.toLowerCase().includes(_bahanSearchQuery.toLowerCase()) || 
                          (b.supplier || '').toLowerCase().includes(_bahanSearchQuery.toLowerCase()));

  const content = `
    <div class="stack-y">
      <div class="management-control-bar">
        <div class="search-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Cari bahan..." 
                 value="${_bahanSearchQuery}" oninput="window._onBahanSearch(this.value)">
        </div>
        
        <div class="management-stats">
          <div class="stat-item">
            <i class="fas fa-boxes"></i> <span class="text-muted">Total:</span> <span>${state.rawMaterials.length}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <i class="fas fa-exclamation-triangle"></i> <span class="text-muted">Menipis:</span> <span class="${lowStockMaterials.length > 0 ? 'text-warning' : ''}">${lowStockMaterials.length}</span>
          </div>
          ${_bahanSearchQuery ? `
            <div class="stat-divider"></div>
            <div class="stat-item">
              <i class="fas fa-filter"></i> <span class="text-muted">Hasil:</span> <span class="text-primary">${filteredBahan.length}</span>
            </div>
          ` : ''}
        </div>

        <div class="management-actions">
          <button class="btn btn-primary" onclick="showAddBahanModal()">
            <i class="fas fa-plus"></i> Tambah Bahan
          </button>
        </div>
      </div>
      ${lowStockMaterials.length > 0 ? `
        <div class="alert-warning-box">
          <i class="fas fa-exclamation-triangle mr-2 icon-warning"></i>
          Stok menipis: ${lowStockMaterials.slice(0, 5).map(b => `${b.name} (${b.stock} ${b.satuan})`).join(', ')}
          ${lowStockMaterials.length > 5 ? ` +${lowStockMaterials.length - 5} lainnya` : ''}
        </div>
      ` : ''}

      <table class="table-full">
        <thead class="settings-table-head">
          <tr>
            <th class="td-base text-left cursor-pointer" onclick="sortBahan('name')">
              Nama <i class="fas ${SortableTable.getSortIcon('bahan', 'name')}"></i>
            </th>
            <th class="td-base text-left cursor-pointer" onclick="sortBahan('stock')">
              Stok <i class="fas ${SortableTable.getSortIcon('bahan', 'stock')}"></i>
            </th>
            <th class="td-base text-left">Min Stok</th>
            <th class="td-base text-left">Supplier</th>
            <th class="td-base text-left">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${filteredBahan.map(b => `
            <tr class="neu-table-row">
              <td class="td-base td-medium" data-label="Nama">${b.name}</td>
              <td class="td-base" data-label="Stok">
                <span class="${b.stock <= (b.minStock || 5) ? 'text-danger fw-bold' : ''}">
                  ${b.stock} ${b.satuan || 'pcs'}
                </span>
              </td>
              <td class="td-base" data-label="Min Stok">${b.minStock || 5} ${b.satuan || 'pcs'}</td>
              <td class="td-base" data-label="Supplier">${b.supplier || '-'}</td>
              <td class="td-base table-actions" data-label="Aksi">
                <button class="btn-icon-sm btn-icon-success" onclick="const b=this;Utils.setButtonLoading(b,true);tambahStokBahan('${b.id}').finally(()=>Utils.setButtonLoading(b,false))" title="Tambah Stok">
                  <i class="fas fa-plus-circle"></i>
                </button>
                <button class="btn-icon-sm btn-icon-warning" onclick="kurangiStokBahanManual('${b.id}')" title="Kurangi Stok">
                  <i class="fas fa-minus-circle"></i>
                </button>
                <button class="btn-icon-sm" onclick="lihatRiwayatStok('${b.id}')" title="Riwayat Stok">
                  <i class="fas fa-history"></i>
                </button>
                <button class="btn-icon-sm" onclick="editBahan('${b.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon-sm btn-icon-danger" onclick="const bt=this;Utils.setButtonLoading(bt,true);hapusBahan('${b.id}').finally(()=>Utils.setButtonLoading(bt,false))" title="Hapus">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();
  requestAnimationFrame(() => {
    const _main = document.querySelector('main');
    if (_main && lastBahanScroll > 0) {
      _main.scrollTop = lastBahanScroll;
    }
  });
}

function sortBahan(field) {
  _saveBahanScroll();
  SortableTable.toggle('bahan', field);
  renderBahanManager();
}

function _saveBahanScroll() {
  const _m = document.querySelector('main');
  if (_m) lastBahanScroll = _m.scrollTop;
}

async function showAddBahanModal() {
  const result = await Utils.showModal({
    title: '➕ Tambah Bahan Baru',
    content: `
      <div class="form-group">
        <label class="form-label">Nama Bahan <span class="text-danger">*</span></label>
        <input type="text" id="bahanName" class="form-input" placeholder="Contoh: Telur" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Satuan</label>
        <select id="bahanSatuan" class="form-select">
          <option value="kg">Kilogram (kg)</option>
          <option value="gram">Gram (g)</option>
          <option value="liter">Liter (L)</option>
          <option value="ml">Mililiter (ml)</option>
          <option value="pcs">Pcs</option>
          <option value="bungkus">Bungkus</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Stok Awal</label>
        <input type="number" id="bahanStock" class="form-input" value="0" min="0" step="0.1">
      </div>
      <div class="form-group">
        <label class="form-label">Minimal Stok</label>
        <input type="number" id="bahanMinStock" class="form-input" value="5" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Supplier (opsional)</label>
        <input type="text" id="bahanSupplier" class="form-input" placeholder="Nama supplier">
      </div>
    `,
    buttons: [
      { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
      {
        text: 'Simpan',
        action: 'save',
        class: 'btn-primary',
        onClick: () => {
          window._bahanName = document.getElementById('bahanName')?.value;
          window._bahanSatuan = document.getElementById('bahanSatuan')?.value;
          window._bahanStock = document.getElementById('bahanStock')?.value;
          window._bahanMinStock = document.getElementById('bahanMinStock')?.value;
          window._bahanSupplier = document.getElementById('bahanSupplier')?.value;
        }
      }
    ]
  });
  if (result !== 'save') return;
  const name = window._bahanName?.trim();
  if (!name) {
    Utils.showToast("Nama harus diisi", 'error');
    return;
  }
  try {
    await dbCloud.collection("raw_materials").add({
      name: name,
      satuan: window._bahanSatuan || 'kg',
      stock: parseFloat(window._bahanStock) || 0,
      minStock: parseInt(window._bahanMinStock) || 5,
      supplier: window._bahanSupplier || null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    Utils.showToast("Bahan ditambahkan");
    delete window._bahanName;
    delete window._bahanSatuan;
    delete window._bahanStock;
    delete window._bahanMinStock;
    delete window._bahanSupplier;
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

async function tambahStokBahan(id) {
  const bahan = state.rawMaterials.find(b => b.id === id);
  if (!bahan) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'tambah-stok-modal';
  modal.innerHTML = `
    <div class="modal modal-sm">
      <h3><i class="fas fa-plus-circle"></i> Tambah Stok ${bahan.name}</h3>
      <div class="bahan-info-box">
        <div class="bahan-info-row">
          <span>Stok Saat Ini:</span>
          <span class="bahan-info-stock">${bahan.stock} ${bahan.satuan}</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Jumlah Tambah <span class="text-danger">*</span></label>
        <input type="number" id="tambahQty" class="form-input" min="0.1" step="0.1" placeholder="0" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Keterangan (opsional)</label>
        <input type="text" id="tambahNotes" class="form-input" placeholder="Contoh: Pembelian dari supplier">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeTambahStokModal()">Batal</button>
        <button class="btn btn-primary" onclick="prosesTambahStok('${id}')">
          <i class="fas fa-save"></i> Tambah
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const input = document.getElementById('tambahQty');
    if (input) input.focus();
  }, 200);
  window.closeTambahStokModal = function () {
    const modal = document.getElementById('tambah-stok-modal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => {
        if (modal.parentNode) modal.remove();
      }, 200);
    }
  };
  window.prosesTambahStok = async function (bahanId) {
    try {
      const qtyInput = document.getElementById('tambahQty');
      const notesInput = document.getElementById('tambahNotes');
      if (!qtyInput) {
        Utils.showToast("Terjadi kesalahan", 'error');
        return;
      }
      const qty = parseFloat(qtyInput.value);
      if (isNaN(qty) || qty <= 0) {
        Utils.showToast("Jumlah harus diisi dengan angka positif", 'error');
        qtyInput.focus();
        return;
      }
      const notes = notesInput?.value?.trim() || 'Tambah manual';
      Utils.showToast("⏳ Menyimpan...", 'warning');
      const bahanRef = dbCloud.collection("raw_materials").doc(bahanId);
      await bahanRef.update({
        stock: firebase.firestore.FieldValue.increment(qty)
      });
      await dbCloud.collection("stock_mutations").add({
        type: "in",
        source: "manual",
        bahanId: bahanId,
        namaBahan: bahan.name,
        qty: qty,
        satuan: bahan.satuan,
        notes: notes,
        userId: state.user?.email || 'unknown',
        createdAt: new Date()
      });
      Utils.showToast(`Stok ${bahan.name} +${qty} ${bahan.satuan}`);
      if (typeof window.updateAllProductStocks === 'function') {
        await window.updateAllProductStocks();
      }
      closeTambahStokModal();
      renderBahanManager();
    } catch (error) {
      if (error.code === 'permission-denied') {
        Utils.showToast("Tidak punya izin. Periksa Firestore Rules", 'error');
      } else {
        Utils.showToast("Gagal: " + error.message, 'error');
      }
    }
  };
}

async function kurangiStokBahanManual(id) {
  const bahan = state.rawMaterials.find(b => b.id === id);
  if (!bahan) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'kurang-stok-modal';
  modal.innerHTML = `
    <div class="modal modal-sm">
      <h3><i class="fas fa-minus-circle"></i> Kurangi Stok ${bahan.name}</h3>
      <div class="bahan-info-box">
        <div class="bahan-info-row">
          <span>Stok Saat Ini:</span>
          <span class="bahan-info-stock">${bahan.stock} ${bahan.satuan}</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Jumlah Kurang <span class="text-danger">*</span></label>
        <input type="number" id="kurangQty" class="form-input" min="0.1" step="0.1" placeholder="0" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Keterangan (opsional)</label>
        <input type="text" id="kurangNotes" class="form-input" placeholder="Contoh: Rusak/Expired">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeKurangStokModal()">Batal</button>
        <button class="btn btn-primary" onclick="prosesKurangStok('${id}')">
          <i class="fas fa-check"></i> Kurangi
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const input = document.getElementById('kurangQty');
    if (input) input.focus();
  }, 200);
  window.closeKurangStokModal = function () {
    const modal = document.getElementById('kurang-stok-modal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => {
        if (modal.parentNode) modal.remove();
      }, 200);
    }
  };
  window.prosesKurangStok = async function (bahanId) {
    try {
      const qtyInput = document.getElementById('kurangQty');
      const notesInput = document.getElementById('kurangNotes');
      if (!qtyInput) {
        Utils.showToast("Terjadi kesalahan", 'error');
        return;
      }
      const qty = parseFloat(qtyInput.value);
      if (isNaN(qty) || qty <= 0) {
        Utils.showToast("Jumlah harus diisi dengan angka positif", 'error');
        qtyInput.focus();
        return;
      }
      if (qty > bahan.stock) {
        Utils.showToast(`Stok tidak cukup! (tersisa ${bahan.stock} ${bahan.satuan})`, 'error');
        return;
      }
      const notes = notesInput?.value?.trim() || 'Pengurangan manual';
      Utils.showToast("⏳ Menyimpan...", 'warning');
      await dbCloud.collection("raw_materials").doc(bahanId).update({
        stock: firebase.firestore.FieldValue.increment(-qty)
      });
      await dbCloud.collection("stock_mutations").add({
        type: "out",
        source: "manual",
        bahanId: bahanId,
        namaBahan: bahan.name,
        qty: qty,
        satuan: bahan.satuan,
        notes: notes,
        userId: state.user?.email || 'unknown',
        createdAt: new Date()
      });
      Utils.showToast(`Stok ${bahan.name} -${qty} ${bahan.satuan}`);
      if (typeof window.updateAllProductStocks === 'function') {
        await window.updateAllProductStocks();
      }
      closeKurangStokModal();
      renderBahanManager();
    } catch (error) {
      Utils.showToast("Gagal: " + error.message, 'error');
    }
  };
}

async function editBahan(id) {
  const bahan = state.rawMaterials.find(b => b.id === id);
  if (!bahan) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'edit-bahan-modal';
  modal.innerHTML = `
    <div class="modal modal-lg">
      <h3><i class="fas fa-edit"></i> Edit ${bahan.name}</h3>
      <div class="form-group">
        <label class="form-label">Nama Bahan</label>
        <input type="text" id="editBahanName" class="form-input" value="${bahan.name}">
      </div>
      <div class="form-group">
        <label class="form-label">Satuan</label>
        <select id="editBahanSatuan" class="form-select">
          <option value="kg" ${bahan.satuan === 'kg' ? 'selected' : ''}>Kilogram (kg)</option>
          <option value="gram" ${bahan.satuan === 'gram' ? 'selected' : ''}>Gram (g)</option>
          <option value="liter" ${bahan.satuan === 'liter' ? 'selected' : ''}>Liter (L)</option>
          <option value="ml" ${bahan.satuan === 'ml' ? 'selected' : ''}>Mililiter (ml)</option>
          <option value="pcs" ${bahan.satuan === 'pcs' ? 'selected' : ''}>Pcs</option>
          <option value="bungkus" ${bahan.satuan === 'bungkus' ? 'selected' : ''}>Bungkus</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Minimal Stok</label>
        <input type="number" id="editBahanMinStock" class="form-input" value="${bahan.minStock || 5}">
      </div>
      <div class="form-group">
        <label class="form-label">Supplier</label>
        <input type="text" id="editBahanSupplier" class="form-input" value="${bahan.supplier || ''}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeEditBahanModal()">Batal</button>
        <button class="btn btn-primary" onclick="prosesEditBahan('${id}')">
          <i class="fas fa-save"></i> Simpan
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  window.closeEditBahanModal = function () {
    const modal = document.getElementById('edit-bahan-modal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => {
        if (modal.parentNode) modal.remove();
      }, 200);
    }
  };
  window.prosesEditBahan = async function (bahanId) {
    try {
      const name = document.getElementById('editBahanName')?.value;
      if (!name) {
        Utils.showToast("Nama harus diisi", 'error');
        return;
      }
      Utils.showToast("⏳ Menyimpan...", 'warning');
      await dbCloud.collection("raw_materials").doc(bahanId).update({
        name: name,
        satuan: document.getElementById('editBahanSatuan').value,
        minStock: parseInt(document.getElementById('editBahanMinStock').value) || 5,
        supplier: document.getElementById('editBahanSupplier').value || null,
        updatedAt: new Date()
      });
      Utils.showToast("Bahan diupdate");
      if (typeof window.updateAllProductStocks === 'function') {
        await window.updateAllProductStocks();
      }
      closeEditBahanModal();
      renderBahanManager();
    } catch (error) {
      Utils.showToast("Gagal: " + error.message, 'error');
    }
  };
}

async function lihatRiwayatStok(bahanId) {
  const bahan = state.rawMaterials.find(b => b.id === bahanId);
  if (!bahan) return;

  function _buildRiwayatRows() {
    const mutations = (state.stockMutations || [])
      .filter(m => m.bahanId === bahanId)
      .sort((a, b) => {
        const da = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000;
        const db = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000;
        return db - da;
      });

    if (mutations.length === 0) {
      return `<div class="empty-state"><i class="fas fa-history"></i><p>Belum ada riwayat</p></div>`;
    }

    return mutations.map(m => {
      const tgl = m.createdAt?.seconds
        ? new Date(m.createdAt.seconds * 1000).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
        : '-';
      const isIn  = m.type === 'in';
      const isSale = m.source === 'sale';
      const label = isSale ? 'Penjualan' : m.source === 'manual' ? (isIn ? 'Tambah Manual' : 'Kurang Manual') : m.source || '-';
      const icon  = isIn ? 'fa-arrow-up text-success' : 'fa-arrow-down text-danger';
      const sign  = isIn ? '+' : '-';
      return `
        <div class="riwayat-stok-row" data-id="${m.id}">
          <div class="riwayat-stok-left">
            <i class="fas ${icon}"></i>
            <div>
              <div class="riwayat-stok-label">${label}</div>
              <div class="riwayat-stok-meta">${tgl}${m.notes ? ' · ' + m.notes : ''}</div>
            </div>
          </div>
          <div class="riwayat-stok-right">
            <span class="riwayat-stok-qty ${isIn ? 'text-success' : 'text-danger'}">
              ${sign}${m.qty} ${m.satuan || bahan.satuan || ''}
            </span>
            <button class="btn-icon-sm btn-icon-danger" title="Hapus & Rollback Stok"
              onclick="window._hapusMutasiStok('${m.id}','${bahanId}','${m.type}',${m.qty})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-riwayat-stok';
  modal.innerHTML = `
    <div class="modal modal-wide">
      <div class="modal-header">
        <div>
          <h3><i class="fas fa-history"></i> Riwayat Stok</h3>
          <small class="text-muted">${bahan.name} — Stok: ${bahan.stock} ${bahan.satuan}</small>
        </div>
        <button class="btn-icon-sm" onclick="document.getElementById('modal-riwayat-stok').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body riwayat-stok-body" id="riwayat-stok-list">
        ${_buildRiwayatRows()}
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  window._hapusMutasiStok = async function(mutasiId, bhnId, type, qty) {
    const result = await Swal.fire({
      title: 'Hapus Riwayat Stok?',
      html: `Stok akan di-<b>rollback</b>:<br>
        ${type === 'in'
          ? `<span class="text-danger">-${qty} ${bahan.satuan}</span> (pembelian dibatalkan)`
          : `<span class="text-success">+${qty} ${bahan.satuan}</span> (pengurangan dibatalkan)`}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus & Rollback',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc3545',
      customClass: { popup: 'swal2-is-konfirmasi' }
    });
    if (!result.isConfirmed) return;

    try {
      const rollback = type === 'in' ? -parseFloat(qty) : parseFloat(qty);
      const batch = dbCloud.batch();
      batch.delete(dbCloud.collection('stock_mutations').doc(mutasiId));
      batch.update(dbCloud.collection('raw_materials').doc(bhnId), {
        stock: firebase.firestore.FieldValue.increment(rollback)
      });
      await batch.commit();
      if (typeof window.updateAllProductStocks === 'function') {
        await window.updateAllProductStocks();
      }
      Utils.showToast('Riwayat dihapus, stok di-rollback', 'success');
      const listEl = document.getElementById('riwayat-stok-list');
      if (listEl) listEl.innerHTML = _buildRiwayatRows();
    } catch (err) {
      Utils.showToast('Gagal: ' + err.message, 'error');
    }
  };
}

async function hapusBahan(id) {
  if (!await Utils.showConfirm("Yakin hapus bahan ini?")) return;
  const digunakan = state.menus.some(m => m.resep?.some(r => r.bahanId === id));
  if (digunakan) {
    Utils.showToast("Bahan masih digunakan di resep!", 'error');
    return;
  }
  try {
    await dbCloud.collection("raw_materials").doc(id).delete();
    Utils.showToast("Bahan dihapus");
    if (typeof window.updateAllProductStocks === 'function') {
      await window.updateAllProductStocks();
    }
    renderBahanManager();
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

window.renderBahanManager = renderBahanManager;
window.showAddBahanModal = showAddBahanModal;
window.tambahStokBahan = tambahStokBahan;
window.kurangiStokBahanManual = kurangiStokBahanManual;
window.lihatRiwayatStok = lihatRiwayatStok;
window.editBahan = editBahan;
window.hapusBahan = hapusBahan;
window.sortBahan = sortBahan;

window._onBahanSearch = function(val) {
  _bahanSearchQuery = val;
  renderBahanManager();
  const input = document.querySelector('.search-input');
  if (input) {
    input.focus();
    input.setSelectionRange(val.length, val.length);
  }
};