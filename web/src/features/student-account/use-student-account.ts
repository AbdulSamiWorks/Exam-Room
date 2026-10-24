import type {
  LoginClassListResponse,
  StudentHomeResponse,
  StudentLoginRequest,
  StudentSessionResponse,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../api/http-client';
import { removeQueriesExcept } from '../../lib/query-cache';
import { forgetLocalExamData, hasUnsentExamWork } from '../student/local-exam-data';
import {
  belongsToAnotherStudent,
  readDeviceStudentId,
  saveDeviceStudentId,
} from './device-student';

const HOME_REFRESH_INTERVAL_MS = 30_000;
const UNSENT_WORK_MESSAGE =
  'Some answers or photos are not sent yet. Connect to the internet, wait until they are sent, then log out.';

export const studentAccountQueryKeys = {
  session: ['student-session'] as const,
  loginClasses: ['student-login-classes'] as const,
  home: ['student-home'] as const,
};

export function useStudentSession() {
  return useQuery({
    queryKey: studentAccountQueryKeys.session,
    queryFn: () => getJson<StudentSessionResponse>('/student-auth/session'),
    select: (response) => response.student,
  });
}

export function useLoginClasses() {
  return useQuery({
    queryKey: studentAccountQueryKeys.loginClasses,
    queryFn: () => getJson<LoginClassListResponse>('/student-auth/classes'),
    select: (response) => response.classes,
  });
}

export async function enterStudentSession(
  queryClient: QueryClient,
  session: StudentSessionResponse,
): Promise<void> {
  const studentId = session.student?.id;
  if (studentId === undefined) return showStudentSession(queryClient, session);
  if (belongsToAnotherStudent(readDeviceStudentId(), studentId)) await forgetLocalExamData();
  saveDeviceStudentId(studentId);
  showStudentSession(queryClient, session);
}

function showStudentSession(queryClient: QueryClient, session: StudentSessionResponse): void {
  queryClient.setQueryData(studentAccountQueryKeys.session, session);
  removeQueriesExcept(queryClient, [
    studentAccountQueryKeys.session,
    studentAccountQueryKeys.loginClasses,
  ]);
}

export function useStudentLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (login: StudentLoginRequest) => {
      const session = await postJson<StudentSessionResponse>('/student-auth/login', login);
      await enterStudentSession(queryClient, session);
      return session;
    },
  });
}

export function useStudentLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (hasUnsentExamWork()) throw new Error(UNSENT_WORK_MESSAGE);
      const session = await postJson<StudentSessionResponse>('/student-auth/logout');
      await forgetLocalExamData();
      saveDeviceStudentId(undefined);
      return session;
    },
    onSuccess: (session) => showStudentSession(queryClient, session),
  });
}

export function useStudentHome() {
  return useQuery({
    queryKey: studentAccountQueryKeys.home,
    queryFn: () => getJson<StudentHomeResponse>('/student/home'),
    refetchInterval: HOME_REFRESH_INTERVAL_MS,
  });
}
