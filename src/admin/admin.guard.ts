import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const password = this.config.get<string>('ADMIN_PASSWORD');

    // Check query param ?key=, header x-admin-key, or cookie admin_token
    const provided =
      (req.query['key'] as string) ||
      (req.headers['x-admin-key'] as string) ||
      (req.cookies?.['admin_token'] as string | undefined);

    if (!provided || provided !== password) {
      // For browser requests (HTML), redirect to login page
      const accept = req.headers['accept'] || '';
      if (accept.includes('text/html')) {
        res.redirect('/admin/login');
        return false;
      }
      throw new UnauthorizedException('Invalid admin password');
    }
    return true;
  }
}
