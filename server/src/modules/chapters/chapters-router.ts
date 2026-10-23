import type { Chapter, ChapterResponse } from '@exam-room/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import type { Database } from '../../database/connection.js';
import { saveUnlessDuplicate } from '../../database/query-helpers.js';
import { badRequest, conflict, notFound } from '../../lib/http-errors.js';
import { idParams, positiveId, requiredName } from '../../lib/input-fields.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireTeacher } from '../auth/teacher-session.js';
import { requireSubject } from '../subjects/subjects-router.js';
import { chapterLimits } from './chapter-limits.js';
import { isCompleteOrder } from './chapter-order.js';
import {
  deleteChapterWithTags,
  findChapterById,
  insertChapter,
  listChapterIdsOfSubject,
  renameChapter,
  saveChapterOrder,
} from './chapters-repository.js';

const chapterNameSchema = z.object({
  name: requiredName('Enter a chapter name.', chapterLimits.maxNameLength),
});

const chapterOrderSchema = z.object({
  chapterIds: z.array(positiveId).max(chapterLimits.maxChaptersPerSubject),
});

const chapterIdParamsSchema = idParams('chapterId');

const chapterExists = () =>
  conflict('This subject already has a chapter with this name.', 'chapter_exists');

async function requireChapter(database: Database, request: Request): Promise<Chapter> {
  const { chapterId } = parseInput(chapterIdParamsSchema, request.params);
  const chapter = await findChapterById(database, chapterId);
  if (!chapter) throw notFound('Chapter not found.', 'chapter_not_found');
  return chapter;
}

export function createSubjectChaptersRouter(dependencies: AppDependencies): Router {
  const { database, clock } = dependencies;
  const router = Router({ mergeParams: true });

  router.use(requireTeacher(dependencies));

  router.post('/', async (request, response) => {
    const subject = await requireSubject(database, request);
    const { name } = parseInput(chapterNameSchema, request.body);
    const chapterIds = await listChapterIdsOfSubject(database, subject.id);
    if (chapterIds.length >= chapterLimits.maxChaptersPerSubject) {
      throw badRequest(
        `A subject can have at most ${chapterLimits.maxChaptersPerSubject} chapters.`,
        'too_many_chapters',
      );
    }

    const chapter = await saveUnlessDuplicate(
      () => insertChapter(database, { subjectId: subject.id, name, createdAt: clock.now() }),
      chapterExists(),
    );
    response.status(201).json({ chapter } satisfies ChapterResponse);
  });

  router.put('/order', async (request, response) => {
    const subject = await requireSubject(database, request);
    const { chapterIds } = parseInput(chapterOrderSchema, request.body);
    if (!isCompleteOrder(await listChapterIdsOfSubject(database, subject.id), chapterIds)) {
      throw conflict('The chapters changed meanwhile. Reload and try again.', 'chapters_changed');
    }

    await saveChapterOrder(database, subject.id, chapterIds);
    response.status(204).end();
  });

  return router;
}

export function createChaptersRouter(dependencies: AppDependencies): Router {
  const { database } = dependencies;
  const router = Router();

  router.use(requireTeacher(dependencies));

  router.patch('/:chapterId', async (request, response) => {
    const chapter = await requireChapter(database, request);
    const { name } = parseInput(chapterNameSchema, request.body);
    await saveUnlessDuplicate(() => renameChapter(database, chapter.id, name), chapterExists());
    response.json({ chapter: { ...chapter, name } } satisfies ChapterResponse);
  });

  router.delete('/:chapterId', async (request, response) => {
    const chapter = await requireChapter(database, request);
    await deleteChapterWithTags(database, chapter.id);
    response.status(204).end();
  });

  return router;
}
