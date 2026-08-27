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
import { createHash, createHmac, timingSafeEqual } from 'crypto';

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

/**
 * Binary signatures ("magic bytes") for allowed types where a reliable
 * signature exists. Multer's `file.mimetype` is whatever the CLIENT declared
 * in the multipart header, so without this check anyone could upload an
 * arbitrary payload (HTML, EXE, ZIP polyglot) labelled `image/png`.
 * `text/csv` has no meaningful signature and is exempt.
 */
const MIME_MAGIC_BYTES: Record<
  string,
  Array<{ offset: number; bytes: number[] }>
> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [
    {
      offset: 0,
      bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    },
  ],
  'image/gif': [
    { offset: 0, bytes: [...'GIF87a'].map((c) => c.charCodeAt(0)) },
    { offset: 0, bytes: [...'GIF89a'].map((c) => c.charCodeAt(0)) },
  ],
  // RIFF container with WEBP form marker at offset 8.
  'image/webp': [
    { offset: 0, bytes: [...'RIFF'].map((c) => c.charCodeAt(0)) },
    { offset: 8, bytes: [...'WEBP'].map((c) => c.charCodeAt(0)) },
  ],
  'application/pdf': [
    { offset: 0, bytes: [...'%PDF-'].map((c) => c.charCodeAt(0)) },
  ],
  // XLSX is a ZIP container (OOXML); legacy XLS is the OLE2 compound format.
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
    { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] },
    { offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] },
  ],
  'application/vnd.ms-excel': [
    { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  ],
};

