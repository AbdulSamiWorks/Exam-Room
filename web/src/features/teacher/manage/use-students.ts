import type {
  AddStudentsRequest,
  AddStudentsResponse,
  MoveStudentsRequest,
  MoveStudentsResponse,
  NewPinsResponse,
  NewStudent,
  StudentListResponse,
  StudentResponse,
  StudentWithPin,
  UpdateStudentRequest,
} from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { deleteResource, getJson, patchJson, postJson } from '../../../api/http-client';
import { classQueryKeys, useManageChange } from './use-classes';

export function useStudents(classId: number) {
  return useQuery({
    queryKey: classQueryKeys.students(classId),
    queryFn: () => getJson<StudentListResponse>(`/classes/${classId}/students`),
    select: (response) => response.students,
  });
}

export function useAddStudents(classId: number) {
  return useManageChange((students: NewStudent[]) =>
    postJson<AddStudentsResponse>(`/classes/${classId}/students`, {
      students,
    } satisfies AddStudentsRequest),
  );
}

export function useUpdateStudent(studentId: number) {
  return useManageChange((changes: UpdateStudentRequest) =>
    patchJson<StudentResponse>(`/students/${studentId}`, changes),
  );
}

export function useResetPin(studentId: number) {
  return useManageChange(() => postJson<StudentWithPin>(`/students/${studentId}/reset-pin`));
}

export function useResetClassPins(classId: number) {
  return useManageChange(() =>
    postJson<NewPinsResponse>(`/classes/${classId}/students/reset-pins`),
  );
}

export function useDeleteStudent(studentId: number) {
  return useManageChange(() => deleteResource(`/students/${studentId}`));
}

export function useMoveStudents(classId: number) {
  return useManageChange((toClassId: number) =>
    postJson<MoveStudentsResponse>(`/classes/${classId}/students/move`, {
      toClassId,
    } satisfies MoveStudentsRequest),
  );
}
