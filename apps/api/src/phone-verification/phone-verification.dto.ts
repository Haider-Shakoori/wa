import { IsString, Matches } from 'class-validator';

export class StartPhoneVerificationDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {message: 'Use E.164 phone format, such as +937XXXXXXXX'})
  phone!: string;
}
