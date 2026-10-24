import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { removeQueriesExcept } from './query-cache';

describe('removeQueriesExcept', () => {
  it('keeps only the listed queries', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['teacher-session'], { authenticated: false });
    queryClient.setQueryData(['tests'], []);
    queryClient.setQueryData(['test-results', 4], {});

    removeQueriesExcept(queryClient, [['teacher-session']]);

    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey),
    ).toEqual([['teacher-session']]);
  });
});
