import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

class DispatchOptionsDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;
}

export class SendTextMessageDto extends DispatchOptionsDto {
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  to!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;
}

export class SendMediaMessageDto extends DispatchOptionsDto {
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  to!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  mimeType!: string;

  @IsInt()
  mediaSizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  caption?: string;

  @IsOptional()
  @IsBoolean()
  voiceNote?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;
}
