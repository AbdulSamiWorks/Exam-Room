export type InlinePiece = {
  kind: 'text' | 'superscript' | 'subscript';
  text: string;
};

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

const SCRIPT_MARKUP = /\^\{([^{}]*)\}|_\{([^{}]*)\}/g;
const TABLE_ROW = /^\|.*\|$/;
const SEPARATOR_CELL = /^:?-{2,}:?$/;

export function parseInlineText(text: string): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  let position = 0;
  for (const match of text.matchAll(SCRIPT_MARKUP)) {
    const start = match.index ?? 0;
    if (start > position) pieces.push({ kind: 'text', text: text.slice(position, start) });
    const superscript = match[1];
    pieces.push(
      superscript === undefined
        ? { kind: 'subscript', text: match[2] ?? '' }
        : { kind: 'superscript', text: superscript },
    );
    position = start + match[0].length;
  }
  if (position < text.length) pieces.push({ kind: 'text', text: text.slice(position) });
  return pieces;
}

export function parseRichText(text: string): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];
  for (const line of text.split('\n')) {
    const lastBlock = blocks.at(-1);
    if (TABLE_ROW.test(line.trim())) {
      addTableRow(lastBlock?.kind === 'table' ? lastBlock : startTable(blocks), line.trim());
    } else if (lastBlock?.kind === 'text') {
      lastBlock.lines.push(parseInlineText(line));
    } else {
      blocks.push({ kind: 'text', lines: [parseInlineText(line)] });
    }
  }
  return blocks;
}

function startTable(blocks: RichTextBlock[]): TableBlock {
  const table: TableBlock = { kind: 'table', headerRow: undefined, bodyRows: [] };
  blocks.push(table);
  return table;
}

function addTableRow(table: TableBlock, line: string): void {
  const cells = line
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
  const isSeparator = cells.every((cell) => SEPARATOR_CELL.test(cell));
  if (isSeparator) {
    if (!table.headerRow && table.bodyRows.length === 1) table.headerRow = table.bodyRows.pop();
    return;
  }
  table.bodyRows.push(cells.map(parseInlineText));
}
