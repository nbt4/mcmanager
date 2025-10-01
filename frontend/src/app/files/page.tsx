'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useServers } from '@/hooks/useServers';
import { FileManager } from '@/components/file-manager';

export default function FilesPage() {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const { data: servers } = useServers();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold">File Manager</h1>
          <p className="text-muted-foreground mt-2">
            Browse and manage server files
          </p>
        </motion.div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Server Selection</CardTitle>
            <CardDescription>Choose a server to manage files</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedServer} onValueChange={setSelectedServer}>
              <SelectTrigger className="max-w-md">
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

        {!selectedServer ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select a server to browse and manage files
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <FileManager serverId={selectedServer} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
