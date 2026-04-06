import { Module, Global } from '@nestjs/common';
import Knex from 'knex';

export const KNEX_TOKEN = 'KNEX_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: KNEX_TOKEN,
      useFactory: () => {
        return Knex({
          client: 'pg',
          connection: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: Number(process.env.POSTGRES_PORT) || 5432,
            user: process.env.POSTGRES_USER || 'sixbee',
            password: process.env.POSTGRES_PASSWORD || 'changeme',
            database: process.env.POSTGRES_DB || 'sixbee_health',
          },
        });
      },
    },
  ],
  exports: [KNEX_TOKEN],
})
export class DatabaseModule {}
