package dev.sixbee.healthtech.security;

import com.corundumstudio.socketio.AuthorizationListener;
import com.corundumstudio.socketio.AuthorizationResult;
import com.corundumstudio.socketio.HandshakeData;
import dev.sixbee.healthtech.service.JwtService;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Authorises Socket.IO handshakes by verifying the {@code admin_token} httpOnly cookie sent in the
 * upgrade request. Mirrors the NestJS gateway in backend/src/appointments/appointments.gateway.ts —
 * unauthenticated and forged connections are rejected before any broadcast can reach them, which is
 * the C1 fix from the security audit.
 *
 * <p>The browser sends the {@code admin_token} cookie automatically on the WebSocket upgrade
 * because it is scoped to {@code localhost} (host-only) and SameSite=Strict treats different ports
 * on the same eTLD+1 as the same site, so the cookie crosses from {@code localhost:3002} (HTTP) to
 * {@code localhost:3003} (Socket.IO).
 */
public class JwtCookieAuthListener implements AuthorizationListener {

  private static final Logger log = LoggerFactory.getLogger(JwtCookieAuthListener.class);

  private final JwtService jwtService;

  public JwtCookieAuthListener(JwtService jwtService) {
    this.jwtService = jwtService;
  }

  @Override
  public AuthorizationResult getAuthorizationResult(HandshakeData data) {
    String token = extractAdminTokenCookie(data);
    if (token == null) {
      log.warn(
          "WebSocket connection refused — no auth cookie (remoteAddress={})", data.getAddress());
      return AuthorizationResult.FAILED_AUTHORIZATION;
    }

    if (!jwtService.isValid(token)) {
      log.warn(
          "WebSocket connection refused — invalid token (remoteAddress={})", data.getAddress());
      return AuthorizationResult.FAILED_AUTHORIZATION;
    }

    return AuthorizationResult.SUCCESSFUL_AUTHORIZATION;
  }

  /**
   * Pulls the admin_token cookie value out of the upgrade request's Cookie header. The cookie spec
   * allows multiple cookies on a single header, separated by "; ". We split on ';' and trim, then
   * look for the one named admin_token.
   */
  private String extractAdminTokenCookie(HandshakeData data) {
    Map<String, List<String>> headers =
        data.getHttpHeaders() == null ? Map.of() : toMap(data.getHttpHeaders());

    List<String> cookieHeaders = headers.get("Cookie");
    if (cookieHeaders == null || cookieHeaders.isEmpty()) {
      // Try lowercase too — Netty's HttpHeaders is case-insensitive
      // but defensive code never hurt anyone.
      cookieHeaders = headers.get("cookie");
      if (cookieHeaders == null || cookieHeaders.isEmpty()) {
        return null;
      }
    }

    for (String header : cookieHeaders) {
      for (String pair : header.split(";")) {
        String trimmed = pair.trim();
        int eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        String name = trimmed.substring(0, eq);
        if (AuthCookie.COOKIE_NAME.equals(name)) {
          return trimmed.substring(eq + 1);
        }
      }
    }
    return null;
  }

  /**
   * Adapt netty's {@link io.netty.handler.codec.http.HttpHeaders} (which is what
   * HandshakeData.getHttpHeaders returns) into a plain map keyed by name. Done by iterating because
   * netty's HttpHeaders is not a java.util.Map.
   */
  private Map<String, List<String>> toMap(io.netty.handler.codec.http.HttpHeaders nettyHeaders) {
    java.util.Map<String, List<String>> out = new java.util.LinkedHashMap<>();
    for (java.util.Map.Entry<String, String> entry : nettyHeaders) {
      out.computeIfAbsent(entry.getKey(), k -> new java.util.ArrayList<>()).add(entry.getValue());
    }
    return out;
  }
}
