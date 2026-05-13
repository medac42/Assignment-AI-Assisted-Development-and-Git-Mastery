/* ============================================
   SteamVault — Main Application Logic
   Uses RAWG API to fetch real game data.
   Simulated purchases saved to localStorage.
   ============================================ */

// ─── RAWG API Configuration ───
// Free API key from https://rawg.io/apidocs
const API_KEY = '0f5383a1a0c04c4bbb4b4e1e3c9a7a4c';
const API_BASE = 'https://api.rawg.io/api';

// ─── Application State ───
const state = {
  wallet: 250.00,                    // Starting balance in euros
  cart: [],                          // Items in the cart
  library: [],                       // Purchased games (saved in localStorage)
  currentGame: null,                 // Currently selected game for the modal
  searchQuery: '',                   // Current search query
};

// ─── Initialize App ───
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();     // Load library & wallet from localStorage
  loadPopularGames();    // Fetch popular games on load
  updateUI();            // Update all UI counters

  // Enable Enter key on search input
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchGames();
  });
});

// ══════════════════════════════════════════════
//  API Functions - Fetch real game data
// ══════════════════════════════════════════════

/**
 * Loads the most popular games from RAWG API
 * Displays trending titles on the store front page
 */
async function loadPopularGames() {
  showLoader(true);
  try {
    const res = await fetch(`${API_BASE}/games?key=${API_KEY}&ordering=-rating&page_size=20`);
    const data = await res.json();
    renderGameGrid(data.results);
  } catch (err) {
    console.error('Error loading popular games:', err);
    showToast('Error al cargar juegos. Verifica tu conexión.', 'error');
  }
  showLoader(false);
}

/**
 * Searches for games by user query
 * Updates store title and subtitle to reflect search results
 */
async function searchGames() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) {
    loadPopularGames();
    document.getElementById('store-title').textContent = '🔥 Juegos Populares';
    document.getElementById('store-subtitle').textContent = 'Los más jugados esta semana';
    return;
  }

  state.searchQuery = query;
  showLoader(true);
  document.getElementById('game-grid').innerHTML = '';
  document.getElementById('store-title').textContent = `🔍 Resultados: "${query}"`;
  document.getElementById('store-subtitle').textContent = 'Buscando...';

  try {
    const res = await fetch(`${API_BASE}/games?key=${API_KEY}&search=${encodeURIComponent(query)}&page_size=20`);
    const data = await res.json();
    document.getElementById('store-subtitle').textContent = `${data.results.length} juegos encontrados`;
    renderGameGrid(data.results);
  } catch (err) {
    console.error('Search error:', err);
    showToast('Error en la búsqueda.', 'error');
  }
  showLoader(false);
}

/**
 * Fetches detailed information about a specific game
 * @param {number} gameId - RAWG game ID
 * @returns {Object} Detailed game data
 */
