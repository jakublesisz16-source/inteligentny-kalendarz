import { readFileSync } from 'node:fs';

const cache = new Map<string, string>();

export function sourceText(path: string): string {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const value = readFileSync(path, 'utf8');
  cache.set(path, value);
  return value;
}
