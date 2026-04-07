package dev.sixbee.healthtech.controller;

import dev.sixbee.healthtech.dto.AppointmentResponse;
import dev.sixbee.healthtech.dto.AuditLogResponse;
import dev.sixbee.healthtech.dto.CreateAppointmentRequest;
import dev.sixbee.healthtech.dto.UpdateAppointmentRequest;
import dev.sixbee.healthtech.security.JwtPrincipal;
import dev.sixbee.healthtech.service.AppointmentService;
import dev.sixbee.healthtech.service.AuditContext;
import dev.sixbee.healthtech.service.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/appointments")
public class AppointmentController {

  private final AppointmentService appointmentService;
  private final AuditService auditService;

  public AppointmentController(AppointmentService appointmentService, AuditService auditService) {
    this.appointmentService = appointmentService;
    this.auditService = auditService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public AppointmentResponse create(
      @Valid @RequestBody CreateAppointmentRequest request, HttpServletRequest httpRequest) {
    // Public booking endpoint: no authenticated principal, so
    // adminUserId is null. IP and UA are still captured so the
    // audit trail can answer "which device booked this?".
    AuditContext context =
        AuditContext.anonymous(extractClientIp(httpRequest), httpRequest.getHeader("User-Agent"));
    return appointmentService.create(request, context);
  }

  @GetMapping
  public List<AppointmentResponse> findAll() {
    return appointmentService.findAll();
  }

  @GetMapping("/{id}")
  public AppointmentResponse findOne(@PathVariable UUID id) {
    return appointmentService.findOne(id);
  }

  @PatchMapping("/{id}")
  public AppointmentResponse update(
      @PathVariable UUID id,
      @Valid @RequestBody UpdateAppointmentRequest request,
      @AuthenticationPrincipal JwtPrincipal principal,
      HttpServletRequest httpRequest) {
    return appointmentService.update(id, request, buildAuditContext(principal, httpRequest));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @PathVariable UUID id,
      @AuthenticationPrincipal JwtPrincipal principal,
      HttpServletRequest httpRequest) {
    appointmentService.delete(id, buildAuditContext(principal, httpRequest));
  }

  @GetMapping("/{id}/audit")
  public List<AuditLogResponse> getAuditLog(@PathVariable UUID id) {
    return auditService.findByAppointmentId(id);
  }

  /**
   * Build an AuditContext from an authenticated request. The admin id is the JWT subject (UUID),
   * the IP comes from the request (honouring X-Forwarded-For for proxied deployments), and the user
   * agent is the User-Agent header if present. Mirrors {@code buildAuditContext} in NestJS
   * backend/src/appointments/appointments.controller.ts.
   */
  private AuditContext buildAuditContext(JwtPrincipal principal, HttpServletRequest httpRequest) {
    UUID adminId = null;
    if (principal != null && principal.id() != null) {
      try {
        adminId = UUID.fromString(principal.id());
      } catch (IllegalArgumentException ignored) {
        // Subject is not a valid UUID — this shouldn't
        // happen for tokens we issue, but we don't want an
        // audit write to fail the whole request.
      }
    }
    return new AuditContext(
        adminId, extractClientIp(httpRequest), httpRequest.getHeader("User-Agent"));
  }

  /**
   * Trust one proxy hop, same as NestJS {@code app.set('trust proxy', 1)}. X-Forwarded-For takes
   * precedence over request.getRemoteAddr; if it has multiple comma-separated values, the left-most
   * entry is the original client.
   */
  private String extractClientIp(HttpServletRequest request) {
    String xff = request.getHeader("X-Forwarded-For");
    if (xff != null && !xff.isEmpty()) {
      int comma = xff.indexOf(',');
      return (comma > 0 ? xff.substring(0, comma) : xff).trim();
    }
    return request.getRemoteAddr();
  }
}
