import type { HealthResponse } from '@exam-room/shared';
import { Router } from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({ status: 'ok' } satisfies HealthResponse);
  });

  return router;
}
