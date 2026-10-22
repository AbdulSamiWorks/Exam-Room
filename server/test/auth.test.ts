import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_DURATION_MS } from '../src/modules/auth/teacher-session.js';
import {
  createTestContext,
  TEST_TEACHER_PASSWORD,
  type TestContext,
} from './support/test-context.js';

describe('teacher authentication', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  async function logIn() {
    const agent = request.agent(context.app);
    const response = await agent.post('/api/auth/login').send({ password: TEST_TEACHER_PASSWORD });
    expect(response.status).toBe(200);
    return { agent, response };
  }

  it('starts unauthenticated', async () => {
    const response = await request(context.app).get('/api/auth/session');
    expect(response.body).toEqual({ authenticated: false });
  });

  it('rejects a wrong password', async () => {
    const response = await request(context.app)
      .post('/api/auth/login')
      .send({ password: 'not-the-password' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('wrong_password');
  });

  it('rejects a missing password with a validation error', async () => {
    const response = await request(context.app).post('/api/auth/login').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
  });

  it('logs in with the right password and sets a secure session cookie', async () => {
    const { agent, response } = await logIn();

    const sessionCookie = String(response.headers['set-cookie']);
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Strict');
    expect(sessionCookie).toContain('Path=/api');

    const session = await agent.get('/api/auth/session');
    expect(session.body).toEqual({ authenticated: true });
  });

  it('logs out', async () => {
    const { agent } = await logIn();
    await agent.post('/api/auth/logout');

    const session = await agent.get('/api/auth/session');
    expect(session.body).toEqual({ authenticated: false });
  });

  it('expires the session after its duration', async () => {
    const { agent } = await logIn();
    context.clock.advanceBy(SESSION_DURATION_MS + 1);

    const session = await agent.get('/api/auth/session');
    expect(session.body).toEqual({ authenticated: false });
  });

  it('ignores a tampered session cookie', async () => {
    const { response } = await logIn();
    const sessionCookie = String(response.headers['set-cookie']).split(';')[0] ?? '';
    const tamperedCookie = sessionCookie.replace(/=(\d+)\./, (_match, expiresAt: string) => {
      return `=${Number(expiresAt) + SESSION_DURATION_MS}.`;
    });

    const session = await request(context.app)
      .get('/api/auth/session')
      .set('Cookie', tamperedCookie);
    expect(session.body).toEqual({ authenticated: false });
  });

  it('blocks login after too many wrong passwords', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(context.app).post('/api/auth/login').send({ password: 'wrong-password' });
    }

    const response = await request(context.app)
      .post('/api/auth/login')
      .send({ password: TEST_TEACHER_PASSWORD });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('too_many_requests');
  });
});
