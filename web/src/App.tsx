import { Route, Routes } from 'react-router';
import { HomePage } from './features/home/HomePage';
import { NotFoundPage } from './features/home/NotFoundPage';
import { StudentPage } from './features/student/StudentPage';
import { TeacherPage } from './features/teacher/TeacherPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/teacher/*" element={<TeacherPage />} />
      <Route path="/t/:code" element={<StudentPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
