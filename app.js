/* SteamVault — Steam Clone | CheapShark API */
const API_BASE = 'https://www.cheapshark.com/api/1.0';
const state = { wallet: 250, cart: [], library: [], wishlist: [], currentDeals: [], currentGame: null, featIdx: 0, featTimer: null };

// Filter out DLCs, editions, bundles — only base games
var DLC_WORDS = ['dlc', 'edition', 'pack', 'bundle', 'collection', 'season pass', 'upgrade', 'expansion', 'add-on', 'addon', 'soundtrack', 'art book', 'artbook', 'costume', 'skin pack', 'character pack', 'starter pack', 'booster', 'premium', 'gold edition', 'silver edition', 'bronze edition'];
function isBaseGame(title) {
  var low = title.toLowerCase();
  for (var i = 0; i < DLC_WORDS.length; i++) { if (low.indexOf(DLC_WORDS[i]) >= 0) return false; }
  return true;
}

document.addEventListener('DOMContentLoaded', function() {
  loadFromStorage(); loadPopularGames(); updateUI();
  document.getElementById('search-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') searchGames(); });
});

// ── API ──
async function loadPopularGames() {
  showLoader(true);
  try {
    var r = await fetch(API_BASE + '/deals?pageSize=60&sortBy=Deal%20Rating');
    var data = await r.json();
    var seen = new Set();
    var unique = data.filter(function(d) { if (seen.has(d.title)) return false; seen.add(d.title); return true; });
    var games = unique.filter(function(d) { return isBaseGame(d.title); });
    state.currentDeals = games;
    renderFeatured(games.slice(0, 5));
    renderGameGrid(games);
  } catch (e) { showToast('Error loading games.', 'error'); }
  showLoader(false);
}

async function searchGames() {
  var q = document.getElementById('search-input').value.trim();
  if (!q) { loadPopularGames(); document.getElementById('store-title').textContent = 'Special Offers'; return; }
  showLoader(true); document.getElementById('game-grid').innerHTML = '';
  document.getElementById('store-title').textContent = 'Results for "' + q + '"';
  document.getElementById('featured-section').innerHTML = '';
  try {
    var r = await fetch(API_BASE + '/deals?title=' + encodeURIComponent(q) + '&pageSize=60');
    var data = await r.json();
    var seen = new Set();
    var unique = data.filter(function(d) { if (seen.has(d.title)) return false; seen.add(d.title); return true; });
    var games = unique.filter(function(d) { return isBaseGame(d.title); });
    state.currentDeals = games;
    document.getElementById('store-subtitle').textContent = games.length + ' games found';
    renderGameGrid(games);
  } catch (e) { showToast('Search error.', 'error'); }
  showLoader(false);
}

// Multiple image sources with fallbacks
function getImg(deal) {
  if (deal.steamAppID) return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + deal.steamAppID + '/header.jpg';
  return deal.thumb || '';
}
function getCapsule(deal) {
  if (deal.steamAppID) return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + deal.steamAppID + '/capsule_616x353.jpg';
  return getImg(deal);
}
function getHero(deal) {
  if (deal.steamAppID) return 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + deal.steamAppID + '/library_hero.jpg';
  return getCapsule(deal);
}

// Robust image loader with multiple fallbacks
function loadImage(img, sources) {
  if (!sources || sources.length === 0) { img.style.background = '#1b2838'; return; }
  var idx = 0;
  function tryNext() {
    if (idx >= sources.length) { img.style.background = 'linear-gradient(135deg,#1b2838,#2a475e)'; img.alt = 'No image'; return; }
    img.src = sources[idx]; idx++;
  }
  img.onerror = tryNext;
  tryNext();
}

// ── FEATURED CAROUSEL ──
var featuredDeals = [];
function renderFeatured(deals) {
  featuredDeals = deals;
  if (state.featTimer) clearInterval(state.featTimer);
  state.featIdx = 0;
  showFeaturedSlide(0);
  state.featTimer = setInterval(function() {
    state.featIdx = (state.featIdx + 1) % featuredDeals.length;
    showFeaturedSlide(state.featIdx);
  }, 6000);
}

