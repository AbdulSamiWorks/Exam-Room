import { describe, expect, it } from 'vitest';
import { parseInlineText, parseRichText } from './rich-text';

describe('parseInlineText', () => {
  it('reads superscripts and subscripts', () => {
    expect(parseInlineText('x^{2} + H_{2}O')).toEqual([
      { kind: 'text', text: 'x' },
      { kind: 'superscript', text: '2' },
      { kind: 'text', text: ' + H' },
      { kind: 'subscript', text: '2' },
      { kind: 'text', text: 'O' },
    ]);
    expect(parseInlineText("A' + B")).toEqual([{ kind: 'text', text: "A' + B" }]);
  });
});

describe('parseRichText', () => {
  it('turns lines between bars into a table with an optional header', () => {
    const blocks = parseRichText(
      'Complete the table.\n| A | B | F |\n|---|---|---|\n| 0 | 1 |  |\nThen explain.',
    );
    expect(blocks.map((block) => block.kind)).toEqual(['text', 'table', 'text']);
    const table = blocks[1];
    if (table?.kind !== 'table') throw new Error('No table');
    expect(table.headerRow?.map((cell) => cell[0]?.text)).toEqual(['A', 'B', 'F']);
    expect(table.bodyRows.map((row) => row.map((cell) => cell[0]?.text ?? ''))).toEqual([
      ['0', '1', ''],
    ]);
  });

  it('keeps a table without a separator as plain rows', () => {
    const [table] = parseRichText('| 1 | 0 |\n| 0 | 1 |');
    expect(table?.kind === 'table' && table.headerRow).toBeUndefined();
    expect(table?.kind === 'table' && table.bodyRows).toHaveLength(2);
  });

  it('keeps line breaks of normal text', () => {
    const [block] = parseRichText('a) First part\nb) Second part');
    expect(block?.kind === 'text' && block.lines).toHaveLength(2);
  });
});
