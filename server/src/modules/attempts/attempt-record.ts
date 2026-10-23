import type { AttemptStatus, ExitReason, FinishReason } from '@exam-room/shared';

export type AttemptRecord = {
  id: number;
  testId: number;
  studentId: number | null;
  studentName: string;
  rollNumber: string;
  tokenHash: string | null;
  status: AttemptStatus;
  finishReason: FinishReason | null;
  startedAt: number;
  deadlineAt: number;
  finishedAt: number | null;
  exitCount: number;
  forgivenExits: number;
  version: number;
};

export type ExitEvent = {
  clientExitId: string;
  reason: ExitReason;
  leftAt: number;
  returnedAt: number | null;
  awayMs: number | null;
};

export type AttemptChange = {
  attempt: AttemptRecord;
  newExit?: ExitEvent;
};
