import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Server, type ServerDetails, type CreateServerDto } from '@/lib/api-client';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: api.servers.list,
  });
}

export function useServer(id: string) {
  return useQuery({
    queryKey: ['servers', id],
    queryFn: () => api.servers.get(id),
    enabled: !!id,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateServerDto) => api.servers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateServerDto> }) =>
      api.servers.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', id] });
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.servers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useStartServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.servers.start(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', id] });
    },
  });
}

export function useStopServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.servers.stop(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', id] });
    },
  });
}

export function useRestartServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.servers.restart(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', id] });
    },
  });
}

export function useServerLogs(id: string, enabled = true) {
  return useQuery({
    queryKey: ['servers', id, 'logs'],
    queryFn: () => api.servers.getLogs(id),
    enabled: !!id && enabled,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
}