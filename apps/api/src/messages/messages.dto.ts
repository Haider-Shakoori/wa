import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendTextMessageDto {
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

import { IsBoolean, IsInt, IsUrl } from 'class-validator';

export class SendMediaMessageDto {
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
