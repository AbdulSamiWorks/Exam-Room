import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('API', () => {
  const app = createApp();

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown API routes return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });
});

describe('web app serving', () => {
  const webDistDir = mkdtempSync(path.join(tmpdir(), 'exam-room-web-'));
  writeFileSync(path.join(webDistDir, 'index.html'), '<!doctype html><title>Exam Room</title>');
  const app = createApp({ webDistDir });

  afterAll(() => rmSync(webDistDir, { recursive: true, force: true }));

  it('serves index.html for client-side routes', async () => {
    const res = await request(app).get('/t/K7M2QX');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Exam Room</title>');
  });

  it('does not let the SPA fallback swallow API 404s', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/json/);
  });
});
