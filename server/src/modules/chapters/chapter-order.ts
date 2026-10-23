export function isCompleteOrder(
  currentChapterIds: readonly number[],
  requestedChapterIds: readonly number[],
): boolean {
  const requested = new Set(requestedChapterIds);
  return (
    requested.size === requestedChapterIds.length &&
    requested.size === currentChapterIds.length &&
    currentChapterIds.every((chapterId) => requested.has(chapterId))
  );
}
