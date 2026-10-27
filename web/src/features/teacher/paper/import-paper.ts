import type { AnswerKey, Paper } from '@exam-room/shared';
import type { ImportedPaper } from './imported-paper';
import { paperToJson, parsePaperJson } from './paper-json-format';
import { canWriteAsText, paperToText, parsePaperText } from './paper-text-format';

export type PaperFormat = 'json' | 'text';

export function detectPaperFormat(text: string): PaperFormat {
  return text.trimStart().startsWith('{') ? 'json' : 'text';
}

export function importPaper(text: string): ImportedPaper {
  return detectPaperFormat(text) === 'json' ? parsePaperJson(text) : parsePaperText(text);
}

export function editableTextOf(paper: Paper, answerKey: AnswerKey): string {
  return canWriteAsText(paper) ? paperToText(paper, answerKey) : paperToJson(paper, answerKey);
}
