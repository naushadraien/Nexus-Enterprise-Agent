import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
  sessionId: z.string().optional(),
});
export class ChatRequestDto extends createZodDto(ChatRequestSchema) {}

export const ChatSessionParamSchema = z.object({
  id: z.uuid().or(z.string()), // Accept UUID or any string id format used by DB
});
export class ChatSessionParamDto extends createZodDto(ChatSessionParamSchema) {}

export const RenameSessionSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').trim(),
});
export class RenameSessionDto extends createZodDto(RenameSessionSchema) {}

export const ChatHistoryQuerySchema = z.object({
  page: z.string().optional().default('1'),
  sessionId: z.string().optional(),
});
export class ChatHistoryQueryDto extends createZodDto(ChatHistoryQuerySchema) {}
