import type { AnswerKey, Paper, TestSummary } from '@exam-room/shared';
import type { Express } from 'express';
import { createClassWithSubject } from './catalog-fixtures.js';
import { rememberTestClass } from './exam-fixtures.js';
import { logInAsTeacher } from './teacher-agent.js';

export const SAMPLE_PAPER: Paper = {
  instructions: 'Attempt all questions.',
  sections: [
    {
      title: 'Section A',
      instructions: 'Choose one answer.',
      questions: [
        {
          id: 'q1',
          kind: 'mcq',
          text: 'What is the unit of force?',
          marks: 1,
          options: ['Joule', 'Newton', 'Watt', 'Pascal'],
          imageNumber: 1,
        },
        {
          id: 'q2',
          kind: 'mcq',
          text: 'Which is a vector?',
          marks: 1,
          options: ['Mass', 'Speed', 'Velocity'],
          imageNumber: null,
        },
      ],
    },
    {
      title: 'Section B',
      instructions: '',
      questions: [
        {
          id: 'q3',
          kind: 'written',
          text: 'State the first law of motion.',
          marks: 3,
          options: [],
          imageNumber: null,
        },
      ],
    },
  ],
};

export const SAMPLE_ANSWER_KEY: AnswerKey = {
  q1: { option: 1 },
  q2: { option: 2 },
  q3: { text: 'An object stays at rest or keeps moving unless a force acts on it.' },
};

type TypedTestOptions = {
  paper?: Paper;
  answerKey?: AnswerKey;
  images?: Buffer[];
  isOpen?: boolean;
};

export async function publishTypedTest(
  app: Express,
  {
    paper = SAMPLE_PAPER,
    answerKey = SAMPLE_ANSWER_KEY,
    images = [],
    isOpen = true,
  }: TypedTestOptions,
) {
  const teacher = await logInAsTeacher(app);
  const subject = await createClassWithSubject(teacher);
  const upload = teacher
    .post('/api/tests')
    .field('subjectId', String(subject.id))
    .field('title', 'Typed quiz')
    .field('durationMinutes', '30')
    .field('allowedExits', '1')
    .field('paperKind', 'typed')
    .field('writtenAnswers', 'typed')
    .field('paper', JSON.stringify(paper))
    .field('answerKey', JSON.stringify(answerKey));
  images.forEach((image, imageIndex) => {
    upload.attach('paperImages', image, {
      filename: `picture-${imageIndex + 1}.png`,
      contentType: 'image/png',
    });
  });

  const response = await upload;
  if (response.status !== 201) {
    return { response, test: undefined as unknown as TestSummary, teacher };
  }
  const createdTest: TestSummary = response.body.test;
  rememberTestClass(app, createdTest);
  if (!isOpen) return { response, test: createdTest, teacher };
  const opened = await teacher.post(`/api/tests/${createdTest.id}/open`);
  return { response, test: opened.body.test as TestSummary, teacher };
}
