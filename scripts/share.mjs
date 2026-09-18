import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createPortProbe } from 'node:net';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const config = resolve(process.env.LOCALAPPDATA || '', 'QarHub/ngrok.yml');
const sessionFile = resolve(root, '.artifacts/ngrok-session.json');
const ngrok =
  process.env.NGROK_BIN ||
  resolve(process.env.LOCALAPPDATA || '', 'Microsoft/WindowsApps/ngrok.exe');
const port = 3002;
const controlPort = 4046;
const controlToken = randomBytes(32).toString('hex');
const children = [];
let stopping = false;
let publicUrl;
let lastNgrokError = '';
let control;
let ownsSession = false;
const pause = () => new Promise((r) => setTimeout(r, 300));

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  control?.close();
  if (ownsSession && existsSync(sessionFile)) unlinkSync(sessionFile);
  process.exitCode = code;
}
function launch(command, args, env = process.env) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  // Never print raw ngrok output: authentication errors may contain the token.
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => {
      const code = data.toString().match(/ERR_NGROK_\d+/)?.[0];
      if (code) lastNgrokError = code;
    });
  child.once('error', (error) => {
    console.error(`Не удалось запустить процесс: ${error.code || 'UNKNOWN'}`);
    stop(1);
  });
  child.once('exit', () => {
    if (!stopping) {
      console.error(`Тестовый запуск остановлен. ${lastNgrokError}`);
      stop(1);
    }
  });
  return child;
}
async function freePort(port) {
  const probe = createPortProbe();
  await new Promise((done, fail) => {
    probe.once('error', () =>
      fail(new Error(`Порт ${port} занят. Текущий процесс оставлен работающим.`)),
    );
    probe.listen(port, '127.0.0.1', done);
  });
  await new Promise((done) => probe.close(done));
}
async function waitFor(check, message) {
  const deadline = Date.now() + 30000;
  while (!stopping && Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch {}
    await pause();
  }
  throw new Error(`${message} ${lastNgrokError}`.trim());
}

try {
  if (existsSync(sessionFile)) {
    const old = JSON.parse(readFileSync(sessionFile, 'utf8'));
    const active = await fetch(`http://127.0.0.1:${controlPort}/status`, {
      headers: { Authorization: `Bearer ${old.controlToken}` },
      signal: AbortSignal.timeout(1500),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (active) {
      console.log(`QarHub уже открыт: ${old.url}`);
      process.exit(0);
    }
  }
  if (!existsSync(config))
    throw new Error('Сначала запусти connect-ngrok.cmd и подключи свой аккаунт ngrok.');
  if (!existsSync(ngrok)) throw new Error('Установи ngrok из Microsoft Store или укажи NGROK_BIN.');
  if (!existsSync(resolve(root, 'dist/index.html')))
    throw new Error('Сначала выполни npm run build.');
  for (const p of [port, 4047, controlPort]) await freePort(p);
  // Upgrade the initial local configuration: port 4045 is blocked by the Fetch standard.
  const savedConfig = readFileSync(config, 'utf8');
  const updatedConfig = savedConfig.replace('web_addr: 127.0.0.1:4045', 'web_addr: 127.0.0.1:4047');
  if (savedConfig !== updatedConfig) writeFileSync(config, updatedConfig);
  launch(ngrok, [
    'http',
    `http://127.0.0.1:${port}`,
    '--config',
    config,
    '--inspect=false',
    '--log=stdout',
    '--log-format=json',
  ]);
  publicUrl = await waitFor(async () => {
    const result = await fetch('http://127.0.0.1:4047/api/tunnels', {
      signal: AbortSignal.timeout(1500),
    }).then((r) => r.json());
    return result.tunnels?.find(
      (t) => t.public_url?.startsWith('https://') && t.config?.addr === `http://127.0.0.1:${port}`,
    )?.public_url;
  }, 'Ngrok не подключился. Проверь аккаунт и интернет.');
  const origin = new URL(publicUrl).origin;
  launch(process.execPath, ['server/index.mjs'], {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    DATABASE_PATH: 'data/qarhub-demo.sqlite',
    APP_ORIGINS: origin,
    COOKIE_SECURE: 'true',
    TRUST_PROXY: 'loopback',
  });
  await waitFor(
    async () =>
      (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) }))
        .ok,
    'Сервер QarHub не запустился.',
  );
  control = createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${controlToken}`) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.url === '/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: origin }));
    } else if (req.url === '/stop' && req.method === 'POST') {
      res.writeHead(200);
      res.end('Stopped');
      stop();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((done, fail) => {
    control.once('error', fail);
    control.listen(controlPort, '127.0.0.1', done);
  });
  mkdirSync(resolve(root, '.artifacts'), { recursive: true });
  writeFileSync(
    sessionFile,
    JSON.stringify({ url: origin, controlToken, pid: process.pid }, null, 2),
  );
  ownsSession = true;
  console.log(
    `QarHub для друзей: ${origin}\nОтдельная база: data/qarhub-demo.sqlite\nОстановить: npm run share:stop`,
  );
} catch (error) {
  console.error(error.message);
  stop(1);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
