import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/drizzle.module';

export type HealthReport = {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checks: {
    database: 'ok' | 'down';
  };
};

@Injectable()
export class HealthService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private readonly pingDatabase = async (): Promise<'ok' | 'down'> => {
    try {
      await this.db.execute(sql`SELECT 1`);
      return 'ok';
    } catch {
      return 'down';
    }
  };

  readonly check = async (): Promise<HealthReport> => {
    const database = await this.pingDatabase();

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
  };
}
