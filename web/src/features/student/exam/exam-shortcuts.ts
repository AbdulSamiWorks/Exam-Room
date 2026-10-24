const BLOCKED_SHORTCUT_KEYS: ReadonlySet<string> = new Set(['a', 'c', 'p', 's', 'u', 'v', 'x']);
const BLOCKED_KEYS: ReadonlySet<string> = new Set(['F12', 'PrintScreen']);

export type ShortcutKeys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>;

export function isBlockedShortcut({ key, ctrlKey, metaKey }: ShortcutKeys): boolean {
  if (BLOCKED_KEYS.has(key)) return true;
  return (ctrlKey || metaKey) && BLOCKED_SHORTCUT_KEYS.has(key.toLowerCase());
}
