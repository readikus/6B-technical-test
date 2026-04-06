package dev.sixbee.healthtech.controller;

import dev.sixbee.healthtech.dto.AppointmentResponse;
import dev.sixbee.healthtech.dto.AuditLogResponse;
import dev.sixbee.healthtech.dto.CreateAppointmentRequest;
import dev.sixbee.healthtech.dto.UpdateAppointmentRequest;
import dev.sixbee.healthtech.service.AppointmentService;
import dev.sixbee.healthtech.service.AuditService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

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
    public AppointmentResponse create(@Valid @RequestBody CreateAppointmentRequest request) {
        return appointmentService.create(request);
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
    public AppointmentResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateAppointmentRequest request) {
        return appointmentService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        appointmentService.delete(id);
    }

    @GetMapping("/{id}/audit")
    public List<AuditLogResponse> getAuditLog(@PathVariable UUID id) {
        return auditService.findByAppointmentId(id);
    }
}
