import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  CarFront,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Compass,
  Flame,
  Heart,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { brandMarks, brands, categories, type Category, type Post, type Section } from './data';
import { ApiError, type Photo } from './api';
import ImagePicker from './ImagePicker';
import PublicProfile from './PublicProfile';
import CarPhotoModal from './CarPhotoModal';
import { useCommunity } from './useCommunity';
import AccountModal from './AccountModal';
import Modal from './Modal';

const sections: { id: Section; label: string; icon: typeof Compass }[] = [
  { id: 'feed', label: 'Лента сообщества', icon: Compass },
  { id: 'questions', label: 'Вопросы и ответы', icon: MessageCircle },
  { id: 'journals', label: 'Бортжурналы', icon: BookOpen },
  { id: 'communities', label: 'Сообщества', icon: Users },
];
const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(date));
const replyWord = (count: number) =>
  count % 100 >= 11 && count % 100 <= 14
    ? 'ответов'
    : count % 10 === 1
      ? 'ответ'
      : count % 10 >= 2 && count % 10 <= 4
        ? 'ответа'
        : 'ответов';
type ModalType = 'post' | 'car' | 'profile' | 'rules' | null;

function BrandMark({ brand }: { brand: string }) {
  return (
    <span
      className={`brand-mark brand-${brand.toLowerCase().replace(/[^a-z]/g, '')}`}
      aria-hidden="true"
    >
      {brandMarks[brand] || brand.slice(0, 1)}
    </span>
  );
}

