import type { Paper, PaperQuestion } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import {
  originalOptionOf,
  seededRandom,
  shownOptionOf,
  shuffled,
  studentPaperView,
} from './student-paper-view';

function mcq(id: string, options: string[]): PaperQuestion {
  return { id, kind: 'mcq', text: id, marks: 1, options, imageNumber: null };
}

const paper: Paper = {
  instructions: '',
  sections: [
    {
      title: 'A',
      instructions: '',
      questions: [
        mcq('q1', ['w', 'x', 'y', 'z']),
        mcq('q2', ['a', 'b', 'c', 'd']),
        mcq('q3', ['one', 'two', 'All of the above']),
        mcq('q4', ['p', 'q', 'r', 's']),
      ],
    },
    {
      title: 'B',
      instructions: '',
      questions: [
        { id: 'q5', kind: 'written', text: 'Explain.', marks: 3, options: [], imageNumber: null },
      ],
    },
  ],
};

describe('studentPaperView', () => {
  it('keeps the paper as it is without a mixing number', () => {
    expect(studentPaperView(paper, null).paper).toBe(paper);
  });

  it('mixes questions inside each section and the options of each question, the same way every time', () => {
    const view = studentPaperView(paper, 42);
    expect(studentPaperView(paper, 42)).toEqual(view);
    expect(view.paper.sections.map((section) => section.title)).toEqual(['A', 'B']);
    const sectionA = view.paper.sections[0]?.questions ?? [];
    expect(sectionA.map((question) => question.id).sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(view.paper.sections[1]?.questions[0]?.id).toBe('q5');
    const otherViews = [1, 2, 3, 4, 5].map((seed) => studentPaperView(paper, seed));
    expect(
      otherViews.some((other) => JSON.stringify(other.paper) !== JSON.stringify(view.paper)),
    ).toBe(true);
  });

  it('keeps options like All of the above in place', () => {
    const view = studentPaperView(paper, 7);
    const q3 = view.paper.sections[0]?.questions.find((question) => question.id === 'q3');
    expect(q3?.options).toEqual(['one', 'two', 'All of the above']);
    expect(view.optionOrders.has('q3')).toBe(false);
  });

  it('turns a tapped option back into the original option and the other way round', () => {
    const view = studentPaperView(paper, 99);
    const shownQ1 = view.paper.sections[0]?.questions.find((question) => question.id === 'q1');
    shownQ1?.options.forEach((option, shownIndex) => {
      const original = originalOptionOf(view, 'q1', shownIndex);
      expect(['w', 'x', 'y', 'z'][original]).toBe(option);
      expect(shownOptionOf(view, 'q1', original)).toBe(shownIndex);
    });
  });
});

describe('shuffled', () => {
  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 20 }, (_item, index) => index);
    expect(shuffled(items, seededRandom(5)).sort((first, second) => first - second)).toEqual(items);
  });
});
