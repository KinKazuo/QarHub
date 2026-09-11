import { useState, type FormEvent } from 'react';
import { ArrowRight, LogOut, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import type { ApiResult, User } from './api';

type Props = {
  user: User | null;
  busy: boolean;
  mutate: (path: string, method?: string, body?: unknown) => Promise<ApiResult>;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export default function AccountModal({ user, busy, mutate, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      if (user) {
        await mutate('/profile', 'PATCH', { name: form.get('name') });
        onSuccess('Профиль сохранён');
      } else {
        const password = String(form.get('password') || '');
        if (mode === 'register' && password !== form.get('confirm')) {
          setError('Пароли не совпадают.');
          return;
        }
        await mutate(`/auth/${mode}`, 'POST', {
          email: form.get('email'),
          name: form.get('name'),
          password,
        });
        onSuccess(mode === 'register' ? 'Аккаунт создан. Добро пожаловать!' : 'Ты вошёл в аккаунт');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить профиль.');
    }
  }
  async function logout() {
    setError('');
    try {
      await mutate('/auth/logout');
      onSuccess('Ты вышел из аккаунта');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось выйти.');
    }
  }
  return (
    <Modal title={user ? 'Твой аккаунт' : 'Добро пожаловать в QarHub'} onClose={onClose}>
      <form className="editor-form" onSubmit={submit}>
        <div className="welcome-mark">
          <ShieldCheck size={34} strokeWidth={1.5} />
        </div>
        {!user && (
          <div className="auth-tabs" role="group" aria-label="Доступ к аккаунту">
            <button
              type="button"
              disabled={busy}
              className={mode === 'register' ? 'selected' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Регистрация
            </button>
            <button
              type="button"
              disabled={busy}
              className={mode === 'login' ? 'selected' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Вход
            </button>
          </div>
        )}
        <p className="form-intro">
          {user
            ? 'Твои машины, публикации и избранное связаны с этим аккаунтом.'
            : mode === 'register'
              ? 'Найди своих. Создай аккаунт, чтобы задавать вопросы и делиться опытом.'
              : 'С возвращением. Твоё сообщество ждёт тебя.'}
        </p>
        {(user || mode === 'register') && (
          <label>
            Имя или никнейм
            <input
              name="name"
              defaultValue={user?.name || ''}
              placeholder="Например, Alik_Drive"
              autoComplete="nickname"
              minLength={2}
              maxLength={32}
              required
            />
          </label>
        )}
        {user ? (
          <div className="account-email">
            <span>Email аккаунта</span>
            <strong>{user.email}</strong>
          </div>
        ) : (
          <>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder="Не менее 12 символов"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            {mode === 'register' && (
              <label>
                Повтори пароль
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button full-width" type="submit" disabled={busy}>
          {busy
            ? 'Подожди…'
            : user
              ? 'Сохранить профиль'
              : mode === 'register'
                ? 'Создать аккаунт'
                : 'Войти'}
          <ArrowRight size={17} />
        </button>
        {user && (
          <button
            className="secondary-button full-width"
            type="button"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={16} />
            Выйти из аккаунта
          </button>
        )}
        {!user && (
          <p className="account-help">
            {mode === 'register'
              ? 'Email не виден другим участникам. Восстановление пароля по почте пока не подключено — сохрани пароль в своём менеджере паролей.'
              : 'Восстановление доступа по почте пока не подключено.'}
          </p>
        )}
      </form>
    </Modal>
  );
}
