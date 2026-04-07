package dev.sixbee.healthtech.security;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Centralises the attributes of the session cookie so the login, logout, and filter paths all use
 * identical values. Matches the NestJS cookie produced by backend/src/auth/auth.controller.ts:
 *
 * <ul>
 *   <li>name: {@code admin_token}
 *   <li>httpOnly: true
 *   <li>secure: {@code COOKIE_SECURE != "false"} (defaults to true)
 *   <li>sameSite: Strict
 *   <li>path: /
 *   <li>maxAge: 8 hours
 * </ul>
 *
 * Byte-compatible parity with the NestJS backend is a hard requirement: in a load-balanced
 * deployment a cookie issued by one backend must be accepted by the other, and vice versa.
 */
@Component
public class AuthCookie {

  /** Cookie name. Must match NestJS backend/src/auth/auth.controller.ts COOKIE_NAME. */
  public static final String COOKIE_NAME = "admin_token";

  /** 8 hours — matches NestJS EIGHT_HOURS_MS constant. */
  public static final Duration MAX_AGE = Duration.ofHours(8);

  private final boolean secure;

  public AuthCookie(@Value("${app.cookie.secure:true}") boolean secure) {
    this.secure = secure;
  }

  /** Build the session cookie that carries the JWT. Used by the login endpoint. */
  public ResponseCookie buildSessionCookie(String token) {
    return ResponseCookie.from(COOKIE_NAME, token)
        .httpOnly(true)
        .secure(secure)
        .sameSite("Strict")
        .path("/")
        .maxAge(MAX_AGE)
        .build();
  }

  /**
   * Build the cookie-clearing directive used by the logout endpoint. Matches the {@code
   * res.clearCookie(...)} call in the NestJS logout path: same attributes as the session cookie,
   * but empty value and {@code maxAge=0}.
   */
  public ResponseCookie buildClearCookie() {
    return ResponseCookie.from(COOKIE_NAME, "")
        .httpOnly(true)
        .secure(secure)
        .sameSite("Strict")
        .path("/")
        .maxAge(0)
        .build();
  }

  /** Exposed for tests. */
  public boolean isSecure() {
    return secure;
  }
}
