import type { FinishReason, StudentAttempt } from '@exam-room/shared';
import { useEffect } from 'react';
import type { OutboxSnapshot } from '../answers/outbox-store';
import { hasUnsentWork } from '../answers/outbox-state';
import { PhotoAnswersPanel } from '../photos/PhotoAnswersPanel';
import { leaveFullscreen } from '../fullscreen';
import { StatusScreen } from './StatusScreen';

type FinishedMessage = {
  title: string;
  message: string;
  tone: 'success' | 'danger';
};

const FINISHED_MESSAGES: Record<FinishReason, FinishedMessage> = {
  student: {
    title: 'Test submitted',
    message: 'Your test has been submitted. You can close this page now.',
    tone: 'success',
  },
  time_up: {
    title: 'Time is up',
    message: 'Your test has been submitted. You can close this page now.',
    tone: 'success',
  },
  teacher: {
    title: 'Your teacher ended the test',
    message: 'Your test has been submitted. You can close this page now.',
    tone: 'success',
  },
  left_test: {
    title: 'Test finished',
    message: 'You left the test too many times, so it was finished and submitted.',
    tone: 'danger',
  },
};

type FinishedScreenProps = {
  testCode: string;
  attemptToken: string;
  attempt: StudentAttempt;
  outbox: OutboxSnapshot | undefined;
};

const PHOTO_ANSWERS = new Set(['photos', 'typed_and_photos']);

export function FinishedScreen({ testCode, attemptToken, attempt, outbox }: FinishedScreenProps) {
  const finished = FINISHED_MESSAGES[attempt.finishReason ?? 'student'];
  const isStillSending = outbox !== undefined && hasUnsentWork(outbox.outbox);
  const tooLateCount = outbox?.outbox.tooLateCount ?? 0;

  useEffect(leaveFullscreen, []);

  return (
    <StatusScreen tone={finished.tone} title={finished.title}>
      {isStillSending ? (
        <p>
          Some of your answers are still being sent. Keep this page open until this message goes
          away, or open the app again soon. Answers saved before the end count for 10 minutes.
        </p>
      ) : (
        <p>{finished.message}</p>
      )}
      {tooLateCount > 0 && (
        <p>
          {tooLateCount === 1 ? '1 answer' : `${tooLateCount} answers`} arrived too late and did not
          count.
        </p>
      )}
      <p>
        {attempt.studentName} · Roll no. {attempt.rollNumber}
      </p>
      {PHOTO_ANSWERS.has(attempt.test.writtenAnswers) && (
        <PhotoAnswersPanel testCode={testCode} attemptToken={attemptToken} />
      )}
    </StatusScreen>
  );
}
