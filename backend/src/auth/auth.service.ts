import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Knex } from 'knex';
import { KNEX_TOKEN } from '../database/database.module';

interface AdminUser {
  id: string;
  email: string;
  password: string;
  is_active: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(KNEX_TOKEN) private readonly db: Knex,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const user: AdminUser | undefined = await this.db<AdminUser>('admin_users')
      .where({ email, is_active: true })
      .first();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
