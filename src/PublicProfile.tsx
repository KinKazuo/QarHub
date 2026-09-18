import { useEffect, useState } from 'react';
import { CarFront, MapPin } from 'lucide-react';
import Modal from './Modal';
import { fetchProfile, type MemberProfile } from './api';

export default function PublicProfile({
  id,
  onClose,
  onPost,
}: {
  id: string;
  onClose: () => void;
  onPost: (id: string) => void;
}) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    setProfile(null);
    fetchProfile(id, abort.signal)
      .then((p) => {
        if (!abort.signal.aborted) setProfile(p);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [id, retry]);
  return (
    <Modal title="Профиль участника" onClose={onClose} wide>
      <div className="member-profile">
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button className="secondary-button" onClick={() => setRetry((r) => r + 1)}>
              Повторить
            </button>
          </div>
        ) : !profile ? (
          <p role="status">Загружаем профиль…</p>
        ) : (
          <>
            <div className="member-heading">
              <span className="avatar member-avatar green">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" />
                ) : (
                  profile.name[0].toUpperCase()
                )}
              </span>
              <div>
                <span className="eyebrow">НА ОДНОЙ ДОРОГЕ</span>
                <h1>{profile.name}</h1>
                {profile.city && (
                  <p>
                    <MapPin size={15} />
                    {profile.city}
                  </p>
                )}
                <small>
                  В сообществе с{' '}
                  {new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(
                    new Date(profile.joinedAt),
                  )}
                </small>
              </div>
            </div>
            {profile.bio && <p className="member-bio">{profile.bio}</p>}
            <h2>
              Автомобили <span>{profile.cars.length}</span>
            </h2>
            {profile.cars.length ? (
              <div className="member-cars">
                {profile.cars.map((car) => (
                  <article key={car.id}>
                    {car.image ? (
                      <img src={car.image} alt={`${car.brand} ${car.model}`} />
                    ) : (
                      <div className="member-car-placeholder">
                        <CarFront size={60} strokeWidth={1} />
                      </div>
                    )}
                    <h3>
                      {car.brand} {car.model}
                    </h3>
                    <p>
                      {car.year}
                      {car.engine && ` · ${car.engine}`}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">Участник пока не показывает свои автомобили.</p>
            )}
            <h2>
              Публикации <span>{profile.posts.length}</span>
            </h2>
            {profile.posts.length ? (
              <div className="member-posts">
                {profile.posts.map((post) => (
                  <button key={post.id} onClick={() => onPost(post.id)}>
                    {post.image && <img src={post.image} alt="" loading="lazy" />}
                    <span>
                      <small>
                        {post.brand} · {post.kind === 'journal' ? 'Бортжурнал' : 'Вопрос'}
                      </small>
                      <strong>{post.title}</strong>
                      <small>{post.replies.length} ответов</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Здесь появятся первые вопросы и истории.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
