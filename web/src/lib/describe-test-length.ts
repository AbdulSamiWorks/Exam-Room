const MINUTES_PER_HOUR = 60;

export function describeDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / MINUTES_PER_HOUR);
  const minutes = durationMinutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function describePageCount(pageCount: number): string {
  return pageCount === 1 ? '1 page' : `${pageCount} pages`;
}

type PaperSize = {
  paperKind: 'pages' | 'typed';
  pageCount: number;
  questionCount: number;
};

export function describePaperSize({ paperKind, pageCount, questionCount }: PaperSize): string {
  if (paperKind === 'pages') return describePageCount(pageCount);
  return questionCount === 1 ? '1 question' : `${questionCount} questions`;
}
