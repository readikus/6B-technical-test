package dev.sixbee.healthtech.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sixbee.healthtech.dto.AuditLogResponse;
import dev.sixbee.healthtech.entity.AuditLog;
import dev.sixbee.healthtech.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository repository;
    private final EncryptionService encryptionService;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, EncryptionService encryptionService, ObjectMapper objectMapper) {
        this.repository = repository;
        this.encryptionService = encryptionService;
        this.objectMapper = objectMapper;
    }

    public void log(String action, UUID appointmentId, Map<String, Object> changes) {
        try {
            AuditLog entry = new AuditLog();
            entry.setAppointmentId("deleted".equals(action) ? null : appointmentId);
            entry.setAction(action);
            entry.setChanges(encryptionService.encrypt(objectMapper.writeValueAsString(changes)));
            repository.save(entry);
        } catch (Exception e) {
            log.error("Failed to create audit log entry", e);
        }
    }

    public List<AuditLogResponse> findByAppointmentId(UUID appointmentId) {
        return repository.findByAppointmentIdOrderByCreatedAtDesc(appointmentId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private AuditLogResponse toResponse(AuditLog entry) {
        Map<String, Object> changes;
        try {
            String decrypted = encryptionService.decrypt(entry.getChanges());
            changes = objectMapper.readValue(decrypted, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to decrypt audit record {}", entry.getId(), e);
            changes = Collections.emptyMap();
        }
        return new AuditLogResponse(
                entry.getId(),
                entry.getAppointmentId(),
                entry.getAdminUserId(),
                entry.getAction(),
                changes,
                entry.getCreatedAt()
        );
    }
}
