import { Navigate, Route, Routes } from 'react-router';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { LoginPage } from './auth/LoginPage';
import { useTeacherSession } from './auth/use-teacher-session';
import { CreateTestPage } from './create-test/CreateTestPage';
import { DashboardPage } from './dashboard/DashboardPage';
import { EditTestPage } from './edit-test/EditTestPage';
import { ClassPage } from './manage/ClassPage';
import { ManagePage } from './manage/ManagePage';
import { MarkingPage } from './marking/MarkingPage';
import { OfflineMarksPage } from './marking/OfflineMarksPage';
import { PaperPage } from './paper/PaperPage';
import { AnswerPhotosPage } from './results/AnswerPhotosPage';
import { PrintResultsPage } from './results/PrintResultsPage';
import { StudentProfilePage } from './students/StudentProfilePage';
import { TeacherLayout } from './TeacherLayout';
import { TestDetailsPage } from './test-details/TestDetailsPage';

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
      <Route path="tests/:testId/print" element={<PrintResultsPage />} />
      <Route element={<TeacherLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tests/new" element={<CreateTestPage />} />
        <Route path="tests/:testId" element={<TestDetailsPage />} />
        <Route path="tests/:testId/edit" element={<EditTestPage />} />
        <Route path="tests/:testId/paper" element={<PaperPage />} />
        <Route path="tests/:testId/marking" element={<MarkingPage />} />
        <Route path="tests/:testId/offline-marks" element={<OfflineMarksPage />} />
        <Route path="attempts/:attemptId/photos" element={<AnswerPhotosPage />} />
        <Route path="students/:studentId" element={<StudentProfilePage />} />
        <Route path="manage" element={<ManagePage />} />
        <Route path="manage/classes/:classId" element={<ClassPage />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Route>
    </Routes>
  );
}
