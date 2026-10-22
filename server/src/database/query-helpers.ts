import { LibsqlError, type ResultSet, type Row } from '@libsql/client';

export function requireFirstRow(result: ResultSet): Row {
  const [firstRow] = result.rows;
  if (!firstRow) throw new Error('Expected the query to return at least one row.');
  return firstRow;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof LibsqlError &&
    error.code.startsWith('SQLITE_CONSTRAINT') &&
    error.message.includes('UNIQUE')
  );
}
