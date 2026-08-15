firebase.auth().onAuthStateChanged(async function (user) {
    state.user = user;
    if (!user) {
        renderLogin();
    } else {
        await initializeApp();
        startRealtimeCategories();
        startRealtimeMenus();
        startRealtimeTransactions();
        startRealtimeRawMaterials();
        startRealtimeStockMutations();
        startRealtimeTables();
        startRealtimePengeluaran();
        startRealtimeModifierGroups();
        startRealtimeOpenBills();
        startRealtimeSessions();
        renderKasir();
    }
});

function renderLogin() {
    app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <span class="brand-title">${window.APP_NAME}</span>
        <p class="brand-subtitle">Sistem Kasir dengan Manajemen Stok, Resep, Pengeluaran, dan Laporan</p>
        <input id="email" type="email" class="login-input" placeholder="Email" autocomplete="email">
        <input id="password" type="password" class="login-input" placeholder="Password" autocomplete="current-password">
        <button class="btn-login" id="btn-login" onclick="const b=this;Utils.setButtonLoading(b,true);login(b)">MASUK</button>
        <p class="brand-footer">VERSI 3.0.0</p>
      </div>
    </div>
  `;
}

function login(btn) {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    firebase.auth().signInWithEmailAndPassword(email, pass)
        .catch(e => {
            Utils.showToast(e.message, 'error');
            if (btn) Utils.setButtonLoading(btn, false);
        });
}

function logout() {
    if (state.currentSession) {
        Utils.showConfirm("Shift masih aktif! Tutup shift terlebih dahulu.").then(ok => {
            if (ok) tutupShift();
        });
        return;
    }
    cleanupListeners();
    firebase.auth().signOut();
}

async function initializeApp() {
    try {
        await loadSettings();
        await loadTables();
        await checkActiveSession();
    } catch (error) {
        Utils.showToast('Gagal memuat aplikasi: ' + error.message, 'error');
    }
}

async function loadSettings() {
    try {
        const snapshot = await dbCloud.collection("settings").doc("toko").get();
        if (snapshot.exists) {
            state.settings = snapshot.data();
        } else {
            const defaultSettings = {
                toko: { nama: "", alamat: "", telepon: "" },
                struk: { header: "TERIMA KASIH", footer: [], showMeja: true },
                meja: { aktif: true },
                operasional: { jamBuka: "08:00" }
            };
            await dbCloud.collection("settings").doc("toko").set(defaultSettings);
            state.settings = defaultSettings;
        }
    } catch (error) {}
}

async function loadTables() {
    try {
        const snapshot = await dbCloud.collection("tables").get();
        const allDocs = [];
        snapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
        state.tables = allDocs;
    } catch (error) {}
}

async function checkActiveSession() {
    try {
        const savedSession = localStorage.getItem("activeSession");
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            const doc = await dbCloud.collection("sessions").doc(parsed.id).get();
            if (doc.exists && doc.data().status === "active") {
                state.currentSession = { id: parsed.id, ...doc.data() };
                return;
            }
        }
        const snapshot = await dbCloud.collection("sessions")
            .where("status", "==", "active")
            .where("kasir", "==", state.user.email)
            .limit(1).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            state.currentSession = { id: doc.id, ...doc.data() };
            localStorage.setItem("activeSession", JSON.stringify(state.currentSession));
        }
    } catch (error) {}
}

function getShiftWaktu() {
    const jam = new Date().getHours();
    if (jam < 9) return "PAGI";
    if (jam < 15) return "SIANG";
    if (jam < 18) return "SORE";
    return "MALAM";
}

async function bukaShift() {
    const kasirAktif = (state.settings?.kasirs || []).filter(k => k.aktif);
    let selectedKasirsStr = state.user?.email || 'unknown';

    if (kasirAktif.length > 0) {
        window._selectedKasirs = new Set();
        let kasirHtml = kasirAktif.map(k => `
            <label class="auth-checkbox-group">
                <input type="checkbox" class="auth-checkbox-input" value="${k.nama}"
                       onchange="if(this.checked) window._selectedKasirs.add(this.value); else window._selectedKasirs.delete(this.value);">
                <span class="text-bold-md text-lg">${k.nama}</span>
            </label>
        `).join('');

        const result = await Utils.showModal({
            title: 'Buka Shift Baru',
            customClass: 'swal2-is-medium',
            content: `
                <div class="mb-2 text-left">
                    <label class="form-label mb-2">Pilih Kasir yang Bertugas:</label>
                    <div class="auth-kasir-container">
                        ${kasirHtml}
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
                { text: 'Mulai Shift', action: 'start', class: 'swal2-confirm swal2-styled' }
            ]
        });

        if (result === 'start') {
            const selectedNames = Array.from(window._selectedKasirs);
            delete window._selectedKasirs;
            if (selectedNames.length === 0) {
                Utils.showToast("Pilih minimal 1 kasir!", 'warning');
                return;
            }
            if (selectedNames.length === 1) {
                selectedKasirsStr = selectedNames[0];
            } else if (selectedNames.length === 2) {
                selectedKasirsStr = selectedNames[0] + ' & ' + selectedNames[1];
            } else {
                selectedKasirsStr = selectedNames.join(', ');
            }
        } else {
            delete window._selectedKasirs;
            return;
        }
    }

    const session = {
        kasir: selectedKasirsStr,
        waktuBuka: new Date(),
        modalAwal: 0,
        totalPenjualan: 0,
        jumlahTransaksi: 0,
        status: "active",
        shift: getShiftWaktu()
    };
    try {
        const doc = await dbCloud.collection("sessions").add(session);
        state.currentSession = { id: doc.id, ...session };
        localStorage.setItem("activeSession", JSON.stringify(state.currentSession));
        Utils.showToast(`Shift ${session.shift} dibuka oleh ${selectedKasirsStr}`);
        renderKasir();
    } catch (error) {
        Utils.showToast("Gagal buka shift: " + error.message, 'error');
    }
}

