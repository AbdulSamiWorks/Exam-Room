export const MANAGE_PATH = '/teacher/manage';

export type ClassSection = 'subjects' | 'students' | 'points';

const SECTION_PARAM = 'show';

export function manageClassPath(classId: number, section: ClassSection = 'subjects'): string {
  const path = `${MANAGE_PATH}/classes/${classId}`;
  return section === 'subjects' ? path : `${path}?${SECTION_PARAM}=${section}`;
}

const CLASS_SECTIONS: readonly ClassSection[] = ['subjects', 'students', 'points'];

export function classSectionOf(searchParams: URLSearchParams): ClassSection {
  return (
    CLASS_SECTIONS.find((section) => section === searchParams.get(SECTION_PARAM)) ?? 'subjects'
  );
}
