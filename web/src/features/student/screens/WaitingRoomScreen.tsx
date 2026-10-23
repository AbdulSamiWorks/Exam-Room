import type { StudentAttempt } from '@exam-room/shared';
import { StatusScreen } from './StatusScreen';

export function WaitingRoomScreen({ attempt }: { attempt: StudentAttempt }) {
  const { test } = attempt;
  return (
    <StatusScreen tone="neutral" title="Waiting for your teacher">
      <p>
        {test.title} · {test.subjectName}
      </p>
      <p>
        You are in, {attempt.studentName}. The paper opens on every phone at the same time when your
        teacher starts the test.
      </p>
      <p>Keep this page open. Your time starts only then.</p>
    </StatusScreen>
  );
}
