export type FieldMessages = {
  hint?: string;
  errorMessage?: string;
};

export function hintIdFor(controlId: string): string {
  return `${controlId}-hint`;
}

export function errorIdFor(controlId: string): string {
  return `${controlId}-error`;
}

export function fieldAccessibilityProps(controlId: string, { hint, errorMessage }: FieldMessages) {
  const describedByIds = [hint && hintIdFor(controlId), errorMessage && errorIdFor(controlId)]
    .filter(Boolean)
    .join(' ');

  return {
    'aria-invalid': errorMessage ? true : undefined,
    'aria-describedby': describedByIds || undefined,
  };
}