/** Every extension this app may store/serve (single source of truth). */
export const SAFE_SERVE_EXTENSIONS = new Set([
  ...Object.values(ALLOWED_MIME_EXTENSIONS),
  '.jpeg',
]);

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private s3Client: S3Client | null = null;
  private bucket: string;
  private folder: string;
  private useLocal: boolean;
  private localUploadDir: string;

  /** Default validity of signed local upload URLs: 30 days. */
  private static readonly DEFAULT_URL_TTL_S = 30 * 24 * 60 * 60;

  constructor(private configService: ConfigService) {
    const accessKey = this.configService.get('S3_ACCESS_KEY', '');
    const secretKey = this.configService.get('S3_SECRET_KEY', '');

    this.bucket = this.configService.get('S3_BUCKET', 'dev-shomadhanhobe-resources');
    this.folder = this.configService.get('S3_FOLDER', 'bep-se');
    this.localUploadDir = path.join(process.cwd(), 'uploads');

    if (this.allowsUnsignedUrls()) {
      this.logger.warn(
        'UPLOADS_ALLOW_UNSIGNED=true — unsigned upload URLs are accepted ' +
          '(legacy migration grace). Disable it in production: possession of ' +
          'any URL then grants permanent anonymous access.',
      );
    }

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
    // Validate the actual bytes match the declared type (client-controlled
    // mimetype alone is attacker-chosen).
    this.assertMagicBytes(file);
    if (this.useLocal) {
      return this.uploadFileLocal(file, subfolder);
    }
    return this.uploadFileS3(file, subfolder);
  }

  /** Safe, server-controlled extension for a validated upload. */
  private extensionFor(file: Express.Multer.File): string {
    return ALLOWED_MIME_EXTENSIONS[file.mimetype];
  }

  /**
   * Content-type for storage, derived server-side from the allowlist map —
   * never from the client-declared header beyond the already-validated key.
   */
  private contentTypeFor(file: Express.Multer.File): string {
    return file.mimetype;
  }

  /** Reject files whose leading bytes don't match the declared type. */
  private assertMagicBytes(file: Express.Multer.File): void {
    const signatures = MIME_MAGIC_BYTES[file.mimetype];
    if (!signatures?.length) return; // e.g. text/csv
    const buf = file.buffer;
    if (!buf || buf.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }
    const matches = signatures.some(
      (sig) =>
        sig.offset + sig.bytes.length <= buf.length &&
        sig.bytes.every((byte, i) => buf[sig.offset + i] === byte),
    );
    if (!matches) {
      throw new BadRequestException(
        'File content does not match its declared type',
      );
    }
  }

  // ===================== Signed local upload URLs =====================
  // Locally stored uploads are rendered by the browser via <img>/<a> tags,
  // which cannot send Authorization headers, so the static mount cannot rely
  // on JWT auth. Instead every URL is HMAC-signed and expires: the serving
  // middleware (main.ts) rejects missing, tampered or stale signatures once
  // UPLOADS_ALLOW_UNSIGNED is disabled.

  /** Secret used to sign upload URLs. Derived from JWT_SECRET unless overridden. */
  private uploadUrlSecret(): string {
    const explicit = this.configService.get<string>('UPLOAD_URL_SECRET');
    if (explicit) return explicit;
    const jwtSecret = this.configService.get<string>('JWT_SECRET') || '';
    return createHash('sha256').update(`upload-url:${jwtSecret}`).digest('hex');
  }

  private urlTtlSeconds(): number {
    const raw = Number(this.configService.get('UPLOAD_URL_TTL_SECONDS'));
    return Number.isFinite(raw) && raw > 0
      ? raw
      : FilesService.DEFAULT_URL_TTL_S;
  }

  /** Whether unsigned legacy URLs are still accepted (migration grace). */
  allowsUnsignedUrls(): boolean {
    return this.configService.get('UPLOADS_ALLOW_UNSIGNED', 'false') === 'true';
  }

  /** Signed, relative URL for a locally stored upload key. */
  signUploadPath(key: string, ttlSeconds?: number): string {
    // Requested TTL is capped by the deployment-wide signing policy.
    const ttl = Math.min(
      ttlSeconds && Number.isFinite(ttlSeconds) && ttlSeconds > 0
        ? ttlSeconds
        : Number.POSITIVE_INFINITY,
      this.urlTtlSeconds(),
    );
    const exp = Math.floor(Date.now() / 1000) + (Number.isFinite(ttl) ? ttl : this.urlTtlSeconds());
    const sig = createHmac('sha256', this.uploadUrlSecret())
      .update(`${key}|${exp}`)
      .digest('base64url');
    return `/api/uploads/${key}?x-exp=${exp}&x-sig=${sig}`;
  }
  /**
   * Verify an incoming request for a locally stored upload. Returns false for
   * expired/tampered signatures; unsigned URLs are only permitted while the
   * legacy grace flag is enabled.
   */
  verifyLocalRequest(
    key: string,
    exp?: string | string[] | unknown,
    sig?: string | string[] | unknown,
  ): boolean {
    if (!key || key.includes('..')) return false;
    const expStr = Array.isArray(exp) ? String(exp[0]) : (exp as string);
    const sigStr = Array.isArray(sig) ? String(sig[0]) : (sig as string);
    if (!expStr || !sigStr) return this.allowsUnsignedUrls();
    const expNum = Number(expStr);
    if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
    const expected = createHmac('sha256', this.uploadUrlSecret())
      .update(`${key}|${expNum}`)
      .digest('base64url');
    const a = Buffer.from(sigStr);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
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
    // Signed, domain-agnostic relative URL served through the API prefix so
    // it works behind any reverse proxy / domain (not hardcoded to localhost).
    const url = this.signUploadPath(key);

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
        // Server-validated type (magic bytes checked above), not a raw echo
        // of the client header.
        ContentType: this.contentTypeFor(file),
        // Images stay inline (they are rendered via <img>); documents are
        // forced to download so nothing user-supplied renders/interprets on
        // the bucket origin.
        ContentDisposition: file.mimetype.startsWith('image/')
          ? 'inline'
          : 'attachment',
        // Don't let shared caches retain authenticated users' uploads.
        CacheControl: 'private, max-age=3600',
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
      // Honour the requested TTL (capped by the shared signing policy).
      return this.signUploadPath(key, expiresIn);
    }
    // Confine signing to this application's prefix — same bound as deletion,
    // so a crafted key cannot mint read links into unrelated bucket objects.
    if (!key || key.includes('..') || !key.startsWith(`${this.folder}/`)) {
      throw new BadRequestException('Invalid file key');
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
