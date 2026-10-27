import type { ClipboardEvent, DragEvent } from 'react';

function refuse(event: ClipboardEvent | DragEvent) {
  event.preventDefault();
}

export const EXAM_TEXT_INPUT_PROPS = {
  dir: 'auto',
  spellCheck: false,
  autoCorrect: 'off',
  autoCapitalize: 'off',
  autoComplete: 'off',
  onPaste: refuse,
  onDrop: refuse,
} as const;
