import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initialPosts } from '../src/data.ts';

export function openDatabase(file, { seed = true } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(resolve(file)), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(
      new Date().toISOString(),
    );
    const initialized = db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get();
    if (!initialized) {
      if (seed) {
        const insert = db.prepare(`INSERT INTO posts
          (id, demo_author, color, brand, car, title, body, category, kind, created_at, image, demo_likes, is_demo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
        const reply = db.prepare(
          'INSERT INTO replies (id, post_id, demo_author, body, created_at) VALUES (?, ?, ?, ?, ?)',
        );
        for (const post of initialPosts) {
          insert.run(
            post.id,
            post.author,
            post.color,
            post.brand,
            post.car,
            post.title,
            post.body,
            post.category,
            post.kind,
            post.createdAt,
            post.image || null,
            post.likes,
          );
          for (const item of post.replies)
            reply.run(item.id, post.id, item.author, item.text, item.createdAt);
          if (post.acceptedReply)
            db.prepare('UPDATE posts SET accepted_reply_id = ? WHERE id = ?').run(
              post.acceptedReply,
              post.id,
            );
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)').run(
        new Date().toISOString(),
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return db;
}

export function getState(db, user = null) {
  const allReplies = db
    .prepare(
      `SELECT r.*, u.name FROM replies r LEFT JOIN users u ON u.id = r.user_id ORDER BY r.created_at, r.rowid`,
    )
    .all();
  const replies = new Map();
  for (const r of allReplies) {
    const list = replies.get(r.post_id) || [];
    list.push({
      id: r.id,
      author: r.name || r.demo_author || 'Удалённый участник',
      text: r.body,
      createdAt: r.created_at,
    });
    replies.set(r.post_id, list);
  }
  const rows = db
    .prepare(
      `SELECT p.*, u.name,
    (SELECT count(*) FROM likes l WHERE l.post_id = p.id) AS actual_likes
    FROM posts p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC, p.rowid DESC`,
    )
    .all();
  const posts = rows.map((p) => {
    const author = p.name || p.demo_author || 'Удалённый участник';
    return {
      id: p.id,
      author,
      initials: author[0].toUpperCase(),
      color: p.color,
      brand: p.brand,
      car: p.car,
      title: p.title,
      body: p.body,
      category: p.category,
      kind: p.kind,
      createdAt: p.created_at,
      likes: p.demo_likes + p.actual_likes,
      image: p.image || undefined,
      demo: !!p.is_demo,
      own: !!user && p.user_id === user.id,
      replies: replies.get(p.id) || [],
      acceptedReply: p.accepted_reply_id || undefined,
    };
  });
  if (!user) return { posts, user: null, name: '', cars: [], liked: [], saved: [], joined: [] };
  const cars = db
    .prepare(
      'SELECT id, brand, model, year, engine FROM cars WHERE user_id = ? ORDER BY rowid DESC',
    )
    .all(user.id)
    .map((c) => ({ ...c, year: String(c.year) }));
  return {
    posts,
    user,
    name: user.name,
    cars,
    liked: db
      .prepare('SELECT post_id FROM likes WHERE user_id = ?')
      .all(user.id)
      .map((r) => r.post_id),
    saved: db
      .prepare('SELECT post_id FROM bookmarks WHERE user_id = ?')
      .all(user.id)
      .map((r) => r.post_id),
    joined: db
      .prepare('SELECT brand FROM memberships WHERE user_id = ?')
      .all(user.id)
      .map((r) => r.brand),
  };
}
