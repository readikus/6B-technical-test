import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [
    {
      provide: EncryptionService,
      useFactory: () => {
        const key =
          process.env.ENCRYPTION_KEY ||
          'dev-encryption-key-32bytes00000'.padEnd(64, '0');
        return new EncryptionService(key);
      },
    },
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
