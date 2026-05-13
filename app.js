/* ============================================
   SteamVault — Main Application Logic
   Uses CheapShark API for real game deals.
   Simulated purchases saved to localStorage.
   ============================================ */

// ─── CheapShark API (free, no key needed) ───
const API_BASE = 'https://www.cheapshark.com/api/1.0';

// ─── Application State ───
const state = {
  wallet: 250.00,
  cart: [],
  library: [],
  currentGame: null,
  searchQuery: '',
};

// ─── Initialize App ───
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  loadPopularGames();
  updateUI();

  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchGames();
  });
});

// ══════════════════════════════════════════════
//  API Functions
// ══════════════════════════════════════════════

/**
 * Loads top-rated deals from CheapShark
 */
async function loadPopularGames() {
  showLoader(true);
  try {
    const res = await fetch(`${API_BASE}/deals?pageSize=20&sortBy=Deal%20Rating`);
    const data = await res.json();
    // Deduplicate by game title
    const seen = new Set();
    const unique = data.filter(d => {
      if (seen.has(d.title)) return false;
      seen.add(d.title);
      return true;
    });
    renderGameGrid(unique);
  } catch (err) {
    console.error('Error loading games:', err);
    showToast('Error al cargar juegos.', 'error');
  }
  showLoader(false);
}

/**
 * Searches games by title using CheapShark API
 */
async function searchGames() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) {
    loadPopularGames();
    document.getElementById('store-title').textContent = '🔥 Ofertas Destacadas';
    document.getElementById('store-subtitle').textContent = 'Las mejores ofertas ahora mismo';
    return;
  }

  state.searchQuery = query;
  showLoader(true);
  document.getElementById('game-grid').innerHTML = '';
  document.getElementById('store-title').textContent = `🔍 Resultados: "${query}"`;
  document.getElementById('store-subtitle').textContent = 'Buscando...';

  try {
    const res = await fetch(`${API_BASE}/deals?title=${encodeURIComponent(query)}&pageSize=20`);
    const data = await res.json();
    const seen = new Set();
    const unique = data.filter(d => {
      if (seen.has(d.title)) return false;
      seen.add(d.title);
      return true;
    });
    document.getElementById('store-subtitle').textContent = `${unique.length} juegos encontrados`;
    renderGameGrid(unique);
  } catch (err) {
    console.error('Search error:', err);
    showToast('Error en la búsqueda.', 'error');
  }
  showLoader(false);
}

/**
 * Gets the Steam header image for a game
 * @param {Object} deal - CheapShark deal object
 * @returns {string} URL to a large game image
 */
