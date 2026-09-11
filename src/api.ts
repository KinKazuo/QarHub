import type { Car, Post } from './data';

export interface User {
  id: string;
  email: string;
  name: string;
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
