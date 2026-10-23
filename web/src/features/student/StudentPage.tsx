import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { forgetStoredAttempt, readStoredAttempt } from './attempt-storage';
import { AttemptScreen } from './AttemptScreen';
import { JoinScreen } from './join/JoinScreen';
import { studentQueryKeys } from './use-attempt';

export function StudentPage() {
  const testCode = (useParams().testCode ?? '').trim().toUpperCase();
  return <StudentSession key={testCode} testCode={testCode} />;
}

function StudentSession({ testCode }: { testCode: string }) {
  const queryClient = useQueryClient();
  const [attemptToken, setAttemptToken] = useState(() => readStoredAttempt(testCode)?.attemptToken);

  function startOver() {
    forgetStoredAttempt(testCode);
    queryClient.removeQueries({ queryKey: studentQueryKeys.attempt(testCode) });
    setAttemptToken(undefined);
  }

  if (!attemptToken) return <JoinScreen testCode={testCode} onStarted={setAttemptToken} />;

  return (
    <AttemptScreen
      key={attemptToken}
      testCode={testCode}
      attemptToken={attemptToken}
      onSessionLost={startOver}
    />
  );
}
