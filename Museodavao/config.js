// ================================================================
//  config.js  — Supabase client + shared utilities
//  Davao Heritage Museum
// ================================================================
//  HOW TO SETUP:
//  1. Go to https://supabase.com → your project → Settings → API
//  2. Copy "Project URL" into SUPABASE_URL below
//  3. Copy "anon / public" key into SUPABASE_ANON_KEY below
// ================================================================

const SUPABASE_URL = 'https://qblwrjhvpzyquhveurtg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QJ3XzNKkiCHeY8NYSHRvLQ_RyjvdGFg';

// ── initialise client ──────────────────────────────────────────
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── global state ───────────────────────────────────────────────
let currentUser = null;
let currentProfile = null;

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════
async function initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session?.user) await _setUser(session.user);

  _supabase.auth.onAuthStateChange(async (_evt, session) => {
    if (session?.user) {
      await _setUser(session.user);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    _updateNavUI();
  });

  _updateNavUI();
}

async function _setUser(user) {
  currentUser = user;
  const { data } = await _supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  currentProfile = data;
}

function _updateNavUI() {
  const loginBtn    = document.getElementById('btn-login');
  const registerBtn = document.getElementById('btn-register');
  const userMenu    = document.getElementById('user-menu');
  const userLabel   = document.getElementById('user-label');

  if (currentUser) {
    loginBtn?.classList.add('hidden');
    registerBtn?.classList.add('hidden');
    userMenu?.classList.remove('hidden');
    if (userLabel) userLabel.textContent = currentProfile?.full_name?.split(' ')[0] || currentUser.email.split('@')[0];
  } else {
    loginBtn?.classList.remove('hidden');
    registerBtn?.classList.remove('hidden');
    userMenu?.classList.add('hidden');
  }
}

