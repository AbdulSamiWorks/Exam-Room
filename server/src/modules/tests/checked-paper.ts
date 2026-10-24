import type { AnswerKey, Paper } from '@exam-room/shared';
import { answerKeyProblems, highestImageNumber, paperLimits } from '@exam-room/shared/paper-rules';
import { badRequest, payloadTooLarge } from '../../lib/http-errors.js';
import type { StoredPaper } from './paper-repository.js';

export function checkedPaper(paper: Paper, answerKey: AnswerKey, imageCount: number): StoredPaper {
  const [firstProblem] = answerKeyProblems(paper, answerKey);
  if (firstProblem) throw badRequest(firstProblem, 'invalid_answer_key');
  if (highestImageNumber(paper) > imageCount) {
    throw badRequest('A question shows a picture that was not uploaded.', 'paper_image_missing');
  }
  return { paper, answerKey };
}

export function checkPaperImageSizes(images: readonly Buffer[]): void {
  if (images.some((image) => image.length > paperLimits.maxPaperImageBytes)) {
    throw payloadTooLarge('One of the pictures is too large.', 'paper_image_too_large');
  }
}
