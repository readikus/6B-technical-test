using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HealthTech.Api.Data;
using HealthTech.Api.Services;
using HealthTech.Shared.Dtos;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace HealthTech.Api.Tests.Integration;

public class AppointmentApiTests : IClassFixture<AppointmentApiTests.Factory>
{
    private readonly HttpClient _client;
    private readonly Factory _factory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    public AppointmentApiTests(Factory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateAppointment_ReturnsCreated_ForValidData()
    {
        // Arrange
        var request = new CreateAppointmentRequest
        {
            Name = "John Doe",
            Email = "john@example.com",
            Phone = "+44 7700 900000",
            Description = "Annual check-up",
            DateTime = DateTime.UtcNow.AddDays(7),
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/appointments", request, JsonOptions);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AppointmentResponse>(JsonOptions);
        Assert.NotNull(body);
        Assert.Equal("John Doe", body!.Name);
        Assert.Equal("pending", body.Status);
    }

    [Fact]
    public async Task CreateAppointment_ReturnsBadRequest_ForMissingName()
    {
        // Arrange
        var request = new CreateAppointmentRequest
        {
            Name = "",
            Email = "john@example.com",
            Phone = "+44 7700 900000",
            Description = "Test",
            DateTime = DateTime.UtcNow.AddDays(7),
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/appointments", request, JsonOptions);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetAppointments_ReturnsUnauthorized_WithoutCookie()
    {
        // Act
        var response = await _client.GetAsync("/api/appointments");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_SetsHttpOnlyCookie_ForValidCredentials()
    {
        // Arrange
        var loginRequest = new LoginRequest
        {
            Email = "admin@sixbee.health",
            Password = "TestPassword123!",
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);

        // Assert
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK,
            $"Expected OK but got {response.StatusCode}: {body}");
        Assert.True(response.Headers.Contains("Set-Cookie"));
        var cookie = response.Headers.GetValues("Set-Cookie").First();
        Assert.Contains("admin_token", cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetAppointments_ReturnsOk_WithValidCookie()
    {
        // Arrange — login to get cookie, then attach it manually
        // (Secure flag on cookies prevents auto-send over HTTP in tests)
        var loginRequest = new LoginRequest
        {
            Email = "admin@sixbee.health",
            Password = "TestPassword123!",
        };
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", loginRequest, JsonOptions);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        // Extract the admin_token cookie value from Set-Cookie header
        var setCookie = loginResponse.Headers.GetValues("Set-Cookie").First();
        var tokenValue = setCookie.Split(';')[0]; // "admin_token=<jwt>"

        // Act — send request with cookie manually
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/appointments");
        request.Headers.Add("Cookie", tokenValue);
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task HealthCheck_ReturnsOk()
    {
        // Act
        var response = await _client.GetAsync("/api/health");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SecurityHeaders_ArePresent()
    {
        // Act
        var response = await _client.GetAsync("/api/health");

        // Assert
        Assert.True(response.Headers.Contains("X-Content-Type-Options"));
        Assert.True(response.Headers.Contains("X-Frame-Options"));
        Assert.True(response.Headers.Contains("Referrer-Policy"));
    }

    public class Factory : WebApplicationFactory<Program>
    {
        private readonly string _dbName = $"TestDb_{Guid.NewGuid()}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var dbName = _dbName;

            builder.ConfigureServices(services =>
            {
                // Replace PostgreSQL with in-memory database for tests
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<HealthTechDbContext>));
                if (descriptor is not null)
                    services.Remove(descriptor);

                services.AddDbContext<HealthTechDbContext>(options =>
                    options.UseInMemoryDatabase(dbName));
            });

            builder.UseEnvironment("Testing");

            builder.UseSetting("Admin:Email", "admin@sixbee.health");
            builder.UseSetting("Admin:Password", "TestPassword123!");
            builder.UseSetting("Jwt:Secret", "test-jwt-secret-that-is-at-least-32-bytes-long-for-testing");
            builder.UseSetting("Encryption:Key", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
        }
    }
}
