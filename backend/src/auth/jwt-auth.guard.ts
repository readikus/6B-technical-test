import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const COOKIE_NAME = 'admin_token';

type AuthedRequest = Request & {
  cookies?: Record<string, string>;
  user?: Record<string, unknown>;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    // Prefer cookie-based auth, fall back to Authorization header
    const cookies: Record<string, string> | undefined = request.cookies;
    const cookieToken: string | undefined = cookies?.[COOKIE_NAME];
    const authHeader = request.headers.authorization;
    const headerToken: string | undefined = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const token: string | undefined = cookieToken ?? headerToken;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = this.jwtService.verify<Record<string, unknown>>(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