function showFeaturedSlide(idx) {
  var deal = featuredDeals[idx];
  if (!deal) return;
  var sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
  var disc = Math.round(parseFloat(deal.savings));
  var sec = document.getElementById('featured-section');

  var priceHTML = '';
  if (sp === 0) {
    priceHTML = '<span style="color:#67c1f5;">Free to Play</span>';
  } else {
    priceHTML = (disc > 0 ? '<span style="background:#a4d007;color:#000;padding:2px 6px;border-radius:2px;font-weight:700;margin-right:6px;">-' + disc + '%</span>' : '') +
      (np > sp ? '<span style="text-decoration:line-through;color:#8f98a0;font-size:0.8rem;margin-right:4px;">' + np.toFixed(2) + '€</span>' : '') +
      '<span style="color:#a4d007;font-weight:600;">' + sp.toFixed(2) + '€</span>';
  }

  var dotsHTML = '';
  for (var i = 0; i < featuredDeals.length; i++) {
    dotsHTML += '<button class="carousel-dot ' + (i === idx ? 'active' : '') + '" onclick="goFeatured(' + i + ')"></button>';
  }

  sec.innerHTML = '<div class="featured-label">Featured & Recommended</div>' +
    '<div class="featured-carousel" onclick="openGameModal(featuredDeals[' + idx + '])" style="cursor:pointer;">' +
      '<div class="featured-main"><img id="feat-img" alt="' + deal.title + '" style="width:100%;height:100%;object-fit:cover;"></div>' +
      '<div class="featured-info">' +
        '<div><div class="featured-title">' + deal.title + '</div>' +
        '<div class="featured-thumbs"><img id="feat-th1" alt="thumb"><img id="feat-th2" alt="thumb"></div></div>' +
        '<div class="featured-bottom">' +
          (disc > 20 ? '<span class="featured-tag">Top Seller</span>' : '') +
          '<div class="featured-price">' + priceHTML + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="carousel-dots">' + dotsHTML + '</div>';

  // Load images with fallbacks
  loadImage(document.getElementById('feat-img'), [getCapsule(deal), getHero(deal), getImg(deal), deal.thumb]);
  loadImage(document.getElementById('feat-th1'), [getImg(deal), deal.thumb]);
  loadImage(document.getElementById('feat-th2'), [deal.thumb, getImg(deal)]);
}

function goFeatured(i) { state.featIdx = i; showFeaturedSlide(i); }

// ── GAME GRID ──
function renderGameGrid(deals) {
  var grid = document.getElementById('game-grid');
  grid.innerHTML = '';
  if (!deals || !deals.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🎮</div><div class="empty-state-title">No games found</div></div>';
    return;
  }
  deals.forEach(function(deal, index) {
    var sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
    var owned = isOwned(deal.gameID), disc = Math.round(parseFloat(deal.savings));
    var card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = function() { openGameModal(deal); };

    var priceHTML = '';
    if (owned) {
      priceHTML = '<span class="game-card-owned">✓ In Library</span>';
    } else {
      priceHTML = '<div class="game-card-prices">' +
        (np > sp && sp > 0 ? '<span class="game-card-original">' + np.toFixed(2) + '€</span>' : '') +
        '<span class="game-card-sale' + (sp === 0 ? ' free' : '') + '">' + (sp === 0 ? 'Free' : sp.toFixed(2) + '€') + '</span></div>';
    }

    card.innerHTML = '<div class="game-card-img-wrap">' +
      '<img class="game-card-img" id="card-img-' + index + '" alt="' + deal.title + '" loading="lazy" style="background:linear-gradient(135deg,#1b2838,#2a475e);">' +
      (disc > 0 ? '<div class="game-card-discount">-' + disc + '%</div>' : '') +
      '</div><div class="game-card-body">' +
      '<div class="game-card-title">' + deal.title + '</div>' +
      '<div class="game-card-meta">' +
      '<span class="game-card-rating">' + (deal.steamRatingText ? '⭐ ' + deal.steamRatingPercent + '%' : '') + '</span>' +
      priceHTML + '</div></div>';

    grid.appendChild(card);
    // Load image with fallbacks after DOM insertion
    loadImage(card.querySelector('.game-card-img'), [getImg(deal), getCapsule(deal), deal.thumb]);
  });
}

