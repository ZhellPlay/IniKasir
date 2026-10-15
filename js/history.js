let lastHistoryScrollPosition = 0;

function renderHistory() {
  if (!state.currentSession) {
    renderNoSession();
    return;
  }

  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }

  state.currentView = "history";
  const totalIncome = state.transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const totalSubtotal = state.transactions.reduce((sum, t) => sum + (Number(t.subtotal ?? t.total ?? 0) || 0), 0);
  const totalTransaksi = state.transactions.length;
  const totalCASH = state.transactions.reduce((sum, t) => {
    const qris = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
    return sum + (t.metodeBayar === 'tunai' ? (t.total || 0) : Math.max(0, (t.total || 0) - qris));
  }, 0);
  const totalQRIS = state.transactions.reduce((sum, t) => {
    const qrisAmt = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
    return sum + qrisAmt;
  }, 0);
  const totalHPP = state.transactions.reduce((sum, t) => sum + (t.items || []).reduce((s, i) => s + Utils.calculateItemHpp(i), 0), 0);
  const totalDiskon = state.transactions.reduce((sum, t) => sum + (Number(t.discountAmount) || 0), 0);
  const labaKotor = totalIncome - totalHPP;
  const totalPengeluaran = (state.pengeluaran || [])
    .filter(p => p.sessionId === state.currentSession.id)
    .reduce((sum, p) => sum + (Number(p.nominal) || 0), 0);
  const modalAwal = Number(state.currentSession.modalAwal || 0);
  const cashBersih = modalAwal + totalCASH - totalPengeluaran;
  const recap = {};
  state.transactions.forEach(t => t.items.forEach(i => {
    if (!recap[i.name]) recap[i.name] = { qty: 0, total: 0, hpp: 0 };
    const gross = (i.price + (i.modifierTotal || 0)) * i.qty;
    const net = i.netSubtotal ?? Math.max(0, gross - (i.discountAmount || 0));
    recap[i.name].qty += i.qty;
    recap[i.name].total += net;
    recap[i.name].hpp += Utils.calculateItemHpp(i);
  }));
  const sortedTransactions = SortableTable.sort(state.transactions, 'transactions');
  const content = `
    <div class="stack-y">
      <div class="session-header">
        <div class="session-header-row">
          <span class="session-badge session-badge-primary">SHIFT ${state.currentSession.shift}</span>
        </div>
        <span>Buka: ${(() => { const wb = state.currentSession.waktuBuka; const d = wb?.seconds ? new Date(wb.seconds * 1000) : wb?.toDate ? wb.toDate() : new Date(wb); return isNaN(d) ? "-" : d.toLocaleString("id-ID"); })()}</span>
      </div>
      <div class="stats-grid history-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Penjualan Kotor</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(totalSubtotal)}</div>
        </div>
        <div class="stat-card history-stat-negative">
          <div class="stat-label">Diskon</div>
          <div class="stat-value">-Rp ${Utils.formatRupiah(totalDiskon)}</div>
        </div>
        <div class="stat-card history-stat-result">
          <div class="stat-label">Penjualan Bersih</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(totalIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Transaksi</div>
          <div class="stat-value">${totalTransaksi}</div>
        </div>
        <div class="stat-card cash">
          <div class="stat-label">CASH</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(totalCASH)}</div>
        </div>
        <div class="stat-card qris">
          <div class="stat-label">QRIS</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(totalQRIS)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">HPP</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(totalHPP)}</div>
        </div>
        <div class="stat-card history-stat-result">
          <div class="stat-label">Laba Kotor</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(labaKotor)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Modal Awal</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(modalAwal)}</div>
        </div>
        <div class="stat-card history-stat-negative">
          <div class="stat-label">Pengeluaran</div>
          <div class="stat-value">-Rp ${Utils.formatRupiah(totalPengeluaran)}</div>
        </div>
        <div class="stat-card history-stat-result history-stat-cash-net">
          <div class="stat-label">Cash Bersih</div>
          <div class="stat-value">Rp ${Utils.formatRupiah(cashBersih)}</div>
          <div class="stat-note">Modal Awal + CASH − Pengeluaran</div>
        </div>
      </div>
      <div class="recap-section">
        <h3><i class="fas fa-chart-bar"></i> Rekap Produk</h3>
        <div class="recap-scroll-container">
          <div class="recap-grid scrollable">
            ${Object.keys(recap).length === 0 ?
      '<p class="text-muted">Belum ada data</p>' :
      Object.keys(recap).sort().map(name => `
                <div class="recap-item">
                  <div class="recap-name">${Utils.escapeHtml(name)}</div>
                  <div class="recap-detail">
                    <span>${recap[name].qty} pcs</span>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
      <div class="action-buttons">
        <button class="btn btn-secondary" onclick="toggleSelectAll()">
          ${state.selectedHistory.size === state.transactions.length ? 'Batal Pilih' : 'Pilih Semua'}
        </button>
        <button class="btn btn-secondary ${state.selectedHistory.size > 0 ? 'btn-danger' : ''}"
                onclick="const b=this;Utils.setButtonLoading(b,true);deleteSelected().finally(()=>Utils.setButtonLoading(b,false))" ${state.selectedHistory.size === 0 ? 'disabled' : ''}>
          <i class="fas fa-trash"></i> Hapus ${state.selectedHistory.size > 0 ? `(${state.selectedHistory.size})` : ''}
        </button>
        <button class="btn btn-warning" onclick="const b=this;Utils.setButtonLoading(b,true);cetakRekapSesi().finally(()=>Utils.setButtonLoading(b,false))">
          <i class="fas fa-print"></i> Cetak
        </button>
      </div>
      <h3><i class="fas fa-history"></i> Riwayat Transaksi</h3>
      ${state.transactions.length === 0 ?
      '<p class="text-center text-muted">Belum ada transaksi</p>' :
      `<table class="table-full">
        <thead class="neu-table-head">
          <tr>
            <th class="td-base text-left cursor-pointer" onclick="sortTransactions('date')">
              Waktu <i class="fas ${SortableTable.getSortIcon('transactions', 'date')}"></i>
            </th>
            <th class="td-base text-left cursor-pointer" onclick="sortTransactions('mejaNama')">
              Meja <i class="fas ${SortableTable.getSortIcon('transactions', 'mejaNama')}"></i>
            </th>
            <th class="td-base text-left cursor-pointer" onclick="sortTransactions('total')">
              Total <i class="fas ${SortableTable.getSortIcon('transactions', 'total')}"></i>
            </th>
            <th class="td-base text-left">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${sortedTransactions.map(t => {
        const tgl = new Date(t.date.seconds ? t.date.seconds * 1000 : t.date);
        return `
              <tr class="neu-table-row">
                <td class="td-base" data-label="Waktu">
                  <input type="checkbox" ${state.selectedHistory.has(t.id) ? 'checked' : ''}
                         onchange="toggleSelect('${t.id}')" onclick="event.stopPropagation()">
                  <span class="ml-2">${tgl.toLocaleTimeString('id-ID')}</span>
                </td>
                <td class="td-base" data-label="Meja">${Utils.escapeHtml(getTransactionMejaLabel(t))}</td>
                <td class="td-base fw-bold text-primary" data-label="Total">Rp ${Utils.formatRupiah(t.total)}</td>
                <td class="td-base table-nowrap table-actions" data-label="Aksi">
                  <button class="btn btn-icon-sm" onclick="showDetailModal('${t.id}'); event.stopPropagation()" title="Detail">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn btn-icon-sm text-warning" onclick="showEditPaymentModal('${t.id}'); event.stopPropagation()" title="Edit Pembayaran">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-icon-sm" onclick="const b=this;Utils.setButtonLoading(b,true);reprintReceipt('${t.id}').finally(()=>Utils.setButtonLoading(b,false));event.stopPropagation()" title="Cetak">
                    <i class="fas fa-print"></i>
                  </button>
                </td>
              </tr>
            `;
      }).join('')}
        </tbody>
      </table>`}
    </div>
  `;
  app.innerHTML = Layout.renderMain(content);
  Layout._restoreSidebarScroll();
  requestAnimationFrame(() => {
    const newMainContent = document.querySelector('main');
    if (newMainContent && lastHistoryScrollPosition > 0) {
      newMainContent.scrollTop = lastHistoryScrollPosition;
    }
  });
}

function getHistorySessionForTransaction(trx) {
  if (!trx) return null;
  if (state.currentSession?.id === trx.sessionId) return state.currentSession;
  return (state.allSessions || []).find(s => s.id === trx.sessionId) || null;
}

function getTransactionKasirName(trx) {
  const session = getHistorySessionForTransaction(trx);
  return trx.kasirNama || session?.kasir || trx.kasirAkun || trx.kasir || '-';
}

function getTransactionMejaLabel(trx) {
  if (!trx?.mejaNama && !trx?.mejaNomor) return 'Take Away';
  if (trx.mejaNomor && trx.mejaNama) return `Meja ${trx.mejaNomor} - ${trx.mejaNama}`;
  if (trx.mejaNomor) return `Meja ${trx.mejaNomor}`;
  return `Meja - ${trx.mejaNama}`;
}

function showDetailModal(trxId) {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }

  const trx = state.transactions.find(t => t.id === trxId);
  if (!trx) return;
  const tgl = new Date(trx.date.seconds ? trx.date.seconds * 1000 : trx.date);

  const itemsHTML = trx.items.map((item, index) => {
    const unitPrice = item.price + (item.modifierTotal || 0);
    const subtotal = item.subtotal || (unitPrice * item.qty);
    const modHTML = (item.modifiers || []).length > 0
      ? `<div class="history-item-modifiers">${item.modifiers.map(m =>
        `<span class="cart-modifier-tag">${Utils.escapeHtml(m.optionName)}${m.price > 0 ? ` +${Utils.formatRupiah(m.price)}` : ''}</span>`
      ).join('')}</div>`
      : '';
    const notesHTML = item.notes
      ? `<div class="history-item-notes"><i class="fas fa-sticky-note"></i> ${Utils.escapeHtml(item.notes)}</div>`
      : '';
    return `
    <tr>
      <td>${index + 1}</td>
      <td>${Utils.escapeHtml(item.name)}${modHTML}${notesHTML}</td>
      <td class="text-center">${item.qty}</td>
      <td class="text-right">Rp ${Utils.formatRupiah(unitPrice)}</td>
      <td class="text-right td-bold">Rp ${Utils.formatRupiah(subtotal)}</td>
    </tr>
  `;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal modal-lg modal-detail-trx">
      <h3><i class="fas fa-receipt"></i> Detail Transaksi</h3>

      <div class="trx-info-box">
        <div class="trx-info-grid">
          <div>
            <div class="trx-info-label">Tanggal</div>
            <div class="trx-info-value">${tgl.toLocaleDateString('id-ID')}</div>
          </div>
          <div>
            <div class="trx-info-label">Waktu</div>
            <div class="trx-info-value">${tgl.toLocaleTimeString('id-ID')}</div>
          </div>
          <div>
            <div class="trx-info-label">Kasir</div>
            <div class="trx-info-value">${Utils.escapeHtml(getTransactionKasirName(trx))}</div>
          </div>
          <div>
            <div class="trx-info-label">Meja</div>
            <div class="trx-info-value">${Utils.escapeHtml(getTransactionMejaLabel(trx))}</div>
          </div>
        </div>
      </div>

      <h4 class="section-title-sm">Daftar Pesanan</h4>
      <table class="detail-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Menu</th>
            <th class="text-center">Qty</th>
            <th class="text-right">Harga</th>
            <th class="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right">Subtotal</td>
            <td class="text-right">Rp ${Utils.formatRupiah(trx.subtotal ?? trx.total)}</td>
          </tr>
          ${(trx.discountAmount || 0) > 0 ? `<tr><td colspan="4" class="text-right text-danger">Diskon ${trx.discountType === 'percent' ? `(${trx.discountValue}%)` : ''}</td><td class="text-right text-danger">-Rp ${Utils.formatRupiah(trx.discountAmount)}</td></tr>` : ''}
          <tr class="tfoot-total">
            <td colspan="4" class="text-right td-bold">Total</td>
            <td class="text-right td-total-value">Rp ${Utils.formatRupiah(trx.total)}</td>
          </tr>
          <tr>
            <td colspan="4" class="text-right">Bayar</td>
            <td class="text-right">Rp ${Utils.formatRupiah(trx.paid)}</td>
          </tr>
          <tr>
            <td colspan="4" class="text-right">Kembalian</td>
            <td class="text-right ${trx.change >= 0 ? 'text-success' : 'text-danger'}">Rp ${Utils.formatRupiah(trx.change)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="payment-info-box">
        <div class="payment-info-row">
          <span>Metode Pembayaran:</span>
          <span class="method-badge">
            ${trx.metodeBayar === 'tunai' ? 'CASH' : trx.metodeBayar === 'qris' ? 'QRIS' : 'CASH + QRIS'}
          </span>
        </div>
        ${trx.metodeBayar === 'mixed' ? `
          <div class="payment-info-mixed">
            <span>CASH: Rp ${Utils.formatRupiah(trx.cashAmount || 0)}</span>
            <span>QRIS: Rp ${Utils.formatRupiah(trx.qrisAmount || 0)}</span>
          </div>
        ` : ''}
      </div>

      <div class="modal-footer-actions">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Tutup</button>
        <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);reprintReceipt('${trx.id}').finally(()=>{Utils.setButtonLoading(b,false);const mo=b.closest('.modal-overlay');if(mo)mo.remove()})">
          <i class="fas fa-print"></i> Cetak Ulang
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function sortTransactions(field) {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }
  SortableTable.toggle('transactions', field);
  renderHistory();
}

function toggleSelect(id) {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }
  if (state.selectedHistory.has(id)) state.selectedHistory.delete(id);
  else state.selectedHistory.add(id);
  renderHistory();
}

function toggleSelectAll() {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }
  if (state.selectedHistory.size === state.transactions.length) state.selectedHistory.clear();
  else state.transactions.forEach(t => state.selectedHistory.add(t.id));
  renderHistory();
}

async function deleteSelected() {
  if (state.selectedHistory.size === 0) return;

  const activeSessionId = state.currentSession?.id;
  if (!activeSessionId) {
    Utils.showToast('Tidak ada shift aktif. Transaksi tidak dapat dihapus.', 'warning');
    return;
  }

  const allSelected = [...state.selectedHistory]
    .map(id => state.transactions.find(t => t.id === id))
    .filter(Boolean);

  const fromOtherShift = allSelected.filter(t => t.sessionId !== activeSessionId);
  const fromActiveShift = allSelected.filter(t => t.sessionId === activeSessionId);

  if (fromOtherShift.length > 0 && fromActiveShift.length === 0) {
    Utils.showToast('Transaksi dari shift yang sudah selesai tidak dapat dihapus.', 'warning');
    return;
  }

  if (fromOtherShift.length > 0) {
    const ok = await Swal.fire({
      title: 'Perhatian',
      html: `${fromOtherShift.length} transaksi dari shift lama tidak dapat dihapus.<br>
        Hanya <b>${fromActiveShift.length} transaksi</b> dari shift aktif yang akan dihapus & di-rollback.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Semua',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc3545',
      customClass: { popup: 'swal2-is-konfirmasi' }
    });
    if (!ok.isConfirmed) return;
  } else {
    if (!await Utils.showConfirm(
      `Hapus ${fromActiveShift.length} transaksi?\nStok bahan & produk akan dikembalikan.`
    )) return;
  }

  const mainContent = document.querySelector('main');
  if (mainContent) lastHistoryScrollPosition = mainContent.scrollTop;

  try {
    const estimatedWrites = fromActiveShift.reduce((total, trx) => {
      let writes = 2;
      for (const item of trx.items || []) {
        writes += (item.recipeSnapshot || []).length;
        for (const mod of item.modifiers || []) writes += (mod.resep || []).length;
        if (item.useStock === true) writes += 1;
      }
      return total + writes;
    }, 0);
    if (estimatedWrites > 400) {
      Utils.showToast('Terlalu banyak transaksi untuk satu penghapusan. Pilih lebih sedikit transaksi.', 'warning');
      return;
    }

    const stockAdds = new Map();
    const productAdds = new Map();
    for (const trx of fromActiveShift) {
      for (const item of trx.items || []) {
        const produk = state.menus.find(m => m.id === item.id);
        const usesProductStock = Object.prototype.hasOwnProperty.call(item, 'useStock')
          ? item.useStock === true
          : produk?.useStock === true;
        if (usesProductStock) productAdds.set(item.id, (productAdds.get(item.id) || 0) + Number(item.qty || 0));
        const recipe = usesProductStock ? [] : (item.recipeSnapshot || produk?.resep || []);
        for (const bahan of recipe) {
          const qty = Number(bahan.qty || 0) * Number(item.qty || 0);
          stockAdds.set(bahan.bahanId, (stockAdds.get(bahan.bahanId) || 0) + qty);
        }
        for (const mod of item.modifiers || []) {
          for (const bahan of mod.resep || []) {
            const qty = Number(bahan.qty || 0) * Number(item.qty || 0);
            stockAdds.set(bahan.bahanId, (stockAdds.get(bahan.bahanId) || 0) + qty);
          }
        }
      }
    }

    const sessionRef = dbCloud.collection('sessions').doc(activeSessionId);
    const batch = dbCloud.batch();
    for (const [id, qty] of stockAdds) batch.update(dbCloud.collection('raw_materials').doc(id), { stock: firebase.firestore.FieldValue.increment(qty) });
    for (const [id, qty] of productAdds) batch.update(dbCloud.collection('menus').doc(id), { stock: firebase.firestore.FieldValue.increment(qty) });
    const removedSales = fromActiveShift.reduce((sum, trx) => sum + Number(trx.total || 0), 0);

    for (const trx of fromActiveShift) {
      for (const item of trx.items || []) {
        for (const bahan of item.recipeSnapshot || []) {
          batch.set(dbCloud.collection('stock_mutations').doc(), { type: 'in', source: 'sale_reversal', bahanId: bahan.bahanId, namaBahan: bahan.nama || bahan.namaBahan || bahan.name || '', qty: Number(bahan.qty || 0) * Number(item.qty || 0), satuan: bahan.satuan || 'pcs', produkId: item.id, namaProduk: item.name, transactionId: trx.id, sessionId: trx.sessionId || null, userId: state.user.email, createdAt: new Date() });
        }
        for (const mod of item.modifiers || []) {
          for (const bahan of mod.resep || []) {
            batch.set(dbCloud.collection('stock_mutations').doc(), { type: 'in', source: 'sale_reversal', bahanId: bahan.bahanId, namaBahan: bahan.namaBahan || bahan.nama || bahan.name || '', qty: Number(bahan.qty || 0) * Number(item.qty || 0), satuan: bahan.satuan || 'pcs', produkId: item.id, namaProduk: item.name, modifierId: mod.optionId, namaModifier: mod.optionName, transactionId: trx.id, sessionId: trx.sessionId || null, userId: state.user.email, createdAt: new Date() });
          }
        }
      }
      batch.delete(dbCloud.collection('transactions').doc(trx.id));
    }
    batch.update(sessionRef, {
      totalPenjualan: firebase.firestore.FieldValue.increment(-removedSales),
      jumlahTransaksi: firebase.firestore.FieldValue.increment(-fromActiveShift.length),
      updatedAt: new Date()
    });
    await batch.commit();

    state.selectedHistory.clear();
    Utils.showToast(`${fromActiveShift.length} transaksi dihapus & stok dikembalikan`, 'success');
    renderHistory();
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error), 'error');
  }
}

