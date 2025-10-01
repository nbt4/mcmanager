'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Zap, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/layout/navbar';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-minecraft-grass/20 to-minecraft-emerald/20">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <Leaf className="h-8 w-8 text-minecraft-grass pixelated" />
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-minecraft-grass to-minecraft-emerald bg-clip-text text-transparent">
              MineCtrl
            </h1>
          </div>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Beautiful, blazing-fast Minecraft server management.
            Create, configure, and control your servers with a modern, intuitive interface.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-minecraft-grass hover:bg-minecraft-grass/90">
              <Link href="/servers">
                Get Started
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs">
                Documentation
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16"
        >
          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Blazing Fast
              </CardTitle>
              <CardDescription>
                First paint {'<'} 300ms, interactions {'<'} 150ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built with Next.js 14, optimized for speed with instant navigation and real-time updates.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Secure & Reliable
              </CardTitle>
              <CardDescription>
                Enterprise-grade security and reliability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Containerized architecture with proper isolation, automatic backups, and graceful shutdowns.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-500" />
                One Command Setup
              </CardTitle>
              <CardDescription>
                Zero host dependencies beyond Docker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Just run <code className="bg-muted px-1 rounded text-xs">docker compose up</code> and you're ready to go.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid lg:grid-cols-2 gap-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Complete Server Management</CardTitle>
              <CardDescription>
                Everything you need to manage Minecraft servers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>✓ Create & Import servers</div>
                <div>✓ Real-time monitoring</div>
                <div>✓ File management</div>
                <div>✓ Backup & restore</div>
                <div>✓ Mod-pack support</div>
                <div>✓ Live log viewer</div>
                <div>✓ Dark/light mode</div>
                <div>✓ Keyboard shortcuts</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supported Server Types</CardTitle>
              <CardDescription>
                All major Minecraft server implementations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>• Vanilla</div>
                <div>• Paper</div>
                <div>• Fabric</div>
                <div>• Forge</div>
                <div>• Spigot</div>
                <div>• Bukkit</div>
                <div>• Quilt</div>
                <div>• NeoForge</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}