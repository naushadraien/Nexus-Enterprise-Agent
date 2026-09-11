import { Module, Logger, Global } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DB_CONNECTION } from './db-connection';
import * as schema from './schema';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DB_CONNECTION,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const pool = new Pool({
          connectionString: configService.getOrThrow('DATABASE_URL'),
        });
        const logger = new Logger('DbModule');

        try {
          const client = await pool.connect();
          logger.log('🚀 Database connected successfully');
          client.release();
        } catch (error) {
          logger.error('❌ Database connection failed', error);
          throw error;
        }

        return drizzle(pool, {
          schema,
        });
      },
    },
  ],
  exports: [DB_CONNECTION],
})
export class DbModule {}
