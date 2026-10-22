import type { CreateSubjectResponse, SubjectListResponse } from '@exam-room/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { isUniqueConstraintError } from '../../database/query-helpers.js';
import { conflict } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { subjectLimits } from './subject-limits.js';
import { insertSubject, listSubjects } from './subjects-repository.js';

const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Subject name is required.')
    .max(subjectLimits.maxNameLength, `Use at most ${subjectLimits.maxNameLength} characters.`),
});

export function createSubjectsRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.get('/', async (_request, response) => {
    const subjects = await listSubjects(database);
    response.json({ subjects } satisfies SubjectListResponse);
  });

  router.post('/', async (request, response) => {
    const { name } = parseInput(createSubjectSchema, request.body);
    try {
      const subject = await insertSubject(database, name, clock.now());
      response.status(201).json({ subject } satisfies CreateSubjectResponse);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict('This subject already exists.', 'subject_exists');
      }
      throw error;
    }
  });

  return router;
}
