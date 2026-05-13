/* SteamVault — Puter.js Image Generator + Cache
   Generates cartoon-style game icons via AI when Steam images fail.
   Caches all generated images in localStorage for instant reuse. */

var IMG_CACHE_KEY = 'sv_img_cache';
var imgCache = {};
var imgQueue = [];
var imgProcessing = false;

// Load cache from localStorage
function loadImgCache() {
  try {
    var raw = localStorage.getItem(IMG_CACHE_KEY);
    if (raw) imgCache = JSON.parse(raw);
  } catch (e) { imgCache = {}; }
}

// Save cache to localStorage
function saveImgCache() {
  try {
    localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(imgCache));
  } catch (e) {
    // If localStorage is full, clear oldest entries
    var keys = Object.keys(imgCache);
    if (keys.length > 20) {
      for (var i = 0; i < 10; i++) delete imgCache[keys[i]];
      localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(imgCache));
    }
  }
}

// Get cache key for a game title
function getCacheKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
}

// Check if we have a cached image
function getCachedImage(title) {
  var key = getCacheKey(title);
  return imgCache[key] || null;
}

// Generate cartoon image via Puter.js and cache it
function generateGameImage(title, imgElement) {
  var key = getCacheKey(title);

  // Check cache first
  if (imgCache[key]) {
    imgElement.src = imgCache[key];
    return;
  }

  // Add to queue
  imgQueue.push({ title: title, key: key, element: imgElement });
  processImgQueue();
}

// Process image generation queue (one at a time to avoid rate limits)
function processImgQueue() {
  if (imgProcessing || imgQueue.length === 0) return;
  imgProcessing = true;

  var job = imgQueue.shift();
  var prompt = 'Cartoon game icon of "' + job.title + '", video game character art, ' +
    'flat illustration style, vibrant colors, clean lines, centered composition, ' +
    'transparent background, no text, game mascot or main character, high quality icon';

  // Try generating with Puter.js
  if (typeof puter !== 'undefined' && puter.ai && puter.ai.txt2img) {
    puter.ai.txt2img(prompt, { model: 'dall-e-2' })
      .then(function(imgEl) {
        // Convert to base64 for caching
        var b64 = imgToBase64(imgEl);
        if (b64) {
          imgCache[job.key] = b64;
          saveImgCache();
          if (job.element) job.element.src = b64;
        }
        imgProcessing = false;
        // Process next in queue after short delay
        setTimeout(processImgQueue, 500);
      })
      .catch(function(err) {
        console.warn('Puter image gen failed for:', job.title, err);
        // Try with a different model as fallback
        puterFallback(job);
      });
  } else {
    imgProcessing = false;
    setTimeout(processImgQueue, 2000); // Wait for Puter to load
  }
}

// Fallback to flux-schnell model
function puterFallback(job) {
  var prompt = 'Simple cartoon icon of "' + job.title + '" video game, flat design, no background';

  puter.ai.txt2img(prompt, { model: 'black-forest-labs/flux-schnell' })
    .then(function(imgEl) {
      var b64 = imgToBase64(imgEl);
      if (b64) {
        imgCache[job.key] = b64;
        saveImgCache();
        if (job.element) job.element.src = b64;
      }
      imgProcessing = false;
      setTimeout(processImgQueue, 500);
    })
    .catch(function(err) {
      console.warn('Fallback image gen also failed:', err);
      imgProcessing = false;
      setTimeout(processImgQueue, 1000);
    });
}

// Convert HTMLImageElement to base64 string
function imgToBase64(imgEl) {
  try {
    if (!imgEl) return null;
    // If it's already a data URL or blob URL
    if (imgEl.src && imgEl.src.indexOf('data:') === 0) return imgEl.src;
    if (imgEl.src && imgEl.src.indexOf('blob:') === 0) {
      // Draw to canvas
      var canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth || imgEl.width || 256;
      canvas.height = imgEl.naturalHeight || imgEl.height || 256;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png', 0.85);
    }
    // Try canvas approach
    var canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth || imgEl.width || 256;
    canvas.height = imgEl.naturalHeight || imgEl.height || 256;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png', 0.85);
  } catch (e) {
    console.warn('Failed to convert image to base64:', e);
    return null;
  }
}

// Enhanced loadImage: tries Steam CDN -> Cache -> Puter AI generation
function loadImageWithAI(img, sources, gameTitle) {
  // Check cache first
  var cached = getCachedImage(gameTitle);
  if (cached) {
    img.src = cached;
    return;
  }

  // Try Steam sources first
  if (!sources || sources.length === 0) {
    generateGameImage(gameTitle, img);
    return;
  }

  var idx = 0;
  function tryNext() {
    if (idx >= sources.length) {
      // All Steam sources failed, generate via AI
      generateGameImage(gameTitle, img);
      return;
    }
    img.src = sources[idx];
    idx++;
  }
  img.onerror = tryNext;
  tryNext();
}

// Cache stats for debugging
function getImgCacheStats() {
  var keys = Object.keys(imgCache);
  var totalSize = JSON.stringify(imgCache).length;
  return {
    count: keys.length,
    sizeKB: Math.round(totalSize / 1024),
    games: keys
  };
}

// Init cache on load
loadImgCache();
