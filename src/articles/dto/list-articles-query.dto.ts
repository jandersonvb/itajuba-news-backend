import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListArticlesQueryDto {
  /** Matches title or excerpt, case-insensitive. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search: string = '';

  /** Category id. */
  @IsOptional()
  @IsString()
  category: string = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;
}
