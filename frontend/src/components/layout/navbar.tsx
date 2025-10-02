'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Leaf, Menu, X, Moon, Sun, Command } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { CommandPalette } from '@/components/ui/command-palette';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Servers', href: '/servers' },
  { name: 'Modpacks', href: '/modpacks' },
  { name: 'Backups', href: '/backups' },
  { name: 'Files', href: '/files' },
  { name: 'Logs', href: '/logs' },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="container flex h-16 items-center">
          {/* Logo */}
          <Link href="/" className="mr-8 flex items-center space-x-2">
            <Leaf className="h-6 w-6 text-minecraft-grass pixelated" />
            <span className="text-xl font-bold bg-gradient-to-r from-minecraft-grass to-minecraft-emerald bg-clip-text text-transparent">
              MineCtrl
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex mr-auto space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="text-muted-foreground"
            >
              <Command className="h-4 w-4 mr-2" />
              <span className="text-xs">⌘K</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden ml-auto">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-4">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'text-sm font-medium transition-colors hover:text-primary px-2 py-1',
                        pathname === item.href
                          ? 'text-foreground bg-accent rounded-md'
                          : 'text-muted-foreground'
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setCommandOpen(true);
                      setIsOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Command className="h-4 w-4 mr-2" />
                    Command Palette
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </motion.nav>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}