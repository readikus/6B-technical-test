using HealthTech.Api.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HealthTech.Api.Tests.Services;

public class JwtServiceTests
{
    private readonly JwtService _sut;
    private const string TestSecret = "this-is-a-test-jwt-secret-that-is-at-least-32-bytes-long";

    public JwtServiceTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = TestSecret,
            })
            .Build();

        _sut = new JwtService(config);
    }

    [Fact]
    public void GenerateToken_ReturnsNonEmptyString()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var email = "test@example.com";

        // Act
        var token = _sut.GenerateToken(userId, email);

        // Assert
        Assert.False(string.IsNullOrEmpty(token));
    }

    [Fact]
    public void ValidateToken_ReturnsPrincipal_ForValidToken()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var email = "admin@sixbee.health";
        var token = _sut.GenerateToken(userId, email);

        // Act
        var principal = _sut.ValidateToken(token);

        // Assert
        Assert.NotNull(principal);
        // JWT claims get mapped to ClaimTypes by default in .NET
        var sub = principal!.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        var emailClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.Email);
        Assert.Equal(userId.ToString(), sub?.Value);
        Assert.Equal(email, emailClaim?.Value);
    }

    [Fact]
    public void ValidateToken_ReturnsNull_ForInvalidToken()
    {
        // Arrange
        var invalidToken = "not.a.valid.jwt.token";

        // Act
        var principal = _sut.ValidateToken(invalidToken);

        // Assert
        Assert.Null(principal);
    }

    [Fact]
    public void ValidateToken_ReturnsNull_ForTokenSignedWithDifferentKey()
    {
        // Arrange
        var otherConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "a-completely-different-secret-key-that-is-also-32-bytes",
            })
            .Build();
        var otherService = new JwtService(otherConfig);
        var token = otherService.GenerateToken(Guid.NewGuid(), "test@test.com");

        // Act
        var principal = _sut.ValidateToken(token);

        // Assert
        Assert.Null(principal);
    }

    [Fact]
    public void Constructor_ThrowsOnMissingSecret()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => new JwtService(config));
    }

    [Fact]
    public void Constructor_ThrowsOnShortSecret()
    {
        // Arrange — secret too short
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "short",
            })
            .Build();

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => new JwtService(config));
    }
}
