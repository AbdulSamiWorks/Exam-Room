import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function constantTimeEquals(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}
