import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FileItem {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  path: string;
}

interface FileList {
  path: string;
  items: FileItem[];
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export function useFiles(serverId: string, path: string = '') {
  return useQuery<FileList>({
    queryKey: ['files', serverId, path],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_URL}/servers/${serverId}/files`,
        { params: { path } }
      );
      return data;
    },
  });
}

export function useFileContent(serverId: string, path: string) {
  return useQuery<FileContent>({
    queryKey: ['file-content', serverId, path],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_URL}/servers/${serverId}/files/read`,
        { params: { path } }
      );
      return data;
    },
    enabled: !!path,
  });
}

export function useWriteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, path, content }: { serverId: string; path: string; content: string }) => {
      const { data } = await axios.post(
        `${API_URL}/servers/${serverId}/files/write`,
        { path, content }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['file-content', variables.serverId, variables.path] });
      queryClient.invalidateQueries({ queryKey: ['files', variables.serverId] });
    },
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, path, file }: { serverId: string; path: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await axios.post(
        `${API_URL}/servers/${serverId}/files/upload`,
        formData,
        {
          params: { path },
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.serverId] });
    },
  });
}

export function useCreateDirectory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, path }: { serverId: string; path: string }) => {
      const { data } = await axios.post(
        `${API_URL}/servers/${serverId}/files/mkdir`,
        { path }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.serverId] });
    },
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, path }: { serverId: string; path: string }) => {
      const { data } = await axios.delete(
        `${API_URL}/servers/${serverId}/files`,
        { params: { path } }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.serverId] });
    },
  });
}

export function getDownloadUrl(serverId: string, path: string): string {
  const params = new URLSearchParams({ path });
  return `${API_URL}/servers/${serverId}/files/download?${params}`;
}
