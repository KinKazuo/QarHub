import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';
import { createApp } from './app.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';
const host = process.env.HOST || '127.0.0.1';
const trustProxy = process.env.TRUST_PROXY === 'loopback' ? 'loopback' : false;
if (trustProxy && host !== '127.0.0.1') throw new Error('The local tunnel must bind to 127.0.0.1.');
const origins = (
  process.env.APP_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3001'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (
  production &&
  (!process.env.APP_ORIGINS || origins.some((origin) => !origin.startsWith('https://')))
)
  throw new Error('Set APP_ORIGINS to your exact HTTPS origin in production.');
const db = openDatabase(resolve(root, process.env.DATABASE_PATH || 'data/qarhub.sqlite'));
const app = createApp({
  db,
  trustProxy,
  origins,
  secureCookies: production || process.env.COOKIE_SECURE === 'true',
  staticDirectory: resolve(root, 'dist'),
});
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, host, () => console.log(`QarHub API: http://${host}:${port}`));
server.on('error', (error) => {
  console.error(`Cannot start QarHub API: ${error.code}`);
  db.close();
  process.exitCode = 1;
});
for (const event of ['SIGINT', 'SIGTERM'])
  process.once(event, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
