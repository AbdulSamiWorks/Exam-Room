import type {
  AddStudentsRequest,
  AddStudentsResponse,
  MoveStudentsRequest,
  MoveStudentsResponse,
  NewStudent,
  StudentListResponse,
  StudentResponse,
  StudentWithPin,
  UpdateStudentRequest,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteResource, getJson, patchJson, postJson } from '../../../api/http-client';
import { classQueryKeys } from './use-classes';

export function useStudents(classId: number) {
  return useQuery({
    queryKey: classQueryKeys.students(classId),
    queryFn: () => getJson<StudentListResponse>(`/classes/${classId}/students`),
    select: (response) => response.students,
  });
}

function useStudentChange<Variables, Result>(
  sendChange: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendChange,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: classQueryKeys.tree }),
  });
}

export function useAddStudents(classId: number) {
  return useStudentChange((students: NewStudent[]) =>
    postJson<AddStudentsResponse>(`/classes/${classId}/students`, {
      students,
    } satisfies AddStudentsRequest),
  );
}

export function useUpdateStudent(studentId: number) {
  return useStudentChange((changes: UpdateStudentRequest) =>
    patchJson<StudentResponse>(`/students/${studentId}`, changes),
  );
}

export function useResetPin(studentId: number) {
  return useStudentChange(() => postJson<StudentWithPin>(`/students/${studentId}/reset-pin`));
}

export function useDeleteStudent(studentId: number) {
  return useStudentChange(() => deleteResource(`/students/${studentId}`));
}

export function useMoveStudents(classId: number) {
  return useStudentChange((toClassId: number) =>
    postJson<MoveStudentsResponse>(`/classes/${classId}/students/move`, {
      toClassId,
    } satisfies MoveStudentsRequest),
  );
}
