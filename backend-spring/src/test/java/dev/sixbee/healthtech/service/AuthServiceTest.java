package dev.sixbee.healthtech.service;

import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String PASSWORD = "password123";
    private static final String EMAIL = "admin@test.com";

    @Mock
    private AdminUserRepository adminUserRepository;

    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("test-jwt-secret-that-is-long-enough-for-hmac-sha", 28800000);
        authService = new AuthService(adminUserRepository, jwtService);
    }

    @Test
    void loginWithValidCredentialsReturnsSignedJwt() {
        AdminUser admin = activeAdmin(EMAIL, PASSWORD);
        when(adminUserRepository.findByEmail(EMAIL)).thenReturn(Optional.of(admin));

        String token = authService.login(new LoginRequest(EMAIL, PASSWORD));

        assertNotNull(token);
        assertTrue(jwtService.isValid(token));
        assertEquals(admin.getId().toString(), jwtService.parseToken(token).getSubject());
        assertEquals(EMAIL, jwtService.parseToken(token).get("email"));
    }

    @Test
    void loginWithInvalidPasswordThrows() {
        AdminUser admin = activeAdmin(EMAIL, "correct-password");
        when(adminUserRepository.findByEmail(EMAIL)).thenReturn(Optional.of(admin));

        assertThrows(AuthService.UnauthorizedException.class,
                () -> authService.login(new LoginRequest(EMAIL, "wrong-password")));
    }

    @Test
    void loginWithUnknownEmailThrows() {
        when(adminUserRepository.findByEmail("unknown@test.com")).thenReturn(Optional.empty());

        assertThrows(AuthService.UnauthorizedException.class,
                () -> authService.login(new LoginRequest("unknown@test.com", "password")));
    }

    @Test
    void loginWithInactiveAccountThrows() {
        AdminUser admin = activeAdmin(EMAIL, PASSWORD);
        admin.setActive(false);
        when(adminUserRepository.findByEmail(EMAIL)).thenReturn(Optional.of(admin));

        assertThrows(AuthService.UnauthorizedException.class,
                () -> authService.login(new LoginRequest(EMAIL, PASSWORD)));
    }

    /**
     * Cost 10 is used here intentionally: existing hashes in a
     * real database may predate the cost-12 bump (see AuthService
     * BCRYPT_COST). Bcrypt's self-describing format means old
     * hashes must still verify correctly.
     */
    private AdminUser activeAdmin(String email, String password) {
        AdminUser admin = new AdminUser();
        admin.setId(UUID.randomUUID());
        admin.setEmail(email);
        admin.setPassword(new BCryptPasswordEncoder(10).encode(password));
        admin.setActive(true);
        return admin;
    }
}
