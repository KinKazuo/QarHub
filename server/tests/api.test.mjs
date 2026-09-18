import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase } from '../db.mjs';
import { createApp } from '../app.mjs';
import sharp from 'sharp';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const origin = 'http://qarhub.test';
const password = 'QarHub-test-password-2026';
const postBody = {
  title: 'Как вести историю обслуживания?',
  body: 'Хочу собирать все работы, запчасти и пробег в одном месте.',
  brand: 'Toyota',
  car: 'Camry 2.5',
  category: 'Ремонт и обслуживание',
  kind: 'question',
};
async function fixture(t, options = {}) {
  const db = openDatabase(options.file || ':memory:', { seed: false });
  const app = createApp({ db, origins: [origin], ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (db.isOpen) db.close();
  };
  t.after(close);
  function client() {
    return {
      cookie: '',
      async request(path, method = 'GET', body, override = {}) {
        const headers = {
          Origin: origin,
          'X-QarHub-Client': 'web',
          'Content-Type': 'application/json',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
          ...override,
        };
        const response = await fetch(base + path, {
          method,
          headers,
          body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
        });
        const cookie = response.headers.get('set-cookie');
        if (cookie) this.cookie = cookie.split(';')[0];
        return { status: response.status, headers: response.headers, body: await response.json() };
      },
      async register(email = 'driver@example.com', name = 'Водитель') {
        const response = await this.request('/api/auth/register', 'POST', {
          email,
          name,
          password,
        });
        assert.equal(response.status, 201, JSON.stringify(response.body));
        return response;
      },
    };
  }
  return { db, server, base, client, close };
}

async function photoBytes() {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: '#258062' } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'Private camera owner' } } })
    .toBuffer();
}
async function upload(f, client, bytes, type = 'image/jpeg', extra = {}) {
  const response = await fetch(f.base + '/api/images', {
    method: 'POST',
    body: bytes,
    headers: {
      Origin: origin,
      'X-QarHub-Client': 'web',
      'Content-Type': type,
      Cookie: client.cookie,
      ...extra,
    },
  });
  return { status: response.status, body: await response.json() };
}

test('photos are decoded, stripped of metadata, attached in order and included in public profiles', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  const b = f.client();
  const user = (await a.register()).body.state.user;
  await b.register('b@example.com');
  const first = await upload(f, a, await photoBytes());
  const second = await upload(f, a, await photoBytes());
  assert.equal(first.status, 201);
  const privatePhoto = await fetch(f.base + first.body.url);
  assert.equal(privatePhoto.status, 404);
  const ownPhoto = await fetch(f.base + first.body.url, { headers: { Cookie: a.cookie } });
  assert.equal(ownPhoto.headers.get('content-type'), 'image/webp');
  assert.equal(ownPhoto.headers.get('x-content-type-options'), 'nosniff');
  const metadata = await sharp(Buffer.from(await ownPhoto.arrayBuffer())).metadata();
  assert.equal(metadata.width, 40);
  assert.equal(metadata.exif, undefined);
  const foreign = await b.request('/api/posts', 'POST', { ...postBody, imageIds: [first.body.id] });
  assert.equal(foreign.status, 400);
  const attached = await a.request('/api/posts', 'POST', {
    ...postBody,
    imageIds: [second.body.id, first.body.id],
  });
  assert.equal(attached.status, 201);
  assert.deepEqual(
    attached.body.state.posts[0].images.map((p) => p.id),
    [second.body.id, first.body.id],
  );
  assert.equal((await fetch(f.base + first.body.url)).status, 200);
  await a.request('/api/profile', 'PATCH', {
    name: 'Водитель',
    city: 'Астана',
    bio: 'Люблю японские автомобили.',
    avatarId: first.body.id,
  });
  await a.request(`/api/posts/${attached.body.createdId}/bookmark`, 'PUT', { active: true });
  const profile = (await b.request(`/api/profiles/${user.id}`)).body.profile;
  assert.equal(profile.city, 'Астана');
  assert.equal(profile.avatar, first.body.url);
  assert.equal(profile.posts.length, 1);
  assert.equal(profile.posts[0].avatar, first.body.url);
  assert.equal(profile.email, undefined);
  assert.equal(profile.saved, undefined);
  assert.equal(profile.password_hash, undefined);
  assert.equal(
    (await b.request('/api/profile', 'PATCH', { name: 'Другой', avatarId: first.body.id })).status,
    400,
  );
  const cleared = await a.request('/api/profile', 'PATCH', {
    name: 'Водитель',
    city: '',
    bio: '',
    avatarId: null,
  });
  assert.equal(cleared.body.state.user.avatar, null);
  assert.equal(cleared.body.state.user.city, '');
  assert.equal((await a.request('/api/profiles/missing')).status, 404);
});

