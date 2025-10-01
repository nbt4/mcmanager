'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateServer } from '@/hooks/useServers';
import type { CreateServerDto } from '@/lib/api-client';

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateServerDialog({ open, onOpenChange }: CreateServerDialogProps) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CreateServerDto>({
    defaultValues: {
      name: '',
      description: '',
      type: 'PAPER',
      version: '1.20.4',
      port: 25565,
      memory: 4096,
      autoStart: false,
      storageType: 'VOLUME',
      storagePath: '',
      difficulty: 'NORMAL',
      gamemode: 'SURVIVAL',
      pvp: true,
      whitelist: false,
      onlineMode: true,
      maxPlayers: 20,
      motd: 'A Minecraft Server',
    },
  });

  const createServer = useCreateServer();
  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const serverType = watch('type');

  const onSubmit = async (data: CreateServerDto) => {
    try {
      setErrorMessage('');

      // Generate storage path if empty
      if (!data.storagePath) {
        data.storagePath = `minecraft-${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      }

      await createServer.mutateAsync(data);
      reset();
      setStep(1);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to create server:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to create server';
      setErrorMessage(Array.isArray(message) ? message.join(', ') : message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Minecraft Server</DialogTitle>
          <DialogDescription>
            Configure your new Minecraft server instance
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Server Name *</Label>
                <Input
                  id="name"
                  {...register('name', { required: true })}
                  placeholder="My Awesome Server"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="A fun survival server for friends"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Server Type *</Label>
                  <Select
                    value={serverType}
                    onValueChange={(value) => setValue('type', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VANILLA">Vanilla</SelectItem>
                      <SelectItem value="PAPER">Paper (Recommended)</SelectItem>
                      <SelectItem value="FABRIC">Fabric</SelectItem>
                      <SelectItem value="FORGE">Forge</SelectItem>
                      <SelectItem value="SPIGOT">Spigot</SelectItem>
                      <SelectItem value="BUKKIT">Bukkit</SelectItem>
                      <SelectItem value="QUILT">Quilt</SelectItem>
                      <SelectItem value="NEOFORGE">NeoForge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="version">Minecraft Version *</Label>
                  <Input
                    id="version"
                    {...register('version', { required: true })}
                    placeholder="1.20.4"
                  />
                </div>
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
                    min={512}
                    step={512}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep(2)}>
                  Next: Game Settings
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select
                    value={watch('difficulty')}
                    onValueChange={(value) => setValue('difficulty', value as any)}
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

                <div>
                  <Label htmlFor="gamemode">Gamemode</Label>
                  <Select
                    value={watch('gamemode')}
                    onValueChange={(value) => setValue('gamemode', value as any)}
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
              </div>

              <div>
                <Label htmlFor="maxPlayers">Max Players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  {...register('maxPlayers', { valueAsNumber: true })}
                  min={1}
                  max={200}
                />
              </div>

              <div>
                <Label htmlFor="motd">MOTD (Message of the Day)</Label>
                <Input
                  id="motd"
                  {...register('motd')}
                  placeholder="A Minecraft Server"
                />
              </div>

              <div>
                <Label htmlFor="seed">World Seed (optional)</Label>
                <Input
                  id="seed"
                  {...register('seed')}
                  placeholder="Leave empty for random"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pvp"
                    {...register('pvp')}
                    className="rounded"
                  />
                  <Label htmlFor="pvp">Enable PvP</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="whitelist"
                    {...register('whitelist')}
                    className="rounded"
                  />
                  <Label htmlFor="whitelist">Enable Whitelist</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="onlineMode"
                    {...register('onlineMode')}
                    className="rounded"
                  />
                  <Label htmlFor="onlineMode">Online Mode (Authentication)</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoStart"
                    {...register('autoStart')}
                    className="rounded"
                  />
                  <Label htmlFor="autoStart">Auto-start on boot</Label>
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  Next: Storage
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="storageType">Storage Type</Label>
                <Select
                  value={watch('storageType')}
                  onValueChange={(value) => setValue('storageType', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VOLUME">Docker Volume (Recommended)</SelectItem>
                    <SelectItem value="BIND">Bind Mount (Custom Path)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="storagePath">
                  {watch('storageType') === 'VOLUME' ? 'Volume Name' : 'Host Path'}
                </Label>
                <Input
                  id="storagePath"
                  {...register('storagePath')}
                  placeholder={
                    watch('storageType') === 'VOLUME'
                      ? 'minecraft-server-1'
                      : '/path/to/server'
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-generate from server name
                </p>
              </div>

              <div>
                <Label htmlFor="javaOpts">Java Options (optional)</Label>
                <Input
                  id="javaOpts"
                  {...register('javaOpts')}
                  placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="submit" disabled={createServer.isPending}>
                  {createServer.isPending ? 'Creating...' : 'Create Server'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}