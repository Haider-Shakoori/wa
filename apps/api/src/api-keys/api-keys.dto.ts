import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ALL_API_SCOPES } from './api-scopes';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(['organization', 'session'])
  tokenType?: 'organization' | 'session';

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsArray()
  @ArrayMaxSize(16)
  @IsIn(ALL_API_SCOPES, { each: true })
  scopes!: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
