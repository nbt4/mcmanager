const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE_URL}${endpoint}`;

  if (params) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }

  // Only set Content-Type if there's a body
  const headers: Record<string, string> = { ...(fetchOptions.headers as Record<string, string>) };
  if (fetchOptions.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const errorObj: any = new Error(error.message || 'API request failed');
    errorObj.response = { data: error };
    throw errorObj;
  }

  return response.json();
}

export const api = {
  // Health
  health: () => fetchApi<{ status: string; timestamp: string; service: string }>('/health'),

  // Servers
  servers: {
    list: () => fetchApi<Server[]>('/servers'),
    get: (id: string) => fetchApi<ServerDetails>(`/servers/${id}`),
    create: (data: CreateServerDto) => fetchApi<Server>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: string, data: Partial<CreateServerDto>) => fetchApi<Server>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    delete: (id: string) => fetchApi<void>(`/servers/${id}`, {
      method: 'DELETE',
    }),
    start: (id: string) => fetchApi<Server>(`/servers/${id}/start`, {
      method: 'POST',
    }),
    stop: (id: string) => fetchApi<Server>(`/servers/${id}/stop`, {
      method: 'POST',
    }),
    restart: (id: string) => fetchApi<Server>(`/servers/${id}/restart`, {
      method: 'POST',
    }),
    getLogs: (id: string) => fetchApi<{ logs: string[] }>(`/servers/${id}/logs`),
  },

  // Backups
  backups: {
    list: (serverId: string) => fetchApi<Backup[]>(`/backups/servers/${serverId}`),
    get: (id: string) => fetchApi<Backup>(`/backups/${id}`),
    create: (serverId: string, data: { name?: string; description?: string }) =>
      fetchApi<Backup>(`/backups/servers/${serverId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => fetchApi<void>(`/backups/${id}`, {
      method: 'DELETE',
    }),
    restore: (id: string) => fetchApi<{ message: string }>(`/backups/${id}/restore`, {
      method: 'POST',
    }),
  },
};

// Types
export interface Server {
  id: string;
  name: string;
  description: string | null;
  type: string;
  version: string;
  port: number;
  memory: number;
  javaOpts: string | null;
  autoStart: boolean;
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';
  storageType: string;
  storagePath: string;
  containerName: string | null;
  containerId: string | null;
  agentUrl: string | null;
  seed: string | null;
  difficulty: string;
  gamemode: string;
  pvp: boolean;
  whitelist: boolean;
  onlineMode: boolean;
  maxPlayers: number;
  motd: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerDetails extends Server {
  properties: ServerProperty[];
  backups: Backup[];
}

export interface ServerProperty {
  id: string;
  serverId: string;
  key: string;
  value: string;
}

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  size: number | null;
  path: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateServerDto {
  name: string;
  description?: string;
  type: 'VANILLA' | 'FABRIC' | 'FORGE' | 'PAPER' | 'SPIGOT' | 'BUKKIT' | 'QUILT' | 'NEOFORGE';
  version: string;
  port: number;
  memory: number;
  javaOpts?: string;
  autoStart: boolean;
  storageType: 'VOLUME' | 'BIND';
  storagePath: string;
  seed?: string;
  difficulty: 'PEACEFUL' | 'EASY' | 'NORMAL' | 'HARD';
  gamemode: 'SURVIVAL' | 'CREATIVE' | 'ADVENTURE' | 'SPECTATOR';
  pvp: boolean;
  whitelist: boolean;
  onlineMode: boolean;
  maxPlayers: number;
  motd: string;
}