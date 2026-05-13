/* SteamVault — Steam Clone | No emojis | CheapShark API */
var API_BASE = 'https://www.cheapshark.com/api/1.0';
var state = { wallet: 250, cart: [], library: [], wishlist: [], currentDeals: [], currentGame: null, featIdx: 0, featTimer: null };

var DLC_WORDS = ['dlc','edition','pack','bundle','collection','season pass','upgrade','expansion','add-on','addon','soundtrack','artbook','costume','skin pack','character pack','starter pack','booster','premium'];
function isBaseGame(t) { var l = t.toLowerCase(); for (var i = 0; i < DLC_WORDS.length; i++) if (l.indexOf(DLC_WORDS[i]) >= 0) return false; return true; }

document.addEventListener('DOMContentLoaded', function() {
  loadFromStorage(); loadPopularGames(); updateUI();
  document.getElementById('search-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') searchGames(); });
});

// Image helpers
function getImg(d) { return d.steamAppID ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + d.steamAppID + '/header.jpg' : (d.thumb || ''); }
function getCapsule(d) { return d.steamAppID ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + d.steamAppID + '/capsule_616x353.jpg' : getImg(d); }
function getSmall(d) { return d.steamAppID ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + d.steamAppID + '/capsule_231x87.jpg' : (d.thumb || ''); }
function getSS(d, n) { return d.steamAppID ? 'https://cdn.cloudflare.steamstatic.com/steam/apps/' + d.steamAppID + '/ss_' + ['04','05','06','07'][n || 0] + '.jpg' : ''; }
function loadImage(img, srcs) { if (!srcs || !srcs.length) { img.style.background = 'linear-gradient(135deg,#1b2838,#2a475e)'; return; } var i = 0; function go() { if (i >= srcs.length) { img.style.background = 'linear-gradient(135deg,#1b2838,#2a475e)'; return; } img.src = srcs[i]; i++; } img.onerror = go; go(); }

// API
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

// Featured carousel
var featuredDeals = [];
function renderFeatured(deals) {
  featuredDeals = deals;
  if (state.featTimer) clearInterval(state.featTimer);
  state.featIdx = 0;
  showFeaturedSlide(0);
  state.featTimer = setInterval(function() { state.featIdx = (state.featIdx + 1) % featuredDeals.length; showFeaturedSlide(state.featIdx); }, 6000);
}
function showFeaturedSlide(idx) {
  var d = featuredDeals[idx]; if (!d) return;
  var sp = parseFloat(d.salePrice), np = parseFloat(d.normalPrice), disc = Math.round(parseFloat(d.savings));
  var price = sp === 0 ? '<span style="color:#67c1f5;">Free to Play</span>' :
    (disc > 0 ? '<span style="background:#a4d007;color:#1b2838;padding:2px 5px;border-radius:2px;font-weight:700;font-size:.75rem;margin-right:5px;">-' + disc + '%</span>' : '') +
    (np > sp ? '<span style="text-decoration:line-through;color:#8f98a0;font-size:.75rem;margin-right:4px;">' + np.toFixed(2) + ' EUR</span>' : '') +
    '<span style="color:#a4d007;font-weight:600;">' + sp.toFixed(2) + ' EUR</span>';

  var dots = '';
  for (var i = 0; i < featuredDeals.length; i++) dots += '<button class="carousel-dot ' + (i === idx ? 'active' : '') + '" onclick="goFeatured(' + i + ')"></button>';

  var sec = document.getElementById('featured-section');
  sec.innerHTML = '<div class="featured-label">Featured &amp; Recommended</div>' +
    '<div class="featured-carousel" onclick="openGameModal(featuredDeals[' + idx + '])">' +
    '<div class="featured-main"><img id="feat-img" alt="featured"></div>' +
    '<div class="featured-info"><div><div class="featured-title">' + d.title + '</div>' +
    '<div class="featured-thumbs"><img id="feat-th1" alt=""><img id="feat-th2" alt=""></div></div>' +
    '<div class="featured-bottom">' + (disc > 20 ? '<span class="featured-tag">Top Seller</span>' : '') +
    '<div class="featured-price">' + price + '</div></div></div></div>' +
    '<div class="carousel-dots">' + dots + '</div>';
  loadImage(document.getElementById('feat-img'), [getCapsule(d), getImg(d), d.thumb]);
  loadImage(document.getElementById('feat-th1'), [getImg(d), d.thumb]);
  loadImage(document.getElementById('feat-th2'), [d.thumb, getImg(d)]);
}
function goFeatured(i) { state.featIdx = i; showFeaturedSlide(i); }