async function fetchGameDetails(gameId) {
  try {
    const res = await fetch(`${API_BASE}/games/${gameId}?key=${API_KEY}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching game details:', err);
    return null;
  }
}

// ══════════════════════════════════════════════
//  Rendering Functions - Build the UI
// ══════════════════════════════════════════════

/**
 * Renders the game grid on the store page
 * Each card shows the game image, title, rating, and simulated price
 * @param {Array} games - Array of game objects from RAWG API
 */
function renderGameGrid(games) {
  const grid = document.getElementById('game-grid');
  grid.innerHTML = '';

  if (!games || games.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🎮</div>
        <div class="empty-state-title">No se encontraron juegos</div>
        <p>Intenta con otro término de búsqueda</p>
      </div>`;
    return;
  }

  games.forEach(game => {
    const price = generatePrice(game);
    const owned = isOwned(game.id);
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => openGameModal(game.id);

    card.innerHTML = `
      <div class="game-card-img-wrapper">
        <img class="game-card-img"
             src="${game.background_image || 'https://placehold.co/400x225/1a1a2e/6366f1?text=No+Image'}"
             alt="${game.name}"
             loading="lazy">
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${game.name}</div>
        <div class="game-card-meta">
          <span class="game-card-rating">⭐ ${game.rating?.toFixed(1) || 'N/A'}</span>
          <span class="game-card-price ${price === 0 ? 'free' : ''}">
            ${owned ? '✅ En biblioteca' : (price === 0 ? 'GRATIS' : price.toFixed(2) + '€')}
          </span>
        </div>
        <div class="game-card-platforms">
          ${(game.platforms || []).slice(0, 3).map(p =>
            `<span class="platform-tag">${getPlatformIcon(p.platform.name)}</span>`
          ).join('')}
        </div>
      </div>`;

    grid.appendChild(card);
  });
}

/**
 * Opens the detail modal for a specific game
 * Fetches full game details and displays them
 * @param {number} gameId - RAWG game ID
 */
async function openGameModal(gameId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('visible');

  // Show loading state in modal
  document.getElementById('modal-title').textContent = 'Cargando...';
  document.getElementById('modal-desc').textContent = '';
  document.getElementById('modal-genres').innerHTML = '';
  document.getElementById('modal-info-grid').innerHTML = '';

  const game = await fetchGameDetails(gameId);
  if (!game) {
    closeModalForce();
    showToast('No se pudieron cargar los detalles.', 'error');
    return;
  }

  state.currentGame = game;
  const price = generatePrice(game);
  const owned = isOwned(game.id);
  const inCart = state.cart.some(g => g.id === game.id);

  // Populate modal
  document.getElementById('modal-hero').src = game.background_image || '';
  document.getElementById('modal-title').textContent = game.name;
  document.getElementById('modal-stars').textContent = '⭐'.repeat(Math.round(game.rating || 0));
  document.getElementById('modal-rating-text').textContent =
    `${game.rating?.toFixed(1) || '?'} / 5  •  ${game.ratings_count || 0} valoraciones`;

  // Strip HTML tags from description
  const cleanDesc = game.description
    ? game.description.replace(/<[^>]*>/g, '').substring(0, 500)
    : 'Sin descripción disponible.';
  document.getElementById('modal-desc').textContent = cleanDesc;

  // Genres
  document.getElementById('modal-genres').innerHTML = (game.genres || [])
    .map(g => `<span class="genre-tag">${g.name}</span>`).join('');

  // Info grid
  document.getElementById('modal-info-grid').innerHTML = `
    <div class="modal-info-item">
      <div class="modal-info-label">Lanzamiento</div>
      <div class="modal-info-value">${game.released || 'TBA'}</div>
    </div>
    <div class="modal-info-item">
      <div class="modal-info-label">Metacritic</div>
      <div class="modal-info-value">${game.metacritic || '—'}</div>
    </div>
    <div class="modal-info-item">
      <div class="modal-info-label">Desarrollador</div>
      <div class="modal-info-value">${(game.developers || []).map(d => d.name).join(', ') || '—'}</div>
    </div>
    <div class="modal-info-item">
      <div class="modal-info-label">Plataformas</div>
      <div class="modal-info-value">${(game.platforms || []).map(p => p.platform.name).slice(0, 4).join(', ') || '—'}</div>
    </div>`;

  // Price & button
  document.getElementById('modal-price').textContent =
    price === 0 ? 'GRATIS' : `${price.toFixed(2)}€`;

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
 * Renders the user's game library
 * Shows all purchased games with purchase date
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
    <div class="library-card" onclick="openGameModal(${game.id})">
      <img class="library-card-img"
           src="${game.image || ''}"
           alt="${game.name}"
           loading="lazy">
      <div class="library-card-info">
        <div class="library-card-title">${game.name}</div>
        <div class="library-card-date">Comprado: ${game.purchaseDate}</div>
      </div>
    </div>
  `).join('');
}

/**
 * Renders the shopping cart
 * Shows items in cart with remove option and total price
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

  const total = state.cart.reduce((sum, g) => sum + g.price, 0);
  document.getElementById('cart-total').textContent = `${total.toFixed(2)}€`;
  summary.style.display = 'block';

  // Disable purchase button if not enough funds
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
      <img class="library-card-img"
           src="${game.image || ''}"
           alt="${game.name}"
           loading="lazy">
      <div class="library-card-info">
        <div class="library-card-title">${game.name}</div>
        <div class="library-card-date" style="color: var(--accent-green); font-weight:600;">
          ${game.price === 0 ? 'GRATIS' : game.price.toFixed(2) + '€'}
        </div>
      </div>
      <button onclick="removeFromCart(${i})" style="
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.2);
        color: var(--accent-red);
        padding: 0.5rem 0.8rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 0.8rem;
        align-self: center;
      ">🗑️ Quitar</button>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════
//  Commerce Functions - Cart & Purchase logic
// ══════════════════════════════════════════════

/**
 * Adds the currently viewed game (from modal) to the cart
 * Validates that the game isn't already owned or in the cart
 */
function buyFromModal() {
  const game = state.currentGame;
  if (!game) return;

  if (isOwned(game.id)) {
    showToast('Ya tienes este juego en tu biblioteca.', 'error');
    return;
  }

  if (state.cart.some(g => g.id === game.id)) {
    showToast('Este juego ya está en tu carrito.', 'error');
    return;
  }

  const price = generatePrice(game);
  state.cart.push({
    id: game.id,
    name: game.name,
    image: game.background_image,
    price: price,
  });

  showToast(`"${game.name}" añadido al carrito.`, 'success');
  updateUI();
  closeModalForce();
}

/**
 * Removes a game from the cart by index
 * @param {number} index - Index in the cart array
 */
function removeFromCart(index) {
  const removed = state.cart.splice(index, 1);
  showToast(`"${removed[0].name}" eliminado del carrito.`, 'success');
  updateUI();
  renderCart();
}

/**
 * Purchases all games in the cart
 * Deducts the total from the wallet and moves games to the library
 * Saves the updated state to localStorage
 */
function purchaseCart() {
  const total = state.cart.reduce((sum, g) => sum + g.price, 0);

  if (total > state.wallet) {
    showToast('Saldo insuficiente para completar la compra.', 'error');
    return;
  }

  // Deduct from wallet
  state.wallet -= total;
  state.wallet = Math.round(state.wallet * 100) / 100; // Fix floating point

  // Move each game to library
  const today = new Date().toLocaleDateString('es-ES');
  state.cart.forEach(game => {
    if (!isOwned(game.id)) {
      state.library.push({
        id: game.id,
        name: game.name,
        image: game.image,
        price: game.price,
        purchaseDate: today,
      });
    }
  });

  // Clear cart and save
  state.cart = [];
  saveToStorage();
  updateUI();
  renderCart();

  showToast(`¡Compra realizada! -${total.toFixed(2)}€`, 'success');
}

// ══════════════════════════════════════════════
//  Utility Functions
// ══════════════════════════════════════════════

/**
 * Generates a simulated price based on game rating and metacritic score
 * Higher rated games cost more, creating a realistic pricing model
 * @param {Object} game - Game object from RAWG API
 * @returns {number} Simulated price in euros
 */
function generatePrice(game) {
  // Use game ID as seed for consistent pricing
  const seed = game.id || 0;
  const rating = game.rating || 3;
  const metacritic = game.metacritic || 70;

  // Base price between 5-60€ influenced by rating and metacritic
  const base = (rating * 8) + (metacritic * 0.2) + (seed % 10);
  const price = Math.round(Math.min(Math.max(base, 4.99), 69.99) * 100) / 100;

  // Some games are free (low rating, old games)
  if (rating < 2.5 && metacritic < 50) return 0;

  return price;
}

/**
 * Checks if a game is already in the user's library
 * @param {number} gameId - RAWG game ID
 * @returns {boolean} True if the game is owned
 */
function isOwned(gameId) {
  return state.library.some(g => g.id === gameId);
}

/**
 * Returns a short platform icon/label based on platform name
 * @param {string} name - Platform name from API
 * @returns {string} Short platform label
 */
function getPlatformIcon(name) {
  const map = {
    'PC': '🖥 PC',
    'PlayStation 5': '🎮 PS5',
    'PlayStation 4': '🎮 PS4',
    'Xbox One': '🟢 Xbox',
    'Xbox Series S/X': '🟢 XSX',
    'Nintendo Switch': '🔴 Switch',
    'macOS': '🍎 Mac',
    'Linux': '🐧 Linux',
    'iOS': '📱 iOS',
    'Android': '📱 Android',
  };
  return map[name] || name;
}

// ══════════════════════════════════════════════
//  UI Helper Functions
// ══════════════════════════════════════════════

/**
 * Switches between Store, Library, and Cart pages
 * @param {string} page - Page identifier: 'store', 'library', or 'cart'
 */
function showPage(page) {
  // Hide all pages
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Show selected page
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`).classList.add('active');

  // Re-render page content
  if (page === 'library') renderLibrary();
  if (page === 'cart') renderCart();
}

