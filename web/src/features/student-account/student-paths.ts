export const STUDENT_LOGIN_PATH = '/login';
const NEXT_PARAM = 'next';

export function studentLoginPath(nextPath?: string): string {
  if (!nextPath) return STUDENT_LOGIN_PATH;
  return `${STUDENT_LOGIN_PATH}?${new URLSearchParams({ [NEXT_PARAM]: nextPath }).toString()}`;
}

export function safeNextPath(searchParams: URLSearchParams): string {
  const nextPath = searchParams.get(NEXT_PARAM) ?? '';
  return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
}

export function studentTestPath(testCode: string): string {
  return `/t/${testCode}`;
}

export function studentSubjectPath(subjectId: number): string {
  return `/subjects/${subjectId}`;
}
