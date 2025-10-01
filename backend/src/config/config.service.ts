import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().default('file:./dev.db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  JWT_SECRET: z.string().default('dev-secret'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  BACKEND_PORT: z.string().default('3001').transform(Number),
  MINECRAFT_DATA_PATH: z.string().default('/data/minecraft'),
  BACKUP_RETENTION_DAYS: z.string().default('7').transform(Number),
  BACKUP_CRON: z.string().default('0 4 * * *'),
  DEFAULT_JAVA_OPTS: z.string().default('-Xmx4G -Xms1G -XX:+UseG1GC'),
});

export type Config = z.infer<typeof configSchema>;

@Injectable()
export class ConfigService {
  private readonly config: Config;

  constructor() {
    this.config = configSchema.parse(process.env);
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  get all(): Config {
    return this.config;
  }
}