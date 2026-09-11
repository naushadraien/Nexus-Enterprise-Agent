import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableCors({
    exposedHeaders: ['x-session-id'],
  }); // Allow Next.js to access this API and read custom headers
  await app.listen(process.env.PORT ?? 3001); // Run backend on 3001
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