// Game grid — Steam horizontal rows
function renderGameGrid(deals) {
  var grid = document.getElementById('game-grid');
  grid.innerHTML = '';
  if (!deals || !deals.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">No results</div><div class="empty-state-title">No games found</div></div>';
    return;
  }
  deals.forEach(function(deal, index) {
    var sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
    var owned = isOwned(deal.gameID), disc = Math.round(parseFloat(deal.savings));
    var row = document.createElement('div');
    row.className = 'game-row';
    row.onclick = function() { openGameModal(deal); };

    // Tags from rating
    var tags = '';
    if (deal.steamRatingText) tags += '<span class="game-row-tag">' + deal.steamRatingText + '</span>';
    if (deal.metacriticScore > 0) tags += '<span class="game-row-tag">MC: ' + deal.metacriticScore + '</span>';

    // Price area
    var priceHTML = '';
    if (owned) {
      priceHTML = '<span class="game-row-owned">In Library</span>';
    } else {
      if (disc > 0) priceHTML += '<span class="game-row-discount">-' + disc + '%</span>';
      if (np > sp && sp > 0) priceHTML += '<span class="game-row-original">' + np.toFixed(2) + ' EUR</span>';
      priceHTML += '<span class="game-row-final' + (sp === 0 ? ' free' : '') + '">' + (sp === 0 ? 'Free to Play' : sp.toFixed(2) + ' EUR') + '</span>';
    }

    row.innerHTML = '<img class="game-row-img" id="row-img-' + index + '" alt="' + deal.title + '">' +
      '<span class="game-row-name">' + deal.title + '</span>' +
      '<div class="game-row-tags">' + tags + '</div>' +
      '<div class="game-row-price-area">' + priceHTML + '</div>';

    grid.appendChild(row);
    loadImage(row.querySelector('.game-row-img'), [getSmall(deal), getImg(deal), deal.thumb]);

    // Hover popup
    row.addEventListener('mouseenter', function(e) { showHoverPopup(deal, e); });
    row.addEventListener('mouseleave', hideHoverPopup);
    row.addEventListener('mousemove', moveHoverPopup);
  });
}

// Hover popup
var popupTimer = null;
function showHoverPopup(deal, e) {
  clearTimeout(popupTimer);
  popupTimer = setTimeout(function() {
    var popup = document.getElementById('game-hover-popup');
    var sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
    var disc = Math.round(parseFloat(deal.savings));

    var reviewHTML = '';
    if (deal.steamRatingText) {
      reviewHTML = '<div class="popup-review"><b>' + deal.steamRatingText + '</b> (' + (deal.steamRatingCount ? parseInt(deal.steamRatingCount).toLocaleString() : '0') + ' reviews)</div>';
    }

    var tagsHTML = '';
    if (deal.steamRatingText) tagsHTML += '<span class="popup-tag">' + deal.steamRatingText + '</span>';
    if (deal.metacriticScore > 0) tagsHTML += '<span class="popup-tag">Metacritic: ' + deal.metacriticScore + '</span>';
    if (disc > 50) tagsHTML += '<span class="popup-tag">Great Deal</span>';

    var priceHTML = sp === 0 ? '<span class="popup-price free">Free to Play</span>' :
      '<span class="popup-price">' + (disc > 0 ? '-' + disc + '% ' : '') + sp.toFixed(2) + ' EUR</span>';

    popup.innerHTML = '<img class="popup-img" id="popup-main-img" alt="">' +
      '<div class="popup-body">' +
      '<div class="popup-title">' + deal.title + '</div>' +
      '<div class="popup-tags">' + tagsHTML + '</div>' +
      reviewHTML +
      '<div class="popup-screenshots"><img id="popup-ss1" alt=""><img id="popup-ss2" alt=""></div>' +
      priceHTML + '</div>';

    loadImage(document.getElementById('popup-main-img'), [getImg(deal), getCapsule(deal), deal.thumb]);
    loadImage(document.getElementById('popup-ss1'), [getCapsule(deal), deal.thumb]);
    loadImage(document.getElementById('popup-ss2'), [deal.thumb, getImg(deal)]);

    positionPopup(e);
    popup.classList.add('visible');
  }, 350);
}
function hideHoverPopup() { clearTimeout(popupTimer); document.getElementById('game-hover-popup').classList.remove('visible'); }
function moveHoverPopup(e) { positionPopup(e); }
function positionPopup(e) {
  var popup = document.getElementById('game-hover-popup');
  var x = e.clientX + 20, y = e.clientY - 80;
  if (x + 310 > window.innerWidth) x = e.clientX - 320;
  if (y < 10) y = 10;
  if (y + 350 > window.innerHeight) y = window.innerHeight - 360;
  popup.style.left = x + 'px'; popup.style.top = y + 'px';
}

