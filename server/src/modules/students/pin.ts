import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { studentLimits } from './student-limits.js';

const HASH_FORMAT = 'scrypt';
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const CURRENT_COST: Required<Pick<ScryptOptions, 'N' | 'r' | 'p'>> = { N: 8192, r: 8, p: 1 };
const PIN_RANGE = 10 ** studentLimits.pinLength;
const PIN_PATTERN = new RegExp(`^\\d{${studentLimits.pinLength}}$`);

export function createPin(): string {
  return String(randomInt(PIN_RANGE)).padStart(studentLimits.pinLength, '0');
}

export function isWellFormedPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(pin, salt, CURRENT_COST);
  const { N, r, p } = CURRENT_COST;
  return [HASH_FORMAT, N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const [format, costText, blockSizeText, parallelText, saltText, keyText, ...extraParts] =
    storedHash.split('$');
  if (format !== HASH_FORMAT || !saltText || !keyText || extraParts.length > 0) return false;

  const cost = { N: Number(costText), r: Number(blockSizeText), p: Number(parallelText) };
  if (!Object.values(cost).every((value) => Number.isInteger(value) && value > 0)) return false;

  const expectedKey = Buffer.from(keyText, 'base64url');
  const actualKey = await deriveKey(pin, Buffer.from(saltText, 'base64url'), cost);
  return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey);
}

function deriveKey(pin: string, salt: Buffer, cost: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_BYTES, cost, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
