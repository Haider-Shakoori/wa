import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  organizationName?: string;
}

export class LoginDto {
  @IsOptional() @IsString() @MaxLength(2048)
  captchaToken?:string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  credential!: string;
}

export class GithubExchangeDto {
  @IsString()
  @MinLength(20)
  code!: string;
}

export class MfaVerifyDto {
  @IsString() @MinLength(8) @MaxLength(128)
  ticket!: string;

  @IsString() @MinLength(6) @MaxLength(32)
  code!: string;
}

export class MfaCodeDto {
  @IsString() @MinLength(6) @MaxLength(6)
  code!: string;
}
