import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addStudentToClass } from './support/exam-fixtures.js';
import { createClass } from './support/catalog-fixtures.js';
import { createSoftwareAuthenticator } from './support/software-authenticator.js';
import { logInAsTeacher } from './support/teacher-agent.js';
import { createTestContext, TEST_PUBLIC_ORIGIN, type TestContext } from './support/test-context.js';

const PASSKEYS_PATH = '/api/student-auth/passkeys';

describe('fingerprint login with passkeys', () => {
  let context: TestContext;
  let classId: number;

  beforeEach(async () => {
    context = await createTestContext();
    classId = (await createClass(await logInAsTeacher(context.app))).id;
  });
  afterEach(() => context.cleanUp());

  async function loggedInStudent() {
    const pin = await addStudentToClass(context.app, classId);
    const student = request.agent(context.app);
    await student.post('/api/student-auth/login').send({ classId, rollNumber: '17', pin });
    return student;
  }

  async function setUpFingerprint(student: ReturnType<typeof request.agent>) {
    const authenticator = createSoftwareAuthenticator(TEST_PUBLIC_ORIGIN);
    const { body } = await student.post(`${PASSKEYS_PATH}/registration-options`);
    const saved = await student
      .post(`${PASSKEYS_PATH}/registrations`)
      .send(authenticator.register(body.options));
    expect(saved.status).toBe(201);
    return authenticator;
  }

  async function logInWithFingerprint(
    authenticator: ReturnType<typeof createSoftwareAuthenticator>,
  ) {
    const phone = request.agent(context.app);
    const { body } = await phone.post(`${PASSKEYS_PATH}/login-options`);
    const login = await phone
      .post(`${PASSKEYS_PATH}/login`)
      .send(authenticator.authenticate(body.options));
    return { phone, login };
  }

  it('sets up a fingerprint after a PIN login and logs in with it', async () => {
    const authenticator = await setUpFingerprint(await loggedInStudent());

    const { phone, login } = await logInWithFingerprint(authenticator);
    expect(login.status).toBe(200);
    expect(login.body.student).toMatchObject({ name: 'Ayesha Khan', rollNumber: '17' });
    expect((await phone.get('/api/student-auth/session')).body.student).not.toBeNull();
    expect((await logInWithFingerprint(authenticator)).login.status).toBe(200);
  });

  it('asks for user verification and a platform passkey that the phone keeps', async () => {
    const student = await loggedInStudent();
    const { body } = await student.post(`${PASSKEYS_PATH}/registration-options`);
    expect(body.options).toMatchObject({
      rp: { id: 'localhost', name: 'Exam Room' },
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
    });
  });

  it('needs a PIN login to set up a fingerprint', async () => {
    const response = await request(context.app).post(`${PASSKEYS_PATH}/registration-options`);
    expect(response.status).toBe(401);
  });

  it('refuses an answer without a fresh challenge', async () => {
    const student = await loggedInStudent();
    const authenticator = createSoftwareAuthenticator(TEST_PUBLIC_ORIGIN);
    const response = await student
      .post(`${PASSKEYS_PATH}/registrations`)
      .send(authenticator.register({ challenge: 'made-up', rp: { id: 'localhost' } }));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('passkey_expired');
  });

  it('refuses a passkey made for another website', async () => {
    const student = await loggedInStudent();
    const authenticator = createSoftwareAuthenticator('https://evil.example');
    const { body } = await student.post(`${PASSKEYS_PATH}/registration-options`);
    const response = await student
      .post(`${PASSKEYS_PATH}/registrations`)
      .send(authenticator.register(body.options));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('passkey_failed');
  });

  it('removes the fingerprint when the teacher resets the PIN', async () => {
    const student = await loggedInStudent();
    const authenticator = await setUpFingerprint(student);
    const studentId = (await student.get('/api/student-auth/session')).body.student.id;
    await (await logInAsTeacher(context.app)).post(`/api/students/${studentId}/reset-pin`);

    const { login } = await logInWithFingerprint(authenticator);
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('passkey_unknown');
  });

  it('refuses an expired challenge', async () => {
    const authenticator = await setUpFingerprint(await loggedInStudent());
    const phone = request.agent(context.app);
    const { body } = await phone.post(`${PASSKEYS_PATH}/login-options`);
    context.clock.advanceBy(5 * 60 * 1000);
    const login = await phone
      .post(`${PASSKEYS_PATH}/login`)
      .send(authenticator.authenticate(body.options));
    expect(login.status).toBe(400);
  });
});
