package dev.sixbee.healthtech.config;

import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class SeedRunner implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

  /** Matches the NestJS seed in backend/seeds/001_admin_user.ts (BCRYPT_ROUNDS). */
  static final int BCRYPT_ROUNDS = 12;

  /** Matches the NestJS seed (MIN_PASSWORD_LENGTH). */
  static final int MIN_PASSWORD_LENGTH = 12;

  private final AdminUserRepository adminUserRepository;
  private final String adminEmail;
  private final String adminPassword;

  public SeedRunner(
      AdminUserRepository adminUserRepository,
      @Value("${app.admin.email}") String adminEmail,
      @Value("${app.admin.password}") String adminPassword) {
    this.adminUserRepository = adminUserRepository;
    this.adminEmail = adminEmail;
    this.adminPassword = adminPassword;
  }

  @Override
  public void run(String... args) {
    assertStrongPassword(adminPassword);

    if (adminUserRepository.existsByEmail(adminEmail)) {
      log.info("Admin user already exists: {}", adminEmail);
      return;
    }

    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(BCRYPT_ROUNDS);
    AdminUser admin = new AdminUser();
    admin.setEmail(adminEmail);
    admin.setPassword(encoder.encode(adminPassword));
    adminUserRepository.save(admin);
    log.info("Admin user seeded: {}", adminEmail);
  }

  /**
   * Enforces the same password policy as the NestJS seed: - At least 12 characters - Contains
   * uppercase, lowercase, digit, and symbol
   *
   * <p>Called at seed time so the app refuses to boot with a weak admin password. The login schema
   * is deliberately left permissive so users with weak existing passwords aren't locked out before
   * they can change them — this assertion only applies to freshly seeded passwords. Mirrors
   * backend/seeds/001_admin_user.ts.
   */
  static void assertStrongPassword(String password) {
    if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
      throw new IllegalStateException(
          "ADMIN_PASSWORD must be at least " + MIN_PASSWORD_LENGTH + " characters long");
    }
    boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
    boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
    boolean hasDigit = password.chars().anyMatch(Character::isDigit);
    boolean hasSymbol = password.chars().anyMatch(c -> !Character.isLetterOrDigit(c));
    if (!(hasLower && hasUpper && hasDigit && hasSymbol)) {
      throw new IllegalStateException(
          "ADMIN_PASSWORD must contain a mix of uppercase, lowercase, digits, and symbols");
    }
  }
}
