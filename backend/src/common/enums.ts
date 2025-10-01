// Enums for SQLite (stored as strings)

export enum ServerType {
  VANILLA = 'VANILLA',
  FABRIC = 'FABRIC',
  FORGE = 'FORGE',
  PAPER = 'PAPER',
  SPIGOT = 'SPIGOT',
  BUKKIT = 'BUKKIT',
  QUILT = 'QUILT',
  NEOFORGE = 'NEOFORGE',
}

export enum ServerStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR',
}

export enum StorageType {
  VOLUME = 'VOLUME',
  BIND = 'BIND',
}

export enum Difficulty {
  PEACEFUL = 'PEACEFUL',
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
}

export enum Gamemode {
  SURVIVAL = 'SURVIVAL',
  CREATIVE = 'CREATIVE',
  ADVENTURE = 'ADVENTURE',
  SPECTATOR = 'SPECTATOR',
}

export enum BackupType {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
  AUTO = 'AUTO',
}

export enum BackupStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER = 'USER',
}