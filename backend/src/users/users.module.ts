import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { DcSchool } from '../data-collection/entities/dc-school.entity';
import { AuditLog } from '../common/entities/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, DcSchool, AuditLog])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
