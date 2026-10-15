(function() {
  const ACK_TIMEOUT = 1500;
  const GET_TIMEOUT = 2500;
  let pending = 0;
  let renderTimer = null;

  function badge() {
    let el = document.getElementById('sync-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sync-status';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    return el;
  }

  function renderBadge() {
    const el = badge();
    const offline = !navigator.onLine;
    if (!offline && pending === 0) {
      el.classList.remove('visible');
      return;
    }
    el.classList.toggle('offline', offline);
    el.textContent = offline
      ? `Offline${pending > 0 ? ` · ${pending} perubahan menunggu sinkron` : ''}`
      : `Menyinkronkan ${pending} perubahan...`;
    el.classList.add('visible');
  }

  function updateBadge() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderBadge, 400);
  }

  function acknowledge(write, result) {
    pending++;
    updateBadge();
    let queued = false;
    const finish = () => {
      pending = Math.max(0, pending - 1);
      updateBadge();
    };
    write.then(finish, error => {
      finish();
      if (queued) Utils.showToast(Utils.getFriendlyError(error, 'Sebagian data offline gagal disinkronkan.'), 'error');
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        queued = true;
        resolve(result);
      }, ACK_TIMEOUT);
      write.then(() => {
        clearTimeout(timer);
        resolve(result);
      }, error => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  const docProto = Object.getPrototypeOf(dbCloud.doc('_sync/_probe'));
  const collectionProto = Object.getPrototypeOf(dbCloud.collection('_sync'));
  const batchProto = Object.getPrototypeOf(dbCloud.batch());
  const originalSet = docProto.set;

  ['set', 'update', 'delete'].forEach(name => {
    const original = docProto[name];
    docProto[name] = function(...args) {
      return acknowledge(original.apply(this, args));
    };
  });

  collectionProto.add = function(data) {
    const ref = this.doc();
    return acknowledge(originalSet.call(ref, data), ref);
  };

  const originalCommit = batchProto.commit;
  batchProto.commit = function(...args) {
    return acknowledge(originalCommit.apply(this, args));
  };

  Utils.fastGet = async function(ref) {
    try {
      return await Promise.race([
        ref.get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('GET_TIMEOUT')), GET_TIMEOUT))
      ]);
    } catch (error) {
      return ref.get({ source: 'cache' });
    }
  };

  window.addEventListener('online', updateBadge);
  window.addEventListener('offline', updateBadge);

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    if (document.documentElement.dataset.persistenceFallback === 'true') {
      Utils.showToast('Penyimpanan offline tidak aktif di browser ini. Transaksi offline bisa hilang jika aplikasi ditutup.', 'warning');
    }
    pending++;
    updateBadge();
    dbCloud.waitForPendingWrites().catch(() => { }).then(() => {
      pending = Math.max(0, pending - 1);
      updateBadge();
    });
  });

  updateBadge();
})();
