import type { StudentHomeResponse } from '@exam-room/shared';
import { Router } from 'express';
import type { AppDependencies } from '../../app-dependencies.js';
import { requireSessionStudent } from '../student-auth/student-session.js';
import { availabilityAt } from '../tests/test-availability.js';
import { listTestsOfStudent } from './student-home-repository.js';

export function createStudentHomeRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.get('/home', async (request, response) => {
    const student = await requireSessionStudent(dependencies, request);
    const serverTime = clock.now();
    const tests = await listTestsOfStudent(database, student.schoolClass.id, student.id);

    response.json({
      student,
      tests: tests.map((test) => ({ ...test, availability: availabilityAt(test, serverTime) })),
      serverTime,
    } satisfies StudentHomeResponse);
  });

  return router;
}
