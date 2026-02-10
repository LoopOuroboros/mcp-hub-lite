// 共享通用类型定义

// 服务器状态类型
export type ServerStatus = 'online' | 'offline' | 'error' | 'starting' | 'stopping';

// 服务器传输协议类型
export type ServerTransport = 'stdio' | 'sse' | 'streamable-http' | 'http';

// 服务器类型
export type ServerType = 'local' | 'remote';

// 日志级别类型
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
