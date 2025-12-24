#!/usr/bin/env tsx
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

console.log('Exploring MCP SDK structure...\n');

// Explore Client
const client = new Client({
  name: 'test-client',
  version: '1.0.0'
});

console.log('Client instance:', client);
console.log('Client type:', typeof client);
console.log('Client properties:', Object.getOwnPropertyNames(client));
console.log('Client keys:', Object.keys(client));

// Explore Server
const server = new Server({
  name: 'test-server',
  version: '1.0.0'
}, {
  capabilities: {}
});

console.log('\nServer instance:', server);
console.log('Server type:', typeof server);
console.log('Server properties:', Object.getOwnPropertyNames(server));
console.log('Server keys:', Object.keys(server));