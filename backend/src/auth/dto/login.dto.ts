import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@bep.org' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  // Bounded so an oversized body can't be pushed through bcrypt. No minimum
  // here on purpose: login must answer with a uniform 401, not a policy hint.
  @MaxLength(128)
  password: string;
}
