import { describe, expect, it } from 'vitest';
import paperFormatGuide from '../../../../../docs/PAPER-FORMAT.md?raw';
import { importPaper } from './import-paper';
import { SAMPLE_PAPERS } from './sample-paper';

function codeBlock(language: string, occurrence = 1): string {
  const fence = `\`\`\`${language}\n`;
  let start = -1;
  for (let found = 0; found < occurrence; found += 1) {
    start = paperFormatGuide.indexOf(fence, start + 1);
  }
  const contentStart = start + fence.length;
  return paperFormatGuide.slice(contentStart, paperFormatGuide.indexOf('```', contentStart));
}

describe('the paper format guide', () => {
  it('has a text sample that the app reads without problems', () => {
    const { problems, paper } = importPaper(codeBlock('text'));
    expect(problems).toEqual([]);
    expect(paper.sections.flatMap((section) => section.questions)).toHaveLength(5);
  });

  it('has a JSON sample that the app reads without problems', () => {
    expect(importPaper(codeBlock('json')).problems).toEqual([]);
  });

  it('has a parts and blanks sample that the app reads without problems', () => {
    const { problems, paper } = importPaper(codeBlock('text', 2));
    expect(problems).toEqual([]);
    expect(paper.sections.flatMap((section) => section.questions)).toHaveLength(4);
  });

  it.each(SAMPLE_PAPERS)('offers the sample $name without problems', ({ text }) => {
    expect(importPaper(text).problems).toEqual([]);
    expect(importPaper(text).warnings).toEqual([]);
  });
});
