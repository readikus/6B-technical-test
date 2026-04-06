package dev.sixbee.healthtech.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateAppointmentRequest(
        @NotBlank(message = "Name is required")
        @Pattern(regexp = "^(?!.*<[a-zA-Z][^>]*>).*$", message = "HTML tags are not allowed")
        String name,

        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "Phone is required")
        @Size(min = 7, message = "Phone number too short")
        @Pattern(regexp = "^\\+?[\\d\\s\\-()]+$", message = "Invalid phone format")
        String phone,

        @NotBlank(message = "Description is required")
        @Pattern(regexp = "^(?!.*<[a-zA-Z][^>]*>).*$", message = "HTML tags are not allowed")
        String description,

        @NotBlank(message = "Date and time is required")
        @com.fasterxml.jackson.annotation.JsonProperty("date_time")
        String dateTime
) {}
