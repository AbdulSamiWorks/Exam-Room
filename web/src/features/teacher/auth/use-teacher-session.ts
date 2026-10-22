import type { LoginRequest, SessionResponse } from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../../../api/http-client';

const teacherSessionQueryKey = ['teacher-session'] as const;

export function useTeacherSession() {
  return useQuery({
    queryKey: teacherSessionQueryKey,
    queryFn: () => getJson<SessionResponse>('/auth/session'),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => {
      const loginRequest: LoginRequest = { password };
      return postJson<SessionResponse>('/auth/login', loginRequest);
    },
    onSuccess: (session) => queryClient.setQueryData(teacherSessionQueryKey, session),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<SessionResponse>('/auth/logout'),
    onSuccess: (session) => {
      queryClient.clear();
      queryClient.setQueryData(teacherSessionQueryKey, session);
    },
  });
}
