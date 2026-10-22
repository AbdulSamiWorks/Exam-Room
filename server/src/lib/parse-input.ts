import type { z } from 'zod';
import { badRequest } from './http-errors.js';

export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const firstIssue = result.error.issues[0];
  const fieldPrefix =
    firstIssue && firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';
  throw badRequest(`${fieldPrefix}${firstIssue?.message ?? 'Invalid input.'}`, 'invalid_input');
}
