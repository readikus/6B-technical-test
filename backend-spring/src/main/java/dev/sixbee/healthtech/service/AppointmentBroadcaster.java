package dev.sixbee.healthtech.service;

import com.corundumstudio.socketio.SocketIOServer;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Bridges Spring's in-process {@link AppointmentCreatedEvent} into a Socket.IO broadcast for any
 * connected admin clients. Mirrors the NestJS gateway's @OnEvent('appointment.created') handler:
 * the broadcast payload is deliberately limited to {@code {id: ...}}, never the full appointment.
 *
 * <p>Why ID-only? Two reasons (C1 in the security audit):
 *
 * <ol>
 *   <li>Defence in depth — even if a connection somehow slips past the cookie auth, no PII is
 *       leaked over the wire.
 *   <li>Single source of truth — the admin frontend re-fetches via the authenticated REST endpoint,
 *       which goes through the same encryption + decrypt path as a normal page load.
 * </ol>
 */
@Component
public class AppointmentBroadcaster {

  private static final Logger log = LoggerFactory.getLogger(AppointmentBroadcaster.class);

  /** Event name on the wire — must match the NestJS gateway and the frontend listener. */
  static final String EVENT_NAME = "appointment.created";

  private final SocketIOServer server;

  public AppointmentBroadcaster(SocketIOServer server) {
    this.server = server;
  }

  @EventListener
  public void onAppointmentCreated(AppointmentCreatedEvent event) {
    Map<String, String> payload = Map.of("id", event.id().toString());
    server.getBroadcastOperations().sendEvent(EVENT_NAME, payload);
    log.debug("Broadcast appointment.created (id={})", event.id());
  }
}
