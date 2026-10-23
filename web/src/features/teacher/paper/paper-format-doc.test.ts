import { describe, expect, it } from 'vitest';
import paperFormatGuide from '../../../../../docs/PAPER-FORMAT.md?raw';
import { importPaper } from './import-paper';
import { SAMPLE_PAPER_TEXT } from './sample-paper';

function codeBlock(language: string): string {
  const start = paperFormatGuide.indexOf(`\`\`\`${language}\n`) + language.length + 4;
  return paperFormatGuide.slice(start, paperFormatGuide.indexOf('```', start));
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

  it('matches the sample that the app offers', () => {
    expect(importPaper(SAMPLE_PAPER_TEXT).problems).toEqual([]);
  });
});
