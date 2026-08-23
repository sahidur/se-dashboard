import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  IsUUID,
  IsInt,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Fixed dropdown options offered by the frontend for the "Designation" field.
// Backend intentionally only validates that it's a non-empty string so the
// list can be extended without a backend deploy.
export const USER_DESIGNATIONS = [
  'Field Officer',
  'Program Officer',
  'Coordinator',
  'Manager',
  'Regional Manager',
  'Monitoring & Evaluation Officer',
  'Data Entry Operator',
  'Admin Staff',
  'Other',
] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'john.doe@bep.org' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Str0ng!Passphrase',
    description:
      'At least 8 characters, including an uppercase letter, a lowercase letter and a digit.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter and one number',
  })
  password: string;

  @ApiPropertyOptional({ example: '+8801700000000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: ['role-uuid-1'] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional({ example: 1234, description: 'Positive numeric PIN' })
  @IsInt()
  @IsPositive()
  @IsOptional()
  pin?: number;

  @ApiPropertyOptional({ example: 'Field Officer' })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional({ example: 'Dhaka Regional Office' })
  @IsString()
  @IsOptional()
  base?: string;

  @ApiPropertyOptional({ description: 'GeoLocation node id (area/division/district/thana)' })
  @IsUUID()
  @IsOptional()
  geoLocationId?: string;

  @ApiPropertyOptional({ description: 'URL of an already-uploaded profile picture (jpg/png)' })
  @IsString()
  @IsOptional()
  profilePicture?: string;

  @ApiPropertyOptional({ example: ['school-uuid-1'], description: 'Schools this user should have access to' })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  schoolIds?: string[];
}
