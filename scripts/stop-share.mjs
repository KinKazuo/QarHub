import { readFileSync, existsSync } from 'node:fs';
const file = new URL('../.artifacts/ngrok-session.json', import.meta.url);
if (!existsSync(file)) console.log('Активный тестовый запуск не найден.');
else {
  const session = JSON.parse(readFileSync(file, 'utf8'));
  try {
    const response = await fetch('http://127.0.0.1:4046/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.controlToken}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error();
    console.log('Публичная ссылка отключена. Тестовая база сохранена.');
  } catch {
    console.error('Управление запуском недоступно. Проверь, работает ли npm run share.');
    process.exitCode = 1;
  }
}
