import { useEffect, useState } from 'react';

const TICK_INTERVAL_MS = 500;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export function useRemainingTime(deadlineAt: number, serverTime: number): number {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadlineAt - serverTime));

  useEffect(() => {
    const clockOffsetMs = serverTime - Date.now();
    const tick = () => setRemainingMs(Math.max(0, deadlineAt - (Date.now() + clockOffsetMs)));
    const timer = window.setInterval(tick, TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [deadlineAt, serverTime]);

  return remainingMs;
}

export function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / MILLISECONDS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const twoDigits = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`
    : `${twoDigits(minutes)}:${twoDigits(seconds)}`;
}
