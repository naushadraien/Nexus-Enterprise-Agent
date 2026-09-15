import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  UseGuards,
  Req,
  Param,
  Delete,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { DocumentService } from './document.service';
import { DocumentJobParamDto } from './dto/document.dto';

interface AuthRequest {
  user: {
    sub: string;
  };
}

@Controller('api/documents')
@UseGuards(AuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Delegate text extraction to DocumentService
      const textContent = await this.documentService.extractTextAsync(file);

      if (!textContent.trim()) {
        throw new BadRequestException('Extracted text is empty');
      }

      // Delegate queue management to DocumentService
      const userId = req.user.sub;
      return await this.documentService.enqueueDocument(
        textContent,
        file.originalname,
        userId,
      );
    } catch (error) {
      console.error('UPLOAD_CRASH:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Upload failed',
      );
    }
  }

  @Get('status/:jobId')
  async getJobStatus(@Param() param: DocumentJobParamDto) {
    return await this.documentService.getJobStatus(param.jobId);
  }

  @Delete('cancel/:jobId')
  async cancelJob(@Param() param: DocumentJobParamDto) {
    return await this.documentService.cancelJob(param.jobId);
  }
}
