'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, File, Download, Upload, Trash2, Edit, Plus, Search } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useServers } from '@/hooks/useServers';

export default function FilesPage() {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: servers } = useServers();

  const mockFiles = [
    { name: 'server.properties', type: 'file', size: '2.4 KB', modified: '2024-01-15 10:30' },
    { name: 'eula.txt', type: 'file', size: '156 B', modified: '2024-01-14 09:15' },
    { name: 'world', type: 'folder', size: '1.2 GB', modified: '2024-01-15 11:45' },
    { name: 'plugins', type: 'folder', size: '45 MB', modified: '2024-01-12 14:20' },
    { name: 'logs', type: 'folder', size: '128 MB', modified: '2024-01-15 12:00' },
    { name: 'ops.json', type: 'file', size: '89 B', modified: '2024-01-10 08:30' },
    { name: 'whitelist.json', type: 'file', size: '124 B', modified: '2024-01-11 16:45' },
  ];

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

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Sidebar */}
          <Card>
            <CardHeader>
              <CardTitle>Server Selection</CardTitle>
              <CardDescription>Choose a server to manage files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger>
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

              {selectedServer && (
                <div className="space-y-2 pt-4 border-t">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Root Directory
                  </Button>
                  <Button variant="ghost" className="w-full justify-start pl-6" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    world
                  </Button>
                  <Button variant="ghost" className="w-full justify-start pl-6" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    plugins
                  </Button>
                  <Button variant="ghost" className="w-full justify-start pl-6" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    logs
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Files & Folders</CardTitle>
                    <CardDescription>
                      {selectedServer ? 'Manage your server files' : 'Select a server to view files'}
                    </CardDescription>
                  </div>
                  {selectedServer && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </Button>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        New File
                      </Button>
                      <Button size="sm" variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        New Folder
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedServer ? (
                  <div className="text-center py-12">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a server from the sidebar to browse files
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search files..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="border rounded-lg">
                      <div className="grid grid-cols-[1fr_100px_150px_100px] gap-4 p-3 border-b bg-muted/50 font-medium text-sm">
                        <div>Name</div>
                        <div>Size</div>
                        <div>Modified</div>
                        <div>Actions</div>
                      </div>

                      {mockFiles.map((file, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[1fr_100px_150px_100px] gap-4 p-3 border-b last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {file.type === 'folder' ? (
                              <FolderOpen className="h-4 w-4 text-primary" />
                            ) : (
                              <File className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{file.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{file.size}</div>
                          <div className="text-sm text-muted-foreground">{file.modified}</div>
                          <div className="flex gap-1">
                            {file.type === 'file' && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
