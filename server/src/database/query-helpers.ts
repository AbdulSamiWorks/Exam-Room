import { LibsqlError, type ResultSet, type Row } from '@libsql/client';

export function requireFirstRow(result: ResultSet): Row {
  const [firstRow] = result.rows;
  if (!firstRow) throw new Error('Expected the query to return at least one row.');
  return firstRow;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return isConstraintError(error, 'UNIQUE');
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return isConstraintError(error, 'FOREIGN KEY');
}

function isConstraintError(error: unknown, constraintKind: string): boolean {
  return (
    error instanceof LibsqlError &&
    error.code.startsWith('SQLITE_CONSTRAINT') &&
    error.message.includes(constraintKind)
  );
}

export async function saveUnlessDuplicate<Result>(
  save: () => Promise<Result>,
  duplicateError: Error,
): Promise<Result> {
  try {
    return await save();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw duplicateError;
    throw error;
  }
}

export async function deleteUnlessStillUsed(
  remove: () => Promise<void>,
  stillUsedError: Error,
): Promise<void> {
  try {
    await remove();
  } catch (error) {
    if (isForeignKeyConstraintError(error)) throw stillUsedError;
    throw error;
  }
}

export function placeholdersFor(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ');
}
