'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModpackDetails, useModpackFiles, useModpackDescription, useModList, useCreateModpackServer } from '@/hooks/useModpacks';
import { Download, Calendar, Users, Loader2, Server, Search, ExternalLink, Package2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface ModpackDetailsModalProps {
  modpack: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModpackDetailsModal({ modpack, open, onOpenChange }: ModpackDetailsModalProps) {
  const router = useRouter();
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [modSearchQuery, setModSearchQuery] = useState('');

  const { data: details, isLoading: detailsLoading } = useModpackDetails(modpack?.id);
  const { data: filesData, isLoading: filesLoading } = useModpackFiles(modpack?.id);
  const { data: descriptionData, isLoading: descriptionLoading } = useModpackDescription(modpack?.id);
  const { data: modListData, isLoading: modListLoading } = useModList(modpack?.id, selectedFileId);
  const createServer = useCreateModpackServer();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      port: 25565,
      memory: 4096,
      javaOpts: '',
    },
  });

  const onSubmit = async (data: any) => {
    if (!modpack || !selectedFileId) return;

    try {
      await createServer.mutateAsync({
        ...data,
        modpackId: modpack.id,
        fileId: selectedFileId,
      });
      onOpenChange(false);
      router.push('/servers');
    } catch (error) {
      console.error('Failed to create server:', error);
    }
  };

  if (!modpack) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Filter mods based on search query
  const filteredMods = modListData?.mods?.filter((mod: any) =>
    !modSearchQuery ||
    mod.name?.toLowerCase().includes(modSearchQuery.toLowerCase()) ||
    mod.summary?.toLowerCase().includes(modSearchQuery.toLowerCase()) ||
    mod.projectID?.toString().includes(modSearchQuery.toLowerCase()) ||
    mod.fileID?.toString().includes(modSearchQuery.toLowerCase())
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex gap-4">
            {modpack.logo?.url && (
              <div className="relative w-20 h-20 flex-shrink-0">
                <Image
                  src={modpack.logo.url}
                  alt={modpack.name}
                  fill
                  className="object-cover rounded"
                />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="text-2xl">{modpack.name}</DialogTitle>
              <DialogDescription>
                by {modpack.authors?.[0]?.name || 'Unknown'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!showCreateForm ? (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="mods">Mods {modListData?.modCount ? `(${modListData.modCount})` : ''}</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Downloads</p>
                    <p className="font-medium">{formatNumber(modpack.downloadCount || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Updated</p>
                    <p className="font-medium">{formatDate(modpack.dateModified)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(modpack.dateCreated)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {modpack.summary || 'No summary available'}
                </p>
              </div>

              {details?.data?.screenshots && details.data.screenshots.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Screenshots</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {details.data.screenshots.slice(0, 4).map((screenshot: any, idx: number) => (
                      <div key={idx} className="relative aspect-video rounded overflow-hidden">
                        <Image
                          src={screenshot.url}
                          alt={screenshot.title || `Screenshot ${idx + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {details?.data?.links && (
                <div>
                  <h3 className="font-semibold mb-2">Links</h3>
                  <div className="flex flex-wrap gap-2">
                    {details.data.links.websiteUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={details.data.links.websiteUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Website
                        </a>
                      </Button>
                    )}
                    {details.data.links.wikiUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={details.data.links.wikiUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Wiki
                        </a>
                      </Button>
                    )}
                    {details.data.links.issuesUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={details.data.links.issuesUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Issues
                        </a>
                      </Button>
                    )}
                    {details.data.links.sourceUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={details.data.links.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Source
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {detailsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Server className="mr-2 h-4 w-4" />
                  Create Server from Modpack
                </Button>
              )}
            </TabsContent>

            <TabsContent value="description" className="space-y-4">
              {descriptionLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : descriptionData?.data ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: descriptionData.data }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No detailed description available</p>
              )}
            </TabsContent>

            <TabsContent value="mods" className="space-y-4">
              {!selectedFileId ? (
                <div className="text-center py-8">
                  <Package2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Select a modpack version in the Files tab to view the mod list
                  </p>
                </div>
              ) : modListLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-sm text-muted-foreground ml-2">Loading mod list...</p>
                </div>
              ) : modListData?.mods && modListData.mods.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {modListData.modCount} mods • MC {modListData.minecraftVersion} • {modListData.modLoader}
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search mods by name, ID, or description..."
                      value={modSearchQuery}
                      onChange={(e) => setModSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredMods.map((mod: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 border rounded hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {mod.logo ? (
                            <div className="relative w-8 h-8 flex-shrink-0">
                              <Image
                                src={mod.logo}
                                alt={mod.name}
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                          ) : (
                            <Package2 className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {mod.websiteUrl ? (
                                    <a
                                      href={mod.websiteUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-sm hover:underline inline-flex items-center gap-1"
                                    >
                                      {mod.name}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="font-medium text-sm">{mod.name}</span>
                                  )}
                                </div>
                                {mod.summary && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {mod.summary}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 font-mono">
                                  ID: {mod.projectID} • File: {mod.fileID}
                                </p>
                              </div>
                              {mod.required !== false && (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 whitespace-nowrap">
                                  Required
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredMods.length === 0 && modSearchQuery && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No mods found matching "{modSearchQuery}"
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Showing {filteredMods.length} of {modListData.modCount} mods
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No mod list available for this version
                </p>
              )}
            </TabsContent>

            <TabsContent value="files" className="space-y-2">
              {filesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a modpack version to create a server
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filesData?.data?.map((file: any) => (
                      <div
                        key={file.id}
                        className={`p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors ${
                          selectedFileId === file.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedFileId(file.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{file.displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              {file.gameVersions?.join(', ')} • {formatBytes(file.fileLength)}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(file.fileDate)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => setShowCreateForm(true)}
                    disabled={!selectedFileId}
                  >
                    <Server className="mr-2 h-4 w-4" />
                    Create Server with Selected Version
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <h3 className="font-semibold text-lg">Server Configuration</h3>

            <div>
              <Label htmlFor="name">Server Name *</Label>
              <Input
                id="name"
                {...register('name', { required: true })}
                placeholder={`${modpack.name} Server`}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Server description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="port">Port *</Label>
                <Input
                  id="port"
                  type="number"
                  {...register('port', { required: true, valueAsNumber: true })}
                  min={1024}
                  max={65535}
                />
              </div>

              <div>
                <Label htmlFor="memory">Memory (MB) *</Label>
                <Input
                  id="memory"
                  type="number"
                  {...register('memory', { required: true, valueAsNumber: true })}
                  min={1024}
                  step={512}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="javaOpts">Java Options (Optional)</Label>
              <Input
                id="javaOpts"
                {...register('javaOpts')}
                placeholder="-XX:+UseG1GC"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={createServer.isPending}
                className="flex-1"
              >
                {createServer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Server className="mr-2 h-4 w-4" />
                    Create Server
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
