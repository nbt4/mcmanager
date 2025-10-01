'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Server as ServerIcon, Play, Square, RotateCcw, Trash2, Settings } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useServers, useStartServer, useStopServer, useRestartServer, useDeleteServer } from '@/hooks/useServers';
import { CreateServerDialog } from '@/components/servers/create-server-dialog';
import Link from 'next/link';

export default function ServersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: servers, isLoading } = useServers();
  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();
  const deleteServer = useDeleteServer();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'success';
      case 'STOPPED':
        return 'error';
      case 'STARTING':
      case 'STOPPING':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startServer.mutateAsync(id);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopServer.mutateAsync(id);
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  const handleRestart = async (id: string) => {
    try {
      await restartServer.mutateAsync(id);
    } catch (error) {
      console.error('Failed to restart server:', error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      try {
        await deleteServer.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete server:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold">Minecraft Servers</h1>
            <p className="text-muted-foreground mt-2">
              Manage and monitor your Minecraft server instances
            </p>
          </div>

          <Button onClick={() => setCreateDialogOpen(true)} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Server
          </Button>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : servers && servers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server, index) => (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <ServerIcon className="h-5 w-5 text-primary" />
                          {server.name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {server.description || `${server.type} ${server.version}`}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusColor(server.status) as any}>
                        {server.status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Port:</span>
                          <span className="ml-2 font-medium">{server.port}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Memory:</span>
                          <span className="ml-2 font-medium">{server.memory}MB</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Players:</span>
                          <span className="ml-2 font-medium">0/{server.maxPlayers}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 font-medium">{server.type}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        {server.status === 'STOPPED' && (
                          <Button
                            size="sm"
                            onClick={() => handleStart(server.id)}
                            disabled={startServer.isPending}
                            className="flex-1"
                          >
                            <Play className="mr-1 h-3 w-3" />
                            Start
                          </Button>
                        )}

                        {server.status === 'RUNNING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStop(server.id)}
                              disabled={stopServer.isPending}
                              className="flex-1"
                            >
                              <Square className="mr-1 h-3 w-3" />
                              Stop
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestart(server.id)}
                              disabled={restartServer.isPending}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <Link href={`/servers/${server.id}`}>
                            <Settings className="h-3 w-3" />
                          </Link>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(server.id, server.name)}
                          disabled={deleteServer.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <ServerIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No servers yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first Minecraft server to get started
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Server
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <CreateServerDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}