async function tutupShift() {
    if (!state.currentSession) return;

    const openBillsSesi = (state.openBills || []).filter(ob => ob.sessionId === state.currentSession.id);
    if (openBillsSesi.length > 0) {
        Utils.showToast(`Masih ada ${openBillsSesi.length} open bill yang belum dibayar!`, 'warning');
        return;
    }

    const transaksiSesi = state.transactions.filter(t => t.sessionId === state.currentSession.id);
    const totalPenjualan = transaksiSesi.reduce((sum, t) => sum + t.total, 0);
    const totalCash = transaksiSesi.reduce((sum, t) => sum + (t.cashAmount || (t.metodeBayar === 'tunai' ? t.total : 0)), 0);
    const totalQRIS = transaksiSesi.reduce((sum, t) => sum + (t.qrisAmount || (t.metodeBayar === 'qris' ? t.total : 0)), 0);
    const pengeluaranSesi = state.pengeluaran?.filter(p => p.sessionId === state.currentSession.id) || [];
    const totalPengeluaran = pengeluaranSesi.reduce((sum, p) => sum + (p.nominal || 0), 0);
    const kasBersih = totalCash - totalPengeluaran;
    const uangDiLaci = state.currentSession.modalAwal + totalCash;

    const result = await Utils.showModal({
        title: `Rekap Shift ${state.currentSession.shift}`,
        customClass: 'swal2-is-medium',
        content: `
      <div class="rekap-card">
        <div><span>Transaksi</span><strong> ${transaksiSesi.length}x</strong></div>
        <div><span>CASH</span><strong> Rp ${Utils.formatRupiah(totalCash)}</strong></div>
        <div><span>QRIS</span><strong> Rp ${Utils.formatRupiah(totalQRIS)}</strong></div>
        <div><span>Total</span><strong> Rp ${Utils.formatRupiah(totalPenjualan)}</strong></div>
        ${totalPengeluaran > 0 ? `
        <div class="session-summary-divider">
          <div><span>Pengeluaran</span><strong class="session-summary-pengeluaran"> -Rp ${Utils.formatRupiah(totalPengeluaran)}</strong></div>
          <div><span>Kas Bersih</span><strong class="session-summary-kas"> Rp ${Utils.formatRupiah(kasBersih)}</strong></div>
        </div>` : ''}
      </div>
    `,
        buttons: [
            { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
            { text: 'Cetak Rekap', action: 'print', class: 'btn-warning' },
            { text: 'Tutup Shift', action: 'close', class: 'btn-primary' }
        ]
    });

    if (result === 'print') {
        if (typeof window.printRekapSesi === 'function') {
            await window.printRekapSesi(state.currentSession, transaksiSesi);
        }
        return;
    }
    if (result !== 'close') return;

    const rekap = {
        waktuTutup: new Date(),
        totalPenjualan, totalCash, totalQRIS,
        jumlahTransaksi: transaksiSesi.length,
        uangDiLaci, status: "closed"
    };
    try {
        await dbCloud.collection("sessions").doc(state.currentSession.id).update(rekap);
        localStorage.removeItem("activeSession");
        state.currentSession = null;
        state.transactions = [];
        Utils.showToast("Shift ditutup");
        renderKasir();
    } catch (error) {
        Utils.showToast("Gagal: " + error.message, 'error');
    }
}

window.login = login;
window.logout = logout;
window.bukaShift = bukaShift;
window.tutupShift = tutupShift;
