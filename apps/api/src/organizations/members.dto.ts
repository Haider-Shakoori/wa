import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsIn(['owner', 'admin', 'developer', 'member', 'viewer'])
  role!: 'owner' | 'admin' | 'developer' | 'member' | 'viewer';
}
