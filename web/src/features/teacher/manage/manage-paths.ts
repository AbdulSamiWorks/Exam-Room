export const MANAGE_PATH = '/teacher/manage';

export type ClassSection = 'subjects' | 'students';

const SECTION_PARAM = 'show';

export function manageClassPath(classId: number, section: ClassSection = 'subjects'): string {
  const path = `${MANAGE_PATH}/classes/${classId}`;
  return section === 'subjects' ? path : `${path}?${SECTION_PARAM}=${section}`;
}

export function classSectionOf(searchParams: URLSearchParams): ClassSection {
  return searchParams.get(SECTION_PARAM) === 'students' ? 'students' : 'subjects';
}
