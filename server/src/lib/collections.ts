export function groupBy<Item, Key>(
  items: readonly Item[],
  keyOf: (item: Item) => Key,
): Map<Key, Item[]> {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export function pairUp<First, Second>(
  firsts: readonly First[],
  seconds: readonly Second[],
): Array<[First, Second]> {
  if (firsts.length !== seconds.length) {
    throw new Error(`Cannot pair ${firsts.length} items with ${seconds.length} items.`);
  }
  return firsts.map((first, index) => [first, seconds[index] as Second]);
}
