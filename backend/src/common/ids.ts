import { randomBytes, randomInt } from 'crypto';

/** 6-digit human-facing user id (100000–999999). */
export function generatePublicId(): string {
  return String(randomInt(100000, 1000000));
}

/** 6-digit one-time code, left-padded so leading zeros are kept. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

/** URL-safe slug. Falls back to a random hex string for non-latin titles. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || randomBytes(4).toString('hex');
}

/** Slug plus a short random suffix, used when the plain slug is taken. */
export function slugWithSuffix(input: string): string {
  return `${slugify(input)}-${randomBytes(3).toString('hex')}`;
}
