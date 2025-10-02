'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ProgressUpdate {
  sessionId: string;
  step: string;
  progress: number;
  message: string;
  total?: number;
  current?: number;
}

interface ServerCreationProgressProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerCreationProgress({ sessionId, open, onOpenChange }: ServerCreationProgressProps) {
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [status, setStatus] = useState<'creating' | 'complete' | 'error'>('creating');
  const [error, setError] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!sessionId || !open) return;

    // Connect to modpacks namespace
    const newSocket = io(`${API_URL}/modpacks`, {
      transports: ['websocket', 'polling'],
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to modpack progress socket');
    });

    newSocket.on('progress', (data: ProgressUpdate) => {
      if (data.sessionId === sessionId) {
        console.log('Progress update:', data);
        setProgress(data);
      }
    });

    newSocket.on('complete', (data: { sessionId: string; serverId: string }) => {
      if (data.sessionId === sessionId) {
        console.log('Server creation complete:', data);
        setStatus('complete');
        setServerId(data.serverId);
        setProgress({
          sessionId,
          step: 'complete',
          progress: 100,
          message: 'Server created successfully!',
        });
      }
    });

    newSocket.on('error', (data: { sessionId: string; error: string }) => {
      if (data.sessionId === sessionId) {
        console.error('Server creation error:', data.error);
        setStatus('error');
        setError(data.error);
      }
    });

    return () => {
      newSocket.close();
    };
  }, [sessionId, open]);

  const handleClose = () => {
    if (status === 'creating') return; // Don't allow closing while creating
    onOpenChange(false);
    if (status === 'complete') {
      router.push('/servers');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {status === 'creating' && 'Creating Server from Modpack'}
            {status === 'complete' && 'Server Created Successfully'}
            {status === 'error' && 'Creation Failed'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === 'creating' && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress?.message || 'Initializing...'}
              </div>
              <Progress value={progress?.progress || 0} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {progress?.progress || 0}% complete
              </p>
            </>
          )}

          {status === 'complete' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-sm text-center">
                Your modpack server has been created successfully!
              </p>
              <Button onClick={handleClose} className="mt-2">
                Go to Servers
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-sm text-center text-red-500">
                {error || 'An error occurred during server creation'}
              </p>
              <Button onClick={handleClose} variant="outline" className="mt-2">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
