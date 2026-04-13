// Unified resource model interface
export interface Resource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
  serverName?: string;
  serverIndex?: number;
}