async function reprintReceipt(trxId) {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }
  try {
    const trx = state.transactions.find(t => t.id === trxId);
    if (!trx) return;
    if (typeof window.printStruk === 'function') await window.printStruk(trx);
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error, 'Gagal mencetak ulang transaksi. Silakan coba lagi.'), 'error');
  }
}

async function cetakRekapSesi() {
  const mainContent = document.querySelector('main');
  if (mainContent) {
    lastHistoryScrollPosition = mainContent.scrollTop;
  }
  try {
    if (typeof window.printRekapSesi === 'function') {
      await window.printRekapSesi(state.currentSession, state.transactions);
    }
  } catch (error) {
    Utils.showToast(Utils.getFriendlyError(error, 'Gagal mencetak rekap. Periksa koneksi printer lalu coba lagi.'), 'error');
  }
}

function showEditPaymentModal(trxId) {
  const trx = state.transactions.find(t => t.id === trxId);
  if (!trx) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  let methodHtml = `
      <div class="payment-grid">
        <button class="payment-option ${trx.metodeBayar === 'tunai' ? 'active' : ''}" onclick="selectEditMethod(this, 'tunai')">
          <i class="fas fa-money-bill-wave"></i> <span>CASH</span>
        </button>
        <button class="payment-option ${trx.metodeBayar === 'qris' ? 'active' : ''}" onclick="selectEditMethod(this, 'qris')">
          <i class="fas fa-qrcode"></i> <span>QRIS</span>
        </button>
        <button class="payment-option ${trx.metodeBayar === 'mixed' ? 'active' : ''}" onclick="selectEditMethod(this, 'mixed')">
          <i class="fas fa-random"></i> <span>CAMPUR</span>
        </button>
      </div>

      <div id="edit-quick-cash" class="quick-buttons mt-4 mb-3 ${trx.metodeBayar === 'tunai' ? 'flex' : 'hidden'}">
         <button class="btn btn-secondary btn-sm" onclick="setEditCash(50000)">50K</button>
         <button class="btn btn-secondary btn-sm" onclick="setEditCash(100000)">100K</button>
         <button class="btn btn-secondary btn-sm" onclick="setEditCash(${trx.total})">LUNAS</button>
      </div>

      <div id="edit-pure-qris-msg" class="p-4 text-center ${trx.metodeBayar === 'qris' ? 'block' : 'hidden'}">
        <i class="fas fa-qrcode color-primary mb-3 mt-2 text-xl"></i>
        <p class="text-muted">Nominal QRIS otomatis pas dengan total tagihan <strong class="text-primary">Rp ${Utils.formatRupiah(trx.total)}</strong></p>
      </div>

      <div id="edit-cash-input" class="form-group ${trx.metodeBayar === 'qris' ? 'is-hidden' : ''}">
        <label class="form-label">Nominal Tunai (CASH)</label>
        <input type="number" id="edit-cash-amount" class="form-input" placeholder="0"
               oninput="handleEditMixedCalc(this.value, 'cash', ${trx.total})"
               value="${trx.metodeBayar === 'tunai' ? trx.paid : (trx.cashAmount || 0)}">
      </div>
      <div id="edit-qris-input" class="form-group ${trx.metodeBayar === 'mixed' ? '' : 'is-hidden'}">
        <label class="form-label">Nominal QRIS</label>
        <input type="number" id="edit-qris-amount" class="form-input" placeholder="0"
               oninput="handleEditMixedCalc(this.value, 'qris', ${trx.total})"
               value="${trx.metodeBayar === 'mixed' ? (trx.qrisAmount || 0) : ''}">
      </div>
    `;

  modal.innerHTML = `
      <div class="modal">
        <h3><i class="fas fa-edit"></i> Edit Pembayaran</h3>
        <p class="text-muted mb-2">Total Transaksi: <strong class="text-primary text-bold-md">Rp ${Utils.formatRupiah(trx.total)}</strong></p>

        <div id="edit-payment-container" data-method="${trx.metodeBayar}">
          ${methodHtml}
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
          <button class="btn btn-primary" onclick="const b=this;Utils.setButtonLoading(b,true);saveEditPayment('${trx.id}', b).finally(()=>Utils.setButtonLoading(b,false))">
            <i class="fas fa-save"></i> Simpan
          </button>
        </div>
      </div>
    `;
  document.body.appendChild(modal);
}

