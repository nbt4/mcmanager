'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSearchModpacks } from '@/hooks/useModpacks';
import { ModpackCard } from '@/components/modpacks/modpack-card';
import { ModpackDetailsModal } from '@/components/modpacks/modpack-details-modal';

export default function ModpacksPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [gameVersion, setGameVersion] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedModpack, setSelectedModpack] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: searchResults, isLoading } = useSearchModpacks({
    query: searchQuery,
    gameVersion: gameVersion === 'all' ? undefined : gameVersion,
    page,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(0);
  };

  const handleModpackClick = (modpack: any) => {
    setSelectedModpack(modpack);
    setDetailsOpen(true);
  };

  const minecraftVersions = [
    '1.21.1', '1.21', '1.20.4', '1.20.1', '1.20',
    '1.19.4', '1.19.2', '1.19', '1.18.2', '1.18.1'
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            CurseForge Modpacks
          </h1>
          <p className="text-muted-foreground mt-2">
            Search and create servers from CurseForge modpacks
          </p>
        </motion.div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Modpacks</CardTitle>
            <CardDescription>
              {searchQuery ? `Showing results for "${searchQuery}"` : 'Showing popular modpacks - search to find more'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search modpacks..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={gameVersion} onValueChange={setGameVersion}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All versions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All versions</SelectItem>
                  {minecraftVersions.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'Searching modpacks...' : 'Loading popular modpacks...'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : searchResults?.data?.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-muted-foreground">No modpacks found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {searchResults?.data?.map((modpack: any) => (
                <ModpackCard
                  key={modpack.id}
                  modpack={modpack}
                  onClick={() => handleModpackClick(modpack)}
                />
              ))}
            </div>

            {/* Pagination */}
            {searchResults?.pagination && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!searchResults?.pagination?.resultCount || searchResults.pagination.resultCount < 20}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modpack Details Modal */}
      <ModpackDetailsModal
        modpack={selectedModpack}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
