import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SelectPlanDto {
  @IsString()
  @MaxLength(40)
  planCode!: string;

  @IsOptional()
  @IsIn(['monthly','annual'])
  billingInterval?: 'monthly' | 'annual';
}

export class UpdateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;
}

export class ContinueOnboardingDto {
  @IsOptional()
  @IsBoolean()
  skipWebhook?: boolean;
}
