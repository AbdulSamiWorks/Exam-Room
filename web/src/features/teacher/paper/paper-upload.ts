import type { AnswerKey, Paper } from '@exam-room/shared';

export type PaperUpload = {
  paper: Paper;
  answerKey: AnswerKey;
  images: Blob[];
};

export function withPictureNumbers(
  paper: Paper,
  pictures: ReadonlyMap<string, Blob>,
): { paper: Paper; images: Blob[] } {
  const images: Blob[] = [];
  const sections = paper.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      const picture = pictures.get(question.id);
      if (!picture) return { ...question, imageNumber: null };
      images.push(picture);
      return { ...question, imageNumber: images.length };
    }),
  }));
  return { paper: { ...paper, sections }, images };
}
