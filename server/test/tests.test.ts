import type { SchoolClass } from '@exam-room/shared';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createChapter, createClass, createSubject } from './support/catalog-fixtures.js';
import { createBlankPageImage, isWebpImage } from './support/page-image-fixtures.js';
import { logInAsTeacher, type TeacherAgent } from './support/teacher-agent.js';
import { createTestContext, TEST_START_TIME, type TestContext } from './support/test-context.js';

describe('tests', () => {
  let context: TestContext;
  let teacher: TeacherAgent;
  let schoolClass: SchoolClass;
  let subjectId: number;
  let pageImage: Buffer;

  beforeAll(async () => {
    pageImage = await createBlankPageImage();
  });

  beforeEach(async () => {
    context = await createTestContext();
    teacher = await logInAsTeacher(context.app);
    schoolClass = await createClass(teacher);
    subjectId = (await createSubject(teacher, schoolClass.id, 'Physics')).id;
  });
  afterEach(() => context.cleanUp());

  function createTestRequest(pages: Buffer[], fieldOverrides: Record<string, string> = {}) {
    const fields = {
      subjectId: String(subjectId),
      title: 'Chapter 3 Quiz',
      durationMinutes: '30',
      allowedExits: '1',
      ...fieldOverrides,
    };
    const upload = teacher.post('/api/tests');
    for (const [name, value] of Object.entries(fields)) upload.field(name, value);
    pages.forEach((page, pageIndex) => {
      upload.attach('pages', page, {
        filename: `page-${pageIndex + 1}.png`,
        contentType: 'image/png',
      });
    });
    return upload;
  }

  async function countRows(table: 'tests' | 'test_pages') {
    const { rows } = await context.database.execute(`SELECT COUNT(*) AS total FROM ${table}`);
    return Number(rows[0]?.total);
  }

  it('requires a teacher login', async () => {
    const response = await request(context.app).post('/api/tests');
    expect(response.status).toBe(401);
  });

  it('creates a test with its pages and a share code', async () => {
    const response = await createTestRequest([pageImage, pageImage]);

    expect(response.status).toBe(201);
    expect(response.body.test).toEqual({
      id: expect.any(Number),
      code: expect.stringMatching(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/),
      kind: 'test',
      title: 'Chapter 3 Quiz',
      schoolClass,
      subject: { id: subjectId, classId: schoolClass.id, name: 'Physics' },
      chapters: [],
      durationMinutes: 30,
      allowedExits: 1,
      leaveRule: 'lock',
      paperKind: 'pages',
      pageCount: 2,
      questionCount: 0,
      maxMarks: null,
      writtenAnswers: 'on_paper',
      bountyNote: '',
      bountyPoints: 0,
      waitingRoom: false,
      instantMcqResult: true,
      resultsReleasedAt: null,
      studentCount: 0,
      finishedCount: 0,
      classStudentCount: 0,
      averageMarks: null,
      createdAt: TEST_START_TIME,
      opensAt: null,
      closesAt: null,
      availability: 'not_open',
    });
  });

  it('lists tests newest first and filters them by subject', async () => {
    const chemistryId = String((await createSubject(teacher, schoolClass.id, 'Chemistry')).id);

    await createTestRequest([pageImage], { title: 'Physics old' });
    context.clock.advanceBy(1000);
    await createTestRequest([pageImage], { title: 'Physics new' });
    await createTestRequest([pageImage], { title: 'Chemistry only', subjectId: chemistryId });

    const allTests = await teacher.get('/api/tests');
    expect(allTests.body.tests.map((test: { title: string }) => test.title)).toEqual([
      'Chemistry only',
      'Physics new',
      'Physics old',
    ]);

    const physicsTests = await teacher.get(`/api/tests?subjectId=${subjectId}`);
    expect(physicsTests.body.tests.map((test: { title: string }) => test.title)).toEqual([
      'Physics new',
      'Physics old',
    ]);
  });

  it('rejects an invalid subject filter', async () => {
    const response = await teacher.get('/api/tests?subjectId=abc');
    expect(response.status).toBe(400);
  });

  it('stores pages as WebP in order', async () => {
    await createTestRequest([pageImage, pageImage, pageImage]);

    const { rows } = await context.database.execute(
      'SELECT page_no, image FROM test_pages ORDER BY page_no',
    );
    expect(rows.map((row) => row.page_no)).toEqual([1, 2, 3]);
    for (const row of rows) {
      expect(isWebpImage(new Uint8Array(row.image as ArrayBuffer))).toBe(true);
    }
  });

  it('shrinks very wide pages to the maximum page width', async () => {
    const widePage = await createBlankPageImage(2400, 3400);
    await createTestRequest([widePage]);

    const { rows } = await context.database.execute('SELECT width, height FROM test_pages');
    expect(rows[0]).toMatchObject({ width: 1600, height: 2267 });
  });

  it('reads a created test back by id', async () => {
    const created = await createTestRequest([pageImage]);

    const response = await teacher.get(`/api/tests/${created.body.test.id}`);
    expect(response.status).toBe(200);
    expect(response.body.test).toEqual(created.body.test);
  });

  it('returns 404 for an unknown test', async () => {
    const response = await teacher.get('/api/tests/999');
    expect(response.status).toBe(404);
  });

  it('requires at least one page', async () => {
    const response = await createTestRequest([]);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('pages_required');
  });

  it('rejects an unknown subject', async () => {
    const response = await createTestRequest([pageImage], { subjectId: '999' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('subject_not_found');
  });

  it.each([
    ['allowedExits', '3'],
    ['durationMinutes', '0'],
    ['durationMinutes', '601'],
    ['title', '   '],
  ])('rejects invalid %s = %j', async (field, value) => {
    const response = await createTestRequest([pageImage], { [field]: value });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
  });

  it('rejects more pages than allowed', async () => {
    const tooManyPages = Array.from({ length: 31 }, () => pageImage);
    const response = await createTestRequest(tooManyPages);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('too_many_pages');
  });

  it('saves the type and the chapter tags in chapter order', async () => {
    const forces = await createChapter(teacher, subjectId, 'Forces');
    const motion = await createChapter(teacher, subjectId, 'Motion');

    const response = await createTestRequest([pageImage], {
      kind: 'quiz',
      chapterIds: `${motion.id},${forces.id},${motion.id}`,
    });

    expect(response.status).toBe(201);
    expect(response.body.test).toMatchObject({
      kind: 'quiz',
      chapters: [
        { id: forces.id, name: 'Forces' },
        { id: motion.id, name: 'Motion' },
      ],
    });
    const listed = await teacher.get('/api/tests');
    expect(listed.body.tests[0].chapters).toEqual(response.body.test.chapters);
  });

  it('rejects a chapter of another subject', async () => {
    const chemistry = await createSubject(teacher, schoolClass.id, 'Chemistry');
    const atoms = await createChapter(teacher, chemistry.id, 'Atoms');

    const response = await createTestRequest([pageImage], { chapterIds: String(atoms.id) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('chapter_not_found');
    expect(await countRows('tests')).toBe(0);
  });

  it('rejects an unknown type', async () => {
    const response = await createTestRequest([pageImage], { kind: 'exam' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
  });

  it('saves nothing when one of the pages is not a real image', async () => {
    const response = await createTestRequest([pageImage, Buffer.from('not an image')]);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_page_image');
    expect(await countRows('tests')).toBe(0);
    expect(await countRows('test_pages')).toBe(0);
  });
});
