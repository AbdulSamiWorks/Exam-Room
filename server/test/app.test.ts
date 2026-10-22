import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './support/test-context.js';

describe('API basics', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await createTestContext();
  });
  afterEach(() => context.cleanUp());

  it('GET /api/health returns ok', async () => {
    const response = await request(context.app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('unknown API routes return a JSON 404', async () => {
    const response = await request(context.app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'not_found', message: 'Not found.' } });
  });

  it('malformed JSON returns a JSON 400', async () => {
    const response = await request(context.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"password":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('bad_request');
  });
});

describe('web app serving', () => {
  let context: TestContext;
  let webAppDirectory: string;

  beforeEach(async () => {
    webAppDirectory = mkdtempSync(path.join(tmpdir(), 'exam-room-web-'));
    writeFileSync(
      path.join(webAppDirectory, 'index.html'),
      '<!doctype html><title>Exam Room</title>',
    );
    context = await createTestContext({ webAppDirectory });
  });
  afterEach(() => {
    context.cleanUp();
    rmSync(webAppDirectory, { recursive: true, force: true });
  });

  it('serves index.html for client-side routes', async () => {
    const response = await request(context.app).get('/t/K7M2QX');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<title>Exam Room</title>');
  });

  it('keeps API 404s as JSON instead of index.html', async () => {
    const response = await request(context.app).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.type).toMatch(/json/);
  });
});
