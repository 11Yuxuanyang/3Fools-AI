/**
 * Chat Types
 * Types for AI chat functionality
 */

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // base64
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  timestamp: number;
  isStreaming?: boolean;
}

export type GenerationModel = 'default' | 'fast' | 'quality';
