import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(repoRoot, '.env.local'), override: true });
dotenv.config({ path: path.join(repoRoot, '.env') });

const PORT = Number(process.env.MCP_DEV_PORT ?? 3001);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function decorateResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
    return res;
  };
  res.send = (body) => {
    if (body === undefined || body === null) {
      res.end();
    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
      res.end(body);
    } else {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    }
    return res;
  };
  return res;
}

async function main() {
  const handlerModule = await import(path.join(repoRoot, 'api/mcp.ts'));
  const handler = handlerModule.default;

  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith('/api/mcp')) {
      res.statusCode = 404;
      res.end('Not found. Use POST /api/mcp');
      return;
    }

    try {
      const raw = await readBody(req);
      let parsed = raw;
      if (raw && (req.headers['content-type'] ?? '').includes('application/json')) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }
      req.body = parsed;
      decorateResponse(res);
      await handler(req, res);
    } catch (err) {
      console.error('[mcp-dev] handler error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'internal' }));
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`[mcp-dev] listening on http://localhost:${PORT}/api/mcp`);
    console.log(`[mcp-dev] auth: Bearer $MCP_DEV_TOKEN, impersonating ${process.env.MCP_DEV_USER_EMAIL ?? process.env.MCP_DEV_USER_ID ?? '(not set)'}`);
  });
}

main().catch((err) => {
  console.error('[mcp-dev] fatal:', err);
  process.exit(1);
});
