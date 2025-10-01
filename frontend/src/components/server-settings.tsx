'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateServer } from '@/hooks/useServers';
import { useVersions } from '@/hooks/useVersions';
import { Save, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ServerSettingsProps {
  server: any;
}

export function ServerSettings({ server }: ServerSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const updateServer = useUpdateServer();
  const queryClient = useQueryClient();
  const { data: versions, isLoading: versionsLoading } = useVersions(server.type);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: server.name,
      description: server.description || '',
      version: server.version,
      port: server.port,
      memory: server.memory,
      javaOpts: server.javaOpts || '',
      autoStart: server.autoStart,
      maxPlayers: server.maxPlayers,
      motd: server.motd,
      difficulty: server.difficulty,
      gamemode: server.gamemode,
      pvp: server.pvp,
      whitelist: server.whitelist,
      onlineMode: server.onlineMode,
      seed: server.seed || '',
    },
  });

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      await updateServer.mutateAsync({
        id: server.id,
        data,
      });
      queryClient.invalidateQueries({ queryKey: ['server', server.id] });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Settings</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              {...register('name', { required: 'Server name is required' })}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="version">Minecraft Version</Label>
            {versionsLoading ? (
              <div className="flex items-center gap-2 h-10 px-3 py-2 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading versions...</span>
              </div>
            ) : (
              <Select
                value={watch('version')}
                onValueChange={(value) => setValue('version', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions?.groupedByMinecraftVersion ? (
                    // Platform versions grouped by Minecraft version (Forge, Fabric, NeoForge)
                    Object.entries(versions.versions as Record<string, string[]>).map(([mcVersion, platformVersions]) => (
                      <SelectGroup key={mcVersion}>
                        <SelectLabel>Minecraft {mcVersion}</SelectLabel>
                        {platformVersions?.map((version) => (
                          <SelectItem key={version} value={version}>
                            {version}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  ) : (
                    // Standard version grouping (Paper, Vanilla, etc.)
                    <>
                      {((versions?.versions as any)?.release?.length ?? 0) > 0 && (
                        <SelectGroup>
                          <SelectLabel>Release Versions</SelectLabel>
                          {(versions?.versions as any)?.release?.map((version: string) => (
                            <SelectItem key={version} value={version}>
                              {version}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {((versions?.versions as any)?.beta?.length ?? 0) > 0 && (
                        <SelectGroup>
                          <SelectLabel>Beta / Snapshot Versions</SelectLabel>
                          {(versions?.versions as any)?.beta?.map((version: string) => (
                            <SelectItem key={version} value={version}>
                              {version}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {((versions?.versions as any)?.alpha?.length ?? 0) > 0 && (
                        <SelectGroup>
                          <SelectLabel>Alpha / Old Versions</SelectLabel>
                          {(versions?.versions as any)?.alpha?.map((version: string) => (
                            <SelectItem key={version} value={version}>
                              {version}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
            {errors.version && (
              <p className="text-sm text-red-500">{errors.version.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="port">Server Port</Label>
            <Input
              id="port"
              type="number"
              {...register('port', {
                required: 'Port is required',
                min: { value: 1024, message: 'Port must be at least 1024' },
                max: { value: 65535, message: 'Port must be at most 65535' },
                valueAsNumber: true,
              })}
            />
            {errors.port && (
              <p className="text-sm text-red-500">{errors.port.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="memory">Memory (MB)</Label>
            <Input
              id="memory"
              type="number"
              {...register('memory', {
                required: 'Memory is required',
                min: { value: 512, message: 'Memory must be at least 512 MB' },
                valueAsNumber: true,
              })}
            />
            {errors.memory && (
              <p className="text-sm text-red-500">{errors.memory.message as string}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="javaOpts">Java Options</Label>
          <Input
            id="javaOpts"
            {...register('javaOpts')}
            placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="autoStart"
            checked={watch('autoStart')}
            onCheckedChange={(checked) => setValue('autoStart', checked)}
          />
          <Label htmlFor="autoStart">Auto-start server on boot</Label>
        </div>
      </div>

      {/* Game Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Game Settings</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxPlayers">Max Players</Label>
            <Input
              id="maxPlayers"
              type="number"
              {...register('maxPlayers', {
                required: 'Max players is required',
                min: { value: 1, message: 'Must be at least 1' },
                max: { value: 200, message: 'Must be at most 200' },
                valueAsNumber: true,
              })}
            />
            {errors.maxPlayers && (
              <p className="text-sm text-red-500">{errors.maxPlayers.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select
              value={watch('difficulty')}
              onValueChange={(value) => setValue('difficulty', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PEACEFUL">Peaceful</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gamemode">Default Gamemode</Label>
            <Select
              value={watch('gamemode')}
              onValueChange={(value) => setValue('gamemode', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SURVIVAL">Survival</SelectItem>
                <SelectItem value="CREATIVE">Creative</SelectItem>
                <SelectItem value="ADVENTURE">Adventure</SelectItem>
                <SelectItem value="SPECTATOR">Spectator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seed">World Seed (Optional)</Label>
            <Input
              id="seed"
              {...register('seed')}
              placeholder="Leave empty for random"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motd">Message of the Day (MOTD)</Label>
          <Input
            id="motd"
            {...register('motd', { required: 'MOTD is required' })}
          />
          {errors.motd && (
            <p className="text-sm text-red-500">{errors.motd.message as string}</p>
          )}
        </div>
      </div>

      {/* Server Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Server Options</h3>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="pvp"
              checked={watch('pvp')}
              onCheckedChange={(checked) => setValue('pvp', checked)}
            />
            <Label htmlFor="pvp">Enable PvP (Player vs Player)</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="whitelist"
              checked={watch('whitelist')}
              onCheckedChange={(checked) => setValue('whitelist', checked)}
            />
            <Label htmlFor="whitelist">Enable Whitelist</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="onlineMode"
              checked={watch('onlineMode')}
              onCheckedChange={(checked) => setValue('onlineMode', checked)}
            />
            <Label htmlFor="onlineMode">Online Mode (Requires valid Minecraft accounts)</Label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={isSaving || updateServer.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </form>
  );
}
