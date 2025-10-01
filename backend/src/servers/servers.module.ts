import { Module } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ServersGateway } from './servers.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [PrismaModule, AgentsModule],
  controllers: [ServersController],
  providers: [ServersService, ServersGateway],
  exports: [ServersService],
})
export class ServersModule {}