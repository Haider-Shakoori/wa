import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RecordWebsiteViewDto {
  @Matches(/^[a-f0-9]{64}$/)
  visitorKey!: string;

  @IsString() @Matches(/^\//) @MaxLength(240)
  path!: string;

  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;

  @IsIn(['human','bot','suspected_bot'])
  trafficType!: 'human' | 'bot' | 'suspected_bot';

  @IsOptional() @IsString() @MaxLength(50)
  botFamily?: string | null;

  @IsIn(['desktop','mobile','tablet','other'])
  deviceType!: 'desktop' | 'mobile' | 'tablet' | 'other';

  @IsOptional() @IsString() @MaxLength(180)
  referrerHost?: string | null;
}
