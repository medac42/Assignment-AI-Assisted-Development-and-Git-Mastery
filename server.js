/* SteamVault — Mini proxy server
   Serves static files + proxies AI requests to g4f.space */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8091;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json'
};

// Proxy to Pollinations.ai
function proxyToAPI(body, res) {
  let parsed;
  try { parsed = JSON.parse(body); } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  delete parsed.provider;
  const payload = JSON.stringify(parsed);

  console.log('Proxying to gen.pollinations.ai model=' + parsed.model);

  const options = {
    hostname: 'gen.pollinations.ai',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const proxy = https.request(options, (g4fRes) => {
    // Follow redirects
    if ([301, 302, 307, 308].includes(g4fRes.statusCode) && g4fRes.headers.location) {
      console.log('Redirect to:', g4fRes.headers.location);
      followRedirect(g4fRes.headers.location, payload, res, 0);
      return;
    }

    console.log('g4f responded:', g4fRes.statusCode);
    res.writeHead(g4fRes.statusCode, {
      'Content-Type': g4fRes.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    g4fRes.pipe(res);
  });

  proxy.on('error', (e) => {
    console.error('g4f proxy error:', e.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });

  proxy.write(payload);
  proxy.end();
}

function followRedirect(location, payload, res, count) {
  if (count > 5) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many redirects' }));
    return;
  }

  const url = new URL(location);
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (r) => {
    if ([301, 302, 307, 308].includes(r.statusCode) && r.headers.location) {
      followRedirect(r.headers.location, payload, res, count + 1);
      return;
    }
    res.writeHead(r.statusCode, {
      'Content-Type': r.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    r.pipe(res);
  });

  req.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.write(payload);
  req.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => proxyToAPI(body, res));
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
  console.log('AI proxy at /api/chat -> gen.pollinations.ai');
});
