package dev.sixbee.healthtech.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
}
