import { Redis } from 'ioredis';
import * as dotenv from 'dotenv';

dotenv.config();

export const RAG_QUEUE_NAME = 'rag-queue';

export const getJobCancelKey = (jobId: string) => `job:${jobId}:cancelled`;

export const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: 'localhost',
      port: 6379,
    });
