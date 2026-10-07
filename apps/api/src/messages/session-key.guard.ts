import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { ApiAuthenticatedRequest } from '../auth/api-access.guard';

@Injectable()
export class SessionKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiAuthenticatedRequest>();
    if (request.auth.kind !== 'api_key' || request.auth.tokenType !== 'session' || !request.auth.sessionId) {
      throw new ForbiddenException('Use the API key from your session Credentials tab');
    }
    request.params.sessionId = request.auth.sessionId;
    return true;
  }
}
