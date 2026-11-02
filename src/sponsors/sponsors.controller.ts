import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SponsorsService } from './sponsors.service';

@ApiTags('Sponsors')
@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsors: SponsorsService) {}

  /** Active sponsors for the "Quem apoia" section. */
  @Get()
  list() {
    return this.sponsors.listPublic();
  }
}
