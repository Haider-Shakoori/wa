import { IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';
export class CreateWebhookDto {
  @IsUrl({ require_tld: false }) url!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) eventTypes?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateWebhookDto {
  @IsOptional() @IsUrl({ require_tld: false }) url?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) eventTypes?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
