import { EventEmitter } from 'events';
import { Tail } from 'tail';
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export class LogService extends EventEmitter {
  private logPath: string = '/data/logs/latest.log';
  private tail: Tail | null = null;

  constructor() {
    super();
    this.initializeLogWatching();
  }

  private initializeLogWatching() {
    if (fs.existsSync(this.logPath)) {
      this.tail = new Tail(this.logPath, {
        fromBeginning: false,
        follow: true,
        nLines: 0
      });

      this.tail.on('line', (line: string) => {
        const logEntry = this.parseLogLine(line);
        this.emit('log', logEntry);
      });

      this.tail.on('error', (error: Error) => {
        console.error('Log tail error:', error);
      });

      this.tail.watch();
    }
  }

  getLogs(tailLines: number = 100, follow: boolean = false): EventEmitter {
    const logEmitter = new EventEmitter();

    // Read existing logs
    if (fs.existsSync(this.logPath)) {
      fs.readFile(this.logPath, 'utf8', (err, data) => {
        if (err) {
          logEmitter.emit('error', err);
          return;
        }

        const lines = data.split('\n').filter(line => line.trim());
        const recentLines = lines.slice(-tailLines);

        recentLines.forEach(line => {
          const logEntry = this.parseLogLine(line);
          logEmitter.emit('data', logEntry);
        });

        if (!follow) {
          logEmitter.emit('end');
        }
      });
    }

    // Follow new logs if requested
    if (follow) {
      const logHandler = (logEntry: LogEntry) => {
        logEmitter.emit('data', logEntry);
      };

      this.on('log', logHandler);

      logEmitter.on('destroy', () => {
        this.off('log', logHandler);
      });
    }

    return logEmitter;
  }

  createLogStream(): EventEmitter {
    const streamEmitter = new EventEmitter();

    const logHandler = (logEntry: LogEntry) => {
      streamEmitter.emit('data', logEntry);
    };

    this.on('log', logHandler);

    streamEmitter.on('destroy', () => {
      this.off('log', logHandler);
    });

    return streamEmitter;
  }

  private parseLogLine(line: string): LogEntry {
    // Parse Minecraft log format: [HH:MM:SS] [Thread/Level]: Message
    const logRegex = /^\[(\d{2}:\d{2}:\d{2})\] \[([^/]+)\/([^\]]+)\]: (.+)$/;
    const match = line.match(logRegex);

    if (match) {
      const [, time, thread, level, message] = match;
      return {
        timestamp: new Date().toISOString().split('T')[0] + 'T' + time,
        level: level.toUpperCase(),
        message,
        source: thread
      };
    }

    // Fallback for non-standard log lines
    return {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: line,
      source: 'server'
    };
  }

  destroy() {
    if (this.tail) {
      this.tail.unwatch();
      this.tail = null;
    }
  }
}