using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentValidation;
using HealthTech.Api.Services;
using HealthTech.Shared.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HealthTech.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;
    private readonly IAuditService _auditService;
    private readonly IEncryptionService _encryption;
    private readonly IValidator<CreateAppointmentRequest> _createValidator;
    private readonly IValidator<UpdateAppointmentRequest> _updateValidator;

    public AppointmentsController(
        IAppointmentService appointmentService,
        IAuditService auditService,
        IEncryptionService encryption,
        IValidator<CreateAppointmentRequest> createValidator,
        IValidator<UpdateAppointmentRequest> updateValidator)
    {
        _appointmentService = appointmentService;
        _auditService = auditService;
        _encryption = encryption;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            return BadRequest(new
            {
                message = validation.Errors.Select(e => e.ErrorMessage).ToArray(),
            });
        }

        var appointment = await _appointmentService.CreateAsync(request);
        return Created($"/api/appointments/{appointment.Id}", ToResponse(appointment));
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll()
    {
        var appointments = await _appointmentService.GetAllAsync();
        return Ok(appointments.Select(ToResponse));
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id)
    {
        var appointment = await _appointmentService.GetByIdAsync(id);
        if (appointment is null)
            return NotFound(new { message = "Appointment not found" });

        return Ok(ToResponse(appointment));
    }

    [HttpPatch("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentRequest request)
    {
        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            return BadRequest(new
            {
                message = validation.Errors.Select(e => e.ErrorMessage).ToArray(),
            });
        }

        var adminUserId = GetAdminUserId();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var appointment = await _appointmentService.UpdateAsync(
            id, request, adminUserId, ipAddress, userAgent);

        if (appointment is null)
            return NotFound(new { message = "Appointment not found" });

        return Ok(ToResponse(appointment));
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id)
    {
        var adminUserId = GetAdminUserId();
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var deleted = await _appointmentService.DeleteAsync(
            id, adminUserId, ipAddress, userAgent);

        if (!deleted)
            return NotFound(new { message = "Appointment not found" });

        return NoContent();
    }

    [HttpGet("{id:guid}/audit")]
    [Authorize]
    public async Task<IActionResult> GetAuditLog(Guid id)
    {
        var logs = await _auditService.GetByAppointmentIdAsync(id);

        var response = logs.Select(log =>
        {
            string decryptedChanges;
            try
            {
                decryptedChanges = _encryption.Decrypt(log.Changes);
            }
            catch
            {
                decryptedChanges = "{}";
            }

            return new AuditLogResponse
            {
                Id = log.Id,
                AppointmentId = log.AppointmentId,
                AdminUserId = log.AdminUserId,
                Action = log.Action,
                Changes = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(decryptedChanges),
                CreatedAt = log.CreatedAt,
            };
        });

        return Ok(response);
    }

    private Guid? GetAdminUserId()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return sub is not null ? Guid.Parse(sub) : null;
    }

    private static AppointmentResponse ToResponse(Models.Appointment appointment)
    {
        return new AppointmentResponse
        {
            Id = appointment.Id,
            Name = appointment.Name,
            Email = appointment.Email,
            Phone = appointment.Phone,
            Description = appointment.Description,
            DateTime = appointment.DateTime,
            Status = appointment.Status,
            Metadata = appointment.Metadata != "{}"
                ? System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(appointment.Metadata)
                : new Dictionary<string, object>(),
            CreatedAt = appointment.CreatedAt,
            UpdatedAt = appointment.UpdatedAt,
        };
    }
}
