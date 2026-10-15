function startRealtimeCategories() {
  const unsubscribe = dbCloud.collection("categories").onSnapshot(async snap => {
    try {
      state.categories = [];
      snap.forEach(doc => state.categories.push({ id: doc.id, ...doc.data() }));
      const systemCats = state.categories.filter(c => c.system === true);
      if (systemCats.length === 0 && !snap.metadata.fromCache) {
        await dbCloud.collection("categories").add({ name: "LAINNYA", system: true });
      } else if (systemCats.length > 1) {
        const toDelete = systemCats.slice(1);
        await Promise.all(toDelete.map(c => dbCloud.collection("categories").doc(c.id).delete()));
      }
      safeRender();
    } catch (error) {
      Utils.showToast('Gagal menyegarkan kategori: ' + (error?.message || 'kesalahan tidak diketahui'), 'error');
    }
  });
  addListener(unsubscribe);
}

function startRealtimeMenus() {
  const unsubscribe = dbCloud.collection("menus").onSnapshot(snap => {
    state.menus = [];
    snap.forEach(doc => {
      const d = doc.data();
      const salePrice = Number(d.salePrice ?? d.price ?? 0);
      state.menus.push({ id: doc.id, ...d, price: salePrice, salePrice, costPrice: Number(d.costPrice ?? d.hargaModal ?? 0) });
    });
    safeRender();
  });
  addListener(unsubscribe);
}

function startRealtimeTransactions() {
  const unsubscribe = dbCloud.collection("transactions").orderBy("date", "desc").onSnapshot(snap => {
    state.allTransactions = [];
    snap.forEach(doc => state.allTransactions.push({ id: doc.id, ...doc.data() }));
    if (state.currentSession) {
      state.transactions = state.allTransactions.filter(t => t.sessionId === state.currentSession.id);
    } else {
      state.transactions = [];
    }
    if (state.currentView === "history") renderHistory();
    if (state.currentView === "laporan") window.renderLaporan?.();
  });
  addListener(unsubscribe);
}

function startRealtimeRawMaterials() {
  const unsubscribe = dbCloud.collection("raw_materials").onSnapshot(async snap => {
    try {
      const previousStocks = new Map(state.rawMaterials.map(b => [b.id, Number(b.stock || 0)]));
      state.rawMaterials = [];
      snap.forEach(doc => state.rawMaterials.push({ id: doc.id, ...doc.data() }));
      const adaPerubahan = snap.docChanges().some(change => {
        if (change.type === 'added' || change.type === 'removed') return true;
        if (change.type !== 'modified') return false;
        const oldStock = previousStocks.get(change.doc.id);
        const newStock = Number(change.doc.data().stock || 0);
        return oldStock !== newStock;
      });
      if (adaPerubahan && typeof window.updateAllProductStocks === 'function') {
        await window.updateAllProductStocks();
      }
      checkLowStockAlert();
      if (state.currentView === "bahanManager") renderBahanManager();
      if (state.currentView === "kasir") renderKasir();
    } catch (error) {
      Utils.showToast('Gagal menyegarkan stok: ' + (error?.message || 'kesalahan tidak diketahui'), 'error');
    }
  });
  addListener(unsubscribe);
}

function startRealtimeStockMutations() {
  const unsubscribe = dbCloud.collection("stock_mutations")
    .orderBy("createdAt", "desc")
    .limit(2000)
    .onSnapshot(snap => {
      state.stockMutations = [];
      snap.forEach(doc => state.stockMutations.push({ id: doc.id, ...doc.data() }));
    });
  addListener(unsubscribe);
}

function startRealtimeTables() {
  const unsubscribe = dbCloud.collection("tables").onSnapshot(snap => {
    state.tables = [];
    snap.forEach(doc => state.tables.push({ id: doc.id, ...doc.data() }));
    safeRender();
  });
  addListener(unsubscribe);
}

