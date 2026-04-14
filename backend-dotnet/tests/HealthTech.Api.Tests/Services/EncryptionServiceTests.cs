using HealthTech.Api.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HealthTech.Api.Tests.Services;

public class EncryptionServiceTests
{
    private readonly EncryptionService _sut;

    // 32-byte hex key (64 hex chars)
    private const string TestKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    public EncryptionServiceTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Encryption:Key"] = TestKey,
            })
            .Build();

        _sut = new EncryptionService(config);
    }

    [Fact]
    public void Encrypt_ReturnsBase64String()
    {
        // Arrange
        var plaintext = "Hello, World!";

        // Act
        var encrypted = _sut.Encrypt(plaintext);

        // Assert
        Assert.False(string.IsNullOrEmpty(encrypted));
        Assert.DoesNotContain(plaintext, encrypted);
        // Should be valid base64
        var bytes = Convert.FromBase64String(encrypted);
        Assert.True(bytes.Length > 0);
    }

    [Fact]
    public void Encrypt_ProducesCorrectByteLayout()
    {
        // Arrange
        var plaintext = "Test data";

        // Act
        var encrypted = _sut.Encrypt(plaintext);
        var buffer = Convert.FromBase64String(encrypted);

        // Assert — layout is IV[12] + authTag[16] + ciphertext[N]
        Assert.True(buffer.Length >= 12 + 16 + 1); // minimum: IV + tag + 1 byte ciphertext
    }

    [Fact]
    public void Decrypt_RoundTrips_ShortText()
    {
        // Arrange
        var plaintext = "Hello";

        // Act
        var encrypted = _sut.Encrypt(plaintext);
        var decrypted = _sut.Decrypt(encrypted);

        // Assert
        Assert.Equal(plaintext, decrypted);
    }

    [Fact]
    public void Decrypt_RoundTrips_LongText()
    {
        // Arrange
        var plaintext = "This is a longer piece of text that contains special characters: !@#$%^&*() and unicode: café résumé naïve";

        // Act
        var encrypted = _sut.Encrypt(plaintext);
        var decrypted = _sut.Decrypt(encrypted);

        // Assert
        Assert.Equal(plaintext, decrypted);
    }

    [Fact]
    public void Decrypt_RoundTrips_EmptyString()
    {
        // Arrange
        var plaintext = "";

        // Act
        var encrypted = _sut.Encrypt(plaintext);
        var decrypted = _sut.Decrypt(encrypted);

        // Assert
        Assert.Equal(plaintext, decrypted);
    }

    [Fact]
    public void Encrypt_ProducesDifferentCiphertexts_ForSamePlaintext()
    {
        // Arrange — each encryption uses a random IV
        var plaintext = "Same input";

        // Act
        var encrypted1 = _sut.Encrypt(plaintext);
        var encrypted2 = _sut.Encrypt(plaintext);

        // Assert
        Assert.NotEqual(encrypted1, encrypted2);
        // But both decrypt to the same value
        Assert.Equal(plaintext, _sut.Decrypt(encrypted1));
        Assert.Equal(plaintext, _sut.Decrypt(encrypted2));
    }

    [Fact]
    public void Decrypt_ThrowsOnTamperedData()
    {
        // Arrange
        var encrypted = _sut.Encrypt("Sensitive data");
        var buffer = Convert.FromBase64String(encrypted);
        buffer[^1] ^= 0xFF; // Flip last byte (ciphertext)
        var tampered = Convert.ToBase64String(buffer);

        // Act & Assert
        Assert.ThrowsAny<Exception>(() => _sut.Decrypt(tampered));
    }

    [Fact]
    public void Constructor_ThrowsOnMissingKey()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => new EncryptionService(config));
    }

    [Fact]
    public void Constructor_ThrowsOnInvalidKeyLength()
    {
        // Arrange — key too short (16 bytes instead of 32)
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Encryption:Key"] = "0123456789abcdef0123456789abcdef",
            })
            .Build();

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => new EncryptionService(config));
    }
}
