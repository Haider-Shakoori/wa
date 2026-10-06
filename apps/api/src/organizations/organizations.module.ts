import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { MembersController } from './members.controller';

@Module({
  controllers: [OrganizationsController, MembersController],
})
export class OrganizationsModule {}
