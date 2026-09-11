import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RagService } from './rag.service';
import { RAG_QUEUE_NAME, getJobCancelKey, redisClient } from './constants';

@Processor(RAG_QUEUE_NAME)
export class RagProcessor extends WorkerHost {
  private readonly logger = new Logger(RagProcessor.name);

  constructor(
    private readonly ragService: RagService,
    @InjectQueue(RAG_QUEUE_NAME) private readonly ragQueue: Queue,
  ) {
    super();
  }

  async process(
    job: Job<
      { textContent: string; originalname: string; userId: string },
      any,
      string
    >,
  ): Promise<any> {
    this.logger.log(
      `Processing background job ${job.id} for document ${job.data.originalname}...`,
    );

    const checkCancel = async () => {
      const isCancelled = await redisClient.get(getJobCancelKey(job.id!));
      if (isCancelled) {
        throw new Error('CANCELLED');
      }
    };

    try {
      const chunksIngested = await this.ragService.ingestDocument(
        job.data.textContent,
        job.data.originalname,
        job.data.userId,
        async (progress: number) => {
          await job.updateProgress(progress);
        },
        checkCancel,
      );

      return { chunksIngested };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }
}
