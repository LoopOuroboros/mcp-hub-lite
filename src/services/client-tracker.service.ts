import type { ClientContext, ClientInfo, ClientRoot } from '@shared-types/client.types';
import { logger } from '@utils/logger.js';
import { eventBus } from './event-bus.service.js';
import { fileURLToPath } from 'node:url';

class ClientTrackerService {
  private clients: Map<string, ClientInfo> = new Map();
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

  constructor() {
    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000);
  }

  public updateClient(context: ClientContext) {
    const existing = this.clients.get(context.sessionId);
    const clientInfo: ClientInfo = {
      ...context,
      // Preserve existing info if not provided in new request
      clientName: context.clientName || existing?.clientName,
      clientVersion: context.clientVersion || existing?.clientVersion,
      protocolVersion: context.protocolVersion || existing?.protocolVersion,
      project: context.project || existing?.project,
      cwd: context.cwd || existing?.cwd, // Preserve CWD if not provided in new request (e.g. inferred from roots)
      userAgent: context.userAgent || existing?.userAgent,
      ip: context.ip || existing?.ip,

      lastSeen: Date.now(),
      roots: existing?.roots // Preserve roots if already fetched
    };
    this.clients.set(context.sessionId, clientInfo);

    // 如果是新客户端，发布连接事件
    if (!existing) {
      eventBus.publish('client-connected', {
        timestamp: Date.now(),
        client: clientInfo
      });
    }
  }

  public updateClientRoots(sessionId: string, roots: ClientRoot[]) {
    const client = this.clients.get(sessionId);
    if (client) {
      client.roots = roots;
      client.lastSeen = Date.now();

      // If CWD is missing, try to infer from roots
      if (!client.cwd && roots.length > 0) {
        // Convert file:// uri to path if possible, or just use URI
        const root = roots[0];
        if (root.uri.startsWith('file://')) {
             try {
                 client.cwd = fileURLToPath(root.uri);
             } catch {
                 client.cwd = root.uri;
             }
        } else {
            client.cwd = root.uri;
        }
        logger.debug(`Inferred CWD for session ${sessionId} from roots: ${client.cwd}`);
      }
    }
  }

  public getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  public getClient(sessionId: string): ClientInfo | undefined {
    return this.clients.get(sessionId);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, info] of this.clients.entries()) {
      if (now - info.lastSeen > this.TIMEOUT_MS) {
        this.clients.delete(id);
        logger.debug(`Removed stale client: ${id}`);

        // 发布客户端断开事件
        eventBus.publish('client-disconnected', {
          timestamp: Date.now(),
          clientId: id,
          client: info
        });
      }
    }
  }
}

export const clientTrackerService = new ClientTrackerService();
