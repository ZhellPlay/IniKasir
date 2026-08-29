let currentSettingsTab = '';
let currentOperationalSection = 'home';
let lastSettingsScroll = 0;
let lastSettingsTabScroll = 0;
let operationalSearch = { meja: '', kasir: '', diskon: '' };
let operationalStatus = { meja: 'semua', kasir: 'semua', diskon: 'semua' };

function _settingsAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSettings() {
  const _m = document.querySelector('main');
  if (_m && state.currentView === "settings") lastSettingsScroll = _m.scrollTop;

  state.currentView = "settings";
  const settingsMenu = [
    ['struk', 'fa-receipt', 'Struk', 'Identitas & tampilan'],
    ['kasir', 'fa-users', 'Kasir', 'Kelola kasir dan akses'],
    ['meja', 'fa-chair', 'Meja', 'Kelola meja'],
    ['diskon', 'fa-percent', 'Diskon', 'Kelola diskon dan template'],
    ['backup', 'fa-database', 'Backup', 'Import, export & reset data']
  ];

  const content = `
    <div class="stack-y page-static settings-page">
      <nav class="settings-menu" aria-label="Pengaturan">
        ${settingsMenu.map(([key, icon, title, subtitle]) => `
          <div class="settings-menu-group ${currentSettingsTab === key ? 'open' : ''}">
            <button type="button" class="settings-menu-item ${currentSettingsTab === key ? 'active' : ''}"
                    onclick="switchSettingsTab('${key}')" aria-expanded="${currentSettingsTab === key ? 'true' : 'false'}">
              <span class="settings-menu-icon"><i class="fas ${icon}"></i></span>
              <span class="settings-menu-copy">
                <strong>${title}</strong>
                <small>${subtitle}</small>
              </span>
              <i class="fas fa-chevron-down settings-menu-chevron"></i>
            </button>
            ${currentSettingsTab === key ? `
              <div id="settings-content-${key}" class="settings-content settings-menu-content">
                ${renderSettingsTab()}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </nav>
    </div>
  `;

  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();

  requestAnimationFrame(() => {
    const _main = document.querySelector('main');
    if (_main && lastSettingsScroll > 0) _main.scrollTop = lastSettingsScroll;
  });
}

function renderSettingsTab() {
  const s = state.settings || {};
  if (currentSettingsTab === 'struk') {
    const footerText = s.struk?.footer?.join('\n') || '';
    return `
      <div class="settings-card settings-module-card">
        <div class="settings-section-head">
          <div>
            <h3><i class="fas fa-receipt"></i> Struk</h3>
          </div>
          <button class="btn btn-primary btn-sm" onclick="const b=this;Utils.setButtonLoading(b,true);saveStrukSettings().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>

        <div class="settings-form-stack">
          <div class="form-group">
            <label class="form-label">Nama Toko</label>
            <input type="text" id="tokoNama" class="form-input" value="${s.toko?.nama || ''}">
            <small class="text-muted settings-field-help"><i class="fas fa-info-circle"></i> Untuk struk &amp; laporan.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Alamat</label>
            <textarea id="tokoAlamat" class="form-input" rows="3">${s.toko?.alamat || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Telepon</label>
            <input type="text" id="tokoTelepon" class="form-input" value="${s.toko?.telepon || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="tokoEmail" class="form-input" value="${s.toko?.email || ''}">
          </div>

          <div class="form-group">
            <label class="form-label">Jam Buka Operasional</label>
            <input type="time" id="jamBukaOps" class="form-input" value="${s.operasional?.jamBuka || '08:00'}">
            <small class="text-muted settings-field-help"><i class="fas fa-info-circle"></i> Untuk reset harian pada Laporan.</small>
          </div>

          <div class="settings-form-separator" aria-hidden="true"></div>

          <div class="form-group">
            <label class="form-label">Header Struk</label>
            <input type="text" id="strukHeader" class="form-input" value="${s.struk?.header || 'TERIMA KASIH'}">
          </div>

          <div class="form-group">
            <label class="form-label">Footer Struk</label>
            <textarea id="strukFooter" class="form-input" rows="4">${footerText}</textarea>
          </div>

          <div class="checkbox-group settings-receipt-options">
            <label class="checkbox-label">
              <input type="checkbox" id="showMeja" ${s.struk?.showMeja !== false ? 'checked' : ''}>
              <span>Tampilkan nomor meja di struk</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="showHargaSatuan" ${s.struk?.showHargaSatuan === true ? 'checked' : ''}>
              <span>Tampilkan harga satuan</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  if (currentSettingsTab === 'kasir') {
    const kasirRaw = (s.kasirs || []).map((k, i) => ({ ...k, _origIndex: i }));
    const kasirList = SortableTable.sort(kasirRaw, 'kasir');
    const q = operationalSearch.kasir.trim().toLowerCase();
    const status = operationalStatus.kasir;
    const kasirFiltered = kasirList.filter(k => {
      const matchesQuery = !q || String(k.nama || '').toLowerCase().includes(q);
      const matchesStatus = status === 'semua' || (status === 'aktif' ? k.aktif !== false : k.aktif === false);
      return matchesQuery && matchesStatus;
    });

    return `
      <div class="settings-card settings-module-card settings-kasir-card">
        <div class="settings-section-head">
          <div>
            <h3><i class="fas fa-users"></i> Kasir</h3>
            <p class="settings-section-subtitle">Kelola kasir dan akses.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="const b=this;Utils.setButtonLoading(b,true);saveKasirSettings([...(state.settings?.kasirs || [])]).finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>

        <div class="add-row operational-add-row">
          <input type="text" id="newKasirNama" class="form-input" placeholder="Nama kasir">
          <button class="btn btn-primary" onclick="_saveSettingsScroll();const b=this;Utils.setButtonLoading(b,true);tambahKasir().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-plus"></i> Tambah
          </button>
        </div>

        <div class="operational-list-toolbar">
          <div class="operational-search">
            <i class="fas fa-search"></i>
            <input class="form-input" value="${operationalSearch.kasir}" placeholder="Cari nama kasir..." oninput="setOperationalSearch('kasir', this.value)">
          </div>
          <select class="form-input operational-filter" aria-label="Filter status kasir" onchange="setOperationalStatus('kasir', this.value)">
            <option value="semua" ${status === 'semua' ? 'selected' : ''}>Semua</option>
            <option value="aktif" ${status === 'aktif' ? 'selected' : ''}>Aktif</option>
            <option value="nonaktif" ${status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
        <div class="operational-list-meta">${kasirFiltered.length} dari ${kasirList.length} kasir</div>

        <div class="operational-scroll-list settings-record-list">
          ${kasirFiltered.length ? kasirFiltered.map(k => `
            <div class="settings-record-row settings-kasir-record" data-settings-search="${_settingsAttr(k.nama)}" data-settings-active="${k.aktif !== false ? 'true' : 'false'}">
              <div class="settings-record-main">
                <strong>${k.nama}</strong>
              </div>
              <span class="badge ${k.aktif !== false ? 'badge-success' : 'badge-danger'} settings-record-status">${k.aktif !== false ? 'Aktif' : 'Nonaktif'}</span>
              <div class="settings-record-actions">
                <button class="btn btn-sm ${k.aktif !== false ? 'btn-warning' : 'btn-primary'}" onclick="_saveSettingsScroll();const b=this;Utils.setButtonLoading(b,true);toggleKasirStatus(${k._origIndex}).finally(()=>Utils.setButtonLoading(b,false))">${k.aktif !== false ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button class="btn btn-sm btn-icon-sm btn-icon-warning" onclick="_saveSettingsScroll();editKasir(${k._origIndex})" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger btn-icon-sm" onclick="_saveSettingsScroll();const b=this;Utils.setButtonLoading(b,true);hapusKasir(${k._origIndex}).finally(()=>Utils.setButtonLoading(b,false))" title="Hapus"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('') : ''}
          <div class="settings-operational-empty text-muted text-center p-3" ${kasirFiltered.length ? 'hidden' : ''}>Belum ada kasir yang sesuai.</div>
        </div>
      </div>
    `;
  }

  if (currentSettingsTab === 'meja') {
    const mejaAktif = s.fitur?.meja !== undefined ? s.fitur.meja !== false : s.meja?.aktif !== false;
    const mejaAll = SortableTable.sort(state.tables || [], 'meja');
    const q = operationalSearch.meja.trim().toLowerCase();
    const status = operationalStatus.meja;
    const mejaFiltered = mejaAll.filter(t => {
      const matchesQuery = !q || String(t.nomor || '').toLowerCase().includes(q) || String(t.nama || '').toLowerCase().includes(q);
      const matchesStatus = status === 'semua' || (status === 'aktif' ? t.aktif !== false : t.aktif === false);
      return matchesQuery && matchesStatus;
    });

    return `
      <div class="settings-card settings-module-card settings-meja-card">
        <div class="settings-section-head">
          <div>
            <h3><i class="fas fa-chair"></i> Meja</h3>
            <p class="settings-section-subtitle">Kelola meja dan pengaturan fitur meja.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="const b=this;Utils.setButtonLoading(b,true);saveFiturSettings().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>

        <div class="checkbox-group operational-feature-toggle">
          <label class="checkbox-label">
            <input type="checkbox" id="fiturMejaAktif" ${mejaAktif ? 'checked' : ''}>
            <span><strong>Aktifkan fitur meja</strong></span>
          </label>
        </div>

        <div class="add-row operational-add-row">
          <input type="text" id="newMejaNomor" class="form-input" placeholder="Nomor meja">
          <input type="text" id="newMejaNama" class="form-input" placeholder="Nama meja">
          <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);tambahMeja().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-plus"></i> Tambah
          </button>
        </div>

        <div class="operational-list-toolbar">
          <div class="operational-search">
            <i class="fas fa-search"></i>
            <input class="form-input" value="${operationalSearch.meja}" placeholder="Cari nomor atau nama meja..." oninput="setOperationalSearch('meja', this.value)">
          </div>
          <select class="form-input operational-filter" aria-label="Filter status meja" onchange="setOperationalStatus('meja', this.value)">
            <option value="semua" ${status === 'semua' ? 'selected' : ''}>Semua</option>
            <option value="aktif" ${status === 'aktif' ? 'selected' : ''}>Aktif</option>
            <option value="nonaktif" ${status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
        <div class="operational-list-meta">${mejaFiltered.length} dari ${mejaAll.length} meja</div>

        <div class="operational-scroll-list settings-record-list">
          ${mejaFiltered.length ? mejaFiltered.map(m => `
            <div class="settings-record-row settings-meja-record" data-settings-search="${_settingsAttr(`${m.nomor} ${m.nama || ''}`)}" data-settings-active="${m.aktif !== false ? 'true' : 'false'}">
              <div class="settings-record-main">
                <strong>${m.nomor}</strong>
                <small>${m.nama || 'Tanpa nama'}</small>
              </div>
              <span class="badge ${m.aktif !== false ? 'badge-success' : 'badge-danger'} settings-record-status">${m.aktif !== false ? 'Aktif' : 'Nonaktif'}</span>
              <div class="settings-record-actions">
                <button class="btn btn-sm ${m.aktif !== false ? 'btn-warning' : 'btn-primary'}" onclick="_saveSettingsScroll();const b=this;Utils.setButtonLoading(b,true);toggleMejaStatus('${m.id}').finally(()=>Utils.setButtonLoading(b,false))">${m.aktif !== false ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button class="btn btn-sm btn-icon-sm btn-icon-warning" onclick="_saveSettingsScroll();editMeja('${m.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger btn-icon-sm" onclick="_saveSettingsScroll();const b=this;Utils.setButtonLoading(b,true);hapusMeja('${m.id}').finally(()=>Utils.setButtonLoading(b,false))" title="Hapus"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('') : ''}
          <div class="settings-operational-empty text-muted text-center p-3" ${mejaFiltered.length ? 'hidden' : ''}>Belum ada meja yang sesuai.</div>
        </div>
      </div>
    `;
  }

  if (currentSettingsTab === 'diskon') {
    const diskonAktif = s.fitur?.diskon !== false;
    const diskonCfg = s.fitur?.diskonPengaturan || {};
    const diskonMode = diskonCfg.mode || 'both';
    const templates = Array.isArray(diskonCfg.templates) ? diskonCfg.templates : [];
    const q = operationalSearch.diskon.trim().toLowerCase();
    const status = operationalStatus.diskon;
    const templateFiltered = templates.filter(t => {
      const matchesQuery = !q || String(t.nama || '').toLowerCase().includes(q);
      const matchesStatus = status === 'semua' || (status === 'aktif' ? t.aktif !== false : t.aktif === false);
      return matchesQuery && matchesStatus;
    });

    return `
      <div class="settings-card settings-module-card">
        <div class="settings-section-head">
          <div>
            <h3><i class="fas fa-percent"></i> Diskon</h3>
            <p class="settings-section-subtitle">Kelola fitur, mode, dan template diskon.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="const b=this;Utils.setButtonLoading(b,true);saveFiturSettings().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>

        <div class="checkbox-group operational-feature-toggle">
          <label class="checkbox-label">
            <input type="checkbox" id="fiturDiskonAktif" ${diskonAktif ? 'checked' : ''}>
            <span><strong>Aktifkan fitur diskon</strong></span>
          </label>
        </div>

        <div class="form-group operational-discount-mode">
          <label class="form-label">Mode Diskon</label>
          <select id="diskonModeKasir" class="form-input">
            <option value="manual" ${diskonMode === 'manual' ? 'selected' : ''}>Manual saja</option>
            <option value="auto" ${diskonMode === 'auto' ? 'selected' : ''}>Otomatis dari template</option>
            <option value="both" ${diskonMode === 'both' ? 'selected' : ''}>Manual + Otomatis</option>
          </select>
        </div>

        <div class="discount-template-form">
          <input id="discountTemplateName" class="form-input" placeholder="Nama template">
          <input id="discountTemplateMin" class="form-input" type="number" min="0" placeholder="Minimal belanja">
          <select id="discountTemplateType" class="form-input">
            <option value="percent">Persen (%)</option>
            <option value="nominal">Nominal (Rp)</option>
          </select>
          <input id="discountTemplateValue" class="form-input" type="number" min="0" placeholder="Nilai diskon">
          <button class="btn btn-secondary" onclick="const b=this;Utils.setButtonLoading(b,true);tambahTemplateDiskon().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-plus"></i> Tambah
          </button>
        </div>

        <div class="operational-list-toolbar">
          <div class="operational-search">
            <i class="fas fa-search"></i>
            <input class="form-input" value="${operationalSearch.diskon}" placeholder="Cari template..." oninput="setOperationalSearch('diskon', this.value)">
          </div>
          <select class="form-input operational-filter" aria-label="Filter status diskon" onchange="setOperationalStatus('diskon', this.value)">
            <option value="semua" ${status === 'semua' ? 'selected' : ''}>Semua</option>
            <option value="aktif" ${status === 'aktif' ? 'selected' : ''}>Aktif</option>
            <option value="nonaktif" ${status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
        <div class="operational-list-meta">${templateFiltered.length} dari ${templates.length} diskon</div>

        <div class="discount-template-list operational-scroll-list">
          ${templateFiltered.length ? templateFiltered.map(t => {
            const idx = templates.indexOf(t);
            return `
              <div class="settings-record-row settings-diskon-record" data-settings-search="${_settingsAttr(t.nama || 'Diskon')}" data-settings-active="${t.aktif === false ? 'false' : 'true'}">
                <div class="settings-record-main">
                  <strong>${t.nama || 'Diskon'}</strong>
                  <small>Min. Rp ${Utils.formatRupiah(Number(t.minBelanja || 0))} · ${t.tipe === 'nominal' ? 'Rp ' + Utils.formatRupiah(Number(t.nilai || 0)) : Number(t.nilai || 0) + '%'}</small>
                </div>
                <span class="badge ${t.aktif === false ? 'badge-danger' : 'badge-success'} settings-record-status">${t.aktif === false ? 'Nonaktif' : 'Aktif'}</span>
                <div class="settings-record-actions discount-template-actions">
                  <button class="btn btn-sm ${t.aktif === false ? 'btn-primary' : 'btn-warning'}" onclick="toggleTemplateDiskon(${idx})">${t.aktif === false ? 'Aktifkan' : 'Nonaktifkan'}</button>
                  <button class="btn btn-sm btn-icon-sm btn-icon-warning" onclick="editTemplateDiskon(${idx})" title="Edit"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-sm btn-danger btn-icon-sm" onclick="hapusTemplateDiskon(${idx})" title="Hapus"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `;
          }).join('') : ''}
          <div class="settings-operational-empty text-muted text-center p-3" ${templateFiltered.length ? 'hidden' : ''}>Belum ada diskon yang sesuai.</div>
        </div>
      </div>
    `;
  }

  if (currentSettingsTab === 'backup') {
    return `
      <div class="settings-card">
        <div class="settings-section-head settings-backup-head"><h3><i class="fas fa-database"></i> Backup & Restore</h3></div>
        <div class="backup-grid settings-backup-grid">
          <div class="backup-card settings-backup-card">
            <div class="backup-icon"><i class="fas fa-file-import"></i></div>
            <h4>Import Excel</h4>
            <p>Menu, kategori &amp; bahan</p>
            <div class="backup-card-control">
              <div class="settings-file-picker">
                <input type="file" id="importExcelFile" accept=".xlsx,.xls" class="settings-file-input" onchange="updateImportExcelFileName(this)">
                <label for="importExcelFile" class="btn btn-secondary settings-file-picker-btn">
                  <i class="fas fa-folder-open"></i> Pilih File
                </label>
                <span id="importExcelFileName" class="settings-file-name">Tidak ada file yang dipilih</span>
              </div>
              <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);importFromExcel().finally(()=>Utils.setButtonLoading(b,false))">
                <i class="fas fa-upload"></i> Import
              </button>
            </div>
          </div>
          <div class="backup-card settings-backup-card">
            <div class="backup-icon"><i class="fas fa-download"></i></div>
            <h4>Template Excel</h4>
            <p>Kategori, menu &amp; bahan</p>
            <div class="backup-card-control">
              <button class="btn btn-secondary" onclick="downloadTemplateExcel()">
                <i class="fas fa-file"></i> Template
              </button>
            </div>
          </div>
          <div class="backup-card warning settings-backup-card">
            <div class="backup-icon"><i class="fas fa-history"></i></div>
            <h4>Reset Riwayat</h4>
            <p>Transaksi, shift &amp; mutasi stok</p>
            <div class="backup-card-control">
              <button class="btn btn-warning" onclick="const b=this;Utils.setButtonLoading(b,true);resetRiwayatOnly().finally(()=>Utils.setButtonLoading(b,false))">
                <i class="fas fa-trash-alt"></i> Reset
              </button>
            </div>
          </div>
          <div class="backup-card danger settings-backup-card">
            <div class="backup-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <h4>Reset Total</h4>
            <p>Semua data aplikasi</p>
            <div class="backup-card-control">
              <button class="btn btn-danger" onclick="const b=this;Utils.setButtonLoading(b,true);resetData().finally(()=>Utils.setButtonLoading(b,false))">
                <i class="fas fa-skull-crossbones"></i> Reset Total
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  return '';
}

function switchSettingsTab(tab) {
  if (!['struk', 'kasir', 'meja', 'diskon', 'backup'].includes(tab)) return;
  const _m = document.querySelector('main');
  const isClosing = currentSettingsTab === tab;
  if (_m) _saveSettingsScroll();
  currentSettingsTab = isClosing ? '' : tab;
  renderSettings();
  requestAnimationFrame(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = lastSettingsScroll;
  });
}


function setOperationalSearch(section, value) {
  operationalSearch[section] = value;
  const content = document.getElementById(`settings-content-${section}`);
  if (!content) return;

  const query = String(value || '').trim().toLowerCase();
  const status = operationalStatus[section] || 'semua';
  const rows = Array.from(content.querySelectorAll('[data-settings-search]'));
  let visible = 0;

  rows.forEach(row => {
    const text = String(row.dataset.settingsSearch || '').toLowerCase();
    const active = row.dataset.settingsActive === 'true';
    const matchesQuery = !query || text.includes(query);
    const matchesStatus = status === 'semua' || (status === 'aktif' ? active : !active);
    const show = matchesQuery && matchesStatus;
    row.hidden = !show;
    if (show) visible++;
  });

  const meta = content.querySelector('.operational-list-meta');
  if (meta) {
    const labels = { kasir: 'kasir', meja: 'meja', diskon: 'diskon' };
    meta.textContent = `${visible} dari ${rows.length} ${labels[section] || ''}`.trim();
  }

  const empty = content.querySelector('.settings-operational-empty');
  if (empty) empty.hidden = visible !== 0;
}

function setOperationalStatus(section, value) {
  operationalStatus[section] = value;
  renderSettings();
}

function switchOperationalSection(section) {
  _saveSettingsScroll();
  currentOperationalSection = ['home', 'meja', 'kasir', 'diskon'].includes(section) ? section : 'home';
  renderSettings();
  requestAnimationFrame(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = lastSettingsScroll;
  });
}

function _saveSettingsScroll() {
  const _m = document.querySelector('main');
  if (_m) lastSettingsScroll = _m.scrollTop;
}

async function saveTokoSettings() {
  return saveStrukSettings();
}

async function saveStrukSettings() {
  _saveSettingsScroll();
  try {
    const tokoData = {
      nama: document.getElementById('tokoNama')?.value || '',
      alamat: document.getElementById('tokoAlamat')?.value || '',
      telepon: document.getElementById('tokoTelepon')?.value || '',
      email: document.getElementById('tokoEmail')?.value || ''
    };
    const jamBuka = document.getElementById('jamBukaOps')?.value || '08:00';
    const footerText = document.getElementById('strukFooter')?.value || '';
    const footer = footerText.split('\n').filter(l => l.trim() !== '');
    const strukData = {
      header: document.getElementById('strukHeader')?.value || 'TERIMA KASIH',
      footer,
      showMeja: document.getElementById('showMeja')?.checked !== false,
      showHargaSatuan: document.getElementById('showHargaSatuan')?.checked === true
    };

    await dbCloud.collection("settings").doc("toko").update({
      toko: tokoData,
      operasional: { ...(state.settings?.operasional || {}), jamBuka },
      struk: strukData
    });

    state.settings.toko = tokoData;
    state.settings.operasional = { ...(state.settings.operasional || {}), jamBuka };
    state.settings.struk = strukData;

    Utils.showToast("Pengaturan disimpan");
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function tambahMeja() {
  _saveSettingsScroll();
  const nomor = document.getElementById('newMejaNomor').value;
  const nama = document.getElementById('newMejaNama').value;
  if (!nomor || !nama) {
    Utils.showToast("Nomor dan nama harus diisi", 'error');
    return;
  }
  try {
    await dbCloud.collection("tables").add({
      nomor,
      nama,
      aktif: true
    });
    document.getElementById('newMejaNomor').value = '';
    document.getElementById('newMejaNama').value = '';
    Utils.showToast("Meja ditambahkan");
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function toggleMejaStatus(id) {
  _saveSettingsScroll();
  const meja = state.tables.find(t => t.id === id);
  if (!meja) return;
  try {
    await dbCloud.collection("tables").doc(id).update({
      aktif: !meja.aktif
    });
    Utils.showToast(`Meja ${!meja.aktif ? 'diaktifkan' : 'dinonaktifkan'}`);
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function hapusMeja(id) {
  _saveSettingsScroll();
  if (!await Utils.showConfirm("Hapus meja ini?")) return;
  try {
    await dbCloud.collection("tables").doc(id).delete();
    Utils.showToast("Meja dihapus");
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function saveFiturSettings() {
  _saveSettingsScroll();
  try {
    const meja = document.getElementById('fiturMejaAktif')?.checked ?? (state.settings?.fitur?.meja !== false);
    const diskon = document.getElementById('fiturDiskonAktif')?.checked ?? (state.settings?.fitur?.diskon !== false);
    const diskonMode = document.getElementById('diskonModeKasir')?.value || 'both';
    const currentTemplates = Array.isArray(state.settings?.fitur?.diskonPengaturan?.templates)
      ? state.settings.fitur.diskonPengaturan.templates : [];
    const diskonPengaturan = {
      mode: ['manual','auto','both'].includes(diskonMode) ? diskonMode : 'both',
      templates: currentTemplates
    };
    const fitur = { ...(state.settings.fitur || {}), meja, diskon, diskonPengaturan };
    await dbCloud.collection("settings").doc("toko").update({
      fitur,
      meja: { ...(state.settings.meja || {}), aktif: meja }
    });
    state.settings.fitur = fitur;
    state.settings.meja = { ...(state.settings.meja || {}), aktif: meja };
    if (!meja) state.selectedTable = null;
    if (!diskon && !window._currentOpenBillId) {
      state.discountMode = 'percent';
      state.discountValue = 0;
      state.discountSource = 'manual';
      state.discountTemplateId = null;
      window._discountDraftValue = 0;
    }
    Utils.showToast("Pengaturan fitur disimpan");
    renderSettings();
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function _saveDiscountTemplates(templates) {
  const fitur = { ...(state.settings?.fitur || {}), diskonPengaturan: { ...(state.settings?.fitur?.diskonPengaturan || {}), templates } };
  await dbCloud.collection('settings').doc('toko').update({ fitur });
  state.settings.fitur = fitur;
  renderSettings();
}

async function tambahTemplateDiskon() {
  const nama = (document.getElementById('discountTemplateName')?.value || '').trim() || 'Template Diskon';
  const minBelanja = Math.max(0, Number(document.getElementById('discountTemplateMin')?.value || 0));
  const tipe = document.getElementById('discountTemplateType')?.value === 'nominal' ? 'nominal' : 'percent';
  let nilai = Math.max(0, Number(document.getElementById('discountTemplateValue')?.value || 0));
  if (tipe === 'percent') nilai = Math.min(nilai, 100);
  if (nilai <= 0) { Utils.showToast('Nilai diskon harus lebih dari 0', 'warning'); return; }
  const templates = [...(state.settings?.fitur?.diskonPengaturan?.templates || []), { id: 'dt_' + Date.now(), nama, minBelanja, tipe, nilai, aktif: true }];
  try { await _saveDiscountTemplates(templates); Utils.showToast('Template diskon ditambahkan'); }
  catch (e) { Utils.showToast(Utils.getFriendlyError(e, 'Gagal menambahkan template diskon. Silakan coba lagi.'), 'error'); }
}

async function editTemplateDiskon(index) {
  const templates = [...(state.settings?.fitur?.diskonPengaturan?.templates || [])];
  const template = templates[index];
  if (!template) return;
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  const result = await Utils.showModal({
    title: 'Edit Diskon',
    customClass: 'swal2-is-settings-compact',
    content: `
      <div class="form-group">
        <label class="form-label">Nama template</label>
        <input id="editDiscountTemplateName" class="form-input" value="${esc(template.nama || '')}">
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Minimal belanja</label>
          <input id="editDiscountTemplateMin" class="form-input" type="number" min="0" value="${Number(template.minBelanja || 0)}">
        </div>
        <div class="form-group">
          <label class="form-label">Tipe</label>
          <select id="editDiscountTemplateType" class="form-input">
            <option value="percent" ${template.tipe !== 'nominal' ? 'selected' : ''}>Persen (%)</option>
            <option value="nominal" ${template.tipe === 'nominal' ? 'selected' : ''}>Nominal (Rp)</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nilai diskon</label>
        <input id="editDiscountTemplateValue" class="form-input" type="number" min="0" value="${Number(template.nilai || 0)}">
      </div>`,
    buttons: [
      { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
      { text: 'Simpan', action: 'save', class: 'btn-primary', onClick: () => {
        window._editDiscountTemplate = {
          nama: (document.getElementById('editDiscountTemplateName')?.value || '').trim(),
          minBelanja: Math.max(0, Number(document.getElementById('editDiscountTemplateMin')?.value || 0)),
          tipe: document.getElementById('editDiscountTemplateType')?.value === 'nominal' ? 'nominal' : 'percent',
          nilai: Math.max(0, Number(document.getElementById('editDiscountTemplateValue')?.value || 0))
        };
      }}
    ]
  });
  if (result !== 'save') return;
  const data = window._editDiscountTemplate;
  delete window._editDiscountTemplate;
  if (!data.nama) { Utils.showToast('Nama template wajib diisi', 'warning'); return; }
  if (data.nilai <= 0) { Utils.showToast('Nilai diskon harus lebih dari 0', 'warning'); return; }
  if (data.tipe === 'percent') data.nilai = Math.min(data.nilai, 100);
  templates[index] = { ...template, ...data };
  try { await _saveDiscountTemplates(templates); Utils.showToast('Template diskon diperbarui'); }
  catch (e) { Utils.showToast(Utils.getFriendlyError(e, 'Gagal mengubah template diskon. Silakan coba lagi.'), 'error'); }
}

async function toggleTemplateDiskon(index) {
  const templates = [...(state.settings?.fitur?.diskonPengaturan?.templates || [])];
  if (!templates[index]) return;
  templates[index] = { ...templates[index], aktif: templates[index].aktif === false };
  try { await _saveDiscountTemplates(templates); } catch (e) { Utils.showToast(Utils.getFriendlyError(e, 'Gagal mengubah template diskon. Silakan coba lagi.'), 'error'); }
}

async function hapusTemplateDiskon(index) {
  const templates = [...(state.settings?.fitur?.diskonPengaturan?.templates || [])];
  if (!templates[index]) return;
  if (!await Utils.showConfirm('Hapus template diskon ini?')) return;
  templates.splice(index, 1);
  try { await _saveDiscountTemplates(templates); Utils.showToast('Template diskon dihapus'); } catch (e) { Utils.showToast(Utils.getFriendlyError(e, 'Gagal menghapus template diskon. Silakan coba lagi.'), 'error'); }
}

async function saveMejaSettings() {
  _saveSettingsScroll();
  try {
    await dbCloud.collection("settings").doc("toko").update({
      meja: {
        aktif: document.getElementById('mejaAktif').checked
      }
    });
    state.settings.meja = {
      ...state.settings.meja,
      aktif: document.getElementById('mejaAktif').checked
    };
    Utils.showToast("Pengaturan disimpan");
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function exportToPDFShift() {
  if (!state.currentSession) {
    Utils.showToast("Tidak ada shift aktif!", 'warning');
    return;
  }

  const transactions = state.transactions.filter(t => t.sessionId === state.currentSession.id);
  const totalTransaksi = transactions.length;
  const totalPenjualan = transactions.reduce((s, t) => s + t.total, 0);
  const totalDiskon = transactions.reduce((s, t) => s + (t.discountAmount || 0), 0);
  const totalHPP = transactions.reduce((s, t) => s + (t.items || []).reduce((x, i) => x + (Number(i.costPrice || 0) * (i.qty || 0)), 0), 0);
  const labaKotor = totalPenjualan - totalHPP;
  const totalCash = transactions.reduce((s, t) => {
    const qris = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
    return s + (t.metodeBayar === 'tunai' ? (t.total || 0) : Math.max(0, (t.total || 0) - qris));
  }, 0);
  const totalQRIS = transactions.reduce((s, t) => {
    const qrisAmt = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
    return s + qrisAmt;
  }, 0);
  const totalPengeluaran = state.pengeluaran?.filter(p => p.sessionId === state.currentSession.id)?.reduce((s, p) => s + (p.nominal || 0), 0) || 0;
  const cashBersih = totalCash - totalPengeluaran;
  const pengeluaranList = state.pengeluaran?.filter(p => p.sessionId === state.currentSession.id) || [];

  const produkCount = {};
  transactions.forEach(t => {
    t.items.forEach(i => {
      if (!produkCount[i.name]) produkCount[i.name] = { qty: 0, total: 0, hpp: 0, laba: 0 };
      const sales = (i.price + (i.modifierTotal || 0)) * i.qty;
      const hpp = Number(i.costPrice || 0) * i.qty;
      produkCount[i.name].qty += i.qty;
      produkCount[i.name].total += sales;
      produkCount[i.name].hpp += hpp;
      produkCount[i.name].laba += sales - hpp;
    });
  });
  const topProducts = Object.entries(produkCount).sort((a, b) => b[1].qty - a[1].qty);

  const waktuBuka = state.currentSession.waktuBuka?.seconds ? new Date(state.currentSession.waktuBuka.seconds * 1000) : new Date(state.currentSession.waktuBuka);

  await generatePDF({
    title: `LAPORAN SHIFT ${state.currentSession.shift}`,
    subtitle: `Kasir: ${state.currentSession.kasir} | Dicetak: ${new Date().toLocaleString('id-ID')}`,
    totalTransaksi,
    totalPenjualan,
    totalDiskon,
    totalHPP,
    labaKotor,
    totalCash,
    totalQRIS,
    totalPengeluaran,
    cashBersih,
    pengeluaranList,
    topProducts,
    filename: `laporan_shift_${state.currentSession.shift}_${new Date().toISOString().slice(0, 10)}.pdf`
  });
}



async function generatePDF(data) {
  try {
    const { jsPDF } = window.jspdf;

    const rowH = 7;
    const headH = 8;
    const sectionH = 12;
    const headerH = 30;

    let estH = headerH;
    estH += sectionH + 5 * rowH;
    estH += sectionH + (data.topProducts.length > 0 ? headH + data.topProducts.length * rowH : rowH);
    if (data.pengeluaranList.length > 0) estH += sectionH + headH + data.pengeluaranList.length * rowH;
    if (data.lowStock && data.lowStock.length > 0) estH += sectionH + headH + data.lowStock.length * rowH;
    estH += 20;

    const PAGE_H = 297;
    const scale = estH <= PAGE_H ? 1 : Math.max(0.45, PAGE_H / estH);
    const fontSize = s => Math.max(6, Math.round(s * scale));
    const pad = s => Math.max(1, s * scale);
    const sp = s => s * scale;

    const doc = new jsPDF({ format: [210, PAGE_H] });
    const PW = 210;
    const ML = sp(14);
    const MR = sp(14);
    let y = sp(12);

    doc.setFontSize(fontSize(18));
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(data.title, PW / 2, y, { align: 'center' });
    y += sp(7);

    doc.setFontSize(fontSize(8));
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(data.subtitle, PW / 2, y, { align: 'center' });
    y += sp(5);

    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.4);
    doc.line(ML, y, PW - MR, y);
    y += sp(8);

    const section = (label) => {
      doc.setFontSize(fontSize(11));
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text(label, ML, y);
      y += sp(6);
    };

    const tableOpts = (extra) => ({
      styles: { fontSize: fontSize(8.5), cellPadding: pad(2.5) },
      margin: { left: ML, right: MR },
      tableWidth: PW - ML - MR,
      ...extra
    });

    section('RINGKASAN');
    const ringkasanBody = [
      ['Total Transaksi', `${data.totalTransaksi} transaksi`],
      ['Total Cash', `Rp ${Utils.formatRupiah(data.totalCash)}`],
      ['Total Qris', `Rp ${Utils.formatRupiah(data.totalQRIS)}`],
      ['Subtotal Penjualan', `Rp ${Utils.formatRupiah(data.totalPenjualan + data.totalDiskon)}`],
      ['Total Diskon', `-Rp ${Utils.formatRupiah(data.totalDiskon)}`],
      ['Total Penjualan', `Rp ${Utils.formatRupiah(data.totalPenjualan)}`],
      ['HPP', `Rp ${Utils.formatRupiah(data.totalHPP)}`],
      ['Laba Kotor', `Rp ${Utils.formatRupiah(data.labaKotor)}`],
    ];
    if (data.totalPengeluaran > 0) {
      ringkasanBody.push(['Total Pengeluaran', `-Rp ${Utils.formatRupiah(data.totalPengeluaran)}`]);
      ringkasanBody.push(['Cash Bersih', `Rp ${Utils.formatRupiah(data.cashBersih)}`]);
    }

    doc.autoTable(tableOpts({
      startY: y,
      body: ringkasanBody,
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: (PW - ML - MR) * 0.45 },
        1: { halign: 'right' }
      },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      didParseCell(hookData) {
        if (data.totalPengeluaran > 0) {
          if (hookData.row.index === ringkasanBody.length - 2) hookData.cell.styles.textColor = [220, 38, 38];
          if (hookData.row.index === ringkasanBody.length - 1) {
            hookData.cell.styles.textColor = [5, 150, 105];
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      },
    }));
    y = doc.lastAutoTable.finalY + sp(10);

    section('PRODUK TERJUAL');
    if (data.topProducts.length > 0) {
      const cw = PW - ML - MR;
      doc.autoTable(tableOpts({
        startY: y,
        head: [['Nama Produk', 'Terjual', 'Omzet', 'HPP', 'Laba Kotor']],
        body: data.topProducts.map(([name, data]) => [name, `${data.qty} pcs`, `Rp ${Utils.formatRupiah(data.total)}`, `Rp ${Utils.formatRupiah(data.hpp)}`, `Rp ${Utils.formatRupiah(data.laba)}`]),
        headStyles: { fillColor: [30, 58, 138], fontStyle: 'bold', fontSize: fontSize(8.5) },
        columnStyles: {
          0: { cellWidth: cw * 0.40 },
          1: { halign: 'center', cellWidth: cw * 0.13 },
          2: { halign: 'right', cellWidth: cw * 0.17 },
          3: { halign: 'right', cellWidth: cw * 0.15 },
          4: { halign: 'right', cellWidth: cw * 0.15 }
        },
        theme: 'striped',
      }));
      y = doc.lastAutoTable.finalY + sp(10);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize(9));
      doc.setTextColor(120, 120, 120);
      doc.text('Belum ada data penjualan', ML + sp(4), y);
      y += sp(10);
    }

    if (data.pengeluaranList.length > 0) {
      section('PENGELUARAN');
      const cw = PW - ML - MR;
      doc.autoTable(tableOpts({
        startY: y,
        head: [['Nama Pengeluaran', 'Nominal']],
        body: data.pengeluaranList.map(p => [p.nama, `Rp ${Utils.formatRupiah(p.nominal)}`]),
        headStyles: { fillColor: [220, 38, 38], fontStyle: 'bold', fontSize: fontSize(8.5) },
        columnStyles: {
          0: { cellWidth: cw * 0.72 },
          1: { halign: 'right', cellWidth: cw * 0.28 }
        },
        theme: 'striped',
      }));
      y = doc.lastAutoTable.finalY + sp(10);
    }

    if (data.lowStock && data.lowStock.length > 0) {
      section('BAHAN STOK MENIPIS');
      const cw = PW - ML - MR;
      doc.autoTable(tableOpts({
        startY: y,
        head: [['Nama Bahan', 'Stok', 'Min. Stok', 'Satuan']],
        body: data.lowStock.map(b => [b.name, b.stock, b.minStock || 5, b.satuan || 'pcs']),
        headStyles: { fillColor: [217, 119, 6], fontStyle: 'bold', fontSize: fontSize(8.5) },
        columnStyles: {
          0: { cellWidth: cw * 0.46 },
          1: { halign: 'center', cellWidth: cw * 0.18 },
          2: { halign: 'center', cellWidth: cw * 0.18 },
          3: { halign: 'center', cellWidth: cw * 0.18 }
        },
        theme: 'striped',
      }));
    }

    doc.save(data.filename);
    Utils.showToast('PDF berhasil diekspor');
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

function updateImportExcelFileName(input) {
  const label = document.getElementById('importExcelFileName');
  if (!label) return;
  label.textContent = input?.files?.[0]?.name || 'Tidak ada file yang dipilih';
}

async function importFromExcel() {
  const file = document.getElementById('importExcelFile')?.files[0];
  if (!file) {
    Utils.showToast('Pilih file Excel', 'error');
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { cellDates: true });
    const menuSheet = wb.Sheets.Menu;
    const bahanSheet = wb.Sheets.Bahan;
    const kategoriSheet = wb.Sheets.Kategori;
    const menus = menuSheet ? XLSX.utils.sheet_to_json(menuSheet, { defval: '' }) : [];
    const bahans = bahanSheet ? XLSX.utils.sheet_to_json(bahanSheet, { defval: '' }) : [];
    const kategoriRows = kategoriSheet ? XLSX.utils.sheet_to_json(kategoriSheet, { defval: '' }) : [];

    if (!menuSheet && !bahanSheet) {
      Utils.showToast('Sheet Menu atau Bahan tidak ditemukan', 'error');
      return;
    }
    if (menus.some(m => !String(m['Nama Menu'] || '').trim())) {
      Utils.showToast('Ada menu tanpa Nama Menu', 'error');
      return;
    }
    if (bahans.some(b => !String(b['Nama Bahan'] || '').trim())) {
      Utils.showToast('Ada bahan tanpa Nama Bahan', 'error');
      return;
    }

    const confirm = await Utils.showConfirm('Import akan mengganti data menu & bahan. Kategori yang dipakai akan dibuat jika belum ada. Lanjutkan?');
    if (!confirm) return;

    const toBool = value => {
      const normalized = String(value ?? '').trim().toLowerCase();
      return ['true', '1', 'ya', 'yes', 'on'].includes(normalized);
    };
    const numberValue = (value, fallback = 0) => {
      const n = Number(String(value ?? '').replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : fallback;
    };

    const existingCategories = await dbCloud.collection('categories').get();
    const categoryMap = new Map();
    existingCategories.forEach(doc => categoryMap.set(String(doc.data().name || '').trim().toLowerCase(), doc.id));

    for (const row of kategoriRows) {
      const name = String(row['Nama Kategori'] || row['Kategori'] || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!categoryMap.has(key)) {
        const ref = await dbCloud.collection('categories').add({ name, system: false, createdAt: new Date() });
        categoryMap.set(key, ref.id);
      }
    }

    const menuCategoryNames = [...new Set(menus.map(m => String(m['Kategori'] || '').trim()).filter(Boolean))];
    for (const name of menuCategoryNames) {
      const key = name.toLowerCase();
      if (!categoryMap.has(key)) {
        const ref = await dbCloud.collection('categories').add({ name, system: false, createdAt: new Date() });
        categoryMap.set(key, ref.id);
      }
    }

    const deleteCollection = async name => {
      const snap = await dbCloud.collection(name).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = dbCloud.batch();
        snap.docs.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    };
    const addInBatches = async (name, rows) => {
      for (let i = 0; i < rows.length; i += 400) {
        const batch = dbCloud.batch();
        rows.slice(i, i + 400).forEach(row => batch.set(dbCloud.collection(name).doc(), row));
        await batch.commit();
      }
    };

    const menuDocs = menus.map(m => {
      const categoryName = String(m['Kategori'] || '').trim();
      const categoryId = categoryMap.get(categoryName.toLowerCase()) || null;
      const price = numberValue(m['Harga Jual'] ?? m['Harga']);
      return {
        name: String(m['Nama Menu']).trim(),
        price,
        salePrice: price,
        costPrice: numberValue(m['Harga Modal']),
        categoryId,
        useStock: toBool(m['Gunakan Stok']),
        stock: Math.max(0, numberValue(m['Stok'])),
        active: true,
        createdAt: new Date()
      };
    });

    const bahanDocs = bahans.map(b => ({
      name: String(b['Nama Bahan']).trim(),
      satuan: String(b['Satuan'] || 'pcs').trim() || 'pcs',
      stock: Math.max(0, numberValue(b['Stok Awal'])),
      minStock: Math.max(0, numberValue(b['Minimal Stok'], 5)),
      createdAt: new Date()
    }));

    if (menus.length) await deleteCollection('menus');
    if (bahans.length) await deleteCollection('raw_materials');
    if (menuDocs.length) await addInBatches('menus', menuDocs);
    if (bahanDocs.length) await addInBatches('raw_materials', bahanDocs);

    Utils.showToast(`Import berhasil: ${menuDocs.length} menu, ${bahanDocs.length} bahan`);
    setTimeout(() => location.reload(), 1200);
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error, 'Gagal mengimpor file. Periksa file lalu coba lagi.'), 'error');
  }
}

function downloadTemplateExcel() {
  try {
    const wb = XLSX.utils.book_new();
    const kategoriTemplate = [
      { 'Nama Kategori': 'Makanan' },
      { 'Nama Kategori': 'Minuman' }
    ];
    const menuTemplate = [
      { 'Nama Menu': 'Nasi Goreng', 'Harga Modal': 10000, 'Harga Jual': 15000, 'Kategori': 'Makanan', 'Gunakan Stok': 'TRUE', 'Stok': 50 },
      { 'Nama Menu': 'Es Teh', 'Harga Modal': 2500, 'Harga Jual': 5000, 'Kategori': 'Minuman', 'Gunakan Stok': 'FALSE', 'Stok': 0 }
    ];
    const bahanTemplate = [
      { 'Nama Bahan': 'Tepung', 'Satuan': 'kg', 'Stok Awal': 25, 'Minimal Stok': 5 },
      { 'Nama Bahan': 'Telur', 'Satuan': 'pcs', 'Stok Awal': 100, 'Minimal Stok': 20 }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kategoriTemplate), 'Kategori');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(menuTemplate), 'Menu');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bahanTemplate), 'Bahan');
    XLSX.writeFile(wb, 'template_import_inikasir.xlsx');
    Utils.showToast('Template didownload');
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function resetRiwayatOnly() {
  const result = await Swal.fire({
    title: 'Reset Riwayat?',
    html: `
      <div class="alert-content-wrapper">
        <p class="alert-title-label">Yang akan <b>dihapus</b>:</p>
        <ul class="alert-list text-danger">
          <li>Seluruh transaksi (semua shift)</li>
          <li>Seluruh sesi / shift</li>
          <li>Seluruh pengeluaran</li>
          <li>Seluruh open bill</li>
          <li>Riwayat mutasi stok</li>
        </ul>
        <p class="alert-title-label">Yang <b>tetap aman</b>:</p>
        <ul class="alert-list text-success">
          <li>Produk & kategori menu</li>
          <li>Bahan baku & stok</li>
          <li>List meja</li>
          <li>Modifier group</li>
          <li>Pengaturan & struk</li>
        </ul>
        <p class="alert-warning-text bold mt-sm">
          <i class="fas fa-exclamation-triangle"></i>
          Stok bahan TIDAK akan di-rollback (anggap sudah terpakai secara fisik)
        </p>
      </div>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#f59e0b',
    customClass: { popup: 'swal2-is-medium' }
  });
  if (!result.isConfirmed) return;

  const konfirmasi = await Utils.showPrompt("Ketik 'RESET' untuk konfirmasi");
  if (konfirmasi !== "RESET") {
    Utils.showToast("Reset dibatalkan", 'warning');
    return;
  }

  Utils.showToast("⏳ Menghapus riwayat...", 'warning');

  const _batchDelete = async (collName) => {
    const snap = await dbCloud.collection(collName).get();
    if (snap.empty) return;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = dbCloud.batch();
      snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
      await b.commit();
    }
  };

  try {
    await _batchDelete('transactions');
    await _batchDelete('sessions');
    await _batchDelete('stock_mutations');
    await _batchDelete('pengeluaran');
    await _batchDelete('openBills');

    state.transactions = [];
    state.allTransactions = [];
    state.sessions = [];
    state.allSessions = [];
    state.pengeluaran = [];
    state.openBills = [];
    state.stockMutations = [];
    state.currentSession = null;
    state.cart = [];
    state.selectedTable = null;
    state.cashAmount = 0;
    state.qrisAmount = 0;
    window._currentOpenBillId = null;
    localStorage.removeItem("activeSession");
    localStorage.removeItem("lastLowStockAlert");

    Utils.showToast("Riwayat berhasil direset!");
    setTimeout(() => renderKasir(), 1000);
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error, 'Gagal mereset data. Silakan coba lagi.'), 'error');
  }
}

async function resetData() {
  const result = await Swal.fire({
    title: 'Reset Total Database?',
    html: `
      <div class="alert-content-wrapper">
        <p class="alert-danger-text bold mb-sm">
          <i class="fas fa-skull-crossbones"></i> SEMUA data akan dihapus permanen!
        </p>
        <ul class="alert-list text-danger">
          <li>Transaksi & sesi</li>
          <li>Produk & kategori menu</li>
          <li>Bahan baku & stok</li>
          <li>Modifier group</li>
          <li>List meja</li>
          <li>Pengeluaran & open bill</li>
          <li>Riwayat mutasi stok</li>
          <li>Pengaturan toko & struk</li>
        </ul>
        <p class="alert-secondary-text mt-sm">Akun login tidak akan terhapus</p>
      </div>`,
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: 'Lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#dc3545',
    customClass: { popup: 'swal2-is-medium' }
  });
  if (!result.isConfirmed) return;

  const konfirmasi = await Utils.showPrompt("Ketik 'RESET TOTAL' untuk konfirmasi");
  if (konfirmasi !== "RESET TOTAL") {
    Utils.showToast("Reset dibatalkan", 'warning');
    return;
  }

  Utils.showToast("⏳ Menghapus SEMUA data...", 'warning');

  const _batchDelete = async (collName) => {
    const snap = await dbCloud.collection(collName).get();
    if (snap.empty) return;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = dbCloud.batch();
      snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
      await b.commit();
    }
  };

  try {
    await _batchDelete('transactions');
    await _batchDelete('sessions');
    await _batchDelete('menus');
    await _batchDelete('categories');
    await _batchDelete('raw_materials');
    await _batchDelete('stock_mutations');
    await _batchDelete('tables');
    await _batchDelete('settings');
    await _batchDelete('pengeluaran');
    await _batchDelete('openBills');
    await _batchDelete('modifierGroups');

    state.transactions = [];
    state.allTransactions = [];
    state.sessions = [];
    state.allSessions = [];
    state.menus = [];
    state.categories = [];
    state.rawMaterials = [];
    state.stockMutations = [];
    state.tables = [];
    state.settings = null;
    state.pengeluaran = [];
    state.openBills = [];
    state.modifierGroups = [];
    state.currentSession = null;
    state.cart = [];
    state.selectedTable = null;
    window._currentOpenBillId = null;
    localStorage.clear();

    Utils.showToast("DATABASE berhasil direset!");
    setTimeout(() => window.location.reload(), 2000);
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error, 'Gagal mereset database. Silakan coba lagi.'), 'error');
  }
}

function sortMeja(field) {
  _saveSettingsScroll();
  SortableTable.toggle('meja', field);
  renderSettings();
}

function sortKasir(field) {
  _saveSettingsScroll();
  SortableTable.toggle('kasir', field);
  renderSettings();
}

async function editKasir(index) {
  const kasirs = state.settings?.kasirs || [];
  const kData = kasirs[index];
  if (!kData) return;

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');

  const result = await Utils.showModal({
    title: 'Edit Kasir',
    customClass: 'swal2-is-settings-compact',
    content: `
      <div class="form-group settings-modal-single-field">
        <label class="form-label">Nama Kasir</label>
        <input id="editKasirNama" class="form-input" type="text" value="${esc(kData.nama || '')}" autocomplete="off">
      </div>`,
    buttons: [
      { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
      { text: 'Simpan', action: 'save', class: 'btn-primary', onClick: () => {
        window._editKasirNama = document.getElementById('editKasirNama')?.value || '';
      }}
    ]
  });

  if (result !== 'save') return;
  const newName = String(window._editKasirNama || '').trim();
  delete window._editKasirNama;
  if (!newName || newName === kData.nama) return;

  if (kasirs.find((k, i) => i !== index && String(k.nama || '').toLowerCase() === newName.toLowerCase())) {
    Utils.showToast("Nama kasir tersebut sudah ada!", 'warning');
    return;
  }

  const newArr = [...kasirs];
  newArr[index] = { ...newArr[index], nama: newName };
  _saveSettingsScroll();
  await saveKasirSettings(newArr);
  Utils.showToast("Nama kasir diperbarui");
}

async function editMeja(id) {
  const meja = state.tables.find(m => m.id === id);
  if (!meja) return;

  const result = await Utils.showModal({
    title: 'Edit Meja',
    customClass: 'swal2-is-settings-compact',
    content: `
          <div class="form-group">
            <label class="form-label">Nomor Meja</label>
            <input type="text" id="editMejaNomor" class="form-input" value="${meja.nomor}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama/Keterangan</label>
            <input type="text" id="editMejaNama" class="form-input" value="${meja.nama}">
          </div>
        `,
    buttons: [
      { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
      {
        text: 'Simpan', action: 'save', class: 'btn-primary', onClick: () => {
          window._eM_nomor = document.getElementById('editMejaNomor').value;
          window._eM_nama = document.getElementById('editMejaNama').value;
        }
      }
    ]
  });

  if (result === 'save') {
    const nr = window._eM_nomor;
    const nm = window._eM_nama;
    delete window._eM_nomor;
    delete window._eM_nama;
    if (!nr && !nm) return;

    _saveSettingsScroll();
    try {
      await dbCloud.collection("tables").doc(id).update({
        nomor: nr || meja.nomor,
        nama: nm || meja.nama
      });
      const stItem = state.tables.find(m => m.id === id);
      if (stItem) { stItem.nomor = nr || meja.nomor; stItem.nama = nm || meja.nama; }
      Utils.showToast("Meja berhasil diupdate");
      renderSettings();
    } catch (e) {
      Utils.showToast(Utils.getFriendlyError(e, 'Gagal memperbarui meja. Silakan coba lagi.'), 'error');
    }
  }
}

async function saveKasirSettings(kasirs) {
  try {
    await dbCloud.collection("settings").doc("toko").update({ kasirs });
    state.settings.kasirs = kasirs;
    renderSettings();
  } catch (e) {
    Utils.showToast(Utils.getFriendlyError(e, 'Gagal menyimpan kasir. Silakan coba lagi.'), 'error');
  }
}

async function tambahKasir() {
  const nama = document.getElementById('newKasirNama').value.trim();
  if (!nama) return;
  const currentKasirs = state.settings?.kasirs || [];
  if (currentKasirs.find(k => k.nama.toLowerCase() === nama.toLowerCase())) {
    Utils.showToast("Nama kasir sudah ada!", 'warning');
    return;
  }
  const kasirs = [...currentKasirs, { nama, aktif: true }];
  await saveKasirSettings(kasirs);
  Utils.showToast("Kasir ditambah");
}

async function toggleKasirStatus(index) {
  const kasirs = [...(state.settings?.kasirs || [])];
  if (kasirs[index]) {
    kasirs[index].aktif = kasirs[index].aktif === false ? true : false;
    await saveKasirSettings(kasirs);
  }
}

async function hapusKasir(index) {
  const ok = await Utils.showConfirm("Hapus kasir ini?");
  if (ok) {
    const kasirs = [...(state.settings?.kasirs || [])];
    kasirs.splice(index, 1);
    await saveKasirSettings(kasirs);
    Utils.showToast("Kasir dihapus");
  }
}

window.renderSettings = renderSettings;
window.switchSettingsTab = switchSettingsTab;
window.saveTokoSettings = saveTokoSettings;
window.saveStrukSettings = saveStrukSettings;
window.saveFiturSettings = saveFiturSettings;
window.tambahTemplateDiskon = tambahTemplateDiskon;
window.toggleTemplateDiskon = toggleTemplateDiskon;
window.editTemplateDiskon = editTemplateDiskon;
window.hapusTemplateDiskon = hapusTemplateDiskon;
window.saveMejaSettings = saveMejaSettings;
window.tambahMeja = tambahMeja;
window.toggleMejaStatus = toggleMejaStatus;
window.hapusMeja = hapusMeja;
window.sortMeja = sortMeja;
window.editMeja = editMeja;
window.tambahKasir = tambahKasir;
window.toggleKasirStatus = toggleKasirStatus;
window.hapusKasir = hapusKasir;
window.sortKasir = sortKasir;
window.editKasir = editKasir;
window.exportToPDFShift = exportToPDFShift;
window.updateImportExcelFileName = updateImportExcelFileName;
window.importFromExcel = importFromExcel;
window.downloadTemplateExcel = downloadTemplateExcel;
window.resetRiwayatOnly = resetRiwayatOnly;
window.resetData = resetData;