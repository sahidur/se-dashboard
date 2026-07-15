import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Verify a passkey registration (enrolment) ceremony. */
export class VerifyRegistrationDto {
  @ApiProperty({ description: 'The RegistrationResponseJSON from the browser' })
  @IsObject()
  response: any;

  @ApiPropertyOptional({ description: 'Friendly label for the passkey' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

/** Begin a passkey login ceremony (email optional for usernameless flow). */
export class PasskeyLoginOptionsDto {
  @ApiPropertyOptional({ description: 'Email to scope the credential list to' })
  @IsOptional()
  @IsString()
  email?: string;
}

/** Verify a passkey login ceremony. */
export class VerifyAuthenticationDto {
  @ApiProperty({ description: 'Flow id returned from the options request' })
  @IsString()
  flowId: string;

  @ApiProperty({ description: 'The AuthenticationResponseJSON from the browser' })
  @IsObject()
  response: any;
}

/** Rename an existing passkey. */
export class RenamePasskeyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;
}
