import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const defaults = { databaseUrl: 'file:/tmp/exam-room.db' };
const validVariables = {
  TEACHER_PASSWORD: 'a-good-password',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('fills in defaults', () => {
    const config = loadConfig(validVariables, defaults);
    expect(config).toEqual({
      environment: 'development',
      port: 3000,
      teacherPassword: 'a-good-password',
      sessionSecret: 'x'.repeat(32),
      database: { url: 'file:/tmp/exam-room.db', authToken: undefined },
    });
  });

  it('uses the remote database settings when given', () => {
    const config = loadConfig(
      {
        ...validVariables,
        DATABASE_URL: 'libsql://exam-room.turso.io',
        DATABASE_AUTH_TOKEN: 'token',
      },
      defaults,
    );
    expect(config.database).toEqual({ url: 'libsql://exam-room.turso.io', authToken: 'token' });
  });

  it('treats empty optional values as unset', () => {
    const config = loadConfig(
      { ...validVariables, DATABASE_URL: '', DATABASE_AUTH_TOKEN: ' ' },
      defaults,
    );
    expect(config.database).toEqual({ url: 'file:/tmp/exam-room.db', authToken: undefined });
  });

  it('refuses to start without a teacher password', () => {
    expect(() => loadConfig({ SESSION_SECRET: 'x'.repeat(32) }, defaults)).toThrow(
      /TEACHER_PASSWORD/,
    );
  });

  it('refuses a short session secret', () => {
    expect(() => loadConfig({ ...validVariables, SESSION_SECRET: 'short' }, defaults)).toThrow(
      /SESSION_SECRET/,
    );
  });
});
