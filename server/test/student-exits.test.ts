import type { AllowedExits, RecordExitRequest, RecordReturnRequest } from '@exam-room/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publishTest, startAttemptToken, studentRequests } from './support/exam-fixtures.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

const LEAVE: RecordExitRequest = { clientExitId: 'first-exit-0001', reason: 'hidden' };
const SECOND_LEAVE: RecordExitRequest = { clientExitId: 'second-exit-0002', reason: 'blur' };

describe('student exits', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function startStudent(allowedExits: AllowedExits = 1) {
    const test = await publishTest(context.app, { allowedExits });
    return studentRequests(context.app, await startAttemptToken(context.app, test.code));
  }

  async function readExitRows() {
    const { rows } = await context.database.execute(
      'SELECT client_exit_id, reason, left_at, returned_at, away_ms FROM exits ORDER BY id',
    );
    return rows.map((row) => ({ ...row }));
  }

  function leave(student: Awaited<ReturnType<typeof startStudent>>, exit = LEAVE) {
    return student.post('/api/attempt/exits').send(exit);
  }

  function comeBack(
    student: Awaited<ReturnType<typeof startStudent>>,
    returnReport: RecordReturnRequest,
  ) {
    return student.post('/api/attempt/return').send(returnReport);
  }

  it('counts an exit and keeps the attempt open while within the allowed exits', async () => {
    const student = await startStudent(1);
    context.clock.advanceBy(60_000);

    const response = await leave(student);
    expect(response.status).toBe(200);
    expect(response.body.attempt).toMatchObject({ status: 'in_progress', exitsUsed: 1 });
    expect(await readExitRows()).toEqual([
      {
        client_exit_id: LEAVE.clientExitId,
        reason: 'hidden',
        left_at: TEST_START_TIME + 60_000,
        returned_at: null,
        away_ms: null,
      },
    ]);
  });

  it('closes the exit on return and measures the time away with the server clock', async () => {
    const student = await startStudent(1);
    await leave(student);
    context.clock.advanceBy(7_000);

    const response = await comeBack(student, { ...LEAVE, awayMsClient: 999_999 });
    expect(response.body.attempt).toMatchObject({ status: 'in_progress', exitsUsed: 1 });
    expect(await readExitRows()).toEqual([
      expect.objectContaining({ returned_at: TEST_START_TIME + 7_000, away_ms: 7_000 }),
    ]);
  });

  it('records the exit from the return when the leave request was lost', async () => {
    const student = await startStudent(1);
    context.clock.advanceBy(60_000);

    const response = await comeBack(student, { ...LEAVE, awayMsClient: 5_000 });
    expect(response.body.attempt.exitsUsed).toBe(1);
    expect(await readExitRows()).toEqual([
      expect.objectContaining({
        left_at: TEST_START_TIME + 55_000,
        returned_at: TEST_START_TIME + 60_000,
        away_ms: 5_000,
      }),
    ]);
  });

  it('never counts the same exit twice', async () => {
    const student = await startStudent(2);
    await leave(student);
    await leave(student);
    const response = await comeBack(student, { ...LEAVE, awayMsClient: 1_000 });
    await comeBack(student, { ...LEAVE, awayMsClient: 1_000 });

    expect(response.body.attempt.exitsUsed).toBe(1);
    expect(await readExitRows()).toHaveLength(1);
  });

  it('locks the attempt when the student leaves one time too many', async () => {
    const student = await startStudent(1);
    await leave(student);
    await comeBack(student, { ...LEAVE, awayMsClient: 1_000 });

    const response = await leave(student, SECOND_LEAVE);
    expect(response.body.attempt).toMatchObject({ status: 'locked', exitsUsed: 2 });

    const page = await student.get('/api/attempt/pages/1');
    expect(page.status).toBe(410);
  });

  it('locks on the first exit when no exits are allowed', async () => {
    const student = await startStudent(0);
    const response = await leave(student);
    expect(response.body.attempt.status).toBe('locked');
  });

  it('ignores exits after the attempt is locked or finished', async () => {
    const student = await startStudent(0);
    await leave(student);
    await leave(student, SECOND_LEAVE);
    expect(await readExitRows()).toHaveLength(1);

    const finishedStudent = await startStudent(2);
    await finishedStudent.post('/api/attempt/finish');
    const response = await leave(finishedStudent);
    expect(response.body.attempt).toMatchObject({ status: 'submitted', exitsUsed: 0 });
  });

  it.each([
    [{ clientExitId: 'short', reason: 'hidden' }],
    [{ clientExitId: 'valid-exit-id-1', reason: 'device_change' }],
    [{ clientExitId: 'valid-exit-id-1' }],
  ])('rejects the exit report %j', async (exitReport) => {
    const student = await startStudent();
    const response = await student.post('/api/attempt/exits').send(exitReport);
    expect(response.status).toBe(400);
  });

  it('rejects a return without the time away', async () => {
    const student = await startStudent();
    const response = await student.post('/api/attempt/return').send(LEAVE);
    expect(response.status).toBe(400);
  });
});
