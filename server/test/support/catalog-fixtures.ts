import type { Chapter, SchoolClass, Subject } from '@exam-room/shared';
import type { TeacherAgent } from './teacher-agent.js';

export async function createClass(teacher: TeacherAgent, name = 'Class 9'): Promise<SchoolClass> {
  const response = await teacher.post('/api/classes').send({ name });
  if (response.status !== 201) throw new Error(`Creating the class failed: ${response.status}`);
  return response.body.schoolClass;
}

export async function createSubject(
  teacher: TeacherAgent,
  classId: number,
  name = 'Physics',
): Promise<Subject> {
  const response = await teacher.post(`/api/classes/${classId}/subjects`).send({ name });
  if (response.status !== 201) throw new Error(`Creating the subject failed: ${response.status}`);
  return response.body.subject;
}

export async function createChapter(
  teacher: TeacherAgent,
  subjectId: number,
  name: string,
): Promise<Chapter> {
  const response = await teacher.post(`/api/subjects/${subjectId}/chapters`).send({ name });
  if (response.status !== 201) throw new Error(`Creating the chapter failed: ${response.status}`);
  return response.body.chapter;
}

let createdClassCount = 0;

export async function createClassWithSubject(
  teacher: TeacherAgent,
  subjectName = 'Physics',
): Promise<Subject> {
  createdClassCount += 1;
  const schoolClass = await createClass(teacher, `Class ${createdClassCount}`);
  return createSubject(teacher, schoolClass.id, subjectName);
}