// Modal
function openGameModal(deal) {
  document.getElementById('modal-overlay').classList.add('visible');
  state.currentGame = deal;
  var sp = parseFloat(deal.salePrice), np = parseFloat(deal.normalPrice);
  var owned = isOwned(deal.gameID), inCart = state.cart.some(function(g) { return g.gameID === deal.gameID; });
  var disc = Math.round(parseFloat(deal.savings));
  var inWish = state.wishlist.some(function(g) { return g.gameID === deal.gameID; });
  var release = deal.releaseDate > 0 ? new Date(deal.releaseDate * 1000).toLocaleDateString('es-ES') : 'Unknown';
  var rc = !deal.steamRatingText ? 'neutral' : (deal.steamRatingText.indexOf('Positive') >= 0 ? 'positive' : (deal.steamRatingText.indexOf('Mixed') >= 0 ? 'mixed' : 'negative'));

  loadImage(document.getElementById('modal-hero'), [getCapsule(deal), getImg(deal), deal.thumb]);
  document.getElementById('modal-title').textContent = deal.title;
  document.getElementById('modal-rating-tag').textContent = deal.steamRatingText || 'No Reviews';
  document.getElementById('modal-rating-tag').className = 'modal-rating-tag ' + rc;
  document.getElementById('modal-rating-count').textContent = deal.steamRatingCount ? '(' + parseInt(deal.steamRatingCount).toLocaleString() + ' reviews)' : '';
  document.getElementById('modal-desc').textContent = 'Get ' + deal.title + ' at an incredible price. ' + (disc > 0 ? 'Save ' + disc + '% off ' + np.toFixed(2) + ' EUR. ' : '') + (deal.metacriticScore > 0 ? 'Metacritic: ' + deal.metacriticScore + '/100.' : '');

  var ss = document.getElementById('modal-screenshots');
  ss.innerHTML = '<img id="mss1" alt=""><img id="mss2" alt="">';
  loadImage(document.getElementById('mss1'), [getImg(deal), deal.thumb]);
  loadImage(document.getElementById('mss2'), [deal.thumb, getImg(deal)]);

  document.getElementById('purchase-title').textContent = 'Buy ' + deal.title;
  var db = document.getElementById('modal-discount');
  if (disc > 0) { db.textContent = '-' + disc + '%'; db.style.display = 'inline'; } else db.style.display = 'none';
  document.getElementById('modal-price-original').textContent = np > sp ? np.toFixed(2) + ' EUR' : '';
  document.getElementById('modal-price-final').textContent = sp === 0 ? 'Free to Play' : sp.toFixed(2) + ' EUR';

  var bb = document.getElementById('modal-buy-btn');
  if (owned) { bb.textContent = 'In Library'; bb.className = 'btn-add-cart owned'; }
  else if (inCart) { bb.textContent = 'In Cart'; bb.className = 'btn-add-cart owned'; }
  else { bb.textContent = 'Add to Cart'; bb.className = 'btn-add-cart'; }

  document.getElementById('modal-wish-btn').textContent = inWish ? 'On Wishlist' : 'Add to Wishlist';

  document.getElementById('modal-info-panel').innerHTML =
    '<div class="info-item"><div class="info-label">Release Date</div><div class="info-value">' + release + '</div></div>' +
    '<div class="info-item"><div class="info-label">Metacritic</div><div class="info-value">' + (deal.metacriticScore || 'N/A') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Discount</div><div class="info-value" style="color:var(--green-price);">' + (disc > 0 ? '-' + disc + '%' : 'None') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Original Price</div><div class="info-value">' + np.toFixed(2) + ' EUR</div></div>' +
    '<div class="info-item"><div class="info-label">Rating</div><div class="info-value">' + (deal.steamRatingText || 'N/A') + '</div></div>' +
    '<div class="info-item"><div class="info-label">Reviews</div><div class="info-value">' + (deal.steamRatingCount ? parseInt(deal.steamRatingCount).toLocaleString() : 'N/A') + '</div></div>';
}

