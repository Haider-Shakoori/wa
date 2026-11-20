import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBotDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsUUID() sessionId!: string;
}
export class CreateFaqDto {
  @IsString() @MinLength(1) @MaxLength(500) question!: string;
  @IsString() @MinLength(1) @MaxLength(4000) answer!: string;
  @IsOptional() @IsArray() @IsString({each:true}) aliases?: string[];
}