test('car photos stay private until the owner publishes the car and can be replaced or removed', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  const b = f.client();
  const user = (await a.register()).body.state.user;
  await b.register('b@example.com');
  const photo = (await upload(f, a, await photoBytes())).body;
  const result = await a.request('/api/cars', 'POST', {
    brand: 'BMW',
    model: 'E46',
    year: 2003,
    imageId: photo.id,
  });
  const id = result.body.createdId;
  assert.equal(result.status, 201);
  assert.equal(result.body.state.cars[0].isPublic, false);
  assert.equal((await fetch(f.base + photo.url)).status, 404);
  assert.equal((await b.request(`/api/profiles/${user.id}`)).body.profile.cars.length, 0);
  assert.equal((await b.request(`/api/cars/${id}`, 'PATCH', { isPublic: true })).status, 404);
  await a.request(`/api/cars/${id}`, 'PATCH', { isPublic: true });
  assert.equal((await fetch(f.base + photo.url)).status, 200);
  assert.equal((await b.request(`/api/profiles/${user.id}`)).body.profile.cars[0].image, photo.url);
  await a.request(`/api/cars/${id}`, 'PATCH', { isPublic: false });
  assert.equal((await fetch(f.base + photo.url)).status, 404);
  await a.request(`/api/cars/${id}`, 'PATCH', { imageId: null });
  assert.equal((await a.request('/api/state')).body.state.cars[0].image, null);
  const another = (await upload(f, a, await photoBytes())).body;
  await a.request(`/api/cars/${id}`, 'PATCH', { imageId: another.id, isPublic: true });
  assert.equal((await fetch(f.base + another.url)).status, 200);
  await a.request(`/api/cars/${id}`, 'DELETE');
  assert.equal((await fetch(f.base + another.url)).status, 404);
});

