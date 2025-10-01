import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { BackupType, BackupStatus } from '../common/enums';
import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupsService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
  ) {}

  async createBackup(serverId: string, name?: string, description?: string) {
    const server = await this.serversService.findOne(serverId);

    const backup = await this.prisma.backup.create({
      data: {
        serverId,
        name: name || `Backup ${new Date().toISOString()}`,
        description,
        type: BackupType.MANUAL,
        status: BackupStatus.PENDING,
        path: '', // Will be set after creation
      },
    });

    // Start backup process asynchronously
    this.performBackup(backup.id, server).catch(error => {
      console.error(`Backup failed for server ${serverId}:`, error);
      this.prisma.backup.update({
        where: { id: backup.id },
        data: { status: BackupStatus.FAILED },
      });
    });

    return backup;
  }

  async findAllByServer(serverId: string) {
    return this.prisma.backup.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    return backup;
  }

  async remove(id: string) {
    const backup = await this.findOne(id);

    // Remove backup file if exists
    if (backup.path && fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }

    return this.prisma.backup.delete({
      where: { id },
    });
  }

  async restore(id: string) {
    const backup = await this.findOne(id);

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new Error('Backup is not completed');
    }

    // TODO: Implement restore logic
    // 1. Stop server if running
    // 2. Extract backup to server directory
    // 3. Start server if it was running

    return { message: 'Restore initiated' };
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleScheduledBackups() {
    const servers = await this.prisma.server.findMany({
      where: { autoStart: true }, // Only backup auto-start servers
    });

    for (const server of servers) {
      try {
        await this.createBackup(
          server.id,
          `Scheduled backup ${new Date().toISOString().split('T')[0]}`,
          'Automatic daily backup',
        );
      } catch (error) {
        console.error(`Scheduled backup failed for server ${server.id}:`, error);
      }
    }

    // Clean up old backups
    await this.cleanupOldBackups();
  }

  private async performBackup(backupId: string, server: any) {
    // Update status to in progress
    await this.prisma.backup.update({
      where: { id: backupId },
      data: { status: BackupStatus.IN_PROGRESS },
    });

    const backupDir = '/app/data/backups';
    const backupFileName = `${server.name}-${Date.now()}.tar.gz`;
    const backupPath = path.join(backupDir, backupFileName);

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('tar', { gzip: true });

      output.on('close', async () => {
        const size = archive.pointer();

        await this.prisma.backup.update({
          where: { id: backupId },
          data: {
            status: BackupStatus.COMPLETED,
            path: backupPath,
            size,
            completedAt: new Date(),
          },
        });

        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);

      // Add server directory to archive
      const serverDataPath = server.storageType === 'VOLUME'
        ? `/var/lib/docker/volumes/${server.storagePath}/_data`
        : server.storagePath;

      if (fs.existsSync(serverDataPath)) {
        archive.directory(serverDataPath, false);
      }

      archive.finalize();
    });
  }

  private async cleanupOldBackups() {
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const oldBackups = await this.prisma.backup.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        type: BackupType.SCHEDULED,
      },
    });

    for (const backup of oldBackups) {
      try {
        await this.remove(backup.id);
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }
  }
}