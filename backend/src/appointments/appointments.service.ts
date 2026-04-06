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

  async update(id: string, dto: UpdateAppointmentDto): Promise<AppointmentRow> {
    const data: Record<string, unknown> = { ...dto };
    for (const field of PII_FIELDS) {
      if (data[field] !== undefined) {
        data[field] = this.encryption.encrypt(data[field] as string);
      }
    }

    const row = await this.repo.update(id, data);
    const decrypted = this.decryptRow(row);

    this.eventEmitter.emit(
      APPOINTMENT_AUDIT,
      new AppointmentEvent('updated', id, dto),
    );

    return decrypted;
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(id);

    this.eventEmitter.emit(
      APPOINTMENT_AUDIT,
      new AppointmentEvent('deleted', id, {}),
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