function getGameImage(deal) {
  if (deal.steamAppID) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${deal.steamAppID}/header.jpg`;
  }
  return deal.thumb || 'https://placehold.co/460x215/1a1a2e/6366f1?text=No+Image';
}

// ══════════════════════════════════════════════
//  Rendering Functions
// ══════════════════════════════════════════════

/**
 * Renders game cards in the store grid
 * @param {Array} deals - CheapShark deal objects
 */
function renderGameGrid(deals) {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';

  if (!deals || deals.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">🎮</div>
        <div class="empty-state-title">No se encontraron juegos</div>
        <p>Intenta con otro término de búsqueda</p>
      </div>`;
    return;
  }

  deals.forEach(deal => {
    const salePrice = parseFloat(deal.salePrice);
    const normalPrice = parseFloat(deal.normalPrice);
    const owned = isOwned(deal.gameID);
    const discount = Math.round(parseFloat(deal.savings));
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => openGameModal(deal);

    card.innerHTML = `
      <div class="game-card-img-wrapper">
        <img class="game-card-img"
             src="${getGameImage(deal)}"
             alt="${deal.title}"
             loading="lazy"
             onerror="this.src='https://placehold.co/460x215/1a1a2e/6366f1?text=No+Image'">
        ${discount > 0 ? `<div style="
          position:absolute; top:8px; right:8px;
          background:var(--accent-green); color:#fff;
          padding:2px 8px; border-radius:4px;
          font-size:0.7rem; font-weight:700; z-index:2;
        ">-${discount}%</div>` : ''}
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${deal.title}</div>
        <div class="game-card-meta">
          <span class="game-card-rating">
            ${deal.steamRatingText ? `⭐ ${deal.steamRatingPercent}%` : '⭐ N/A'}
          </span>
          <span class="game-card-price ${salePrice === 0 ? 'free' : ''}">
            ${owned ? '✅ Biblioteca' : (salePrice === 0 ? 'GRATIS' : salePrice.toFixed(2) + '€')}
          </span>
        </div>
        ${normalPrice > salePrice && salePrice > 0 ? `
          <div style="font-size:0.7rem; color:var(--text-muted); text-decoration:line-through; text-align:right;">
            ${normalPrice.toFixed(2)}€
          </div>` : ''}
      </div>`;

    grid.appendChild(card);
  });
}

/**
 * Opens the game detail modal with deal data
 * @param {Object} deal - CheapShark deal object
 */
function openGameModal(deal) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('visible');
  state.currentGame = deal;

  const salePrice = parseFloat(deal.salePrice);
  const normalPrice = parseFloat(deal.normalPrice);
  const owned = isOwned(deal.gameID);
  const inCart = state.cart.some(g => g.gameID === deal.gameID);
  const discount = Math.round(parseFloat(deal.savings));
  const releaseDate = deal.releaseDate && deal.releaseDate > 0
    ? new Date(deal.releaseDate * 1000).toLocaleDateString('es-ES')
    : 'Desconocido';

  document.getElementById('modal-hero').src = getGameImage(deal);
  document.getElementById('modal-hero').onerror = function() {
    this.src = 'https://placehold.co/800x340/1a1a2e/6366f1?text=' + encodeURIComponent(deal.title);
  };
  document.getElementById('modal-title').textContent = deal.title;

  // Rating stars
  const ratingPct = parseInt(deal.steamRatingPercent) || 0;
  const starCount = Math.round(ratingPct / 20);
  document.getElementById('modal-stars').textContent = '⭐'.repeat(starCount) + '☆'.repeat(5 - starCount);
  document.getElementById('modal-rating-text').textContent =
    deal.steamRatingText ? `${deal.steamRatingText} (${ratingPct}%)  •  ${deal.steamRatingCount || 0} reviews` : 'Sin valoraciones';

  // Genres placeholder
  document.getElementById('modal-genres').innerHTML =
    deal.steamRatingText ? `<span class="genre-tag">${deal.steamRatingText}</span>` : '';

  // Description
  document.getElementById('modal-desc').textContent =
    `Consigue ${deal.title} a un precio increíble. ` +
    (discount > 0 ? `¡Ahorra un ${discount}% sobre el precio original de ${normalPrice.toFixed(2)}€!` : '') +
    (deal.metacriticScore > 0 ? ` Puntuación Metacritic: ${deal.metacriticScore}/100.` : '');

  // Info grid
  document.getElementById('modal-info-grid').innerHTML = `
    <div class="modal-info-item">
      <div class="modal-info-label">Lanzamiento</div>
      <div class="modal-info-value">${releaseDate}</div>
    </div>
    <div class="modal-info-item">
      <div class="modal-info-label">Metacritic</div>
      <div class="modal-info-value">${deal.metacriticScore || '—'}</div>
    </div>
    <div class="modal-info-item">
      <div class="modal-info-label">Descuento</div>
      <div class="modal-info-value" style="color:var(--accent-green);">${discount > 0 ? `-${discount}%` : 'Sin descuento'}</div>
    </div>
    <div class="modal-info-item">
      <div class="modal-info-label">Precio Original</div>
      <div class="modal-info-value">${normalPrice.toFixed(2)}€</div>
    </div>`;

  // Price & Buy button
  document.getElementById('modal-price').textContent =
    salePrice === 0 ? 'GRATIS' : `${salePrice.toFixed(2)}€`;

  const buyBtn = document.getElementById('modal-buy-btn');
  if (owned) {
    buyBtn.textContent = '✅ Ya en tu biblioteca';
    buyBtn.className = 'btn-buy owned';
  } else if (inCart) {
    buyBtn.textContent = '🛒 Ya en el carrito';
    buyBtn.className = 'btn-buy owned';
  } else {
    buyBtn.textContent = '🛒 Añadir al Carrito';
    buyBtn.className = 'btn-buy';
  }
}

/**
 * Renders the library page with owned games
 */
function renderLibrary() {
  const list = document.getElementById('library-list');
  const subtitle = document.getElementById('library-subtitle');
  subtitle.textContent = `${state.library.length} juegos`;

  if (state.library.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-title">Tu biblioteca está vacía</div>
        <p>¡Explora la tienda y consigue tus primeros juegos!</p>
      </div>`;
    return;
  }

  list.innerHTML = state.library.map(game => `
    <div class="library-card">
      <img class="library-card-img" src="${game.image}" alt="${game.name}" loading="lazy"
           onerror="this.src='https://placehold.co/140x80/1a1a2e/6366f1?text=No+Img'">
      <div class="library-card-info">
        <div class="library-card-title">${game.name}</div>
        <div class="library-card-date">Comprado: ${game.purchaseDate} — ${game.price === 0 ? 'Gratis' : game.price.toFixed(2) + '€'}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Renders the shopping cart page
 */
function renderCart() {
  const list = document.getElementById('cart-list');
  const subtitle = document.getElementById('cart-subtitle');
  const summary = document.getElementById('cart-summary');
  subtitle.textContent = `${state.cart.length} artículos`;

  if (state.cart.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <div class="empty-state-title">Tu carrito está vacío</div>
        <p>Busca juegos y añádelos al carrito</p>
      </div>`;
    summary.style.display = 'none';
    return;
  }

  const total = state.cart.reduce((s, g) => s + g.price, 0);
  document.getElementById('cart-total').textContent = `${total.toFixed(2)}€`;
  summary.style.display = 'block';

  const purchaseBtn = document.getElementById('btn-purchase-cart');
  if (total > state.wallet) {
    purchaseBtn.textContent = '❌ Saldo insuficiente';
    purchaseBtn.style.opacity = '0.5';
    purchaseBtn.style.pointerEvents = 'none';
  } else {
    purchaseBtn.textContent = '💳 Comprar Todo';
    purchaseBtn.style.opacity = '1';
    purchaseBtn.style.pointerEvents = 'auto';
  }

  list.innerHTML = state.cart.map((game, i) => `
    <div class="library-card">
      <img class="library-card-img" src="${game.image}" alt="${game.name}" loading="lazy"
           onerror="this.src='https://placehold.co/140x80/1a1a2e/6366f1?text=No+Img'">
      <div class="library-card-info">
        <div class="library-card-title">${game.name}</div>
        <div class="library-card-date" style="color:var(--accent-green);font-weight:600;">
          ${game.price === 0 ? 'GRATIS' : game.price.toFixed(2) + '€'}
        </div>
      </div>
      <button onclick="removeFromCart(${i})" style="
        background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
        color:var(--accent-red);padding:0.5rem 0.8rem;border-radius:var(--radius-sm);
        cursor:pointer;font-size:0.8rem;align-self:center;
      ">🗑️ Quitar</button>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════
//  Commerce Functions
// ══════════════════════════════════════════════

/** Adds the current modal game to the cart */
function buyFromModal() {
  const deal = state.currentGame;
  if (!deal) return;

  if (isOwned(deal.gameID)) {
    showToast('Ya tienes este juego.', 'error');
    return;
  }
  if (state.cart.some(g => g.gameID === deal.gameID)) {
    showToast('Ya está en tu carrito.', 'error');
    return;
  }

  const price = parseFloat(deal.salePrice);
  state.cart.push({
    gameID: deal.gameID,
    name: deal.title,
    image: getGameImage(deal),
    price: price,
  });

  showToast(`"${deal.title}" añadido al carrito.`, 'success');
  updateUI();
  closeModalForce();
}

/** Removes a game from the cart */
function removeFromCart(index) {
  const removed = state.cart.splice(index, 1);
  showToast(`"${removed[0].name}" eliminado.`, 'success');
  updateUI();
  renderCart();
}

/** Purchases all games in the cart */
function purchaseCart() {
  const total = state.cart.reduce((s, g) => s + g.price, 0);
  if (total > state.wallet) {
    showToast('Saldo insuficiente.', 'error');
    return;
  }

  state.wallet -= total;
  state.wallet = Math.round(state.wallet * 100) / 100;

  const today = new Date().toLocaleDateString('es-ES');
  state.cart.forEach(game => {
    if (!isOwned(game.gameID)) {
      state.library.push({
        gameID: game.gameID,
        name: game.name,
        image: game.image,
        price: game.price,
        purchaseDate: today,
      });
    }
  });

  const count = state.cart.length;
  state.cart = [];
  saveToStorage();
  updateUI();
  renderCart();
  showToast(`¡${count} juego(s) comprado(s)! -${total.toFixed(2)}€`, 'success');
}

// ══════════════════════════════════════════════
//  Utility Functions
// ══════════════════════════════════════════════

/** Checks if a game is owned */
function isOwned(gameID) {
  return state.library.some(g => g.gameID === gameID);
}

/** Switches between pages */
function showPage(page) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`).classList.add('active');
  if (page === 'library') renderLibrary();
  if (page === 'cart') renderCart();
}

