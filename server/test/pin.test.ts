import { describe, expect, it } from 'vitest';
import { createPin, hashPin, isWellFormedPin, verifyPin } from '../src/modules/students/pin.js';

describe('PINs', () => {
  it('creates 6-digit PINs, keeping leading zeros', () => {
    const pins = Array.from({ length: 200 }, createPin);
    expect(pins.every((pin) => /^\d{6}$/.test(pin))).toBe(true);
    expect(new Set(pins).size).toBeGreaterThan(190);
  });

  it('checks the PIN form', () => {
    expect(isWellFormedPin('012345')).toBe(true);
    expect(isWellFormedPin('12345')).toBe(false);
    expect(isWellFormedPin('12345a')).toBe(false);
  });

  it('verifies the right PIN against its hash and refuses a wrong one', async () => {
    const pinHash = await hashPin('482913');
    expect(pinHash.startsWith('scrypt$8192$8$1$')).toBe(true);
    expect(await verifyPin('482913', pinHash)).toBe(true);
    expect(await verifyPin('482914', pinHash)).toBe(false);
  });

  it('gives the same PIN a different hash each time', async () => {
    expect(await hashPin('111111')).not.toBe(await hashPin('111111'));
  });

  it('refuses damaged hashes', async () => {
    expect(await verifyPin('482913', 'plain-text')).toBe(false);
    expect(await verifyPin('482913', 'scrypt$x$8$1$salt$key')).toBe(false);
  });
});
