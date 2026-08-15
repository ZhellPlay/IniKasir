let printerDevice = null;
let printerCharacteristic = null;
let isPrinting = false;
window.printerConnected = false;

function updatePrinterStatus(connected) {
    window.printerConnected = connected;
    const dot = document.getElementById('printer-status-dot');
    const label = document.getElementById('printer-nav-label');
    if (dot) { dot.classList.toggle('online', connected); dot.classList.toggle('offline', !connected); }
    if (label && !window.sidebarCollapsed) label.textContent = connected ? 'Printer (On)' : 'Printer';
}

async function connectPrinter() {
    try {
        printerDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [0x18F0]
        });
        printerDevice.addEventListener('gattserverdisconnected', onPrinterDisconnected);
        const server = await printerDevice.gatt.connect();
        const service = await server.getPrimaryService(0x18F0);
        printerCharacteristic = await service.getCharacteristic(0x2AF1);
        Utils.showToast("Printer terhubung: " + printerDevice.name, "success");
        updatePrinterStatus(true);
        return true;
    } catch (e) {
        Utils.showToast("Gagal connect printer: " + e.message, "error");
        return false;
    }
}

function onPrinterDisconnected() {
    Utils.showToast("Printer terputus", "warning");
    printerDevice = null;
    printerCharacteristic = null;
    updatePrinterStatus(false);
}

async function disconnectPrinter() {
    if (printerDevice && printerDevice.gatt.connected) {
        printerDevice.gatt.disconnect();
        printerDevice = null;
        printerCharacteristic = null;
        updatePrinterStatus(false);
        Utils.showToast("Printer diputuskan", "success");
    }
}

async function writeInChunks(data) {
    const chunkSize = 100;
    const delay = 10;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        try {
            if (printerCharacteristic.writeValueWithoutResponse) {
                await printerCharacteristic.writeValueWithoutResponse(chunk);
            } else {
                await printerCharacteristic.writeValue(chunk);
            }
        } catch (e) {
            throw e;
        }
        await new Promise(r => setTimeout(r, delay));
    }
}

