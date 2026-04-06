import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_TOKEN } from '../database/database.module';

export interface AppointmentRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  date_time: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AppointmentsRepository {
  constructor(@Inject(KNEX_TOKEN) private readonly db: Knex) {}

  async insert(data: Record<string, unknown>): Promise<AppointmentRow> {
    const [row] = await this.db<AppointmentRow>('appointments')
      .insert(data)
      .returning('*');
    return row;
  }

  async findAll(): Promise<AppointmentRow[]> {
    return this.db<AppointmentRow>('appointments')
      .select('*')
      .orderBy('created_at', 'desc');
  }

  async findById(id: string): Promise<AppointmentRow> {
    const row = await this.db<AppointmentRow>('appointments')
      .where('id', id)
      .first();
    if (!row) throw new NotFoundException('Appointment not found');
    return row;
  }

  async update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<AppointmentRow> {
    await this.findById(id);

    const [row] = await this.db<AppointmentRow>('appointments')
      .where('id', id)
      .update({ ...data, updated_at: this.db.fn.now() })
      .returning('*');
    return row;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db('appointments').where('id', id).del();
    if (deleted === 0) throw new NotFoundException('Appointment not found');
  }
}
