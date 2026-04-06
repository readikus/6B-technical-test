package dev.sixbee.healthtech.service;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("dev-jwt-secret-that-is-long-enough-for-hmac", 28800000);
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
}
