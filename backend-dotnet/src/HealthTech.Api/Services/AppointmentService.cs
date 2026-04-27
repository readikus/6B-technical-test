using System.Text.Json;
using HealthTech.Api.Data;
using HealthTech.Api.Models;
using HealthTech.Shared.Dtos;
using Microsoft.EntityFrameworkCore;

namespace HealthTech.Api.Services;

public interface IAppointmentService
{
    Task<Appointment> CreateAsync(CreateAppointmentRequest dto);
    Task<List<Appointment>> GetAllAsync();
    Task<Appointment?> GetByIdAsync(Guid id);
    Task<Appointment?> UpdateAsync(Guid id, UpdateAppointmentRequest dto, Guid? adminUserId = null,
        string? ipAddress = null, string? userAgent = null);
    Task<bool> DeleteAsync(Guid id, Guid? adminUserId = null,
        string? ipAddress = null, string? userAgent = null);

    event Action<Appointment>? OnAppointmentCreated;
}

public class AppointmentService : IAppointmentService
{
    private readonly HealthTechDbContext _db;
    private readonly IEncryptionService _encryption;
    private readonly IAuditService _audit;

    private static readonly string[] PiiFields = { "name", "email", "phone", "description" };

    public event Action<Appointment>? OnAppointmentCreated;

    public AppointmentService(
        HealthTechDbContext db,
        IEncryptionService encryption,
        IAuditService audit)
    {
        _db = db;
        _encryption = encryption;
        _audit = audit;
    }

    public async Task<Appointment> CreateAsync(CreateAppointmentRequest dto)
    {
        var appointment = new Appointment
        {
            Name = _encryption.Encrypt(dto.Name),
            Email = _encryption.Encrypt(dto.Email),
            Phone = _encryption.Encrypt(dto.Phone),
            Description = _encryption.Encrypt(dto.Description),
            DateTime = dto.DateTime.ToUniversalTime(),
            Status = "pending",
        };

        _db.Appointments.Add(appointment);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(appointment.Id, null, "created", new
        {
            name = dto.Name,
            email = dto.Email,
            phone = dto.Phone,
            description = dto.Description,
            date_time = dto.DateTime,
        });

        var decrypted = DecryptAppointment(appointment);
        OnAppointmentCreated?.Invoke(decrypted);

        return decrypted;
    }

    public async Task<List<Appointment>> GetAllAsync()
    {
        var appointments = await _db.Appointments
            .OrderBy(a => a.DateTime)
            .ToListAsync();

        return appointments.Select(DecryptAppointment).ToList();
    }

    public async Task<Appointment?> GetByIdAsync(Guid id)
    {
        var appointment = await _db.Appointments.FindAsync(id);
        return appointment is null ? null : DecryptAppointment(appointment);
    }

    public async Task<Appointment?> UpdateAsync(Guid id, UpdateAppointmentRequest dto,
        Guid? adminUserId = null, string? ipAddress = null, string? userAgent = null)
    {
        var appointment = await _db.Appointments.FindAsync(id);
        if (appointment is null) return null;

        var decryptedBefore = DecryptAppointment(appointment);
        var changes = new Dictionary<string, object>();

        if (dto.Name is not null)
        {
            changes["name"] = new { from = decryptedBefore.Name, to = dto.Name };
            appointment.Name = _encryption.Encrypt(dto.Name);
        }
        if (dto.Email is not null)
        {
            changes["email"] = new { from = decryptedBefore.Email, to = dto.Email };
            appointment.Email = _encryption.Encrypt(dto.Email);
        }
        if (dto.Phone is not null)
        {
            changes["phone"] = new { from = decryptedBefore.Phone, to = dto.Phone };
            appointment.Phone = _encryption.Encrypt(dto.Phone);
        }
        if (dto.Description is not null)
        {
            changes["description"] = new { from = decryptedBefore.Description, to = dto.Description };
            appointment.Description = _encryption.Encrypt(dto.Description);
        }
        if (dto.DateTime.HasValue)
        {
            changes["date_time"] = new { from = decryptedBefore.DateTime, to = dto.DateTime.Value };
            appointment.DateTime = dto.DateTime.Value.ToUniversalTime();
        }
        if (dto.Status is not null)
        {
            changes["status"] = new { from = decryptedBefore.Status, to = dto.Status };
            appointment.Status = dto.Status;
        }

        appointment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (changes.Count > 0)
        {
            var action = dto.Status is not null && dto.Status != decryptedBefore.Status
                ? "approved" : "updated";
            await _audit.LogAsync(id, adminUserId, action, changes, ipAddress, userAgent);
        }

        return DecryptAppointment(appointment);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? adminUserId = null,
        string? ipAddress = null, string? userAgent = null)
    {
        var appointment = await _db.Appointments.FindAsync(id);
        if (appointment is null) return false;

        _db.Appointments.Remove(appointment);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(id, adminUserId, "deleted", new { }, ipAddress, userAgent);

        return true;
    }

    private Appointment DecryptAppointment(Appointment appointment)
    {
        return new Appointment
        {
            Id = appointment.Id,
            Name = _encryption.Decrypt(appointment.Name),
            Email = _encryption.Decrypt(appointment.Email),
            Phone = _encryption.Decrypt(appointment.Phone),
            Description = _encryption.Decrypt(appointment.Description),
            DateTime = appointment.DateTime,
            Status = appointment.Status,
            Metadata = appointment.Metadata,
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt,
        };
    }
}
