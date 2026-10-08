import { SetMetadata } from '@nestjs/common';

export type PlatformRole = 'super_admin' | 'billing_admin' | 'support_admin' | 'read_only';
export const PLATFORM_ROLES_KEY = 'platform_required_roles';
export const PlatformRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);