// ── MODAL ──
function openGameModal(deal) {
  document.getElementById('modal-overlay').classList.add('visible');
  state.currentGame = deal;
  var sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
  var owned = isOwned(deal.gameID), inCart = state.cart.some(function(g) { return g.gameID === deal.gameID; });
  var disc = Math.round(parseFloat(deal.savings));
  var inWish = state.wishlist.some(function(g) { return g.gameID === deal.gameID; });
  var release = deal.releaseDate > 0 ? new Date(deal.releaseDate * 1000).toLocaleDateString('es-ES') : '—';
  var ratingClass = !deal.steamRatingText ? 'neutral' : (deal.steamRatingText.indexOf('Positive') >= 0 ? 'positive' : (deal.steamRatingText.indexOf('Mixed') >= 0 ? 'mixed' : 'negative'));

  // Hero image with fallbacks
  var heroImg = document.getElementById('modal-hero');
  loadImage(heroImg, [getCapsule(deal), getHero(deal), getImg(deal), deal.thumb]);

  document.getElementById('modal-title').textContent = deal.title;
  document.getElementById('modal-rating-tag').textContent = deal.steamRatingText || 'No Reviews';
  document.getElementById('modal-rating-tag').className = 'modal-rating-tag ' + ratingClass;
  document.getElementById('modal-rating-count').textContent = deal.steamRatingCount ? '(' + parseInt(deal.steamRatingCount).toLocaleString() + ' reviews)' : '';
  document.getElementById('modal-desc').textContent = 'Get ' + deal.title + ' at an incredible price. ' +
    (disc > 0 ? 'Save ' + disc + '% off the original ' + np.toFixed(2) + '€! ' : '') +
    (deal.metacriticScore > 0 ? 'Metacritic: ' + deal.metacriticScore + '/100.' : '');

  // Screenshots with fallbacks
  var ssContainer = document.getElementById('modal-screenshots');
  ssContainer.innerHTML = '<img id="modal-ss1" alt="screenshot"><img id="modal-ss2" alt="screenshot">';
  loadImage(document.getElementById('modal-ss1'), [getImg(deal), deal.thumb]);
  loadImage(document.getElementById('modal-ss2'), [deal.thumb, getImg(deal)]);

  document.getElementById('purchase-title').textContent = 'Buy ' + deal.title;
  var discBadge = document.getElementById('modal-discount');
  if (disc > 0) { discBadge.textContent = '-' + disc + '%'; discBadge.style.display = 'inline'; }
  else { discBadge.style.display = 'none'; }
  document.getElementById('modal-price-original').textContent = np > sp ? np.toFixed(2) + '€' : '';
  document.getElementById('modal-price-final').textContent = sp === 0 ? 'Free to Play' : sp.toFixed(2) + '€';

  var buyBtn = document.getElementById('modal-buy-btn');
  if (owned) { buyBtn.textContent = '✓ In Library'; buyBtn.className = 'btn-add-cart owned'; }
  else if (inCart) { buyBtn.textContent = '✓ In Cart'; buyBtn.className = 'btn-add-cart owned'; }
  else { buyBtn.textContent = 'Add to Cart'; buyBtn.className = 'btn-add-cart'; }

  document.getElementById('modal-wish-btn').textContent = inWish ? '💜' : '🤍';

  document.getElementById('modal-info-panel').innerHTML =
    '<div class="info-item"><div class="info-label">Release Date</div><div class="info-value">' + release + '</div></div>' +
    '<div class="info-item"><div class="info-label">Metacritic</div><div class="info-value">' + (deal.metacriticScore || '—') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Discount</div><div class="info-value" style="color:var(--green-price);">' + (disc > 0 ? '-' + disc + '%' : 'None') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Original Price</div><div class="info-value">' + np.toFixed(2) + '€</div></div>' +
    '<div class="info-item"><div class="info-label">Steam Rating</div><div class="info-value">' + (deal.steamRatingText || '—') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Reviews</div><div class="info-value">' + (deal.steamRatingCount ? parseInt(deal.steamRatingCount).toLocaleString() : '—') + '</div></div>';
}

