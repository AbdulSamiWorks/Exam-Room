import type {
  LoginClassListResponse,
  StudentHomeResponse,
  StudentLoginRequest,
  StudentSessionResponse,
} from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../api/http-client';

const HOME_REFRESH_INTERVAL_MS = 30_000;

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

export function useStudentLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (login: StudentLoginRequest) =>
      postJson<StudentSessionResponse>('/student-auth/login', login),
    onSuccess: (session) => {
      queryClient.removeQueries({ queryKey: studentAccountQueryKeys.home });
      queryClient.setQueryData(studentAccountQueryKeys.session, session);
    },
  });
}

export function useStudentLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<StudentSessionResponse>('/student-auth/logout'),
    onSuccess: (session) => {
      queryClient.removeQueries({ queryKey: studentAccountQueryKeys.home });
      queryClient.setQueryData(studentAccountQueryKeys.session, session);
    },
  });
}

export function useStudentHome() {
  return useQuery({
    queryKey: studentAccountQueryKeys.home,
    queryFn: () => getJson<StudentHomeResponse>('/student/home'),
    refetchInterval: HOME_REFRESH_INTERVAL_MS,
  });
}
