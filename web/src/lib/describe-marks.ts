const HALF = 0.5;

export function describeMarks(marks: number): string {
  const wholeMarks = Math.floor(marks);
  const hasHalf = marks - wholeMarks === HALF;
  const number = hasHalf ? `${wholeMarks === 0 ? '' : wholeMarks}½` : String(marks);
  return `${number} ${marks === 1 || marks === HALF ? 'mark' : 'marks'}`;
}
