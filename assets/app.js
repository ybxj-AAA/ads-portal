/* 广告投放中心 — 页面交互与密钥校验 */
(function () {
  'use strict';

  var TG = 'tg7879';
  var TG_URL = 'https://t.me/' + TG;
  var SESSION_KEY = 'ads.key.session';

  /* ---------- SHA-256（不依赖 crypto.subtle，本地 file:// 也能验） ---------- */

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    var len = bytes.length;
    var total = ((len + 9 + 63) >> 6) << 6;
    var buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;
    var dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor((len * 8) / 4294967296), false);
    dv.setUint32(total - 4, (len * 8) >>> 0, false);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Uint32Array(64);

    for (var off = 0; off < total; off += 64) {
      for (var t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4, false);
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    return H.map(function (n) { return ('00000000' + n.toString(16)).slice(-8); }).join('');
  }

  /* ---------- 密钥 ---------- */

  function normalizeKey(raw) {
    var s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.indexOf('ADS') === 0) s = s.slice(3);
    if (s.length !== 16) return '';
    return 'ADS-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16);
  }

  function parseDate(iso) {
    var p = String(iso || '').split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function validateKey(raw) {
    var key = normalizeKey(raw);
    if (!key) {
      return Promise.resolve({ status: 'format', key: '' });
    }
    var items = (window.ADS_KEYS && window.ADS_KEYS.items) || [];
    var hash = sha256Hex(key);
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].h === hash) { item = items[i]; break; }
    }
    if (!item) return Promise.resolve({ status: 'invalid', key: key });

    var issued = parseDate(item.issued) || today();
    var exp = new Date(issued.getTime());
    exp.setDate(exp.getDate() + Number(item.days || 0));
    var now = today();

    if (now.getTime() > exp.getTime()) {
      return Promise.resolve({ status: 'expired', key: key, plan: item.plan, expiresAt: exp });
    }

    return Promise.resolve({
      status: 'ok',
      key: key,
      plan: item.plan,
      expiresAt: exp,
      daysLeft: Math.max(1, Math.ceil((exp.getTime() - now.getTime()) / 86400000)),
      permanent: Number(item.days) >= 36500,
      hash: hash
    });
  }

  function fmtDate(d) {
    if (!d) return '';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function saveSession(res) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        h: res.hash, plan: res.plan, exp: fmtDate(res.expiresAt), perm: !!res.permanent
      }));
    } catch (e) { /* 隐私模式忽略 */ }
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s.perm) return s;
      var exp = parseDate(s.exp);
      if (!exp || today().getTime() > exp.getTime()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- 弹窗 ---------- */

  var modal, modalInput, modalMsg, modalClose, onSuccess;

  function openModal() {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    if (modalInput) {
      modalInput.value = '';
      setTimeout(function () { modalInput.focus(); }, 60);
    }
    if (modalMsg) { modalMsg.className = 'modal-msg'; modalMsg.textContent = ''; }
    document.documentElement.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  function showMsg(type, text) {
    if (!modalMsg) return;
    modalMsg.className = 'modal-msg is-' + type;
    modalMsg.innerHTML = text;
  }

  function bindModal() {
    modal = document.querySelector('[data-key-modal]');
    if (!modal) return;
    modalInput = modal.querySelector('[data-key-input]');
    modalMsg = modal.querySelector('[data-key-msg]');
    modalClose = modal.querySelector('[data-modal-close]');

    document.querySelectorAll('[data-key-open]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    modalClose && modalClose.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    var submit = modal.querySelector('[data-key-submit]');
    var form = modal.querySelector('form');

    function run() {
      var value = modalInput ? modalInput.value : '';
      if (!normalizeKey(value)) {
        showMsg('error', '格式不对。密钥形如 <span class="mono">ADS-XXXX-XXXX-XXXX-XXXX</span>，检查一下有没有漏字符。');
        return;
      }
      validateKey(value).then(function (res) {
        if (res.status === 'ok') {
          saveSession(res);
          showMsg('ok', '密钥有效：' + res.plan + '，' + (res.permanent ? '长期有效。' : '到期 ' + fmtDate(res.expiresAt) + '。'));
          setTimeout(function () {
            closeModal();
            if (typeof onSuccess === 'function') onSuccess(res);
            else window.location.href = 'publish.html';
          }, 650);
        } else if (res.status === 'expired') {
          showMsg('error', '这个密钥已经过期了（' + fmtDate(res.expiresAt) + ' 到期）。续期找 TG <a class="tg-link" href="' + TG_URL + '" target="_blank" rel="noopener">@' + TG + '</a>。');
        } else {
          showMsg('error', '密钥无效。可能是输错了，或者这个密钥已经作废。购买/续期找 TG <a class="tg-link" href="' + TG_URL + '" target="_blank" rel="noopener">@' + TG + '</a>。');
        }
      });
    }

    submit && submit.addEventListener('click', function (e) { e.preventDefault(); run(); });
    form && form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  }

  /* ---------- 页面初始化 ---------- */

  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  function initClickCount() {
    var grid = document.querySelector('[data-ad-grid]');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="go.html"]');
      if (!a) return;
      var card = a.closest('[data-ad-id]');
      if (!card) return;
      try {
        var k = 'adclick:' + card.getAttribute('data-ad-id');
        localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || '0', 10) + 1));
      } catch (err) { /* ignore */ }
    });
  }

  function initPublish() {
    var main = document.querySelector('[data-publish]');
    if (!main) return;

    var statusWrap = document.querySelector('[data-key-status]');
    var planEl = document.querySelector('[data-key-plan]');
    var expEl = document.querySelector('[data-key-exp]');
    var resetBtn = document.querySelector('[data-key-reset]');

    function unlock(session) {
      main.classList.remove('is-locked');
      main.classList.add('is-unlocked');
      if (statusWrap) {
        if (planEl) planEl.textContent = session.plan || '已授权';
        if (expEl) expEl.textContent = session.perm ? '长期有效' : (session.exp ? '有效期至 ' + session.exp : '');
      }
    }

    function lock() {
      main.classList.add('is-locked');
      main.classList.remove('is-unlocked');
    }

    var session = readSession();
    if (session) unlock(session); else lock();

    resetBtn && resetBtn.addEventListener('click', function () {
      clearSession();
      lock();
      openModal();
    });

    onSuccess = function (res) { unlock(res); };
    bindModal();

    // 支持 publish.html?key=1 直接弹密钥框（方便从 TG 发链接过来）
    if (/[?&]key=1\b/.test(location.search)) openModal();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initYear();
    initClickCount();
    if (document.querySelector('[data-publish]')) {
      initPublish();
    } else {
      bindModal();
    }
  });

  window.ADS = {
    validateKey: validateKey,
    normalizeKey: normalizeKey,
    fmtDate: fmtDate,
    openModal: openModal,
    closeModal: closeModal,
    readSession: readSession,
    clearSession: clearSession,
    TG: TG,
    TG_URL: TG_URL
  };
})();
