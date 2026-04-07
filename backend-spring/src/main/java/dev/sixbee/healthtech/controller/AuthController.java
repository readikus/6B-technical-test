package dev.sixbee.healthtech.controller;

import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.security.AuthCookie;
import dev.sixbee.healthtech.security.JwtPrincipal;
import dev.sixbee.healthtech.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authentication endpoints. Cookie-based JWT auth — the JWT is issued via an httpOnly cookie on
 * login and cleared on logout. Mirrors the NestJS backend/src/auth/auth.controller.ts so a
 * load-balanced deployment can route individual requests to either backend transparently.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

  private static final Map<String, Object> OK = Map.of("ok", true);

  private final AuthService authService;
  private final AuthCookie authCookie;

  public AuthController(AuthService authService, AuthCookie authCookie) {
    this.authService = authService;
    this.authCookie = authCookie;
  }

  /**
   * POST /auth/login — verifies credentials, sets the admin_token httpOnly cookie, returns {ok:
   * true} at HTTP 200. Matches the NestJS login endpoint byte-for-byte on the wire.
   */
  @PostMapping("/login")
  @ResponseStatus(HttpStatus.OK)
  public Map<String, Object> login(
      @Valid @RequestBody LoginRequest request, HttpServletResponse response) {
    String token = authService.login(request);
    ResponseCookie cookie = authCookie.buildSessionCookie(token);
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    return OK;
  }

  /**
   * POST /auth/logout — requires authentication (enforced by SecurityConfig), clears the
   * admin_token cookie, returns {ok: true} at HTTP 200. Matches the NestJS logout endpoint.
   *
   * <p>Note: the JWT itself is not invalidated server-side — the cookie is cleared on the client.
   * Token blacklisting is flagged as future work in the security audit.
   */
  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.OK)
  public Map<String, Object> logout(HttpServletResponse response) {
    ResponseCookie cookie = authCookie.buildClearCookie();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    return OK;
  }

  /**
   * GET /auth/me — returns the authenticated user's id and email. Matches the NestJS /auth/me
   * endpoint.
   */
  @GetMapping("/me")
  public Map<String, String> me(@AuthenticationPrincipal JwtPrincipal principal) {
    return Map.of(
        "id", principal.id(),
        "email", principal.email());
  }
}
