import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  @IsIn([true, false])
  enabled?: boolean;
}
