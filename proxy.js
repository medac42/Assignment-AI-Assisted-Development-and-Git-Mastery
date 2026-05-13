/* SteamVault — Local CORS proxy for NVIDIA API
   Run: node proxy.js
   Proxies requests from browser to NVIDIA API, avoiding CORS. */

var http = require('http');
var https = require('https');

var PORT = 8092;
var NVIDIA_KEY = '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';
var NVIDIA_HOST = 'integrate.api.nvidia.com';
var NVIDIA_PATH = '/v1/chat/completions';

var server = http.createServer(function(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('POST only');
    return;
  }

  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    var options = {
      hostname: NVIDIA_HOST,
      port: 443,
      path: NVIDIA_PATH,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NVIDIA_KEY,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    };

    var proxyReq = https.request(options, function(proxyRes) {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', function(e) {
      res.writeHead(502);
      res.end('Proxy error: ' + e.message);
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, function() {
  console.log('NVIDIA proxy running on http://localhost:' + PORT);
});
