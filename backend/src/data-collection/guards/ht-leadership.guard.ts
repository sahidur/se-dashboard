import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

/**
 * Resource key of the exclusive per-question permission guarding the
 * "Leadership Status of HT" field (strong | moderate | weak) on the
 * Teachers' Development form. Mirrors the `resource` value stored on
 * permission rows and selectable in Role Management.
 */
export const HT_LEADERSHIP_RESOURCE = 'ht-leadership';

/** Body fields that set (or clear) the HT leadership assessment. */
const HT_LEADERSHIP_FIELDS = ['headTeacherLeadership', 'headTeacherLeadershipGood'];

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
    const dto = request.body as Record<string, unknown> | undefined;

    // Both the current field and its legacy boolean predecessor drive the
    // displayed leadership status, and an explicit `null` CLEARS a stored
    // assessment — so any presence of either key (null included) is policed.
    const present =
      !!dto &&
      typeof dto === 'object' &&
      HT_LEADERSHIP_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(dto, f));
    if (!present) return true;

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
    for (const f of HT_LEADERSHIP_FIELDS) delete (dto as Record<string, unknown>)[f];
    return true;
  }
}
