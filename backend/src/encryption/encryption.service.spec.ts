import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const TEST_KEY = 'a'.repeat(64); // 32 bytes as hex
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(TEST_KEY);
  });

  describe('encrypt', () => {
    it('should return a non-empty string different from the input', () => {
      // Arrange
      const plaintext = 'patient@example.com';

      // Act
      const ciphertext = service.encrypt(plaintext);

      // Assert
      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toBe('');
      expect(ciphertext).not.toBe(plaintext);
    });

    it('should produce different ciphertexts for the same input (unique IV)', () => {
      // Arrange
      const plaintext = 'John Smith';

      // Act
      const first = service.encrypt(plaintext);
      const second = service.encrypt(plaintext);

      // Assert
      expect(first).not.toBe(second);
    });
  });

  describe('decrypt', () => {
    it('should recover the original plaintext', () => {
      // Arrange
      const plaintext = 'patient@example.com';
      const ciphertext = service.encrypt(plaintext);

      // Act
      const result = service.decrypt(ciphertext);

      // Assert
      expect(result).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      // Arrange
      const plaintext = "Seán O'Brien — +44 7700 900000";

      // Act
      const result = service.decrypt(service.encrypt(plaintext));

      // Assert
      expect(result).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      // Arrange
      const plaintext = '';

      // Act
      const result = service.decrypt(service.encrypt(plaintext));

      // Assert
      expect(result).toBe(plaintext);
    });
  });

  describe('error handling', () => {
    it('should throw on tampered ciphertext', () => {
      // Arrange
      const ciphertext = service.encrypt('sensitive data');
      const tampered = ciphertext.slice(0, -4) + 'XXXX';

      // Act & Assert
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw with wrong key', () => {
      // Arrange
      const ciphertext = service.encrypt('sensitive data');
      const wrongKeyService = new EncryptionService('b'.repeat(64));

      // Act & Assert
      expect(() => wrongKeyService.decrypt(ciphertext)).toThrow();
    });
  });
});
