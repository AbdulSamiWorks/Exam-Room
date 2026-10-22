import { Route, Routes } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/home/NotFoundPage';
import { StudentPage } from '../features/student/StudentPage';
import { TeacherArea } from '../features/teacher/TeacherArea';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/teacher/*" element={<TeacherArea />} />
      <Route path="/t/:testCode" element={<StudentPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