test('uploads reject guests, unsafe formats, corrupt/oversized images and invalid attachment lists', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  const bytes = await photoBytes();
  assert.equal((await upload(f, a, bytes)).status, 401);
  await a.register();
  assert.equal(
    (await upload(f, a, bytes, 'image/jpeg', { Origin: 'http://evil.example' })).status,
    403,
  );
  assert.equal(
    (await upload(f, a, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'))
      .status,
    415,
  );
  assert.equal(
    (
      await upload(
        f,
        a,
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
      )
    ).status,
    400,
  );
  assert.equal((await upload(f, a, Buffer.from('not an image'))).status, 400);
  assert.equal((await upload(f, a, Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  const huge = await sharp({
    create: { width: 5100, height: 5000, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  assert.equal((await upload(f, a, huge, 'image/png')).status, 400);
  const resizedInput = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: 'green' },
  })
    .png()
    .toBuffer();
  const accepted = await upload(f, a, resizedInput, 'image/png');
  assert.equal(accepted.status, 201);
  const resized = f.db.prepare('SELECT bytes FROM images WHERE id = ?').get(accepted.body.id);
  assert.equal((await sharp(Buffer.from(resized.bytes)).metadata()).width, 1920);
  for (const imageIds of [
    [null],
    ['missing'],
    [accepted.body.id, accepted.body.id],
    Array(5).fill('x'),
    'bad',
  ])
    assert.equal((await a.request('/api/posts', 'POST', { ...postBody, imageIds })).status, 400);
  assert.equal(f.db.prepare('SELECT count(*) count FROM posts').get().count, 0);
  assert.equal(
    (await a.request('/api/profile', 'PATCH', { name: 'Водитель', bio: 'x'.repeat(501) })).status,
    400,
  );
  f.db.prepare('UPDATE images SET created_at = 0').run();
  await upload(f, a, bytes);
  assert.equal(f.db.prepare('SELECT id FROM images WHERE id = ?').get(accepted.body.id), undefined);
});

test('day-two database migrates without losing accounts, posts or private cars', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'qarhub-migration-'));
  const file = join(folder, 'old.sqlite');
  t.after(() => {
    const resolved = resolve(folder);
    if (resolved.startsWith(resolve(tmpdir()) + '\\'))
      rmSync(resolved, { recursive: true, force: true });
  });
  const old = new DatabaseSync(file);
  old.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  old.prepare('INSERT INTO schema_migrations VALUES (2, ?)').run(new Date().toISOString());
  old
    .prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)')
    .run('old', 'old@example.com', 'Старый участник', 'existing-hash', '2026-09-11');
  old
    .prepare('INSERT INTO cars VALUES (?, ?, ?, ?, ?, ?)')
    .run('car', 'old', 'BMW', 'E46', 2003, '2.5');
  old.close();
  const f = await fixture(t, { file });
  assert.equal(
    f.db.prepare('SELECT password_hash FROM users WHERE id = ?').get('old').password_hash,
    'existing-hash',
  );
  assert.equal(f.db.prepare('SELECT is_public FROM cars').get().is_public, 0);
  assert.equal((await f.client().request('/api/profiles/old')).body.profile.cars.length, 0);
  await f.close();
  const reopened = openDatabase(file);
  assert.equal(
    reopened.prepare('SELECT count(*) count FROM schema_migrations WHERE version = 3').get().count,
    1,
  );
  reopened.close();
});

test('registration creates durable account, salted password hash and hashed session token', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  const result = await a.register('Driver@Example.com', 'Алихан');
  assert.equal(result.body.state.user.email, 'driver@example.com');
  assert.match(result.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(result.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const row = f.db.prepare('SELECT * FROM users').get();
  assert.match(row.password_hash, /^scrypt-v1:/);
  assert.ok(!row.password_hash.includes(password));
  const session = f.db.prepare('SELECT * FROM sessions').get();
  assert.notEqual(session.token_hash, a.cookie.split('=')[1]);
  assert.equal((await a.request('/api/state')).body.state.user.name, 'Алихан');
  const duplicate = await a.request('/api/auth/register', 'POST', {
    email: 'DRIVER@example.com',
    name: 'Другой',
    password,
  });
  assert.equal(duplicate.status, 409);
  const b = f.client();
  await b.register('second@example.com');
  assert.notEqual(
    row.password_hash,
    f.db.prepare('SELECT password_hash FROM users WHERE email = ?').get('second@example.com')
      .password_hash,
  );
});

test('login, logout, token invalidation, expiry and secure-cookie mode', async (t) => {
  const f = await fixture(t, { secureCookies: true });
  const a = f.client();
  const first = await a.register();
  assert.match(first.headers.get('set-cookie'), /Secure/i);
  const stale = a.cookie;
  assert.equal((await a.request('/api/auth/logout', 'POST')).body.state.user, null);
  a.cookie = stale;
  assert.equal((await a.request('/api/state')).body.state.user, null);
  const wrong = await a.request('/api/auth/login', 'POST', {
    email: 'driver@example.com',
    password: 'wrong-long-password',
  });
  const absent = await a.request('/api/auth/login', 'POST', {
    email: 'absent@example.com',
    password: 'wrong-long-password',
  });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, absent.body);
  assert.equal(
    (await a.request('/api/auth/login', 'POST', { email: 'driver@example.com', password })).status,
    200,
  );
  assert.notEqual(a.cookie, stale);
  f.db.prepare('UPDATE sessions SET expires_at = 0').run();
  assert.equal((await a.request('/api/posts', 'POST', postBody)).status, 401);
});

