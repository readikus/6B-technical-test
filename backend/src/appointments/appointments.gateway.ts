import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const COOKIE_NAME = 'admin_token';

function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
}

function parseAuthCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === COOKIE_NAME) {
      return rest.join('=');
    }
  }
  return undefined;
}

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
})
export class AppointmentsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AppointmentsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    // Verify the JWT cookie before allowing the connection.
    // Reject anonymous and forged connections immediately so that no
    // PII broadcasts ever reach unauthenticated clients.
    const cookieHeader = client.handshake.headers.cookie;
    const token = parseAuthCookie(cookieHeader);

    if (!token) {
      this.logger.warn(
        `WebSocket connection refused — no auth cookie (id=${client.id})`,
      );
      client.disconnect(true);
      return;
    }

    try {
      this.jwtService.verify(token);
    } catch {
      this.logger.warn(
        `WebSocket connection refused — invalid token (id=${client.id})`,
      );
      client.disconnect(true);
      return;
    }
  }

  @OnEvent('appointment.created')
  handleCreated(appointment: { id: string }): void {
    // Broadcast only a notification with the ID — never PII over the
    // WebSocket. The admin frontend re-fetches via the authenticated
    // REST endpoint to get the full appointment details. This ensures
    // that even if a connection somehow slips past authentication,
    // no patient data is leaked.
    this.server.emit('appointment.created', { id: appointment.id });
  }
}
