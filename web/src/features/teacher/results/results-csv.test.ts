import type { AttemptResult } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { buildResultsCsv, describeSpreadsheetTime, resultsFileName } from './results-csv';

const STARTED_AT = new Date(2026, 9, 24, 9, 5).getTime();

function attemptResult(overrides: Partial<AttemptResult> = {}): AttemptResult {
  return {
    id: 1,
    studentName: 'Ayesha Khan',
    rollNumber: '17',
    status: 'submitted',
    finishReason: 'student',
    startedAt: STARTED_AT,
    finishedAt: STARTED_AT + 30 * 60_000,
    exitCount: 1,
    forgivenExits: 0,
    awayMs: 65_000,
    isAwayNow: false,
    answeredCount: 0,
    photoCount: 0,
    totalMarks: null,
    exits: [],
    ...overrides,
  };
}

function csvLines(results: AttemptResult[]): string[] {
  return buildResultsCsv(results).replace('﻿', '').split('\r\n');
}

describe('buildResultsCsv', () => {
  it('starts with a byte order mark so spreadsheet apps read Urdu names correctly', () => {
    expect(buildResultsCsv([]).startsWith('﻿')).toBe(true);
  });

  it('writes a header and one row per student', () => {
    expect(csvLines([attemptResult()])).toEqual([
      'Roll no.,Name,Status,Started,Finished,Exits,Forgiven exits,Time away',
      '17,Ayesha Khan,Submitted,2026-10-24 09:05,2026-10-24 09:35,1,0,1 min 05 s',
    ]);
  });

  it('quotes cells with commas, quotes or line breaks', () => {
    const [, row] = csvLines([attemptResult({ studentName: 'Khan, "Ayesha"' })]);
    expect(row).toContain('"Khan, ""Ayesha"""');
  });

  it('stops names that look like formulas from running in a spreadsheet', () => {
    const [, row] = csvLines([attemptResult({ studentName: '=HYPERLINK("x")' })]);
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('leaves the finish time empty while the student is still writing', () => {
    const [, row] = csvLines([
      attemptResult({ status: 'in_progress', finishReason: null, finishedAt: null }),
    ]);
    expect(row).toBe('17,Ayesha Khan,In progress,2026-10-24 09:05,,1,0,1 min 05 s');
  });
});

describe('describeSpreadsheetTime', () => {
  it('writes local time as year-month-day hours:minutes', () => {
    expect(describeSpreadsheetTime(new Date(2026, 0, 3, 7, 4).getTime())).toBe('2026-01-03 07:04');
  });
});

describe('resultsFileName', () => {
  it('makes a safe file name from the test title', () => {
    expect(resultsFileName('Chapter 3: Quiz / Part A')).toBe('chapter-3-quiz-part-a-results.csv');
  });

  it('keeps Urdu letters and falls back when nothing is left', () => {
    expect(resultsFileName('ریاضی ٹیسٹ')).toBe('ریاضی-ٹیسٹ-results.csv');
    expect(resultsFileName('???')).toBe('test-results.csv');
  });
});

describe('marks in the CSV', () => {
  it('adds a marks column when the test has marks', () => {
    const lines = buildResultsCsv(
      [
        attemptResult({ totalMarks: 7.5 }),
        attemptResult({ id: 2, rollNumber: '18', totalMarks: null }),
      ],
      10,
    )
      .replace('\uFEFF', '')
      .split('\r\n');
    expect(lines[0]?.endsWith(',Marks (out of 10)')).toBe(true);
    expect(lines[1]?.endsWith(',7.5')).toBe(true);
    expect(lines[2]?.endsWith(',')).toBe(true);
  });
});
