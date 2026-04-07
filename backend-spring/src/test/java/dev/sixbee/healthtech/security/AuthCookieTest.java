package dev.sixbee.healthtech.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the byte-compatible parity with the NestJS cookie. Every
 * attribute the NestJS backend sets must be identical here: name,
 * httpOnly, secure (derived from COOKIE_SECURE), sameSite, path,
 * maxAge. A load-balanced deployment depends on this — a cookie
 * issued by one backend must validate on the other.
 */
class AuthCookieTest {

    @Test
    void sessionCookieHasAllRequiredAttributesWhenSecureIsTrue() {
        AuthCookie authCookie = new AuthCookie(true);
        ResponseCookie cookie = authCookie.buildSessionCookie("jwt-token-value");

        assertEquals(AuthCookie.COOKIE_NAME, cookie.getName());
        assertEquals("admin_token", cookie.getName()); // Locked-in string
        assertEquals("jwt-token-value", cookie.getValue());
        assertTrue(cookie.isHttpOnly());
        assertTrue(cookie.isSecure());
        assertEquals("Strict", cookie.getSameSite());
        assertEquals("/", cookie.getPath());
        assertEquals(Duration.ofHours(8), cookie.getMaxAge());
    }

    @Test
    void sessionCookieHasSecureFalseWhenConfiguredForLocalDev() {
        AuthCookie authCookie = new AuthCookie(false);
        ResponseCookie cookie = authCookie.buildSessionCookie("jwt-token-value");

        assertFalse(cookie.isSecure());
        // Everything else stays the same
        assertTrue(cookie.isHttpOnly());
        assertEquals("Strict", cookie.getSameSite());
        assertEquals("/", cookie.getPath());
    }

    @Test
    void clearCookieEmptiesValueAndSetsMaxAgeZero() {
        AuthCookie authCookie = new AuthCookie(true);
        ResponseCookie cookie = authCookie.buildClearCookie();

        assertEquals(AuthCookie.COOKIE_NAME, cookie.getName());
        assertEquals("", cookie.getValue());
        assertEquals(Duration.ZERO, cookie.getMaxAge());
        // All security attributes preserved so the browser accepts
        // the overwriting cookie for the same origin.
        assertTrue(cookie.isHttpOnly());
        assertTrue(cookie.isSecure());
        assertEquals("Strict", cookie.getSameSite());
        assertEquals("/", cookie.getPath());
    }

    @Test
    void clearCookieRespectsSecureOverrideForLocalDev() {
        AuthCookie authCookie = new AuthCookie(false);
        ResponseCookie cookie = authCookie.buildClearCookie();

        assertFalse(cookie.isSecure());
    }

    @Test
    void cookieNameConstantMatchesNestjsContract() {
        // Hard-coded check to catch accidental rename. The NestJS
        // backend uses 'admin_token' in two places:
        // backend/src/auth/auth.controller.ts (COOKIE_NAME)
        // backend/src/auth/jwt-auth.guard.ts (COOKIE_NAME)
        // If either diverges from this, load-balanced auth breaks.
        assertEquals("admin_token", AuthCookie.COOKIE_NAME);
    }

    @Test
    void maxAgeIsExactlyEightHoursMatchingNestjsEightHoursMs() {
        // NestJS: const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
        assertEquals(Duration.ofMillis(28_800_000), AuthCookie.MAX_AGE);
    }
}
