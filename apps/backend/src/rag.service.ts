import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { embed, embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private pinecone!: Pinecone;
  private indexName = 'rag-project';

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.logger.log('Initializing RAG Service (Pinecone)...');

    const apiKey = this.configService.get<string>('PINECONE_API_KEY');
    if (!apiKey) {
      this.logger.warn('PINECONE_API_KEY is not set. RAG retrieval will fail.');
      return;
    }

    this.pinecone = new Pinecone({ apiKey });
    this.indexName =
      this.configService.get<string>('PINECONE_INDEX') || 'rag-project';
    this.logger.log(`Pinecone initialized for index: ${this.indexName}`);
  }

  /**
   * Simple sliding-window chunking utility
   */
  private chunkText(text: string, chunkSize = 7500, overlap = 1000): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + chunkSize));
      i += chunkSize - overlap;
    }
    return chunks;
  }

  /**
   * Process a document text, split it into chunks, embed, and save to Pinecone.
   */
  async ingestDocument(
    text: string,
    sourceName: string,
    userId?: string,
    onProgress?: (progress: number) => Promise<void>,
    checkCancel?: () => Promise<void>,
  ): Promise<number> {
    if (!this.pinecone) throw new Error('Pinecone is not initialized');

    this.logger.log(`Chunking document: ${sourceName}`);
    const chunks = this.chunkText(text);

    this.logger.log(
      `Generating embeddings for ${chunks.length} chunks (with throttling for rate limits)...`,
    );

    // The v1beta Gemini API only supports gemini-embedding-001, which is heavily throttled (15 RPM).
    // To bypass this, we use massive chunks (7500 chars) so most PDFs fit in a single batch of 5.
    const embedBatchSize = 5;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += embedBatchSize) {
      if (checkCancel) await checkCancel();
      
      const batch = chunks.slice(i, i + embedBatchSize);
      this.logger.log(
        `Embedding batch ${Math.floor(i / embedBatchSize) + 1} of ${Math.ceil(chunks.length / embedBatchSize)}...`,
      );

      const { embeddings } = await embedMany({
        model: google.embedding('gemini-embedding-001'),
        values: batch,
      });

      allEmbeddings.push(...embeddings);

      if (onProgress) {
        // Embedding is 50% of the work, upserting is the other 50%
        const progress = Math.round(((i + batch.length) / chunks.length) * 50);
        await onProgress(progress);
      }

      // Wait 22 seconds between batches to gracefully respect the 15 RPM limit for large documents
      if (i + embedBatchSize < chunks.length) {
        this.logger.log(
          `Sleeping for 22 seconds to respect Google API 15 RPM limit...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 22000));
      }
    }

    const records = chunks.map((chunk, i) => ({
      id: crypto.randomUUID(),
      values: allEmbeddings[i],
      metadata: {
        text: chunk,
        source: sourceName,
        chunkIndex: i,
      },
    }));

    this.logger.log(`Upserting to Pinecone index '${this.indexName}'...`);
    const baseIndex = this.pinecone.index(this.indexName);
    const targetIndex = userId ? baseIndex.namespace(userId) : baseIndex;

    // Pinecone upserts are recommended in batches of ~100 max
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      if (checkCancel) await checkCancel();
      
      const batch = records.slice(i, i + batchSize);
      await targetIndex.upsert({ records: batch });

      if (onProgress) {
        // Upserting is the remaining 50% of the work
        const progress =
          50 + Math.round(((i + batch.length) / records.length) * 50);
        await onProgress(progress);
      }
    }

    this.logger.log(
      `Successfully ingested ${records.length} chunks from ${sourceName}`,
    );
    return records.length;
  }

  /**
   * Performs similarity search in Pinecone to find the most relevant context.
   */
  async retrieveContext(
    query: string,
    userId?: string,
    topK: number = 3,
  ): Promise<string[]> {
    if (!this.pinecone) {
      this.logger.warn('Pinecone not initialized, skipping retrieval');
      return [];
    }

    try {
      this.logger.log(`Embedding query: "${query}"`);
      const { embedding: queryEmbedding } = await embed({
        model: google.embedding('gemini-embedding-001'),
        value: query,
      });

      const baseIndex = this.pinecone.index(this.indexName);
      const targetIndex = userId ? baseIndex.namespace(userId) : baseIndex;
      const queryResponse = await targetIndex.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      });

      const matches = queryResponse.matches || [];
      this.logger.log(`Found ${matches.length} matches from Pinecone`);

      return matches
        .map((match) => match.metadata?.text as string)
        .filter(Boolean);
    } catch (error) {
      this.logger.error('RAG Retrieval failed:', error);
      return [];
    }
  }
}
