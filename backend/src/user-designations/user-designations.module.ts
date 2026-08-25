import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDesignationsService } from './user-designations.service';
import { UserDesignationsController } from './user-designations.controller';
import { UserDesignation } from './entities/user-designation.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserDesignation]), UsersModule],
  controllers: [UserDesignationsController],
  providers: [UserDesignationsService],
  exports: [UserDesignationsService],
})
export class UserDesignationsModule {}
