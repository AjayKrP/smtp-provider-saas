import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/** Validate and replace `req.body` with the parsed result. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body) as z.infer<T>;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Express 5's req.query is a getter-only proxy; stash the parsed copy separately.
    res_locals(req).query = schema.parse(req.query) as z.infer<T>;
    next();
  };
}

function res_locals(req: Request): { query?: unknown } {
  const r = req as Request & { parsed?: { query?: unknown } };
  r.parsed ??= {};
  return r.parsed;
}

export function parsedQuery<T>(req: Request): T {
  return (req as Request & { parsed?: { query?: T } }).parsed?.query as T;
}
