import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingScreen } from '../../components/LoadingScreen';
import { studentLoginPath } from './student-paths';
import { useStudentSession } from './use-student-account';

export function StudentOnlyRoutes() {
  const session = useStudentSession();
  const location = useLocation();

  if (session.isPending) return <LoadingScreen />;
  if (session.isSuccess && !session.data) {
    return <Navigate to={studentLoginPath(location.pathname)} replace />;
  }
  return <Outlet />;
}
