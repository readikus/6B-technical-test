import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { loginSchema } from './auth.validation';

const COOKIE_NAME = 'admin_token';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/**
 * Cookie security flags.
 *
 * `Secure` defaults to true so that production deployments fail safe.
 * Local development over plain HTTP must explicitly opt out by setting
 * COOKIE_SECURE=false in `.env`. NODE_ENV is no longer the deciding
 * factor — that previously caused silent downgrades when NODE_ENV was
 * unset, mistyped, or set to 'staging'.
 */
function isCookieSecure(): boolean {
  return process.env.COOKIE_SECURE !== 'false';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // The 'login' throttler is configured in AppModule.ThrottlerModule
  // (5 attempts per IP per minute by default; raise via env vars in
  // tests). Skip the global 'default' throttler so the two don't
  // double-count.
  @SkipThrottle({ default: true })
  @Throttle({ login: {} })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const { access_token } = await this.authService.login(
      result.data.email,
      result.data.password,
    );

    res.cookie(COOKIE_NAME, access_token, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'strict',
      maxAge: EIGHT_HOURS_MS,
      path: '/',
    });

    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'strict',
      path: '/',
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: { sub: string; email: string } }) {
    return { id: req.user.sub, email: req.user.email };
  }
}
