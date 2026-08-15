function bukaModalPengeluaran() {
  if (!state.currentSession) {
    Utils.showToast('Buka shift dulu untuk mencatat pengeluaran', 'warning');
    return;
  }
  if (document.getElementById('modal-pengeluaran')) return;

  const sesiId = state.currentSession.id;
  const list = (state.pengeluaran?.filter(p => p.sessionId === sesiId) || [])
    .sort((a, b) => {
      const da = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime();
      const db = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime();
      return db - da;
    });
  const total = list.reduce((s, p) => s + (p.nominal || 0), 0);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'modal-pengeluaran';
  modal.innerHTML = `
      <div class="modal pengeluaran-modal">
        <div class="pengeluaran-modal-header">
          <h3>
            <i class="fas fa-money-bill-wave icon-danger"></i>
            Pengeluaran
          </h3>
          <button class="btn-icon-sm" onclick="tutupModalPengeluaran()" title="Tutup">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="pengeluaran-input-row">
          <input type="text" id="inputNamaPengeluaran" class="form-input pengeluaran-input-nama"
                 placeholder="Nama pengeluaran..."
                 onkeydown="if(event.key==='Enter')document.getElementById('inputNominalPengeluaran').focus()">
          <input type="number" id="inputNominalPengeluaran" class="form-input pengeluaran-input-nominal"
                 placeholder="Harga..."
                 onkeydown="if(event.key==='Enter'){const b=document.getElementById('btnTambahPengeluaran');Utils.setButtonLoading(b,true);tambahPengeluaran().finally(()=>Utils.setButtonLoading(b,false))}">
          <button id="btnTambahPengeluaran" class="btn btn-primary"
                  onclick="const b=this;Utils.setButtonLoading(b,true);tambahPengeluaran().finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-plus"></i> Tambah
          </button>
        </div>

        <div id="list-pengeluaran" class="pengeluaran-list">
          ${renderListPengeluaran(list)}
        </div>

        <div class="pengeluaran-total-row ${list.length > 0 ? '' : 'hidden-badge'}">
          <span>Total Pengeluaran</span>
          <span class="pengeluaran-total-nominal">Rp ${Utils.formatRupiah(total)}</span>
        </div>
      </div>
    `;

  modal.addEventListener('click', e => {
    if (e.target === modal) tutupModalPengeluaran();
  });

  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('inputNamaPengeluaran')?.focus(), 100);
}

