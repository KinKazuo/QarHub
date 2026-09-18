import type { Car, Post } from './data';

export interface User {
  id: string;
  email: string;
  name: string;
  city: string;
  bio: string;
  avatarId: string | null;
  avatar: string | null;
}
export interface CommunityState {
  posts: Post[];
  saved: string[];
  liked: string[];
  cars: Car[];
  name: string;
  joined: string[];
  user: User | null;
}
export interface ApiResult {
  state: CommunityState;
  createdId?: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requestApi(path: string, method = 'GET', body?: unknown): Promise<ApiResult> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers:
        method === 'GET'
          ? undefined
          : { 'Content-Type': 'application/json', 'X-QarHub-Client': 'web' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверь подключение и попробуй ещё раз.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(response.status, result?.error || 'Не удалось выполнить запрос.');
  if (!result?.state) throw new ApiError(502, 'Сервер вернул неожиданный ответ.');
  return result;
}

export interface Photo {
  id: string;
  url: string;
}
export interface MemberProfile {
  id: string;
  name: string;
  city: string;
  bio: string;
  avatar: string | null;
  joinedAt: string;
  cars: Car[];
  posts: Post[];
}
async function extraRequest(path: string, options: RequestInit) {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверь подключение и попробуй ещё раз.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(response.status, body?.error || 'Не удалось выполнить запрос.');
  if (!body) throw new ApiError(502, 'Сервер вернул неожиданный ответ.');
  return body;
}
export async function uploadImage(file: File, signal: AbortSignal): Promise<Photo> {
  const result = await extraRequest('/images', {
    method: 'POST',
    body: file,
    signal,
    headers: { 'Content-Type': file.type, 'X-QarHub-Client': 'web' },
  });
  if (!result.id || !result.url) throw new ApiError(502, 'Не удалось получить загруженное фото.');
  return result;
}
export async function fetchProfile(id: string, signal: AbortSignal): Promise<MemberProfile> {
  const result = await extraRequest('/profiles/' + encodeURIComponent(id), { signal });
  if (!result.profile) throw new ApiError(502, 'Не удалось получить профиль.');
  return result.profile;
}