// ── LIST RENDERERS ──
function renderLibrary() {
  var list = document.getElementById('library-list');
  document.getElementById('library-subtitle').textContent = state.library.length + ' games';
  if (!state.library.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">Your library is empty</div></div>'; return; }
  list.innerHTML = state.library.map(function(g) {
    return '<div class="library-card"><img class="library-card-img" src="' + g.image + '" alt="' + g.name + '" loading="lazy" onerror="this.style.background=\'linear-gradient(135deg,#1b2838,#2a475e)\';this.onerror=null;"><div class="library-card-info"><div class="library-card-title">' + g.name + '</div><div class="library-card-date">Purchased: ' + g.purchaseDate + ' — ' + (g.price === 0 ? 'Free' : g.price.toFixed(2) + '€') + '</div></div></div>';
  }).join('');
}

function renderWishlist() {
  var list = document.getElementById('wishlist-list');
  document.getElementById('wishlist-subtitle').textContent = state.wishlist.length + ' games';
  if (!state.wishlist.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤍</div><div class="empty-state-title">Your wishlist is empty</div></div>'; return; }
  list.innerHTML = state.wishlist.map(function(g, i) {
    return '<div class="library-card"><img class="library-card-img" src="' + g.image + '" alt="' + g.name + '" loading="lazy" onerror="this.style.background=\'linear-gradient(135deg,#1b2838,#2a475e)\';this.onerror=null;"><div class="library-card-info"><div class="library-card-title">' + g.name + '</div><div class="library-card-date">Added: ' + g.addedDate + ' — ' + (g.price === 0 ? 'Free' : g.price.toFixed(2) + '€') + '</div></div><button class="library-card-btn wish-remove" onclick="removeFromWishlist(' + i + ')">✕ Remove</button></div>';
  }).join('');
}

function renderCart() {
  var list = document.getElementById('cart-list'), summary = document.getElementById('cart-summary');
  document.getElementById('cart-subtitle').textContent = state.cart.length + ' items';
  if (!state.cart.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-title">Your cart is empty</div></div>'; summary.style.display = 'none'; return; }
  var total = state.cart.reduce(function(s, g) { return s + g.price; }, 0);
  document.getElementById('cart-total').textContent = total.toFixed(2) + '€';
  summary.style.display = 'flex';
  var btn = document.getElementById('btn-purchase-cart');
  btn.className = total > state.wallet ? 'btn-purchase disabled' : 'btn-purchase';
  btn.textContent = total > state.wallet ? 'Insufficient funds' : 'Purchase for myself';
  list.innerHTML = state.cart.map(function(g, i) {
    return '<div class="library-card"><img class="library-card-img" src="' + g.image + '" alt="' + g.name + '" loading="lazy" onerror="this.style.background=\'linear-gradient(135deg,#1b2838,#2a475e)\';this.onerror=null;"><div class="library-card-info"><div class="library-card-title">' + g.name + '</div><div class="library-card-date" style="color:var(--green-price);font-weight:600;">' + (g.price === 0 ? 'Free' : g.price.toFixed(2) + '€') + '</div></div><button class="library-card-btn" onclick="removeFromCart(' + i + ')">✕ Remove</button></div>';
  }).join('');
}

// ── COMMERCE ──
function buyFromModal() {
  var d = state.currentGame; if (!d) return;
  if (isOwned(d.gameID)) { showToast('Already in library.', 'error'); return; }
  if (state.cart.some(function(g) { return g.gameID === d.gameID; })) { showToast('Already in cart.', 'error'); return; }
  state.cart.push({ gameID: d.gameID, name: d.title, image: getImg(d), price: parseFloat(d.salePrice) });
  showToast('"' + d.title + '" added to cart.', 'success'); updateUI(); closeModalForce();
}
function removeFromCart(i) { var r = state.cart.splice(i, 1); showToast('"' + r[0].name + '" removed.', 'success'); updateUI(); renderCart(); }
function purchaseCart() {
  var total = state.cart.reduce(function(s, g) { return s + g.price; }, 0);
  if (total > state.wallet) { showToast('Insufficient funds.', 'error'); return; }
  state.wallet -= total; state.wallet = Math.round(state.wallet * 100) / 100;
  var today = new Date().toLocaleDateString('es-ES');
  state.cart.forEach(function(g) { if (!isOwned(g.gameID)) state.library.push({ gameID: g.gameID, name: g.name, image: g.image, price: g.price, purchaseDate: today }); });
  var c = state.cart.length; state.cart = [];
  saveToStorage(); updateUI(); renderCart();
  showToast(c + ' game(s) purchased! -' + total.toFixed(2) + '€', 'success');
}
function toggleWishlist() {
  var d = state.currentGame; if (!d) return;
  var idx = -1; state.wishlist.forEach(function(g, i) { if (g.gameID === d.gameID) idx = i; });
  if (idx !== -1) { state.wishlist.splice(idx, 1); showToast('Removed from wishlist.', 'success'); }
  else { state.wishlist.push({ gameID: d.gameID, name: d.title, image: getImg(d), price: parseFloat(d.salePrice), normalPrice: parseFloat(d.normalPrice), addedDate: new Date().toLocaleDateString('es-ES') }); showToast('Added to wishlist! 💜', 'success'); }
  saveToStorage(); updateUI(); closeModalForce();
}
function removeFromWishlist(i) { state.wishlist.splice(i, 1); showToast('Removed from wishlist.', 'success'); saveToStorage(); updateUI(); renderWishlist(); }
function sortGames() {
  var s = document.getElementById('sort-select').value, d = state.currentDeals.slice();
  if (s === 'price') d.sort(function(a, b) { return parseFloat(a.salePrice) - parseFloat(b.salePrice); });
  else if (s === 'title') d.sort(function(a, b) { return a.title.localeCompare(b.title); });
  else if (s === 'metacritic') d.sort(function(a, b) { return (parseInt(b.metacriticScore) || 0) - (parseInt(a.metacriticScore) || 0); });
  renderGameGrid(d);
}

// ── UTILITY ──
function isOwned(id) { return state.library.some(function(g) { return g.gameID === id; }); }
function showPage(page) {
  document.querySelectorAll('.page-view').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('nav-' + page).classList.add('active');
  if (page === 'library') renderLibrary();
  if (page === 'wishlist') renderWishlist();
  if (page === 'cart') renderCart();
}
function updateUI() {
  var cb = document.getElementById('cart-count'); cb.textContent = state.cart.length; cb.classList.toggle('visible', state.cart.length > 0);
  var lb = document.getElementById('library-count'); lb.textContent = state.library.length; lb.classList.toggle('visible', state.library.length > 0);
  var wb = document.getElementById('wishlist-count'); wb.textContent = state.wishlist.length; wb.classList.toggle('visible', state.wishlist.length > 0);
  document.getElementById('wallet-amount').textContent = state.wallet.toFixed(2);
}
function showLoader(s) { document.getElementById('store-loader').style.display = s ? 'flex' : 'none'; }
function showToast(msg, type) {
  var c = document.getElementById('toast-container'), t = document.createElement('div');
  t.className = 'toast ' + (type || 'success'); t.innerHTML = '<span>' + (type === 'error' ? '❌' : '✅') + '</span> ' + msg;
  c.appendChild(t); setTimeout(function() { t.remove(); }, 3000);
}
function closeModal(e) { if (e.target === document.getElementById('modal-overlay')) closeModalForce(); }
function closeModalForce() { document.getElementById('modal-overlay').classList.remove('visible'); state.currentGame = null; }

// ── PERSISTENCE ──
function saveToStorage() {
  localStorage.setItem('sv_lib', JSON.stringify(state.library));
  localStorage.setItem('sv_wallet', JSON.stringify(state.wallet));
  localStorage.setItem('sv_wish', JSON.stringify(state.wishlist));
}
function loadFromStorage() {
  var l = localStorage.getItem('sv_lib'), w = localStorage.getItem('sv_wallet'), ws = localStorage.getItem('sv_wish');
  if (l) state.library = JSON.parse(l); if (w) state.wallet = JSON.parse(w); if (ws) state.wishlist = JSON.parse(ws);
}
