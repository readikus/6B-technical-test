import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_TOKEN } from '../database/database.module';

export interface AuditRow {
  id: string;
  appointment_id: string | null;
  admin_user_id: string | null;
  action: string;
  changes: string;
  created_at: string;
}

@Injectable()
export class AuditRepository {
  constructor(@Inject(KNEX_TOKEN) private readonly db: Knex) {}

  async insert(data: {
    appointment_id: string | null;
    action: string;
    changes: string;
    admin_user_id?: string | null;
  }): Promise<AuditRow> {
    const [row] = await this.db<AuditRow>('audit_log')
      .insert(data)
      .returning('*');
    return row;
  }

  async findAll(): Promise<AuditRow[]> {
    return this.db<AuditRow>('audit_log')
      .select('*')
      .orderBy('created_at', 'desc');
  }

  async findByAppointmentId(appointmentId: string): Promise<AuditRow[]> {
    return this.db<AuditRow>('audit_log')
      .where('appointment_id', appointmentId)
      .select('*')
      .orderBy('created_at', 'desc');
  }
}
