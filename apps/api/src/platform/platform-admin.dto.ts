import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdatePlatformSubscriptionDto {
  @IsOptional()
  @IsString()
  planCode?: string;

  @IsOptional()
  @IsIn(['trialing','active','past_due','paused','canceled','expired'])
  status?: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  extendDays?: number;
}

export class UpdateGoogleAuthProviderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateGithubAuthProviderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}


export class UpdateMessagingEngineDto {
  @IsIn(['baileys', 'chromium'])
  engine!: 'baileys' | 'chromium';
}

export class UpdateMessagingSafetyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(1000) @Max(60000)
  minDelayMs?: number;

  @IsOptional() @IsInt() @Min(1000) @Max(120000)
  maxDelayMs?: number;

  @IsOptional() @IsInt() @Min(1) @Max(120)
  messagesPerMinute?: number;

  @IsOptional() @IsInt() @Min(1) @Max(5000)
  messagesPerHour?: number;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  burstLimit?: number;

  @IsOptional() @IsInt() @Min(1) @Max(60)
  burstWindowSeconds?: number;

  @IsOptional() @IsInt() @Min(0) @Max(3600)
  duplicateWindowSeconds?: number;

  @IsOptional() @IsInt() @Min(1000) @Max(60000)
  retryBaseMs?: number;

  @IsOptional() @IsInt() @Min(1) @Max(10)
  maxAttempts?: number;

  @IsOptional() @IsInt() @Min(60) @Max(86400)
  maxQueueAgeSeconds?: number;

  @IsOptional() @IsInt() @Min(2) @Max(20)
  failurePauseThreshold?: number;

  @IsOptional() @IsInt() @Min(60) @Max(3600)
  failureWindowSeconds?: number;

  @IsOptional() @IsInt() @Min(60) @Max(86400)
  autoPauseSeconds?: number;
}

export class PlatformSupportQuestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  message!: string;
}
