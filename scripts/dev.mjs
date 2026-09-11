import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}
const api = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});
children.push(api);
api.once('exit', (code) => stop(code || 0));
api.once('error', (error) => {
  console.error(error.message);
  stop(1);
});
const timeout = Date.now() + 15000;
let ready = false;
while (Date.now() < timeout && !stopping) {
  try {
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/api/health`);
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!ready || stopping) {
  stop(1);
} else {
  const vite = spawn(
    process.execPath,
    [
      resolve(root, 'node_modules/vite/bin/vite.js'),
      '--host',
      process.env.DEV_HOST || '127.0.0.1',
      '--strictPort',
      ...process.argv.slice(2),
    ],
    { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true },
  );
  children.push(vite);
  vite.once('exit', (code) => stop(code || 0));
  vite.once('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
