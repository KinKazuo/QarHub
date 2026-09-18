import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { uploadImage, type Photo } from './api';

type Props = {
  label: string;
  value: Photo[];
  onChange: (photos: Photo[]) => void;
  onBusy: (busy: boolean) => void;
  max?: number;
  disabled?: boolean;
};

export default function ImagePicker({
  label,
  value,
  onChange,
  onBusy,
  max = 1,
  disabled = false,
}: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function select(files: File[]) {
    if (!files.length) return;
    setError('');
    if (files.length + value.length > max) {
      setError(`Можно добавить не больше ${max} фото. Сначала убери лишнее.`);
      return;
    }
    if (
      files.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
          f.size > 5 * 1024 * 1024 ||
          !f.size,
      )
    ) {
      setError('Выбери JPEG, PNG или WebP до 5 МБ. Пустые файлы не подходят.');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    onBusy(true);
    let next = [...value];
    try {
      for (const file of files) {
        const photo = await uploadImage(file, abort.signal);
        if (abort.signal.aborted) return;
        next = [...next, photo];
        onChange(next);
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setError(error instanceof Error ? error.message : 'Не удалось загрузить фото.');
    } finally {
      if (!abort.signal.aborted) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <div className="photo-picker" role="group" aria-labelledby={`${id}-title`}>
      <strong id={`${id}-title`}>{label}</strong>
      <p id={`${id}-help`}>
        JPEG, PNG или WebP · до 5 МБ и 25 Мп{max > 1 ? ` · до ${max} фото` : ''}
      </p>
      {value.length > 0 && (
        <div className="photo-previews">
          {value.map((photo, index) => (
            <div className="photo-preview" key={photo.id}>
              <img src={photo.url} alt={`${label}: фото ${index + 1}`} />
              <button
                type="button"
                aria-label={`Убрать фото ${index + 1}`}
                disabled={busy || disabled}
                onClick={() => onChange(value.filter((p) => p.id !== photo.id))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {value.length < max && (
        <label className="photo-input" htmlFor={id}>
          <span>
            <ImagePlus size={18} />
            {busy ? 'Загружаем фото…' : 'Выбрать фото'}
          </span>
          <input
            id={id}
            type="file"
            aria-label={label}
            aria-describedby={`${id}-help`}
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            disabled={busy || disabled}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              void select(files);
            }}
          />
        </label>
      )}
      {busy && <p role="status">Обрабатываем фотографию…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
