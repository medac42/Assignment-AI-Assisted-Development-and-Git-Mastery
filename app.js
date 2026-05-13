/* ============================================
   SteamVault — Steam Clone Application Logic
   CheapShark API + localStorage persistence
   ============================================ */

const API_BASE = 'https://www.cheapshark.com/api/1.0';

// ─── Application State ───
const state = {
  wallet: 250.00,
  cart: [],
  library: [],
  wishlist: [],
  currentDeals: [],
  currentGame: null,
  featuredIndex: 0,
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  loadPopularGames();
  updateUI();
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchGames();
  });
});

// ══════════════════════════════════════════════
//  API Functions
// ══════════════════════════════════════════════

async function loadPopularGames() {
  showLoader(true);
  try {
    const res = await fetch(`${API_BASE}/deals?pageSize=24&sortBy=Deal%20Rating`);
    const data = await res.json();
    const seen = new Set();
    const unique = data.filter(d => { if (seen.has(d.title)) return false; seen.add(d.title); return true; });
    state.currentDeals = unique;
    renderFeatured(unique.slice(0, 5));
    renderGameGrid(unique);
  } catch (err) {
    console.error('Error:', err);
    showToast('Error loading games.', 'error');
  }
  showLoader(false);
}

async function searchGames() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) { loadPopularGames(); document.getElementById('store-title').textContent = 'Special Offers'; return; }
  showLoader(true);
  document.getElementById('game-grid').innerHTML = '';
  document.getElementById('store-title').textContent = `Results for "${q}"`;
  document.getElementById('featured-section').innerHTML = '';
  try {
    const res = await fetch(`${API_BASE}/deals?title=${encodeURIComponent(q)}&pageSize=24`);
    const data = await res.json();
    const seen = new Set();
    const unique = data.filter(d => { if (seen.has(d.title)) return false; seen.add(d.title); return true; });
    state.currentDeals = unique;
    document.getElementById('store-subtitle').textContent = `${unique.length} games found`;
    renderGameGrid(unique);
  } catch (err) { showToast('Search error.', 'error'); }
  showLoader(false);
}

function getGameImage(deal) {
  if (deal.steamAppID) return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${deal.steamAppID}/header.jpg`;
  return deal.thumb || 'https://placehold.co/460x215/1b2838/67c1f5?text=No+Image';
}

function getGameCapsule(deal) {
  if (deal.steamAppID) return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${deal.steamAppID}/capsule_616x353.jpg`;
  return getGameImage(deal);
}

// ══════════════════════════════════════════════
//  Rendering
// ══════════════════════════════════════════════

/** Steam-style featured carousel */
function renderFeatured(deals) {
  const section = document.getElementById('featured-section');
  if (!deals || deals.length === 0) { section.innerHTML = ''; return; }
  state.featuredIndex = 0;

  function buildCarousel(idx) {
    const deal = deals[idx];
    const salePrice = parseFloat(deal.salePrice);
    const normalPrice = parseFloat(deal.normalPrice);
    const discount = Math.round(parseFloat(deal.savings));
    section.innerHTML = `
      <div class="featured-label">Featured & Recommended</div>
      <div class="featured-carousel" onclick="openGameModal(state.currentDeals[${state.currentDeals.indexOf(deal)}] || state.currentDeals[0])">
        <div class="featured-main">
          <img src="${getGameCapsule(deal)}" alt="${deal.title}"
               onerror="this.src='${getGameImage(deal)}'">
        </div>
        <div class="featured-info">
          <div>
            <div class="featured-title">${deal.title}</div>
            <div class="featured-thumbs">
              <img src="${getGameImage(deal)}" alt="thumb" onerror="this.style.display='none'">
              <img src="${deal.thumb}" alt="thumb2" onerror="this.style.display='none'">
            </div>
          </div>
          <div class="featured-bottom">
            ${discount > 20 ? `<span class="featured-tag">Top Seller</span>` : ''}
            <div class="featured-price">
              ${discount > 0 ? `<span style="background:var(--green-price);color:#000;padding:2px 6px;border-radius:2px;font-weight:700;margin-right:6px;">-${discount}%</span>` : ''}
              ${salePrice === 0 ? '<span style="color:var(--blue-light);">Free to Play</span>' :
                `<span style="text-decoration:line-through;color:var(--text-muted);font-size:0.8rem;margin-right:4px;">${normalPrice.toFixed(2)}€</span>
                 <span style="color:var(--green-price);font-weight:600;">${salePrice.toFixed(2)}€</span>`}
            </div>
          </div>
        </div>
      </div>
      <div class="carousel-dots">
        ${deals.map((_, i) => `<button class="carousel-dot ${i === idx ? 'active' : ''}" onclick="event.stopPropagation();state.featuredIndex=${i};document.getElementById('featured-section').querySelector('.featured-carousel').onclick=null;(${buildCarousel.toString()})(${i})"></button>`).join('')}
      </div>`;
  }
  buildCarousel(0);
  // Auto-rotate
  setInterval(() => {
    state.featuredIndex = (state.featuredIndex + 1) % deals.length;
    buildCarousel(state.featuredIndex);
  }, 6000);
}

