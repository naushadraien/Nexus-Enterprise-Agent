import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { embed, embedMany } from 'ai';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AiProviderService } from '../ai/ai.service';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private pinecone!: Pinecone;
  private indexName = 'rag-project';

  constructor(
    private configService: ConfigService,
    private aiProvider: AiProviderService,
  ) {}

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
    this.logger.log(`[Upload] Total chunks to process: ${chunks.length}`);

    this.logger.log(
      `Generating embeddings for ${chunks.length} chunks (with throttling for rate limits)...`,
    );

    const embedBatchSize = 10; // Increased batch size since we have resilient backoff
    const allEmbeddings: number[][] = [];
    const MAX_RETRIES = 5;

    for (let i = 0; i < chunks.length; i += embedBatchSize) {
      if (checkCancel) await checkCancel();

      const batch = chunks.slice(i, i + embedBatchSize);
      const batchNum = Math.floor(i / embedBatchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / embedBatchSize);

      let success = false;
      let retries = 0;

      while (!success && retries < MAX_RETRIES) {
        try {
          this.logger.log(
            `[Upload] Embedding batch ${batchNum}/${totalBatches} (chunks ${i + 1}-${Math.min(i + batch.length, chunks.length)}/${chunks.length})...`,
          );

          const { embeddings } = await embedMany({
            model: this.aiProvider.getEmbeddingModel(),
            values: batch,
          });

          allEmbeddings.push(...embeddings);
          success = true;
          this.logger.log(
            `[Upload] ✔ Batch ${batchNum}/${totalBatches} embedded successfully.`,
          );
        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (
            errMsg.includes('429') ||
            errMsg.includes('exhausted') ||
            errMsg.includes('quota') ||
            errMsg.includes('Too Many Requests')
          ) {
            retries++;
            this.logger.warn(
              `Google API rate limit hit! Sleeping for 60 seconds before retry ${retries}/${MAX_RETRIES}...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 60000));
          } else {
            throw e; // Non-rate-limit error, crash the job normally
          }
        }
      }

      if (!success) {
        throw new Error(
          'Failed to embed batch after maximum retries due to rate limits.',
        );
      }

      if (onProgress) {
        // Embedding is 50% of the work, upserting is the other 50%
        const progress = Math.round(((i + batch.length) / chunks.length) * 50);
        this.logger.log(`[Upload] Embedding progress: ${progress}%`);
        await onProgress(progress);
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

    this.logger.log(
      `[Upload] Upserting ${records.length} vectors to Pinecone index '${this.indexName}'...`,
    );
    const baseIndex = this.pinecone.Index(this.indexName);
    const targetIndex = userId ? baseIndex.namespace(userId) : baseIndex;

    // Pinecone upserts are recommended in batches of ~100 max
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      if (checkCancel) await checkCancel();

      const batch = records.slice(i, i + batchSize);
      await targetIndex.upsert({ records: batch });
      this.logger.log(
        `[Upload] ✔ Upserted ${Math.min(i + batch.length, records.length)}/${records.length} vectors.`,
      );

      if (onProgress) {
        // Upserting is the remaining 50% of the work
        const progress =
          50 + Math.round(((i + batch.length) / records.length) * 50);
        this.logger.log(`[Upload] Overall progress: ${progress}%`);
        await onProgress(progress);
      }
    }

    this.logger.log(
      `[Upload] ✅ Complete! Successfully ingested ${records.length} chunks from "${sourceName}".`,
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second strict timeout

      let queryEmbedding: number[];
      try {
        const result = await embed({
          model: this.aiProvider.getEmbeddingModel(),
          value: query,
          abortSignal: controller.signal,
        });
        queryEmbedding = result.embedding;
      } finally {
        clearTimeout(timeoutId);
      }

      const baseIndex = this.pinecone.Index(this.indexName);
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
