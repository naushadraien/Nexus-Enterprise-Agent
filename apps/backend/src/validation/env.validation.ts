import { z } from 'zod';

export const envSchema = z.object({
  // Database & Redis
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Pinecone
  PINECONE_API_KEY: z.string().min(1),
  PINECONE_INDEX: z.string().min(1),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),

  // OpenWeather
  OPENWEATHER_API_KEY: z.string().min(1),

  // AI Provider Configuration
  AI_PROVIDER: z
    .enum(['google', 'openai', 'anthropic', 'deepseek', 'openrouter'])
    .default('google'),
  AI_MODEL_ID: z.string().min(1).default('gemini-3.6-flash'),
  GENERATIVE_AI_API_KEY: z.string().min(1),

  // Embedding Provider Configuration
  AI_EMBEDDING_PROVIDER: z.enum(['google', 'openai']).optional(),
  AI_EMBEDDING_MODEL_ID: z.string().min(1).default('gemini-embedding-001'),
  EMBEDDING_AI_API_KEY: z.string().optional(),

  // App Config
  PORT: z.coerce.number().default(3001),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error(
      '❌ Invalid environment variables:',
      result.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
