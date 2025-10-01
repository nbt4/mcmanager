'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Play, Square, RotateCcw, Download, FileText, Settings as SettingsIcon, Send } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useServer, useStartServer, useStopServer, useRestartServer } from '@/hooks/useServers';
import { useBackups } from '@/hooks/useBackups';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export default function ServerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: server, isLoading } = useServer(id);
  const { data: backups } = useBackups(id);
  const startServer = useStartServer();
  const stopServer = useStopServer();
  const restartServer = useRestartServer();

  // Console state
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // WebSocket connection
  useEffect(() => {
    if (!id) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const newSocket = io(`${API_URL}/console`, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to console WebSocket');
      newSocket.emit('subscribe', { serverId: id });
    });

    newSocket.on('logs', (data: { logs: string[] }) => {
      setLogs(data.logs);
    });

    newSocket.on('log', (data: { log: string }) => {
      setLogs(prev => [...prev, data.log]);
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('Console error:', data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('unsubscribe', { serverId: id });
      newSocket.disconnect();
    };
  }, [id]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !socket) return;

    socket.emit('command', { serverId: id, command });
    setCommand('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-8 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-2xl font-bold mb-2">Server Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The server you're looking for doesn't exist.
              </p>
              <Button asChild>
                <Link href="/servers">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Servers
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/servers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Servers
            </Link>
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                {server.name}
                <Badge variant={getStatusColor(server.status) as any}>
                  {server.status}
                </Badge>
              </h1>
              <p className="text-muted-foreground mt-2">
                {server.description || `${server.type} ${server.version}`}
              </p>
            </div>

            <div className="flex gap-2">
              {server.status === 'STOPPED' && (
                <Button
                  onClick={() => startServer.mutateAsync(id)}
                  disabled={startServer.isPending}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </Button>
              )}

              {server.status === 'RUNNING' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => stopServer.mutateAsync(id)}
                    disabled={stopServer.isPending}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Stop
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => restartServer.mutateAsync(id)}
                    disabled={restartServer.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restart
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{server.status}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Players</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0/{server.maxPlayers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Memory</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{server.memory} MB</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Port</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{server.port}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Server Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">Type</dt>
                    <dd className="font-medium">{server.type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Version</dt>
                    <dd className="font-medium">{server.version}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Difficulty</dt>
                    <dd className="font-medium">{server.difficulty}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Gamemode</dt>
                    <dd className="font-medium">{server.gamemode}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">PvP</dt>
                    <dd className="font-medium">{server.pvp ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Whitelist</dt>
                    <dd className="font-medium">{server.whitelist ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Online Mode</dt>
                    <dd className="font-medium">{server.onlineMode ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">Auto-start</dt>
                    <dd className="font-medium">{server.autoStart ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="console">
            <Card>
              <CardHeader>
                <CardTitle>Server Console</CardTitle>
                <CardDescription>Real-time server logs and command execution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  ref={consoleRef}
                  className="bg-black text-green-400 font-mono text-sm p-4 rounded h-96 overflow-auto"
                  onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const isScrolledToBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 10;
                    setAutoScroll(isScrolledToBottom);
                  }}
                >
                  {logs.length > 0 ? (
                    logs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap break-all">{log}</div>
                    ))
                  ) : (
                    <p className="text-gray-500">
                      {server.status === 'RUNNING'
                        ? 'Waiting for logs...'
                        : 'Server is not running. Start the server to see logs.'}
                    </p>
                  )}
                </div>

                <form onSubmit={handleSendCommand} className="flex gap-2">
                  <Input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder={server.status === 'RUNNING' ? 'Enter command (e.g., say Hello, list, stop)' : 'Server must be running to send commands'}
                    disabled={server.status !== 'RUNNING'}
                    className="flex-1 font-mono"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={server.status !== 'RUNNING' || !command.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle>File Manager</CardTitle>
                <CardDescription>Browse and edit server files</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">File manager coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backups">
            <Card>
              <CardHeader>
                <CardTitle>Backups</CardTitle>
                <CardDescription>Manage server backups</CardDescription>
              </CardHeader>
              <CardContent>
                {backups && backups.length > 0 ? (
                  <div className="space-y-2">
                    {backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div>
                          <div className="font-medium">{backup.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(backup.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge>{backup.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No backups yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Server Settings</CardTitle>
                <CardDescription>Configure server properties</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Settings editor coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}