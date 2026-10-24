import type { Transaction } from '@libsql/client';

export async function startedAttemptExists(
  transaction: Transaction,
  testId: number,
): Promise<boolean> {
  const { rows } = await transaction.execute({
    sql: 'SELECT 1 FROM attempts WHERE test_id = ? LIMIT 1',
    args: [testId],
  });
  return rows.length > 0;
}
