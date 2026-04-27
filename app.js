// ===================================
// NUMPANG NGOPI CRB · APP.JS
// Firebase Realtime Database
// ===================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase, ref, push, set, onValue, remove, update, query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHQVYVE9q4he_Lzmv7xvr3DQHA0PTNsIc",
  authDomain: "numpang-ngopi-crbn.firebaseapp.com",
  databaseURL: "https://numpang-ngopi-crbn-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "numpang-ngopi-crbn",
  storageBucket: "numpang-ngopi-crbn.firebasestorage.app",
  messagingSenderId: "283292584863",
  appId: "1:283292584863:web:4b68acd0f1f02625108baa",
  measurementId: "G-7B6LKL6806"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);

// ===================================
// STATE
// ===================================
let menus = {};
let transactions = {};
let cart = {}; // { menuId: { ...menuData, qty } }
let currentPage = 'dashboard';
let menuSearchQ = '';
let trxSearchQ = '';
let menuCatFilter = 'all';
let trxCatFilter = 'all';
let cartOpen = true;
let editingMenuId = null;

// ===================================
// UTILS
// ===================================
const fmt = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStr() {
  return new Date().toISOString().slice(0, 7);
}
function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function dateStr(ts) {
  return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ===================================
// CLOCK
// ===================================
function startClock() {
  const el = document.getElementById('clock');
  function tick() {
    el.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

// ===================================
// THEME
// ===================================
let isDark = true;
document.getElementById('themeToggle').addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Restore theme
const savedTheme = localStorage.getItem('theme') || 'dark';
isDark = savedTheme === 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';

// ===================================
// NAVIGATION
// ===================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    navigateTo(page);
  });
});

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add('active');
  if (page === 'transaksi') renderTrxMenu();
  if (page === 'dashboard') renderDashboard();
}

// ===================================
// FIREBASE LISTENERS
// ===================================
onValue(ref(db, 'menus'), snap => {
  menus = snap.val() || {};
  renderMenuList();
  renderCategoryTabs();
  if (currentPage === 'transaksi') renderTrxMenu();
  if (currentPage === 'dashboard') renderDashboard();
});

onValue(ref(db, 'transactions'), snap => {
  transactions = snap.val() || {};
  if (currentPage === 'dashboard') renderDashboard();
});

