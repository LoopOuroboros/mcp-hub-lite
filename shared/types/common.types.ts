// Shared common type definitions

// Server status type
export type ServerStatus = 'online' | 'offline' | 'error' | 'starting' | 'stopping';

// Server transport protocol type
export type ServerTransport = 'stdio' | 'sse' | 'streamable-http' | 'http';

// Server type
export type ServerType = 'local' | 'remote';

// Log level type
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
