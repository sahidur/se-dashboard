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

/**
 * Allowed upload MIME types mapped to the extension the file is stored with.
 *
 * The stored extension is derived from this map and NEVER from
 * `file.originalname`: uploads are served back as static files, so honouring a
 * user-supplied extension would let someone send `payload.html` with an
 * `image/png` content-type and get stored HTML served from the API origin
 * (stored XSS — OWASP A03).
 */
const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'text/csv': '.csv',
};

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
    if (!file?.buffer) {
      throw new BadRequestException('No file was uploaded');
    }
    // Validate MIME type against allowlist
    if (!ALLOWED_MIME_EXTENSIONS[file.mimetype]) {
      throw new BadRequestException(`File type '${file.mimetype}' is not allowed`);
    }
    if (this.useLocal) {
      return this.uploadFileLocal(file, subfolder);
    }
    return this.uploadFileS3(file, subfolder);
  }

  /** Safe, server-controlled extension for a validated upload. */
  private extensionFor(file: Express.Multer.File): string {
    return ALLOWED_MIME_EXTENSIONS[file.mimetype];
  }

  private async uploadFileLocal(
    file: Express.Multer.File,
    subfolder: string,
  ): Promise<{ url: string; key: string }> {
    const ext = this.extensionFor(file);
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
    const ext = this.extensionFor(file);
    const key = `${this.folder}/${subfolder}/${uuid()}${ext}`;

    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Objects are rendered in the browser; force the declared content type
        // and stop the browser sniffing it into something executable.
        ContentDisposition: 'inline',
        ACL: 'public-read',
      }),
    );

    const region = this.configService.get('S3_REGION', 'sgp1');
    const url = `https://${this.bucket}.${region}.digitaloceanspaces.com/${key}`;

    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    if (this.useLocal) {
      // Prevent path traversal: ensure the resolved path stays within upload dir.
      // The trailing separator matters — a bare `startsWith` would also accept a
      // sibling directory such as `<cwd>/uploads-backup`.
      const uploadDir = path.resolve(this.localUploadDir);
      const resolvedPath = path.resolve(uploadDir, key);
      if (!resolvedPath.startsWith(uploadDir + path.sep)) {
        throw new BadRequestException('Invalid file key');
      }
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      return;
    }
    // Confine deletions to this application's prefix so a crafted key cannot
    // remove unrelated objects that share the bucket.
    if (!key.startsWith(`${this.folder}/`)) {
      throw new BadRequestException('Invalid file key');
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
