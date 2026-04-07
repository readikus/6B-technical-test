import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const MIN_JWT_SECRET_BYTES = 32;

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required and must not be empty',
    );
  }
  if (Buffer.byteLength(secret, 'utf8') < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes long`,
    );
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.registerAsync({
      // Defer secret evaluation until module instantiation so tests can
      // set process.env.JWT_SECRET in beforeAll without import-time crashes.
      useFactory: () => ({
        secret: requireJwtSecret(),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
