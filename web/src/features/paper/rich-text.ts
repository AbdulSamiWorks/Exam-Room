export type InlinePiece =
  | { kind: 'text' | 'superscript' | 'subscript'; text: string }
  | { kind: 'blank'; blankIndex: number };

export type TableBlock = {
  kind: 'table';
  headerRow: InlinePiece[][] | undefined;
  bodyRows: InlinePiece[][][];
};

export type TextBlock = {
  kind: 'text';
  lines: InlinePiece[][];
};

export type RichTextBlock = TextBlock | TableBlock;

const INLINE_MARKUP = /\^\{([^{}]*)\}|_\{([^{}]*)\}|(_{3,})/g;
const TABLE_ROW = /^\|.*\|$/;
const SEPARATOR_CELL = /^:?-{2,}:?$/;

type BlankCounter = { nextIndex: number };

export function parseInlineText(
  text: string,
  blankCounter: BlankCounter = { nextIndex: 0 },
): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  let position = 0;
  for (const match of text.matchAll(INLINE_MARKUP)) {
    const start = match.index ?? 0;
    if (start > position) pieces.push({ kind: 'text', text: text.slice(position, start) });
    pieces.push(markupPiece(match, blankCounter));
    position = start + match[0].length;
  }
  if (position < text.length) pieces.push({ kind: 'text', text: text.slice(position) });
  return pieces;
}

function markupPiece(match: RegExpMatchArray, blankCounter: BlankCounter): InlinePiece {
  const [, superscript, subscript, blank] = match;
  if (blank !== undefined) {
    const blankIndex = blankCounter.nextIndex;
    blankCounter.nextIndex += 1;
    return { kind: 'blank', blankIndex };
  }
  if (superscript !== undefined) return { kind: 'superscript', text: superscript };
  return { kind: 'subscript', text: subscript ?? '' };
}

export function parseRichText(text: string): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];
  const blankCounter: BlankCounter = { nextIndex: 0 };
  for (const line of text.split('\n')) {
    const lastBlock = blocks.at(-1);
    if (TABLE_ROW.test(line.trim())) {
      const table = lastBlock?.kind === 'table' ? lastBlock : startTable(blocks);
      addTableRow(table, line.trim(), blankCounter);
    } else if (lastBlock?.kind === 'text') {
      lastBlock.lines.push(parseInlineText(line, blankCounter));
    } else {
      blocks.push({ kind: 'text', lines: [parseInlineText(line, blankCounter)] });
    }
  }
  return blocks;
}

function startTable(blocks: RichTextBlock[]): TableBlock {
  const table: TableBlock = { kind: 'table', headerRow: undefined, bodyRows: [] };
  blocks.push(table);
  return table;
}

function addTableRow(table: TableBlock, line: string, blankCounter: BlankCounter): void {
  const cells = line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
  const isSeparator = cells.every((cell) => SEPARATOR_CELL.test(cell));
  if (isSeparator) {
    if (!table.headerRow && table.bodyRows.length === 1) table.headerRow = table.bodyRows.pop();
    return;
  }
  table.bodyRows.push(cells.map((cell) => parseInlineText(cell, blankCounter)));
}
