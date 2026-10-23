const naturalOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function compareNaturally(first: string, second: string): number {
  return naturalOrder.compare(first, second);
}
