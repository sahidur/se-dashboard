import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { auditContextStorage } from './audit-context';

/**
 * Wraps every request in an AsyncLocalStorage scope so the global audit
 * subscriber can access the authenticated user, IP address and browser for any
 * database mutation that happens while handling that request.
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    auditContextStorage.run({ req }, () => next());
  }
}