/** Game grid cards */
function renderGameGrid(deals) {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';
  if (!deals || deals.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🎮</div><div class="empty-state-title">No games found</div><p>Try a different search</p></div>`;
    return;
  }
  deals.forEach(deal => {
    const sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
    const owned = isOwned(deal.gameID), disc = Math.round(parseFloat(deal.savings));
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => openGameModal(deal);
    card.innerHTML = `
      <div class="game-card-img-wrap">
        <img class="game-card-img" src="${getGameImage(deal)}" alt="${deal.title}" loading="lazy"
             onerror="this.src='https://placehold.co/460x215/1b2838/67c1f5?text=No+Image'">
        ${disc > 0 ? `<div class="game-card-discount">-${disc}%</div>` : ''}
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${deal.title}</div>
        <div class="game-card-meta">
          <span class="game-card-rating">${deal.steamRatingText ? `⭐ ${deal.steamRatingPercent}%` : ''}</span>
          ${owned ? `<span class="game-card-owned">✓ In Library</span>` :
            `<div class="game-card-prices">
              ${np > sp && sp > 0 ? `<span class="game-card-original">${np.toFixed(2)}€</span>` : ''}
              <span class="game-card-sale ${sp === 0 ? 'free' : ''}">${sp === 0 ? 'Free' : sp.toFixed(2) + '€'}</span>
            </div>`}
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

/** Game detail modal */
function openGameModal(deal) {
  document.getElementById('modal-overlay').classList.add('visible');
  state.currentGame = deal;
  const sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
  const owned = isOwned(deal.gameID), inCart = state.cart.some(g => g.gameID === deal.gameID);
  const disc = Math.round(parseFloat(deal.savings));
  const inWish = state.wishlist.some(g => g.gameID === deal.gameID);
  const release = deal.releaseDate > 0 ? new Date(deal.releaseDate * 1000).toLocaleDateString('es-ES') : '—';
  const ratingClass = !deal.steamRatingText ? 'neutral' :
    deal.steamRatingText.includes('Positive') ? 'positive' :
    deal.steamRatingText.includes('Mixed') ? 'mixed' : 'negative';

  document.getElementById('modal-hero').src = getGameCapsule(deal);
  document.getElementById('modal-hero').onerror = function(){ this.src = getGameImage(deal); };
  document.getElementById('modal-title').textContent = deal.title;
  document.getElementById('modal-rating-tag').textContent = deal.steamRatingText || 'No Reviews';
  document.getElementById('modal-rating-tag').className = `modal-rating-tag ${ratingClass}`;
  document.getElementById('modal-rating-count').textContent = deal.steamRatingCount ? `(${parseInt(deal.steamRatingCount).toLocaleString()} reviews)` : '';
  document.getElementById('modal-desc').textContent =
    `Get ${deal.title} at an incredible price. ` +
    (disc > 0 ? `Save ${disc}% off the original ${np.toFixed(2)}€! ` : '') +
    (deal.metacriticScore > 0 ? `Metacritic: ${deal.metacriticScore}/100.` : '');

  // Screenshots
  document.getElementById('modal-screenshots').innerHTML = `
    <img src="${getGameImage(deal)}" alt="screenshot" onerror="this.style.display='none'">
    <img src="${deal.thumb}" alt="screenshot2" onerror="this.style.display='none'">`;

  // Purchase box
  document.getElementById('purchase-title').textContent = `Buy ${deal.title}`;
  const discBadge = document.getElementById('modal-discount');
  if (disc > 0) { discBadge.textContent = `-${disc}%`; discBadge.style.display = 'inline'; }
  else { discBadge.style.display = 'none'; }
  document.getElementById('modal-price-original').textContent = np > sp ? np.toFixed(2) + '€' : '';
  document.getElementById('modal-price-final').textContent = sp === 0 ? 'Free to Play' : sp.toFixed(2) + '€';

  const buyBtn = document.getElementById('modal-buy-btn');
  if (owned) { buyBtn.textContent = '✓ In Library'; buyBtn.className = 'btn-add-cart owned'; }
  else if (inCart) { buyBtn.textContent = '✓ In Cart'; buyBtn.className = 'btn-add-cart owned'; }
  else { buyBtn.textContent = 'Add to Cart'; buyBtn.className = 'btn-add-cart'; }

  document.getElementById('modal-wish-btn').textContent = inWish ? '💜' : '🤍';

  // Info panel
  document.getElementById('modal-info-panel').innerHTML = `
    <div class="info-item"><div class="info-label">Release Date</div><div class="info-value">${release}</div></div>
    <div class="info-item"><div class="info-label">Metacritic</div><div class="info-value">${deal.metacriticScore || '—'}</div></div>
    <div class="info-item"><div class="info-label">Discount</div><div class="info-value" style="color:var(--green-price);">${disc > 0 ? `-${disc}%` : 'None'}</div></div>
    <div class="info-item"><div class="info-label">Original Price</div><div class="info-value">${np.toFixed(2)}€</div></div>
    <div class="info-item"><div class="info-label">Steam Rating</div><div class="info-value">${deal.steamRatingText || '—'}</div></div>
    <div class="info-item"><div class="info-label">Reviews</div><div class="info-value">${deal.steamRatingCount ? parseInt(deal.steamRatingCount).toLocaleString() : '—'}</div></div>`;
}

function renderLibrary() {
  const list = document.getElementById('library-list');
  document.getElementById('library-subtitle').textContent = `${state.library.length} games`;
  if (!state.library.length) { list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">Your library is empty</div><p>Buy games from the store!</p></div>`; return; }
  list.innerHTML = state.library.map(g => `
    <div class="library-card"><img class="library-card-img" src="${g.image}" alt="${g.name}" loading="lazy" onerror="this.src='https://placehold.co/120x56/1b2838/67c1f5?text=-'">
    <div class="library-card-info"><div class="library-card-title">${g.name}</div><div class="library-card-date">Purchased: ${g.purchaseDate} — ${g.price === 0 ? 'Free' : g.price.toFixed(2) + '€'}</div></div></div>`).join('');
}

function renderWishlist() {
  const list = document.getElementById('wishlist-list');
  document.getElementById('wishlist-subtitle').textContent = `${state.wishlist.length} games`;
  if (!state.wishlist.length) { list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🤍</div><div class="empty-state-title">Your wishlist is empty</div><p>Mark games with 🤍 to save them</p></div>`; return; }
  list.innerHTML = state.wishlist.map((g, i) => `
    <div class="library-card"><img class="library-card-img" src="${g.image}" alt="${g.name}" loading="lazy" onerror="this.src='https://placehold.co/120x56/1b2838/67c1f5?text=-'">
    <div class="library-card-info"><div class="library-card-title">${g.name}</div><div class="library-card-date">Added: ${g.addedDate} — ${g.price === 0 ? 'Free' : g.price.toFixed(2) + '€'}</div></div>
    <button class="library-card-btn wish-remove" onclick="removeFromWishlist(${i})">✕ Remove</button></div>`).join('');
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const summary = document.getElementById('cart-summary');
  document.getElementById('cart-subtitle').textContent = `${state.cart.length} items`;
  if (!state.cart.length) { list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Your cart is empty</div><p>Browse the store and add games</p></div>`; summary.style.display = 'none'; return; }
  const total = state.cart.reduce((s, g) => s + g.price, 0);
  document.getElementById('cart-total').textContent = total.toFixed(2) + '€';
  summary.style.display = 'flex';
  const btn = document.getElementById('btn-purchase-cart');
  btn.className = total > state.wallet ? 'btn-purchase disabled' : 'btn-purchase';
  btn.textContent = total > state.wallet ? 'Insufficient funds' : 'Purchase for myself';
  list.innerHTML = state.cart.map((g, i) => `
    <div class="library-card"><img class="library-card-img" src="${g.image}" alt="${g.name}" loading="lazy" onerror="this.src='https://placehold.co/120x56/1b2838/67c1f5?text=-'">
    <div class="library-card-info"><div class="library-card-title">${g.name}</div><div class="library-card-date" style="color:var(--green-price);font-weight:600;">${g.price === 0 ? 'Free' : g.price.toFixed(2) + '€'}</div></div>
    <button class="library-card-btn" onclick="removeFromCart(${i})">✕ Remove</button></div>`).join('');
}

// ══════════════════════════════════════════════
//  Commerce
// ══════════════════════════════════════════════

function buyFromModal() {
  const d = state.currentGame; if (!d) return;
  if (isOwned(d.gameID)) { showToast('Already in library.', 'error'); return; }
  if (state.cart.some(g => g.gameID === d.gameID)) { showToast('Already in cart.', 'error'); return; }
  state.cart.push({ gameID: d.gameID, name: d.title, image: getGameImage(d), price: parseFloat(d.salePrice) });
  showToast(`"${d.title}" added to cart.`, 'success'); updateUI(); closeModalForce();
}

function removeFromCart(i) { const r = state.cart.splice(i, 1); showToast(`"${r[0].name}" removed.`, 'success'); updateUI(); renderCart(); }

function purchaseCart() {
  const total = state.cart.reduce((s, g) => s + g.price, 0);
  if (total > state.wallet) { showToast('Insufficient funds.', 'error'); return; }
  state.wallet -= total; state.wallet = Math.round(state.wallet * 100) / 100;
  const today = new Date().toLocaleDateString('es-ES');
  state.cart.forEach(g => { if (!isOwned(g.gameID)) state.library.push({ gameID: g.gameID, name: g.name, image: g.image, price: g.price, purchaseDate: today }); });
  const c = state.cart.length; state.cart = [];
  saveToStorage(); updateUI(); renderCart();
  showToast(`${c} game(s) purchased! -${total.toFixed(2)}€`, 'success');
}

function toggleWishlist() {
  const d = state.currentGame; if (!d) return;
  const idx = state.wishlist.findIndex(g => g.gameID === d.gameID);
  if (idx !== -1) { state.wishlist.splice(idx, 1); showToast(`Removed from wishlist.`, 'success'); }
  else { state.wishlist.push({ gameID: d.gameID, name: d.title, image: getGameImage(d), price: parseFloat(d.salePrice), normalPrice: parseFloat(d.normalPrice), addedDate: new Date().toLocaleDateString('es-ES') }); showToast(`Added to wishlist! 💜`, 'success'); }
  saveToStorage(); updateUI(); closeModalForce();
}

function removeFromWishlist(i) { const r = state.wishlist.splice(i, 1); showToast(`"${r[0].name}" removed.`, 'success'); saveToStorage(); updateUI(); renderWishlist(); }

function sortGames() {
  const s = document.getElementById('sort-select').value, d = [...state.currentDeals];
  if (s === 'price') d.sort((a, b) => parseFloat(a.salePrice) - parseFloat(b.salePrice));
  else if (s === 'title') d.sort((a, b) => a.title.localeCompare(b.title));
  else if (s === 'metacritic') d.sort((a, b) => (parseInt(b.metacriticScore) || 0) - (parseInt(a.metacriticScore) || 0));
  else d.sort((a, b) => parseFloat(b.dealRating || 0) - parseFloat(a.dealRating || 0));
  renderGameGrid(d);
}

// ══════════════════════════════════════════════
//  Utility
// ══════════════════════════════════════════════

function isOwned(id) { return state.library.some(g => g.gameID === id); }

function showPage(page) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`).classList.add('active');
  if (page === 'library') renderLibrary();
  if (page === 'wishlist') renderWishlist();
  if (page === 'cart') renderCart();
}

function updateUI() {
  const cb = document.getElementById('cart-count'); cb.textContent = state.cart.length; cb.classList.toggle('visible', state.cart.length > 0);
  const lb = document.getElementById('library-count'); lb.textContent = state.library.length; lb.classList.toggle('visible', state.library.length > 0);
  const wb = document.getElementById('wishlist-count'); wb.textContent = state.wishlist.length; wb.classList.toggle('visible', state.wishlist.length > 0);
  document.getElementById('wallet-amount').textContent = state.wallet.toFixed(2);
}

function showLoader(s) { document.getElementById('store-loader').style.display = s ? 'flex' : 'none'; }

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container'), t = document.createElement('div');
  t.className = `toast ${type}`; t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${msg}`;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
}

function closeModal(e) { if (e.target === document.getElementById('modal-overlay')) closeModalForce(); }
function closeModalForce() { document.getElementById('modal-overlay').classList.remove('visible'); state.currentGame = null; }

// ══════════════════════════════════════════════
//  Persistence
// ══════════════════════════════════════════════

function saveToStorage() {
  localStorage.setItem('sv_lib', JSON.stringify(state.library));
  localStorage.setItem('sv_wallet', JSON.stringify(state.wallet));
  localStorage.setItem('sv_wish', JSON.stringify(state.wishlist));
}

function loadFromStorage() {
  const l = localStorage.getItem('sv_lib'), w = localStorage.getItem('sv_wallet'), ws = localStorage.getItem('sv_wish');
  if (l) state.library = JSON.parse(l);
  if (w) state.wallet = JSON.parse(w);
  if (ws) state.wishlist = JSON.parse(ws);
}
