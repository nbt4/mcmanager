import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServersModule } from './servers/servers.module';
import { AgentsModule } from './agents/agents.module';
import { BackupsModule } from './backups/backups.module';
import { ModpacksModule } from './modpacks/modpacks.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '24h' },
    }),
    ServersModule,
    AgentsModule,
    BackupsModule,
    ModpacksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}