package dev.sixbee.healthtech.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  /**
   * Minimum JWT secret length in bytes. Mirrors the NestJS backend (backend/src/auth/auth.module.ts
   * requireJwtSecret). 32 bytes is the minimum for HMAC-SHA256 to provide its full 256-bit security
   * margin — shorter keys reduce the effective entropy below what the algorithm assumes.
   */
  private static final int MIN_SECRET_BYTES = 32;

  private final SecretKey key;
  private final long expirationMs;

  public JwtService(
      @Value("${app.jwt.secret:}") String secret,
      @Value("${app.jwt.expiration-ms}") long expirationMs) {
    requireStrongSecret(secret);
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.expirationMs = expirationMs;
  }

  /**
   * Fails fast at service instantiation if JWT_SECRET is missing or too short. The empty-string
   * default in the {@code @Value} annotation lets Spring resolve the placeholder even when the env
   * var is unset, so we can produce a clear error here rather than Spring's cryptic "Could not
   * resolve placeholder" at context-load time.
   */
  private static void requireStrongSecret(String secret) {
    if (secret == null || secret.isEmpty()) {
      throw new IllegalStateException(
          "JWT_SECRET environment variable is required and must not be empty");
    }
    if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
      throw new IllegalStateException(
          "JWT_SECRET must be at least " + MIN_SECRET_BYTES + " bytes long");
    }
  }

  public String generateToken(UUID adminId, String email) {
    Date now = new Date();
    Date expiry = new Date(now.getTime() + expirationMs);

    return Jwts.builder()
        .subject(adminId.toString())
        .claim("email", email)
        .issuedAt(now)
        .expiration(expiry)
        .signWith(key)
        .compact();
  }

  public Claims parseToken(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }

  public boolean isValid(String token) {
    try {
      parseToken(token);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  public String getSubject(String token) {
    return parseToken(token).getSubject();
  }
}
