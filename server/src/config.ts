import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const environmentVariablesSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TEACHER_PASSWORD: z.string().min(8, 'must be at least 8 characters'),
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  DATABASE_URL: optionalText,
  DATABASE_AUTH_TOKEN: optionalText,
});

export type RuntimeEnvironment = 'development' | 'production' | 'test';

export type Config = {
  environment: RuntimeEnvironment;
  port: number;
  teacherPassword: string;
  sessionSecret: string;
  database: {
    url: string;
    authToken: string | undefined;
  };
};

type ConfigDefaults = {
  databaseUrl: string;
};

export function loadConfig(
  environmentVariables: NodeJS.ProcessEnv,
  defaults: ConfigDefaults,
): Config {
  const parsed = environmentVariablesSchema.safeParse(environmentVariables);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const variables = parsed.data;
  return {
    environment: variables.NODE_ENV,
    port: variables.PORT,
    teacherPassword: variables.TEACHER_PASSWORD,
    sessionSecret: variables.SESSION_SECRET,
    database: {
      url: variables.DATABASE_URL ?? defaults.databaseUrl,
      authToken: variables.DATABASE_AUTH_TOKEN,
    },
  };
}
