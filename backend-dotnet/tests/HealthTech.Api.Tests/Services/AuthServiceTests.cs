using HealthTech.Api.Data;
using HealthTech.Api.Models;
using HealthTech.Api.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace HealthTech.Api.Tests.Services;

public class AuthServiceTests
{
    private readonly Mock<IJwtService> _jwtServiceMock;

    public AuthServiceTests()
    {
        _jwtServiceMock = new Mock<IJwtService>();
        _jwtServiceMock
            .Setup(j => j.GenerateToken(It.IsAny<Guid>(), It.IsAny<string>()))
            .Returns("test-jwt-token");
    }

    private static HealthTechDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<HealthTechDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new HealthTechDbContext(options);
    }

    [Fact]
    public async Task LoginAsync_ReturnsToken_ForValidCredentials()
    {
        // Arrange
        var db = CreateInMemoryDb();
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword("correctPassword");
        db.AdminUsers.Add(new AdminUser
        {
            Email = "admin@test.com",
            Password = hashedPassword,
            IsActive = true,
        });
        await db.SaveChangesAsync();

        var sut = new AuthService(db, _jwtServiceMock.Object);

        // Act
        var result = await sut.LoginAsync("admin@test.com", "correctPassword");

        // Assert
        Assert.NotNull(result);
        Assert.Equal("admin@test.com", result!.Value.email);
        Assert.Equal("test-jwt-token", result.Value.token);
    }

    [Fact]
    public async Task LoginAsync_ReturnsNull_ForWrongPassword()
    {
        // Arrange
        var db = CreateInMemoryDb();
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword("correctPassword");
        db.AdminUsers.Add(new AdminUser
        {
            Email = "admin@test.com",
            Password = hashedPassword,
            IsActive = true,
        });
        await db.SaveChangesAsync();

        var sut = new AuthService(db, _jwtServiceMock.Object);

        // Act
        var result = await sut.LoginAsync("admin@test.com", "wrongPassword");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task LoginAsync_ReturnsNull_ForNonexistentUser()
    {
        // Arrange
        var db = CreateInMemoryDb();
        var sut = new AuthService(db, _jwtServiceMock.Object);

        // Act
        var result = await sut.LoginAsync("nobody@test.com", "password");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task LoginAsync_ReturnsNull_ForInactiveUser()
    {
        // Arrange
        var db = CreateInMemoryDb();
        db.AdminUsers.Add(new AdminUser
        {
            Email = "inactive@test.com",
            Password = BCrypt.Net.BCrypt.HashPassword("password"),
            IsActive = false,
        });
        await db.SaveChangesAsync();

        var sut = new AuthService(db, _jwtServiceMock.Object);

        // Act
        var result = await sut.LoginAsync("inactive@test.com", "password");

        // Assert
        Assert.Null(result);
    }
}
