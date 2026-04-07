package dev.sixbee.healthtech.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.sixbee.healthtech.dto.AppointmentResponse;
import dev.sixbee.healthtech.dto.CreateAppointmentRequest;
import dev.sixbee.healthtech.dto.UpdateAppointmentRequest;
import dev.sixbee.healthtech.entity.Appointment;
import dev.sixbee.healthtech.repository.AppointmentRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceTest {

  private static final AuditContext ANON_CONTEXT =
      AuditContext.anonymous("10.0.0.1", "Mozilla/5.0");
  private static final AuditContext ADMIN_CONTEXT =
      new AuditContext(UUID.randomUUID(), "10.0.0.2", "curl/8.0");

  @Mock private AppointmentRepository repository;

  @Mock private AuditService auditService;

  @Mock private ApplicationEventPublisher eventPublisher;

  private EncryptionService encryptionService;
  private AppointmentService service;

  @BeforeEach
  void setUp() {
    encryptionService =
        new EncryptionService("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2");
    service = new AppointmentService(repository, encryptionService, auditService, eventPublisher);
  }

  @Test
  void createEncryptsPiiFieldsAndReturnsDecrypted() {
    CreateAppointmentRequest request =
        new CreateAppointmentRequest(
            "John Doe", "john@test.com", "+447700900000", "Checkup", "2026-12-15T10:00:00Z");

    when(repository.save(any(Appointment.class)))
        .thenAnswer(
            invocation -> {
              Appointment a = invocation.getArgument(0);
              a.setId(UUID.randomUUID());
              a.setCreatedAt(OffsetDateTime.now());
              a.setUpdatedAt(OffsetDateTime.now());
              return a;
            });

    AppointmentResponse response = service.create(request, ANON_CONTEXT);

    assertNotNull(response.id());
    assertEquals("John Doe", response.name());
    assertEquals("john@test.com", response.email());
    assertEquals("+447700900000", response.phone());
    assertEquals("Checkup", response.description());
    assertEquals("pending", response.status());

    // Verify the saved entity has encrypted PII
    ArgumentCaptor<Appointment> captor = ArgumentCaptor.forClass(Appointment.class);
    verify(repository).save(captor.capture());
    Appointment saved = captor.getValue();
    assertNotNull(saved.getName());
    assertEquals("John Doe", encryptionService.decrypt(saved.getName()));
  }

  @Test
  void createPropagatesAuditContextToAuditService() {
    CreateAppointmentRequest request =
        new CreateAppointmentRequest(
            "Jane", "jane@test.com", "+447700900001", "Checkup", "2026-12-15T10:00:00Z");
    when(repository.save(any(Appointment.class)))
        .thenAnswer(
            i -> {
              Appointment a = i.getArgument(0);
              a.setId(UUID.randomUUID());
              a.setCreatedAt(OffsetDateTime.now());
              a.setUpdatedAt(OffsetDateTime.now());
              return a;
            });

    service.create(request, ANON_CONTEXT);

    // The service must pass the exact context through — no
    // swallowing, no wrapping, no defaulting.
    verify(auditService).log(eq("created"), any(), any(), eq(ANON_CONTEXT));
  }

  @Test
  void createPublishesAppointmentCreatedEventWithSavedId() {
    CreateAppointmentRequest request =
        new CreateAppointmentRequest(
            "Jane", "jane@test.com", "+447700900001", "Checkup", "2026-12-15T10:00:00Z");
    UUID savedId = UUID.randomUUID();
    when(repository.save(any(Appointment.class)))
        .thenAnswer(
            i -> {
              Appointment a = i.getArgument(0);
              a.setId(savedId);
              a.setCreatedAt(OffsetDateTime.now());
              a.setUpdatedAt(OffsetDateTime.now());
              return a;
            });

    service.create(request, ANON_CONTEXT);

    // The Socket.IO broadcaster listens for AppointmentCreatedEvent.
    // The event payload must carry the *saved* DB id (not a new
    // random one) so the frontend can re-fetch the right row.
    ArgumentCaptor<AppointmentCreatedEvent> captor =
        ArgumentCaptor.forClass(AppointmentCreatedEvent.class);
    verify(eventPublisher).publishEvent(captor.capture());
    assertEquals(savedId, captor.getValue().id());
  }

  @Test
  void findAllReturnsDecryptedAppointments() {
    Appointment encrypted = new Appointment();
    encrypted.setId(UUID.randomUUID());
    encrypted.setName(encryptionService.encrypt("Alice"));
    encrypted.setEmail(encryptionService.encrypt("alice@test.com"));
    encrypted.setPhone(encryptionService.encrypt("+447700900002"));
    encrypted.setDescription(encryptionService.encrypt("Annual checkup"));
    encrypted.setDateTime(OffsetDateTime.now());
    encrypted.setStatus("pending");
    encrypted.setMetadata("{}");
    encrypted.setCreatedAt(OffsetDateTime.now());
    encrypted.setUpdatedAt(OffsetDateTime.now());

    when(repository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(encrypted));

    List<AppointmentResponse> result = service.findAll();

    assertEquals(1, result.size());
    assertEquals("Alice", result.get(0).name());
    assertEquals("alice@test.com", result.get(0).email());
  }

  @Test
  void findOneReturnsDecryptedAppointment() {
    UUID id = UUID.randomUUID();
    Appointment encrypted = new Appointment();
    encrypted.setId(id);
    encrypted.setName(encryptionService.encrypt("Bob"));
    encrypted.setEmail(encryptionService.encrypt("bob@test.com"));
    encrypted.setPhone(encryptionService.encrypt("+447700900003"));
    encrypted.setDescription(encryptionService.encrypt("Consultation"));
    encrypted.setDateTime(OffsetDateTime.now());
    encrypted.setStatus("pending");
    encrypted.setMetadata("{}");
    encrypted.setCreatedAt(OffsetDateTime.now());
    encrypted.setUpdatedAt(OffsetDateTime.now());

    when(repository.findById(id)).thenReturn(Optional.of(encrypted));

    AppointmentResponse result = service.findOne(id);
    assertEquals("Bob", result.name());
  }

  @Test
  void findOneThrows404WhenNotFound() {
    UUID id = UUID.randomUUID();
    when(repository.findById(id)).thenReturn(Optional.empty());

    assertThrows(ResponseStatusException.class, () -> service.findOne(id));
  }

  @Test
  void updateModifiesOnlyProvidedFields() {
    UUID id = UUID.randomUUID();
    Appointment existing = new Appointment();
    existing.setId(id);
    existing.setName(encryptionService.encrypt("Original"));
    existing.setEmail(encryptionService.encrypt("orig@test.com"));
    existing.setPhone(encryptionService.encrypt("+447700900004"));
    existing.setDescription(encryptionService.encrypt("Original desc"));
    existing.setDateTime(OffsetDateTime.now());
    existing.setStatus("pending");
    existing.setMetadata("{}");
    existing.setCreatedAt(OffsetDateTime.now());
    existing.setUpdatedAt(OffsetDateTime.now());

    when(repository.findById(id)).thenReturn(Optional.of(existing));
    when(repository.save(any(Appointment.class))).thenAnswer(i -> i.getArgument(0));

    UpdateAppointmentRequest request =
        new UpdateAppointmentRequest("Updated Name", null, null, null, null, "confirmed");

    AppointmentResponse result = service.update(id, request, ADMIN_CONTEXT);

    assertEquals("Updated Name", result.name());
    assertEquals("confirmed", result.status());
    // Untouched fields should still decrypt correctly
    assertEquals("orig@test.com", result.email());
  }

  @Test
  void updatePropagatesAdminContextToAuditService() {
    UUID id = UUID.randomUUID();
    Appointment existing = freshEncryptedAppointment(id);
    when(repository.findById(id)).thenReturn(Optional.of(existing));
    when(repository.save(any(Appointment.class))).thenAnswer(i -> i.getArgument(0));

    UpdateAppointmentRequest request =
        new UpdateAppointmentRequest("Updated", null, null, null, null, null);
    service.update(id, request, ADMIN_CONTEXT);

    ArgumentCaptor<AuditContext> captor = ArgumentCaptor.forClass(AuditContext.class);
    verify(auditService).log(eq("updated"), eq(id), any(), captor.capture());
    assertEquals(ADMIN_CONTEXT, captor.getValue());
    assertEquals("10.0.0.2", captor.getValue().ipAddress());
    assertEquals("curl/8.0", captor.getValue().userAgent());
    assertNotNull(captor.getValue().adminUserId());
  }

  @Test
  void deleteRemovesAppointmentAndLogsAuditWithContext() {
    UUID id = UUID.randomUUID();
    Appointment appointment = new Appointment();
    appointment.setId(id);

    when(repository.findById(id)).thenReturn(Optional.of(appointment));

    service.delete(id, ADMIN_CONTEXT);

    verify(repository).delete(appointment);
    verify(auditService).log(eq("deleted"), eq(id), eq(Map.of()), eq(ADMIN_CONTEXT));
  }

  @Test
  void deleteThrows404WhenNotFound() {
    UUID id = UUID.randomUUID();
    when(repository.findById(id)).thenReturn(Optional.empty());

    assertThrows(ResponseStatusException.class, () -> service.delete(id, ADMIN_CONTEXT));
  }

  private Appointment freshEncryptedAppointment(UUID id) {
    Appointment a = new Appointment();
    a.setId(id);
    a.setName(encryptionService.encrypt("Original"));
    a.setEmail(encryptionService.encrypt("orig@test.com"));
    a.setPhone(encryptionService.encrypt("+447700900004"));
    a.setDescription(encryptionService.encrypt("Original desc"));
    a.setDateTime(OffsetDateTime.now());
    a.setStatus("pending");
    a.setMetadata("{}");
    a.setCreatedAt(OffsetDateTime.now());
    a.setUpdatedAt(OffsetDateTime.now());
    return a;
  }
}