function startRealtimePengeluaran() {
  const unsubscribe = dbCloud.collection("pengeluaran")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      state.pengeluaran = [];
      snap.forEach(doc => state.pengeluaran.push({ id: doc.id, ...doc.data() }));
      if (state.currentView === "history") renderHistory();
      if (state.currentView === "laporan") window.renderLaporan?.();
      if (document.getElementById('modal-pengeluaran')) {
        window.refreshListPengeluaran?.();
      }
    });
  addListener(unsubscribe);
}

function startRealtimeModifierGroups() {
  const unsubscribe = dbCloud.collection("modifierGroups").onSnapshot(snap => {
    state.modifierGroups = [];
    snap.forEach(doc => state.modifierGroups.push({ id: doc.id, ...doc.data() }));
    if (state.currentView === "modifierManager") renderModifierManager();
  });
  addListener(unsubscribe);
}

function startRealtimeOpenBills() {
  const unsubscribe = dbCloud.collection("openBills")
    .where("status", "==", "open")
    .onSnapshot(snap => {
      state.openBills = [];
      snap.forEach(doc => state.openBills.push({ id: doc.id, ...doc.data() }));
      safeRender();
      _refreshOpenBillBadges();
    });
  addListener(unsubscribe);
}

function startRealtimeSessions() {
  const unsubscribe = dbCloud.collection("sessions")
    .orderBy("waktuBuka", "desc")
    .limit(500)
    .onSnapshot(snap => {
      state.allSessions = [];
      snap.forEach(doc => state.allSessions.push({ id: doc.id, ...doc.data() }));
      if (state.currentView === "laporan") window.renderLaporan?.();
    });
  addListener(unsubscribe);
}

function _refreshOpenBillBadges() {
  const count = (state.openBills || []).length;
  const badge = document.getElementById('open-bill-badge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function checkLowStockAlert() {
  const lowStock = state.rawMaterials.filter(m => m.stock <= (m.minStock || 5));
  if (lowStock.length > 0 && state.currentView !== 'bahanManager') {
    const lastAlert = Utils.storage.get('lastLowStockAlert');
    const now = Date.now();
    if (!lastAlert || (now - parseInt(lastAlert)) > 3600000) {
      Utils.showToast(`${lowStock.length} bahan menipis`, 'warning');
      Utils.storage.set('lastLowStockAlert', now.toString());
    }
  }
}

async function updateAllProductStocks() {
  const updates = [];
  for (const produk of state.menus) {
    if (produk.resep && produk.resep.length > 0 && !produk.useStock) {
      const stokBaru = Utils.hitungStokProduk(produk);
      if (produk.stokOtomatis !== stokBaru || Number(produk.stock) !== stokBaru) {
        updates.push([produk.id, stokBaru]);
      }
    }
  }
  try {
    for (let i = 0; i < updates.length; i += 400) {
      const batch = dbCloud.batch();
      for (const [id, stokBaru] of updates.slice(i, i + 400)) {
        batch.update(dbCloud.collection("menus").doc(id), {
          stokOtomatis: stokBaru,
          stock: stokBaru,
          updatedAt: new Date()
        });
      }
      await batch.commit();
    }
  } catch (error) {
    Utils.showToast('Gagal memperbarui stok otomatis: ' + (error?.message || 'kesalahan tidak diketahui'), 'error');
  }
}

window.startRealtimeCategories = startRealtimeCategories;
window.startRealtimeMenus = startRealtimeMenus;
window.startRealtimeTransactions = startRealtimeTransactions;
window.startRealtimeRawMaterials = startRealtimeRawMaterials;
window.startRealtimeStockMutations = startRealtimeStockMutations;
window.startRealtimeTables = startRealtimeTables;
window.startRealtimePengeluaran = startRealtimePengeluaran;
window.startRealtimeModifierGroups = startRealtimeModifierGroups;
window.startRealtimeOpenBills = startRealtimeOpenBills;
window.startRealtimeSessions = startRealtimeSessions;
window.updateAllProductStocks = updateAllProductStocks;
