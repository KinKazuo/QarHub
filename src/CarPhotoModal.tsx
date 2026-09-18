import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import ImagePicker from './ImagePicker';
import type { Car } from './data';
import type { ApiResult } from './api';

export default function CarPhotoModal({
  car,
  mutate,
  onClose,
  onSuccess,
}: {
  car: Car;
  mutate: (path: string, method?: string, body?: unknown) => Promise<ApiResult>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [photos, setPhotos] = useState(
    car.imageId && car.image ? [{ id: car.imageId, url: car.image }] : [],
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading || saving) return;
    const form = new FormData(e.currentTarget);
    setSaving(true);
    setError('');
    try {
      await mutate(`/cars/${car.id}`, 'PATCH', {
        imageId: photos[0]?.id || null,
        isPublic: form.get('isPublic') === 'on',
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={`${car.brand} ${car.model}`} onClose={saving ? () => {} : onClose}>
      <form className="editor-form" onSubmit={submit}>
        <ImagePicker
          label="Фото автомобиля"
          value={photos}
          onChange={setPhotos}
          onBusy={setUploading}
          disabled={saving}
        />
        <label className="checkbox-label">
          <input type="checkbox" name="isPublic" defaultChecked={car.isPublic} disabled={saving} />
          Показывать автомобиль в моём профиле
        </label>
        <p className="form-intro">
          Другие участники увидят фото, модель, год и двигатель, если включить показ.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button full-width" disabled={saving || uploading} type="submit">
          {saving ? 'Сохраняем…' : 'Сохранить автомобиль'}
        </button>
      </form>
    </Modal>
  );
}
