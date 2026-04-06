package dev.sixbee.healthtech.service;

import dev.sixbee.healthtech.dto.AppointmentResponse;
import dev.sixbee.healthtech.dto.CreateAppointmentRequest;
import dev.sixbee.healthtech.dto.UpdateAppointmentRequest;
import dev.sixbee.healthtech.entity.Appointment;
import dev.sixbee.healthtech.repository.AppointmentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AppointmentService {

    private final AppointmentRepository repository;
    private final EncryptionService encryptionService;
    private final AuditService auditService;

    public AppointmentService(AppointmentRepository repository, EncryptionService encryptionService, AuditService auditService) {
        this.repository = repository;
        this.encryptionService = encryptionService;
        this.auditService = auditService;
    }

    public AppointmentResponse create(CreateAppointmentRequest request) {
        Appointment appointment = new Appointment();
        appointment.setName(encryptionService.encrypt(request.name()));
        appointment.setEmail(encryptionService.encrypt(request.email()));
        appointment.setPhone(encryptionService.encrypt(request.phone()));
        appointment.setDescription(encryptionService.encrypt(request.description()));
        appointment.setDateTime(parseDateTime(request.dateTime()));

        Appointment saved = repository.save(appointment);
        Appointment decrypted = decryptAppointment(saved);

        Map<String, Object> changes = new HashMap<>();
        changes.put("name", request.name());
        changes.put("email", request.email());
        changes.put("phone", request.phone());
        changes.put("description", request.description());
        changes.put("date_time", request.dateTime());
        auditService.log("created", saved.getId(), changes);

        return AppointmentResponse.from(decrypted);
    }

    public List<AppointmentResponse> findAll() {
        return repository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::decryptAppointment)
                .map(AppointmentResponse::from)
                .toList();
    }

    public AppointmentResponse findOne(UUID id) {
        Appointment appointment = findById(id);
        return AppointmentResponse.from(decryptAppointment(appointment));
    }

    public AppointmentResponse update(UUID id, UpdateAppointmentRequest request) {
        Appointment appointment = findById(id);
        Map<String, Object> changes = new HashMap<>();

        if (request.name() != null) {
            appointment.setName(encryptionService.encrypt(request.name()));
            changes.put("name", request.name());
        }
        if (request.email() != null) {
            appointment.setEmail(encryptionService.encrypt(request.email()));
            changes.put("email", request.email());
        }
        if (request.phone() != null) {
            appointment.setPhone(encryptionService.encrypt(request.phone()));
            changes.put("phone", request.phone());
        }
        if (request.description() != null) {
            appointment.setDescription(encryptionService.encrypt(request.description()));
            changes.put("description", request.description());
        }
        if (request.dateTime() != null) {
            appointment.setDateTime(parseDateTime(request.dateTime()));
            changes.put("date_time", request.dateTime());
        }
        if (request.status() != null) {
            appointment.setStatus(request.status());
            changes.put("status", request.status());
        }

        Appointment saved = repository.save(appointment);
        Appointment decrypted = decryptAppointment(saved);

        auditService.log("updated", id, changes);

        return AppointmentResponse.from(decrypted);
    }

    public void delete(UUID id) {
        Appointment appointment = findById(id);
        repository.delete(appointment);
        auditService.log("deleted", id, Map.of());
    }

    private Appointment findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
    }

    private Appointment decryptAppointment(Appointment encrypted) {
        Appointment decrypted = new Appointment();
        decrypted.setId(encrypted.getId());
        decrypted.setName(encryptionService.decrypt(encrypted.getName()));
        decrypted.setEmail(encryptionService.decrypt(encrypted.getEmail()));
        decrypted.setPhone(encryptionService.decrypt(encrypted.getPhone()));
        decrypted.setDescription(encryptionService.decrypt(encrypted.getDescription()));
        decrypted.setDateTime(encrypted.getDateTime());
        decrypted.setStatus(encrypted.getStatus());
        decrypted.setMetadata(encrypted.getMetadata());
        decrypted.setCreatedAt(encrypted.getCreatedAt());
        decrypted.setUpdatedAt(encrypted.getUpdatedAt());
        return decrypted;
    }

    private OffsetDateTime parseDateTime(String dateTime) {
        try {
            return OffsetDateTime.parse(dateTime);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid datetime format");
        }
    }
}
