import { Module, Global } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [
    {
      provide: EncryptionService,
      useFactory: () => {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
          throw new Error('ENCRYPTION_KEY environment variable is required');
        }
        return new EncryptionService(key);
      },
    },
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