// ===================================
// DASHBOARD
// ===================================
function renderDashboard() {
  const today = todayStr();
  const month = monthStr();

  document.getElementById('today-date').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  let todayIncome = 0, todayCount = 0, monthIncome = 0;
  const recentTrx = [];
  const menuSales = {};

  Object.values(transactions).forEach(trx => {
    const d = trx.date?.slice(0, 10);
    const m = trx.date?.slice(0, 7);
    if (d === today) { todayIncome += trx.total || 0; todayCount++; }
    if (m === month) monthIncome += trx.total || 0;
    recentTrx.push(trx);
    // count menu sales
    if (trx.items) {
      Object.values(trx.items).forEach(item => {
        menuSales[item.name] = (menuSales[item.name] || 0) + item.qty;
        if (!menuSales[item.name + '_emoji']) menuSales[item.name + '_emoji'] = item.emoji;
      });
    }
  });

  document.getElementById('stat-today').textContent = fmt(todayIncome);
  document.getElementById('stat-trx').textContent = todayCount;
  document.getElementById('stat-menu').textContent = Object.keys(menus).length;
  document.getElementById('stat-month').textContent = fmt(monthIncome);

  // Recent 5
  recentTrx.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const recent5 = recentTrx.slice(0, 5);
  const recentEl = document.getElementById('recent-trx-list');
  if (!recent5.length) {
    recentEl.innerHTML = '<div class="empty-state">Belum ada transaksi</div>';
  } else {
    recentEl.innerHTML = recent5.map(t => `
      <div class="trx-mini-item">
        <div class="trx-mini-left">
          <span class="trx-mini-name">${t.note || 'Pelanggan'}</span>
          <span class="trx-mini-time">${timeStr(t.ts)} · ${dateStr(t.ts)}</span>
        </div>
        <span class="trx-mini-amount">${fmt(t.total)}</span>
      </div>
    `).join('');
  }

  // Top menu
  const sorted = Object.entries(menuSales)
    .filter(([k]) => !k.endsWith('_emoji'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topEl = document.getElementById('top-menu-list');
  if (!sorted.length) {
    topEl.innerHTML = '<div class="empty-state">Belum ada data</div>';
  } else {
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    topEl.innerHTML = sorted.map(([name, qty], i) => `
      <div class="top-menu-item">
        <span class="top-menu-rank">${medals[i] || i + 1}</span>
        <span class="top-menu-emoji">${menuSales[name + '_emoji'] || '🍴'}</span>
        <div class="top-menu-info">
          <div class="top-menu-name">${name}</div>
          <div class="top-menu-count">${qty} terjual</div>
        </div>
      </div>
    `).join('');
  }
}

// ===================================
// MENU MANAGEMENT
// ===================================
function getCategories() {
  const cats = new Set();
  Object.values(menus).forEach(m => { if (m.category) cats.add(m.category); });
  return ['all', ...cats];
}

function renderCategoryTabs() {
  const cats = getCategories();
  const tabs = document.getElementById('categoryTabs');
  tabs.innerHTML = cats.map(c =>
    `<button class="cat-tab ${c === menuCatFilter ? 'active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'Semua' : c}
    </button>`
  ).join('');
  tabs.querySelectorAll('.cat-tab').forEach(t => {
    t.addEventListener('click', () => {
      menuCatFilter = t.dataset.cat;
      renderCategoryTabs();
      renderMenuList();
    });
  });
}

function renderMenuList() {
  const el = document.getElementById('menuList');
  const items = Object.entries(menus).filter(([, m]) => {
    const matchSearch = !menuSearchQ || m.name?.toLowerCase().includes(menuSearchQ);
    const matchCat = menuCatFilter === 'all' || m.category === menuCatFilter;
    return matchSearch && matchCat;
  });

  if (!items.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Menu kosong</div>';
    return;
  }

  el.innerHTML = items.map(([id, m]) => `
    <div class="menu-card ${m.available === false ? 'unavailable' : ''}">
      <div class="menu-emoji">${m.emoji || '🍴'}</div>
      <div class="menu-cat">${m.category || ''}</div>
      <div class="menu-name">${m.name}</div>
      <div class="menu-price">${fmt(m.price)}</div>
      ${m.available === false ? '<span class="unavail-tag">Habis</span>' : ''}
      <div class="menu-actions">
        <button class="menu-btn" onclick="openEditMenu('${id}')">✏️</button>
        <button class="menu-btn del" onclick="deleteMenu('${id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('menuSearch').addEventListener('input', e => {
  menuSearchQ = e.target.value.toLowerCase().trim();
  renderMenuList();
});

// ADD / EDIT MENU
document.getElementById('btnAddMenu').addEventListener('click', () => {
  editingMenuId = null;
  document.getElementById('menuModalTitle').textContent = 'Tambah Menu';
  document.getElementById('menuId').value = '';
  document.getElementById('menuName').value = '';
  document.getElementById('menuCategory').value = '';
  document.getElementById('menuPrice').value = '';
  document.getElementById('menuEmoji').value = '☕';
  document.getElementById('menuDesc').value = '';
  document.getElementById('menuAvailable').checked = true;
  document.getElementById('menuModal').classList.remove('hidden');
});

window.openEditMenu = function (id) {
  const m = menus[id];
  if (!m) return;
  editingMenuId = id;
  document.getElementById('menuModalTitle').textContent = 'Edit Menu';
  document.getElementById('menuId').value = id;
  document.getElementById('menuName').value = m.name || '';
  document.getElementById('menuCategory').value = m.category || '';
  document.getElementById('menuPrice').value = m.price || '';
  document.getElementById('menuEmoji').value = m.emoji || '☕';
  document.getElementById('menuDesc').value = m.desc || '';
  document.getElementById('menuAvailable').checked = m.available !== false;
  document.getElementById('menuModal').classList.remove('hidden');
};

function closeMenuModal() {
  document.getElementById('menuModal').classList.add('hidden');
}
document.getElementById('closeMenuModal').addEventListener('click', closeMenuModal);
document.getElementById('cancelMenuModal').addEventListener('click', closeMenuModal);

document.getElementById('saveMenuBtn').addEventListener('click', async () => {
  const name = document.getElementById('menuName').value.trim();
  const category = document.getElementById('menuCategory').value.trim();
  const price = parseInt(document.getElementById('menuPrice').value);
  const emoji = document.getElementById('menuEmoji').value.trim() || '☕';
  const desc = document.getElementById('menuDesc').value.trim();
  const available = document.getElementById('menuAvailable').checked;

  if (!name || !price) { showToast('Nama & harga wajib diisi!', 'error'); return; }

  const data = { name, category, price, emoji, desc, available };

  try {
    if (editingMenuId) {
      await update(ref(db, 'menus/' + editingMenuId), data);
      showToast('Menu diperbarui ✓', 'success');
    } else {
      await push(ref(db, 'menus'), data);
      showToast('Menu ditambahkan ✓', 'success');
    }
    closeMenuModal();
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message, 'error');
  }
});

window.deleteMenu = async function (id) {
  if (!confirm('Hapus menu ini?')) return;
  try {
    await remove(ref(db, 'menus/' + id));
    showToast('Menu dihapus', '');
  } catch (e) {
    showToast('Gagal hapus: ' + e.message, 'error');
  }
};

// ===================================
// TRANSAKSI - MENU GRID
// ===================================
function getTrxCategories() {
  const cats = new Set();
  Object.values(menus).forEach(m => { if (m.category) cats.add(m.category); });
  return ['all', ...cats];
}

function renderTrxCategoryTabs() {
  const cats = getTrxCategories();
  const tabs = document.getElementById('trxCategoryTabs');
  tabs.innerHTML = cats.map(c =>
    `<button class="cat-tab ${c === trxCatFilter ? 'active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'Semua' : c}
    </button>`
  ).join('');
  tabs.querySelectorAll('.cat-tab').forEach(t => {
    t.addEventListener('click', () => {
      trxCatFilter = t.dataset.cat;
      renderTrxMenu();
    });
  });
}

function renderTrxMenu() {
  renderTrxCategoryTabs();
  const el = document.getElementById('trxMenuList');
  const items = Object.entries(menus).filter(([, m]) => {
    if (m.available === false) return false;
    const matchSearch = !trxSearchQ || m.name?.toLowerCase().includes(trxSearchQ);
    const matchCat = trxCatFilter === 'all' || m.category === trxCatFilter;
    return matchSearch && matchCat;
  });

  if (!items.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Tidak ada menu</div>';
    return;
  }

  el.innerHTML = items.map(([id, m]) => {
    const qty = cart[id]?.qty || 0;
    return `
      <div class="trx-menu-card ${qty > 0 ? 'in-cart' : ''}" onclick="addToCart('${id}')">
        ${qty > 0 ? `<div class="qty-badge">${qty}</div>` : ''}
        <div class="menu-emoji">${m.emoji || '🍴'}</div>
        <div class="menu-cat">${m.category || ''}</div>
        <div class="menu-name">${m.name}</div>
        <div class="menu-price">${fmt(m.price)}</div>
      </div>
    `;
  }).join('');
}

document.getElementById('trxSearch').addEventListener('input', e => {
  trxSearchQ = e.target.value.toLowerCase().trim();
  renderTrxMenu();
});

// ===================================
// CART
// ===================================
window.addToCart = function (id) {
  const m = menus[id];
  if (!m) return;
  if (cart[id]) {
    cart[id].qty++;
  } else {
    cart[id] = { ...m, qty: 1 };
  }
  renderCart();
  renderTrxMenu();
};

function removeFromCart(id) {
  if (!cart[id]) return;
  cart[id].qty--;
  if (cart[id].qty <= 0) delete cart[id];
  renderCart();
  renderTrxMenu();
}

function renderCart() {
  const items = Object.entries(cart);
  const totalItems = items.reduce((s, [, v]) => s + v.qty, 0);
  const total = items.reduce((s, [, v]) => s + v.price * v.qty, 0);

  document.getElementById('cartCount').textContent = totalItems + ' item';
  document.getElementById('cartCountBadge').textContent = totalItems;
  document.getElementById('cartTotal').textContent = fmt(total);

  if (!items.length) {
    document.getElementById('cartItems').innerHTML = '<div class="empty-state" style="padding:12px 0">Keranjang kosong</div>';
    return;
  }

  document.getElementById('cartItems').innerHTML = items.map(([id, item]) => `
    <div class="cart-item">
      <span class="cart-item-emoji">${item.emoji || '🍴'}</span>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fmt(item.price)} × ${item.qty} = ${fmt(item.price * item.qty)}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" onclick="removeCartItem('${id}')">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="addToCart('${id}')">+</button>
      </div>
    </div>
  `).join('');
}

window.removeCartItem = removeFromCart;

// Cart toggle
document.getElementById('cartToggle').addEventListener('click', () => {
  cartOpen = !cartOpen;
  const panel = document.getElementById('cartPanel');
  if (cartOpen) {
    panel.classList.remove('collapsed');
  } else {
    panel.classList.add('collapsed');
  }
});

// ===================================
// CHECKOUT
// ===================================
document.getElementById('btnCheckout').addEventListener('click', () => {
  const items = Object.values(cart);
  if (!items.length) { showToast('Keranjang masih kosong!', 'error'); return; }

  const total = items.reduce((s, v) => s + v.price * v.qty, 0);
  document.getElementById('checkoutTotal').textContent = fmt(total);
  document.getElementById('payAmount').value = '';
  document.getElementById('kembalianRow').classList.add('hidden');

  document.getElementById('checkoutItems').innerHTML = items.map(v => `
    <div class="checkout-item">
      <span>${v.emoji || ''} ${v.name} × ${v.qty}</span>
      <span>${fmt(v.price * v.qty)}</span>
    </div>
  `).join('');

  document.getElementById('checkoutModal').classList.remove('hidden');
});

document.getElementById('payAmount').addEventListener('input', e => {
  const total = Object.values(cart).reduce((s, v) => s + v.price * v.qty, 0);
  const pay = parseInt(e.target.value) || 0;
  const kembalian = pay - total;
  const row = document.getElementById('kembalianRow');
  if (pay >= total) {
    row.classList.remove('hidden');
    document.getElementById('kembalianAmt').textContent = fmt(kembalian);
  } else {
    row.classList.add('hidden');
  }
});

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.add('hidden');
}
document.getElementById('closeCheckoutModal').addEventListener('click', closeCheckoutModal);
document.getElementById('cancelCheckout').addEventListener('click', closeCheckoutModal);

document.getElementById('confirmPayBtn').addEventListener('click', async () => {
  const total = Object.values(cart).reduce((s, v) => s + v.price * v.qty, 0);
  const pay = parseInt(document.getElementById('payAmount').value) || 0;
  if (pay < total) { showToast('Jumlah bayar kurang!', 'error'); return; }

  const note = document.getElementById('cartNote').value.trim();
  const trxData = {
    ts: Date.now(),
    date: new Date().toISOString(),
    total,
    pay,
    kembalian: pay - total,
    note: note || 'Pelanggan',
    items: Object.entries(cart).reduce((acc, [, v]) => {
      acc[v.name.replace(/\s/g, '_')] = { name: v.name, emoji: v.emoji || '', price: v.price, qty: v.qty };
      return acc;
    }, {})
  };

  try {
    await push(ref(db, 'transactions'), trxData);
    cart = {};
    renderCart();
    renderTrxMenu();
    closeCheckoutModal();
    document.getElementById('cartNote').value = '';
    showToast('Transaksi berhasil! ✓', 'success');
  } catch (e) {
    showToast('Gagal simpan transaksi: ' + e.message, 'error');
  }
});

// ===================================
// LAPORAN
// ===================================
const today = new Date().toISOString().slice(0, 10);
document.getElementById('reportDate').value = today;

document.getElementById('btnLoadReport').addEventListener('click', loadReport);

function loadReport() {
  const type = document.getElementById('reportType').value;
  const dateVal = document.getElementById('reportDate').value;

  let income = 0, count = 0;
  const matched = [];

  Object.values(transactions).forEach(trx => {
    const d = trx.date?.slice(0, 10);
    const m = trx.date?.slice(0, 7);
    const match = type === 'daily' ? d === dateVal : m === dateVal?.slice(0, 7);
    if (match) {
      income += trx.total || 0;
      count++;
      matched.push(trx);
    }
  });

  matched.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  document.getElementById('rep-income').textContent = fmt(income);
  document.getElementById('rep-count').textContent = count;

  const el = document.getElementById('reportList');
  if (!matched.length) {
    el.innerHTML = '<div class="empty-state">Tidak ada transaksi pada periode ini</div>';
    return;
  }

  el.innerHTML = matched.map(t => {
    const itemsStr = t.items
      ? Object.values(t.items).map(i => `${i.emoji} ${i.name}×${i.qty}`).join(', ')
      : '';
    return `
      <div class="report-trx-item">
        <div class="report-trx-top">
          <span class="report-trx-time">${timeStr(t.ts)} · ${dateStr(t.ts)}</span>
          <span class="report-trx-total">${fmt(t.total)}</span>
        </div>
        <div class="report-trx-note">👤 ${t.note || 'Pelanggan'}</div>
        <div class="report-trx-items">${itemsStr}</div>
      </div>
    `;
  }).join('');
}

// ===================================
// INIT
// ===================================
window.addEventListener('DOMContentLoaded', () => {
  // Splash hide after 2.5s
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
  }, 2500);

  startClock();
  renderCart();

  // Date header update
  setInterval(() => {
    const el = document.getElementById('today-date');
    if (el) el.textContent = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }, 60000);
});
