import { describe, expect, it } from 'vitest';
import { parsePaperText } from './paper-text-format';
import { withPictureNumbers } from './paper-upload';

describe('withPictureNumbers', () => {
  it('numbers the pictures in question order and clears the others', () => {
    const { paper } = parsePaperText('1. One [1]\n2. Two [1]\n3. Three [1]');
    const third = new Blob(['3']);
    const first = new Blob(['1']);
    const result = withPictureNumbers(
      paper,
      new Map([
        ['q3', third],
        ['q1', first],
      ]),
    );
    expect(result.images).toEqual([first, third]);
    expect(result.paper.sections[0]?.questions.map((question) => question.imageNumber)).toEqual([
      1,
      null,
      2,
    ]);
  });
});
