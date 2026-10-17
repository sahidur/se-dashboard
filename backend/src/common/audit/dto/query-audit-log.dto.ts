import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Query / filter parameters for the audit-log viewer endpoints. */
export class QueryAuditLogDto {
  /** Entity category (e.g. `User`, `School`, `Survey`). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  module?: string;

  /** Action verb (e.g. `CREATE`, `UPDATE`, `DELETE`, `LOGIN`). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  /** Restrict to a specific acting user (admin view only). */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Free-text search across module / action / entity id / IP. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Inclusive lower bound (ISO date, e.g. `2026-07-01`). */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Inclusive upper bound (ISO date, e.g. `2026-07-15`). */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
