import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { IsImageUrl, SLUG_PATTERN } from '../../common/validation';
import { ARTICLE_STATUSES, type ArticleStatus } from '../article.entity';

export class CreateArticleDto {
  @IsString()
  @Length(5, 200)
  title: string;

  @Matches(SLUG_PATTERN)
  @Length(3, 220)
  slug: string;

  @IsString()
  @Length(10, 500)
  excerpt: string;

  @IsString()
  @Length(20, 100_000)
  content: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsImageUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  author?: string;

  @IsIn(ARTICLE_STATUSES)
  status: ArticleStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
