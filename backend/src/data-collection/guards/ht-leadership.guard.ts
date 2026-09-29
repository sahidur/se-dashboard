import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

/**
 * Resource key of the exclusive per-question permission guarding the
 * "Leadership Status of HT" field (strong | moderate | weak) on the
 * Teachers' Development form. Mirrors the `resource` value stored on
 * permission rows and selectable in Role Management.
 */
export const HT_LEADERSHIP_RESOURCE = 'ht-leadership';

/**
 * Per-question access guard for the "Leadership Status of HT" field.
 *
 * The field is exclusive: only Super Admins and roles explicitly granted
 * `data-collection` create/update on resource `ht-leadership` (via Role
 * Management → Per-question Access) may set or change it. Umbrella/wildcard
 * `data-collection` grants do NOT cover it — this question can only be
 * answered by its designated authority.
 *
 * When a caller without the grant submits the form with a leadership value,
 * the value is dropped rather than rejected, so the rest of the Teachers'
 * Development record still saves and any existing leadership assessment is
 * preserved untouched.
 */
@Injectable()
export class HtLeadershipGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const dto = request.body as { headTeacherLeadership?: string | null };

    // Field not present in the payload → nothing to police.
    if (!dto || dto.headTeacherLeadership == null) return true;

    const userId = request.user?.id;
    if (!userId) return false;

    const user = await this.usersService.findOneById(userId);
    if (!user) return false;

    const isSuperAdmin = (user.roles || []).some((r) => r.name === 'Super Admin');
    if (isSuperAdmin) return true;

    const holdsQuestionGrant = (user.roles || [])
      .flatMap((r) => r.permissions || [])
      .some(
        (p) =>
          p.module === 'data-collection' &&
          (p.action === 'create' || p.action === 'update') &&
          p.resource === HT_LEADERSHIP_RESOURCE,
      );

    if (holdsQuestionGrant) return true;

    // Exclusive field without the grant: strip the value so the rest of the
    // form saves, keeping any existing leadership assessment intact.
    delete dto.headTeacherLeadership;
    return true;
  }
}
