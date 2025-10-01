import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Backup } from '@/lib/api-client';

export function useBackups(serverId: string) {
  return useQuery({
    queryKey: ['backups', serverId],
    queryFn: () => api.backups.list(serverId),
    enabled: !!serverId,
  });
}

export function useBackup(id: string) {
  return useQuery({
    queryKey: ['backups', 'detail', id],
    queryFn: () => api.backups.get(id),
    enabled: !!id,
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      serverId,
      name,
      description,
    }: {
      serverId: string;
      name?: string;
      description?: string;
    }) => api.backups.create(serverId, { name, description }),
    onSuccess: (_, { serverId }) => {
      queryClient.invalidateQueries({ queryKey: ['backups', serverId] });
    },
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.backups.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.backups.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
}