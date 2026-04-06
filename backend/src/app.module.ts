import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EncryptionModule } from './encryption/encryption.module';

@Module({
  imports: [EncryptionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