window.selectEditMethod = function(btn, method) {
  const container = document.getElementById('edit-payment-container');
  container.dataset.method = method;

  container.querySelectorAll('.payment-option').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const cashInput = document.getElementById('edit-cash-input');
  const qrisInput = document.getElementById('edit-qris-input');
  const quickCash = document.getElementById('edit-quick-cash');
  const pureQrisMsg = document.getElementById('edit-pure-qris-msg');

  if (method === 'tunai') {
    cashInput.classList.remove('is-hidden');
    qrisInput.classList.add('is-hidden');
    if (quickCash) { quickCash.classList.remove('hidden'); quickCash.classList.add('flex'); }
    if (pureQrisMsg) pureQrisMsg.classList.add('hidden');
  } else if (method === 'qris') {
    cashInput.classList.add('is-hidden');
    qrisInput.classList.add('is-hidden');
    if (quickCash) quickCash.classList.add('hidden');
    if (pureQrisMsg) pureQrisMsg.classList.remove('hidden');
  } else {
    cashInput.classList.remove('is-hidden');
    qrisInput.classList.remove('is-hidden');
    if (quickCash) quickCash.classList.add('hidden');
    if (pureQrisMsg) pureQrisMsg.classList.add('hidden');
  }
};

window.setEditCash = function(amount) {
  document.getElementById('edit-cash-amount').value = amount;
};

