import type { Resource } from '@shared-models/resource.model';

// 后端资源模型接口，扩展共享资源模型
export interface McpResource extends Resource {}

// 导出共享类型以便后端使用
export type { Resource };
