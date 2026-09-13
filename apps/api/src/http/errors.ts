import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { RazorpayError } from '../billing/razorpay.js';
import { logger } from '@smtp-saas/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public details?: unknown,
  ) {
    super(message);
  }

  static badRequest = (m: string, details?: unknown) => new ApiError(400, m, 'bad_request', details);
  static unauthorized = (m = 'Unauthorized') => new ApiError(401, m, 'unauthorized');
  static forbidden = (m = 'Forbidden') => new ApiError(403, m, 'forbidden');
  static notFound = (m = 'Not found') => new ApiError(404, m, 'not_found');
  static conflict = (m: string) => new ApiError(409, m, 'conflict');
  static payment = (m: string) => new ApiError(402, m, 'payment_required');
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'bad_request', message: 'Validation failed', details: err.issues });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (err instanceof RazorpayError) {
    // Surface Razorpay's own explanation (bad item id, account restrictions, …)
    // instead of a bare 500 - it is the actionable part.
    logger.error({ err, status: err.status, code: err.code }, 'razorpay request failed');
    const status = err.status === 503 ? 503 : 502;
    res.status(status).json({ error: 'payment_provider', message: `Razorpay: ${err.message}` });
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal', message: 'Internal server error' });
}
