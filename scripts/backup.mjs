import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = resolve(root, process.env.DATABASE_PATH || 'data/qarhub.sqlite');
if (!existsSync(source)) throw new Error('Database does not exist yet. Start QarHub first.');
const folder = resolve(root, 'backups');
mkdirSync(folder, { recursive: true });
const destination = resolve(
  folder,
  `qarhub-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  console.log(`Backup saved: ${destination}`);
} finally {
  db.close();
}