async function printStruk(trx) {
    if (!printerDevice || !printerDevice.gatt.connected) {
        showPrintDialog(trx);
        return false;
    }
    if (!printerCharacteristic) return false;
    if (isPrinting) {
        Utils.showToast("Printer sedang sibuk, coba lagi sebentar", "warning");
        return false;
    }

    isPrinting = true;

    try {
        const now = new Date();
        const encoder = new TextEncoder();
        let bytes = [];
        bytes.push(0x1B, 0x40);
        bytes.push(...encoder.encode("\n"));
        bytes.push(0x1B, 0x61, 0x01);
        bytes.push(0x1B, 0x45, 0x01);
        bytes.push(0x1D, 0x21, 0x11);
        const namaToko = window.state?.settings?.toko?.nama || "";
        bytes.push(...encoder.encode(namaToko + "\n"));
        bytes.push(0x1D, 0x21, 0x00);
        bytes.push(0x1B, 0x45, 0x00);
        const alamat = window.state?.settings?.toko?.alamat || "";
        bytes.push(...encoder.encode(alamat + "\n"));
        const telepon = window.state?.settings?.toko?.telepon || "";
        bytes.push(...encoder.encode("Telp: " + telepon + "\n"));
        bytes.push(...encoder.encode("================================\n"));
        const tanggalLengkap = now.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Makassar"
        });
        const jam = now.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "Asia/Makassar"
        });
        bytes.push(0x1B, 0x61, 0x00);
        bytes.push(...encoder.encode(tanggalLengkap + " " + jam + "\n"));
        bytes.push(...encoder.encode("No: " + (trx.id?.substring(0, 8) || "000000") + "\n"));
        if (trx.mejaNama && window.state?.settings?.struk?.showMeja !== false) {
            bytes.push(...encoder.encode("Meja " + (trx.mejaNomor || "") + ": " + trx.mejaNama + "\n"));
        }
        bytes.push(...encoder.encode("================================\n"));
        trx.items.forEach(i => {
            bytes.push(...encoder.encode(i.name + "\n"));
            if (i.modifiers && i.modifiers.length > 0) {
                i.modifiers.forEach(m => {
                    const modLabel = "  + " + m.optionName + (m.price > 0 ? " +" + Utils.formatRupiah(m.price) : "");
                    bytes.push(...encoder.encode(modLabel + "\n"));
                });
            }
            if (i.notes) {
                bytes.push(...encoder.encode("  * " + i.notes + "\n"));
            }
            const unitPrice = i.price + (i.modifierTotal || 0);
            const qtyPrice = i.qty + " x " + Utils.formatRupiah(unitPrice);
            const totalPrice = Utils.formatRupiah(unitPrice * i.qty);
            const itemSpacing = 32 - qtyPrice.length - totalPrice.length;
            const itemLine = qtyPrice + " ".repeat(Math.max(0, itemSpacing)) + totalPrice;
            bytes.push(...encoder.encode(itemLine + "\n"));
            if (window.state?.settings?.struk?.showHargaSatuan) {
                bytes.push(...encoder.encode("  @" + Utils.formatRupiah(unitPrice) + "\n"));
            }
        });
        bytes.push(...encoder.encode("================================\n"));
        const totalLine = "TOTAL";
        const bayarLine = "BAYAR";
        const kembaliLine = "KEMBALI";
        const totalSpacing = 32 - totalLine.length - Utils.formatRupiah(trx.total).length;
        const bayarSpacing = 32 - bayarLine.length - Utils.formatRupiah(trx.paid).length;
        const kembaliSpacing = 32 - kembaliLine.length - Utils.formatRupiah(trx.change).length;
        bytes.push(0x1B, 0x45, 0x01);
        bytes.push(...encoder.encode(
            totalLine + " ".repeat(Math.max(0, totalSpacing)) + Utils.formatRupiah(trx.total) + "\n"
        ));
        bytes.push(0x1B, 0x45, 0x00);
        bytes.push(...encoder.encode(
            bayarLine + " ".repeat(Math.max(0, bayarSpacing)) + Utils.formatRupiah(trx.paid) + "\n"
        ));
        bytes.push(...encoder.encode(
            kembaliLine + " ".repeat(Math.max(0, kembaliSpacing)) + Utils.formatRupiah(trx.change) + "\n"
        ));
        bytes.push(...encoder.encode("================================\n"));
        if (window.state?.settings?.struk?.header) {
            bytes.push(0x1B, 0x61, 0x01);
            bytes.push(...encoder.encode(window.state.settings.struk.header + "\n"));
        }
        if (window.state?.settings?.struk?.footer?.length) {
            bytes.push(0x1B, 0x61, 0x01);
            window.state.settings.struk.footer.forEach(line => {
                bytes.push(...encoder.encode(line + "\n"));
            });
        }
        if (!window.state?.settings?.struk?.footer?.length) {
            bytes.push(0x1B, 0x61, 0x01);
            bytes.push(...encoder.encode("Terima Kasih\n"));
            bytes.push(...encoder.encode("Atas Kunjungan Anda\n"));
        }
        bytes.push(...encoder.encode("================================\n"));
        bytes.push(...encoder.encode("\n\n\n\n"));
        await writeInChunks(new Uint8Array(bytes));
        Utils.showToast("Struk berhasil dicetak", "success");
        isPrinting = false;
        return true;
    } catch (error) {
        Utils.showToast("Gagal mencetak: " + error.message, "error");
        isPrinting = false;
        return false;
    }
}

