import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

class BaseRecipientDto {
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;

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

export class SendReplyDto extends BaseRecipientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  quotedMessageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  quotedText?: string;

  @IsOptional()
  @IsBoolean()
  quotedFromMe?: boolean;
}

export class SendReactionDto extends BaseRecipientDto {
  @IsString()
  @MaxLength(32)
  emoji!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  targetMessageId!: string;

  @IsOptional()
  @IsBoolean()
  targetFromMe?: boolean;
}

export class SendLocationDto extends BaseRecipientDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class SendContactDto extends BaseRecipientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(12000)
  vcard!: string;
}

export class SendPollDto extends BaseRecipientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options!: string[];

  @IsInt()
  @Min(1)
  @Max(12)
  selectableCount!: number;
}