test('two users share a question and answer; only the author chooses its solution', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  const b = f.client();
  await a.register('a@example.com', 'Автор');
  await b.register('b@example.com', 'Участник');
  const question = await a.request('/api/posts', 'POST', {
    ...postBody,
    own: false,
    author: 'Подмена',
    user_id: 'bad',
  });
  assert.equal(question.status, 201);
  const id = question.body.createdId;
  assert.equal(question.body.state.posts[0].author, 'Автор');
  assert.equal((await b.request('/api/state')).body.state.posts[0].own, false);
  const response = await b.request(`/api/posts/${id}/replies`, 'POST', {
    text: 'Записываю дату, пробег и каждую выполненную работу.',
    author: 'Подмена',
  });
  assert.equal(response.status, 201);
  const replyId = response.body.createdId;
  assert.equal((await b.request(`/api/posts/${id}/solution`, 'PUT', { replyId })).status, 403);
  assert.equal((await a.request(`/api/posts/${id}/solution`, 'PUT', { replyId })).status, 200);
  assert.equal((await b.request('/api/state')).body.state.posts[0].acceptedReply, replyId);
  const other = (await a.request('/api/posts', 'POST', postBody)).body.createdId;
  assert.equal((await a.request(`/api/posts/${other}/solution`, 'PUT', { replyId })).status, 400);
  assert.equal(
    (await a.request(`/api/posts/${id}/solution`, 'PUT', { replyId: null })).status,
    200,
  );
  const guest = f.client();
  assert.equal((await guest.request('/api/state')).body.state.posts.length, 2);
  assert.equal(
    (await guest.request(`/api/posts/${id}/replies`, 'POST', { text: 'Неавторизованный ответ' }))
      .status,
    401,
  );
});

test('garage and bookmarks are private; reactions are idempotent', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  const b = f.client();
  await a.register('a@example.com');
  await b.register('b@example.com');
  const id = (await a.request('/api/posts', 'POST', postBody)).body.createdId;
  const car = await a.request('/api/cars', 'POST', {
    brand: 'BMW',
    model: 'E46',
    year: '2003',
    engine: '2.5',
  });
  assert.equal(car.status, 201);
  assert.equal((await b.request('/api/state')).body.state.cars.length, 0);
  assert.equal((await b.request(`/api/cars/${car.body.createdId}`, 'DELETE')).status, 404);
  await a.request(`/api/posts/${id}/bookmark`, 'PUT', { active: true });
  assert.equal((await b.request('/api/state')).body.state.saved.length, 0);
  await a.request(`/api/posts/${id}/like`, 'PUT', { active: true });
  await a.request(`/api/posts/${id}/like`, 'PUT', { active: true });
  assert.equal((await b.request('/api/state')).body.state.posts[0].likes, 1);
  await a.request(`/api/posts/${id}/like`, 'PUT', { active: false });
  assert.equal((await a.request('/api/state')).body.state.posts[0].likes, 0);
  await a.request('/api/memberships/BMW', 'PUT', { active: true });
  assert.deepEqual((await a.request('/api/state')).body.state.joined, ['BMW']);
  assert.deepEqual((await b.request('/api/state')).body.state.joined, []);
  assert.equal((await a.request(`/api/cars/${car.body.createdId}`, 'DELETE')).status, 200);
});

