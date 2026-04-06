package dev.sixbee.healthtech.service;

import dev.sixbee.healthtech.dto.LoginRequest;
import dev.sixbee.healthtech.dto.LoginResponse;
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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

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
    void loginWithValidCredentialsReturnsToken() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
        AdminUser admin = new AdminUser();
        admin.setId(UUID.randomUUID());
        admin.setEmail("admin@test.com");
        admin.setPassword(encoder.encode("password123"));
        admin.setActive(true);

        when(adminUserRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(admin));

        LoginResponse response = authService.login(new LoginRequest("admin@test.com", "password123"));
        assertNotNull(response.accessToken());
        assertTrue(jwtService.isValid(response.accessToken()));
    }

    @Test
    void loginWithInvalidPasswordThrows() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
        AdminUser admin = new AdminUser();
        admin.setId(UUID.randomUUID());
        admin.setEmail("admin@test.com");
        admin.setPassword(encoder.encode("correct-password"));
        admin.setActive(true);

        when(adminUserRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(admin));

        assertThrows(AuthService.UnauthorizedException.class,
                () -> authService.login(new LoginRequest("admin@test.com", "wrong-password")));
    }

    @Test
    void loginWithUnknownEmailThrows() {
        when(adminUserRepository.findByEmail("unknown@test.com")).thenReturn(Optional.empty());

        assertThrows(AuthService.UnauthorizedException.class,
                () -> authService.login(new LoginRequest("unknown@test.com", "password")));
    }
}
