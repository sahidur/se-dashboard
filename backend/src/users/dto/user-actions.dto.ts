import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

/** PATCH /users/:id/status — activate or deactivate an account. */
export class SetUserStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

/** POST /users/:id/roles — replace the user's role set. */
export class AssignRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(0)
  @IsUUID('4', { each: true })
  roleIds!: string[];
}

/** POST /users/:id/schools — grant additional school access. */
export class AddSchoolsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  schoolIds!: string[];
}
