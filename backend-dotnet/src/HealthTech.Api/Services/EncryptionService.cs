using System.Security.Cryptography;

namespace HealthTech.Api.Services;

public interface IEncryptionService
{
    string Encrypt(string plaintext);
    string Decrypt(string packed);
}

public class EncryptionService : IEncryptionService
{
    private const int IvLength = 12;
    private const int AuthTagLength = 16;
    private readonly byte[] _key;

    public EncryptionService(IConfiguration configuration)
    {
        var hexKey = configuration["Encryption:Key"]
            ?? throw new InvalidOperationException("Encryption:Key is required");
        _key = Convert.FromHexString(hexKey);

        if (_key.Length != 32)
            throw new InvalidOperationException("Encryption key must be 32 bytes (64 hex characters)");
    }

    public string Encrypt(string plaintext)
    {
        var iv = RandomNumberGenerator.GetBytes(IvLength);
        var plaintextBytes = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[plaintextBytes.Length];
        var authTag = new byte[AuthTagLength];

        using var aesGcm = new AesGcm(_key, AuthTagLength);
        aesGcm.Encrypt(iv, plaintextBytes, ciphertext, authTag);

        // Pack as: IV + authTag + ciphertext (matches NestJS layout)
        var packed = new byte[IvLength + AuthTagLength + ciphertext.Length];
        iv.CopyTo(packed, 0);
        authTag.CopyTo(packed, IvLength);
        ciphertext.CopyTo(packed, IvLength + AuthTagLength);

        return Convert.ToBase64String(packed);
    }

    public string Decrypt(string packed)
    {
        var buffer = Convert.FromBase64String(packed);

        var iv = buffer[..IvLength];
        var authTag = buffer[IvLength..(IvLength + AuthTagLength)];
        var ciphertext = buffer[(IvLength + AuthTagLength)..];
        var plaintext = new byte[ciphertext.Length];

        using var aesGcm = new AesGcm(_key, AuthTagLength);
        aesGcm.Decrypt(iv, ciphertext, authTag, plaintext);

        return System.Text.Encoding.UTF8.GetString(plaintext);
    }
}
