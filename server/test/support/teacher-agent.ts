import type { Express } from 'express';
import request from 'supertest';
import { TEST_TEACHER_PASSWORD } from './test-context.js';

export async function logInAsTeacher(app: Express) {
  const teacher = request.agent(app);
  const response = await teacher.post('/api/auth/login').send({ password: TEST_TEACHER_PASSWORD });
  if (response.status !== 200) throw new Error(`Teacher login failed: ${response.status}`);
  return teacher;
}
