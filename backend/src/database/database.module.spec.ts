import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule, KNEX_TOKEN } from './database.module';
import { Knex } from 'knex';

describe('DatabaseModule', () => {
  it('provides a Knex instance that can query the database', async () => {
    // Arrange
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
    process.env.POSTGRES_DB = 'sixbee_health_test';

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    // Act
    const knex = module.get<Knex>(KNEX_TOKEN);
    const result = await knex.raw('SELECT 1 AS connected');

    // Assert
    expect(result.rows[0].connected).toBe(1);

    await knex.destroy();
  });
});
