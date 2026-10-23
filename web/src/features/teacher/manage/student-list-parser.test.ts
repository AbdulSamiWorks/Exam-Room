import { describe, expect, it } from 'vitest';
import { describeProblem, parseStudentList } from './student-list-parser';

describe('parseStudentList', () => {
  it('reads "roll number, name" lines and skips empty lines', () => {
    expect(parseStudentList('1, Ayesha Khan\n\n  2,Bilal  Ahmed \n')).toEqual({
      students: [
        { rollNumber: '1', name: 'Ayesha Khan' },
        { rollNumber: '2', name: 'Bilal Ahmed' },
      ],
      problems: [],
    });
  });

  it('accepts tabs from a spreadsheet, spaces, dashes and numbered lists', () => {
    const text = [
      '3\tHamza Ali',
      '4 Sara Noor',
      '5 - Zainab',
      '6. Usman',
      '7) Fatima',
      'A-12; Omar',
    ];
    expect(parseStudentList(text.join('\r\n')).students).toEqual([
      { rollNumber: '3', name: 'Hamza Ali' },
      { rollNumber: '4', name: 'Sara Noor' },
      { rollNumber: '5', name: 'Zainab' },
      { rollNumber: '6', name: 'Usman' },
      { rollNumber: '7', name: 'Fatima' },
      { rollNumber: 'A-12', name: 'Omar' },
    ]);
  });

  it('keeps Urdu names as they are', () => {
    expect(parseStudentList('8, عائشہ خان').students).toEqual([
      { rollNumber: '8', name: 'عائشہ خان' },
    ]);
  });

  it('reports a missing name and a repeated roll number with line numbers', () => {
    const { students, problems } = parseStudentList('1, Ayesha\n2\n1, Bilal');

    expect(students).toEqual([{ rollNumber: '1', name: 'Ayesha' }]);
    expect(problems.map(describeProblem)).toEqual([
      'Line 2: add the name after the roll number.',
      'Line 3: roll number 1 is already on line 1.',
    ]);
  });

  it('reports names and roll numbers that are too long', () => {
    const longName = 'A'.repeat(61);
    const longRollNumber = '9'.repeat(31);
    const { problems } = parseStudentList(`1, ${longName}\n${longRollNumber}, Ali`);
    expect(problems.map(describeProblem)).toEqual([
      'Line 1: the name can have at most 60 characters.',
      'Line 2: the roll number can have at most 30 characters.',
    ]);
  });

  it('refuses more than 100 students at a time', () => {
    const text = Array.from({ length: 101 }, (_, index) => `${index + 1}, Student`).join('\n');
    expect(parseStudentList(text).problems.map(describeProblem)).toEqual([
      'Add at most 100 students at a time.',
    ]);
  });
});
