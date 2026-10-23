import { z } from 'zod';
import { tidyText } from './text.js';

export const positiveId = z.coerce.number().int().positive();

export function requiredName(emptyMessage: string, maxLength: number) {
  return z
    .string()
    .trim()
    .min(1, emptyMessage)
    .max(maxLength, `Use at most ${maxLength} characters.`)
    .transform(tidyText);
}

export function idParams<Name extends string>(name: Name) {
  return z.object({ [name]: positiveId } as Record<Name, typeof positiveId>);
}

export function atLeastOneChange(changes: Record<string, unknown>): boolean {
  return Object.values(changes).some((value) => value !== undefined);
}
