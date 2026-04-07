package dev.sixbee.healthtech.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EncryptionServiceTest {

    private EncryptionService service;

    @BeforeEach
    void setUp() {
        // 32-byte hex key (64 hex chars)
        String hexKey = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
        service = new EncryptionService(hexKey);
    }

    @Test
    void encryptAndDecryptRoundTrip() {
        String plaintext = "John Doe";
        String encrypted = service.encrypt(plaintext);
        String decrypted = service.decrypt(encrypted);
        assertEquals(plaintext, decrypted);
    }

    @Test
    void encryptProducesDifferentCiphertextEachTime() {
        String plaintext = "same value";
        String first = service.encrypt(plaintext);
        String second = service.encrypt(plaintext);
        assertNotEquals(first, second, "Random IV should produce different ciphertexts");
    }

    @Test
    void encryptedFormatIsBase64WithCorrectStructure() {
        String encrypted = service.encrypt("test");
        byte[] decoded = Base64.getDecoder().decode(encrypted);
        // IV (12) + authTag (16) + ciphertext (>= 1 byte)
        assertNotNull(decoded);
        assertEquals(true, decoded.length >= 29, "Must contain IV + authTag + ciphertext");
    }

    @Test
    void decryptHandlesEmptyString() {
        String encrypted = service.encrypt("");
        String decrypted = service.decrypt(encrypted);
        assertEquals("", decrypted);
    }

    @Test
    void decryptHandlesUnicodeCharacters() {
        String plaintext = "Dr. M\u00fcller \u2014 appointment \u00e9";
        String encrypted = service.encrypt(plaintext);
        assertEquals(plaintext, service.decrypt(encrypted));
    }

    @Test
    void decryptWithTamperedDataThrows() {
        String encrypted = service.encrypt("sensitive data");
        byte[] decoded = Base64.getDecoder().decode(encrypted);
        // Flip a byte in the ciphertext area
        decoded[decoded.length - 1] ^= 0xFF;
        String tampered = Base64.getEncoder().encodeToString(decoded);
        assertThrows(RuntimeException.class, () -> service.decrypt(tampered));
    }

    // ── ENCRYPTION_KEY validation ────────────────────────────────────

    @Test
    void constructorThrowsWhenKeyIsNull() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> new EncryptionService(null));
        assertTrue(ex.getMessage().contains("required"));
    }

    @Test
    void constructorThrowsWhenKeyIsEmpty() {
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> new EncryptionService(""));
        assertTrue(ex.getMessage().contains("required"));
    }

    @Test
    void constructorThrowsWhenKeyLengthIsWrong() {
        // 62 hex chars (should be 64)
        String shortKey = "a".repeat(62);
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> new EncryptionService(shortKey));
        assertTrue(ex.getMessage().contains("64 hex characters"));
    }

    @Test
    void constructorThrowsWhenKeyContainsNonHexCharacters() {
        // 64 chars but with a 'z' — reproduces the historical bug where
        // 'changeme-32-byte-hex-key-here0000' was silently accepted and
        // Buffer.from(..., 'hex') produced a truncated key.
        String badKey = "z".repeat(64);
        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> new EncryptionService(badKey));
        assertTrue(ex.getMessage().contains("hexadecimal"));
    }

    @Test
    void constructorAcceptsAllZeroHexKey() {
        // Valid hex — encrypts and decrypts correctly.
        String zeroKey = "0".repeat(64);
        EncryptionService svc = new EncryptionService(zeroKey);
        assertEquals("hello", svc.decrypt(svc.encrypt("hello")));
    }

    @Test
    void constructorAcceptsUppercaseHex() {
        String upperKey = "ABCDEF1234567890".repeat(4);
        EncryptionService svc = new EncryptionService(upperKey);
        assertEquals("hello", svc.decrypt(svc.encrypt("hello")));
    }
}
