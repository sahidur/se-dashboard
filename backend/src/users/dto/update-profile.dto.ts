import { PickType } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

/**
 * Fields a user is allowed to change on their OWN profile.
 *
 * Deliberately an explicit allowlist rather than `UpdateUserDto` minus a few
 * keys: `roleIds`, `isActive` and especially `schoolIds` are authorisation
 * data. `schoolIds` drives `validateSchoolAccess()` in the data-collection and
 * school-monitoring modules, so accepting it here would let any authenticated
 * user grant themselves access to every school (privilege escalation).
 *
 * Combined with the global `forbidNonWhitelisted` ValidationPipe, sending any
 * other property to `PATCH /users/me/profile` is now rejected with a 400.
 */
export class UpdateProfileDto extends PickType(UpdateUserDto, [
  'firstName',
  'lastName',
  'email',
  'phone',
  'pin',
  'designation',
  'base',
  'geoLocationId',
  'profilePicture',
] as const) {}
