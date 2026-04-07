package dev.sixbee.healthtech.service;

import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

  /**
   * Bcrypt cost factor. Matches the NestJS seed (L1 in the security audit: bumped from 10 to 12).
   * Because bcrypt hashes are self-describing, existing hashes written at cost 10 still verify
   * correctly — the cost factor is only used for new writes.
   */
  private static final int BCRYPT_COST = 12;

  private final AdminUserRepository adminUserRepository;
  private final JwtService jwtService;
  private final BCryptPasswordEncoder passwordEncoder;

  public AuthService(AdminUserRepository adminUserRepository, JwtService jwtService) {
    this.adminUserRepository = adminUserRepository;
    this.jwtService = jwtService;
    this.passwordEncoder = new BCryptPasswordEncoder(BCRYPT_COST);
  }

  /**
   * Verifies credentials and returns a signed JWT on success. The token is never returned in the
   * HTTP response body — the controller wraps it in an httpOnly cookie via {@link
   * dev.sixbee.healthtech.security.AuthCookie}.
   *
   * @return a signed JWT string
   * @throws UnauthorizedException if the email is unknown, the account is inactive, or the password
   *     does not match
   */
  public String login(LoginRequest request) {
    AdminUser admin =
        adminUserRepository
            .findByEmail(request.email())
            .filter(
                a -> a.isActive() && passwordEncoder.matches(request.password(), a.getPassword()))
            .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

    return jwtService.generateToken(admin.getId(), admin.getEmail());
  }

  public static class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
      super(message);
    }
  }
}
