package dev.sixbee.healthtech.security;

/**
 * Authenticated principal extracted from a validated JWT.
 *
 * Mirrors the NestJS guard's {@code req.user} shape:
 * {@code { sub: string, email: string }}. Stored as the principal on
 * the Spring SecurityContext so controllers can access it via
 * {@code @AuthenticationPrincipal JwtPrincipal principal}.
 *
 * @param id    UUID of the admin user (from the JWT 'sub' claim)
 * @param email email address (from the JWT 'email' claim)
 */
public record JwtPrincipal(String id, String email) {}
