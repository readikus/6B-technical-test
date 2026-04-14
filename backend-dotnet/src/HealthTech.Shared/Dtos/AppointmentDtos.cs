using System.Text.Json.Serialization;

namespace HealthTech.Shared.Dtos;

public class CreateAppointmentRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime DateTime { get; set; }
}

public class UpdateAppointmentRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Description { get; set; }
    public DateTime? DateTime { get; set; }
    public string? Status { get; set; }
}

public class AppointmentResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime DateTime { get; set; }
    public string Status { get; set; } = "pending";
    public Dictionary<string, object>? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class AuditLogResponse
{
    public Guid Id { get; set; }
    public Guid? AppointmentId { get; set; }
    public Guid? AdminUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public Dictionary<string, object>? Changes { get; set; }
    public DateTime CreatedAt { get; set; }
}
