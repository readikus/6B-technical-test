package dev.sixbee.healthtech.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.jsonwebtoken.Claims;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

  /** 43 bytes — safely above the 32-byte minimum. */
  private static final String VALID_SECRET = "dev-jwt-secret-that-is-long-enough-for-hmac";

  private JwtService jwtService;

  @BeforeEach
  void setUp() {
    jwtService = new JwtService(VALID_SECRET, 28800000);
  }

  @Test
  void generateTokenReturnsValidJwt() {
    UUID id = UUID.randomUUID();
    String token = jwtService.generateToken(id, "admin@test.com");
    assertNotNull(token);
    assertTrue(token.split("\\.").length == 3);
  }

  @Test
  void parseTokenReturnsCorrectClaims() {
    UUID id = UUID.randomUUID();
    String token = jwtService.generateToken(id, "admin@test.com");
    Claims claims = jwtService.parseToken(token);
    assertEquals(id.toString(), claims.getSubject());
    assertEquals("admin@test.com", claims.get("email"));
  }

  @Test
  void isValidReturnsTrueForValidToken() {
    String token = jwtService.generateToken(UUID.randomUUID(), "admin@test.com");
    assertTrue(jwtService.isValid(token));
  }

  @Test
  void isValidReturnsFalseForInvalidToken() {
    assertFalse(jwtService.isValid("garbage.token.here"));
  }

  @Test
  void isValidReturnsFalseForTamperedToken() {
    String token = jwtService.generateToken(UUID.randomUUID(), "admin@test.com");
    String tampered = token.substring(0, token.length() - 2) + "xx";
    assertFalse(jwtService.isValid(tampered));
  }

  // ── JWT secret validation (C2) ────────────────────────────────────

  @Test
  void constructorThrowsWhenSecretIsNull() {
    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> new JwtService(null, 28800000));
    assertTrue(ex.getMessage().contains("required"));
  }

  @Test
  void constructorThrowsWhenSecretIsEmpty() {
    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> new JwtService("", 28800000));
    assertTrue(ex.getMessage().contains("required"));
  }

  @Test
  void constructorThrowsWhenSecretIsUnder32Bytes() {
    // 31 bytes — one short of the minimum
    String shortSecret = "a".repeat(31);
    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> new JwtService(shortSecret, 28800000));
    assertTrue(ex.getMessage().contains("32 bytes"));
  }

  @Test
  void constructorAcceptsSecretAtExactly32Bytes() {
    // 32 bytes — exactly at the minimum
    String exactSecret = "a".repeat(32);
    JwtService service = new JwtService(exactSecret, 28800000);
    assertNotNull(service.generateToken(UUID.randomUUID(), "admin@test.com"));
  }

  @Test
  void constructorRejectsShortMultibyteSecretByBytesNotChars() {
    // 16 emoji chars = 64 bytes in UTF-8, comfortably above 32 bytes.
    // This verifies we measure in BYTES not CHARACTERS, matching
    // Buffer.byteLength in the NestJS implementation.
    String multibyte = "\uD83D\uDE00".repeat(16); // 😀 × 16
    JwtService service = new JwtService(multibyte, 28800000);
    assertNotNull(service.generateToken(UUID.randomUUID(), "admin@test.com"));
  }
}
