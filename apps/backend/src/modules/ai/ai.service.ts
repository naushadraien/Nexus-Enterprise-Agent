import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LanguageModel, EmbeddingModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Helper to get the correct API key.
   */
  private getApiKey(): string {
    const key = this.configService.get<string>('GENERATIVE_AI_API_KEY');
    if (!key) {
      throw new InternalServerErrorException(
        'GENERATIVE_AI_API_KEY is not defined in the environment.',
      );
    }
    return key;
  }

  /**
   * Get the provider string from the environment, defaults to 'google'.
   */
  private getProviderName(): string {
    return this.configService
      .get<string>('AI_PROVIDER', 'google')
      .toLowerCase();
  }

  /**
   * Returns a configured language model instance based on AI_PROVIDER.
   */
  getModel(): LanguageModel {
    const provider = this.getProviderName();
    const apiKey = this.getApiKey();
    const modelId = this.configService.get<string>(
      'AI_MODEL_ID',
      'gemini-3.6-flash',
    );

    this.logger.debug(`Initializing AI Model: [${provider}] - ${modelId}`);

    switch (provider) {
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelId);
      }
      case 'openai': {
        const openai = createOpenAI({ apiKey });
        return openai(modelId);
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey });
        return anthropic(modelId);
      }
      case 'deepseek': {
        const deepseek = createDeepSeek({ apiKey });
        return deepseek(modelId);
      }
      case 'openrouter': {
        const openrouter = createOpenRouter({ apiKey });
        return openrouter(modelId);
      }
      default:
        this.logger.error(`Unsupported AI_PROVIDER: ${provider}`);
        throw new InternalServerErrorException(
          `Unsupported AI_PROVIDER: ${provider}. Use 'google', 'openai', 'anthropic', 'deepseek', or 'openrouter'.`,
        );
    }
  }

  /**
   * Returns a configured embedding model instance.
   * Uses AI_EMBEDDING_PROVIDER if set, otherwise falls back to AI_PROVIDER.
   */
  getEmbeddingModel(): EmbeddingModel {
    const defaultProvider = this.getProviderName();
    const provider = this.configService
      .get<string>('AI_EMBEDDING_PROVIDER', defaultProvider)
      .toLowerCase();

    const apiKey =
      this.configService.get<string>('EMBEDDING_AI_API_KEY') ||
      this.getApiKey();

    const embeddingModelId = this.configService.get<string>(
      'AI_EMBEDDING_MODEL_ID',
      'gemini-embedding-001',
    );

    this.logger.debug(
      `Initializing Embedding Model: [${provider}] - ${embeddingModelId}`,
    );

    switch (provider) {
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey });
        return google.embedding(embeddingModelId);
      }
      case 'openai': {
        const openai = createOpenAI({ apiKey });
        return openai.embedding(embeddingModelId);
      }
      // Anthropic does not provide native embeddings in the AI SDK yet,
      // but we throw a clean error if attempted.
      case 'anthropic':
        this.logger.error(
          'Anthropic does not currently support embedding models via Vercel AI SDK.',
        );
        throw new InternalServerErrorException(
          'Anthropic embeddings are not supported.',
        );
      case 'deepseek':
        this.logger.error(
          'DeepSeek does not currently support embedding models via Vercel AI SDK.',
        );
        throw new InternalServerErrorException(
          'DeepSeek embeddings are not supported.',
        );
      case 'openrouter':
        this.logger.error(
          'OpenRouter does not currently support embedding models via Vercel AI SDK (it focuses on chat models).',
        );
        throw new InternalServerErrorException(
          'OpenRouter embeddings are not supported.',
        );
      default:
        this.logger.error(
          `Unsupported AI_PROVIDER for embeddings: ${provider}`,
        );
        throw new InternalServerErrorException(
          `Unsupported AI_PROVIDER for embeddings: ${provider}.`,
        );
    }
  }
}
