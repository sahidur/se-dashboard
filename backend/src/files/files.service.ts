import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private s3Client: S3Client | null = null;
  private bucket: string;
  private folder: string;
  private useLocal: boolean;
  private localUploadDir: string;

  constructor(private configService: ConfigService) {
    const accessKey = this.configService.get('S3_ACCESS_KEY', '');
    const secretKey = this.configService.get('S3_SECRET_KEY', '');

    this.bucket = this.configService.get('S3_BUCKET', 'dev-shomadhanhobe-resources');
    this.folder = this.configService.get('S3_FOLDER', 'bep-se');
    this.localUploadDir = path.join(process.cwd(), 'uploads');

    // If S3 keys are not configured, use local storage
    if (!accessKey || !secretKey) {
      this.useLocal = true;
      this.logger.warn('S3 credentials not configured — using local file storage');
      // Ensure upload directory exists
      if (!fs.existsSync(this.localUploadDir)) {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      }
    } else {
      this.useLocal = false;
      this.s3Client = new S3Client({
        endpoint: this.configService.get('S3_ENDPOINT'),
        region: this.configService.get('S3_REGION', 'sgp1'),
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: false,
      });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    subfolder = 'uploads',
  ): Promise<{ url: string; key: string }> {
    // Validate MIME type against allowlist
    const ALLOWED_MIME_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type '${file.mimetype}' is not allowed`);
    }
    if (this.useLocal) {
      return this.uploadFileLocal(file, subfolder);
    }
    return this.uploadFileS3(file, subfolder);
  }

  private async uploadFileLocal(
    file: Express.Multer.File,
    subfolder: string,
  ): Promise<{ url: string; key: string }> {
    const ext = path.extname(file.originalname);
    const fileName = `${uuid()}${ext}`;
    const dir = path.join(this.localUploadDir, subfolder);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const key = `${subfolder}/${fileName}`;
    // Return a domain-agnostic relative URL served through the API prefix so
    // it works behind any reverse proxy / domain (not hardcoded to localhost).
    const url = `/api/uploads/${key}`;

    this.logger.log(`File saved locally: ${filePath}`);
    return { url, key };
  }

  private async uploadFileS3(
    file: Express.Multer.File,
    subfolder: string,
  ): Promise<{ url: string; key: string }> {
    const ext = path.extname(file.originalname);
    const key = `${this.folder}/${subfolder}/${uuid()}${ext}`;

    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    const region = this.configService.get('S3_REGION', 'sgp1');
    const url = `https://${this.bucket}.${region}.digitaloceanspaces.com/${key}`;

    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    if (this.useLocal) {
      // Prevent path traversal: ensure the resolved path stays within upload dir
      const resolvedPath = path.resolve(this.localUploadDir, key);
      if (!resolvedPath.startsWith(path.resolve(this.localUploadDir))) {
        throw new BadRequestException('Invalid file key');
      }
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      return;
    }
    await this.s3Client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.useLocal) {
      return `/api/uploads/${key}`;
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client!, command, { expiresIn });
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder = 'uploads',
  ): Promise<{ url: string; key: string }[]> {
    return Promise.all(files.map((file) => this.uploadFile(file, folder)));
  }
}
