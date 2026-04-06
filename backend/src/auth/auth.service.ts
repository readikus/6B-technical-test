import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly adminEmail = process.env.ADMIN_EMAIL;
  private readonly adminPassword = process.env.ADMIN_PASSWORD;

  constructor(private readonly jwtService: JwtService) {}

  async login(email: string, password: string): Promise<{ access_token: string }> {
    if (email !== this.adminEmail || password !== this.adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: 'admin', email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
