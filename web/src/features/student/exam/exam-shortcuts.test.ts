import { describe, expect, it } from 'vitest';
import { isBlockedShortcut } from './exam-shortcuts';

const plain = { key: 'c', ctrlKey: false, metaKey: false };

describe('isBlockedShortcut', () => {
  it('blocks copy, paste, print, save, select all and view source on laptops', () => {
    expect(isBlockedShortcut({ ...plain, ctrlKey: true })).toBe(true);
    expect(isBlockedShortcut({ ...plain, key: 'V', metaKey: true })).toBe(true);
    expect(isBlockedShortcut({ ...plain, key: 'p', ctrlKey: true })).toBe(true);
    expect(isBlockedShortcut({ ...plain, key: 'F12' })).toBe(true);
  });

  it('lets students type normally', () => {
    expect(isBlockedShortcut(plain)).toBe(false);
    expect(isBlockedShortcut({ ...plain, key: 'z', ctrlKey: true })).toBe(false);
    expect(isBlockedShortcut({ ...plain, key: 'Backspace' })).toBe(false);
  });
});
