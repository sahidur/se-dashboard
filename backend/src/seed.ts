import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';

async function seed() {
  // Never seed the Super Admin with a publicly-known default password —
  // a seeded-but-unrotated admin account is a full account takeover.
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (
    !seedPassword ||
    /CHANGE_ME|change-in-production|placeholder/i.test(seedPassword)
  ) {
    console.error(
      '❌ SEED_ADMIN_PASSWORD is missing or a placeholder. ' +
        'Generate one with: openssl rand -base64 18',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Seed default roles
    const rolesService = app.get(RolesService);
    await rolesService.seedDefaultRoles();
    console.log('✅ Default roles seeded');

    // Create Super Admin user
    const usersService = app.get(UsersService);
    const existingAdmin = await usersService.findOneByEmail('admin@bep.org');
    if (!existingAdmin) {
      await usersService.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@bep.org',
        // Passed as plaintext — UsersService.create() does the hashing.
        password: seedPassword,
        phone: '+8801700000000',
      });
      console.log('✅ Super Admin user created (admin@bep.org)');

      // Assign Super Admin role
      const admin = await usersService.findOneByEmail('admin@bep.org');
      if (admin) {
        const roles = await rolesService.findAll();
        const superAdminRole = roles.find((r) => r.name === 'Super Admin');
        if (superAdminRole) {
          await usersService.assignRoles(admin.id, [superAdminRole.id]);
          console.log('✅ Super Admin role assigned');
        }
      }
    } else {
      console.log('ℹ️  Super Admin already exists, skipping');
    }

    console.log('\n🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

seed();
