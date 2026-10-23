const MILLISECONDS_PER_MINUTE = 60_000;
const DATE_TIME_INPUT_LENGTH = 'YYYY-MM-DDTHH:mm'.length;

export function toDateTimeInputValue(timestamp: number): string {
  const timezoneOffsetMs = new Date(timestamp).getTimezoneOffset() * MILLISECONDS_PER_MINUTE;
  return new Date(timestamp - timezoneOffsetMs).toISOString().slice(0, DATE_TIME_INPUT_LENGTH);
}

export function fromDateTimeInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}
