const listeners = [];

function addListener(unsubscribe) {
    if (typeof unsubscribe === 'function') listeners.push(unsubscribe);
}

function cleanupListeners() {
    while (listeners.length) {
        const unsubscribe = listeners.pop();
        try {
            unsubscribe();
        } catch (error) {
            window.Utils?.showToast?.('Gagal menutup koneksi data.', 'error');
        }
    }
}

function _cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

(function _initTopProgress() {
    let bar = document.createElement('div');
    bar.id = 'top-progress-bar';
    bar.innerHTML = '<div class="top-progress-fill"></div>';
    document.body.appendChild(bar);
    let timer = null;
    window._startTopProgress = function() {
        clearTimeout(timer);
        bar.classList.remove('done');
        bar.classList.add('active');
    };
    window._doneTopProgress = function() {
        bar.classList.add('done');
        timer = setTimeout(function(){ bar.classList.remove('active','done'); }, 500);
    };
})();

window.Utils = {
    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>\"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
        }[char]));
    },
    storage: {
        get(key, fallback = null) {
            try {
                const value = localStorage.getItem(key);
                return value === null ? fallback : value;
            } catch (error) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, String(value));
                return true;
            } catch (error) {
                return false;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                return false;
            }
        },
        jsonGet(key, fallback = null) {
            try {
                const value = localStorage.getItem(key);
                return value === null ? fallback : JSON.parse(value);
            } catch (error) {
                return fallback;
            }
        },
        jsonSet(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                return false;
            }
        }
    },
    hitungStokProduk: function(produk) {
        if (!produk.resep || produk.resep.length === 0) {
            return produk.useStock ? produk.stock : null;
        }
        let maxPorsi = Infinity;
        for (let i = 0; i < produk.resep.length; i++) {
            let bahan = produk.resep[i];
            let bahanData = window.state.rawMaterials.find(function(b){ return b.id === bahan.bahanId; });
            if (!bahanData) return 0;
            maxPorsi = Math.min(maxPorsi, Math.floor(bahanData.stock / bahan.qty));
        }
        return maxPorsi;
    },

    formatRupiah: function(num) {
        return new Intl.NumberFormat("id-ID").format(num || 0);
    },

    formatInputRupiah: function(input) {
        let value = input.value.replace(/\D/g, "");
        if (!value) { input.value = ""; return; }
        input.value = new Intl.NumberFormat("id-ID").format(parseInt(value));
    },

    setButtonLoading: function(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn._originalHTML     = btn.innerHTML;
            btn._originalDisabled = btn.disabled;
            btn.disabled = true;
            btn.classList.add('btn-loading-disabled');
            btn.innerHTML = '<span class="btn-dots-loader"><span></span><span></span><span></span></span>';
        } else {
            if (btn._originalHTML !== undefined) {
                btn.innerHTML = btn._originalHTML;
                btn.disabled  = btn._originalDisabled || false;
                delete btn._originalHTML;
                delete btn._originalDisabled;
            }
            btn.classList.remove('btn-loading-disabled');
        }
    },

    getFriendlyError: function(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
        const code = String(error?.code || '').replace(/^auth\//, '').replace(/^firestore\//, '').replace(/^storage\//, '');
        if (code === 'SHIFT_ALREADY_ACTIVE') return 'Sudah ada shift aktif untuk akun ini.';
        if (code === 'SHIFT_CLOSED') return 'Shift sudah ditutup di perangkat lain.';
        if (code === 'SHIFT_ALREADY_CLOSED') return 'Shift sudah ditutup sebelumnya.';
        const map = {
            
            'invalid-credential': 'Email atau password salah.',
            'invalid-login-credentials': 'Email atau password salah.',
            'user-not-found': 'Akun tidak ditemukan.',
            'wrong-password': 'Email atau password salah.',
            'invalid-email': 'Format email tidak valid.',
            'user-disabled': 'Akun ini dinonaktifkan. Hubungi administrator.',
            'too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
            'network-request-failed': 'Koneksi internet bermasalah. Periksa koneksi Anda lalu coba lagi.',
            'operation-not-allowed': 'Metode login ini belum diaktifkan.',
            'email-already-in-use': 'Email tersebut sudah digunakan oleh akun lain.',
            'weak-password': 'Password terlalu lemah. Gunakan password yang lebih kuat.',
            'requires-recent-login': 'Silakan login kembali untuk melanjutkan.',
            'account-exists-with-different-credential': 'Email tersebut sudah terdaftar dengan metode login lain.',
            
            'permission-denied': 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
            'unauthenticated': 'Sesi login telah berakhir. Silakan login kembali.',
            'not-found': 'Data yang diminta tidak ditemukan.',
            'already-exists': 'Data tersebut sudah ada.',
            'failed-precondition': 'Tindakan tidak dapat dilakukan saat ini. Periksa kondisi data lalu coba lagi.',
            'unavailable': 'Layanan sedang tidak tersedia. Periksa koneksi lalu coba lagi.',
            'deadline-exceeded': 'Permintaan terlalu lama. Periksa koneksi lalu coba lagi.',
            'resource-exhausted': 'Layanan sedang sibuk. Coba lagi beberapa saat lagi.',
            
            'notallowederror': 'Akses perangkat ditolak. Periksa izin perangkat lalu coba lagi.',
            'securityerror': 'Akses perangkat tidak diizinkan oleh browser.',
            'networkerror': 'Koneksi jaringan bermasalah. Coba lagi.',
            'aborterror': 'Proses dibatalkan.',
        };
        const key = code.toLowerCase();
        if (map[key]) return map[key];

        const message = String(error?.message || '').trim();
        if (/Firebase:\s*The supplied auth credential is incorrect/i.test(message) || /auth\/(invalid-credential|invalid-login-credentials|wrong-password)/i.test(message)) {
            return 'Email atau password salah.';
        }
        if (/permission[- ]denied/i.test(message)) return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
        if (/network|offline|failed to fetch/i.test(message)) return 'Koneksi internet bermasalah. Periksa koneksi Anda lalu coba lagi.';

        return fallback;
    },

    showToast: function(message, type) {
        type = type || 'success';
        let icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
            error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
            info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        };
        let colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
        let icon  = icons[type]  || icons.info;
        let color = colors[type] || colors.info;

        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        let toast = document.createElement('div');
        toast.className = 'app-toast app-toast-' + type;
        toast.innerHTML =
            '<span class="app-toast-icon" style="color:' + color + '">' + icon + '</span>' +
            '<span class="app-toast-msg">' + message + '</span>' +
            '<span class="app-toast-progress" style="--toast-color:' + color + '"></span>';
        container.appendChild(toast);

        requestAnimationFrame(function(){
            requestAnimationFrame(function(){ toast.classList.add('show'); });
        });

        setTimeout(function(){
            toast.classList.add('hide');
            toast.addEventListener('transitionend', function(){ toast.remove(); }, { once: true });
        }, 3000);
    },

    showConfirm: async function(message) {
        let result = await Swal.fire({
            title: 'Konfirmasi',
            text: message,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: _cssVar('--swal-confirm'),
            cancelButtonColor:  _cssVar('--swal-cancel'),
            confirmButtonText: 'Ya, Lanjutkan',
            cancelButtonText: 'Batal',
            background: _cssVar('--swal-bg'),
            color:      _cssVar('--swal-text'),
            backdrop:   _cssVar('--swal-backdrop'),
            customClass: { popup: 'swal2-is-konfirmasi' }
        });
        return result.isConfirmed;
    },

    showModal: async function(options) {
        window._modalAction = 'cancel';
        let nonCancelBtns = (options.buttons || []).filter(function(b){ return b.action !== 'cancel'; });
        let cancelBtn     = (options.buttons || []).find(function(b){ return b.action === 'cancel'; });
        let primaryBtn    = nonCancelBtns[0];
        let footerBtns    = nonCancelBtns.slice(1).map(function(b) {
            let cls = b.class || '';
            let act = b.action;
            let extra = b.onClick
                ? "const _ob=(options.buttons||[]).find(x=>x.action==='" + act + "');if(_ob&&_ob.onClick)_ob.onClick();"
                : '';
            return '<button class="swal2-confirm swal2-styled swal-action-btn ' + cls + '"'
                + ' onclick="window._modalAction=\'' + act + '\';Swal.clickConfirm();">' + b.text + '</button>';
        }).join('');

        let result = await Swal.fire({
            title: options.title,
            html: options.content + (footerBtns ? '<div class="swal-footer-btns">' + footerBtns + '</div>' : ''),
            icon: options.icon || undefined,
            showCancelButton:   !!cancelBtn,
            showConfirmButton:  !!primaryBtn,
            confirmButtonText:  primaryBtn ? primaryBtn.text : 'Simpan',
            cancelButtonText:   cancelBtn  ? cancelBtn.text  : 'Batal',
            confirmButtonColor: _cssVar('--swal-confirm'),
            cancelButtonColor:  _cssVar('--swal-cancel'),
            background: _cssVar('--swal-bg'),
            color:      _cssVar('--swal-text'),
            backdrop:   _cssVar('--swal-backdrop'),
            customClass: { popup: options.customClass || 'swal2-is-modal' },
            preConfirm: function() {
                if (window._modalAction === 'cancel') window._modalAction = (primaryBtn && primaryBtn.action) || 'save';
                let btn = (options.buttons || []).find(function(b){ return b.action === window._modalAction; });
                if (btn && btn.onClick) btn.onClick();
                return true;
            }
        });
        let action = result.isConfirmed ? window._modalAction : 'cancel';
        delete window._modalAction;
        return action;
    },

    pinModalActions: function(modal) {
        if (!modal) return modal;
        let box = modal.querySelector('.modal');
        if (!box) return modal;
        let header = box.querySelector(':scope > .modal-header');
        let title = header ? header.querySelector('h3') : box.querySelector(':scope > h3, .modal-menu-detail-body > h3');
        let actions = box.querySelector(':scope > .modal-actions, :scope > .modal-menu-footer, :scope > .modal-footer-actions, :scope > .modal-body > .modal-footer-inline, .modal-menu-detail-body > .modal-menu-footer');
        if (!title || !actions) return modal;
        if (!header) {
            header = document.createElement('div');
            header.className = 'modal-header';
            title.parentNode.insertBefore(header, title);
            header.appendChild(title);
        }
        header.classList.add('modal-header-actions');
        header.appendChild(actions);
        header.querySelectorAll('.btn-icon-sm').forEach(function(btn) {
            if (btn !== actions && !actions.contains(btn)) btn.remove();
        });
        box.classList.add('modal-top-actions');
        return modal;
    },

    showPrompt: async function(message, defaultValue, customClass) {
        defaultValue = defaultValue || '';
        let result = await Swal.fire({
            title: message,
            input: 'text',
            inputValue: defaultValue,
            showCancelButton: true,
            confirmButtonColor: _cssVar('--swal-confirm'),
            cancelButtonColor:  _cssVar('--swal-cancel'),
            confirmButtonText: 'OK',
            cancelButtonText: 'Batal',
            background: _cssVar('--swal-bg'),
            color:      _cssVar('--swal-text'),
            backdrop:   _cssVar('--swal-backdrop'),
            customClass: { popup: customClass || 'swal2-is-konfirmasi' },
            inputValidator: function(value) {
                if (!value) return 'Input tidak boleh kosong';
            }
        });
        if (result.isConfirmed) return result.value;
        return null;
    }
};
