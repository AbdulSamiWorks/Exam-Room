export function testPaperPath(testId: number): string {
  return `/teacher/tests/${testId}/paper`;
}

export function testMarkingPath(testId: number, attemptId?: number): string {
  const path = `/teacher/tests/${testId}/marking`;
  return attemptId === undefined ? path : `${path}?student=${attemptId}`;
}
