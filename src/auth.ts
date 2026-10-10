import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { User } from './entities';
@Injectable() export class AdminGuard implements CanActivate {
 constructor(private jwt:JwtService,private db:DataSource){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const token=(req.headers.authorization||'').split(' ');if(token[0]!=='Bearer'||!token[1])throw new UnauthorizedException();try{const p=await this.jwt.verifyAsync(token[1],{algorithms:['HS256']});if(p.role!=='admin'||typeof p.sub!=='string'||typeof p.portalId!=='string')throw new Error();const user=await this.db.getRepository(User).findOneBy({id:p.sub,portalId:p.portalId,active:true});if(!user)throw new Error();req.admin=p;return true;}catch{throw new UnauthorizedException();}}
}
