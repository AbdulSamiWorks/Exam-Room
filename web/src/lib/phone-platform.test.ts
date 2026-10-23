import { describe, expect, it } from 'vitest';
import { detectPhonePlatform } from './phone-platform';

describe('detectPhonePlatform', () => {
  it('recognises Android phones, iPhones and iPads that say they are a Mac', () => {
    expect(detectPhonePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe('android');
    expect(detectPhonePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(
      'iphone',
    );
    expect(detectPhonePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(
      'iphone',
    );
    expect(detectPhonePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
    expect(detectPhonePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0)).toBe('other');
  });
});
