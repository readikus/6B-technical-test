import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const COOKIE_NAME = 'admin_token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Prefer cookie-based auth, fall back to Authorization header
    const cookies = (request as Request & {
      cookies?: Record<string, string>;
    }).cookies;
    const cookieToken = cookies?.[COOKIE_NAME];
    const authHeader = request.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    const token = cookieToken ?? headerToken;

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload: Record<string, unknown> = this.jwtService.verify(token);
      (request as Request & { user: Record<string, unknown> }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
