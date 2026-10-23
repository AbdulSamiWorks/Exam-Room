import type { FinishReason, StudentAttempt } from '@exam-room/shared';
import { useEffect } from 'react';
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

export function FinishedScreen({ attempt }: { attempt: StudentAttempt }) {
  const finished = FINISHED_MESSAGES[attempt.finishReason ?? 'student'];

  useEffect(leaveFullscreen, []);

  return (
    <StatusScreen tone={finished.tone} title={finished.title}>
      <p>{finished.message}</p>
      <p>
        {attempt.studentName} · Roll no. {attempt.rollNumber}
      </p>
    </StatusScreen>
  );
}
