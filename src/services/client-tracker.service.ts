import { ClientContext } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';

export interface ClientInfo extends ClientContext {
  lastSeen: number;
  roots?: Array<{ uri: string; name?: string }>;
}

class ClientTrackerService {
  private clients: Map<string, ClientInfo> = new Map();
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

  constructor() {
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000);
  }

  public updateClient(context: ClientContext) {
    const existing = this.clients.get(context.clientId);
    this.clients.set(context.clientId, {
      ...context,
      // Preserve existing info if not provided in new request
      clientName: context.clientName || existing?.clientName,
      project: context.project || existing?.project,
      cwd: context.cwd || existing?.cwd, // Preserve CWD if not provided in new request (e.g. inferred from roots)
      userAgent: context.userAgent || existing?.userAgent,
      ip: context.ip || existing?.ip,
      
      lastSeen: Date.now(),
      roots: existing?.roots // Preserve roots if already fetched
    });
  }

  public updateClientRoots(clientId: string, roots: Array<{ uri: string; name?: string }>) {
    const client = this.clients.get(clientId);
    if (client) {
      client.roots = roots;
      client.lastSeen = Date.now();
      
      // If CWD is missing, try to infer from roots
      if (!client.cwd && roots.length > 0) {
        // Convert file:// uri to path if possible, or just use URI
        const root = roots[0];
        if (root.uri.startsWith('file://')) {
             try {
                 // Simple conversion for now, better to use url.fileURLToPath but avoiding extra imports if possible
                 // Actually fileURLToPath is standard node:url
                 const { fileURLToPath } = require('node:url');
                 client.cwd = fileURLToPath(root.uri);
             } catch (e) {
                 client.cwd = root.uri;
             }
        } else {
            client.cwd = root.uri;
        }
        logger.debug(`Inferred CWD for client ${clientId} from roots: ${client.cwd}`);
      }
    }
  }

  public getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  public getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, info] of this.clients.entries()) {
      if (now - info.lastSeen > this.TIMEOUT_MS) {
        this.clients.delete(id);
        logger.debug(`Removed stale client: ${id}`);
      }
    }
  }
}

export const clientTrackerService = new ClientTrackerService();
