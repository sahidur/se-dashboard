require('ts-node/register/transpile-only');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PATH_METADATA, GUARDS_METADATA, MODULE_METADATA } = require('@nestjs/common/constants');
const { APP_GUARD } = require('@nestjs/core');
const { IS_PUBLIC_KEY } = require('./auth/decorators/public.decorator');
const { JwtAuthGuard } = require('./auth/guards/jwt-auth.guard');
const { AccessGuard } = require('./auth/guards/access.guard');
const { ThrottlerGuard } = require('@nestjs/throttler');

const { AppModule } = require('./app.module');
const { HealthController } = require('./common/health/health.controller');
const { AuthController } = require('./auth/auth.controller');
const { UsersController } = require('./users/users.controller');
const { RolesController } = require('./roles/roles.controller');
const { SurveysController } = require('./surveys/surveys.controller');
const { FilesController } = require('./files/files.controller');
const { GeoLocationsController } = require('./geo-locations/geo-locations.controller');
const { UserDesignationsController } = require('./user-designations/user-designations.controller');
const { RecycleBinController } = require('./recycle-bin/recycle-bin.controller');
const { DataCollectionController } = require('./data-collection/data-collection.controller');
const { SchoolMonitoringController } = require('./school-monitoring/school-monitoring.controller');
const { StudentsController } = require('./students/students.controller');
const { FeeManagementController } = require('./fee-management/fee-management.controller');
const { FeeCollectionController } = require('./fee-collection/fee-collection.controller');
const { FinanceReportsController } = require('./fee-collection/finance-reports.controller');
const { AuditController } = require('./common/audit/audit.controller');

test('app boots with default-deny authn/authz guards after rate limiting', () => {
  const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) || [];
  const guardClasses = providers
    .filter((p) => p && p.provide === APP_GUARD)
    .map((p) => p.useClass);
  const names = guardClasses.map((c) => c.name);
  assert.deepEqual(names, [ThrottlerGuard.name, JwtAuthGuard.name, AccessGuard.name]);
});

test('health endpoint stays public for probes while everything else is guarded', () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check), true);
});

test('every API route is authenticated unless explicitly @Public()', () => {
  const controllers = [
    AuthController, HealthController, UsersController, RolesController,
    SurveysController, FilesController, GeoLocationsController,
    UserDesignationsController, RecycleBinController, DataCollectionController,
    SchoolMonitoringController, StudentsController, FeeManagementController,
    FeeCollectionController, FinanceReportsController, AuditController,
  ];
  for (const controller of controllers) {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, controller) || [];
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      if (name === 'constructor') continue;
      const handler = controller.prototype[name];
      if (typeof handler !== 'function') continue;
      if (!Reflect.getMetadata(PATH_METADATA, handler)) continue;
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
      const methodGuards = Reflect.getMetadata(GUARDS_METADATA, handler) || [];
      const guarded =
        classGuards.includes(JwtAuthGuard) || methodGuards.includes(JwtAuthGuard);
      assert.ok(
        isPublic || guarded,
        `${controller.name}.${name} is neither @Public() nor JWT-guarded`,
      );
    }
  }
});
