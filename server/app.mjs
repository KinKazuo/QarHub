import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { brands, categories } from '../src/data.ts';
import { getState } from './db.mjs';
import { hashPassword, verifyPassword, currentUser, createSession, clearSession } from './auth.mjs';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function text(value, min, max, label) {
  if (typeof value !== 'string') throw new HttpError(400, `Заполни поле «${label}».`);
  const result = value.trim();
  if (result.length < min || result.length > max)
    throw new HttpError(400, `Поле «${label}»: от ${min} до ${max} символов.`);
  return result;
}
function choice(value, options, label) {
  if (!options.includes(value)) throw new HttpError(400, `Выбери значение поля «${label}».`);
  return value;
}
function credentials(body) {
  const email = text(body.email, 3, 254, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Проверь адрес email.');
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128)
    throw new HttpError(400, 'Пароль должен содержать от 12 до 128 символов.');
  return { email, password: body.password };
}
const dummyHash = 'scrypt-v1:0123456789abcdef0123456789abcdef:' + '00'.repeat(64);

export function createApp({
  db,
  origins = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:3001'],
  secureCookies = false,
  authLimit = 20,
  staticDirectory,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'upgrade-insecure-requests': secureCookies ? [] : null,
        },
      },
    }),
  );
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('X-QarHub-Client') !== 'web' || !origins.includes(req.get('Origin')))
        return res.status(403).json({ error: 'Запрос с этого адреса не разрешён.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'Требуется JSON.' });
    }
    next();
  });
  app.use('/api', express.json({ limit: '32kb', strict: true }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Слишком много запросов. Попробуй через минуту.' },
    }),
  );
  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });
  app.use('/api', (req, res, next) => {
    req.user = currentUser(db, req);
    next();
  });
  const requireUser = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: 'Войди в аккаунт, чтобы продолжить.' });
  const respond = (req, res, extra = {}, status = 200) =>
    res.status(status).json({ state: getState(db, req.user), ...extra });
  const findPost = (id) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!post) throw new HttpError(404, 'Публикация не найдена.');
    return post;
  };
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: authLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа. Попробуй через 15 минут.' },
  });
  let activePasswordJobs = 0;
  async function passwordJob(work) {
    if (activePasswordJobs >= 4)
      throw new HttpError(503, 'Сервер занят. Попробуй через несколько секунд.');
    activePasswordJobs++;
    try {
      return await work();
    } finally {
      activePasswordJobs--;
    }
  }
  app.get('/api/state', (req, res) => respond(req, res));
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { email, password } = credentials(req.body || {});
    const name = text(req.body.name, 2, 32, 'Имя');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
      throw new HttpError(409, 'Аккаунт с этим email уже существует. Войди в него.');
    const encoded = await passwordJob(() => hashPassword(password));
    const user = { id: randomUUID(), email, name };
    try {
      db.prepare(
        'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(user.id, email, name, encoded, new Date().toISOString());
    } catch (error) {
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email))
        throw new HttpError(409, 'Аккаунт с этим email уже существует.');
      throw error;
    }
    createSession(db, req, res, user.id, secureCookies);
    req.user = user;
    respond(req, res, {}, 201);
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = credentials(req.body || {});
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const valid = await passwordJob(() =>
      verifyPassword(password, row?.password_hash || dummyHash),
    );
    if (!row || !valid) throw new HttpError(401, 'Неверный email или пароль.');
    createSession(db, req, res, row.id, secureCookies);
    req.user = { id: row.id, email: row.email, name: row.name };
    respond(req, res);
  });
  app.post('/api/auth/logout', (req, res) => {
    clearSession(db, req, res, secureCookies);
    req.user = null;
    respond(req, res);
  });
  app.patch('/api/profile', requireUser, (req, res) => {
    const name = text(req.body?.name, 2, 32, 'Имя');
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
    req.user = { ...req.user, name };
    respond(req, res);
  });
  app.post('/api/posts', requireUser, (req, res) => {
    const body = req.body || {};
    const id = randomUUID();
    const title = text(body.title, 8, 140, 'Заголовок');
    const content = text(body.body, 20, 10000, 'Подробности');
    const brand = choice(body.brand, brands, 'Марка');
    const car = text(body.car || brand, 1, 100, 'Модель');
    const category = choice(body.category, categories.slice(1), 'Тема');
    const kind = choice(body.kind, ['question', 'journal'], 'Тип публикации');
    db.prepare(
      `INSERT INTO posts (id, user_id, brand, car, title, body, category, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, req.user.id, brand, car, title, content, category, kind, new Date().toISOString());
    respond(req, res, { createdId: id }, 201);
  });
  app.post('/api/posts/:id/replies', requireUser, (req, res) => {
    const post = findPost(req.params.id);
    const body = text(req.body?.text, 3, 5000, 'Ответ');
    const id = randomUUID();
    db.prepare(
      'INSERT INTO replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, post.id, req.user.id, body, new Date().toISOString());
    respond(req, res, { createdId: id }, 201);
  });
  app.put('/api/posts/:id/solution', requireUser, (req, res) => {
    const post = findPost(req.params.id);
    if (post.user_id !== req.user.id)
      throw new HttpError(403, 'Только автор вопроса может выбрать решение.');
    if (post.kind !== 'question')
      throw new HttpError(400, 'Решение можно выбрать только у вопроса.');
    const id = req.body?.replyId;
    if (
      id !== null &&
      (typeof id !== 'string' ||
        !db.prepare('SELECT id FROM replies WHERE id = ? AND post_id = ?').get(id, post.id))
    )
      throw new HttpError(400, 'Ответ должен относиться к этому вопросу.');
    db.prepare('UPDATE posts SET accepted_reply_id = ? WHERE id = ?').run(id, post.id);
    respond(req, res);
  });
  for (const [endpoint, table] of [
    ['like', 'likes'],
    ['bookmark', 'bookmarks'],
  ]) {
    app.put(`/api/posts/:id/${endpoint}`, requireUser, (req, res) => {
      const post = findPost(req.params.id);
      if (typeof req.body?.active !== 'boolean')
        throw new HttpError(400, 'Укажи состояние действия.');
      if (req.body.active)
        db.prepare(`INSERT OR IGNORE INTO ${table} (user_id, post_id) VALUES (?, ?)`).run(
          req.user.id,
          post.id,
        );
      else
        db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND post_id = ?`).run(
          req.user.id,
          post.id,
        );
      respond(req, res);
    });
  }
  app.put('/api/memberships/:brand', requireUser, (req, res) => {
    const brand = choice(req.params.brand, brands, 'Марка');
    if (typeof req.body?.active !== 'boolean')
      throw new HttpError(400, 'Укажи состояние подписки.');
    if (req.body.active)
      db.prepare('INSERT OR IGNORE INTO memberships (user_id, brand) VALUES (?, ?)').run(
        req.user.id,
        brand,
      );
    else
      db.prepare('DELETE FROM memberships WHERE user_id = ? AND brand = ?').run(req.user.id, brand);
    respond(req, res);
  });
  app.post('/api/cars', requireUser, (req, res) => {
    const body = req.body || {};
    const brand = choice(body.brand, brands, 'Марка');
    const model = text(body.model, 1, 80, 'Модель');
    const engine = text(body.engine || '', 0, 80, 'Двигатель');
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)
      throw new HttpError(400, 'Проверь год выпуска.');
    const id = randomUUID();
    db.prepare(
      'INSERT INTO cars (id, user_id, brand, model, year, engine) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, req.user.id, brand, model, year, engine);
    respond(req, res, { createdId: id }, 201);
  });
  app.delete('/api/cars/:id', requireUser, (req, res) => {
    const car = db
      .prepare('SELECT * FROM cars WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!car) throw new HttpError(404, 'Автомобиль не найден в твоём гараже.');
    db.prepare('DELETE FROM cars WHERE id = ? AND user_id = ?').run(car.id, req.user.id);
    respond(req, res);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Такого адреса API нет.' }));
  if (staticDirectory && existsSync(resolve(staticDirectory, 'index.html'))) {
    app.use(express.static(staticDirectory));
    app.get('/{*path}', (req, res) => res.sendFile(resolve(staticDirectory, 'index.html')));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error.status && error.status >= 400 && error.status < 500
        ? error.status
        : error instanceof HttpError
          ? error.status
          : 500;
    if (status === 500) console.error('QarHub request failed:', error.code || error.name);
    const message =
      error instanceof HttpError
        ? error.message
        : status === 413
          ? 'Слишком большой запрос.'
          : status === 400
            ? 'Некорректный JSON.'
            : 'Не удалось выполнить запрос. Попробуй ещё раз.';
    res.status(status).json({ error: message });
  });
  return app;
}