async function authSignIn(email, password) {
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function authSignUp(email, password, fullName) {
  const { data, error } = await _supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  if (error) throw error;
  return data;
}

async function authSignOut() {
  await _supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  toast('Signed out successfully.', 'success');
  _updateNavUI();
}

function requireAuth(redirectMsg = 'Please sign in to continue.') {
  if (!currentUser) {
    toast(redirectMsg, 'warning');
    openModal('modal-auth');
    return false;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  CART  (localStorage — cleared on checkout)
// ══════════════════════════════════════════════════════════════
let cart = JSON.parse(localStorage.getItem('dhm_cart') || '[]');

function cartAdd(product) {
  if (!requireAuth('Sign in to add items to your cart.')) return;
  const existing = cart.find(c => c.id === product.id);
  if (existing) { existing.qty += 1; }
  else { cart.push({ ...product, qty: 1 }); }
  _cartSave();
  _cartUpdateBadge();
  toast(`"${product.name}" added to cart.`, 'success');
}

function cartRemove(id) {
  cart = cart.filter(c => c.id !== id);
  _cartSave(); _cartUpdateBadge(); _cartRenderSidebar();
}

function cartChangeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) return cartRemove(id);
  _cartSave(); _cartUpdateBadge(); _cartRenderSidebar();
}

function cartTotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function cartCount() {
  return cart.reduce((s, i) => s + i.qty, 0);
}

function _cartSave() {
  localStorage.setItem('dhm_cart', JSON.stringify(cart));
}

function _cartUpdateBadge() {
  const badge = document.getElementById('cart-badge');
  const n = cartCount();
  if (badge) { badge.textContent = n; badge.classList.toggle('hidden', n === 0); }
}

function _cartRenderSidebar() {
  const el = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!el) return;

  if (cart.length === 0) {
    el.innerHTML = `<div class="cart-empty"><span class="cart-empty-icon">🛒</span><p>Your cart is empty.</p><p>Browse our <a href="/pages/shop.html">Shop</a> to find something you love.</p></div>`;
  } else {
    el.innerHTML = cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-icon">${item.emoji || '🏺'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">₱${(item.price * item.qty).toLocaleString()}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="cartChangeQty('${item.id}', -1)">−</button>
            <span>${item.qty}</span>
            <button class="qty-btn" onclick="cartChangeQty('${item.id}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="cartRemove('${item.id}')" title="Remove">✕</button>
      </div>
    `).join('');
  }
  if (totalEl) totalEl.textContent = `₱${cartTotal().toLocaleString()}`;
}

// ══════════════════════════════════════════════════════════════
//  MODAL SYSTEM
// ══════════════════════════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
function toast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  t.innerHTML = `<span class="toast-icon">${icons[type] || '✓'}</span><span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ══════════════════════════════════════════════════════════════
//  RECEIPT GENERATOR
// ══════════════════════════════════════════════════════════════
function buildReceiptHTML(order) {
  const payIcons = { GCash: '📱', BPI: '🏦', BDO: '🏦', Metrobank: '🏦', UnionBank: '🏦', Maya: '💳' };
  return `
    <div class="receipt-sheet">
      <div class="receipt-head">
        <div class="receipt-logo">🏛️</div>
        <h2>Davao Heritage Museum</h2>
        <p>Official Purchase Receipt</p>
        <div class="receipt-meta">
          <span>Order #${order.order_number}</span>
          <span>${order.date}</span>
        </div>
      </div>
      <div class="receipt-buyer">
        <div class="receipt-field"><span>Customer</span><strong>${order.buyer_name}</strong></div>
        <div class="receipt-field"><span>Email</span><strong>${order.buyer_email}</strong></div>
        ${order.buyer_phone ? `<div class="receipt-field"><span>Phone</span><strong>${order.buyer_phone}</strong></div>` : ''}
      </div>
      <div class="receipt-items">
        <div class="receipt-items-header"><span>Item</span><span>Total</span></div>
        ${order.items.map(i => `
          <div class="receipt-line">
            <span>${i.name} <em>×${i.qty}</em></span>
            <span>₱${(i.price * i.qty).toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
      <div class="receipt-total">
        <span>Total Paid</span>
        <strong>₱${order.total.toLocaleString()}</strong>
      </div>
      <div class="receipt-payment">
        <span>${payIcons[order.payment_method] || '💳'} Paid via <strong>${order.payment_method}</strong></span>
      </div>
      <div class="receipt-footer-msg">
        <p>Thank you for supporting the preservation of Davao's heritage.</p>
        <p>Questions? heritage@davaomuseum.gov.ph | +63 82 227-0000</p>
      </div>
    </div>
  `;
}

function printReceipt(order) {
  const w = window.open('', '_blank', 'width=560,height=700');
  w.document.write(`<!DOCTYPE html><html><head>
    <title>Receipt — ${order.order_number}</title>
    <link rel="stylesheet" href="${_receiptBasePath()}css/style.css">
    <style>
      body { background:#fff; display:flex; justify-content:center; padding:2rem; }
      @media print { body { padding:0; } }
    </style>
  </head><body>
    ${buildReceiptHTML(order)}
    <script>window.addEventListener('load', () => { window.print(); })<\/script>
  </body></html>`);
  w.document.close();
}

function _receiptBasePath() {
  // works from both /pages/ and root
  return window.location.pathname.includes('/pages/') ? '../' : './';
}

// ══════════════════════════════════════════════════════════════
//  MAP REDIRECT
// ══════════════════════════════════════════════════════════════
function goToMap() {
  window.open(
    'https://www.google.com/maps/search/Davao+City+Museum,+Davao+City,+Philippines',
    '_blank'
  );
}

// ══════════════════════════════════════════════════════════════
//  CHATBOT
// ══════════════════════════════════════════════════════════════
const chatKB = {
  hours:      '🕐 We\'re open Monday to Saturday, 8:00 AM – 5:00 PM. Closed Sundays and public holidays.',
  location:   '📍 Find us at the Davao City Museum Complex, Davao City. Click the map icon in the navigation or <a href="#map-section">scroll to the map</a> for directions.',
  ticket:     '🎟️ Admission: Adult ₱50 · Student ₱30 · Senior/PWD ₱25 · Child (under 5) FREE. Buy tickets online in our <a href="/pages/shop.html">Shop</a>!',
  collection: '🏺 Our collection holds over 2,400 artifacts — Bagobo brassware, Mandaya textiles, colonial relics, and natural history specimens. Browse the <a href="/pages/collection.html">Collection page</a>.',
  shop:       '🛍️ Our online shop carries replicas, books, crafts, and admission tickets. <a href="/pages/shop.html">Visit the Shop →</a>. You\'ll need to create a free account to purchase.',
  partner:    '🤝 We partner with three great museums in Davao City: <a href="https://dbonemuseum.com" target="_blank">D\'Bone Collector Museum</a>, <a href="https://museodabawenyo.com" target="_blank">Museo Dabawenyo</a>, and the <a href="https://www.nationalmuseum.gov.ph" target="_blank">National Museum Davao</a>.',
  contact:    '📞 Call us at +63 82 227-0000 or email heritage@davaomuseum.gov.ph. We reply within 1 business day.',
  events:     '📅 Watch for our seasonal cultural exhibits and school programme events. Follow our Facebook page for the latest announcements.',
  parking:    '🚗 Free parking is available at the museum grounds. Wheelchair-accessible entrance on the east side.',
  group:      '👥 Group bookings (10+ visitors) receive a 20% discount. Email us in advance to reserve a guided tour.',
};

function chatInit() {
  const btn    = document.getElementById('chatbot-trigger');
  const window_= document.getElementById('chatbot-window');
  const closeB = document.getElementById('chatbot-close');
  const send   = document.getElementById('chat-send');
  const input  = document.getElementById('chat-input');

  btn?.addEventListener('click', () => {
    window_?.classList.toggle('open');
    if (window_?.classList.contains('open') && document.getElementById('chat-messages')?.children.length === 0) {
      _chatAddMessage('bot', 'Hello! 👋 I\'m the Davao Heritage Museum guide. How can I help you today?');
    }
  });

  closeB?.addEventListener('click', () => window_?.classList.remove('open'));
  send?.addEventListener('click', _chatSend);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') _chatSend(); });
}

function chatTemplate(text) {
  const input = document.getElementById('chat-input');
  if (input) { input.value = text; _chatSend(); }
}

function _chatSend() {
  const input = document.getElementById('chat-input');
  const msg = input?.value.trim();
  if (!msg) return;
  _chatAddMessage('user', msg);
  input.value = '';
  setTimeout(() => _chatAddMessage('bot', _chatReply(msg)), 500);
}

function _chatReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes('hour') || m.includes('open') || m.includes('time') || m.includes('schedule'))   return chatKB.hours;
  if (m.includes('location') || m.includes('where') || m.includes('address') || m.includes('find')) return chatKB.location;
  if (m.includes('ticket') || m.includes('admission') || m.includes('fee') || m.includes('price') || m.includes('cost')) return chatKB.ticket;
  if (m.includes('collect') || m.includes('artifact') || m.includes('exhibit'))  return chatKB.collection;
  if (m.includes('shop') || m.includes('buy') || m.includes('purchase') || m.includes('souven'))  return chatKB.shop;
  if (m.includes('partner') || m.includes('d\'bone') || m.includes('museo') || m.includes('national')) return chatKB.partner;
  if (m.includes('contact') || m.includes('email') || m.includes('phone') || m.includes('call'))  return chatKB.contact;
  if (m.includes('event') || m.includes('program') || m.includes('activit'))  return chatKB.events;
  if (m.includes('park')) return chatKB.parking;
  if (m.includes('group') || m.includes('school') || m.includes('tour'))   return chatKB.group;
  return '🏛️ I\'m not sure about that — but you can email us at heritage@davaomuseum.gov.ph or call +63 82 227-0000 and our staff will be happy to help!';
}

function _chatAddMessage(role, html) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role}`;
  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ══════════════════════════════════════════════════════════════
//  SHARED INIT (runs on every page)
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  _cartUpdateBadge();
  chatInit();

  // cart sidebar toggle
  document.getElementById('btn-cart')?.addEventListener('click', () => {
    _cartRenderSidebar();
    document.getElementById('cart-sidebar')?.classList.toggle('open');
  });
  document.getElementById('cart-close')?.addEventListener('click', () => {
    document.getElementById('cart-sidebar')?.classList.remove('open');
  });
  document.getElementById('cart-overlay')?.addEventListener('click', () => {
    document.getElementById('cart-sidebar')?.classList.remove('open');
  });

  // modal backdrop close
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
  });

  // auth modal tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(target)?.classList.add('active');
    });
  });

  // sign-out button
  document.getElementById('btn-signout')?.addEventListener('click', authSignOut);
});