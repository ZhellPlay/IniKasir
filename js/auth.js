firebase.auth().onAuthStateChanged(async function (user) {
    try {
        cleanupListeners();
    } catch (error) {
        Utils.showToast('Gagal membersihkan koneksi sebelumnya.', 'warning');
    }
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
        <form id="login-form" class="login-form" onsubmit="event.preventDefault(); const b=document.getElementById('btn-login'); Utils.setButtonLoading(b,true); login(b)">
          <input id="email" type="email" class="login-input" placeholder="Email" autocomplete="email" required>
          <div class="login-password-wrap">
            <input id="password" type="password" class="login-input login-password-input" placeholder="Password" autocomplete="current-password" required>
            <button type="button" class="login-password-toggle" id="toggle-password" onclick="togglePasswordVisibility()" aria-label="Tampilkan password" title="Tampilkan password">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <button type="submit" class="btn-login" id="btn-login">MASUK</button>
        </form>
        <p class="brand-footer">VERSI 3.0.0</p>
      </div>
    </div>
  `;
}


function togglePasswordVisibility() {
    const input = document.getElementById('password');
    const button = document.getElementById('toggle-password');
    if (!input || !button) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.setAttribute('aria-label', visible ? 'Tampilkan password' : 'Sembunyikan password');
    button.setAttribute('title', visible ? 'Tampilkan password' : 'Sembunyikan password');
    button.innerHTML = `<i class="fas fa-${visible ? 'eye' : 'eye-slash'}"></i>`;
}

async function login(btn) {
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    try {
        await firebase.auth().signInWithEmailAndPassword(email, pass);
    } catch (error) {
        Utils.showToast(Utils.getFriendlyError(error, 'Login gagal. Periksa email dan password.'), 'error');
        if (btn) Utils.setButtonLoading(btn, false);
    }
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
        Utils.showToast('Gagal memuat aplikasi. Silakan coba lagi.', 'error');
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
                fitur: { meja: true, diskon: true },
                operasional: { jamBuka: "08:00" }
            };
            await dbCloud.collection("settings").doc("toko").set(defaultSettings);
            state.settings = defaultSettings;
        }
    } catch (error) {
        Utils.showToast('Gagal memuat pengaturan toko.', 'error');
    }
}

async function loadTables() {
    try {
        const snapshot = await dbCloud.collection("tables").get();
        const allDocs = [];
        snapshot.forEach(doc => allDocs.push({ id: doc.id, ...doc.data() }));
        state.tables = allDocs;
    } catch (error) {
        Utils.showToast('Gagal memuat data meja.', 'error');
    }
}

async function checkActiveSession() {
    try {
        const savedSession = Utils.storage.get('activeSession');
        if (savedSession) {
            const parsed = JSON.parse(savedSession);
            const doc = await dbCloud.collection("sessions").doc(parsed.id).get();
            const data = doc.exists ? doc.data() : null;
            const ownsSession = data && ((data.kasirUid && data.kasirUid === state.user.uid) || (!data.kasirUid && data.kasirAkun === state.user.email));
            if (doc.exists && data.status === "active" && ownsSession) {
                state.currentSession = { id: parsed.id, ...data };
                return;
            }
            Utils.storage.remove('activeSession');
        }
        const lockRef = dbCloud.collection("session_locks").doc(state.user.uid);
        const lockSnap = await lockRef.get();
        if (lockSnap.exists && lockSnap.data().status === "active" && lockSnap.data().sessionId) {
            const sessionDoc = await dbCloud.collection("sessions").doc(lockSnap.data().sessionId).get();
            if (sessionDoc.exists && sessionDoc.data().status === "active") {
                state.currentSession = { id: sessionDoc.id, ...sessionDoc.data() };
                Utils.storage.jsonSet('activeSession', state.currentSession);
                return;
            }
        }
        const snapshot = await dbCloud.collection("sessions")
            .where("status", "==", "active")
            .where("kasirAkun", "==", state.user.email)
            .limit(1).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            state.currentSession = { id: doc.id, ...doc.data() };
            Utils.storage.jsonSet('activeSession', state.currentSession);
        }
    } catch (error) {
        Utils.showToast('Gagal memulihkan shift aktif.', 'warning');
    }
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
    let modalAwal = 0;

    window._selectedKasirs = new Set();
    const kasirHtml = kasirAktif.length > 0 ? kasirAktif.map(k => `
        <label class="auth-checkbox-group">
            <input type="checkbox" class="auth-checkbox-input" value="${k.nama}"
                   onchange="if(this.checked) window._selectedKasirs.add(this.value); else window._selectedKasirs.delete(this.value);">
            <span class="text-bold-md text-lg">${k.nama}</span>
        </label>
    `).join('') : '';

    const result = await Utils.showModal({
        title: 'Buka Shift Baru',
        customClass: 'swal2-is-medium',
        content: `
            ${kasirHtml ? `
            <div class="mb-3 text-left">
                <label class="form-label mb-2">Pilih Kasir yang Bertugas:</label>
                <div class="auth-kasir-container">${kasirHtml}</div>
            </div>` : ''}
            <div class="text-left">
                <label class="form-label">Uang Modal Awal <span class="text-muted">(opsional)</span></label>
                <input id="modalAwalInput" type="text" class="form-input" inputmode="numeric" autocomplete="off"
                       placeholder="Contoh: 100.000"
                       oninput="this.value=this.value.replace(/[^0-9]/g,''); if(this.value) this.value=Number(this.value).toLocaleString('id-ID');">
                <small class="text-muted">Masukkan uang yang sudah ada di laci kas sebelum shift dimulai.</small>
            </div>
        `,
        buttons: [
            { text: 'Batal', action: 'cancel', class: 'btn-secondary' },
            { text: 'Mulai Shift', action: 'start', class: 'swal2-confirm swal2-styled' }
        ]
    });

    if (result !== 'start') {
        delete window._selectedKasirs;
        return;
    }

    if (kasirAktif.length > 0) {
        const selectedNames = Array.from(window._selectedKasirs);
        if (selectedNames.length === 0) {
            delete window._selectedKasirs;
            Utils.showToast("Pilih minimal 1 kasir!", 'warning');
            return;
        }
        if (selectedNames.length === 1) selectedKasirsStr = selectedNames[0];
        else if (selectedNames.length === 2) selectedKasirsStr = selectedNames[0] + ' & ' + selectedNames[1];
        else selectedKasirsStr = selectedNames.join(', ');
    }

    const modalInput = document.getElementById('modalAwalInput');
    if (modalInput) modalAwal = Number(String(modalInput.value || '').replace(/\D/g, '')) || 0;
    const selectedKasirNames = Array.from(window._selectedKasirs || []);
    delete window._selectedKasirs;

    const sessionRef = dbCloud.collection("sessions").doc();
    const lockRef = dbCloud.collection("session_locks").doc(state.user?.uid || 'unknown');
    const session = {
        kasir: selectedKasirsStr,
        kasirAkun: state.user?.email || 'unknown',
        kasirUid: state.user?.uid || 'unknown',
        kasirNames: selectedKasirNames,
        waktuBuka: new Date(),
        modalAwal,
        totalPenjualan: 0,
        jumlahTransaksi: 0,
        status: "active",
        shift: getShiftWaktu()
    };
    try {
        await dbCloud.runTransaction(async tx => {
            const lockSnap = await tx.get(lockRef);
            if (lockSnap.exists && lockSnap.data().status === 'active' && lockSnap.data().sessionId) {
                const existing = await tx.get(dbCloud.collection('sessions').doc(lockSnap.data().sessionId));
                if (existing.exists && existing.data().status === 'active') throw new Error('SHIFT_ALREADY_ACTIVE');
            }
            tx.set(sessionRef, session);
            tx.set(lockRef, { sessionId: sessionRef.id, status: 'active', kasirAkun: state.user?.email || 'unknown', kasirUid: state.user?.uid || 'unknown', updatedAt: new Date() });
        });
        const doc = sessionRef;
        state.currentSession = { id: doc.id, ...session };
        Utils.storage.jsonSet('activeSession', state.currentSession);
        Utils.showToast(`Shift ${session.shift} dibuka${modalAwal > 0 ? ` dengan modal Rp ${Utils.formatRupiah(modalAwal)}` : ''} oleh ${selectedKasirsStr}`);
        renderKasir();
    } catch (error) {
        Utils.showToast('Gagal membuka shift. Silakan coba lagi.', 'error');
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
    const totalCash = transaksiSesi.reduce((sum, t) => {
        const qris = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
        return sum + (t.metodeBayar === 'tunai' ? (t.total || 0) : Math.max(0, (t.total || 0) - qris));
    }, 0);
    const totalQRIS = transaksiSesi.reduce((sum, t) => {
        const qrisAmt = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
        return sum + qrisAmt;
    }, 0);
    const pengeluaranSesi = state.pengeluaran?.filter(p => p.sessionId === state.currentSession.id) || [];
    const totalPengeluaran = pengeluaranSesi.reduce((sum, p) => sum + (p.nominal || 0), 0);
    const kasBersih = totalCash - totalPengeluaran;
    const modalAwal = Number(state.currentSession.modalAwal || 0);
    const uangDiLaci = modalAwal + kasBersih;

    const result = await Utils.showModal({
        title: `Rekap Shift ${state.currentSession.shift}`,
        customClass: 'swal2-is-medium',
        content: `
      <div class="rekap-card">
        <div><span>Transaksi</span><strong> ${transaksiSesi.length}x</strong></div>
        <div><span>CASH</span><strong> Rp ${Utils.formatRupiah(totalCash)}</strong></div>
        <div><span>QRIS</span><strong> Rp ${Utils.formatRupiah(totalQRIS)}</strong></div>
        <div><span>Penjualan Bersih</span><strong> Rp ${Utils.formatRupiah(totalPenjualan)}</strong></div>
        <div class="session-summary-divider">
          <div><span>Pengeluaran</span><strong class="session-summary-pengeluaran"> -Rp ${Utils.formatRupiah(totalPengeluaran)}</strong></div>
          <div><span>Kas Bersih</span><strong class="session-summary-kas"> Rp ${Utils.formatRupiah(kasBersih)}</strong></div>
          <div><span>Modal Awal</span><strong> Rp ${Utils.formatRupiah(modalAwal)}</strong></div>
          <div><span>Kas Seharusnya di Laci</span><strong class="session-summary-kas"> Rp ${Utils.formatRupiah(uangDiLaci)}</strong></div>
        </div>
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
        totalPengeluaran, kasBersih, modalAwal, uangDiLaci, status: "closed"
    };
    try {
        const sessionRef = dbCloud.collection("sessions").doc(state.currentSession.id);
        const lockRef = dbCloud.collection("session_locks").doc(state.user?.uid || state.currentSession.kasirUid || 'unknown');
        await dbCloud.runTransaction(async tx => {
            const sessionSnap = await tx.get(sessionRef);
            if (!sessionSnap.exists || sessionSnap.data().status !== 'active') throw new Error('SHIFT_ALREADY_CLOSED');
            tx.update(sessionRef, rekap);
            tx.delete(lockRef);
        });
        localStorage.removeItem("activeSession");
        Utils.storage.remove('activeSession');
        state.currentSession = null;
        state.transactions = [];
        Utils.showToast("Shift ditutup");
        renderKasir();
    } catch (error) {
        Utils.showToast(Utils.getFriendlyError(error), 'error');
    }
}

window.login = login;
window.togglePasswordVisibility = togglePasswordVisibility;
window.logout = logout;
window.bukaShift = bukaShift;
window.tutupShift = tutupShift;
