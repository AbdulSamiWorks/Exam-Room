import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query';

export function removeQueriesExcept(
  queryClient: QueryClient,
  keptQueryKeys: readonly QueryKey[],
): void {
  const keptQueryHashes = new Set(keptQueryKeys.map((queryKey) => hashKey(queryKey)));
  queryClient.removeQueries({ predicate: (query) => !keptQueryHashes.has(query.queryHash) });
}
