package dev.sixbee.healthtech.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.sixbee.healthtech.dto.AuditLogResponse;
import dev.sixbee.healthtech.entity.AuditLog;
import dev.sixbee.healthtech.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    private static final String KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

    @Mock
    private AuditLogRepository repository;

    private AuditService service;
    private EncryptionService encryptionService;

    @BeforeEach
    void setUp() {
        encryptionService = new EncryptionService(KEY);
        service = new AuditService(repository, encryptionService, new ObjectMapper());
    }

    @Test
    void logPersistsEncryptedChangesAndContext() {
        UUID adminId = UUID.randomUUID();
        UUID appointmentId = UUID.randomUUID();
        AuditContext context = new AuditContext(adminId, "203.0.113.7", "Mozilla/5.0 (X11; Linux)");

        service.log("updated", appointmentId, Map.of("status", "confirmed"), context);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog saved = captor.getValue();

        assertEquals("updated", saved.getAction());
        assertEquals(appointmentId, saved.getAppointmentId());
        assertEquals(adminId, saved.getAdminUserId());
        assertEquals("203.0.113.7", saved.getIpAddress());
        assertEquals("Mozilla/5.0 (X11; Linux)", saved.getUserAgent());

        // Changes are encrypted at rest — raw JSON should not appear
        assertNotEquals("{\"status\":\"confirmed\"}", saved.getChanges());
        // Round-trip through the service encryption key
        String decrypted = encryptionService.decrypt(saved.getChanges());
        assertEquals("{\"status\":\"confirmed\"}", decrypted);
    }

    @Test
    void logAcceptsNullAdminIdForAnonymousCreate() {
        UUID appointmentId = UUID.randomUUID();
        AuditContext context = AuditContext.anonymous("198.51.100.5", "curl/8.6");

        service.log("created", appointmentId, Map.of("name", "Alice"), context);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog saved = captor.getValue();

        // Null admin is legitimate for the public booking endpoint
        assertNull(saved.getAdminUserId());
        assertEquals("198.51.100.5", saved.getIpAddress());
        assertEquals("curl/8.6", saved.getUserAgent());
    }

    @Test
    void logNullsAppointmentIdOnDeleteSoRowSurvivesCascade() {
        UUID appointmentId = UUID.randomUUID();
        service.log("deleted", appointmentId, Map.of(), AuditContext.EMPTY);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        // appointment_id must be null so the audit row is not
        // cascaded away when the appointment row is removed
        assertNull(captor.getValue().getAppointmentId());
    }

    @Test
    void logTruncatesUserAgentToFiveHundredTwelveChars() {
        String longUa = "a".repeat(1000);
        AuditContext context = new AuditContext(null, "10.0.0.1", longUa);

        service.log("created", UUID.randomUUID(), Map.of(), context);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertEquals(512, captor.getValue().getUserAgent().length());
    }

    @Test
    void logHandlesNullUserAgentGracefully() {
        AuditContext context = new AuditContext(UUID.randomUUID(), "10.0.0.1", null);

        service.log("updated", UUID.randomUUID(), Map.of(), context);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        assertNull(captor.getValue().getUserAgent());
    }

    @Test
    void logUsesEmptyContextWhenNoInformationAvailable() {
        service.log("created", UUID.randomUUID(), Map.of(), AuditContext.EMPTY);

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog saved = captor.getValue();
        assertNull(saved.getAdminUserId());
        assertNull(saved.getIpAddress());
        assertNull(saved.getUserAgent());
    }

    @Test
    void findByAppointmentIdDecryptsChangesAndIncludesIpAndUa() {
        AuditLog entry = new AuditLog();
        entry.setId(UUID.randomUUID());
        entry.setAppointmentId(UUID.randomUUID());
        entry.setAdminUserId(UUID.randomUUID());
        entry.setAction("updated");
        entry.setChanges(encryptionService.encrypt("{\"status\":\"confirmed\"}"));
        entry.setIpAddress("192.0.2.10");
        entry.setUserAgent("test-agent");
        entry.setCreatedAt(OffsetDateTime.now());

        when(repository.findByAppointmentIdOrderByCreatedAtDesc(entry.getAppointmentId()))
                .thenReturn(List.of(entry));

        List<AuditLogResponse> responses = service.findByAppointmentId(entry.getAppointmentId());
        assertEquals(1, responses.size());
        AuditLogResponse response = responses.get(0);
        assertEquals("updated", response.action());
        assertEquals("192.0.2.10", response.ipAddress());
        assertEquals("test-agent", response.userAgent());
        assertEquals("confirmed", response.changes().get("status"));
    }
}
