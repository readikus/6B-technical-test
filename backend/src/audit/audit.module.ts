import { Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditListener } from './audit.listener';

@Module({
  providers: [AuditRepository, AuditService, AuditListener],
  exports: [AuditService],
})
export class AuditModule {}
