import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.jsonl');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, service: 'perler-anonymous-analytics' });
    return;
  }

  if (req.method === 'POST' && req.url === '/collect') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 256 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        if (!event || typeof event.event !== 'string' || !event.clientId) {
          sendJson(res, 400, { ok: false, error: 'invalid event' });
          return;
        }

        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.appendFileSync(
          DATA_FILE,
          `${JSON.stringify({ receivedAt: new Date().toISOString(), ...event })}\n`,
          'utf8'
        );
        sendJson(res, 202, { ok: true });
      } catch {
        sendJson(res, 400, { ok: false, error: 'bad request' });
      }
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Analytics collector listening on http://0.0.0.0:${PORT}`);
});
