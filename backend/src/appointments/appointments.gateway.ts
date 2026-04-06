import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { AppointmentRow } from './appointments.repository';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class AppointmentsGateway {
  @WebSocketServer()
  server!: Server;

  @OnEvent('appointment.created')
  handleCreated(appointment: AppointmentRow) {
    this.server.emit('appointment.created', appointment);
  }
}
