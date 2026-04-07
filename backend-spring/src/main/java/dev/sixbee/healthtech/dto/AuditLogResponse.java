package dev.sixbee.healthtech.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    @JsonProperty("appointment_id") UUID appointmentId,
    @JsonProperty("admin_user_id") UUID adminUserId,
    String action,
    Map<String, Object> changes,
    @JsonProperty("ip_address") String ipAddress,
    @JsonProperty("user_agent") String userAgent,
    @JsonProperty("created_at") OffsetDateTime createdAt) {}
