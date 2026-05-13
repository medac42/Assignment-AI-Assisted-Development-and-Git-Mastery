/* SteamVault — Mini proxy server
   Serves static files + proxies AI requests to NVIDIA API */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8091;
const NV_KEY = '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';
const NV_HOST = 'integrate.api.nvidia.com';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // AI proxy endpoint
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const payload = Buffer.from(body);
      const options = {
        hostname: NV_HOST,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NV_KEY,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Content-Length': payload.length
        }
      };

      const proxy = https.request(options, (nvRes) => {
        res.writeHead(nvRes.statusCode, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        nvRes.pipe(res);
      });

      proxy.on('error', (e) => {
        console.error('NVIDIA proxy error:', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });

      proxy.write(payload);
      proxy.end();
    });
    return;
  }

  // Static file server
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('SteamVault server running at http://localhost:' + PORT);
  console.log('AI proxy at http://localhost:' + PORT + '/api/chat');
});
