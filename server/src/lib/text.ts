const RUNS_OF_WHITESPACE = /\s+/g;

const naturalOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function tidyText(text: string): string {
  return text.trim().replace(RUNS_OF_WHITESPACE, ' ');
}

export function comparisonKey(text: string): string {
  return tidyText(text).toLocaleLowerCase();
}

export function compareNaturally(first: string, second: string): number {
  return naturalOrder.compare(first, second);
}

export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function joinWithAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
