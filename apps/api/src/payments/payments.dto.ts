import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsIn(['starter','growth','scale'])
  planCode!: string;

  @IsOptional()
  @IsIn(['monthly','annual'])
  billingInterval?: 'monthly' | 'annual';
}

export class CreateManualPaymentDto extends CreateCheckoutDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reference!: string;
}

export class UpdateProviderDto {
  @IsString()
  @IsIn(['stripe','manual'])
  provider!: 'stripe' | 'manual';

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown>;
}
