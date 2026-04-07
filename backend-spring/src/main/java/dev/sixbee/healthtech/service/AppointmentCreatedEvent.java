package dev.sixbee.healthtech.service;

import java.util.UUID;

/**
 * Application event published when a new appointment is persisted.
 * Carries only the {@code id} so the event payload — and any
 * downstream broadcast — never contains PII. The admin frontend
 * re-fetches the full appointment via the authenticated REST
 * endpoint after receiving the broadcast.
 *
 * <p>Mirrors the NestJS gateway's "broadcast id only" contract
 * (C1 fix in the security audit).
 */
public record AppointmentCreatedEvent(UUID id) {}
