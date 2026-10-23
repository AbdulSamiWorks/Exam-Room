import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';

export type StoredPasskey = {
  studentId: number;
  credentialId: string;
  publicKey: Uint8Array<ArrayBuffer>;
  signCount: number;
  transports: string[];
};

const TRANSPORT_SEPARATOR = ',';

export async function insertPasskey(
  database: Database,
  passkey: StoredPasskey,
  createdAt: number,
): Promise<void> {
  await database.execute({
    sql: `INSERT INTO student_passkeys
            (student_id, credential_id, public_key, sign_count, transports, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      passkey.studentId,
      passkey.credentialId,
      passkey.publicKey,
      passkey.signCount,
      passkey.transports.join(TRANSPORT_SEPARATOR),
      createdAt,
    ],
  });
}

export async function findPasskey(
  database: Database,
  credentialId: string,
): Promise<StoredPasskey | undefined> {
  const { rows } = await database.execute({
    sql: `SELECT student_id, credential_id, public_key, sign_count, transports
          FROM student_passkeys WHERE credential_id = ?`,
    args: [credentialId],
  });
  const [row] = rows;
  return row ? toStoredPasskey(row) : undefined;
}

export async function listPasskeyIdsOfStudent(
  database: Database,
  studentId: number,
): Promise<string[]> {
  const { rows } = await database.execute({
    sql: 'SELECT credential_id FROM student_passkeys WHERE student_id = ?',
    args: [studentId],
  });
  return rows.map((row) => String(row.credential_id));
}

export async function recordPasskeyUse(
  database: Database,
  credentialId: string,
  signCount: number,
  usedAt: number,
): Promise<void> {
  await database.execute({
    sql: 'UPDATE student_passkeys SET sign_count = ?, last_used_at = ? WHERE credential_id = ?',
    args: [signCount, usedAt, credentialId],
  });
}

function toStoredPasskey(row: Row): StoredPasskey {
  const transports = String(row.transports);
  return {
    studentId: Number(row.student_id),
    credentialId: String(row.credential_id),
    publicKey: new Uint8Array(row.public_key as ArrayBuffer),
    signCount: Number(row.sign_count),
    transports: transports ? transports.split(TRANSPORT_SEPARATOR) : [],
  };
}
