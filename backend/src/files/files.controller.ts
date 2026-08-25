import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Delete,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    // Prevent path traversal via folder param
    const safeFolder = (folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    return this.filesService.uploadFile(file, safeFolder || 'uploads');
  }

  @Post('upload-multiple')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }),
  )
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder?: string,
  ) {
    const safeFolder = (folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
    return this.filesService.uploadMultipleFiles(files, safeFolder || 'uploads');
  }

  @Delete(':key')
  @Permissions({ module: 'recycle-bin', action: 'delete' })
  @ApiOperation({ summary: 'Permanently delete a file (privileged)' })
  async deleteFile(@Param('key') key: string) {
    // Deleting a stored file is irreversible and was previously open to any
    // authenticated user, which allowed destroying other people's evidence
    // photos/attachments. It now requires the same permission as emptying the
    // recycle bin.
    if (!/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) {
      throw new BadRequestException('Invalid file key');
    }
    await this.filesService.deleteFile(key);
    return { message: 'File deleted successfully' };
  }

  @Get('serve')
  @ApiOperation({ summary: 'Serve a locally stored file (authenticated)' })
  async serveLocalFile(
    @Query('key') key: string,
    @Res() res: Response,
  ) {
    if (!key) throw new BadRequestException('key is required');
    // Prevent path traversal
    const uploadDir = path.resolve(process.cwd(), 'uploads');
    const resolved = path.resolve(uploadDir, key);
    if (!resolved.startsWith(uploadDir + path.sep) && resolved !== uploadDir) {
      throw new BadRequestException('Invalid file key');
    }
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('File not found');
    }
    // Prevent serving executable content types
    const ext = path.extname(resolved).toLowerCase();
    const SAFE_EXTENSIONS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.pdf','.xlsx','.xls','.csv']);
    if (!SAFE_EXTENSIONS.has(ext)) {
      throw new BadRequestException('File type not allowed for serving');
    }
    // Same locked-down header set as the static mount in main.ts / nginx:
    // nothing served here may execute or be framed in the API origin.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'; sandbox",
    );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.sendFile(resolved);
  }
}