// Lists
function renderLibrary() {
  var l = document.getElementById('library-list'); document.getElementById('library-subtitle').textContent = state.library.length + ' games';
  if (!state.library.length) { l.innerHTML = '<div class="empty-state"><div class="empty-state-title">Your library is empty</div><p>Buy games from the store</p></div>'; return; }
  l.innerHTML = state.library.map(function(g) { return '<div class="library-card"><img class="library-card-img" src="' + g.image + '" alt="" onerror="this.style.background=\'linear-gradient(135deg,#1b2838,#2a475e)\';this.onerror=null;"><div class="library-card-info"><div class="library-card-title">' + g.name + '</div><div class="library-card-date">Purchased: ' + g.purchaseDate + ' / ' + (g.price === 0 ? 'Free' : g.price.toFixed(2) + ' EUR') + '</div></div></div>'; }).join('');
}
function renderWishlist() {
  var l = document.getElementById('wishlist-list'); document.getElementById('wishlist-subtitle').textContent = state.wishlist.length + ' games';
  if (!state.wishlist.length) { l.innerHTML = '<div class="empty-state"><div class="empty-state-title">Your wishlist is empty</div><p>Mark games to save them here</p></div>'; return; }
  l.innerHTML = state.wishlist.map(function(g, i) { return '<div class="library-card"><img class="library-card-img" src="' + g.image + '" alt="" onerror="this.style.background=\'linear-gradient(135deg,#1b2838,#2a475e)\';this.onerror=null;"><div class="library-card-info"><div class="library-card-title">' + g.name + '</div><div class="library-card-date">Added: ' + g.addedDate + ' / ' + (g.price === 0 ? 'Free' : g.price.toFixed(2) + ' EUR') + '</div></div><button class="library-card-btn" onclick="removeFromWishlist(' + i + ')">Remove</button></div>'; }).join('');
}
function renderCart() {
  var l = document.getElementById('cart-list'), s = document.getElementById('cart-summary');
  document.getElementById('cart-subtitle').textContent = state.cart.length + ' items';
  if (!state.cart.length) { l.innerHTML = '<div class="empty-state"><div class="empty-state-title">Your cart is empty</div><p>Browse the store and add games</p></div>'; s.style.display = 'none'; return; }
  var total = state.cart.reduce(function(a, g) { return a + g.price; }, 0);
  document.getElementById('cart-total').textContent = total.toFixed(2) + ' EUR'; s.style.display = 'flex';
  var btn = document.getElementById('btn-purchase-cart');
  btn.className = total > state.wallet ? 'btn-purchase disabled' : 'btn-purchase';
  btn.textContent = total > state.wallet ? 'Insufficient funds' : 'Purchase for myself';
  l.innerHTML = state.cart.map(function(g, i) { return '<div class="library-card"><img class="library-card-img" src="' + g.image + '" alt="" onerror="this.style.background=\'linear-gradient(135deg,#1b2838,#2a475e)\';this.onerror=null;"><div class="library-card-info"><div class="library-card-title">' + g.name + '</div><div class="library-card-date" style="color:var(--green-price);font-weight:600;">' + (g.price === 0 ? 'Free' : g.price.toFixed(2) + ' EUR') + '</div></div><button class="library-card-btn" onclick="removeFromCart(' + i + ')">Remove</button></div>'; }).join('');
}