export default function App() {
  const { state, loading, error: connectionError, busy, refresh, mutate } = useCommunity();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingCar, setEditingCar] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('member'),
  );
  const [pendingModal, setPendingModal] = useState<ModalType>(null);
  const [section, setSection] = useState<Section>('feed');
  const [category, setCategory] = useState<Category>('Все темы');
  const [brand, setBrand] = useState('Все марки');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('post'),
  );
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [replyText, setReplyText] = useState('');
  const [formError, setFormError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const post = state.posts.find((p) => p.id === selected);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    const pop = () => {
      setSelected(new URLSearchParams(window.location.search).get('post'));
      setReplyText('');
      setMemberId(new URLSearchParams(window.location.search).get('member'));
    };
    window.addEventListener('keydown', key);
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('popstate', pop);
    };
  }, []);
  useEffect(() => {
    document.title = post ? `${post.title} — QarHub` : 'QarHub — на одной дороге';
  }, [post]);

  const navigate = (next: Section) => {
    setSection(next);
    setMobileMenu(false);
    setQuery('');
    setCategory('Все темы');
    setBrand('Все марки');
    setSort('new');
  };
  const openPost = (id: string) => {
    setMemberId(null);
    setSelected(id);
    setReplyText('');
    window.history.pushState({}, '', `?post=${encodeURIComponent(id)}`);
  };
  const closePost = () => {
    setSelected(null);
    setReplyText('');
    window.history.pushState({}, '', window.location.pathname);
  };
  const openMember = (id: string) => {
    setSelected(null);
    setModal(null);
    setMemberId(id);
    window.history.pushState({}, '', '?member=' + encodeURIComponent(id));
  };
  const closeMember = () => {
    setMemberId(null);
    window.history.pushState({}, '', window.location.pathname);
  };
  const openModal = (type: ModalType) => {
    setPhotos([]);
    setUploading(false);
    setFormError('');
    if ((type === 'post' || type === 'car') && !state.user) {
      setPendingModal(type);
      setModal('profile');
      return;
    }
    setPendingModal(null);
    setModal(type);
  };
  async function action(path: string, method: string, body?: unknown, message?: string) {
    if (!state.user) {
      openModal('profile');
      return;
    }
    try {
      await mutate(path, method, body);
      if (message) setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось выполнить действие.');
      if (error instanceof ApiError && error.status === 401) openModal('profile');
    }
  }
  const toggleSaved = (id: string) =>
    void action(`/posts/${id}/bookmark`, 'PUT', { active: !state.saved.includes(id) });
  const toggleLiked = (id: string) =>
    void action(`/posts/${id}/like`, 'PUT', { active: !state.liked.includes(id) });
  const chooseBrand = (value: string) => {
    navigate('feed');
    setBrand(value);
  };
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ru');
    return state.posts
      .filter(
        (p) =>
          (section !== 'questions' || p.kind === 'question') &&
          (section !== 'journals' || p.kind === 'journal') &&
          (section !== 'saved' || state.saved.includes(p.id)) &&
          (brand === 'Все марки' || p.brand === brand) &&
          (category === 'Все темы' || p.category === category) &&
          (sort !== 'solved' || !!p.acceptedReply) &&
          (!search ||
            `${p.title} ${p.body} ${p.car} ${p.author} ${p.category}`
              .toLocaleLowerCase('ru')
              .includes(search)),
      )
      .sort((a, b) =>
        sort === 'popular' ? b.likes - a.likes : Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
  }, [state.posts, state.saved, state.liked, section, brand, category, query, sort]);

  async function createPost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || uploading) return;
    const data = new FormData(e.currentTarget);
    const title = String(data.get('title') || '').trim();
    const body = String(data.get('body') || '').trim();
    if (title.length < 8 || body.length < 20) {
      setFormError('Добавь заголовок от 8 символов и описание от 20 символов.');
      return;
    }
    const item = {
      title,
      body,
      imageIds: photos.map((p) => p.id),
      brand: String(data.get('brand')),
      car: String(data.get('car') || '').trim() || String(data.get('brand')),
      category: String(data.get('category')) as Category,
      kind: data.get('kind') === 'journal' ? 'journal' : 'question',
    };
    setFormError('');
    try {
      const result = await mutate('/posts', 'POST', item);
      setModal(null);
      navigate('feed');
      setNotice('Публикация добавлена');
      openPost(result.createdId!);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось опубликовать.');
    }
  }
  async function createCar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || uploading) return;
    const data = new FormData(e.currentTarget);
    const model = String(data.get('model') || '').trim();
    const year = String(data.get('year'));
    const engine = String(data.get('engine') || '').trim();
    if (!model || Number(year) < 1950 || Number(year) > new Date().getFullYear() + 1) {
      setFormError('Укажи модель и корректный год выпуска.');
      return;
    }
    setFormError('');
    try {
      await mutate('/cars', 'POST', {
        brand: String(data.get('brand')),
        model,
        year,
        engine,
        imageId: photos[0]?.id || null,
        isPublic: data.get('isPublic') === 'on',
      });
      setModal(null);
      navigate('garage');
      setNotice('Автомобиль добавлен в гараж');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось добавить автомобиль.');
    }
  }
  async function addReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!post || replyText.trim().length < 3) return;
    if (!state.user) {
      openModal('profile');
      return;
    }
    try {
      await mutate(`/posts/${post.id}/replies`, 'POST', { text: replyText.trim() });
      setReplyText('');
      setNotice('Ответ добавлен');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось отправить ответ.');
    }
  }

  function PostCard({ item }: { item: Post }) {
    return (
      <article className="post-card">
        <div className="post-author">
          <span className={`avatar ${item.color}`}>
            {item.avatar ? <img src={item.avatar} alt="" /> : item.initials}
          </span>
          <div>
            <strong>
              {item.authorId ? (
                <a
                  className="author-link"
                  href={`?member=${item.authorId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    openMember(item.authorId!);
                  }}
                >
                  {item.author}
                </a>
              ) : (
                item.author
              )}
            </strong>
            <span>{item.car}</span>
          </div>
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        </div>
        <div className="post-content">
          <div className="post-copy">
            <div className="post-tags">
              {item.demo && <span className="tag demo-tag">Пример</span>}
              <span className={item.kind === 'journal' ? 'tag tag-journal' : 'tag'}>
                {item.kind === 'journal' ? <BookOpen size={12} /> : <Wrench size={12} />}
                {item.kind === 'journal' ? 'Бортжурнал' : item.category}
              </span>
              {item.acceptedReply && (
                <span className="solved">
                  <CheckCheck size={13} /> Решено
                </span>
              )}
            </div>
            <h3>
              <button onClick={() => openPost(item.id)}>{item.title}</button>
            </h3>
            <p>{item.body}</p>
          </div>
          {item.image && (
            <button
              className="post-thumb"
              onClick={() => openPost(item.id)}
              aria-label={`Открыть: ${item.title}`}
            >
              <img src={item.image} alt={`Фото к публикации: ${item.title}`} loading="lazy" />
            </button>
          )}
        </div>
        <div className="post-footer">
          <button
            className={`metric ${state.liked.includes(item.id) ? 'is-liked' : ''}`}
            onClick={() => toggleLiked(item.id)}
            aria-label={`Нравится: ${item.title}`}
            aria-pressed={state.liked.includes(item.id)}
          >
            <Heart size={16} fill={state.liked.includes(item.id) ? 'currentColor' : 'none'} />
            {item.likes}
          </button>
          <button className="metric" onClick={() => openPost(item.id)}>
            <MessageCircle size={16} />
            {item.replies.length} <span>{replyWord(item.replies.length)}</span>
          </button>
          <span className="post-brand">{item.brand}</span>
          <button
            className={`icon-button bookmark-button ${state.saved.includes(item.id) ? 'is-saved' : ''}`}
            onClick={() => toggleSaved(item.id)}
            aria-label={`${state.saved.includes(item.id) ? 'Убрать из избранного' : 'Сохранить'}: ${item.title}`}
            aria-pressed={state.saved.includes(item.id)}
          >
            <Bookmark size={17} fill={state.saved.includes(item.id) ? 'currentColor' : 'none'} />
          </button>
        </div>
      </article>
    );
  }

  const sectionTitle =
    section === 'saved'
      ? 'Избранное'
      : sections.find((s) => s.id === section)?.label || 'Мой гараж';
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Открыть меню"
            aria-expanded={mobileMenu}
          >
            <Menu size={23} />
          </button>
          <button className="logo" aria-label="QarHub — главная" onClick={() => navigate('feed')}>
            <span className="logo-symbol">
              Q<span />
            </span>
            <span>
              Qar<span className="logo-hub">Hub</span>
              <small>НА ОДНОЙ ДОРОГЕ</small>
            </span>
          </button>
          <div className="header-search">
            <Search size={19} />
            <input
              ref={searchRef}
              aria-label="Поиск по сообществу"
              placeholder="Найти ответ, автомобиль, историю…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (section === 'communities' || section === 'garage') setSection('feed');
              }}
            />
            <kbd>Ctrl K</kbd>
            {query && (
              <button
                className="icon-button"
                aria-label="Очистить поиск"
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <span className="country">
            KZ <span>Казахстан</span>
          </span>
          <button className="join-button" onClick={() => openModal('profile')}>
            {state.name ? (
              <span className="profile-initial" aria-hidden="true">
                {state.user?.avatar ? (
                  <img src={state.user.avatar} alt="" />
                ) : (
                  state.name[0].toUpperCase()
                )}
              </span>
            ) : (
              <Users size={17} />
            )}
            <span>{state.name || 'Присоединиться'}</span>
          </button>
        </div>
      </header>

      {mobileMenu && (
        <button
          className="menu-scrim"
          aria-label="Закрыть меню"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="app-layout">
        <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
          <p className="nav-caption">ТВОЁ СООБЩЕСТВО</p>
          <nav aria-label="Основная навигация">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${section === id ? 'active' : ''}`}
                onClick={() => navigate(id)}
              >
                <Icon size={19} />
                {label}
                {section === id && <span className="active-dot" />}
              </button>
            ))}
          </nav>
          <div className="nav-separator" />
          <nav aria-label="Личное">
            <button
              className={`nav-item ${section === 'garage' ? 'active' : ''}`}
              onClick={() => navigate('garage')}
            >
              <CarFront size={19} />
              Мой гараж
              {state.cars.length > 0 && <span className="nav-count">{state.cars.length}</span>}
            </button>
            <button
              className={`nav-item ${section === 'saved' ? 'active' : ''}`}
              onClick={() => navigate('saved')}
            >
              <Bookmark size={19} />
              Избранное
              {state.saved.length > 0 && <span className="nav-count">{state.saved.length}</span>}
            </button>
          </nav>
          <div className="nav-separator" />
          <div className="nav-caption caption-row">
            ПОПУЛЯРНЫЕ МАРКИ{' '}
            <button
              className="icon-button"
              aria-label="Все сообщества"
              onClick={() => navigate('communities')}
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="brand-nav">
            {brands.slice(0, 6).map((b) => (
              <button
                key={b}
                onClick={() => chooseBrand(b)}
                className={brand === b ? 'selected-brand' : ''}
              >
                <BrandMark brand={b} />
                <span>{b}</span>
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <button className="all-brands" onClick={() => navigate('communities')}>
            Все марки <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-note">
            <span className="mini-star">✦</span>
            <strong>
              У каждой машины
              <br />
              есть своя история.
            </strong>
            <p>Расскажи свою на QarHub.</p>
            <button onClick={() => openModal('post')}>
              Начать историю <ArrowRight size={15} />
            </button>
          </div>
          <div className="sidebar-footer">
            <button onClick={() => openModal('rules')}>О проекте и правила</button>
            <span>Сделано для тех, кто в теме.</span>
            <span>QarHub © {new Date().getFullYear()}</span>
          </div>
        </aside>

        <main className="main">
          {connectionError && (
            <div className="connection-banner" role="alert">
              <span>{connectionError}</span>
              <button onClick={() => void refresh()}>Повторить</button>
            </div>
          )}
          {loading && (
            <div className="connection-banner" role="status">
              Загружаем сообщество…
            </div>
          )}
          <div className="mobile-search">
            <Search size={17} />
            <input
              aria-label="Поиск по сообществу"
              placeholder="Найти ответ или автомобиль…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (section === 'communities' || section === 'garage') setSection('feed');
              }}
            />
            {query && (
              <button aria-label="Очистить поиск" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="page-eyebrow">
            <span>
              <span className="green-dot" /> АВТОМОБИЛЬНОЕ СООБЩЕСТВО КАЗАХСТАНА
            </span>
            <span className="edition">ПЕРВАЯ ПЕРЕДАЧА / 01</span>
          </div>
          {section === 'feed' && !query && (
            <section className="hero">
              <img
                className="hero-image"
                src="/images/hero.jpg"
                alt="Спортивный автомобиль на дороге среди деревьев"
                fetchPriority="high"
              />
              <div className="hero-shade" />
              <div className="hero-copy">
                <span className="hero-kicker">
                  <span /> БОЛЬШЕ, ЧЕМ ПРОСТО МАШИНЫ
                </span>
                <h1>
                  Свои люди.
                  <br />
                  Общий <em>драйв.</em>
                </h1>
                <p>
                  Находи ответы. Делись опытом.
                  <br />
                  Будь среди тех, кто тебя понимает.
                </p>
                <button className="hero-button" onClick={() => navigate('communities')}>
                  Найти своё сообщество <ArrowUpRight size={18} />
                </button>
              </div>
              <div className="hero-bottom">
                <span>
                  <span className="hero-line" /> ДОРОГА ОБЪЕДИНЯЕТ
                </span>
                <span>QARHUB / EST. 2026</span>
              </div>
            </section>
          )}

          {section === 'garage' ? (
            <>
              <div className="section-heading standalone-heading">
                <div>
                  <span className="eyebrow">ТВОИ АВТОМОБИЛИ</span>
                  <h1>
                    Мой гараж<span className="title-dot">.</span>
                  </h1>
                  <p>Место для машин, которые стали частью твоей истории.</p>
                </div>
                <button className="primary-button" onClick={() => openModal('car')}>
                  <Plus size={18} />
                  Добавить машину
                </button>
              </div>
              {state.cars.length ? (
                <div className="garage-grid">
                  {state.cars.map((car) => (
                    <article className="garage-card" key={car.id}>
                      <div className="garage-car-art">
                        <>
                          {car.image ? (
                            <img
                              className="garage-photo"
                              src={car.image}
                              alt={`${car.brand} ${car.model}`}
                            />
                          ) : (
                            <CarFront strokeWidth={1} size={110} />
                          )}
                        </>
                        <BrandMark brand={car.brand} />
                      </div>
                      <span className="eyebrow">
                        {car.isPublic ? 'ВИДНО В ПРОФИЛЕ' : 'ТОЛЬКО ДЛЯ ТЕБЯ'}
                      </span>
                      <h2>
                        {car.brand} {car.model}
                      </h2>
                      <p>
                        {car.year} год{car.engine && ` · ${car.engine}`}
                      </p>
                      <button className="text-link" onClick={() => chooseBrand(car.brand)}>
                        Обсуждения {car.brand} <ArrowRight size={16} />
                      </button>
                      <button
                        className="secondary-button car-edit-button"
                        disabled={busy}
                        onClick={() => setEditingCar(car.id)}
                      >
                        Фото и видимость
                      </button>
                      <button
                        className="remove-car"
                        disabled={busy}
                        onClick={() =>
                          void action(`/cars/${car.id}`, 'DELETE', {}, 'Автомобиль убран из гаража')
                        }
                      >
                        Убрать из гаража
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state garage-empty">
                  <CarFront size={54} strokeWidth={1.2} />
                  <h2>Твоя история начинается с машины</h2>
                  <p>
                    Добавь автомобиль — марку, модель и двигатель.
                    <br />
                    Так подходящие обсуждения будут ближе.
                  </p>
                  <button className="primary-button" onClick={() => openModal('car')}>
                    <Plus size={18} />
                    Добавить первый автомобиль
                  </button>
                </div>
              )}
            </>
          ) : section === 'communities' ? (
            <>
              <div className="section-heading standalone-heading">
                <div>
                  <span className="eyebrow">НАЙДИ СВОИХ</span>
                  <h1>
                    Разные машины.
                    <br />
                    Один язык<span className="title-dot">.</span>
                  </h1>
                  <p>Выбери марку и присоединяйся к обсуждениям владельцев.</p>
                </div>
                <Users className="section-art" size={74} strokeWidth={1} />
              </div>
              <div className="community-grid">
                {brands.map((b) => (
                  <article className="community-card" key={b}>
                    <BrandMark brand={b} />
                    <h2>{b}</h2>
                    <p>{state.posts.filter((p) => p.brand === b).length} публикаций</p>
                    <div>
                      <button className="text-link" onClick={() => chooseBrand(b)}>
                        Открыть <ArrowUpRight size={16} />
                      </button>
                      <button
                        className={`follow-button ${state.joined.includes(b) ? 'following' : ''}`}
                        aria-label={`${state.joined.includes(b) ? 'Отписаться от' : 'Подписаться на'} ${b}`}
                        disabled={busy}
                        onClick={() =>
                          void action(`/memberships/${encodeURIComponent(b)}`, 'PUT', {
                            active: !state.joined.includes(b),
                          })
                        }
                      >
                        {state.joined.includes(b) ? <Check size={16} /> : <Plus size={16} />}
                        {state.joined.includes(b) ? 'Вы участник' : 'Вступить'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="content-grid">
                <div className="feed-column">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {query ? 'Результаты поиска' : sectionTitle}
                        <span className="title-dot">.</span>
                      </h2>
                      <p>
                        {section === 'saved'
                          ? 'Полезное, к которому хочется вернуться'
                          : query
                            ? `По запросу «${query}» · найдено: ${filtered.length}`
                            : 'Вопросы, находки и опыт из первых рук'}
                      </p>
                    </div>
                    <button className="primary-button" onClick={() => openModal('post')}>
                      <Plus size={17} />
                      <span>{section === 'journals' ? 'Написать историю' : 'Задать вопрос'}</span>
                    </button>
                  </div>
                  <div className="feed-controls">
                    <div className="sort-tabs" role="group" aria-label="Порядок публикаций">
                      <button
                        onClick={() => setSort('new')}
                        className={sort === 'new' ? 'selected' : ''}
                      >
                        <Sparkles size={15} />
                        Свежие
                      </button>
                      <button
                        onClick={() => setSort('popular')}
                        className={sort === 'popular' ? 'selected' : ''}
                      >
                        <Flame size={15} />
                        Популярные
                      </button>
                      <button
                        onClick={() => setSort('solved')}
                        className={sort === 'solved' ? 'selected' : ''}
                      >
                        <CheckCheck size={16} />
                        Решённые
                      </button>
                    </div>
                    <label className="brand-select">
                      <Settings2 size={15} />
                      <select
                        aria-label="Фильтр по марке"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                      >
                        <option>Все марки</option>
                        {brands.map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} />
                    </label>
                  </div>
                  <div className="category-tabs" role="group" aria-label="Категории">
                    {categories.map((c) => (
                      <button
                        key={c}
                        className={category === c ? 'selected' : ''}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {brand !== 'Все марки' && (
                    <div className="filter-summary">
                      <span>
                        <BrandMark brand={brand} />
                        Сообщество {brand}
                      </span>
                      <button onClick={() => setBrand('Все марки')} aria-label="Сбросить марку">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="post-list">
                    {filtered.length ? (
                      filtered.map((item) => <PostCard key={item.id} item={item} />)
                    ) : (
                      <div className="empty-state">
                        <Search size={38} strokeWidth={1.3} />
                        <h3>
                          {section === 'saved' && !state.saved.length
                            ? 'Сохрани то, что пригодится'
                            : 'Пока ничего не нашлось'}
                        </h3>
                        <p>
                          {section === 'saved' && !state.saved.length
                            ? 'Нажми на закладку под публикацией — она появится здесь.'
                            : 'Попробуй другую марку или тему. Или начни обсуждение первым.'}
                        </p>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            if (section === 'saved') navigate('feed');
                            else {
                              setCategory('Все темы');
                              setBrand('Все марки');
                              setQuery('');
                              setSort('new');
                            }
                          }}
                        >
                          Показать все публикации <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="feed-end">
                    <span />
                    Ты среди своих. Начни разговор.
                    <span />
                  </div>
                </div>

                <aside className="right-rail">
                  <section className="garage-prompt">
                    <div className="rail-icon">
                      <CarFront size={23} />
                    </div>
                    <h3>{state.cars.length ? 'Твой гараж на месте' : 'А на чём ездишь ты?'}</h3>
                    <p>
                      {state.cars.length
                        ? `${state.cars[0].brand} ${state.cars[0].model} — находи опыт других владельцев.`
                        : 'Добавь свою машину, чтобы быстрее находить нужные ответы.'}
                    </p>
                    <button
                      onClick={() => (state.cars.length ? navigate('garage') : openModal('car'))}
                    >
                      {state.cars.length ? 'Открыть гараж' : 'Добавить в гараж'}
                      <Plus size={16} />
                    </button>
                    <div className="garage-lines" aria-hidden="true" />
                  </section>
                  <section className="rail-section">
                    <div className="rail-heading">
                      <h3>Сейчас обсуждают</h3>
                      <Flame size={17} />
                    </div>
                    {[...state.posts]
                      .sort((a, b) => b.likes - a.likes)
                      .slice(0, 3)
                      .map((p, i) => (
                        <button key={p.id} className="trending-post" onClick={() => openPost(p.id)}>
                          <span className="trending-number">0{i + 1}</span>
                          <span>
                            <strong>{p.title}</strong>
                            <small>
                              {p.brand} <span>·</span> {p.likes} нравится
                            </small>
                          </span>
                        </button>
                      ))}
                  </section>
                  <button className="story-card" onClick={() => openPost('mountain-drive')}>
                    <img
                      src="/images/mountains.jpg"
                      alt="Скалистые горные вершины"
                      loading="lazy"
                    />
                    <span className="story-shade" />
                    <span className="story-content">
                      <small>ВДОХНОВЕНИЕ В ДОРОГЕ</small>
                      <strong>
                        Лучший план —<br />
                        просто поехать.
                      </strong>
                      <span>
                        Читать бортжурнал <ArrowUpRight size={17} />
                      </span>
                    </span>
                  </button>
                  <button className="rules-link" onClick={() => openModal('rules')}>
                    <ShieldCheck size={20} />
                    <span>
                      <strong>Здесь помогают и уважают</strong>
                      <small>Правила нашего сообщества</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </aside>
              </div>
            </>
          )}
          <footer className="main-footer">
            <span>
              <span className="green-dot" /> QarHub · первая версия
            </span>
            <span>QarHub · общая база сообщества. Первые 5 историй — демонстрационные.</span>
          </footer>
        </main>
      </div>

      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Скрыть уведомление">
            <X size={16} />
          </button>
        </div>
      )}

      {selected && !post && !loading && !connectionError && (
        <Modal title="Обсуждение не найдено" onClose={closePost}>
          <div className="modal-body">
            <p>Публикация не найдена. Проверь ссылку или выбери обсуждение из ленты.</p>
            <button className="primary-button" onClick={closePost}>
              К ленте
            </button>
          </div>
        </Modal>
      )}
      {post && (
        <Modal
          title={post.kind === 'journal' ? 'Бортжурнал' : 'Обсуждение'}
          onClose={closePost}
          wide
        >
          <article className="post-detail">
            <div className="post-author">
              <span className={`avatar ${post.color}`}>
                {post.avatar ? <img src={post.avatar} alt="" /> : post.initials}
              </span>
              <div>
                <strong>
                  {post.authorId ? (
                    <a
                      className="author-link"
                      href={`?member=${post.authorId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        openMember(post.authorId!);
                      }}
                    >
                      {post.author}
                    </a>
                  ) : (
                    post.author
                  )}
                  {post.own ? ' · это ты' : ''}
                </strong>
                <span>{post.car}</span>
              </div>
              <time>{formatDate(post.createdAt)}</time>
            </div>
            <span className="tag">{post.category}</span>
            <h1>{post.title}</h1>
            <p className="detail-text">{post.body}</p>
            {!!post.images?.length ? (
              <div className="post-gallery">
                {post.images.map((photo, i) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Открыть фото ${i + 1}`}
                  >
                    <img src={photo.url} alt={`Фото ${i + 1} к публикации: ${post.title}`} />
                  </a>
                ))}
              </div>
            ) : (
              post.image && (
                <figure>
                  <img
                    className="detail-image"
                    src={post.image}
                    alt="Иллюстрация к демонстрационной истории"
                  />
                  <figcaption>Иллюстративное фото · Unsplash</figcaption>
                </figure>
              )
            )}
            <div className="detail-actions">
              <button
                className={`secondary-button ${state.liked.includes(post.id) ? 'is-liked' : ''}`}
                onClick={() => toggleLiked(post.id)}
                aria-pressed={state.liked.includes(post.id)}
              >
                <Heart size={17} />
                {post.likes}
              </button>
              <button className="secondary-button" onClick={() => toggleSaved(post.id)}>
                <Bookmark size={17} />
                {state.saved.includes(post.id) ? 'В избранном' : 'Сохранить'}
              </button>
            </div>
            {post.acceptedReply && (
              <div className="accepted-summary">
                <span>
                  <CheckCheck size={18} />
                  Автор отметил решение
                </span>
                <p>{post.replies.find((r) => r.id === post.acceptedReply)?.text}</p>
              </div>
            )}
            <div className="replies">
              <h2>
                Ответы <span>{post.replies.length}</span>
              </h2>
              {!post.replies.length && <p className="muted">Пока тихо. Поделись опытом первым.</p>}
              {post.replies.map((r) => (
                <article
                  key={r.id}
                  className={`reply ${post.acceptedReply === r.id ? 'accepted-reply' : ''}`}
                >
                  <div>
                    <span className="avatar small green">
                      {r.avatar ? <img src={r.avatar} alt="" /> : r.author[0].toUpperCase()}
                    </span>
                    <strong>
                      {r.authorId ? (
                        <a
                          className="author-link"
                          href={`?member=${r.authorId}`}
                          onClick={(e) => {
                            e.preventDefault();
                            openMember(r.authorId!);
                          }}
                        >
                          {r.author}
                        </a>
                      ) : (
                        r.author
                      )}
                    </strong>
                    {post.acceptedReply === r.id && (
                      <span className="solved">
                        <Check size={13} />
                        Решение
                      </span>
                    )}
                  </div>
                  <p>{r.text}</p>
                  {post.own && post.kind === 'question' && (
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        void action(`/posts/${post.id}/solution`, 'PUT', {
                          replyId: post.acceptedReply === r.id ? null : r.id,
                        })
                      }
                    >
                      {post.acceptedReply === r.id ? 'Снять отметку решения' : 'Этот ответ помог'}
                      <CheckCheck size={15} />
                    </button>
                  )}
                </article>
              ))}
            </div>
            <form className="reply-form" onSubmit={addReply}>
              <label htmlFor="reply">Твой ответ</label>
              <textarea
                id="reply"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Расскажи, что помогло тебе. Опыт важнее догадок."
                minLength={3}
                maxLength={5000}
                required
                rows={3}
              />
              <div>
                <span>
                  {state.user ? `Публикуешь как ${state.name}` : 'Для ответа войди в аккаунт'}
                </span>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy || replyText.trim().length < 3}
                >
                  <Send size={16} />
                  Ответить
                </button>
              </div>
            </form>
          </article>
        </Modal>
      )}

      {modal === 'post' && (
        <Modal title="Поделись с сообществом" onClose={() => setModal(null)} wide>
          <form className="editor-form" onSubmit={createPost}>
            <p className="form-intro">
              Хороший вопрос — первый шаг к решению. Укажи машину и расскажи подробности.
            </p>
            <div className="form-row">
              <label>
                Тип публикации
                <select name="kind" defaultValue={section === 'journals' ? 'journal' : 'question'}>
                  <option value="question">Вопрос сообществу</option>
                  <option value="journal">Запись в бортжурнал</option>
                </select>
              </label>
              <label>
                Тема
                <select
                  name="category"
                  defaultValue={category === 'Все темы' ? categories[1] : category}
                >
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Марка
                <select
                  name="brand"
                  defaultValue={brand !== 'Все марки' ? brand : state.cars[0]?.brand || 'Toyota'}
                >
                  {brands.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label>
                Модель и двигатель
                <input
                  name="car"
                  placeholder="Camry XV50 · 2.5 · АКПП"
                  maxLength={100}
                  defaultValue={
                    state.cars[0] ? `${state.cars[0].model} · ${state.cars[0].engine}` : ''
                  }
                />
              </label>
            </div>
            <label>
              Заголовок
              <input
                name="title"
                placeholder="Что хочешь узнать или рассказать?"
                minLength={8}
                maxLength={140}
                required
              />
            </label>
            <label>
              Подробности
              <textarea
                name="body"
                placeholder="Что произошло? При каких условиях? Что уже пробовал?"
                rows={6}
                minLength={20}
                maxLength={10000}
                required
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <ImagePicker
              label="Фото публикации"
              value={photos}
              onChange={setPhotos}
              onBusy={setUploading}
              max={4}
              disabled={busy}
            />
            <div className="form-bottom">
              <span>Будет видно всему сообществу</span>
              <button type="submit" className="primary-button" disabled={busy || uploading}>
                Опубликовать <ArrowUpRight size={17} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'car' && (
        <Modal title="Добавить автомобиль" onClose={() => setModal(null)}>
          <form className="editor-form" onSubmit={createCar}>
            <p className="form-intro">
              Знакомимся с твоей машиной. Остальное расскажешь в бортжурнале.
            </p>
            <label>
              Марка
              <select name="brand">
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              Модель
              <input name="model" placeholder="Например, Camry XV50" maxLength={80} required />
            </label>
            <div className="form-row">
              <label>
                Год выпуска
                <input
                  name="year"
                  type="number"
                  placeholder="2015"
                  min={1950}
                  max={new Date().getFullYear() + 1}
                  required
                />
              </label>
              <label>
                Двигатель и коробка
                <input name="engine" placeholder="2.5 · АКПП" maxLength={80} />
              </label>
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <ImagePicker
              label="Фото автомобиля"
              value={photos}
              onChange={setPhotos}
              onBusy={setUploading}
              disabled={busy}
            />
            <label className="checkbox-label">
              <input type="checkbox" name="isPublic" />
              Показывать автомобиль в моём профиле
            </label>
            <button
              type="submit"
              className="primary-button full-width"
              disabled={busy || uploading}
            >
              <Plus size={17} />
              Добавить в гараж
            </button>
          </form>
        </Modal>
      )}
      {memberId && (
        <PublicProfile key={memberId} id={memberId} onClose={closeMember} onPost={openPost} />
      )}
      {editingCar && state.cars.find((c) => c.id === editingCar) && (
        <CarPhotoModal
          car={state.cars.find((c) => c.id === editingCar)!}
          mutate={mutate}
          onClose={() => setEditingCar(null)}
          onSuccess={() => {
            setEditingCar(null);
            setNotice('Автомобиль сохранён');
          }}
        />
      )}
      {modal === 'profile' && (
        <AccountModal
          onViewProfile={() => {
            if (state.user) openMember(state.user.id);
          }}
          user={state.user}
          busy={busy}
          mutate={mutate}
          onClose={() => {
            setModal(null);
            setPendingModal(null);
          }}
          onSuccess={(message) => {
            setModal(pendingModal);
            setPendingModal(null);
            setNotice(message);
          }}
        />
      )}
      {modal === 'rules' && (
        <Modal title="На одной дороге" onClose={() => setModal(null)}>
          <div className="rules-content">
            <div className="welcome-mark">
              <ShieldCheck size={34} />
            </div>
            <p>
              QarHub — сообщество автолюбителей Казахстана. Здесь делятся опытом, задают вопросы и
              находят своих.
            </p>
            <h3>Уважай людей</h3>
            <p>Спорим с идеями, помогаем новичкам, обходимся без оскорблений и спама.</p>
            <h3>Добавляй контекст</h3>
            <p>
              Марка, поколение, двигатель и условия появления проблемы помогают получить полезный
              ответ.
            </p>
            <h3>Делись результатом</h3>
            <p>
              Если вопрос решён, отметь помогший ответ. Твой опыт пригодится следующему владельцу.
            </p>
            <h3>Технические советы — с ответственностью</h3>
            <p>
              Опыт участников не заменяет диагностику автомобиля. Работы с тормозами, рулевым
              управлением и другими системами безопасности доверяй специалистам.
            </p>
            <div className="local-note">
              Начальные пять историй и их исходные реакции демонстрационные. Новые публикации
              сохраняются на сервере и доступны всем участникам. Можно добавлять фотографии и
              знакомиться с участниками через профили. Модерация — следующий этап развития.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