async function printRekapSesi(session, transactions) {
    if (!printerDevice || !printerDevice.gatt.connected) {
        Utils.showToast("Printer tidak terhubung", "error");
        return false;
    }
    if (isPrinting) {
        Utils.showToast("Printer sedang sibuk", "warning");
        return false;
    }

    isPrinting = true;

    try {
        const encoder = new TextEncoder();
        let bytes = [];
        bytes.push(0x1B, 0x40);
        bytes.push(...encoder.encode("\n\n"));
        bytes.push(0x1B, 0x61, 0x01);
        bytes.push(0x1B, 0x45, 0x01);
        bytes.push(...encoder.encode("REKAP SHIFT\n"));
        bytes.push(0x1B, 0x45, 0x00);
        bytes.push(...encoder.encode("================================\n"));
        bytes.push(0x1B, 0x61, 0x00);
        bytes.push(...encoder.encode("Kasir: " + (session.namaKasir || session.kasir) + "\n"));
        bytes.push(...encoder.encode("Shift: " + session.shift + "\n"));
        const waktuBuka = (session.waktuBuka?.seconds ? new Date(session.waktuBuka.seconds * 1000) : new Date(session.waktuBuka));
        bytes.push(...encoder.encode("Buka: " + waktuBuka.toLocaleString('id-ID') + "\n"));
        if (session.waktuTutup) {
            const waktuTutup = (session.waktuTutup?.seconds ? new Date(session.waktuTutup.seconds * 1000) : new Date(session.waktuTutup));
            bytes.push(...encoder.encode("Tutup: " + waktuTutup.toLocaleString('id-ID') + "\n"));
        }
        bytes.push(...encoder.encode("================================\n"));
        bytes.push(...encoder.encode("RINGKASAN:\n"));
        bytes.push(...encoder.encode("Transaksi: " + transactions.length + "x\n"));
        const totalPenjualan = transactions.reduce((sum, t) => sum + t.total, 0);
        bytes.push(...encoder.encode("Total: Rp " + Utils.formatRupiah(totalPenjualan) + "\n"));
        const totalCash = transactions.reduce((sum, t) => {
            const qris = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
            return sum + (t.metodeBayar === 'tunai' ? (t.total || 0) : Math.max(0, (t.total || 0) - qris));
        }, 0);
        const totalQRIS = transactions.reduce((sum, t) => {
            const qrisAmt = t.metodeBayar === 'qris' ? (t.total || 0) : (t.qrisAmount || 0);
            return sum + qrisAmt;
        }, 0);
        bytes.push(...encoder.encode("Cash: Rp " + Utils.formatRupiah(totalCash) + "\n"));
        bytes.push(...encoder.encode("QRIS: Rp " + Utils.formatRupiah(totalQRIS) + "\n"));
        bytes.push(...encoder.encode("================================\n"));
        bytes.push(...encoder.encode("PRODUK TERJUAL:\n"));
        const recap = {};
        transactions.forEach(t => {
            t.items.forEach(i => {
                if (!recap[i.name]) recap[i.name] = 0;
                recap[i.name] += i.qty;
            });
        });
        Object.keys(recap).sort().forEach(name => {
            bytes.push(...encoder.encode(name + ": " + recap[name] + " pcs\n"));
        });
        bytes.push(...encoder.encode("================================\n"));
        bytes.push(...encoder.encode("\n\n\n"));
        await writeInChunks(new Uint8Array(bytes));
        Utils.showToast("Rekap shift dicetak", "success");
        isPrinting = false;
    } catch (error) {
        Utils.showToast("Gagal cetak rekap: " + error.message, "error");
        isPrinting = false;
    }
}

function showPrintDialog(trx) {
    if (document.getElementById('print-dialog')) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'print-dialog';
    modal.innerHTML = `
    <div class="modal modal-sm">
      <div class="modal-icon">
        <i class="fas fa-print"></i>
      </div>
      <h3>Printer Tidak Terdeteksi</h3>
      <p class="modal-description">
        Transaksi berhasil disimpan, namun printer Bluetooth belum terkoneksi.
      </p>
      <div class="printer-options">
        <button class="printer-option" onclick="const b=this;Utils.setButtonLoading(b,true);connectAndPrintFromDialog('${trx.id}').finally(()=>Utils.setButtonLoading(b,false))">
          <div class="printer-option-icon">
            <i class="fas fa-bluetooth"></i>
          </div>
          <div class="printer-option-content">
            <div class="printer-option-title">Cari & Hubungkan Printer</div>
            <div class="printer-option-desc">Cari printer dan cetak sekarang</div>
          </div>
          <i class="fas fa-chevron-right"></i>
        </button>
        <button class="printer-option" onclick="closePrintDialog()">
          <div class="printer-option-icon printer-option-icon--neutral">
            <i class="fas fa-check"></i>
          </div>
          <div class="printer-option-content">
            <div class="printer-option-title">Lanjut Tanpa Print</div>
            <div class="printer-option-desc">Transaksi selesai, struk tidak dicetak</div>
          </div>
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
      <div class="modal-footer-inline">
        <button class="btn btn-secondary modal-close" onclick="closePrintDialog()">
          <i class="fas fa-times"></i> Tutup
        </button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
}

async function connectAndPrintFromDialog(trxId) {
    closePrintDialog();
    try {
        const connected = await connectPrinter();
        if (connected) {
            const trx = window.state?.transactions?.find(t => t.id === trxId)
                || window.state?.allTransactions?.find(t => t.id === trxId);
            if (trx) await printStruk(trx);
        }
    } catch (error) {
        Utils.showToast('Gagal connect printer: ' + error.message, 'error');
    }
}

function closePrintDialog() {
    const modal = document.getElementById('print-dialog');
    if (modal) {
        modal.classList.add('fade-out');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 200);
    }
}

window.connectPrinter = connectPrinter;
window.disconnectPrinter = disconnectPrinter;
window.printStruk = printStruk;
window.printRekapSesi = printRekapSesi;
window.connectAndPrintFromDialog = connectAndPrintFromDialog;
window.closePrintDialog = closePrintDialog;