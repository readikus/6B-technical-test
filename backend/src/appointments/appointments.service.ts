import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EncryptionService } from '../encryption/encryption.service';
import { AppointmentEvent, APPOINTMENT_AUDIT } from '../audit/audit.events';
import {
  AppointmentsRepository,
  AppointmentRow,
} from './appointments.repository';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './appointments.validation';

const PII_FIELDS = ['name', 'email', 'phone', 'description'] as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly repo: AppointmentsRepository,
    private readonly encryption: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateAppointmentDto): Promise<AppointmentRow> {
    const data: Record<string, unknown> = { ...dto };
    for (const field of PII_FIELDS) {
      data[field] = this.encryption.encrypt(dto[field]);
    }

    const row = await this.repo.insert(data);
    const decrypted = this.decryptRow(row);

    this.eventEmitter.emit(
      APPOINTMENT_AUDIT,
      new AppointmentEvent('created', row.id, dto),
    );
    this.eventEmitter.emit('appointment.created', decrypted);

    return decrypted;
  }

  async findAll(): Promise<AppointmentRow[]> {
    const rows = await this.repo.findAll();
    return rows.map((row) => this.decryptRow(row));
  }

  async findOne(id: string): Promise<AppointmentRow> {
    const row = await this.repo.findById(id);
    return this.decryptRow(row);
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    adminUserId?: string,
  ): Promise<AppointmentRow> {
    const existing = await this.repo.findById(id);
    const decryptedExisting = this.decryptRow(existing);

    const data: Record<string, unknown> = { ...dto };
    for (const field of PII_FIELDS) {
      if (data[field] !== undefined) {
        data[field] = this.encryption.encrypt(data[field] as string);
      }
    }

    const row = await this.repo.update(id, data);
    const decrypted = this.decryptRow(row);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(dto) as (keyof UpdateAppointmentDto)[]) {
      const oldVal = decryptedExisting[key as keyof AppointmentRow];
      const newVal = dto[key];
      if (oldVal !== newVal) {
        changes[key] = { from: oldVal, to: newVal };
      }
    }

    if (Object.keys(changes).length > 0) {
      const action =
        dto.status && dto.status !== decryptedExisting.status
          ? ('approved' as const)
          : ('updated' as const);
      this.eventEmitter.emit(
        APPOINTMENT_AUDIT,
        new AppointmentEvent(action, id, changes, adminUserId),
      );
    }

    return decrypted;
  }

  async remove(id: string, adminUserId?: string): Promise<void> {
    await this.repo.remove(id);

    this.eventEmitter.emit(
      APPOINTMENT_AUDIT,
      new AppointmentEvent('deleted', id, {}, adminUserId),
    );
  }

  private decryptRow(row: AppointmentRow): AppointmentRow {
    const decrypted = { ...row };
    for (const field of PII_FIELDS) {
      decrypted[field] = this.encryption.decrypt(row[field]);
    }
    return decrypted;
  }
}
