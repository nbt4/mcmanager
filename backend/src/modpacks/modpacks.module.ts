import { Module } from '@nestjs/common';
import { ModpacksController } from './modpacks.controller';
import { ModpacksService } from './modpacks.service';
import { CurseForgeService } from './curseforge.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModpacksController],
  providers: [ModpacksService, CurseForgeService],
  exports: [ModpacksService],
})
export class ModpacksModule {}
