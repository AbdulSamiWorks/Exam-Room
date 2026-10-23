import { Route, Routes } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/home/NotFoundPage';
import { StudentPage } from '../features/student/StudentPage';
import { StudentLoginPage } from '../features/student-account/StudentLoginPage';
import { StudentResultPage } from '../features/student-account/StudentResultPage';
import { STUDENT_LOGIN_PATH } from '../features/student-account/student-paths';
import { TeacherArea } from '../features/teacher/TeacherArea';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path={STUDENT_LOGIN_PATH} element={<StudentLoginPage />} />
      <Route path="/teacher/*" element={<TeacherArea />} />
      <Route path="/t/:testCode" element={<StudentPage />} />
      <Route path="/results/:testCode" element={<StudentResultPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