// Commerce
function buyFromModal() {
  var d = state.currentGame; if (!d) return;
  if (isOwned(d.gameID)) { showToast('Already in library.', 'error'); return; }
  if (state.cart.some(function(g) { return g.gameID === d.gameID; })) { showToast('Already in cart.', 'error'); return; }
  state.cart.push({ gameID: d.gameID, name: d.title, image: getImg(d), price: parseFloat(d.salePrice) });
  showToast('"' + d.title + '" added to cart.', 'success'); updateUI(); closeModalForce();
}
function removeFromCart(i) { var r = state.cart.splice(i, 1); showToast('"' + r[0].name + '" removed.', 'success'); updateUI(); renderCart(); }
function purchaseCart() {
  var total = state.cart.reduce(function(a, g) { return a + g.price; }, 0);
  if (total > state.wallet) { showToast('Insufficient funds.', 'error'); return; }
  state.wallet -= total; state.wallet = Math.round(state.wallet * 100) / 100;
  var today = new Date().toLocaleDateString('es-ES');
  state.cart.forEach(function(g) { if (!isOwned(g.gameID)) state.library.push({ gameID: g.gameID, name: g.name, image: g.image, price: g.price, purchaseDate: today }); });
  var c = state.cart.length; state.cart = []; saveToStorage(); updateUI(); renderCart();
  showToast(c + ' game(s) purchased. -' + total.toFixed(2) + ' EUR', 'success');
}
function toggleWishlist() {
  var d = state.currentGame; if (!d) return;
  var idx = -1; state.wishlist.forEach(function(g, i) { if (g.gameID === d.gameID) idx = i; });
  if (idx !== -1) { state.wishlist.splice(idx, 1); showToast('Removed from wishlist.', 'success'); }
  else { state.wishlist.push({ gameID: d.gameID, name: d.title, image: getImg(d), price: parseFloat(d.salePrice), normalPrice: parseFloat(d.normalPrice), addedDate: new Date().toLocaleDateString('es-ES') }); showToast('Added to wishlist.', 'success'); }
  saveToStorage(); updateUI(); closeModalForce();
}
function removeFromWishlist(i) { state.wishlist.splice(i, 1); showToast('Removed.', 'success'); saveToStorage(); updateUI(); renderWishlist(); }
function sortGames() {
  var s = document.getElementById('sort-select').value, d = state.currentDeals.slice();
  if (s === 'price') d.sort(function(a, b) { return parseFloat(a.salePrice) - parseFloat(b.salePrice); });
  else if (s === 'title') d.sort(function(a, b) { return a.title.localeCompare(b.title); });
  else if (s === 'metacritic') d.sort(function(a, b) { return (parseInt(b.metacriticScore) || 0) - (parseInt(a.metacriticScore) || 0); });
  renderGameGrid(d);
}

// Utility
function isOwned(id) { return state.library.some(function(g) { return g.gameID === id; }); }
function showPage(p) {
  document.querySelectorAll('.page-view').forEach(function(v) { v.classList.remove('active'); });
  document.querySelectorAll('.nav-link').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  if (p === 'library') renderLibrary(); if (p === 'wishlist') renderWishlist(); if (p === 'cart') renderCart();
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
  t.className = 'toast ' + (type || 'success'); t.textContent = msg;
  c.appendChild(t); setTimeout(function() { t.remove(); }, 3000);
}
function closeModal(e) { if (e.target === document.getElementById('modal-overlay')) closeModalForce(); }
function closeModalForce() { document.getElementById('modal-overlay').classList.remove('visible'); state.currentGame = null; }
function saveToStorage() { localStorage.setItem('sv_lib', JSON.stringify(state.library)); localStorage.setItem('sv_wallet', JSON.stringify(state.wallet)); localStorage.setItem('sv_wish', JSON.stringify(state.wishlist)); }
function loadFromStorage() { var l = localStorage.getItem('sv_lib'), w = localStorage.getItem('sv_wallet'), ws = localStorage.getItem('sv_wish'); if (l) state.library = JSON.parse(l); if (w) state.wallet = JSON.parse(w); if (ws) state.wishlist = JSON.parse(ws); }
