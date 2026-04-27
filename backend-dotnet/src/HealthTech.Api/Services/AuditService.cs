using System.Text.Json;
using HealthTech.Api.Data;
using HealthTech.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTech.Api.Services;

public interface IAuditService
{
    Task LogAsync(Guid appointmentId, Guid? adminUserId, string action,
        object changes, string? ipAddress = null, string? userAgent = null);
    Task<List<AuditLog>> GetByAppointmentIdAsync(Guid appointmentId);
}

public class AuditService : IAuditService
{
    private readonly HealthTechDbContext _db;
    private readonly IEncryptionService _encryption;

    public AuditService(HealthTechDbContext db, IEncryptionService encryption)
    {
        _db = db;
        _encryption = encryption;
    }

    public async Task LogAsync(Guid appointmentId, Guid? adminUserId, string action,
        object changes, string? ipAddress = null, string? userAgent = null)
    {
        var changesJson = JsonSerializer.Serialize(changes);
        var encryptedChanges = _encryption.Encrypt(changesJson);

        var entry = new AuditLog
        {
            AppointmentId = appointmentId,
            AdminUserId = adminUserId,
            Action = action,
            Changes = encryptedChanges,
            IpAddress = ipAddress,
            UserAgent = userAgent,
        };

        _db.AuditLogs.Add(entry);
        await _db.SaveChangesAsync();
    }

    public async Task<List<AuditLog>> GetByAppointmentIdAsync(Guid appointmentId)
    {
        return await _db.AuditLogs
            .Where(a => a.AppointmentId == appointmentId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
    }
}
