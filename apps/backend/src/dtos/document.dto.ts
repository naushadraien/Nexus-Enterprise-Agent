import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const DocumentJobParamSchema = z.object({
  jobId: z.string(),
});

export class DocumentJobParamDto extends createZodDto(DocumentJobParamSchema) {}
