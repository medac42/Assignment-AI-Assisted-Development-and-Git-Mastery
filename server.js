/* SteamVault — Proxy server
   Serves static files + proxies AI requests to OpenRouter & Cohere */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8091;

// Load .env file
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch(e) { console.warn('No .env file found'); }

const OR_KEY = process.env.OPENROUTER_KEY || '';
const COHERE_KEY = process.env.COHERE_KEY || '';
const GROQ_KEY = process.env.GROQ_KEY || '';

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json'
};

// Generic HTTPS proxy function
function proxyRequest(hostname, apiPath, headers, payload, res) {
  const options = {
    hostname,
    port: 443,
    path: apiPath,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log(`Proxying to ${hostname}${apiPath}`);

  const proxy = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      console.log(`${hostname} responded: ${apiRes.statusCode} (${data.length} bytes)`);
      res.writeHead(apiRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  proxy.on('error', (e) => {
    console.error(`Proxy error (${hostname}):`, e.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });

  proxy.write(payload);
  proxy.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // OpenRouter proxy
  if (req.url === '/api/openrouter' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      proxyRequest('openrouter.ai', '/api/v1/chat/completions',
        { 'Authorization': 'Bearer ' + OR_KEY },
        body, res);
    });
    return;
  }

  // Groq proxy (ultra-fast inference)
  if (req.url === '/api/groq' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      proxyRequest('api.groq.com', '/openai/v1/chat/completions',
        { 'Authorization': 'Bearer ' + GROQ_KEY },
        body, res);
    });
    return;
  }

  // Cohere proxy
  if (req.url === '/api/cohere' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      proxyRequest('api.cohere.com', '/v2/chat',
        { 'Authorization': 'Bearer ' + COHERE_KEY },
        body, res);
    });
    return;
  }

  // Search for browser-playable versions of a game on itch.io
  if (req.url.startsWith('/api/search-game') && req.method === 'GET') {
    const urlParts = new URL(req.url, 'http://localhost');
    const gameName = urlParts.searchParams.get('name');
    if (!gameName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'name required' }));
      return;
    }

    // Search itch.io for playable HTML games matching this title
    const searchQuery = encodeURIComponent(gameName);
    const searchUrl = `/search?q=${searchQuery}&type=games&classification=game`;
    console.log('Searching itch.io for:', gameName);

    const searchReq = https.request({
      hostname: 'itch.io',
      port: 443,
      path: searchUrl,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
    }, (searchRes) => {
      let html = '';
      searchRes.on('data', chunk => html += chunk);
      searchRes.on('end', () => {
        // Parse game links from itch.io search results
        const games = [];
        const regex = /href="(https:\/\/[a-z0-9\-]+\.itch\.io\/[a-z0-9\-]+)"/gi;
        let match;
        const seen = new Set();
        while ((match = regex.exec(html)) !== null && games.length < 5) {
          const url = match[1];
          if (!seen.has(url)) {
            seen.add(url);
            games.push(url);
          }
        }

        // Extract titles from search results
        const results = games.map(url => {
          const slug = url.split('/').pop().replace(/-/g, ' ');
          return { url: url, title: slug };
        });

        console.log('itch.io results:', results.length);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
      });
    });

    searchReq.on('error', (e) => {
      console.error('itch.io search error:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results: [] }));
    });
    searchReq.end();
    return;
  }

  // Steam game info proxy (extracts description, genres, tags)
  if (req.url.startsWith('/api/steam-info') && req.method === 'GET') {
    const urlParts = new URL(req.url, 'http://localhost');
    const appId = urlParts.searchParams.get('appid');
    if (!appId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing appid' }));
      return;
    }

    const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
    console.log('Fetching Steam info for appid=' + appId);

    https.get(steamUrl, (steamRes) => {
      let data = '';
      steamRes.on('data', chunk => data += chunk);
      steamRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          const appData = json[appId];
          if (!appData || !appData.success) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Game not found' }));
            return;
          }
          const d = appData.data;
          // Extract clean info for AI
          const info = {
            name: d.name || '',
            short_description: d.short_description || '',
            genres: (d.genres || []).map(g => g.description).join(', '),
            categories: (d.categories || []).map(c => c.description).join(', '),
            type: d.type || '',
            developers: (d.developers || []).join(', '),
            publishers: (d.publishers || []).join(', '),
            movies: (d.movies || []).map(m => ({
              name: m.name,
              mp4: m.mp4 && m.mp4.max ? m.mp4.max : (m.mp4 && m.mp4['480'] ? m.mp4['480'] : ''),
              webm: m.webm && m.webm.max ? m.webm.max : ''
            })).filter(m => m.mp4 || m.webm),
            screenshots: (d.screenshots || []).slice(0, 4).map(s => s.path_full)
          };
          // Strip HTML from description
          info.short_description = info.short_description.replace(/<[^>]*>/g, '');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify(info));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Parse error' }));
        }
      });
    }).on('error', (e) => {
      console.error('Steam API error:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(__dirname, filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('SteamVault at http://localhost:' + PORT);
  console.log('AI proxy: /api/openrouter -> openrouter.ai');
  console.log('AI proxy: /api/cohere -> api.cohere.com');
});
