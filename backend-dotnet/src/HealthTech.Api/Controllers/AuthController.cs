using System.Security.Claims;
using FluentValidation;
using HealthTech.Api.Services;
using HealthTech.Shared.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HealthTech.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string CookieName = "admin_token";
    private static readonly TimeSpan CookieMaxAge = TimeSpan.FromHours(8);

    private readonly IAuthService _authService;
    private readonly IValidator<LoginRequest> _loginValidator;
    private readonly IConfiguration _configuration;

    public AuthController(IAuthService authService, IValidator<LoginRequest> loginValidator, IConfiguration configuration)
    {
        _authService = authService;
        _loginValidator = loginValidator;
        _configuration = configuration;
    }

    private bool IsCookieSecure() =>
        _configuration["COOKIE_SECURE"] != "false" &&
        Environment.GetEnvironmentVariable("COOKIE_SECURE") != "false";

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var validation = await _loginValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            return BadRequest(new
            {
                message = "Validation failed",
                errors = validation.Errors.Select(e => new
                {
                    field = e.PropertyName.ToLowerInvariant(),
                    message = e.ErrorMessage,
                }),
            });
        }

        var result = await _authService.LoginAsync(request.Email, request.Password);
        if (result is null)
            return Unauthorized(new { message = "Invalid email or password" });

        var cookieSecure = IsCookieSecure();

        Response.Cookies.Append(CookieName, result.Value.token, new CookieOptions
        {
            HttpOnly = true,
            Secure = cookieSecure,
            SameSite = SameSiteMode.Strict,
            MaxAge = CookieMaxAge,
            Path = "/",
        });

        return Ok(new AuthResponse { Ok = true });
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        var cookieSecure = IsCookieSecure();

        Response.Cookies.Delete(CookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = cookieSecure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
        });

        return Ok(new AuthResponse { Ok = true });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var sub = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)
            ?? User.FindFirstValue(ClaimTypes.Email);

        if (sub is null || email is null)
            return Unauthorized(new { message = "Invalid token claims" });

        return Ok(new MeResponse { Id = Guid.Parse(sub), Email = email });
    }
}
