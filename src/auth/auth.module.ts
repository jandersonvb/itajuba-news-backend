import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { jwtSecret } from '../config';
import { MailModule } from '../mail/mail.module';
import { AdminGuard } from './admin.guard';
import { TOKEN_TTL_SECONDS } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './user.entity';

/**
 * Login, invitations and password reset by e-mail, and the AdminGuard. Modules with admin routes
 * import it to resolve the guard; UsersModule also uses AuthService to send invitations.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MailModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: jwtSecret(),
        signOptions: { expiresIn: TOKEN_TTL_SECONDS, algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AdminGuard],
  exports: [AdminGuard, AuthService, JwtModule, TypeOrmModule],
})
export class AuthModule {}
