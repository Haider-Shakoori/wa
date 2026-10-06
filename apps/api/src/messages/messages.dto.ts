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
