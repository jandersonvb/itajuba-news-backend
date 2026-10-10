import { IsString, IsEmail, IsIn, IsOptional, IsBoolean, IsUUID, IsUrl, IsISO8601, Length, Matches, Equals } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
export class LoginDto {
 @IsEmail() @Length(3,200) email:string;
 @IsString() @Length(12,200) password:string;
}
export class CategoryDto {
 @IsString() @Length(2,80) name:string;
 @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(2,100) slug:string;
}
export class ArticleDto {
 @IsString() @Length(5,200) title:string;
 @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(3,220) slug:string;
 @IsString() @Length(10,500) excerpt:string;
 @IsString() @Length(20,100000) content:string;
 @IsUUID() categoryId:string;
 @IsOptional() @IsUrl({protocols:['http','https'],require_protocol:true}) imageUrl?:string;
 @IsOptional() @IsString() @Length(2,100) author?:string;
 @IsIn(['draft','published']) status:'draft'|'published';
 @IsOptional() @IsBoolean() featured?:boolean;
}
export class UpdateArticleDto extends PartialType(ArticleDto) {}
export class SponsorDto {
 @IsString() @Length(2,120) name:string;
 @IsOptional() @IsUrl({protocols:['http','https'],require_protocol:true}) logoUrl?:string;
 @IsUrl({protocols:['http','https'],require_protocol:true}) websiteUrl:string;
 @IsOptional() @IsBoolean() active?:boolean;
}
export class UpdateSponsorDto extends PartialType(SponsorDto) {}
export class CampaignDto {
 @IsString() @Length(2,120) name:string;
 @IsUUID() sponsorId:string;
 @IsIn(['leaderboard','sidebar']) slot:'leaderboard'|'sidebar';
 @IsUrl({protocols:['http','https'],require_protocol:true}) imageUrl:string;
 @IsUrl({protocols:['http','https'],require_protocol:true}) targetUrl:string;
 @IsISO8601() startsAt:string;
 @IsISO8601() endsAt:string;
 @IsOptional() @IsBoolean() active?:boolean;
}
export class UpdateCampaignDto extends PartialType(CampaignDto) {}
export class LeadDto {
 @IsString() @Length(2,120) name:string;
 @IsEmail() @Length(3,200) email:string;
 @IsString() @Length(2,120) interest:string;
 @IsString() @Length(10,2000) message:string;
 @Equals(true) consent:boolean;
}
