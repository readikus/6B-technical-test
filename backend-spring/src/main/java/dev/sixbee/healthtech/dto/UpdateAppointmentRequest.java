package dev.sixbee.healthtech.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateAppointmentRequest(
    @Pattern(regexp = "^(?!.*<[a-zA-Z][^>]*>).+$", message = "HTML tags are not allowed")
        String name,
    @Email(message = "Invalid email format") String email,
    @Size(min = 7, message = "Phone number too short")
        @Pattern(regexp = "^\\+?[\\d\\s\\-()]+$", message = "Invalid phone format")
        String phone,
    @Pattern(regexp = "^(?!.*<[a-zA-Z][^>]*>).+$", message = "HTML tags are not allowed")
        String description,
    @JsonProperty("date_time") String dateTime,
    @Pattern(
            regexp = "^(pending|confirmed|cancelled)$",
            message = "Status must be pending, confirmed, or cancelled")
        String status) {}