window.handleEditMixedCalc = function(value, source, total) {
  const container = document.getElementById('edit-payment-container');
  if (container.dataset.method !== 'mixed') return;

  const cashInput = document.getElementById('edit-cash-amount');
  const qrisInput = document.getElementById('edit-qris-amount');

  let val = parseInt(value) || 0;
  if (val > total) val = total;

  if (source === 'cash') {
    qrisInput.value = total - val;
  } else {
    cashInput.value = total - val;
  }
};

async function saveEditPayment(trxId, btnRef) {
  const trx = state.transactions.find(t => t.id === trxId);
  if (!trx) return;

  const container = document.getElementById('edit-payment-container');
  const method = container.dataset.method;
  const total = trx.total;

  let cashAmount = 0, qrisAmount = 0, paid = 0;

  if (method === 'tunai') {
    cashAmount = parseInt(document.getElementById('edit-cash-amount').value || 0);
    paid = cashAmount;
    if (cashAmount < total) { Utils.showToast("Uang cash kurang dari total!", 'error'); return; }
    if (cashAmount > total) { Utils.showToast("Uang cash tidak boleh lebih/kurang", 'error'); return; }
  } else if (method === 'qris') {
    qrisAmount = total;
    paid = total;
  } else {
    cashAmount = parseInt(document.getElementById('edit-cash-amount').value || 0);
    qrisAmount = parseInt(document.getElementById('edit-qris-amount').value || 0);
    paid = cashAmount + qrisAmount;

    if (cashAmount >= total || qrisAmount >= total) {
      Utils.showToast("Salah satu melebihi/setara total! Gunakan metode CASH/QRIS tunggal.", 'warning');
      return;
    }
    if (paid !== total) { Utils.showToast("Untuk pembayaran campuran, total cash + QRIS harus sama dengan total transaksi.", 'error'); return; }
  }

  try {
    await dbCloud.collection("transactions").doc(trxId).update({
      metodeBayar: method,
      cashAmount: cashAmount,
      qrisAmount: qrisAmount,
      paid: paid,
      change: paid - total
    });
    Utils.showToast("Pembayaran berhasil diupdate", "success");
    btnRef.closest('.modal-overlay').remove();
  } catch (e) {
    Utils.showToast(Utils.getFriendlyError(e, 'Gagal memperbarui pembayaran. Silakan coba lagi.'), 'error');
  }
}

window.renderHistory = renderHistory;
window.showDetailModal = showDetailModal;
window.sortTransactions = sortTransactions;
window.toggleSelect = toggleSelect;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelected = deleteSelected;
window.reprintReceipt = reprintReceipt;
window.cetakRekapSesi = cetakRekapSesi;
window.showEditPaymentModal = showEditPaymentModal;
window.saveEditPayment = saveEditPayment;
