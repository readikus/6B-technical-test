using HealthTech.Api.Data;
using HealthTech.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTech.Api.Services;

public class AdminSeedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminSeedService> _logger;

    public AdminSeedService(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger<AdminSeedService> logger)
    {
        _serviceProvider = serviceProvider;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HealthTechDbContext>();

        // Apply pending migrations (skip for InMemory provider used in tests)
        var isRelational = db.Database.ProviderName != "Microsoft.EntityFrameworkCore.InMemory";
        if (isRelational)
        {
            await db.Database.MigrateAsync(cancellationToken);
        }
        else
        {
            await db.Database.EnsureCreatedAsync(cancellationToken);
        }

        var email = _configuration["Admin:Email"] ?? "admin@sixbee.health";
        var password = _configuration["Admin:Password"] ?? "changeme";

        var exists = await db.AdminUsers.AnyAsync(u => u.Email == email, cancellationToken);
        if (exists)
        {
            _logger.LogInformation("Admin user {Email} already exists, skipping seed", email);
            return;
        }

        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);

        db.AdminUsers.Add(new AdminUser
        {
            Email = email,
            Password = hashedPassword,
            IsActive = true,
        });

        await db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Seeded admin user {Email}", email);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
