import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface VersionGroup {
  release: string[];
  beta: string[];
  alpha: string[];
}

interface VersionResponse {
  type: string;
  versions: VersionGroup;
}

export function useVersions(serverType: string) {
  return useQuery<VersionResponse>({
    queryKey: ['versions', serverType],
    queryFn: async () => {
      const { data } = await axios.get(
        `${API_URL}/servers/versions/${serverType}`
      );
      return data;
    },
    enabled: !!serverType,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
}
