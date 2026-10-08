import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Matches, Min, MinLength } from 'class-validator';


export class UpdateAlertResolutionDto {
  @IsBoolean()
  resolved!: boolean;
  @IsString() @MinLength(8) @MaxLength(500)
  reason!: string;
}

export class ArchiveDiagnosticDto {
  @IsString() @MinLength(8) @MaxLength(500)
  reason!: string;
}

export class UpdateAlertAcknowledgementDto {
  @IsBoolean()
  acknowledged!: boolean;
}

export class UpdateTenantSuspensionDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';

  @IsString() @MinLength(8) @MaxLength(500)
  reason!: string;
}

export class AddPlatformAdministratorDto {
  @IsEmail() @MaxLength(254)
  email!: string;

  @IsIn(['super_admin','billing_admin','support_admin','read_only'])
  role!: 'super_admin' | 'billing_admin' | 'support_admin' | 'read_only';

  @IsString() @MinLength(8) @MaxLength(240)
  reason!: string;
}

export class UpdatePlatformAdminRoleDto {
  @IsIn(['super_admin','billing_admin','support_admin','read_only'])
  role!: 'super_admin' | 'billing_admin' | 'support_admin' | 'read_only';

  @IsString() @MinLength(8) @MaxLength(240)
  reason!: string;
}

export class UpdateTenantMemberStatusDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';

  @IsString()
  @MinLength(8)
  @MaxLength(240)
  reason!: string;
}

/** Editable public plan catalog. Code is immutable after creation. */
export class WebsitePlanDto {
  @IsString() @Matches(/^[a-z][a-z0-9_-]{1,39}$/)
  code!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsInt() @Min(1) @Max(100000)
  maxSessions!: number;

  @IsInt() @Min(1) @Max(100000)
  maxApiKeys!: number;

  @IsOptional() @IsInt() @Min(1) @Max(100000000)
  dailyMessages?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(100000000)
  monthlyMessages?: number | null;

  @IsInt() @Min(0) @Max(100000000)
  monthlyPriceCents!: number;

  @IsInt() @Min(0) @Max(100000000)
  annualPriceCents!: number;

  @IsIn(['USD'])
  currency!: 'USD';

  @IsString() @MinLength(8) @MaxLength(500)
  reason!: string;
}

export class UpdatePlatformSubscriptionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(64)
  planCode?: string;

  @IsOptional()
  @IsIn(['trialing','active','past_due','paused','canceled','expired'])
  status?: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'expired';

  @IsOptional() @IsIn(['monthly','annual'])
  billingInterval?: 'monthly' | 'annual';

  @IsOptional() @IsInt() @Min(1) @Max(730)
  extendDays?: number;

  // Inclusive calendar date in UTC, e.g. "2026-12-31". Mutually exclusive with extendDays.
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodEndDate?: string;

  @IsString() @MinLength(8) @MaxLength(500)
  reason!: string;
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
