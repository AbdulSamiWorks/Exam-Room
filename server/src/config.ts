import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = {
  env: 'development' | 'production' | 'test';
  port: number;
};

/** Reads and validates environment variables. Throws (and so stops the boot) if any are invalid. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return {
    env: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
  };
}
