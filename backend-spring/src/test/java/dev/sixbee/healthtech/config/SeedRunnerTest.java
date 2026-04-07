package dev.sixbee.healthtech.config;

import dev.sixbee.healthtech.entity.AdminUser;
import dev.sixbee.healthtech.repository.AdminUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers SeedRunner's password-complexity check (M2) and bcrypt cost
 * factor (L1). The static assertStrongPassword method is exercised
 * directly for the failure modes, and the full run() is exercised
 * once per happy path to verify the seeded hash is cost-12.
 */
@ExtendWith(MockitoExtension.class)
class SeedRunnerTest {

    private static final String VALID_PASSWORD = "Ch4ngeMe!Now123";
    private static final String ADMIN_EMAIL = "admin@test.com";

    @Mock
    private AdminUserRepository adminUserRepository;

    // ── assertStrongPassword (M2) ─────────────────────────────────────

    @Test
    void assertStrongPasswordRejectsNull() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> SeedRunner.assertStrongPassword(null));
        assertTrue(ex.getMessage().contains("12 characters"));
    }

    @Test
    void assertStrongPasswordRejectsShortPassword() {
        // 11 chars — one short
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> SeedRunner.assertStrongPassword("Short1!word"));
        assertTrue(ex.getMessage().contains("12 characters"));
    }

    @Test
    void assertStrongPasswordRejectsMissingUppercase() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> SeedRunner.assertStrongPassword("all-lower-1!"));
        assertTrue(ex.getMessage().contains("mix"));
    }

    @Test
    void assertStrongPasswordRejectsMissingLowercase() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> SeedRunner.assertStrongPassword("ALL-UPPER-1!"));
        assertTrue(ex.getMessage().contains("mix"));
    }

    @Test
    void assertStrongPasswordRejectsMissingDigit() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> SeedRunner.assertStrongPassword("NoDigitsHere!"));
        assertTrue(ex.getMessage().contains("mix"));
    }

    @Test
    void assertStrongPasswordRejectsMissingSymbol() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> SeedRunner.assertStrongPassword("NoSymbols123"));
        assertTrue(ex.getMessage().contains("mix"));
    }

    @Test
    void assertStrongPasswordAcceptsCompliantPassword() {
        // Should not throw
        SeedRunner.assertStrongPassword(VALID_PASSWORD);
    }

    @Test
    void assertStrongPasswordAcceptsExactly12CharsWithAllClasses() {
        SeedRunner.assertStrongPassword("Abcd1234!@#$");
    }

    // ── run() behaviour ──────────────────────────────────────────────

    @Test
    void runThrowsBeforeAnyDbAccessOnWeakPassword() {
        SeedRunner runner = new SeedRunner(adminUserRepository, ADMIN_EMAIL, "weak");
        assertThrows(IllegalStateException.class, runner::run);
        // Weak password must short-circuit before we read or write the DB.
        verify(adminUserRepository, never()).existsByEmail(any());
        verify(adminUserRepository, never()).save(any());
    }

    @Test
    void runIsIdempotentWhenAdminAlreadyExists() {
        SeedRunner runner = new SeedRunner(adminUserRepository, ADMIN_EMAIL, VALID_PASSWORD);
        when(adminUserRepository.existsByEmail(ADMIN_EMAIL)).thenReturn(true);

        runner.run();

        verify(adminUserRepository).existsByEmail(ADMIN_EMAIL);
        verify(adminUserRepository, never()).save(any());
    }

    @Test
    void runSavesAdminWithBcryptCost12Hash() {
        SeedRunner runner = new SeedRunner(adminUserRepository, ADMIN_EMAIL, VALID_PASSWORD);
        when(adminUserRepository.existsByEmail(ADMIN_EMAIL)).thenReturn(false);

        runner.run();

        ArgumentCaptor<AdminUser> captor = ArgumentCaptor.forClass(AdminUser.class);
        verify(adminUserRepository).save(captor.capture());
        AdminUser saved = captor.getValue();

        assertEquals(ADMIN_EMAIL, saved.getEmail());

        // Bcrypt hash format: $2a$<cost>$...
        // The <cost> segment must be "12" — matches SeedRunner.BCRYPT_ROUNDS.
        String hash = saved.getPassword();
        assertTrue(hash.startsWith("$2a$12$") || hash.startsWith("$2b$12$"),
                "Expected bcrypt hash with cost 12, got: " + hash);

        // Verify the hash actually matches the plaintext (end-to-end check).
        assertTrue(new BCryptPasswordEncoder().matches(VALID_PASSWORD, hash));
    }
}
