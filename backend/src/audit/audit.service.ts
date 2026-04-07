import { Injectable, Logger } from '@nestjs/common';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditRepository, AuditRow } from './audit.repository';
import { AuditContext } from './audit.events';

export interface DecryptedAuditRecord {
  id: string;
  appointment_id: string | null;
  admin_user_id: string | null;
  action: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly repo: AuditRepository,
    private readonly encryption: EncryptionService,
  ) {}

  async log(
    action: string,
    appointmentId: string,
    changes: Record<string, unknown>,
    context: AuditContext = {},
  ): Promise<void> {
    await this.repo.insert({
      appointment_id: action === 'deleted' ? null : appointmentId,
      admin_user_id: context.adminUserId ?? null,
      action,
      changes: this.encryption.encrypt(JSON.stringify(changes)),
      ip_address: context.ipAddress ?? null,
      user_agent: context.userAgent ?? null,
    });
  }

  async findAll(): Promise<DecryptedAuditRecord[]> {
    const rows = await this.repo.findAll();
    return rows.map((row) => this.decryptRow(row));
  }

  async findByAppointmentId(
    appointmentId: string,
  ): Promise<DecryptedAuditRecord[]> {
    const rows = await this.repo.findByAppointmentId(appointmentId);
    return rows.map((row) => this.decryptRow(row));
  }

  private decryptRow(row: AuditRow): DecryptedAuditRecord {
    let changes: Record<string, unknown> = {};
    try {
      changes = JSON.parse(this.encryption.decrypt(row.changes)) as Record<
        string,
        unknown
      >;
    } catch (err) {
      this.logger.error(
        `Failed to decrypt audit record ${row.id}`,
        err instanceof Error ? err.stack : err,
      );
    }
    return { ...row, changes };
  }
}
