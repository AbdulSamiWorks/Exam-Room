const DEVICE_STUDENT_KEY = 'exam-room:device-student';

export function readDeviceStudentId(): number | undefined {
  try {
    const storedText = window.localStorage.getItem(DEVICE_STUDENT_KEY);
    const studentId = Number(storedText);
    return storedText && Number.isInteger(studentId) ? studentId : undefined;
  } catch {
    return undefined;
  }
}

export function saveDeviceStudentId(studentId: number | undefined): void {
  try {
    if (studentId === undefined) window.localStorage.removeItem(DEVICE_STUDENT_KEY);
    else window.localStorage.setItem(DEVICE_STUDENT_KEY, String(studentId));
  } catch {
    return;
  }
}

export function belongsToAnotherStudent(
  deviceStudentId: number | undefined,
  studentId: number,
): boolean {
  return deviceStudentId !== undefined && deviceStudentId !== studentId;
}
