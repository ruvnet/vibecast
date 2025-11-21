/**
 * Core types for PubNub + ruv.io integration
 */

export interface PubNubConfig {
  publishKey: string;
  subscribeKey: string;
  userId?: string;
  ssl?: boolean;
  logVerbosity?: boolean;
}

export interface Message {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  sender: string;
  metadata?: Record<string, any>;
}

export enum MessageType {
  // Basic messaging
  TEXT = 'text',
  DATA = 'data',
  EVENT = 'event',

  // Agent orchestration
  AGENT_TASK = 'agent_task',
  AGENT_RESPONSE = 'agent_response',
  AGENT_STATUS = 'agent_status',

  // Swarm coordination
  SWARM_INIT = 'swarm_init',
  SWARM_SYNC = 'swarm_sync',
  SWARM_COMPLETE = 'swarm_complete',

  // Flow-nexus integration
  FLOW_START = 'flow_start',
  FLOW_UPDATE = 'flow_update',
  FLOW_END = 'flow_end',

  // MCP Protocol
  MCP_REQUEST = 'mcp_request',
  MCP_RESPONSE = 'mcp_response',
}

export interface AgentTask {
  taskId: string;
  agentId: string;
  type: string;
  payload: any;
  priority?: number;
  dependencies?: string[];
}

export interface AgentResponse {
  taskId: string;
  agentId: string;
  status: 'success' | 'error' | 'pending';
  result?: any;
  error?: string;
}

export interface SwarmConfig {
  swarmId: string;
  agents: string[];
  strategy: 'parallel' | 'sequential' | 'hierarchical';
  coordinator?: string;
}

export interface PresenceData {
  uuid: string;
  state?: Record<string, any>;
  joined?: boolean;
}

export interface Channel {
  name: string;
  description?: string;
  type: 'public' | 'private' | 'agent' | 'swarm';
}

export type MessageHandler = (message: Message) => void | Promise<void>;
export type PresenceHandler = (presence: PresenceData) => void | Promise<void>;
