using System.Text.Json;
using System.Threading.RateLimiting;
using FluentValidation;
using HealthTech.Api.Data;
using HealthTech.Api.Hubs;
using HealthTech.Api.Middleware;
using HealthTech.Api.Security;
using HealthTech.Api.Services;
using HealthTech.Shared.Validation;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// JSON serialisation: snake_case to match the NestJS API contract
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
    });

// Database
builder.Services.AddDbContext<HealthTechDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Authentication — custom cookie-based JWT handler
builder.Services
    .AddAuthentication("JwtCookie")
    .AddScheme<JwtCookieAuthenticationOptions, JwtCookieAuthHandler>("JwtCookie", _ => { });
builder.Services.AddAuthorization();

// Rate limiting — login endpoint: 5 requests per minute per IP
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });

    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            JsonSerializer.Serialize(new { message = "Too many requests. Please try again later." }),
            cancellationToken);
    };
});

// CORS
var corsOrigins = builder.Configuration["Cors:Origins"]?.Split(',')
    ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// SignalR
builder.Services.AddSignalR();

// Services
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
builder.Services.AddSingleton<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IAppointmentService, AppointmentService>();

// Admin seed on startup
builder.Services.AddHostedService<AdminSeedService>();

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateAppointmentValidator>();

var app = builder.Build();

// Middleware pipeline
app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseRateLimiter();
app.UseCors();

app.UseBlazorFrameworkFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<AppointmentHub>("/hubs/appointments");
app.MapFallbackToFile("index.html");

// Wire up SignalR broadcast when appointments are created
using (var scope = app.Services.CreateScope())
{
    var appointmentService = scope.ServiceProvider.GetRequiredService<IAppointmentService>();
    var hubContext = app.Services.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<AppointmentHub>>();

    appointmentService.OnAppointmentCreated += appointment =>
    {
        // Broadcast only the ID — never send PII over the hub
        _ = hubContext.Clients.All.SendAsync("AppointmentCreated", new { id = appointment.Id });
    };
}

app.Run();

// Make Program accessible for WebApplicationFactory in tests
public partial class Program { }
