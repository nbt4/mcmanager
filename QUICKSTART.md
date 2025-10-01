# 🚀 MineCtrl Quick Start Guide

## Prerequisites

- Docker 20.10 or later
- Docker Compose 2.0 or later
- **That's it!** No Node.js, Java, or other dependencies needed

## Installation & Setup

### 1. Start the Application

```bash
cd /opt/dev/mcmanager
docker compose up -d
```

This single command will:
- Build all three services (frontend, backend, agent)
- Create necessary volumes for data persistence
- Start all containers in the background
- Set up networking between services

### 2. Access the Application

Once the build completes (typically 2-5 minutes on first run):

- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:3001/api/docs
- **Backend API**: http://localhost:3001

### 3. Check Service Health

```bash
# View running containers
docker compose ps

# Check service logs
docker compose logs -f frontend
docker compose logs -f backend-standalone

# Check individual service health
curl http://localhost:3000/api/health
curl http://localhost:3001/health
```

## First Server Creation

1. Open http://localhost:3000 in your browser
2. Click "Get Started" or navigate to "Servers"
3. Click "Create Server"
4. Fill in the form:
   - **Name**: My First Server
   - **Type**: Paper (recommended for performance)
   - **Version**: 1.20.4
   - **Port**: 25565
   - **Memory**: 4096 MB (4GB)
   - **Storage Type**: Volume
   - **Storage Path**: minecraft-server-1
5. Click "Create"
6. Click "Start" to launch the server
7. Join from Minecraft: `localhost:25565`

## Common Operations

### Stop All Services

```bash
docker compose down
```

### Restart a Service

```bash
docker compose restart frontend
docker compose restart backend-standalone
```

### View Logs in Real-time

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend-standalone
```

### Rebuild After Code Changes

```bash
docker compose up -d --build
```

### Access Database

The SQLite database is stored in the `app_data` volume:

```bash
# Find the volume location
docker volume inspect minectrl_app_data

# Or access via backend container
docker compose exec backend-standalone sh
# ls -la /app/data/
```

### Backup Minecraft Server Data

All Minecraft server files are in the `minecraft_data` volume:

```bash
# Create a backup
docker run --rm -v minectrl_minecraft_data:/data -v $(pwd):/backup alpine tar czf /backup/minecraft-backup-$(date +%Y%m%d).tar.gz /data

# Restore from backup
docker run --rm -v minectrl_minecraft_data:/data -v $(pwd):/backup alpine tar xzf /backup/minecraft-backup-YYYYMMDD.tar.gz -C /
```

## Troubleshooting

### Build Failures

If the build fails, check:

```bash
# Clean up and rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Port Conflicts

If ports 3000, 3001, or 25565 are in use:

1. Edit `.env` file:
```bash
cp .env.example .env
# Edit .env and change ports
```

2. Or use docker compose ports syntax:
```bash
# Edit docker-compose.yml to map to different ports
ports:
  - "8080:3000"  # Frontend on 8080
  - "8081:3001"  # Backend on 8081
```

### Container Won't Start

```bash
# Check logs for errors
docker compose logs backend-standalone

# Check if process is running
docker compose exec backend-standalone ps aux

# Restart with fresh logs
docker compose restart backend-standalone && docker compose logs -f backend-standalone
```

### Database Issues

```bash
# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d

# Or just reset app data
docker volume rm minectrl_app_data
docker compose up -d
```

## Development Mode

For local development without Docker:

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Agent

```bash
cd agent
npm install
npm run dev
```

## Environment Variables

Key variables you can customize in `.env`:

```bash
# Ports
BACKEND_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Security
JWT_SECRET=your-strong-secret-here

# Minecraft
DEFAULT_JAVA_OPTS="-Xmx4G -Xms1G -XX:+UseG1GC"
MINECRAFT_DATA_PATH="/data/minecraft"

# Backups
BACKUP_RETENTION_DAYS=7
BACKUP_CRON="0 4 * * *"

# Optional: S3 for backups
S3_BUCKET=my-minecraft-backups
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

## Next Steps

- Explore the API documentation at http://localhost:3001/api/docs
- Create multiple servers with different mod loaders
- Set up scheduled backups
- Configure server properties via the web interface
- Monitor server performance in real-time
- Import existing worlds or mod-packs

## Getting Help

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/your-org/minectrl/issues)
- 💬 [Discussions](https://github.com/your-org/minectrl/discussions)

## Performance Tips

1. **Memory**: Allocate at least 2GB RAM per server, 4GB recommended
2. **Storage**: Use volumes (not bind mounts) for better I/O performance
3. **CPU**: Enable `--cpus` limit in docker-compose.yml if running multiple servers
4. **Network**: Use bridge network mode for better isolation

## Security Checklist

- [ ] Change default JWT_SECRET in `.env`
- [ ] Set up firewall rules for Minecraft ports
- [ ] Enable authentication (coming soon)
- [ ] Regular backups configured
- [ ] Update containers regularly
- [ ] Review server access logs
- [ ] Use whitelist mode for private servers

---

**Built with ❤️ for the Minecraft community**