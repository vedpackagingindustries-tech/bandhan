const http = require('http');

const TARGET = '127.0.0.1';
const TARGET_PORT = 3001;
const LISTEN_PORT = 3000;

const server = http.createServer((clientReq, clientRes) => {
  const opts = {
    hostname: TARGET,
    port: TARGET_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: `localhost:${TARGET_PORT}` },
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    // Strip X-Frame-Options to allow preview iframe embedding
    const headers = { ...proxyRes.headers };
    delete headers['x-frame-options'];

    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy] error:', err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      clientRes.end('Bad Gateway');
    }
  });

  clientReq.pipe(proxyReq);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[proxy] Listening on :${LISTEN_PORT} -> :${TARGET_PORT} (stripping X-Frame-Options)`);
});
