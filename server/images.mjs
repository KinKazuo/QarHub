import express from 'express';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';

export class ImageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const imageUrl = (id) => (id ? `/api/images/${id}` : null);
export function ownedImage(db, userId, id) {
  if (id === null || id === undefined) return null;
  if (
    typeof id !== 'string' ||
    !db.prepare('SELECT id FROM images WHERE id = ? AND user_id = ?').get(id, userId)
  )
    throw new ImageError(400, 'Выбери фотографию, загруженную в свой аккаунт.');
  return id;
}
const referenced = `EXISTS (SELECT 1 FROM users WHERE avatar_id = images.id)
  OR EXISTS (SELECT 1 FROM cars WHERE image_id = images.id)
  OR EXISTS (SELECT 1 FROM post_images WHERE image_id = images.id)`;

export function mountImages(app, db, requireUser) {
  let processing = 0;
  app.post(
    '/api/images',
    requireUser,
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Слишком много фотографий. Подожди минуту.' },
    }),
    (req, res, next) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.get('Content-Type')))
        throw new ImageError(415, 'Выбери фото в формате JPEG, PNG или WebP.');
      if (processing >= 2)
        throw new ImageError(
          503,
          'Обрабатываем другие фотографии. Попробуй через несколько секунд.',
        );
      processing++;
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          processing--;
        }
      };
      res.once('close', () => {
        if (!req.decodingImage) release();
      });
      req.releaseImageSlot = release;
      next();
    },
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb', inflate: false }),
    async (req, res) => {
      req.decodingImage = true;
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length)
          throw new ImageError(400, 'Файл пустой.');
        const input = sharp(req.body, { limitInputPixels: 25_000_000, failOn: 'warning' });
        let bytes;
        try {
          const metadata = await input.metadata();
          if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1)
            throw new Error('Unsupported image');
          bytes = await input
            .rotate()
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
        } catch {
          throw new ImageError(
            400,
            'Не удалось прочитать фото. Нужен обычный JPEG, PNG или WebP до 25 мегапикселей.',
          );
        }
        if (res.destroyed) return;
        // Unattached drafts expire; linked photos remain part of the database backup.
        db.prepare(`DELETE FROM images WHERE created_at < ? AND NOT (${referenced})`).run(
          Date.now() - 24 * 60 * 60 * 1000,
        );
        const usage = db
          .prepare(
            'SELECT coalesce(sum(length(bytes)), 0) size, count(*) count FROM images WHERE user_id = ?',
          )
          .get(req.user.id);
        if (usage.size + bytes.length > 100 * 1024 * 1024 || usage.count >= 500)
          throw new ImageError(400, 'Достигнут лимит фотографий аккаунта (100 МБ или 500 фото).');
        const id = randomUUID();
        db.prepare('INSERT INTO images (id, user_id, bytes, created_at) VALUES (?, ?, ?, ?)').run(
          id,
          req.user.id,
          bytes,
          Date.now(),
        );
        res.status(201).json({ id, url: imageUrl(id) });
      } finally {
        req.releaseImageSlot();
      }
    },
  );
  app.get('/api/images/:id', (req, res) => {
    const row = db
      .prepare(
        `SELECT bytes FROM images WHERE id = ? AND (
      user_id = ? OR EXISTS (SELECT 1 FROM users WHERE avatar_id = images.id)
      OR EXISTS (SELECT 1 FROM cars WHERE image_id = images.id AND is_public = 1)
      OR EXISTS (SELECT 1 FROM post_images WHERE image_id = images.id))`,
      )
      .get(req.params.id, req.user?.id || '');
    if (!row) return res.status(404).json({ error: 'Фотография не найдена.' });
    res.type('image/webp').send(Buffer.from(row.bytes));
  });
}
