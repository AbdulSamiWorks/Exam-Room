import type { StudentAttempt } from '@exam-room/shared';
import { useEffect } from 'react';
import { leaveFullscreen } from '../fullscreen';
import { StatusScreen } from './StatusScreen';

export function FinishedScreen({ attempt }: { attempt: StudentAttempt }) {
  const isTimeUp = attempt.finishReason === 'time_up';

  useEffect(leaveFullscreen, []);

  return (
    <StatusScreen tone="success" title={isTimeUp ? 'Time is up' : 'Test submitted'}>
      <p>Your test has been submitted. You can close this page now.</p>
      <p>
        {attempt.studentName} · Roll no. {attempt.rollNumber}
      </p>
    </StatusScreen>
  );
}
