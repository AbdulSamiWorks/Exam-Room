import type { AttemptResult } from '@exam-room/shared';
import { describeAwayTime, describeResultStatus, sortByRollNumber } from './describe-result';

const BYTE_ORDER_MARK = '﻿';
const LINE_BREAK = '\r\n';
const FORMULA_STARTS = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

const HEADER = [
  'Roll no.',
  'Name',
  'Status',
  'Started',
  'Finished',
  'Exits',
  'Forgiven exits',
  'Time away',
];

export function buildResultsCsv(results: AttemptResult[], maxMarks: number | null = null): string {
  const hasMarks = maxMarks !== null && maxMarks > 0;
  const header = hasMarks ? [...HEADER, `Marks (out of ${maxMarks})`] : HEADER;
  const rows = [
    header,
    ...sortByRollNumber(results).map((result) =>
      hasMarks ? [...toCsvRow(result), describeTotalMarks(result)] : toCsvRow(result),
    ),
  ];
  return BYTE_ORDER_MARK + rows.map((row) => row.map(toCsvCell).join(',')).join(LINE_BREAK);
}

export function describeTotalMarks(result: AttemptResult): string {
  return result.totalMarks === null ? '' : String(result.totalMarks);
}

function toCsvRow(result: AttemptResult): string[] {
  return [
    result.rollNumber,
    result.studentName,
    describeResultStatus(result).label,
    describeSpreadsheetTime(result.startedAt),
    describeSpreadsheetTime(result.finishedAt),
    String(result.exitCount),
    String(result.forgivenExits),
    describeAwayTime(result.awayMs),
  ];
}

function toCsvCell(value: string): string {
  const safeValue = FORMULA_STARTS.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
}

export function describeSpreadsheetTime(timestamp: number | null): string {
  if (timestamp === null) return '';
  const time = new Date(timestamp);
  const datePart = [
    time.getFullYear(),
    twoDigits(time.getMonth() + 1),
    twoDigits(time.getDate()),
  ].join('-');
  return `${datePart} ${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function resultsFileName(testTitle: string): string {
  const slug = testTitle
    .toLowerCase()
    .replaceAll(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replaceAll(/^-+|-+$/g, '');
  return `${slug || 'test'}-results.csv`;
}
