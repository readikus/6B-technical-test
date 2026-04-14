using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HealthTech.Api.Models;

[Table("appointments")]
public class Appointment
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Column("email")]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Column("phone")]
    public string Phone { get; set; } = string.Empty;

    [Required]
    [Column("description")]
    public string Description { get; set; } = string.Empty;

    [Required]
    [Column("date_time")]
    public DateTime DateTime { get; set; }

    [Required]
    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("metadata", TypeName = "jsonb")]
    public string Metadata { get; set; } = "{}";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
