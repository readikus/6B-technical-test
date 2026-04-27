using HealthTech.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HealthTech.Api.Services;

public interface IAuthService
{
    Task<(Guid id, string email, string token)?> LoginAsync(string email, string password);
}

public class AuthService : IAuthService
{
    private readonly HealthTechDbContext _db;
    private readonly IJwtService _jwtService;

    public AuthService(HealthTechDbContext db, IJwtService jwtService)
    {
        _db = db;
        _jwtService = jwtService;
    }

    public async Task<(Guid id, string email, string token)?> LoginAsync(string email, string password)
    {
        var user = await _db.AdminUsers
            .FirstOrDefaultAsync(u => u.Email == email && u.IsActive);

        if (user is null)
            return null;

        if (!BCrypt.Net.BCrypt.Verify(password, user.Password))
            return null;

        var token = _jwtService.GenerateToken(user.Id, user.Email);
        return (user.Id, user.Email, token);
    }
}
