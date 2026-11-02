import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { SLUG_PATTERN } from '../../common/validation';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 80)
  name: string;

  /** Used in the portal URL (`/?editoria=<slug>`). */
  @Matches(SLUG_PATTERN)
  @Length(2, 100)
  slug: string;

  /** Order in the portal menu, ascending. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  position?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
