import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ModpackSearchParams {
  query: string;
  gameVersion?: string;
  page?: number;
}

interface CreateModpackServerDto {
  name: string;
  description?: string;
  modpackId: number;
  fileId: number;
  port: number;
  memory: number;
  javaOpts?: string;
  storagePath?: string;
}

export function useSearchModpacks(params: ModpackSearchParams) {
  return useQuery({
    queryKey: ['modpacks', 'search', params],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/search`, {
        params,
      });
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useModpackDetails(modpackId: number | null) {
  return useQuery({
    queryKey: ['modpacks', modpackId],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/${modpackId}`);
      return data;
    },
    enabled: !!modpackId,
  });
}

export function useModpackFiles(modpackId: number | null, gameVersion?: string) {
  return useQuery({
    queryKey: ['modpacks', modpackId, 'files', gameVersion],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/${modpackId}/files`, {
        params: gameVersion ? { gameVersion } : {},
      });
      return data;
    },
    enabled: !!modpackId,
  });
}

export function useModpackDescription(modpackId: number | null) {
  return useQuery({
    queryKey: ['modpacks', modpackId, 'description'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/${modpackId}/description`);
      return data;
    },
    enabled: !!modpackId,
  });
}

export function useFileChangelog(modpackId: number | null, fileId: number | null) {
  return useQuery({
    queryKey: ['modpacks', modpackId, 'files', fileId, 'changelog'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/${modpackId}/files/${fileId}/changelog`);
      return data;
    },
    enabled: !!modpackId && !!fileId,
  });
}

export function useModList(modpackId: number | null, fileId: number | null) {
  return useQuery({
    queryKey: ['modpacks', modpackId, 'files', fileId, 'mods'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/${modpackId}/files/${fileId}/mods`);
      return data;
    },
    enabled: !!modpackId && !!fileId,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

export function useCreateModpackServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateModpackServerDto) => {
      const { data } = await axios.post(`${API_URL}/modpacks/create-server`, dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

export function useListModpacks() {
  return useQuery({
    queryKey: ['modpacks', 'list'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/modpacks/list`);
      return data;
    },
  });
}
