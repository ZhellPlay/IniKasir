let lastMenuScroll = 0;
let _menuSearchQuery = '';

function showImageCropModal(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const SZ = 280;
        const guideH = Math.round(SZ / 2);
        const guideY = Math.round((SZ - guideH) / 2);

        const fitScale = Math.max(SZ / img.width, guideH / img.height);
        let scale = fitScale;
        let ox = (SZ - img.width * scale) / 2;
        let oy = guideY + (guideH - img.height * scale) / 2;
        let dragging = false, ds = { x: 0, y: 0 };

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'crop-modal';
        overlay.innerHTML = `
                  <div class="modal modal-crop-small">
                    <h3 class="mb-1"><i class="fas fa-crop-alt"></i> Atur Foto</h3>
                    <p class="text-muted modal-crop-text">Geser untuk posisi &bull; Slider untuk zoom</p>
                    <div class="flex-center">
                      <canvas id="cropCanvas" width="${SZ}" height="${SZ}" class="crop-canvas-main"></canvas>
                    </div>
                    <p class="crop-footer-text">
                      <i class="fas fa-eye"></i> Area terang = yang tampil di kartu kasir
                    </p>
                    <div class="crop-zoom-ctrl">
                      <i class="fas fa-search-minus text-muted"></i>
                      <input type="range" id="cropZoom" class="crop-range-input" step="0.005">
                      <i class="fas fa-search-plus text-muted"></i>
                    </div>
                    <div class="mb-3">
                      <p class="text-muted mb-1 text-center text-bold-md text-sm">
                        <i class="fas fa-store"></i> Preview Kartu Kasir
                      </p>
                      <div class="crop-preview-container">
                        <canvas id="kasirPreviewCanvas" width="200" height="100" class="crop-preview-canvas"></canvas>
                        <div class="p-2 bg-surface">
                          <div class="text-bold-md text-sm text-primary">Nama Produk</div>
                          <div class="color-primary text-sm">Rp 15.000</div>
                        </div>
                      </div>
                    </div>
                    <div class="modal-actions">
                      <button class="btn btn-secondary" id="cropCancel">Batal</button>
                      <button class="btn btn-primary" id="cropConfirm"><i class="fas fa-check"></i> Gunakan Foto</button>
                    </div>
                  </div>`;
        document.body.appendChild(overlay);

        const canvas = document.getElementById('cropCanvas');
        const ctx = canvas.getContext('2d');
        const previewCanvas = document.getElementById('kasirPreviewCanvas');
        const pctx = previewCanvas.getContext('2d');
        const slider = document.getElementById('cropZoom');
        slider.min = fitScale * 0.3;
        slider.max = fitScale * 5;
        slider.value = scale;

        function draw() {
          ctx.clearRect(0, 0, SZ, SZ);
          ctx.drawImage(img, ox, oy, img.width * scale, img.height * scale);

          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, 0, SZ, guideY);
          ctx.fillRect(0, guideY + guideH, SZ, SZ - guideY - guideH);

          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,0.95)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(1, guideY + 1, SZ - 2, guideH - 2);
          ctx.restore();

          ctx.save();
          ctx.fillStyle = 'rgba(99,102,241,0.88)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(4, guideY + 4, 96, 17, 4);
          else ctx.rect(4, guideY + 4, 96, 17);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('\uD83D\uDC41 Tampil di Kasir', 8, guideY + 15);
          ctx.restore();

          pctx.clearRect(0, 0, 200, 100);
          const pr = 200 / SZ;
          pctx.drawImage(img,
            ox * pr,
            (oy - guideY) * pr,
            img.width * scale * pr,
            img.height * scale * pr
          );
        }
        draw();

        slider.addEventListener('input', () => {
          const ns = parseFloat(slider.value);
          const cx = SZ / 2, cy = guideY + guideH / 2;
          ox = cx - (cx - ox) * (ns / scale);
          oy = cy - (cy - oy) * (ns / scale);
          scale = ns; draw();
        });

        function getXY(e) {
          return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        }
        canvas.addEventListener('mousedown', e => {
          dragging = true; canvas.classList.add('cursor-grabbing');
          const p = getXY(e); ds = { x: p.x - ox, y: p.y - oy };
        });
        canvas.addEventListener('touchstart', e => {
          e.preventDefault(); dragging = true;
          const p = getXY(e); ds = { x: p.x - ox, y: p.y - oy };
        }, { passive: false });
        const onMove = e => {
          if (!dragging) return;
          if (e.cancelable) e.preventDefault();
          const p = getXY(e); ox = p.x - ds.x; oy = p.y - ds.y; draw();
        };
        const onUp = () => { dragging = false; canvas.classList.remove('cursor-grabbing'); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);

        function cleanup() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('touchend', onUp);
          overlay.remove();
        }

        document.getElementById('cropConfirm').addEventListener('click', () => {
          const OUT_W = 600, OUT_H = 300;
          const ratio = OUT_W / SZ;
          const out = document.createElement('canvas');
          out.width = OUT_W; out.height = OUT_H;
          out.getContext('2d').drawImage(img,
            ox * ratio,
            (oy - guideY) * ratio,
            img.width * scale * ratio,
            img.height * scale * ratio
          );
          cleanup();
          resolve(out.toDataURL('image/jpeg', 0.85));
        });
        document.getElementById('cropCancel').addEventListener('click', () => {
          cleanup(); resolve(null);
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderMenuManager() {
  const _m = document.querySelector('main');
  if (_m && state.currentView === "menuManager") lastMenuScroll = _m.scrollTop;

  state.currentView = "menuManager";
  const sortedCategories = [
    ...state.categories.filter(c => !c.system).sort((a, b) => a.name.localeCompare(b.name)),
    ...state.categories.filter(c => c.system)
  ];
  const filteredCategories = !(_menuSearchQuery || '').trim() ? sortedCategories :
    sortedCategories.filter(c => c.name.toLowerCase().includes(_menuSearchQuery.toLowerCase()) || 
                          (state.menus || []).filter(m => m.categoryId === c.id).some(m => m.name.toLowerCase().includes(_menuSearchQuery.toLowerCase())));

  const totalMenus = (state.menus || []).length;

  const content = `
    <div class="stack-y menu-stack">
      <div class="management-control-bar">
        <div class="search-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Cari kategori atau menu..." 
                 value="${_menuSearchQuery}" oninput="window._onMenuSearch(this.value)">
        </div>
        
        <div class="management-stats">
          <div class="stat-item">
            <i class="fas fa-th-large"></i> <span class="text-muted">Kategori:</span> <span>${state.categories.length}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <i class="fas fa-utensils"></i> <span class="text-muted">Menu:</span> <span>${totalMenus}</span>
          </div>
          ${_menuSearchQuery ? `
            <div class="stat-divider"></div>
            <div class="stat-item">
              <i class="fas fa-filter"></i> <span class="text-muted">Hasil:</span> <span class="text-primary">${filteredCategories.length}</span>
            </div>
          ` : ''}
        </div>

        <div class="management-actions">
          <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);showAddCategoryModal().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-plus"></i> Tambah Kategori
          </button>
        </div>
      </div>

      ${filteredCategories.length === 0 ? `
        <div class="empty-center">
          <div class="empty-state large">
            <i class="fas ${_menuSearchQuery ? 'fa-search' : 'fa-utensils'}"></i>
            <h2>${_menuSearchQuery ? 'Kategori Tidak Ditemukan' : 'Belum Ada Kategori'}</h2>
            <p>${_menuSearchQuery ? `Tidak ada hasil untuk "${_menuSearchQuery}"` : 'Tambahkan kategori menu pertama Anda untuk memulai'}</p>
            ${_menuSearchQuery ? `
              <button class="btn btn-secondary btn-sm" onclick="window._onMenuSearch('')">Reset Pencarian</button>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="category-grid">
          ${filteredCategories.map(c => `
            <div class="category-card">
              <div class="section-category-header">
                <h3>${c.name}</h3>
                ${c.system ? '<span class="badge-system">System</span>' : ''}
              </div>
              <div class="menu-item-meta">
                ${state.menus.filter(m => m.categoryId === c.id).length} Produk
              </div>
              <div class="category-actions">
                <button class="btn btn-primary btn-sm" onclick="openCategory('${c.id}')">
                  <i class="fas fa-folder-open"></i> Buka Menu
                </button>
                ${!c.system ? `
                  <button class="btn-icon-sm" onclick="editCategory('${c.id}')" title="Edit">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="btn-icon-sm btn-icon-danger" onclick="const b=this;Utils.setButtonLoading(b,true);deleteCategory('${c.id}').finally(()=>Utils.setButtonLoading(b,false))" title="Hapus">
                    <i class="fas fa-trash"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();
  requestAnimationFrame(() => {
    const _main = document.querySelector('main');
    if (_main && lastMenuScroll > 0) {
      _main.scrollTop = lastMenuScroll;
    }
  });
}

async function showAddCategoryModal() {
  const name = await Utils.showPrompt('Nama Kategori Baru', '', 'swal2-is-medium');
  if (!name) return;
  try {
    await dbCloud.collection("categories").add({
      name,
      system: false,
      createdAt: new Date()
    });
    Utils.showToast("Kategori ditambahkan");
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

async function editCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (!category) return;
  const newName = await Utils.showPrompt('Edit Nama Kategori', category.name, 'swal2-is-medium');
  if (!newName || newName === category.name) return;
  try {
    await dbCloud.collection("categories").doc(id).update({
      name: newName,
      updatedAt: new Date()
    });
    Utils.showToast("Kategori berhasil diupdate");
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!await Utils.showConfirm("Hapus kategori? Menu akan dipindahkan ke Lainnya.")) return;
  try {
    const lainnya = state.categories.find(c => c.system);
    for (const m of state.menus.filter(m => m.categoryId === id)) {
      await dbCloud.collection("menus").doc(m.id).update({ categoryId: lainnya.id });
    }
    await dbCloud.collection("categories").doc(id).delete();
    Utils.showToast("Kategori dihapus");
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

function openCategory(id) {
  const _m = document.querySelector('main');
  if (_m && state.currentView === "openCategory") lastMenuScroll = _m.scrollTop;

  state.currentView = "openCategory";
  state.currentCategoryId = id;
  const category = state.categories.find(c => c.id === id);
  if (!category) return;
  const menus = state.menus.filter(m => m.categoryId === id);
  
  const filteredMenus = !(state.categorySearchQuery || '').trim() ? menus :
    menus.filter(m => m.name.toLowerCase().includes(state.categorySearchQuery.toLowerCase()));

  const sortedMenus = SortableTable.sort(filteredMenus, 'menus');
  const content = `
    <div class="stack-y menu-stack">
      <div class="management-control-bar">
        <div class="search-wrapper">
          <i class="fas fa-search"></i>
          <input type="text" class="search-input" placeholder="Cari menu di kategori ini..." 
                 value="${state.categorySearchQuery || ''}" oninput="window._onCatSearch(this.value)">
        </div>
        
        <div class="management-stats" id="cat-stats-container">
          ${_renderCatStatsHTML(category, menus, filteredMenus)}
        </div>

        <div class="management-actions">
          <button class="btn-kembali" onclick="state.categorySearchQuery=''; renderMenuManager()">
            <i class="fas fa-arrow-left"></i> Kembali
          </button>
        </div>
      </div>

      <div class="row-gap mb-3 mt-1" id="cat-actions-container">
        ${_renderCatActionsHTML(id, filteredMenus)}
      </div>

      <table class="table-full">
        <thead class="neu-table-head">
          <tr>
            <th class="td-base text-left">Pilih</th>
            <th class="td-base text-left">Foto</th>
            <th class="td-base text-left cursor-pointer" onclick="sortMenus('name')">
              Nama <i class="fas ${SortableTable.getSortIcon('menus', 'name')}"></i>
            </th>
            <th class="td-base text-left cursor-pointer" onclick="sortMenus('price')">
              Harga <i class="fas ${SortableTable.getSortIcon('menus', 'price')}"></i>
            </th>
            <th class="td-base text-left">Stok</th>
            <th class="td-base text-left">Aksi</th>
          </tr>
        </thead>
        <tbody id="cat-menu-tbody">
          ${_renderCatTableBodyHTML(sortedMenus)}
        </tbody>
      </table>
    </div>
  `;
  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();
  requestAnimationFrame(() => {
    const _main = document.querySelector('main');
    if (_main && lastMenuScroll > 0) {
      _main.scrollTop = lastMenuScroll;
    }
  });
}

function _renderCatStatsHTML(category, allMenus, filteredMenus) {
  return `
    <div class="stat-item">
      <i class="fas fa-folder-open text-primary mr-1"></i> <strong>${category.name}</strong>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <i class="fas fa-list-ul"></i> <span class="text-muted">Item:</span> <span>${allMenus.length}</span>
    </div>
    ${state.categorySearchQuery ? `
      <div class="stat-divider"></div>
      <div class="stat-item">
        <i class="fas fa-filter"></i> <span class="text-muted">Hasil:</span> <span class="text-primary">${filteredMenus.length}</span>
      </div>
    ` : ''}
  `;
}

function _renderCatActionsHTML(categoryId, filteredMenus) {
  return `
    <button class="btn btn-primary" onclick="showAddMenuModal('${categoryId}')">
      <i class="fas fa-plus"></i> Tambah Menu
    </button>
    <button class="btn btn-secondary" onclick="toggleSelectAllMenu('${categoryId}')">
      ${state.selectedMenus.size === filteredMenus.length && filteredMenus.length > 0 ? 'Batal Pilih' : 'Pilih Semua'}
    </button>
    <button class="btn btn-danger" onclick="const b=this;Utils.setButtonLoading(b,true);deleteSelectedMenus('${categoryId}').finally(()=>Utils.setButtonLoading(b,false))" 
            ${state.selectedMenus.size === 0 ? 'disabled' : ''}>
      <i class="fas fa-trash"></i> Hapus ${state.selectedMenus.size > 0 ? `(${state.selectedMenus.size})` : ''}
    </button>
  `;
}

function _renderCatTableBodyHTML(sortedMenus) {
  if (sortedMenus.length === 0) {
    return '<tr><td colspan="6" class="td-base text-center text-muted">Tidak ada menu ditemukan</td></tr>';
  }
  return sortedMenus.map(m => {
    const isSelected = state.selectedMenus.has(m.id);
    const stokOtomatis = m.resep ? Utils.hitungStokProduk(m) : null;
    return `
      <tr class="neu-table-row ${isSelected ? 'row-selected' : ''}" onclick="toggleSelectMenu('${m.id}', event)">
        <td class="td-base" data-label="">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectMenu('${m.id}')">
        </td>
        <td class="td-base" data-label="">
          ${m.imageUrl
            ? `<img src="${m.imageUrl}" alt="foto" class="img-table-thumb">`
            : `<span class="img-table-placeholder"><i class="fas fa-image"></i></span>`
          }
        </td>
        <td class="td-base td-medium" data-label="Nama">${m.name}</td>
        <td class="td-base" data-label="Harga">Rp ${Utils.formatRupiah(m.price)}</td>
        <td class="td-base" data-label="Stok">
          ${m.resep ?
            `<span class="text-base-sm"><i class="fas fa-cubes"></i> ${stokOtomatis} porsi</span>` :
            m.useStock ?
              `<span class="text-base-sm"><i class="fas fa-box"></i> ${m.stock}</span>` :
              '<span class="text-base-sm text-muted"><i class="fas fa-infinity"></i></span>'
          }
        </td>
        <td class="td-base table-actions" data-label="Aksi">
          <button class="btn-icon-sm" onclick="event.stopPropagation(); editMenu('${m.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon-sm btn-icon-danger" onclick="event.stopPropagation(); const b=this;Utils.setButtonLoading(b,true);deleteMenu('${m.id}').finally(()=>Utils.setButtonLoading(b,false))" title="Hapus">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function sortMenus(field) {
  _saveMenuScroll();
  SortableTable.toggle('menus', field);
  openCategory(state.currentCategoryId);
}

function _saveMenuScroll() {
  const _m = document.querySelector('main');
  if (_m) lastMenuScroll = _m.scrollTop;
}

async function showAddMenuModal(categoryId) {
  const bahanOptions = state.rawMaterials.map(b =>
    `<option value="${b.id}" data-satuan="${b.satuan || 'pcs'}">${b.name} (${b.satuan || 'pcs'})</option>`
  ).join('');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'add-menu-modal';
  modal.innerHTML = `
    <div class="modal modal-lg">
      <h3><i class="fas fa-plus-circle"></i> Tambah Menu</h3>
      <div class="form-group">
        <label class="form-label">Nama Menu <span class="text-danger">*</span></label>
        <input type="text" id="menuName" class="form-input" placeholder="Contoh: Ice Tea" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Harga (Rp) <span class="text-danger">*</span></label>
        <input type="number" id="menuPrice" class="form-input" placeholder="15000" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Foto Produk <span class="text-muted">(opsional)</span></label>
        <div class="flex-center gap-3 flex-wrap">
          <label for="menuImage" class="image-upload-label">
            <i class="fas fa-camera"></i> Pilih Foto
          </label>
          <input type="file" id="menuImage" accept="image/*" class="hidden" onchange="previewMenuImage(this,'menuImagePreview')">
          <div id="menuImagePreview" class="image-preview-wrapper hidden">
            <img id="menuImagePreviewImg" class="img-preview-sm">
            <button type="button" onclick="clearMenuImage('menuImage','menuImagePreview')" class="btn-remove-photo">×</button>
          </div>
        </div>
        <small class="text-muted">Foto otomatis dikompres (max 800px, ~50KB)</small>
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="useStock"> Gunakan Stok Manual
        </label>
        <small class="text-muted">Stok akan dihitung otomatis dari bahan</small>
      </div>
      <div id="stockField" class="form-group is-hidden">
        <label class="form-label">Stok Awal</label>
        <input type="number" id="menuStock" class="form-input" value="0" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">Resep (Bahan Baku)</label>
        <p class="text-muted small">Stok dihitung dari bahan terkecil</p>
        <div id="recipeContainer">
          <div class="recipe-row" id="recipe-row-0">
            <select class="recipe-select" id="bahan-0">
              <option value="">Pilih Bahan</option>
              ${bahanOptions}
            </select>
            <input type="number" class="recipe-input" id="qty-0" placeholder="Jumlah" min="0" step="0.1" value="1">
            <span class="recipe-unit" id="unit-0">pcs</span>
            <button type="button" class="recipe-remove" onclick="removeRecipeRow(0)"<>×</button>
          </div>
        </div>
        <button type="button" class="recipe-add" onclick="addRecipeRow()">
          <i class="fas fa-plus"></i> Tambah Bahan
        </button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeAddMenuModal()">Batal</button>
        <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);saveNewMenu('${categoryId}').finally(()=>Utils.setButtonLoading(b,false))">
          <i class="fas fa-save"></i> Simpan
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const useStockCheck = document.getElementById('useStock');
  if (useStockCheck) {
    useStockCheck.addEventListener('change', function (e) {
      document.getElementById('stockField').classList.toggle('is-hidden', !e.target.checked);
    });
  }
  setupRecipeRowListeners(0);
  window.addRecipeRow = function () {
    const container = document.getElementById('recipeContainer');
    const index = container.children.length;
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.id = `recipe-row-${index}`;
    row.innerHTML = `
      <select class="recipe-select" id="bahan-${index}">
        <option value="">Pilih Bahan</option>
        ${bahanOptions}
      </select>
      <input type="number" class="recipe-input" id="qty-${index}" placeholder="Jumlah" min="0" step="0.1" value="1">
      <span class="recipe-unit" id="unit-${index}">pcs</span>
      <button type="button" class="recipe-remove" onclick="removeRecipeRow(${index})">×</button>
    `;
    container.appendChild(row);
    setupRecipeRowListeners(index);
  };
  window.removeRecipeRow = function (index) {
    const row = document.getElementById(`recipe-row-${index}`);
    if (row && document.querySelectorAll('.recipe-row').length > 1) {
      row.remove();
    }
  };
  window.closeAddMenuModal = function () {
    const modal = document.getElementById('add-menu-modal');
    if (modal) modal.remove();
  };
  window.previewMenuImage = async function (input, previewId) {
    if (!input.files || !input.files[0]) return;
    const base64 = await showImageCropModal(input.files[0]);
    input.value = '';
    if (!base64) return;
    window._menuCroppedImage = base64;
    const preview = document.getElementById(previewId);
    const previewImg = document.getElementById(previewId + 'Img');
    if (preview && previewImg) { previewImg.src = base64; preview.classList.remove('hidden'); }
  };
  window.clearMenuImage = function (inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (input) input.value = '';
    if (preview) preview.classList.add('hidden');
    window._menuCroppedImage = null;
  };
  window.saveNewMenu = async function (catId) {
    try {
      const nameInput = document.getElementById('menuName');
      const priceInput = document.getElementById('menuPrice');
      if (!nameInput) {
        Utils.showToast("Terjadi kesalahan", 'error');
        return;
      }
      const name = nameInput.value.trim();
      if (!name) {
        Utils.showToast("Nama menu harus diisi!", 'error');
        nameInput.focus();
        return;
      }
      if (!priceInput) {
        Utils.showToast("Terjadi kesalahan", 'error');
        return;
      }
      const price = parseInt(priceInput.value);
      if (isNaN(price) || price <= 0) {
        Utils.showToast("Harga harus diisi dengan angka yang valid!", 'error');
        priceInput.focus();
        return;
      }
      const useStock = document.getElementById('useStock')?.checked || false;
      const stock = useStock ? parseInt(document.getElementById('menuStock')?.value) || 0 : 0;
      const resep = [];
      const rows = document.querySelectorAll('#recipeContainer .recipe-row');
      for (let i = 0; i < rows.length; i++) {
        const select = document.getElementById(`bahan-${i}`);
        const qty = parseFloat(document.getElementById(`qty-${i}`)?.value);
        if (select?.value && qty > 0) {
          const bahan = state.rawMaterials.find(b => b.id === select.value);
          if (bahan) {
            resep.push({
              bahanId: bahan.id,
              nama: bahan.name,
              qty: qty,
              satuan: bahan.satuan || 'pcs'
            });
          }
        }
      }
      Utils.showToast("⏳ Menyimpan menu...", 'warning');
      let imageUrl = null;
      if (window._menuCroppedImage) {
        imageUrl = window._menuCroppedImage;
        window._menuCroppedImage = null;
      }
      const menuData = {
        name: name,
        price: price,
        categoryId: catId,
        useStock: useStock,
        stock: stock,
        resep: resep.length > 0 ? resep : null,
        imageUrl: imageUrl,
        active: true,
        createdAt: new Date()
      };
      await dbCloud.collection("menus").add(menuData);
      Utils.showToast("Menu berhasil ditambahkan!");
      closeAddMenuModal();
      openCategory(catId);
    } catch (error) {
      if (error.code === 'permission-denied') {
        Utils.showToast("Tidak punya izin. Periksa Firestore Rules", 'error');
      } else {
        Utils.showToast("Gagal: " + error.message, 'error');
      }
    }
  };
  function setupRecipeRowListeners(index) {
    const select = document.getElementById(`bahan-${index}`);
    if (select) {
      select.addEventListener('change', function (e) {
        const unit = e.target.options[e.target.selectedIndex]?.dataset?.satuan || 'pcs';
        const unitSpan = document.getElementById(`unit-${index}`);
        if (unitSpan) unitSpan.textContent = unit;
      });
    }
  }
}

async function editMenu(id) {
  const menu = state.menus.find(m => m.id === id);
  if (!menu) return;
  const existingModal = document.getElementById('custom-edit-modal');
  if (existingModal) existingModal.remove();
  const bahanOptions = state.rawMaterials.map(b =>
    `<option value="${b.id}" data-satuan="${b.satuan || 'pcs'}">${b.name} (${b.satuan || 'pcs'})</option>`
  ).join('');
  const modal = document.createElement('div');
  modal.id = 'custom-edit-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-lg modal-menu-detail">
      <div class="modal-menu-detail-body">
        <h3><i class="fas fa-edit"></i> Edit ${menu.name}</h3>
        <div class="form-group">
          <label class="form-label">Nama Menu</label>
          <input type="text" id="editName" class="form-input" value="${menu.name}">
        </div>
        <div class="form-group">
          <label class="form-label">Harga (Rp)</label>
          <input type="number" id="editPrice" class="form-input" value="${menu.price}">
        </div>
        <div class="form-group">
          <label class="form-label">Foto Produk <span class="text-muted">(opsional)</span></label>
          <div class="flex-center gap-3 flex-wrap">
            ${menu.imageUrl ? `
              <div id="editCurrentPhoto" class="image-preview-wrapper">
                <img src="${menu.imageUrl}" class="img-preview-sm">
                <button type="button" onclick="document.getElementById('editDeletePhoto').value='1';document.getElementById('editCurrentPhoto').classList.add('hidden');" class="btn-remove-photo" title="Hapus foto">×</button>
              </div>
            ` : ''}
            <label for="editMenuImage" class="image-upload-label">
              <i class="fas fa-camera"></i> ${menu.imageUrl ? 'Ganti Foto' : 'Pilih Foto'}
            </label>
            <input type="file" id="editMenuImage" accept="image/*" class="hidden" onchange="previewEditImage(this)">
            <input type="hidden" id="editDeletePhoto" value="0">
            <div id="editImagePreview" class="image-preview-wrapper hidden">
              <img id="editImagePreviewImg" class="img-preview-sm">
              <button type="button" onclick="clearEditImage()" class="btn-remove-photo">×</button>
            </div>
          </div>
          <small class="text-muted">Foto otomatis dikompres (max 800px, ~50KB)</small>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="editUseStock" ${menu.useStock ? 'checked' : ''}> Gunakan Stok Manual
          </label>
          <small class="text-muted">Stok akan dihitung otomatis dari bahan</small>
        </div>
        <div id="editStockField" class="form-group ${menu.useStock ? '' : 'is-hidden'}">
          <label class="form-label">Stok</label>
          <input type="number" id="editStock" class="form-input" value="${menu.stock || 0}">
        </div>
        <div class="form-group">
          <label class="form-label">Resep (Bahan Baku)</label>
          <p class="text-muted small">Stok dihitung dari bahan terkecil</p>
          <div id="editRecipeContainer">
            ${menu.resep?.map((r, i) => `
              <div class="recipe-row" id="edit-recipe-row-${i}">
                <select class="recipe-select" id="editBahan-${i}">
                  <option value="">Pilih Bahan</option>
                  ${state.rawMaterials.map(b =>
    `<option value="${b.id}" data-satuan="${b.satuan || 'pcs'}" ${b.id === r.bahanId ? 'selected' : ''}>${b.name} (${b.satuan || 'pcs'})</option>`
  ).join('')}
                </select>
                <input type="number" class="recipe-input" id="editQty-${i}" placeholder="Jumlah" min="0" step="0.1" value="${r.qty}">
                <span class="recipe-unit" id="editUnit-${i}">${r.satuan || 'pcs'}</span>
                <button type="button" class="recipe-remove" onclick="removeEditRecipeRow(${i})">×</button>
              </div>
            `).join('') || `
              <div class="recipe-row" id="edit-recipe-row-0">
                <select class="recipe-select" id="editBahan-0">
                  <option value="">Pilih Bahan</option>
                  ${bahanOptions}
                </select>
                <input type="number" class="recipe-input" id="editQty-0" placeholder="Jumlah" min="0" step="0.1" value="1">
                <span class="recipe-unit" id="editUnit-0">pcs</span>
                <button type="button" class="recipe-remove" onclick="removeEditRecipeRow(0)">×</button>
              </div>
            `}
          </div>
          <button type="button" class="recipe-add" onclick="addEditRecipeRow()">
            <i class="fas fa-plus"></i> Tambah Bahan
          </button>
        </div>
        <div class="modal-menu-footer">
          <button class="btn btn-secondary" onclick="closeEditModal()">Batal</button>
          <button class="btn btn-primary" onclick="saveEditMenu('${id}')">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('editUseStock')?.addEventListener('change', function (e) {
    const stockField = document.getElementById('editStockField');
    if (stockField) {
      stockField.classList.toggle('is-hidden', !e.target.checked);
    }
  });
  const rows = document.querySelectorAll('#editRecipeContainer .recipe-row');
  rows.forEach((row, i) => {
    const select = document.getElementById(`editBahan-${i}`);
    if (select) {
      select.addEventListener('change', function (e) {
        const unit = e.target.options[e.target.selectedIndex]?.dataset?.satuan || 'pcs';
        const unitSpan = document.getElementById(`editUnit-${i}`);
        if (unitSpan) unitSpan.textContent = unit;
      });
    }
  });
}

window.closeEditModal = function () {
  const modal = document.getElementById('custom-edit-modal');
  if (modal) modal.remove();
};

window.previewEditImage = async function (input) {
  if (!input.files || !input.files[0]) return;
  const base64 = await showImageCropModal(input.files[0]);
  input.value = '';
  if (!base64) return;
  window._editCroppedImage = base64;
  const preview = document.getElementById('editImagePreview');
  const previewImg = document.getElementById('editImagePreviewImg');
  if (preview && previewImg) { previewImg.src = base64; preview.classList.remove('hidden'); }
};

window.clearEditImage = function () {
  const input = document.getElementById('editMenuImage');
  const preview = document.getElementById('editImagePreview');
  if (input) input.value = '';
  if (preview) preview.classList.add('hidden');
  window._editCroppedImage = null;
};

window.addEditRecipeRow = function () {
  const container = document.getElementById('editRecipeContainer');
  if (!container) return;
  const bahanOptions = state.rawMaterials.map(b =>
    `<option value="${b.id}" data-satuan="${b.satuan || 'pcs'}">${b.name} (${b.satuan || 'pcs'})</option>`
  ).join('');
  const index = container.children.length;
  const row = document.createElement('div');
  row.className = 'recipe-row';
  row.id = `edit-recipe-row-${index}`;
  row.innerHTML = `
    <select class="recipe-select" id="editBahan-${index}">
      <option value="">Pilih Bahan</option>
      ${bahanOptions}
    </select>
    <input type="number" class="recipe-input" id="editQty-${index}" placeholder="Jumlah" min="0" step="0.1" value="1">
    <span class="recipe-unit" id="editUnit-${index}">pcs</span>
    <button type="button" class="recipe-remove" onclick="removeEditRecipeRow(${index})">×</button>
  `;
  container.appendChild(row);
  const select = document.getElementById(`editBahan-${index}`);
  if (select) {
    select.addEventListener('change', function (e) {
      const unit = e.target.options[e.target.selectedIndex]?.dataset?.satuan || 'pcs';
      const unitSpan = document.getElementById(`editUnit-${index}`);
      if (unitSpan) unitSpan.textContent = unit;
    });
  }
};

window.removeEditRecipeRow = function (index) {
  const row = document.getElementById(`edit-recipe-row-${index}`);
  if (row && document.querySelectorAll('#editRecipeContainer .recipe-row').length > 1) {
    row.remove();
  }
};

window.saveEditMenu = async function (id) {
  const nameInput = document.getElementById('editName');
  const priceInput = document.getElementById('editPrice');
  const useStockInput = document.getElementById('editUseStock');
  const stockInput = document.getElementById('editStock');
  if (!nameInput || !priceInput) {
    Utils.showToast("Error: Form tidak lengkap", 'error');
    return;
  }
  const name = nameInput.value.trim();
  const price = parseInt(priceInput.value);
  const useStock = useStockInput ? useStockInput.checked : false;
  const stock = useStock && stockInput ? parseInt(stockInput.value) || 0 : 0;
  if (!name) {
    Utils.showToast("Nama menu harus diisi", 'error');
    nameInput.focus();
    return;
  }
  if (!price || price <= 0) {
    Utils.showToast("Harga harus diisi dengan valid", 'error');
    priceInput.focus();
    return;
  }
  const resep = [];
  const rows = document.querySelectorAll('#editRecipeContainer .recipe-row');
  for (let i = 0; i < rows.length; i++) {
    const select = document.getElementById(`editBahan-${i}`);
    const qtyInput = document.getElementById(`editQty-${i}`);
    if (!select || !qtyInput) continue;
    const qty = parseFloat(qtyInput.value);
    if (select.value && qty > 0) {
      const bahan = state.rawMaterials.find(b => b.id === select.value);
      if (bahan) {
        resep.push({
          bahanId: bahan.id,
          nama: bahan.name,
          qty: qty,
          satuan: bahan.satuan || 'pcs'
        });
      }
    }
  }
  try {
    Utils.showToast("⏳ Menyimpan perubahan...", 'warning');
    let imageUrl = undefined;
    const deletePhoto = document.getElementById('editDeletePhoto')?.value === '1';
    if (deletePhoto && !window._editCroppedImage) {
      imageUrl = null;
    } else if (window._editCroppedImage) {
      imageUrl = window._editCroppedImage;
      window._editCroppedImage = null;
    }
    const updateData = {
      name,
      price,
      useStock,
      stock,
      resep: resep.length ? resep : null,
      updatedAt: new Date()
    };
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    await dbCloud.collection("menus").doc(id).update(updateData);
    Utils.showToast("Menu berhasil diupdate");
    closeEditModal();
    openCategory(state.currentCategoryId);
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
};

async function deleteMenu(id) {
  if (!await Utils.showConfirm("Hapus menu ini?")) return;
  try {
    await dbCloud.collection("menus").doc(id).delete();
    Utils.showToast("Menu dihapus");
    openCategory(state.currentCategoryId);
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

function toggleSelectMenu(id) {
  if (state.selectedMenus.has(id)) state.selectedMenus.delete(id);
  else state.selectedMenus.add(id);
  openCategory(state.currentCategoryId);
}

function toggleSelectAllMenu(categoryId) {
  const menus = state.menus.filter(m => m.categoryId === categoryId);
  if (state.selectedMenus.size === menus.length) state.selectedMenus.clear();
  else menus.forEach(m => state.selectedMenus.add(m.id));
  openCategory(categoryId);
}

async function deleteSelectedMenus(categoryId) {
  if (state.selectedMenus.size === 0) return;
  if (!await Utils.showConfirm(`Hapus ${state.selectedMenus.size} menu?`)) return;
  try {
    const jumlah = state.selectedMenus.size;
    await Promise.all([...state.selectedMenus].map(id => dbCloud.collection("menus").doc(id).delete()));
    state.selectedMenus.clear();
    Utils.showToast(`${jumlah} menu dihapus`);
    openCategory(categoryId);
  } catch (error) {
    Utils.showToast("Gagal: " + error.message, 'error');
  }
}

window.renderMenuManager = renderMenuManager;
window.showAddCategoryModal = showAddCategoryModal;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;

window._onMenuSearch = function(val) {
  _menuSearchQuery = val;
  renderMenuManager();
  const input = document.querySelector('.search-input');
  if (input) {
    input.focus();
    input.setSelectionRange(val.length, val.length);
  }
};
window.openCategory = openCategory;
window.showAddMenuModal = showAddMenuModal;
window.editMenu = editMenu;
window.deleteMenu = deleteMenu;
window.toggleSelectMenu = toggleSelectMenu;
window.toggleSelectAllMenu = toggleSelectAllMenu;
window.deleteSelectedMenus = deleteSelectedMenus;
window.sortMenus = sortMenus;

window._onCatSearch = function(val) {
  state.categorySearchQuery = val;
  const id = state.currentCategoryId;
  const category = state.categories.find(c => c.id === id);
  if (!category) return;
  const menus = state.menus.filter(m => m.categoryId === id);
  const filteredMenus = !(state.categorySearchQuery || '').trim() ? menus :
    menus.filter(m => m.name.toLowerCase().includes(state.categorySearchQuery.toLowerCase()));
  const sortedMenus = SortableTable.sort(filteredMenus, 'menus');

  const statsContainer = document.getElementById('cat-stats-container');
  if (statsContainer) statsContainer.innerHTML = _renderCatStatsHTML(category, menus, filteredMenus);

  const actionsContainer = document.getElementById('cat-actions-container');
  if (actionsContainer) actionsContainer.innerHTML = _renderCatActionsHTML(id, filteredMenus);

  const tbody = document.getElementById('cat-menu-tbody');
  if (tbody) tbody.innerHTML = _renderCatTableBodyHTML(sortedMenus);
};