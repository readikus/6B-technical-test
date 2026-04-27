using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HealthTech.Api.Models;

[Table("audit_log")]
public class AuditLog
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("appointment_id")]
    public Guid? AppointmentId { get; set; }

    [Column("admin_user_id")]
    public Guid? AdminUserId { get; set; }

    [Required]
    [Column("action")]
    public string Action { get; set; } = string.Empty;

    [Required]
    [Column("changes")]
    public string Changes { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("ip_address")]
    public string? IpAddress { get; set; }

    [Column("user_agent")]
    public string? UserAgent { get; set; }

    [ForeignKey(nameof(AppointmentId))]
    public Appointment? Appointment { get; set; }

    [ForeignKey(nameof(AdminUserId))]
    public AdminUser? AdminUser { get; set; }
}
