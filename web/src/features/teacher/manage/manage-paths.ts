export const MANAGE_PATH = '/teacher/manage';

export function manageClassPath(classId: number): string {
  return `${MANAGE_PATH}/classes/${classId}`;
}
