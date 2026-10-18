import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../auth/guards/access.guard';
import { GlobalAdminGuard } from '../auth/guards/global-admin.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// Only files written by the fee migration script can ever be served.
const REPORT_NAME = /^fee-migration-(preview|applied)-[0-9-]+\.csv$/;

function reportDir(): string {
  return path.resolve(process.env.FEE_REPORT_DIR || './reconcile-output');
}

/**
 * TEMPORARY: lets a Super Admin / Admin download the review CSVs produced by
 * `reconcile-admission-fees` from the browser instead of using scp. The files
 * hold student names, so access is admin-only, the name is whitelisted, and
 * every download is logged. Delete this controller (and its line in
 * FeeCollectionModule) once the migration has been reviewed and applied.
 */
@ApiTags('Fee Collection')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard, GlobalAdminGuard)
@Controller('fee-collection/migration-reports')
export class FeeMigrationReportsController {
  private readonly logger = new Logger(FeeMigrationReportsController.name);

  @Get()
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'List fee-migration review files (admin only, temporary)' })
  list() {
    const dir = reportDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => REPORT_NAME.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return { name, size: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  @Get(':name')
  @Permissions({ module: 'fee-collection', action: 'read' })
  @ApiOperation({ summary: 'Download one fee-migration review file (admin only, temporary)' })
  download(
    @Param('name') name: string,
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!REPORT_NAME.test(name)) throw new NotFoundException('File not found');
    const dir = reportDir();
    const file = path.join(dir, name);
    // Belt and braces on top of the whitelist: never leave the report folder.
    if (path.dirname(file) !== dir || !fs.existsSync(file)) {
      throw new NotFoundException('File not found');
    }
    this.logger.log(`User ${userId} downloaded ${name}`);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(fs.createReadStream(file));
  }
}
