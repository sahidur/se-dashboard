import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  module: string;
  action: 'create' | 'read' | 'update' | 'delete';
  /**
   * Optional sub-resource within the module (e.g. a data-collection form key).
   * When set, the caller needs either an exact grant for that resource or a
   * wildcard (resource-less) grant on the same module+action.
   */
  resource?: string;
}

export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
