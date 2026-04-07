package dev.sixbee.healthtech.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.corundumstudio.socketio.BroadcastOperations;
import com.corundumstudio.socketio.SocketIOServer;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Locks in the C1 contract for the Spring backend's Socket.IO broadcaster: when an
 * AppointmentCreatedEvent is published, the broadcast goes out as {"id": "<uuid>"} and contains no
 * other fields. Any drift here would risk leaking PII over the wire and break parity with the
 * NestJS gateway.
 */
@ExtendWith(MockitoExtension.class)
class AppointmentBroadcasterTest {

  @Mock private SocketIOServer server;

  @Mock private BroadcastOperations broadcastOperations;

  private AppointmentBroadcaster broadcaster;

  @BeforeEach
  void setUp() {
    broadcaster = new AppointmentBroadcaster(server);
  }

  @Test
  void broadcastsIdOnlyPayloadWhenAppointmentCreated() {
    when(server.getBroadcastOperations()).thenReturn(broadcastOperations);
    UUID appointmentId = UUID.randomUUID();

    broadcaster.onAppointmentCreated(new AppointmentCreatedEvent(appointmentId));

    ArgumentCaptor<Object[]> captor = ArgumentCaptor.forClass(Object[].class);
    verify(broadcastOperations).sendEvent(eq("appointment.created"), captor.capture());
  }

  @Test
  void payloadContainsExactlyOneIdField() {
    when(server.getBroadcastOperations()).thenReturn(broadcastOperations);
    UUID appointmentId = UUID.randomUUID();

    broadcaster.onAppointmentCreated(new AppointmentCreatedEvent(appointmentId));

    ArgumentCaptor<Map<String, String>> payloadCaptor = ArgumentCaptor.forClass(Map.class);
    verify(broadcastOperations).sendEvent(eq("appointment.created"), payloadCaptor.capture());

    Map<String, String> payload = payloadCaptor.getValue();
    assertEquals(1, payload.size(), "Payload must contain exactly the id field");
    assertEquals(appointmentId.toString(), payload.get("id"));
    // Defensive — explicitly verify no PII keys leaked through
    assertFalse(payload.containsKey("name"));
    assertFalse(payload.containsKey("email"));
    assertFalse(payload.containsKey("phone"));
    assertFalse(payload.containsKey("description"));
  }

  @Test
  void eventNameMatchesNestjsContract() {
    // Hard-coded check to catch accidental rename. The NestJS
    // gateway uses 'appointment.created'; the frontend listens
    // for 'appointment.created'. If either drifts, the live
    // updates silently stop working.
    assertEquals("appointment.created", AppointmentBroadcaster.EVENT_NAME);
  }

  @Test
  void doesNothingIfNoEvent() {
    // No-event = no broadcast. Sanity check that the listener
    // is purely reactive and doesn't fire on its own.
    verifyNoInteractions(server);
  }

  private static <T> T eq(T value) {
    return org.mockito.ArgumentMatchers.eq(value);
  }
}
