import type { ClassPointsResponse, StudentPointsHistoryResponse } from '@exam-room/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { notFound } from '../../lib/http-errors.js';
import { idParams } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { requireClass } from '../classes/classes-router.js';
import { findStudentById } from '../students/students-repository.js';
import { addPoints, listClassPoints, listPointsOfStudent } from './points-repository.js';

const MAX_POINTS_CHANGE = 1000;
const MAX_REASON_LENGTH = 120;

const addPointsSchema = z.object({
  points: z
    .number()
    .int('Points must be a whole number.')
    .min(-MAX_POINTS_CHANGE)
    .max(MAX_POINTS_CHANGE)
    .refine((points) => points !== 0, 'Enter points other than 0.'),
  reason: z
    .string()
    .trim()
    .min(1, 'Say why the points are given.')
    .max(MAX_REASON_LENGTH, `Use at most ${MAX_REASON_LENGTH} characters.`),
});

const studentIdParamsSchema = idParams('studentId');

export function createClassPointsRouter(dependencies: AppDependencies): Router {
  const { database } = dependencies;
  const router = Router({ mergeParams: true });
  router.use(requireTeacher(dependencies));

  router.get('/', async (request, response) => {
    const schoolClass = await requireClass(database, request);
    response.json({
      students: await listClassPoints(database, schoolClass.id),
    } satisfies ClassPointsResponse);
  });

  return router;
}

export function createStudentPointsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });
  router.use(requireTeacher(dependencies));

  async function requireStudentId(params: unknown): Promise<number> {
    const { studentId } = parseInput(studentIdParamsSchema, params);
    if (!(await findStudentById(database, studentId))) throw notFound('Student not found.');
    return studentId;
  }

  async function history(studentId: number): Promise<StudentPointsHistoryResponse> {
    const entries = await listPointsOfStudent(database, studentId);
    return { entries, total: entries.reduce((total, entry) => total + entry.points, 0) };
  }

  router.get('/', async (request, response) => {
    response.json(await history(await requireStudentId(request.params)));
  });

  router.post('/', async (request, response) => {
    const studentId = await requireStudentId(request.params);
    const { points, reason } = parseInput(addPointsSchema, request.body);
    await addPoints(database, { studentId, points, reason, createdAt: clock.now() });
    response.status(201).json(await history(studentId));
  });

  return router;
}
