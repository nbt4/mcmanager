import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { ServerProcessManager } from './serverProcess';
import { FileService } from './fileService';
import { LogService } from './logService';

const PROTO_PATH = path.join(__dirname, '../proto/server.proto');

// Load protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const { minectrl } = protoDescriptor;

class AgentServer {
  private grpcServer: grpc.Server;
  private httpServer: express.Application;
  private wsServer: WebSocketServer;
  private serverProcess: ServerProcessManager;
  private fileService: FileService;
  private logService: LogService;

  constructor() {
    this.grpcServer = new grpc.Server();
    this.httpServer = express();
    this.serverProcess = new ServerProcessManager();
    this.fileService = new FileService();
    this.logService = new LogService();

    this.setupGrpcServices();
    this.setupHttpRoutes();
    this.setupWebSocket();
  }

  private setupGrpcServices() {
    this.grpcServer.addService(minectrl.ServerAgent.service, {
      startServer: this.startServer.bind(this),
      stopServer: this.stopServer.bind(this),
      getServerStatus: this.getServerStatus.bind(this),
      listFiles: this.listFiles.bind(this),
      readFile: this.readFile.bind(this),
      writeFile: this.writeFile.bind(this),
      deleteFile: this.deleteFile.bind(this),
      createDirectory: this.createDirectory.bind(this),
      getLogs: this.getLogs.bind(this),
      executeCommand: this.executeCommand.bind(this),
    });
  }

  private setupHttpRoutes() {
    this.httpServer.use(express.json());

    // Health check
    this.httpServer.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Server status
    this.httpServer.get('/status', (req, res) => {
      const status = this.serverProcess.getStatus();
      res.json(status);
    });

    // File operations
    this.httpServer.get('/files/*', async (req, res) => {
      try {
        const filePath = req.params[0];
        const files = await this.fileService.listFiles(filePath);
        res.json(files);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.httpServer.get('/file/*', async (req, res) => {
      try {
        const filePath = req.params[0];
        const content = await this.fileService.readFile(filePath);
        res.send(content);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.httpServer.post('/file/*', async (req, res) => {
      try {
        const filePath = req.params[0];
        await this.fileService.writeFile(filePath, req.body.content);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  private setupWebSocket() {
    this.wsServer = new WebSocketServer({ port: 3003 });

    this.wsServer.on('connection', (ws) => {
      console.log('WebSocket client connected');

      // Send live logs
      const logStream = this.logService.createLogStream();
      logStream.on('data', (logEntry) => {
        ws.send(JSON.stringify(logEntry));
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        logStream.destroy();
      });
    });
  }

  // gRPC service implementations
  private async startServer(call: any, callback: any) {
    try {
      const { server_jar, java_opts, properties } = call.request;
      const result = await this.serverProcess.start(server_jar, java_opts, properties);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  private async stopServer(call: any, callback: any) {
    try {
      const { force, timeout } = call.request;
      const result = await this.serverProcess.stop(force, timeout);
      callback(null, result);
    } catch (error) {
      callback(error);
    }
  }

  private getServerStatus(call: any, callback: any) {
    try {
      const status = this.serverProcess.getStatus();
      callback(null, status);
    } catch (error) {
      callback(error);
    }
  }

  private async listFiles(call: any, callback: any) {
    try {
      const { path } = call.request;
      const files = await this.fileService.listFiles(path);
      callback(null, { files });
    } catch (error) {
      callback(error);
    }
  }

  private async readFile(call: any, callback: any) {
    try {
      const { path, offset, length } = call.request;
      const content = await this.fileService.readFile(path, offset, length);
      callback(null, { content, size: content.length });
    } catch (error) {
      callback(error);
    }
  }

  private async writeFile(call: any, callback: any) {
    try {
      const { path, content, append } = call.request;
      await this.fileService.writeFile(path, content, append);
      callback(null, { success: true, message: 'File written successfully' });
    } catch (error) {
      callback(error);
    }
  }

  private async deleteFile(call: any, callback: any) {
    try {
      const { path, recursive } = call.request;
      await this.fileService.deleteFile(path, recursive);
      callback(null, { success: true, message: 'File deleted successfully' });
    } catch (error) {
      callback(error);
    }
  }

  private async createDirectory(call: any, callback: any) {
    try {
      const { path, recursive } = call.request;
      await this.fileService.createDirectory(path, recursive);
      callback(null, { success: true, message: 'Directory created successfully' });
    } catch (error) {
      callback(error);
    }
  }

  private getLogs(call: any) {
    const { tail_lines, follow } = call.request;
    const logStream = this.logService.getLogs(tail_lines, follow);

    logStream.on('data', (logEntry) => {
      call.write(logEntry);
    });

    logStream.on('end', () => {
      call.end();
    });

    call.on('cancelled', () => {
      logStream.destroy();
    });
  }

  private async executeCommand(call: any, callback: any) {
    try {
      const { command } = call.request;
      const output = await this.serverProcess.executeCommand(command);
      callback(null, { success: true, output });
    } catch (error) {
      callback(null, { success: false, output: error.message });
    }
  }

  async start() {
    // Start gRPC server
    const grpcPort = process.env.GRPC_PORT || '50051';
    this.grpcServer.bindAsync(
      `0.0.0.0:${grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('Failed to start gRPC server:', error);
          return;
        }
        this.grpcServer.start();
        console.log(`🔌 gRPC server running on port ${port}`);
      }
    );

    // Start HTTP server
    const httpPort = process.env.AGENT_PORT || 3002;
    this.httpServer.listen(httpPort, () => {
      console.log(`🌐 HTTP server running on port ${httpPort}`);
    });

    console.log(`📡 WebSocket server running on port 3003`);
    console.log(`🤖 MineCtrl Agent started successfully`);
  }
}

// Start the agent
const agent = new AgentServer();
agent.start().catch(console.error);