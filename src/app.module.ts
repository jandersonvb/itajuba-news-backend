import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule,ThrottlerGuard } from '@nestjs/throttler';
import { databaseOptions,jwtSecret } from './config';
import { PortalService } from './portal.service';
import { PublicController,AuthController,AdminController } from './controllers';
import { AdminGuard } from './auth';
@Module({imports:[TypeOrmModule.forRoot(databaseOptions()),JwtModule.register({secret:jwtSecret(),signOptions:{expiresIn:3600,algorithm:'HS256'}}),ThrottlerModule.forRoot([{ttl:60000,limit:120}])],controllers:[PublicController,AuthController,AdminController],providers:[PortalService,AdminGuard,{provide:APP_GUARD,useClass:ThrottlerGuard}]})
export class AppModule {}
