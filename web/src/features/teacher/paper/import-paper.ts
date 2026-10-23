import type { ImportedPaper } from './imported-paper';
import { parsePaperJson } from './paper-json-format';
import { parsePaperText } from './paper-text-format';

export type PaperFormat = 'json' | 'text';

export function detectPaperFormat(text: string): PaperFormat {
  return text.trimStart().startsWith('{') ? 'json' : 'text';
}

export function importPaper(text: string): ImportedPaper {
  return detectPaperFormat(text) === 'json' ? parsePaperJson(text) : parsePaperText(text);
}
