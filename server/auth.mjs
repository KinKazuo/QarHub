import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const cookieName = 'qarhub_session';
const lifetime = 7 * 24 * 60 * 60 * 1000;
export const digest = (value) => createHash('sha256').update(value).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, parameters);
  return `scrypt-v1:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [version, salt, expected] = (encoded || '').split(':');
  if (version !== 'scrypt-v1' || !salt || !expected) return false;
  const candidate = await derive(password, salt, 64, parameters);
  const stored = Buffer.from(expected, 'hex');
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}
export function sessionToken(request) {
  const cookie = (request.headers.cookie || '')
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function currentUser(db, request) {
  const token = sessionToken(request);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(digest(token), Date.now());
  return row || null;
}
export function createSession(db, request, response, userId, secure) {
  const previous = sessionToken(request);
  if (previous) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(previous));
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  const token = randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(digest(token), userId, Date.now() + lifetime, Date.now());
  response.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: lifetime,
  });
}
export function clearSession(db, request, response, secure) {
  const token = sessionToken(request);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
  response.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}
