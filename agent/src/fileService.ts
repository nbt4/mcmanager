import * as fs from 'fs';
import * as path from 'path';
import { watch } from 'chokidar';

export interface FileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified_time: number;
}

export class FileService {
  private basePath: string = '/data';

  async listFiles(dirPath: string = ''): Promise<FileInfo[]> {
    const fullPath = path.join(this.basePath, dirPath);

    // Security check - ensure path is within base directory
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of server directory');
    }

    try {
      const items = await fs.promises.readdir(fullPath);
      const files: FileInfo[] = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const stat = await fs.promises.stat(itemPath);

        files.push({
          name: item,
          path: path.join(dirPath, item),
          is_directory: stat.isDirectory(),
          size: stat.size,
          modified_time: stat.mtime.getTime()
        });
      }

      return files.sort((a, b) => {
        // Directories first, then files
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async readFile(filePath: string, offset?: number, length?: number): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);

    // Security check
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of server directory');
    }

    try {
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        throw new Error('Cannot read directory as file');
      }

      if (offset !== undefined || length !== undefined) {
        // Read partial file
        const fd = await fs.promises.open(fullPath, 'r');
        const buffer = Buffer.alloc(length || stat.size);
        await fd.read(buffer, 0, length || stat.size, offset || 0);
        await fd.close();
        return buffer;
      } else {
        // Read entire file
        return await fs.promises.readFile(fullPath);
      }
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async writeFile(filePath: string, content: Buffer | string, append: boolean = false): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);

    // Security check
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of server directory');
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });

      if (append) {
        await fs.promises.appendFile(fullPath, content);
      } else {
        await fs.promises.writeFile(fullPath, content);
      }
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  async deleteFile(filePath: string, recursive: boolean = false): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);

    // Security check
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of server directory');
    }

    try {
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        if (recursive) {
          await fs.promises.rmdir(fullPath, { recursive: true });
        } else {
          await fs.promises.rmdir(fullPath);
        }
      } else {
        await fs.promises.unlink(fullPath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async createDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    const fullPath = path.join(this.basePath, dirPath);

    // Security check
    if (!fullPath.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside of server directory');
    }

    try {
      await fs.promises.mkdir(fullPath, { recursive });
    } catch (error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  watchFiles(callback: (event: string, path: string) => void) {
    const watcher = watch(this.basePath, {
      ignored: /^\./,
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('all', callback);

    return watcher;
  }
}