test('untrusted origins, invalid data, SQL-like strings and oversized JSON are handled', async (t) => {
  const f = await fixture(t);
  const a = f.client();
  assert.equal(
    (await a.request('/api/auth/register', 'POST', {}, { Origin: 'https://evil.example' })).status,
    403,
  );
  assert.equal(
    (await a.request('/api/auth/register', 'POST', {}, { 'X-QarHub-Client': '' })).status,
    403,
  );
  assert.equal(
    (await a.request('/api/auth/register', 'POST', { email: 'bad', name: 'A', password: 'short' }))
      .status,
    400,
  );
  await a.register();
  assert.equal((await a.request('/api/posts', 'POST', { ...postBody, brand: 'fake' })).status, 400);
  assert.equal(
    (await a.request('/api/posts', 'POST', { ...postBody, body: 'x'.repeat(40000) })).status,
    413,
  );
  assert.equal(
    (await a.request('/api/cars', 'POST', { brand: 'BMW', model: 'E46', year: 2003.5 })).status,
    400,
  );
  const injection = await a.request('/api/posts', 'POST', {
    ...postBody,
    title: "Robert'); DROP TABLE users;--",
  });
  assert.equal(injection.status, 201);
  assert.equal(f.db.prepare('SELECT count(*) count FROM users').get().count, 1);
  assert.equal(
    (await a.request('/api/profile', 'PATCH', { name: 'Новое имя' })).body.state.posts[0].author,
    'Новое имя',
  );
  const publicState = (await f.client().request('/api/state')).body.state;
  assert.ok(!JSON.stringify(publicState).includes('driver@example.com'));
  assert.ok(!JSON.stringify(publicState).includes('password_hash'));
});

test('authentication attempts are rate limited', async (t) => {
  const f = await fixture(t, { authLimit: 2 });
  const a = f.client();
  await a.request('/api/auth/login', 'POST', {});
  await a.request('/api/auth/login', 'POST', {});
  const limited = await a.request('/api/auth/login', 'POST', {});
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
});

test('local tunnel uses the last forwarded client IP for separate login limits', async (t) => {
  const f = await fixture(t, { authLimit: 2, trustProxy: 'loopback', secureCookies: true });
  const client = f.client();
  const from = (chain) =>
    client.request('/api/auth/login', 'POST', {}, { 'X-Forwarded-For': chain });
  assert.equal((await from('198.51.100.10')).status, 400);
  assert.equal((await from('203.0.113.5, 198.51.100.10')).status, 400);
  // A forged leftmost address must not bypass the limit for the real client.
  assert.equal((await from('203.0.113.6, 198.51.100.10')).status, 429);
  assert.equal((await from('198.51.100.11')).status, 400);
});

test('accounts, sessions and posts survive database and server restart', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'qarhub-api-'));
  t.after(() => {
    const checked = resolve(directory);
    if (checked.startsWith(resolve(tmpdir()) + '\\') || checked.startsWith(resolve(tmpdir()) + '/'))
      rmSync(checked, { recursive: true, force: true });
  });
  const file = join(directory, 'test.sqlite');
  const first = await fixture(t, { file });
  const a = first.client();
  await a.register();
  const photo = (await upload(first, a, await photoBytes())).body;
  const id = (await a.request('/api/posts', 'POST', { ...postBody, imageIds: [photo.id] })).body
    .createdId;
  await a.request('/api/profile', 'PATCH', {
    name: 'Водитель',
    city: 'Астана',
    avatarId: photo.id,
  });
  const cookie = a.cookie;
  await first.close();
  const second = await fixture(t, { file });
  const b = second.client();
  b.cookie = cookie;
  const state = (await b.request('/api/state')).body.state;
  assert.equal(state.posts[0].id, id);
  assert.equal(state.user.email, 'driver@example.com');
  assert.equal(state.user.city, 'Астана');
  assert.equal(state.posts[0].images[0].id, photo.id);
  assert.equal((await fetch(second.base + photo.url)).status, 200);
  await second.close();
});
