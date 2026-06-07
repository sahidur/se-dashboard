import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';
import * as bcrypt from 'bcryptjs';

async function seed() {
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
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await usersService.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@bep.org',
        password: hashedPassword,
        phone: '+8801700000000',
      });
      console.log('✅ Super Admin user created (admin@bep.org / admin123)');

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
  } finally {
    await app.close();
  }
}

seed();
