package dev.sixbee.healthtech.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import dev.sixbee.healthtech.entity.Appointment;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppointmentResponse(
    UUID id,
    String name,
    String email,
    String phone,
    String description,
    @JsonProperty("date_time") OffsetDateTime dateTime,
    String status,
    String metadata,
    @JsonProperty("created_at") OffsetDateTime createdAt,
    @JsonProperty("updated_at") OffsetDateTime updatedAt) {
  public static AppointmentResponse from(Appointment a) {
    return new AppointmentResponse(
        a.getId(),
        a.getName(),
        a.getEmail(),
        a.getPhone(),
        a.getDescription(),
        a.getDateTime(),
        a.getStatus(),
        a.getMetadata(),
        a.getCreatedAt(),
        a.getUpdatedAt());
  }
}
