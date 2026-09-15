import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import pdfParse from 'pdf-parse';
import { RAG_QUEUE_NAME, getJobCancelKey, redisClient } from './constants';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(@InjectQueue(RAG_QUEUE_NAME) private readonly ragQueue: Queue) {}

  /**
   * Extract text content from an uploaded file.
   * Supports PDF, plain text, JSON, CSV, and Markdown files.
   */
  extractText(file: Express.Multer.File): string {
    if (file.mimetype === 'application/pdf') {
      // PDF parsing is async — handled separately in extractTextAsync
      throw new Error('Use extractTextAsync() for PDF files');
    }

    if (
      file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/json' ||
      file.mimetype === 'application/csv' ||
      file.originalname.endsWith('.txt') ||
      file.originalname.endsWith('.md')
    ) {
      return file.buffer.toString('utf-8');
    }

    throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
  }

  /**
   * Extract text from any supported file, including async PDF parsing.
   */
  async extractTextAsync(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === 'application/pdf') {
      try {
        const data = await pdfParse(file.buffer);
        return data.text;
      } catch (pdfError) {
        this.logger.error('PDF_PARSE_ERROR:', pdfError);
        throw new BadRequestException('Failed to parse PDF file');
      }
    }

    return this.extractText(file);
  }

  /**
   * Enqueue a document for background RAG processing.
   */
  async enqueueDocument(
    textContent: string,
    originalname: string,
    userId: string,
  ) {
    const job = await this.ragQueue.add(
      'process-pdf',
      {
        textContent,
        originalname,
        userId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
      },
    );

    return {
      message: 'Document enqueued for processing',
      jobId: job.id,
      filename: originalname,
    };
  }

  /**
   * Get the status of a background processing job.
   */
  async getJobStatus(jobId: string) {
    const job = await this.ragQueue.getJob(jobId);
    if (!job) {
      throw new BadRequestException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId: job.id,
      state,
      progress,
      result: job.returnvalue as number | null,
      failedReason: job.failedReason,
    };
  }

  /**
   * Request cancellation of a background processing job.
   */
  async cancelJob(jobId: string) {
    const job = await this.ragQueue.getJob(jobId);
    if (job) {
      // Set a Redis flag that the worker can check periodically
      const cancelKey = getJobCancelKey(jobId);
      await redisClient.set(cancelKey, '1', 'EX', 3600); // Expire in 1 hour

      return { message: 'Job cancellation requested' };
    }
    throw new BadRequestException('Job not found');
  }
}
