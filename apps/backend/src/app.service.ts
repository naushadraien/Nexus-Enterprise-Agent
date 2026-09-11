import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from './db/schema';
import { DB_CONNECTION } from './db/db-connection';

@Injectable()
export class AppService {
  constructor(
    @Inject(DB_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async ensureUserExists(userId: string) {
    await this.db
      .insert(schema.users)
      .values({ id: userId })
      .onConflictDoNothing();
  }

  async getOrCreateSession(
    userId: string,
    sessionId: string | undefined,
    latestMessage: string,
  ) {
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const [newSession] = await this.db
        .insert(schema.chatSessions)
        .values({
          userId,
          title: latestMessage.substring(0, 50) || 'New Chat',
        })
        .returning();
      currentSessionId = newSession.id;
    }
    return currentSessionId;
  }

  async saveMessage(
    sessionId: string,
    role: 'system' | 'user' | 'assistant',
    content: string,
  ) {
    await this.db.insert(schema.messages).values({
      sessionId,
      role,
      content,
    });
  }

  async getSessions(userId: string) {
    return await this.db
      .select({
        id: schema.chatSessions.id,
        title: schema.chatSessions.title,
        createdAt: schema.chatSessions.createdAt,
      })
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.userId, userId))
      .orderBy(desc(schema.chatSessions.createdAt));
  }

  async getPaginatedHistory(userId: string, pageNum: number, limit: number, sessionId?: string) {
    const offset = (pageNum - 1) * limit;

    let targetSessionId = sessionId;

    if (!targetSessionId) {
      // Find latest session for this user if no session ID is provided
      const [latestSession] = await this.db
        .select()
        .from(schema.chatSessions)
        .where(eq(schema.chatSessions.userId, userId))
        .orderBy(desc(schema.chatSessions.createdAt))
        .limit(1);

      if (!latestSession) {
        return { sessionId: null, data: [], hasMore: false };
      }
      targetSessionId = latestSession.id;
    } else {
      // Verify the provided session belongs to the user
      const [session] = await this.db
        .select()
        .from(schema.chatSessions)
        .where(eq(schema.chatSessions.id, targetSessionId))
        .limit(1);
        
      if (!session || session.userId !== userId) {
         return { sessionId: null, data: [], hasMore: false };
      }
    }

    // Get messages (fetch limit + 1 to determine hasMore)
    const sessionMessages = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.sessionId, targetSessionId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = sessionMessages.length > limit;
    const paginatedMessages = sessionMessages.slice(0, limit);

    return {
      sessionId: targetSessionId,
      hasMore,
      data: paginatedMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        animate: false,
      })),
    };
  }

  async renameSession(userId: string, sessionId: string, title: string) {
    await this.db
      .update(schema.chatSessions)
      .set({ title: title.substring(0, 100) }) // Limit title length
      .where(
        and(
          eq(schema.chatSessions.id, sessionId),
          eq(schema.chatSessions.userId, userId)
        )
      );
  }

  async deleteSession(userId: string, sessionId: string) {
    // Verify session belongs to user
    const [session] = await this.db
      .select()
      .from(schema.chatSessions)
      .where(
        and(
          eq(schema.chatSessions.id, sessionId),
          eq(schema.chatSessions.userId, userId)
        )
      )
      .limit(1);

    if (!session) return;

    // Delete messages first to satisfy foreign key constraints
    await this.db
      .delete(schema.messages)
      .where(eq(schema.messages.sessionId, sessionId));

    // Delete the session
    await this.db
      .delete(schema.chatSessions)
      .where(eq(schema.chatSessions.id, sessionId));
  }
}
