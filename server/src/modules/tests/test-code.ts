import { randomInt } from 'node:crypto';
import type { Database } from '../../database/connection.js';
import { isTestCodeTaken } from './tests-repository.js';

const UNAMBIGUOUS_CHARACTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TEST_CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 10;

export function generateTestCode(): string {
  let code = '';
  for (let position = 0; position < TEST_CODE_LENGTH; position++) {
    code += UNAMBIGUOUS_CHARACTERS[randomInt(UNAMBIGUOUS_CHARACTERS.length)];
  }
  return code;
}

export async function createUniqueTestCode(database: Database): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateTestCode();
    if (!(await isTestCodeTaken(database, code))) return code;
  }
  throw new Error('Could not generate a unique test code.');
}
