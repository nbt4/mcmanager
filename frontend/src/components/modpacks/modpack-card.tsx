import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Calendar } from 'lucide-react';
import Image from 'next/image';

interface ModpackCardProps {
  modpack: any;
  onClick: () => void;
}

export function ModpackCard({ modpack, onClick }: ModpackCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex gap-3">
          {modpack.logo?.thumbnailUrl && (
            <div className="relative w-16 h-16 flex-shrink-0">
              <Image
                src={modpack.logo.thumbnailUrl}
                alt={modpack.name}
                fill
                className="object-cover rounded"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{modpack.name}</CardTitle>
            <CardDescription className="text-sm">
              by {modpack.authors?.[0]?.name || 'Unknown'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {modpack.summary || 'No description available'}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{formatNumber(modpack.downloadCount || 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(modpack.dateModified || modpack.dateCreated)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