function renderListPengeluaran(list) {
  if (!list || list.length === 0) {
    return '<p class="text-muted pengeluaran-empty">Belum ada pengeluaran</p>';
  }
  return list.map(p => `
      <div class="recap-item recap-pengeluaran-item" data-id="${p.id}">
        <div class="recap-pengeluaran-item-left">
          <div class="recap-name recap-pengeluaran-name">${p.nama}</div>
          <div class="recap-pengeluaran-meta">
            Rp ${Utils.formatRupiah(p.nominal)}
          </div>
        </div>
        <div class="recap-pengeluaran-actions">
          <button class="btn-icon-sm"
                  onclick="mulaiEditPengeluaran('${p.id}','${p.nama.replace(/'/g, "\\'").replace(/"/g, '&quot;')}',${p.nominal})"
                  title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon-sm btn-icon-danger"
                  onclick="const b=this;Utils.setButtonLoading(b,true);hapusPengeluaran('${p.id}').finally(()=>Utils.setButtonLoading(b,false))"
                  title="Hapus">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
}

function refreshListPengeluaran() {
  const listEl = document.getElementById('list-pengeluaran');
  let lastScroll = 0;
  if (listEl) lastScroll = listEl.scrollTop;

  const sesiId = state.currentSession?.id;
  const list = (state.pengeluaran?.filter(p => p.sessionId === sesiId) || [])
    .sort((a, b) => {
      const da = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime();
      const db = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime();
      return db - da;
    });
  const total = list.reduce((s, p) => s + (p.nominal || 0), 0);

  if (listEl) {
    listEl.innerHTML = renderListPengeluaran(list);
    listEl.scrollTop = lastScroll;
  }

  const totalRow = document.querySelector('.pengeluaran-total-row');
  if (totalRow) {
    totalRow.classList.toggle('hidden-badge', list.length === 0);
    const span = totalRow.querySelector('span:last-child');
    if (span) span.textContent = 'Rp ' + Utils.formatRupiah(total);
  }

  const badge = document.getElementById('badge-pengeluaran');
  if (badge) {
    badge.textContent = list.length;
    badge.classList.toggle('hidden-badge', list.length === 0);
  }
}

function tutupModalPengeluaran() {
  const modal = document.getElementById('modal-pengeluaran');
  if (modal) {
    modal.classList.add('fade-out');
    setTimeout(() => modal.remove(), 200);
  }
}

async function tambahPengeluaran() {
  if (!state.currentSession) return;
  const nama = document.getElementById('inputNamaPengeluaran')?.value?.trim();
  const nominalRaw = document.getElementById('inputNominalPengeluaran')?.value;
  const nominal = parseFloat(nominalRaw);

  if (!nama) { Utils.showToast('Nama pengeluaran harus diisi', 'warning'); return; }
  if (!nominalRaw || isNaN(nominal) || nominal <= 0) {
    Utils.showToast('Nominal harus lebih dari 0', 'warning'); return;
  }
  try {
    await dbCloud.collection('pengeluaran').add({
      nama, nominal,
      sessionId: state.currentSession.id,
      kasir: state.user?.email || 'unknown',
      createdAt: new Date()
    });
    document.getElementById('inputNamaPengeluaran').value = '';
    document.getElementById('inputNominalPengeluaran').value = '';
    document.getElementById('inputNamaPengeluaran')?.focus();
    Utils.showToast('Pengeluaran ditambahkan', 'success');
  } catch (error) {
    Utils.showToast('Gagal: ' + error.message, 'error');
  }
}

function mulaiEditPengeluaran(id, namaLama, nominalLama) {
  const listEl = document.getElementById('list-pengeluaran');
  if (!listEl) return;
  const item = listEl.querySelector(`[data-id="${id}"]`);
  if (!item) return;

  item.innerHTML = `
      <div class="pengeluaran-edit-row">
        <input type="text" id="editNama_${id}" class="form-input pengeluaran-edit-input-nama" value="${namaLama}">
        <input type="number" id="editNominal_${id}" class="form-input pengeluaran-edit-input-nominal" value="${nominalLama}"
               onkeydown="if(event.key==='Enter'){const b=this.nextElementSibling;Utils.setButtonLoading(b,true);simpanEditPengeluaran('${id}').finally(()=>Utils.setButtonLoading(b,false))}">
        <button class="btn btn-primary pengeluaran-edit-btn-save"
                onclick="const b=this;Utils.setButtonLoading(b,true);simpanEditPengeluaran('${id}').finally(()=>Utils.setButtonLoading(b,false))">
          <i class="fas fa-check"></i>
        </button>
        <button class="btn-icon-sm pengeluaran-edit-btn-cancel" onclick="refreshListPengeluaran()" title="Batal">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  setTimeout(() => document.getElementById(`editNama_${id}`)?.focus(), 50);
}

async function simpanEditPengeluaran(id) {
  const nama = document.getElementById(`editNama_${id}`)?.value?.trim();
  const nominalRaw = document.getElementById(`editNominal_${id}`)?.value;
  const nominal = parseFloat(nominalRaw);

  if (!nama) { Utils.showToast('Nama harus diisi', 'warning'); return; }
  if (!nominalRaw || isNaN(nominal) || nominal <= 0) {
    Utils.showToast('Nominal harus lebih dari 0', 'warning'); return;
  }
  try {
    await dbCloud.collection('pengeluaran').doc(id).update({ nama, nominal });
    Utils.showToast('Pengeluaran diperbarui', 'success');
  } catch (error) {
    Utils.showToast('Gagal: ' + error.message, 'error');
  }
}

async function hapusPengeluaran(id) {
  if (!await Utils.showConfirm('Hapus pengeluaran ini?')) return;
  try {
    await dbCloud.collection('pengeluaran').doc(id).delete();
    Utils.showToast('Pengeluaran dihapus', 'success');
  } catch (error) {
    Utils.showToast('Gagal: ' + error.message, 'error');
  }
}

window.bukaModalPengeluaran = bukaModalPengeluaran;
window.tutupModalPengeluaran = tutupModalPengeluaran;
window.tambahPengeluaran = tambahPengeluaran;
window.mulaiEditPengeluaran = mulaiEditPengeluaran;
window.simpanEditPengeluaran = simpanEditPengeluaran;
window.hapusPengeluaran = hapusPengeluaran;
window.refreshListPengeluaran = refreshListPengeluaran;