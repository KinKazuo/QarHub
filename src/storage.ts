import type { Car, Post } from './data';

export interface LocalState {
  posts: Post[];
  saved: string[];
  liked: string[];
  cars: Car[];
  name: string;
  joined: string[];
}
export const storageKey = 'qarhub:v1';
const stringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

export function readState(fallback: LocalState): LocalState {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (
      !value ||
      !Array.isArray(value.posts) ||
      !Array.isArray(value.cars) ||
      !['saved', 'liked', 'joined'].every((k) => stringList(value[k])) ||
      typeof value.name !== 'string'
    )
      return fallback;
    const postsValid = value.posts.every(
      (p: Post) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.title === 'string' &&
        typeof p.body === 'string' &&
        typeof p.brand === 'string' &&
        typeof p.author === 'string' &&
        typeof p.car === 'string' &&
        typeof p.createdAt === 'string' &&
        typeof p.likes === 'number' &&
        Array.isArray(p.replies) &&
        p.replies.every(
          (r) =>
            r &&
            typeof r.id === 'string' &&
            typeof r.author === 'string' &&
            typeof r.text === 'string',
        ),
    );
    const carsValid = value.cars.every(
      (c: Car) =>
        c &&
        ['id', 'brand', 'model', 'year', 'engine'].every(
          (k) => typeof c[k as keyof Car] === 'string',
        ),
    );
    return postsValid && carsValid ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeState(value: LocalState): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
