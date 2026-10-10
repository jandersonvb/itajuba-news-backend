import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, UnauthorizedException, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { PortalService } from './portal.service';
import { AdminGuard } from './auth';
import { User } from './entities';
import { verifyPassword,hashPassword } from './password';
import { LoginDto,ArticleDto,UpdateArticleDto,SponsorDto,UpdateSponsorDto,CampaignDto,UpdateCampaignDto,LeadDto } from './dto';
type AdminRequest=Request&{admin:{portalId:string;sub:string}};
@Controller() export class PublicController {
 constructor(private service:PortalService){}
 @Get('health') health(){return {status:'ok'};}
 @Get('portal') portal(){return this.service.portal();}
 @Get('categories') categories(){return this.service.categories();}
 @Get('articles') articles(@Query('search') search='',@Query('category') category='',@Query('page') raw='1'){const page=Number(raw);if(!Number.isInteger(page)||page<1||page>1000||search.length>200)throw new BadRequestException('Consulta inválida');return this.service.articles(search,category,page);}
 @Get('articles/:slug') article(@Param('slug') slug:string){return this.service.article(slug);}
 @Get('campaigns') campaigns(@Query('slot') slot='leaderboard'){if(!['leaderboard','sidebar'].includes(slot))throw new BadRequestException('Slot inválido');return this.service.campaigns(slot);}
 @Post('leads') @Throttle({default:{limit:5,ttl:60000}}) lead(@Body() dto:LeadDto){return this.service.lead(dto);}
}
@Controller('auth') export class AuthController {
 private dummy=hashPassword('unused-random-password');
 constructor(private db:DataSource,private jwt:JwtService,private portal:PortalService){}
 @Post('login') @Throttle({default:{limit:5,ttl:60000}})
 async login(@Body() dto:LoginDto){const p=await this.portal.portal();const user=await this.db.getRepository(User).createQueryBuilder('user').addSelect('user.passwordHash').where('user.portalId = :portalId AND user.email = :email AND user.active = true',{portalId:p.id,email:dto.email.toLowerCase()}).getOne();const valid=verifyPassword(dto.password,user?.passwordHash||this.dummy);if(!user||!valid)throw new UnauthorizedException('E-mail ou senha inválidos');return {accessToken:await this.jwt.signAsync({sub:user.id,portalId:p.id,role:'admin'}),expiresIn:3600};}
}
@Controller('admin') @UseGuards(AdminGuard) export class AdminController {
 constructor(private s:PortalService){}
 @Get(':resource') list(@Param('resource') r:string,@Req() req:AdminRequest){return this.s.list(this.resource(r),req.admin.portalId);}
 @Post('articles') article(@Body() dto:ArticleDto,@Req() req:AdminRequest){return this.s.saveArticle(dto,req.admin.portalId);}
 @Patch('articles/:id') updateArticle(@Param('id',ParseUUIDPipe) id:string,@Body() dto:UpdateArticleDto,@Req() req:AdminRequest){return this.s.saveArticle(dto,req.admin.portalId,id);}
 @Post('sponsors') sponsor(@Body() dto:SponsorDto,@Req() req:AdminRequest){return this.s.saveSponsor(dto,req.admin.portalId);}
 @Patch('sponsors/:id') updateSponsor(@Param('id',ParseUUIDPipe) id:string,@Body() dto:UpdateSponsorDto,@Req() req:AdminRequest){return this.s.saveSponsor(dto,req.admin.portalId,id);}
 @Post('campaigns') campaign(@Body() dto:CampaignDto,@Req() req:AdminRequest){return this.s.saveCampaign(dto,req.admin.portalId);}
 @Patch('campaigns/:id') updateCampaign(@Param('id',ParseUUIDPipe) id:string,@Body() dto:UpdateCampaignDto,@Req() req:AdminRequest){return this.s.saveCampaign(dto,req.admin.portalId,id);}
 @Delete(':resource/:id') remove(@Param('resource') r:string,@Param('id',ParseUUIDPipe) id:string,@Req() req:AdminRequest){return this.s.remove(this.resource(r),req.admin.portalId,id);}
 private resource(r:string):'articles'|'sponsors'|'campaigns'|'leads'{if(!['articles','sponsors','campaigns','leads'].includes(r))throw new BadRequestException('Recurso inválido');return r as 'articles'|'sponsors'|'campaigns'|'leads';}
}
