import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || user.roles === undefined || user.roles === null) {
      throw new ForbiddenException('Access denied');
    }

    const userRoles = Array.isArray(user.roles)
      ? user.roles
      : typeof user.roles === 'string'
        ? [user.roles]
        : [];

    if (userRoles.length === 0) {
      throw new ForbiddenException('Access denied');
    }

    const hasRole = userRoles.some((role: string) =>
      requiredRoles.includes(role),
    );
    if (!hasRole) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