/** Updates UI badges and wallet */
function updateUI() {
  const cartBadge = document.getElementById('cart-count');
  cartBadge.textContent = state.cart.length;
  cartBadge.classList.toggle('visible', state.cart.length > 0);

  const libBadge = document.getElementById('library-count');
  libBadge.textContent = state.library.length;
  libBadge.classList.toggle('visible', state.library.length > 0);

  document.getElementById('wallet-amount').textContent = state.wallet.toFixed(2);
}

/** Toggles loader visibility */
function showLoader(show) {
  document.getElementById('store-loader').style.display = show ? 'flex' : 'none';
}

/** Shows a toast notification */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/** Closes modal on backdrop click */
function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModalForce();
}

/** Force closes the modal */
function closeModalForce() {
  document.getElementById('modal-overlay').classList.remove('visible');
  state.currentGame = null;
}

// ══════════════════════════════════════════════
//  LocalStorage Persistence
// ══════════════════════════════════════════════

/** Saves library & wallet to localStorage */
function saveToStorage() {
  localStorage.setItem('steamvault_library', JSON.stringify(state.library));
  localStorage.setItem('steamvault_wallet', JSON.stringify(state.wallet));
}

/** Loads library & wallet from localStorage */
function loadFromStorage() {
  const lib = localStorage.getItem('steamvault_library');
  const wallet = localStorage.getItem('steamvault_wallet');
  if (lib) state.library = JSON.parse(lib);
  if (wallet) state.wallet = JSON.parse(wallet);
}
