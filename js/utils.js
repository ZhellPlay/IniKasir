const listeners = [];

function addListener(unsubscribe) { listeners.push(unsubscribe); }
function cleanupListeners() { listeners.forEach(function(u){ u(); }); listeners.length = 0; }
function _cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

(function _initTopProgress() {
    var bar = document.createElement('div');
    bar.id = 'top-progress-bar';
    bar.innerHTML = '<div class="top-progress-fill"></div>';
    document.body.appendChild(bar);
    var timer = null;
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
    hitungStokProduk: function(produk) {
        if (!produk.resep || produk.resep.length === 0) {
            return produk.useStock ? produk.stock : null;
        }
        var maxPorsi = Infinity;
        for (var i = 0; i < produk.resep.length; i++) {
            var bahan = produk.resep[i];
            var bahanData = window.state.rawMaterials.find(function(b){ return b.id === bahan.bahanId; });
            if (!bahanData) return 0;
            maxPorsi = Math.min(maxPorsi, Math.floor(bahanData.stock / bahan.qty));
        }
        return maxPorsi;
    },

    formatRupiah: function(num) {
        return new Intl.NumberFormat("id-ID").format(num || 0);
    },

    formatInputRupiah: function(input) {
        var value = input.value.replace(/\D/g, "");
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

    showToast: function(message, type) {
        type = type || 'success';
        var icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
            error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
            info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        };
        var colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
        var icon  = icons[type]  || icons.info;
        var color = colors[type] || colors.info;

        var container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        var toast = document.createElement('div');
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
        var result = await Swal.fire({
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
        var nonCancelBtns = (options.buttons || []).filter(function(b){ return b.action !== 'cancel'; });
        var cancelBtn     = (options.buttons || []).find(function(b){ return b.action === 'cancel'; });
        var primaryBtn    = nonCancelBtns[0];
        var footerBtns    = nonCancelBtns.slice(1).map(function(b) {
            var cls = b.class || '';
            var act = b.action;
            var extra = b.onClick
                ? "const _ob=(options.buttons||[]).find(x=>x.action==='" + act + "');if(_ob&&_ob.onClick)_ob.onClick();"
                : '';
            return '<button class="swal2-confirm swal2-styled swal-action-btn ' + cls + '"'
                + ' onclick="window._modalAction=\'' + act + '\';Swal.clickConfirm();">' + b.text + '</button>';
        }).join('');

        var result = await Swal.fire({
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
                var btn = (options.buttons || []).find(function(b){ return b.action === window._modalAction; });
                if (btn && btn.onClick) btn.onClick();
                return true;
            }
        });
        var action = result.isConfirmed ? window._modalAction : 'cancel';
        delete window._modalAction;
        return action;
    },

    showPrompt: async function(message, defaultValue, customClass) {
        defaultValue = defaultValue || '';
        var result = await Swal.fire({
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
