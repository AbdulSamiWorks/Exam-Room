const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function describeDateTime(timestamp: number | null): string {
  return timestamp === null ? '—' : dateTimeFormat.format(timestamp);
}
