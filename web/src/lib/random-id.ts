const RANDOM_ID_BYTES = 16;

export function createRandomId(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(RANDOM_ID_BYTES));
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
