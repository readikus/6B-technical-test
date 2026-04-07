package dev.sixbee.healthtech.service;

import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EncryptionService {

  private static final String ALGORITHM = "AES/GCM/NoPadding";
  private static final int IV_LENGTH = 12;
  private static final int AUTH_TAG_BITS = 128;
  private static final int AUTH_TAG_BYTES = 16;

  /** AES-256 requires exactly 32 bytes of key material = 64 hex chars. */
  private static final int REQUIRED_HEX_LENGTH = 64;

  private final SecretKeySpec keySpec;

  public EncryptionService(@Value("${app.encryption.key:}") String hexKey) {
    requireValidHexKey(hexKey);
    byte[] keyBytes = hexStringToBytes(hexKey);
    this.keySpec = new SecretKeySpec(keyBytes, "AES");
  }

  /**
   * Fails fast at service instantiation if ENCRYPTION_KEY is missing or not a valid 64-character
   * hex string. Mirrors the hardening applied to the NestJS backend after a misleading placeholder
   * in .env.example caused silent Buffer.from(..., 'hex') truncation that only surfaced as {@code
   * Invalid key length} on the first record save.
   */
  private static void requireValidHexKey(String hexKey) {
    if (hexKey == null || hexKey.isEmpty()) {
      throw new IllegalStateException(
          "ENCRYPTION_KEY environment variable is required and must not be empty");
    }
    if (hexKey.length() != REQUIRED_HEX_LENGTH) {
      throw new IllegalStateException(
          "ENCRYPTION_KEY must be exactly "
              + REQUIRED_HEX_LENGTH
              + " hex characters (32 bytes) — got "
              + hexKey.length());
    }
    if (!hexKey.matches("[0-9a-fA-F]+")) {
      throw new IllegalStateException(
          "ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f)");
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM. Output format: base64(IV + authTag + ciphertext)
   * Byte-compatible with the NestJS encryption service.
   */
  public String encrypt(String plaintext) {
    try {
      byte[] iv = new byte[IV_LENGTH];
      new SecureRandom().nextBytes(iv);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(AUTH_TAG_BITS, iv));

      byte[] ciphertextWithTag = cipher.doFinal(plaintext.getBytes("UTF-8"));

      // Java GCM appends the auth tag to the ciphertext.
      // NestJS stores them separately as: IV + authTag + ciphertext
      // So we split the Java output and rearrange.
      int ciphertextLength = ciphertextWithTag.length - AUTH_TAG_BYTES;
      byte[] ciphertext = new byte[ciphertextLength];
      byte[] authTag = new byte[AUTH_TAG_BYTES];

      System.arraycopy(ciphertextWithTag, 0, ciphertext, 0, ciphertextLength);
      System.arraycopy(ciphertextWithTag, ciphertextLength, authTag, 0, AUTH_TAG_BYTES);

      // Pack as: IV + authTag + ciphertext (matching NestJS format)
      byte[] packed = new byte[IV_LENGTH + AUTH_TAG_BYTES + ciphertextLength];
      System.arraycopy(iv, 0, packed, 0, IV_LENGTH);
      System.arraycopy(authTag, 0, packed, IV_LENGTH, AUTH_TAG_BYTES);
      System.arraycopy(ciphertext, 0, packed, IV_LENGTH + AUTH_TAG_BYTES, ciphertextLength);

      return Base64.getEncoder().encodeToString(packed);
    } catch (Exception e) {
      throw new RuntimeException("Encryption failed", e);
    }
  }

  /**
   * Decrypts ciphertext produced by either this service or the NestJS service. Input format:
   * base64(IV + authTag + ciphertext)
   */
  public String decrypt(String packed) {
    try {
      byte[] buffer = Base64.getDecoder().decode(packed);

      byte[] iv = new byte[IV_LENGTH];
      byte[] authTag = new byte[AUTH_TAG_BYTES];
      int ciphertextLength = buffer.length - IV_LENGTH - AUTH_TAG_BYTES;
      byte[] ciphertext = new byte[ciphertextLength];

      System.arraycopy(buffer, 0, iv, 0, IV_LENGTH);
      System.arraycopy(buffer, IV_LENGTH, authTag, 0, AUTH_TAG_BYTES);
      System.arraycopy(buffer, IV_LENGTH + AUTH_TAG_BYTES, ciphertext, 0, ciphertextLength);

      // Java GCM expects ciphertext + authTag concatenated
      byte[] ciphertextWithTag = new byte[ciphertextLength + AUTH_TAG_BYTES];
      System.arraycopy(ciphertext, 0, ciphertextWithTag, 0, ciphertextLength);
      System.arraycopy(authTag, 0, ciphertextWithTag, ciphertextLength, AUTH_TAG_BYTES);

      Cipher cipher = Cipher.getInstance(ALGORITHM);
      cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(AUTH_TAG_BITS, iv));

      byte[] decrypted = cipher.doFinal(ciphertextWithTag);
      return new String(decrypted, "UTF-8");
    } catch (Exception e) {
      throw new RuntimeException("Decryption failed", e);
    }
  }

  private static byte[] hexStringToBytes(String hex) {
    int len = hex.length();
    byte[] data = new byte[len / 2];
    for (int i = 0; i < len; i += 2) {
      data[i / 2] =
          (byte)
              ((Character.digit(hex.charAt(i), 16) << 4) + Character.digit(hex.charAt(i + 1), 16));
    }
    return data;
  }
}
