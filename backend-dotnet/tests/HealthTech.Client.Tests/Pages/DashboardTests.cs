using Bunit;
using HealthTech.Client.Pages.Admin;
using HealthTech.Client.Services;
using HealthTech.Shared.Dtos;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using System.Security.Claims;
using Xunit;

namespace HealthTech.Client.Tests.Pages;

public class DashboardTests : TestContext
{
    private readonly Mock<ApiClient> _apiMock;

    public DashboardTests()
    {
        _apiMock = new Mock<ApiClient>(Mock.Of<HttpClient>());
        Services.AddSingleton(_apiMock.Object);

        var signalRMock = new Mock<SignalRService>(Mock.Of<Microsoft.AspNetCore.Components.NavigationManager>());
        Services.AddSingleton(signalRMock.Object);

        // Add fake auth state
        var authState = Task.FromResult(new AuthenticationState(
            new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Email, "admin@test.com"),
            }, "test"))));

        Services.AddSingleton<AuthenticationStateProvider>(
            new FakeAuthStateProvider(authState));
        Services.AddAuthorizationCore();
    }

    [Fact]
    public void ShowsLoadingSpinner_Initially()
    {
        // Arrange
        _apiMock
            .Setup(a => a.GetAppointmentsAsync())
            .Returns(Task.Delay(5000).ContinueWith<List<AppointmentResponse>>(_ => new()));

        // Act
        var cut = RenderComponent<Dashboard>();

        // Assert
        Assert.Contains("Loading appointments", cut.Markup);
    }

    [Fact]
    public void ShowsAppointmentsHeading()
    {
        // Arrange
        _apiMock
            .Setup(a => a.GetAppointmentsAsync())
            .Returns(Task.Delay(5000).ContinueWith<List<AppointmentResponse>>(_ => new()));

        // Act
        var cut = RenderComponent<Dashboard>();

        // Assert
        Assert.Contains("Appointments", cut.Markup);
    }

    private class FakeAuthStateProvider : AuthenticationStateProvider
    {
        private readonly Task<AuthenticationState> _state;
        public FakeAuthStateProvider(Task<AuthenticationState> state) => _state = state;
        public override Task<AuthenticationState> GetAuthenticationStateAsync() => _state;
    }
}
