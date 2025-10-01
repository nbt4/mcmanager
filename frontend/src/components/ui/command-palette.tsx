'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search,
  Server,
  FolderOpen,
  FileText,
  Download,
  Play,
  Square,
  RotateCcw,
  Settings,
  Home
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  // Keyboard shortcut handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const commands = [
    {
      group: 'Navigation',
      items: [
        {
          id: 'home',
          label: 'Go to Home',
          icon: Home,
          action: () => router.push('/'),
        },
        {
          id: 'servers',
          label: 'Go to Servers',
          icon: Server,
          action: () => router.push('/servers'),
        },
        {
          id: 'files',
          label: 'Go to Files',
          icon: FolderOpen,
          action: () => router.push('/files'),
        },
        {
          id: 'logs',
          label: 'Go to Logs',
          icon: FileText,
          action: () => router.push('/logs'),
        },
        {
          id: 'backups',
          label: 'Go to Backups',
          icon: Download,
          action: () => router.push('/backups'),
        },
      ],
    },
    {
      group: 'Server Actions',
      items: [
        {
          id: 'create-server',
          label: 'Create New Server',
          icon: Server,
          action: () => router.push('/servers/new'),
        },
        {
          id: 'start-all',
          label: 'Start All Servers',
          icon: Play,
          action: () => console.log('Start all servers'),
        },
        {
          id: 'stop-all',
          label: 'Stop All Servers',
          icon: Square,
          action: () => console.log('Stop all servers'),
        },
        {
          id: 'restart-all',
          label: 'Restart All Servers',
          icon: RotateCcw,
          action: () => console.log('Restart all servers'),
        },
      ],
    },
    {
      group: 'Settings',
      items: [
        {
          id: 'settings',
          label: 'Open Settings',
          icon: Settings,
          action: () => router.push('/settings'),
        },
      ],
    },
  ];

  const handleSelect = (action: () => void) => {
    action();
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-[640px]">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm">
              No results found.
            </Command.Empty>
            {commands.map((group) => (
              <Command.Group key={group.group} heading={group.group}>
                {group.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label}
                    onSelect={() => handleSelect(item.action)}
                    className="cursor-pointer"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}