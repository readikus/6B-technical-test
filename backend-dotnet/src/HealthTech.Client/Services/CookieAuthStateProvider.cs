using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;

namespace HealthTech.Client.Services;

public class CookieAuthStateProvider : AuthenticationStateProvider
{
    private readonly ApiClient _api;
    private ClaimsPrincipal _currentUser = new(new ClaimsIdentity());

    public CookieAuthStateProvider(ApiClient api)
    {
        _api = api;
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var me = await _api.GetMeAsync();
        if (me is not null)
        {
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, me.Id.ToString()),
                new Claim(ClaimTypes.Email, me.Email),
            }, "cookie");
            _currentUser = new ClaimsPrincipal(identity);
        }
        else
        {
            _currentUser = new ClaimsPrincipal(new ClaimsIdentity());
        }

        return new AuthenticationState(_currentUser);
    }

    public async Task<bool> LoginAsync(string email, string password)
    {
        var success = await _api.LoginAsync(email, password);
        if (success)
        {
            NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
        }
        return success;
    }

    public async Task LogoutAsync()
    {
        await _api.LogoutAsync();
        _currentUser = new ClaimsPrincipal(new ClaimsIdentity());
        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(_currentUser)));
    }

    public bool IsAuthenticated => _currentUser.Identity?.IsAuthenticated ?? false;
}
