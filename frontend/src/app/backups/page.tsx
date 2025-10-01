'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Trash2, RotateCcw, Plus, Archive } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useServers } from '@/hooks/useServers';
import { useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup } from '@/hooks/useBackups';

export default function BackupsPage() {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const { data: servers } = useServers();
  const { data: backups } = useBackups(selectedServer);
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const restoreBackup = useRestoreBackup();

  const handleCreateBackup = async () => {
    if (!selectedServer) return;

    const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try {
      await createBackup.mutateAsync({
        serverId: selectedServer,
        name,
      });
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  const handleDeleteBackup = async (backupId: string, backupName: string) => {
    if (!confirm(`Are you sure you want to delete backup "${backupName}"?`)) {
      return;
    }

    try {
      await deleteBackup.mutateAsync(backupId);
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const handleRestoreBackup = async (backupId: string, backupName: string) => {
    if (!confirm(`Are you sure you want to restore backup "${backupName}"? This will overwrite current server data.`)) {
      return;
    }

    try {
      await restoreBackup.mutateAsync(backupId);
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'warning';
      case 'FAILED':
        return 'error';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold">Backups</h1>
          <p className="text-muted-foreground mt-2">
            Manage server backups and restore points
          </p>
        </motion.div>

        <div className="grid gap-6">
          {/* Server Selection & Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Server Backups</CardTitle>
                  <CardDescription>
                    {selectedServer ? 'Create and manage backups' : 'Select a server to view backups'}
                  </CardDescription>
                </div>
                {selectedServer && (
                  <Button
                    onClick={handleCreateBackup}
                    disabled={createBackup.isPending}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createBackup.isPending ? 'Creating...' : 'Create Backup'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select server..." />
                </SelectTrigger>
                <SelectContent>
                  {servers?.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Backups List */}
          {selectedServer && (
            <Card>
              <CardHeader>
                <CardTitle>Available Backups</CardTitle>
                <CardDescription>
                  {backups && backups.length > 0
                    ? `${backups.length} backup${backups.length > 1 ? 's' : ''} available`
                    : 'No backups found'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!backups || backups.length === 0 ? (
                  <div className="text-center py-12">
                    <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No backups yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first backup to secure your server data
                    </p>
                    <Button onClick={handleCreateBackup} disabled={createBackup.isPending}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Backup
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {backups.map((backup) => (
                      <motion.div
                        key={backup.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Archive className="h-4 w-4 text-primary" />
                            <h3 className="font-medium">{backup.name}</h3>
                            <Badge variant={getStatusColor(backup.status) as any}>
                              {backup.status}
                            </Badge>
                            <Badge variant="outline">{backup.type}</Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>
                              Created: {new Date(backup.createdAt).toLocaleString()}
                            </span>
                            {backup.size && (
                              <span>Size: {formatFileSize(backup.size)}</span>
                            )}
                            {backup.path && (
                              <span className="font-mono text-xs">{backup.path}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreBackup(backup.id, backup.name)}
                            disabled={
                              backup.status !== 'COMPLETED' ||
                              restoreBackup.isPending
                            }
                          >
                            <RotateCcw className="mr-2 h-3 w-3" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={backup.status === 'IN_PROGRESS'}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteBackup(backup.id, backup.name)}
                            disabled={
                              backup.status === 'IN_PROGRESS' ||
                              deleteBackup.isPending
                            }
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Backup Settings */}
          {selectedServer && (
            <Card>
              <CardHeader>
                <CardTitle>Backup Settings</CardTitle>
                <CardDescription>Configure automatic backup schedule</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Backup Frequency</label>
                      <Select defaultValue="daily">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Every Hour</SelectItem>
                          <SelectItem value="daily">Daily at 4 AM</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="manual">Manual Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Retention (days)</label>
                      <Select defaultValue="7">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="0">Keep all</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button variant="outline">
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
