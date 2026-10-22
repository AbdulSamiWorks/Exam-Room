import { Navigate, Route, Routes } from 'react-router';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { LoginPage } from './auth/LoginPage';
import { useTeacherSession } from './auth/use-teacher-session';
import { DashboardPage } from './dashboard/DashboardPage';
import { TeacherLayout } from './TeacherLayout';

export function TeacherArea() {
  const session = useTeacherSession();

  if (session.isPending) return <LoadingScreen />;

  if (session.isError) {
    return (
      <Page title="Teacher">
        <FormError>{session.error.message}</FormError>
        <p>
          <Button variant="secondary" onClick={() => session.refetch()}>
            Try again
          </Button>
        </p>
      </Page>
    );
  }

  if (!session.data.authenticated) return <LoginPage />;

  return (
    <Routes>
      <Route element={<TeacherLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Route>
    </Routes>
  );
}
