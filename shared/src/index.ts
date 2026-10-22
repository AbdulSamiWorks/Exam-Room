/**
 * API contract shared by the server and the web app.
 *
 * TYPES ONLY: this package must never export runtime values. It is imported with
 * `import type` and erased at build time, so there is nothing to build or deploy.
 */

export type HealthResponse = {
  status: 'ok';
};

/** Every API error uses this shape. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
