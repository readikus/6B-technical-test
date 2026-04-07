import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const COOKIE_NAME = 'admin_token';

interface RequestWithCookies extends Request {
  cookies: Record<string, string>;
}

interface RequestWithUser extends Request {
  user: Record<string, unknown>;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();

    // Prefer cookie-based auth, fall back to Authorization header
    const cookieToken = request.cookies?.[COOKIE_NAME];
    const authHeader = request.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const token = cookieToken ?? headerToken;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = this.jwtService.verify<Record<string, unknown>>(token);
      (request as RequestWithUser).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
