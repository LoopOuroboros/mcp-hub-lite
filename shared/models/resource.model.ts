// 统一的资源模型接口
export interface Resource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
  serverId?: string;
}
