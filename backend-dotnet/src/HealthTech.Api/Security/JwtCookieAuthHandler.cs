using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Encodings.Web;
using HealthTech.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace HealthTech.Api.Security;

public class JwtCookieAuthenticationOptions : AuthenticationSchemeOptions
{
}

public class JwtCookieAuthHandler : AuthenticationHandler<JwtCookieAuthenticationOptions>
{
    private const string CookieName = "admin_token";
    private readonly IJwtService _jwtService;

    public JwtCookieAuthHandler(
        IOptionsMonitor<JwtCookieAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IJwtService jwtService)
        : base(options, logger, encoder)
    {
        _jwtService = jwtService;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = Request.Cookies[CookieName];

        if (string.IsNullOrEmpty(token))
            return Task.FromResult(AuthenticateResult.NoResult());

        var principal = _jwtService.ValidateToken(token);
        if (principal is null)
            return Task.FromResult(AuthenticateResult.Fail("Invalid or expired token"));

        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
