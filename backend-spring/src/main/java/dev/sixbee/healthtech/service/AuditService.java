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

    /** Matches the VARCHAR(512) column in schema.sql. */
    private static final int MAX_USER_AGENT_LENGTH = 512;

    private final AuditLogRepository repository;
    private final EncryptionService encryptionService;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, EncryptionService encryptionService, ObjectMapper objectMapper) {
        this.repository = repository;
        this.encryptionService = encryptionService;
        this.objectMapper = objectMapper;
    }

    /**
     * Persist an audit log entry with full request context.
     *
     * @param action        one of "created", "updated", "deleted", "approved"
     * @param appointmentId UUID of the appointment; set to null on delete
     *                      so the row survives a CASCADE/SET NULL
     * @param changes       key/value map of field changes; encrypted at rest
     * @param context       admin id + IP + user agent from the request
     */
    public void log(String action, UUID appointmentId, Map<String, Object> changes, AuditContext context) {
        try {
            AuditLog entry = new AuditLog();
            entry.setAppointmentId("deleted".equals(action) ? null : appointmentId);
            entry.setAdminUserId(context.adminUserId());
            entry.setAction(action);
            entry.setChanges(encryptionService.encrypt(objectMapper.writeValueAsString(changes)));
            entry.setIpAddress(context.ipAddress());
            entry.setUserAgent(truncateUserAgent(context.userAgent()));
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
                entry.getIpAddress(),
                entry.getUserAgent(),
                entry.getCreatedAt()
        );
    }

    /**
     * Clamp the user agent to the column size. User agents in the
     * wild can be arbitrarily long — e.g. browser extensions
     * stacking their tokens on top. Truncating at 512 chars matches
     * the NestJS controller's {@code ua.slice(0, 512)} behaviour.
     */
    private String truncateUserAgent(String ua) {
        if (ua == null) return null;
        return ua.length() > MAX_USER_AGENT_LENGTH ? ua.substring(0, MAX_USER_AGENT_LENGTH) : ua;
    }
}