/**
 * Updates all UI counters (cart badge, library badge, wallet)
 */
function updateUI() {
  // Cart badge
  const cartBadge = document.getElementById('cart-count');
  cartBadge.textContent = state.cart.length;
  cartBadge.classList.toggle('visible', state.cart.length > 0);

  // Library badge
  const libBadge = document.getElementById('library-count');
  libBadge.textContent = state.library.length;
  libBadge.classList.toggle('visible', state.library.length > 0);

  // Wallet
  document.getElementById('wallet-amount').textContent = state.wallet.toFixed(2);
}

/**
 * Shows or hides the loading spinner
 * @param {boolean} show - Whether to show the loader
 */
function showLoader(show) {
  document.getElementById('store-loader').style.display = show ? 'flex' : 'none';
}

/**
 * Displays a toast notification
 * @param {string} message - Notification text
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Closes the modal if the user clicks outside of it
 * @param {Event} e - Click event
 */
function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) {
    closeModalForce();
  }
}

/** Force-closes the game detail modal */
function closeModalForce() {
  document.getElementById('modal-overlay').classList.remove('visible');
  state.currentGame = null;
}

// ══════════════════════════════════════════════
//  LocalStorage Persistence
// ══════════════════════════════════════════════

/**
 * Saves the library and wallet state to localStorage
 * Called after every purchase transaction
 */
function saveToStorage() {
  localStorage.setItem('steamvault_library', JSON.stringify(state.library));
  localStorage.setItem('steamvault_wallet', JSON.stringify(state.wallet));
}

/**
 * Loads saved library and wallet data from localStorage
 * Called once on app initialization
 */
function loadFromStorage() {
  const lib = localStorage.getItem('steamvault_library');
  const wallet = localStorage.getItem('steamvault_wallet');
  if (lib) state.library = JSON.parse(lib);
  if (wallet) state.wallet = JSON.parse(wallet);
}
