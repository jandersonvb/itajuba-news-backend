import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalController } from './portal.controller';
import { Portal } from './portal.entity';
import { PortalService } from './portal.service';

/** Global: every module resolves the current portal through PortalService. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Portal])],
  controllers: [PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
