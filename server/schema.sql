CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 32),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  demo_author TEXT,
  color TEXT NOT NULL DEFAULT 'green',
  brand TEXT NOT NULL,
  car TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 8 AND 140),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 20 AND 10000),
  category TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('question', 'journal')),
  created_at TEXT NOT NULL,
  image TEXT,
  demo_likes INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0, 1)),
  accepted_reply_id TEXT REFERENCES replies(id) ON DELETE SET NULL
) STRICT;
CREATE INDEX IF NOT EXISTS posts_author ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_date ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_brand ON posts(brand);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  demo_author TEXT,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 3 AND 5000),
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS replies_post ON replies(post_id);

CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  engine TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE INDEX IF NOT EXISTS cars_user ON cars(user_id);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
) STRICT;
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
) STRICT;
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  PRIMARY KEY (user_id, brand)
) STRICT;

CREATE TRIGGER IF NOT EXISTS accepted_reply_belongs_to_post
BEFORE UPDATE OF accepted_reply_id ON posts
WHEN NEW.accepted_reply_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM replies WHERE id = NEW.accepted_reply_id AND post_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'Reply must belong to the same post');
END;
