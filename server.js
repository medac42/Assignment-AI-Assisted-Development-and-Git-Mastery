/* SteamVault — Mini proxy server
   Serves static files + proxies AI requests to NVIDIA API */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8091;
const NV_KEY = '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';

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json'
};

function proxyToNvidia(payload, res, redirectCount) {
  if (redirectCount > 5) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many redirects' }));
    return;
  }

  const url = new URL('https://integrate.api.nvidia.com/v1/chat/completions');
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + NV_KEY,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const proxy = https.request(options, (nvRes) => {
    // Follow redirects
    if ([301, 302, 307, 308].includes(nvRes.statusCode) && nvRes.headers.location) {
      console.log('Following redirect to:', nvRes.headers.location);
      followRedirect(nvRes.headers.location, payload, res, redirectCount + 1);
      return;
    }

    console.log('NVIDIA responded:', nvRes.statusCode);
    res.writeHead(nvRes.statusCode, {
      'Content-Type': nvRes.headers['content-type'] || 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    nvRes.pipe(res);
  });

  proxy.on('error', (e) => {
    console.error('Proxy error:', e.message);
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
      'Authorization': 'Bearer ' + NV_KEY,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (nvRes) => {
    if ([301, 302, 307, 308].includes(nvRes.statusCode) && nvRes.headers.location) {
      console.log('Following redirect to:', nvRes.headers.location);
      followRedirect(nvRes.headers.location, payload, res, count + 1);
      return;
    }

    console.log('NVIDIA responded:', nvRes.statusCode);
    res.writeHead(nvRes.statusCode, {
      'Content-Type': nvRes.headers['content-type'] || 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    nvRes.pipe(res);
  });

  req.on('error', (e) => {
    console.error('Redirect error:', e.message);
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
    req.on('end', () => {
      console.log('Proxying to NVIDIA...');
      proxyToNvidia(body, res, 0);
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
  console.log('SteamVault running at http://localhost:' + PORT);
  console.log('AI proxy at /api/chat (follows redirects)');
});
