package dev.sixbee.healthtech.security;

import dev.sixbee.healthtech.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates incoming requests from a JWT carried in either the {@code admin_token} httpOnly
 * cookie (preferred) or an {@code Authorization: Bearer <token>} header (fallback). Mirrors the
 * NestJS guard in backend/src/auth/jwt-auth.guard.ts which also checks cookie first and header
 * second.
 *
 * <p>The cookie-first ordering is important: after the security audit the frontend stores the token
 * only in the cookie, never in JavaScript-accessible storage. The header fallback is kept for
 * direct API consumers and integration tests.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

  private static final String BEARER_PREFIX = "Bearer ";

  private final JwtService jwtService;

  public JwtAuthenticationFilter(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String token = extractToken(request);
    if (token != null && jwtService.isValid(token)) {
      authenticate(token);
    }

    filterChain.doFilter(request, response);
  }

  /**
   * Returns the token from the admin_token cookie if present, otherwise from the Authorization:
   * Bearer header, otherwise null. Matches the precedence in backend/src/auth/jwt-auth.guard.ts.
   */
  private String extractToken(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
      for (Cookie cookie : cookies) {
        if (AuthCookie.COOKIE_NAME.equals(cookie.getName())) {
          String value = cookie.getValue();
          if (value != null && !value.isEmpty()) {
            return value;
          }
        }
      }
    }

    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith(BEARER_PREFIX)) {
      return header.substring(BEARER_PREFIX.length());
    }

    return null;
  }

  /**
   * Populate the SecurityContext with a JwtPrincipal containing both id (sub claim) and email
   * (email claim) so controllers can access them via @AuthenticationPrincipal.
   */
  private void authenticate(String token) {
    Claims claims = jwtService.parseToken(token);
    String id = claims.getSubject();
    String email = claims.get("email", String.class);
    JwtPrincipal principal = new JwtPrincipal(id, email);
    UsernamePasswordAuthenticationToken auth =
        new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList());
    SecurityContextHolder.getContext().setAuthentication(auth);
  }
}
