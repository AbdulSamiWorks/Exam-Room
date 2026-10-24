const HALF = 0.5;

export function describeMarks(marks: number): string {
  const wholeMarks = Math.floor(marks);
  const hasHalf = marks - wholeMarks === HALF;
  const number = hasHalf ? `${wholeMarks === 0 ? '' : wholeMarks}½` : String(marks);
  return `${number} ${marks === 1 || marks === HALF ? 'mark' : 'marks'}`;
}

export function formatMarks(marks: number): string {
  return describeMarks(marks).split(' ')[0] ?? String(marks);
}

export function describeScore(marks: number, maxMarks: number): string {
  const percentage = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
  return `${formatMarks(marks)} / ${formatMarks(maxMarks)} (${percentage}%)`;
}
