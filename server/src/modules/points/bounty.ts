import type { Database } from '../../database/connection.js';
import { listAttemptsOfTest } from '../attempts/attempts-repository.js';
import { topScorers } from '../marking/score-attempt.js';
import type { TestRecord } from '../tests/test-record.js';
import { replaceBountyPoints } from './points-repository.js';

export async function awardBounty(
  database: Database,
  test: TestRecord,
  isReleased: boolean,
  awardedAt: number,
): Promise<void> {
  if (!isReleased || test.bountyPoints === 0) {
    await replaceBountyPoints(database, test.id, []);
    return;
  }
  const attempts = await listAttemptsOfTest(database, test.id);
  const winners = topScorers(attempts.filter((attempt) => attempt.studentId !== null));
  await replaceBountyPoints(
    database,
    test.id,
    winners.map((winner) => ({
      studentId: winner.studentId ?? 0,
      points: test.bountyPoints,
      reason: `Top scorer: ${test.title}`,
      createdAt: awardedAt,
    })),
  );
}
